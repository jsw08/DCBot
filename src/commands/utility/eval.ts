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

async function tseval(code: string) {
  const sourceFile = ts.createSourceFile("temp.ts", code, ts.ScriptTarget.ESNext, true);

  let lastExpressionNode: ts.ExpressionStatement | null = null;

  function findNodes(node: ts.Node) {
    if (ts.isExpressionStatement(node)) {
      lastExpressionNode = node;
    }
    ts.forEachChild(node, findNodes);
  }

  findNodes(sourceFile);

  const transformer = <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
    function visit(node: ts.Node): ts.Node {
      if (node === lastExpressionNode && ts.isExpressionStatement(node)) {
        if (
          ts.isCallExpression(node.expression) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          ts.isIdentifier(node.expression.expression.expression) &&
          node.expression.expression.expression.text === "results" &&
          node.expression.expression.name.text === "push"
        ) {
          return node;
        }
        return ts.factory.createExpressionStatement(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("results"),
              "push"
            ),
            undefined,
            [node.expression]
          )
        );
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const expr = node.expression;
        if (expr.name.text === "log" && ts.isIdentifier(expr.expression) && expr.expression.text === "console") {
          return ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("results"),
                "push"
              ),
              undefined,
              node.arguments
            )
          );
        }
      }
      return ts.visitEachChild(node, visit, context);
    }
    return ts.visitNode(rootNode, visit);
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  const printer = ts.createPrinter();
  const modifiedCode = printer.printFile(transformed.transformed[0] as ts.SourceFile);

  return (await import('data:application/typescript,' + encodeURIComponent(`const results: string[] = [];\nawait ((async ()=>{${modifiedCode}})());\nexport default results;`))).default;
}

const codeReplyOptions = (
  input: string,
  output: string[],
): InteractionReplyOptions => {
  const bt = "```";
  const out = output
    .map((e) => `${Deno.inspect(e, { compact: false, depth: 2 })}`)
    .join("\n");

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
  const evalCode = async (code: string): Promise<string[]> => {
    const updatedCode = code.replace(/console\.\w+/g, "results.push");

    return await tseval(updatedCode);
  };

  try {
    if (showOutput === false) {
      await interaction.deleteReply();
      results.push(...await evalCode(code));
    } else {
      results.push(...await evalCode(code));
      await interaction.followUp(codeReplyOptions(code, results));
    }
  } catch (e) {
    const err = e as Error;
    await interaction.followUp({
      embeds: [embed({
        title: "Error!",
        message: codeBlock(
          "ts",
          `${err.name}: ${err.message.replaceAll(/(The module's source code could not be parsed: )|(data:application\/typescript,.+?:)/g, '')}\nLine: ${err.stack
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
