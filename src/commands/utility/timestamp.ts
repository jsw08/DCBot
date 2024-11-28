import {
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../../commandLoader.ts";
import { embed } from "../../utils/embed.ts";

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("timestamp")
    .setDescription("Generate a discord-timestamp.")
    .addStringOption((opts) => opts
      .setName("time")
      .setDescription("Please enter a valid javascript date input here.")
      .setRequired(true)
    )  
    .addStringOption(opts => opts
      .setName("type")
      .setDescription("What kind of discord date timestamp it should generate.")
      .setRequired(true)
      .addChoices([
        {name: "short time", value: "t"},
        {name: "long time", value: "T"},
        {name: "short date", value: "d"},
        {name: "long date", value: "D"},
        {name: "long date with short name", value: "f"},
        {name: "long date with day of week and short time", value: "F"},
        {name: "relative", value: "R"},
      ])
    )
    ,
  execute: (interaction) => {

    interaction.reply({
      embeds: [embed({ message: "Pong!" })],
    });
  },
};

export default command;
