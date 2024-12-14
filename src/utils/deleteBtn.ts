import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const delButton = (idPrefix: string) => new ButtonBuilder()
  .setCustomId(`${idPrefix}_delete`)
  .setLabel("Delete")
  .setEmoji("✖️")
  .setStyle(ButtonStyle.Danger);
export const delButtonRow = (idPrefix: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(delButton(idPrefix))
