import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";

const command: SlashCommand = {
  inDm: true,
  permissions: "nowhere",

  command: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Send an anonymous message message.")
    .addStringOption((opts) =>
      opts
        .setName("content")
        .setDescription("Just a normal message.")
    )
    .addStringOption((opts) =>
      opts
        .setName("json")
        .setDescription("Additional json for the request.")
    ),
  execute: async (interaction) => {
    const content = interaction.options.getString("content");
    const json = interaction.options.getString("json");

    if (content === null && json === null) {
      await interaction.reply({
        embeds: [embed({
          title: "Error",
          message: "You must specify at least content or json.",
          kindOfEmbed: "error",
        })],
        ephemeral: true
      });
      return
    }

    await interaction.deferReply()
    await interaction.deleteReply()

    try {
      interaction.followUp({
        ...(content ? { content } : {}),
        ...JSON.parse(json ?? "{}"),
      });
    } catch (e) {
      interaction.followUp({
        embeds: [embed({
          title: "Error",
          message:
            `Something went wrong while sending the message. \`\`\`ts\n${e}\`\`\``,
          kindOfEmbed: "error",
        })],
      });
    }
  },
};

export default command;
