import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("last")
    .setDescription("Grabs a user's lastfm information.")
    .addStringOption((opts) =>
      opts
        .setName("user")
        .setDescription("LastFM Username")
        .setRequired(true)
    ),
  execute: (interaction) => {
    const user = interaction.options.getString("user", true);

    interaction.reply({
      embeds: [embed({ message: "Pong!" })],
    });
  },
};

export default command;
