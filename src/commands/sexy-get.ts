import { ActionRowBuilder, EmbedBuilder, ButtonBuilder, SlashCommandBuilder, ButtonInteraction } from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";

const button = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setLabel("Delete")
    .setCustomId("ping_delete")
const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(button)

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("sexy-get")
    .setDescription("Grabs a sexy mother fucking picture from the server's fs.")
    .addStringOption(opt =>
      opt
	.setName("nickname") 
	.setDescription("The nickname of the sexy mf.")
	.setAutocomplete(true)
  )
  ,
  execute: (interaction) => {
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: "jsw's slaafje" })
          .setDescription(
            `Pong! ${interaction.client.ws.ping}`,
          ),
      ],
      components: [row]
    });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply()
  }
};

export default command;
