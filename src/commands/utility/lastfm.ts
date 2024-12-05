import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import SimpleFM from "@solely/simple-fm"
import config from "config" with {type: "json"}

const lastClient = new SimpleFM(config["lastfm-key"])

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
  execute: async (interaction) => {
    const user = interaction.options.getString("user", true);
    
    const tracks = await lastClient.user.getRecentTracks({username: user})
    const track = tracks.tracks[0]

    if (tracks.search.nowPlaying && track)
      interaction.reply({
	embeds: [embed({ message: "Pong!" })],
      });
    else
      interaction.reply({
	embeds: [embed({  })],
      });
  },
};

export default command;
