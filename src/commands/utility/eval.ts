import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  codeBlock,
  InteractionReplyOptions,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { SlashCommandSubcommandBuilder } from "discord.js";
import { delButtonRow } from "$utils/deleteBtn.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import ts from "typescript";

async function tseval(
  code: string,
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
): Promise<string[]> {
  const sourceFile = ts.createSourceFile(
    "temp.ts",
    code,
    ts.ScriptTarget.ESNext,
    true,
  );

  let lastExpressionNode: ts.ExpressionStatement | null = null;

  function findNodes(node: ts.Node) {
    if (ts.isExpressionStatement(node)) {
      lastExpressionNode = node;
    }
    ts.forEachChild(node, findNodes);
  }
  findNodes(sourceFile);

  const transformer = <T extends ts.Node>(
    context: ts.TransformationContext,
  ) => {
    const visit = (node: ts.Node): ts.Node => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText() === "console" &&
        node.expression.name.getText() === "log"
      ) {
        return ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier("results"),
            "push",
          ),
          undefined,
          node.arguments,
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node: T) => ts.visitNode(node, visit);
  };

  let transformer2;
  if (lastExpressionNode) {
    const expr = lastExpressionNode.expression;
    const isConsoleLog = ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      expr.expression.name.getText() === "log" &&
      expr.expression.expression.getText() === "console";

    if (!isConsoleLog) {
      const wrappedStmt = ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier("results"),
            "push",
          ),
          undefined,
          [expr],
        ),
      );

      transformer2 = <T extends ts.Node>(
        context: ts.TransformationContext,
      ) => {
        const visitor = (node: ts.Node): ts.Node => {
          if (node === lastExpressionNode) return wrappedStmt;
          return ts.visitEachChild(node, visitor, context);
        };
        return (node: T) => ts.visitNode(node, visitor);
      };
    }
  }

  const modifiedCode = ts.createPrinter().printFile(
    ts.transform(sourceFile, [
      transformer,
      ...(transformer2 ? [transformer2] : []),
    ]).transformed[0],
  );
  return (await (await import(
    "data:application/typescript," +
      encodeURIComponent(
        `export async function run(interaction, client) { const results: string[] = [];\nlet result = await ((async ()=>{${modifiedCode}})());\nif (result) results.push(result);\nreturn results; }`,
      )
  )).run(interaction, interaction.client));
}

const codeReplyOptions = (
  input: string,
  output: string[],
): InteractionReplyOptions => {
  return {
    embeds: [
      embed({
        title: "Typescript interpreter.",
        kindOfEmbed: "success",
      }).addFields(
        {
          name: "Input",
          value: codeBlock("ts", input),
        },
        ...output.map((v) => ({
          name: "Ouput",
          value: codeBlock("ts", Deno.inspect(v, { compact: false, depth: 2 })),
        })),
      ),
    ],
  };
};
const codeHandler = async (
  code: string,
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  showOutput?: boolean | null,
): Promise<void> => {
  const results: string[] = [];

  try {
    if (showOutput === false) {
      await interaction.deleteReply();
      results.push(...await tseval(code, interaction));
    } else {
      results.push(...await tseval(code, interaction));
      await interaction.followUp(codeReplyOptions(code, results));
    }
  } catch (e) {
    const err = e as Error;
    await interaction.followUp({
      embeds: [embed({
        title: "Error!",
        message: codeBlock(
          "ts",
          `${err.name}: ${
            err.message.replaceAll(
              /(The module's source code could not be parsed: )|(data:application\/typescript,.+?:)/g,
              "",
            )
          }\nLine: ${
            err.stack
              ? err.stack.match(/<anonymous>:\d:\d/)?.[0].match(/\d:\d/)?.[0]
              : ""
          }`,
        ),
        kindOfEmbed: "error",
      })],
      components: [
        delButtonRow(`${command.command.name}_delete_${interaction.user.id}`),
      ],
    });
  }
};

const codeModal = (output: boolean | null) => {
  const codeInput = new TextInputBuilder()
    .setCustomId(`code`)
    .setLabel("Typescript code.")
    .setStyle(TextInputStyle.Paragraph);

  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(codeInput);

  return new ModalBuilder()
    .setTitle("Typescript editor.")
    .setCustomId(`${command.command.name}_${output ?? true}`)
    .addComponents(inputRow);
};

const commonCommands = (
  subc: SlashCommandSubcommandBuilder,
  reqCmds?: (
    subc: SlashCommandSubcommandBuilder,
  ) => SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder => ((reqCmds ? reqCmds(subc) : subc)
  .addBooleanOption((opts) =>
    opts
      .setName("output")
      .setDescription(
        "Display your input and the command console.logs in chat.",
      )
  ));

const command: SlashCommand = {
  inDm: true,
  permissions: "nowhere",

  command: new SlashCommandBuilder()
    .setName("ts")
    .setDescription("Runs the provided javascript code.")
    .addSubcommand((subc) =>
      commonCommands(subc, (subc) =>
        subc
          .addStringOption((opts) =>
            opts
              .setName("code")
              .setDescription("Write your javascript code here.")
              .setRequired(true)
          ))
        .setName("inline")
        .setDescription("For your beautiful ts-oneliners.")
    )
    .addSubcommand((subc) =>
      commonCommands(subc)
        .setName("multiline")
        .setDescription("For your longer codepieces.")
    ),

  execute: async (interaction) => {
    const subc = interaction.options.getSubcommand(true);
    const output = interaction.options.getBoolean("output");

    if (subc === "multiline") {
      interaction.showModal(codeModal(output));
      return;
    }

    const code = interaction.options.getString("code", true);
    await interaction.deferReply();
    await codeHandler(code, interaction, output);
  },

  modal: async (interaction) => {
    const output = interaction.customId === `${command.command.name}_true`;
    const code = interaction.fields.getField("code");

    await interaction.deferReply();
    await codeHandler(code.value, interaction, output);
  },

  button: async (interaction) => {
    const id = interaction.customId;
    const command = id.split("_")[1];

    if (command !== "delete") return;
    if (interaction.user.id !== id.split("_")[2]) {
      await interaction.reply({
        embeds: [accessDeniedEmbed],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();
    await interaction.deleteReply();
  },
};

export default command;
