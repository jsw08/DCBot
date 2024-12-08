import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { config } from "$utils/config.ts";

interface Track {
  artist: string;
  title: string;
  album: string;
  image: string;
}

const getCurrentlyPlayingTrack = async (username: string, apiKey: string): Promise<Track | boolean> => {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
	console.log("User doesn't exist.")
	return false
      }
      console.error("LASTFM: Fetch went wrong, ", response)
      return false;
    }

    const data = await response.json();

    const tracks = data.recenttracks.track;
      console.info(tracks)
    if (tracks.length === 0 || !tracks[0] || !tracks[0]["@attr"] || !tracks[0]["@attr"].nowplaying) {
      console.info(tracks)
      return true;
    }

    const currentTrack = tracks[0];
    return {
      artist: currentTrack.artist['#text'],
      title: currentTrack.name,
      album: currentTrack.album['#text'],
      image: currentTrack.image[2]['#text'], // Assuming the third image size is preferred
    };
  } catch (error) {
    console.error(error);
    return false;
  }
}
const command: SlashCommand = {
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
    
    const req = await getCurrentlyPlayingTrack(user, config.LASTFM_KEY);
    interaction.reply({content: JSON.stringify(req)})
  },
};

export default command;
