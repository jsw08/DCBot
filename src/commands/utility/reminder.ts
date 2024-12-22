import {
  ActionRowBuilder,
  ButtonBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import db from "$utils/db.ts";
import { config } from "$utils/config.ts";
import { client } from "$/main.ts";
import { ButtonStyle } from "discord.js";
import { parseDate } from "chrono-node";
import { chronoErrorReply } from "$utils/chrono.ts";
import { ComponentType } from "discord.js";
import { DiscordjsErrorCodes } from "discord.js";

db.sql`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    message text not null,
    date TEXT NOT NULL
  )
`;

type Reminder = {
  id: number;
  discord_id: string;
  message: string;
  date: string;
};

const btWrap = (v: string) => "```" + v + "```";
const dcTimestamp = (date: number, type: string) =>
  `<t:${Math.floor(date / 1000)}:${type}>`;

const sendReminders = () => {
  const reminders = db
    .sql`SELECT message, id, discord_id, date FROM reminders WHERE date < unixepoch('now')`;
  for (const i of reminders) {
    const reminder = i as Reminder;
    client.users.send(reminder.discord_id, {
      embeds: [embed({
        title: "Reminder",
        message: `You asked me to remember the following message at ${
          dcTimestamp(+reminder.date, "t")
        }.\n${btWrap(reminder.message)}`,
      })],
    });
    db.exec("DELETE FROM reminders WHERE id = :id", { id: reminder.id });
  }
};
sendReminders();
setInterval(sendReminders, parseInt(config.REMINDER_TIMEOUT));

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Sets a reminder.")
    .addStringOption((opts) =>
      opts
        .setName("message")
        .setDescription("Your reminder message.")
        .setRequired(true)
    )
    .addStringOption((opts) =>
      opts
        .setName("date")
        .setDescription(
          "Reminder date (CET unless specified). Accepts ISO 8601 and English natural language formats.",
        )
        .setRequired(true)
    ),
  execute: async (interaction) => {
    if (!Object.keys(interaction.authorizingIntegrationOwners).includes("1")) {
      interaction.reply({
        embeds: [embed({
          title: "Reminder - ERROR",
          message:
            `To receive direct messages from me, please install this bot in your account.`,
          kindOfEmbed: "error",
        })],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("Install")
              .setURL(
                `https://discord.com/oauth2/authorize?client_id=${config.DC_CLIENT_ID}`,
              )
              .setEmoji("1267495233990688828")
              .setStyle(ButtonStyle.Link),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const message = interaction.options.getString("message", true);
    const date = parseDate(interaction.options.getString("date", true));

    if (!date) {
      interaction.reply(chronoErrorReply);
      return;
    }

    const reply = await interaction.reply({
      embeds: [embed({
        title: "Reminder - confirmation",
        message: `Would you like to be reminded of the following message at ${
          dcTimestamp(date.getTime(), "f")
        }? You have two minutes to decide.\n-# tip: (ignore this message to cancel, you can still create a new reminder while this one is awaiting.)\n${
          btWrap(message)
        }`,

        kindOfEmbed: "normal",
      })],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Confirm!")
            .setEmoji("✔️")
            .setCustomId(`${command.command.name}_confirm`)
            .setStyle(ButtonStyle.Success),
        ),
      ],
      ephemeral: true,
    });

    try {
      await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 120_000
      });
      await reply.edit(
        {
          embeds: [embed({
            title: "Reminder - confirmation",
            message:
              `Your reminder has been successfully set! It will trigger in approximately ${
                dcTimestamp(date.getTime(), "R")
              }.`,
            kindOfEmbed: "success",
          })],
          components: [],
        },
      );

      db.exec(
	"INSERT INTO reminders (discord_id, date, message) VALUES (:discord_id, :date, :message)",
	{
	  discord_id: interaction.user.id,
	  date: date.getTime(),
	  message: message,
	},
      )
    } catch (e) {
      if ((e as {code?: DiscordjsErrorCodes}).code !== DiscordjsErrorCodes.InteractionCollectorError) { 
	throw e 
      }

      reply.edit({
        embeds: [embed({
          title: "Reminder - confirmation",
          message:
            "Your reminder has been canceled because it wasn't confirmed within the 2-minute timeframe.",
          kindOfEmbed: "error",
        })],
        components: [],
      });
    }
  },
};

export default command;
