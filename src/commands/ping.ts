import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../types.d.ts";

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Show's the bot's ping"),
	execute: (interaction) => {
		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setAuthor({ name: "jsw's slaafje" })
					.setDescription(
						`Pong! ${interaction.client.ws.ping}`,
					),
			],
		});
	},
	cooldown: 10,
};

export default command;
