import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { ChatInputCommandInteraction } from "discord.js";
import { parseDate } from "chrono-node";
import { chronoErrorReply } from "$utils/chrono.ts";

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
        .setName("date")
        .setDescription(
          "Reminder date (CET unless specified). Accepts ISO 8601 and English natural language formats.",
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
    const type = interaction.options.getString("type", true);
    const date = parseDate(interaction.options.getString("date", true));

    if (!date) {
      interaction.reply(chronoErrorReply);
      return;
    }

    const dcTimestamp = `<t:${Math.floor(date.getTime() / 1000)}:${type}>`;
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
