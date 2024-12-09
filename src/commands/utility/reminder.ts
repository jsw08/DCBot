import {
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import db from "$utils/db.ts";
import { config } from "$utils/config.ts";
import { client } from "$/main.ts";

db.sql`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    date TEXT NOT NULL,
    message TEXT NOT NULL
  )
`;

const sendReminders = () => {
  const reminders = db.sql`SELECT * FROM reminders` 
  for (const i of reminders) {
    const reminder = i as {
      id: number,
      discord_id: string,
      date: string,
      message: string
    } 
    client.users.send(reminder.discord_id, {
      embeds: [ embed({
	title: "Reminding something for you :)",
	message: `You told me to remember '${reminder.message}'!`,
      })]
    })
    db.exec("DELETE FROM reminders WHERE id = :id", { id: reminder.id });
  }
}
sendReminders()
setInterval(sendReminders, parseInt(config.REMINDER_TIMEOUT))

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Sets a reminder.")
    .addStringOption(opts => opts
      .setName("message")
      .setDescription("The message you're sending yourself.")
      .setRequired(true)
    )
  ,
  execute: (interaction) => {
    db.exec("INSERT INTO reminders (discord_id, date, message) VALUES (:discord_id, :date, :message)", { discord_id: interaction.user.id, date: "", message: interaction.options.getString("message", true)});
  },
};

export default command;
