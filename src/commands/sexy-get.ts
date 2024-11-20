import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";
import { AutocompleteInteraction } from "discord.js";
import { Colors } from "discord.js";
import importSexymfs from "../../sexy-mfs.json" with { type: "json" };

const sexymfs = importSexymfs as { [x: string]: { [x: string]: string } };

const button = new ButtonBuilder()
  .setStyle(ButtonStyle.Danger)
  .setLabel("Delete")
  .setCustomId("sexy-get_delete");
const row = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(button);

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("sexy-get")
    .setDescription("Grabs a sexy mother fucking picture from the server's fs.")
    .addStringOption((opt) =>
      opt
        .setName("nickname")
        .setDescription("The nickname of the sexy mf.")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addBooleanOption(opt => 
      opt
	.setName("public")
	.setDescription("This option makes the response visible to everyone, disabled by default.")
    ),
  execute: (interaction) => {
    const nickname = interaction.options.getString("nickname");
    if (!nickname || !sexymfs[nickname]) {
      interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription("That sexy motherfucker was not found :/")
            .setFooter({ text: "Brought to you by jsw's slaafje." }),
        ],
        ephemeral: true,
      });
      return;
    }

    const sexymf = sexymfs[nickname];
    interaction.reply({
      embeds: Object.keys(sexymf).map((v) => (new EmbedBuilder()
        .setImage(sexymf[v])
        .setTitle(v))
      ),
      components: [row],
      ephemeral: interaction.options.getBoolean("public") ?? true
    });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
  autocomplete: (interaction: AutocompleteInteraction) => {
    interaction.respond(
      Object.keys(sexymfs).map((v) => ({ name: v, value: v })),
    );
  },
};

export default command;
