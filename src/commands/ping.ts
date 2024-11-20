import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";

const button = new ButtonBuilder()
  .setStyle(ButtonStyle.Danger)
  .setLabel("Delete")
  .setCustomId("ping_delete");
const row = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(button);

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
      components: [row],
    });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
};

export default command;
