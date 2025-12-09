import { chronoErrorReply } from "$utils/chrono.ts";
import { embed } from "$utils/embed.ts";
import { parseDate } from "chrono-node";
import {
  codeBlock,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  TimestampStylesString,
} from "discord.js";
import { SlashCommand } from "../../commandLoader.ts";

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
        .addChoices(
          Object.entries(TimestampStyles).map((v) => ({
            name: v[0],
            value: v[1],
          })),
        )
    ),
  execute: (interaction) => {
    const type = interaction.options.getString("type", true);
    const date = parseDate(interaction.options.getString("date", true));

    if (!date) {
      interaction.reply(chronoErrorReply);
      return;
    }

    const dcTimestamp = time(new Date(date), type as TimestampStylesString);
    interaction.reply({
      embeds: [embed({
        title: "Timestamp generator",
        message: `${codeBlock(dcTimestamp)}\n${dcTimestamp}`,
      })],
      ephemeral: true,
    });
  },
};

export default command;
