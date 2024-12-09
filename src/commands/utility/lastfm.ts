import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import db from "$utils/db.ts";
import { embed } from "$utils/embed.ts";

interface Track {
  artist: string;
  title: string;
  album: string;
  image: string;
  url: string;
}

db.sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      lastfm_username TEXT NOT NULL
    )
`;

const noUserEmbed = embed({
  title: "LastFM",
  message: "This user was not found.",
  kindOfEmbed: "error",
});

const getCurrentlyPlayingTrack = async (
  username: string,
  apiKey: string,
): Promise<Track | boolean> => {
  const url =
    `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    const tracks = data.recenttracks.track;
    if (
      tracks.length === 0 || !tracks[0] || !tracks[0]["@attr"] ||
      !tracks[0]["@attr"].nowplaying
    ) {
      return true;
    }

    const currentTrack = tracks[0];
    console.info(currentTrack);
    return {
      artist: currentTrack.artist["#text"],
      title: currentTrack.name,
      album: currentTrack.album["#text"],
      image: currentTrack.image[2]["#text"],
      url: currentTrack.url,
    };
  } catch (error) {
    console.error(error);
    return false;
  }
};

const checkLastFmUserExists = async (
  username: string,
  apiKey: string,
): Promise<boolean> => {
  const url =
    `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${apiKey}&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return !data.error;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return false;
  }
};

const setHandler = async (interaction: ChatInputCommandInteraction) => {
  const username = interaction.options.getString("username", true);
  if (!(await checkLastFmUserExists(username, config.LASTFM_KEY))) {
    interaction.reply({ embeds: [noUserEmbed], ephemeral: true });
    return;
  }

  db.sql`
    INSERT INTO users (discord_id, lastfm_username) 
    VALUES (${interaction.user.id}, ${username}) 
    ON CONFLICT(discord_id) 
    DO UPDATE SET lastfm_username = ${username};
  `;

  interaction.reply({
    embeds: [embed({
      title: "LastFM",
      message: `LastFM username set to '${username}'.`,
      kindOfEmbed: "success",
    })],
    ephemeral: true,
  });
};
const nowPlayingHandler = async (interaction: ChatInputCommandInteraction) => {
  const username = interaction.options.getString("username") ?? (() => {
    const result = db
      .sql` SELECT lastfm_username FROM users WHERE discord_id = ${interaction.user.id} LIMIT 1; `;
    return result.length > 0 ? result[0].lastfm_username : null;
  })();

  if (!username) {
    await interaction.reply({ embeds: [noUserEmbed], ephemeral: true });
  }

  const np: Track | boolean = await getCurrentlyPlayingTrack(
    username,
    config.LASTFM_KEY,
  );
  if (typeof np === "boolean") {
    await interaction.reply({
      embeds: [
        !np ? noUserEmbed : embed({
          title: `LastFM • ${username}`,
          message: "It's quiet here.\n-# You aren't playing any music.",
          kindOfEmbed: "warning",
        }),
      ],
    });
  } else {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `• Now Playing`,
            iconURL: interaction.user.avatarURL() ?? "",
          })
          .setTitle(np.title)
          .setURL(np.url)
          .setThumbnail(np.image)
          .setDescription(`**${np.artist}** on _${np.album}_`),
      ],
    });
  }
};

const command: SlashCommand = {
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("fm")
    .setDescription("Grabs a user's lastfm information.")
    .addSubcommand((subc) =>
      subc
        .setName("set")
        .setDescription("Stores your lastfm username in the db.")
        .addStringOption((opts) =>
          opts
            .setName("username")
            .setDescription("Your lastFM username.")
            .setRequired(true)
        )
    )
    .addSubcommand((subc) =>
      subc
        .setName("np")
        .setDescription(
          "Gets the current playing song of you or the specified player.",
        )
        .addStringOption((opts) =>
          opts
            .setName("username")
            .setDescription("A lastfm username.")
        )
    ),
  execute: (interaction) => {
    const subc = interaction.options.getSubcommand(true);
    switch (subc) {
      case "set": {
        setHandler(interaction);
        break;
      }
      case "np": {
        nowPlayingHandler(interaction);
        break;
      }
    }
  },
};

export default command;
