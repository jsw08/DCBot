import {
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../../commandLoader.ts";
import { embed } from "../../utils/embed.ts";
import { Interaction } from "discord.js";
import { InteractionResponse } from "discord.js";
import { ChatInputCommandInteraction } from "discord.js";

const errorMessage = (interaction: ChatInputCommandInteraction, message: string): void => {
  interaction.reply({
    embeds: [embed({ title: "Error", message: message, kindOfEmbed: "error"})],
    ephemeral: true
  });
  return
}

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
    ),
  execute: (interaction) => {
    const timestamp = interaction.options.getString("timestamp")
    const type = interaction.options.getString("type")

    if (!timestamp || !type) return errorMessage(interaction, "Something's wrong with your parameters.")
    const date = Date.parse(timestamp);

    if (isNaN(date)) return errorMessage(interaction, "Your date string is invalid.")

    const dcTimestamp = `<t:${date}:${type}>`
    const bt = "```" // backticks
    interaction.reply({
      embeds: [embed({ 
	message: `${bt}${dcTimestamp}${bt}\n${dcTimestamp}`
      })],
    });
  },
};

export default command;
