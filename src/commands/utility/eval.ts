import {
  ActionRowBuilder,
  InteractionReplyOptions,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";

const codeReplyOptions = (
  input: string,
  output: string[],
): InteractionReplyOptions => ({
  embeds: [embed({
    title: "Evaluated code.",
    kindOfEmbed: "success",
    message: `
      # Input \n
      \`\`\`ts\n
      ${input} 
      \`\`\`\n
      # Ouput
      \`\`\`ts\n${
      output
        .map((e) => `${Deno.inspect(e, { compact: false, depth: 2 })}`)
        .join("\n")
    }\`\`\``,
  })],
});
const codeHandler = async (
  code: string | null,
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  showOutput?: boolean
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

  try {
    if (code.includes("await")) {
      results.push(
        await eval(`(async () => {
	      ${code.replace("console.log", "results.push")}
	  })()`),
      );
    } else {
      results.push(await eval(code.replace("console.log", "results.push")));
    }

    if (showOutput === undefined || showOutput) await interaction.followUp(codeReplyOptions(code, results));
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

const codeModal = () => {
  const codeInput = new TextInputBuilder()
    .setCustomId("code")
    .setLabel("Typescript code.")
    .setStyle(TextInputStyle.Paragraph);

  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(codeInput);

  return new ModalBuilder()
    .setTitle("Typescript editor.")
    .setCustomId(`${command.command.name}`)
    .addComponents(inputRow);
};

const command: SlashCommand = {
  inDm: true,
  permissions: "nowhere",

  command: new SlashCommandBuilder()
    .setName("ts")
    .setDescription("Runs the provided javascript code.")
    .addSubcommand((subc) =>
      subc
        .setName("inline")
        .setDescription("For your beautiful ts-oneliners.")
        .addStringOption((opts) =>
          opts
            .setName("code")
            .setDescription("Write your javascript code here.")
            .setRequired(true)
        )
    )
    .addSubcommand((subc) =>
      subc
        .setName("multiline")
        .setDescription("For your longer codepieces.")
    ),
  execute: async (interaction) => {
    const code = interaction.options.getString("code");
    const subc = interaction.options.getSubcommand(true);

    if (subc === "multiline") {
      interaction.showModal(codeModal());
      console.log("MODAL")
      return;
    }

    await interaction.deferReply();
    await codeHandler(code, interaction);
  },
  modal: async (interaction) => {
    await interaction.deferReply();

    const code = interaction.fields.getField("code");
    await codeHandler(code.value, interaction);
  },
};

export default command;
