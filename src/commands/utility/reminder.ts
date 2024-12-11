import { ActionRowBuilder, ButtonBuilder, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import db from "$utils/db.ts";
import { config } from "$utils/config.ts";
import { client } from "$/main.ts";
import { ButtonStyle } from "discord.js";

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
  id: number,
  discord_id: string;
  message: string;
  date: string;
  send_date: string;
  confirmed: number;
}

const sendReminders = () => {
  const reminders = db.sql`SELECT message, id, discord_id, date FROM reminders WHERE confirmed = 1 AND date < unixepoch('now')`.forEach(i => {
    const reminder = i as Reminder;
    client.users.send(reminder.discord_id, {
      embeds: [embed({
        title: "Reminding something for you :)",
        message: `You told me to remember '${reminder.message}'!`,
      })],
    });
    db.exec("DELETE FROM reminders WHERE id = :id", { id: reminder.id });
  })
  const q = db.sql`DELETE FROM reminders WHERE confirmed = 0 AND send_date < unixepoch('now', '-2 seconds');`
  !q.length || console.log(q)
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
        .setDescription("The message you're sending yourself.")
        .setRequired(true)
    ),
  execute: async (interaction) => {
    if (!Object.keys(interaction.authorizingIntegrationOwners).includes("1")) {
      interaction.reply({
	embeds: [embed({
	  title: "Reminder ERROR",
	  message: `Please install this bot into your account. Else I won't be able to send a DM to you.`,
	  kindOfEmbed: "error",
	})],
	components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
	  .setLabel("Install")
	  .setURL(`https://discord.com/oauth2/authorize?client_id=${config.DC_CLIENT_ID}`)
	  .setEmoji("1267495233990688828")
	  .setStyle(ButtonStyle.Link)
	)]	
      })
      return
    }

    const message = interaction.options.getString("message", true);
    db.exec(
      "INSERT INTO reminders (discord_id, date, message, send_date, confirmed) VALUES (:discord_id, :date, :message, :send_date, :confirmed)",
      {
	discord_id: interaction.user.id,
	date: new Date(),
	message: message,
	send_date: Date.now(),
	confirmed: true
      },
    );
  },
};

export default command;
