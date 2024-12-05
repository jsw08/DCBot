import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { ChatInputCommandInteraction } from "discord.js";

const errorMessage = (
  interaction: ChatInputCommandInteraction,
  message: string,
): void => {
  interaction.reply({
    embeds: [embed({ title: "Error", message: message, kindOfEmbed: "error" })],
    ephemeral: true,
  });
  return;
};

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("time")
    .setDescription("Generate a discord-timestamp.")
    .addStringOption((opts) =>
      opts
        .setName("time")
        .setDescription(
          "Please enter a valid JavaScript date. The server is in CET, but JS date strings can use UTC times.",
        )
        .setRequired(true)
    )
    .addStringOption((opts) =>
      opts
        .setName("type")
        .setDescription(
          "What kind of discord date timestamp it should generate.",
        )
        .setRequired(true)
        .addChoices([
          { name: "short time", value: "t" },
          { name: "long time", value: "T" },
          { name: "short date", value: "d" },
          { name: "long date", value: "D" },
          { name: "long date with short time", value: "f" },
          { name: "long date with day of week and short time", value: "F" },
          { name: "relative", value: "R" },
        ])
    ),
  execute: (interaction) => {
    const timestamp = interaction.options.getString("time", true);
    const type = interaction.options.getString("type", true);
    const date = Date.parse(timestamp);

    if (isNaN(date)) {
      return errorMessage(interaction, "Your date string is invalid.");
    }

    const dcTimestamp = `<t:${Math.floor(date / 1000)}:${type}>`;
    const bt = "```"; // backticks
    interaction.reply({
      embeds: [embed({
        title: "Timestamp generator",
        message: `${bt}${dcTimestamp}${bt}\n${dcTimestamp}`,
      })],
      ephemeral: true,
    });
  },
};

export default command;
