import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
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

const codeReplyOptions = (
  input: string,
  output: string[],
): InteractionReplyOptions => {
  const bt = "```";
  const out = output
    .map((e) => `${Deno.inspect(e, { compact: false, depth: 2 })}`)
    .join("\n");

  return {
    embeds: [embed({
      title: "Typescript interpreter.",
      kindOfEmbed: "success",
      message: `## Input \n${bt}ts\n${input}\n${bt}\n${
        output.some((v) => v !== undefined)
          ? `## Output\n${bt}ts\n${out}${bt}`
          : ""
      }`,
    })],
  };
};
const codeHandler = async (
  code: string | null,
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  showOutput?: boolean | null,
): Promise<void> => {
  const results: string[] = [];

  if (!code) {
    await interaction.followUp({
      embeds: [embed({
        kindOfEmbed: "error",
        title: "Error!",
        message: "Please provide a code string.",
      })],
    });
    return;
  }

  console.log(code)

  try {
    if (code.includes("await")) {
      results.push(
        await eval(`(async () => {
	      ${code.replace(/console\.\w+/g, "results.push")}
	  })()`),
      );
    } else {
      results.push(await eval(code.replace(/console\.\w+/g, "results.push")));
    }

    if (showOutput === undefined || showOutput === null || showOutput) {
      await interaction.followUp(codeReplyOptions(code, results));
    } else {
      await interaction.followUp({content: "Self destructing..."})
      await interaction.deleteReply();
    }
  } catch (e) {
    const err = e as Error;
    await interaction.followUp({
      embeds: [embed({
        title: "Error!",
        message: `\`\`\`js\n${err.name}: ${err.message}\nLine: ${
          err.stack
            ? err.stack.match(/<anonymous>:\d:\d/)?.[0].match(/\d:\d/)?.[0]
            : ""
        }\`\`\``,
        kindOfEmbed: "error",
      })],
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
    const code = interaction.options.getString("code");
    const subc = interaction.options.getSubcommand(true);
    const output = interaction.options.getBoolean("output");

    if (subc === "multiline") {
      interaction.showModal(codeModal(output));
      return;
    }

    await interaction.deferReply();
    await codeHandler(code, interaction, output);
  },
  modal: async (interaction) => {
    await interaction.deferReply();

    const output = interaction.customId === `${command.command.name}_true`;
    const code = interaction.fields.getField("code");
    await codeHandler(code.value, interaction, output);
  },
};

export default command;
