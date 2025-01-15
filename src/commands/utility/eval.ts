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
        message:
          `## Input \n${bt}ts\n${input}\n${bt}\n## Output\n${bt}ts\n${out}${bt}`,
      }).addFields(
        {
          name: "Input",
          value: codeBlock("ts", input),
        },
        ...output.map((v) => ({
          name: "Ouput",
          value: codeBlock("ts", v),
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

    if (code.includes("await")) {
      return [await eval(`(async () => { ${updatedCode} })()`)];
    } else {
      return [await eval(updatedCode)];
    }
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
          `${err.name}: ${err.message}\nLine: ${
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
