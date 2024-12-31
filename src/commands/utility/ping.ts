import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { ButtonStyle } from "discord.js";
import { embed } from "$utils/embed.ts";

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show's the bot's ping"),
  execute: (interaction) => {
    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel("Delete")
      .setCustomId(`ping_${interaction.user.id}_delete`);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    interaction.reply({
      embeds: [embed({ message: "Pong!" })],
      components: [row],
    });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
};

export default command;
