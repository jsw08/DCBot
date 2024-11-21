import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";
import { embed } from "../utils/embed.ts";

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
      embeds: [embed({message: "Pong!"})],
      components: [row],
    });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
};

export default command;
