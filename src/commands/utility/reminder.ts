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
import {parseDate} from "chrono-node"

db.sql`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    message text not null,
    date TEXT NOT NULL,
    send_date TEXT NOT NULL,
    confirmed INTEGER NOT NULL
  )
`;
type Reminder = {
  id: number;
  discord_id: string;
  message: string;
  date: string;
  send_date: string;
  confirmed: number;
};

const btWrap = (v: string) => "```" + v + "```";
const dcTimestamp = (date: number, type: string) => `<t:${Math.floor(date/1000)}:${type}>`

const sendReminders = () => {
  const reminders = db
    .sql`SELECT message, id, discord_id, date FROM reminders WHERE confirmed = 1 AND date < unixepoch('now')`;
  for (const i of reminders) {
    const reminder = i as Reminder;
    client.users.send(reminder.discord_id, {
      embeds: [embed({
        title: "Reminder",
        message: `You asked me to remember\n${btWrap(reminder.message)} at ${dcTimestamp(+reminder.date, "t")}`,
      })],
    });
    db.exec("DELETE FROM reminders WHERE id = :id", { id: reminder.id });
  }
  db.sql`DELETE FROM reminders WHERE confirmed = 0 AND send_date < unixepoch('now', '-2 minutes');`;
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
        .setDescription("Reminder date (CET unless specified). Accepts ISO 8601 and English natural language formats.")
        .setRequired(true)
    ),
  execute: async (interaction) => {
    if (!Object.keys(interaction.authorizingIntegrationOwners).includes("1")) {
      interaction.reply({
        embeds: [embed({
          title: "Reminder ERROR",
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
    const date = parseDate(interaction.options.getString("date", true))

    if (!date) {
      interaction.reply({
        embeds: [embed({
          title: "Reminder ERROR",
          message:
            `Chrono couldn't interpret this string. Please refer to the supported formats on their GitHub page.`,
          kindOfEmbed: "error",
        })],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("Chrono")
              .setURL(
                `https://github.com/wanasit/chrono`,
              )
              .setEmoji("🕙")
              .setStyle(ButtonStyle.Link),
          ),
        ],
        ephemeral: true,
      });
      return
    }

    const { id } = db.prepare(
      "INSERT INTO reminders (discord_id, date, message, send_date, confirmed) VALUES (:discord_id, :date, :message, :send_date, :confirmed) RETURNING id",
    ).get<{ id: string }>(
      {
        discord_id: interaction.user.id,
        date: date.getTime(),
        message: message,
        send_date: Date.now() + 2000,
        confirmed: false,
      },
    )!;

    const confirm = new ButtonBuilder()
      .setLabel("Confirm!")
      .setEmoji("✔️")
      .setCustomId(`${command.command.name}_confirm_${id}`)
      .setStyle(ButtonStyle.Success);
    const cancel = new ButtonBuilder()
      .setLabel("Cancel")
      .setEmoji("✖️")
      .setCustomId(`${command.command.name}_cancel_${id}`)
      .setStyle(ButtonStyle.Danger);
    await interaction.reply({
      embeds: [embed({
        title: "Reminder confirmation",
        message:
          `Would you like to be reminded of the following message at ${dcTimestamp(date.getTime(), "t")}? You have two minutes to decide.\n${btWrap(message)}`,

        kindOfEmbed: "normal",
      })],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel),
      ],
      ephemeral: true,
    });
  },

  button: (interaction) => {
    const bid = interaction.customId;
    const command = bid.split("_")[1];
    const did = bid.split("_")[2];

    const dbError = () =>
      interaction.update({
        embeds: [embed({
          title: "Reminder ERROR",
          message: "There was an issue updating your reminder in the database. Please try creating a new one.",
          kindOfEmbed: "error",
        })],
        components: [],
      });

    if (command === "confirm") {
      const changes = db.exec(
        "UPDATE reminders SET confirmed = 1 WHERE id = :id",
        { id: did },
      );
      const date = db.prepare("SELECT date FROM reminders WHERE id = :id").get<
        { date: string }
      >({ id: did });
      if (changes !== 1 || !date) {
        dbError();
        return;
      }

      interaction.update({
        embeds: [embed({
          title: "Reminder confirmed",
          message: `Your reminder has been successfully set! It will trigger in approximately <t:${
            Math.floor(+date.date / 1000)
          }:R>.`,
          kindOfEmbed: "success",
        })],
        components: [],
      });
    } else if (command === "cancel") {
      const changes = db.exec("DELETE FROM reminders WHERE id = :id", {
        id: did,
      });
      if (changes !== 1) {
        dbError();
        return;
      }

      interaction.update({
        embeds: [embed({
          title: "Reminder canceled",
          message: `The reminder has been successfully removed from the database!`,
          kindOfEmbed: "success",
        })],
        components: [],
      });
    }
  },
};

export default command;
