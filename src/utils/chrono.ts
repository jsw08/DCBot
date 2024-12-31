import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionReplyOptions,
} from "discord.js";
import { embed } from "$utils/embed.ts";

export const chronoErrorReply: InteractionReplyOptions = {
  embeds: [
    embed({
      title: "Reminder ERROR",
      message: `
      Chrono couldn't interpret this string. Please refer to the supported formats on their GitHub page, or take a look at these examples:
      - Today, Tomorrow, Yesterday, Last Friday, etc \n- in 1s(econd) \n- tomorrow 12:30 \n- 20:00 EST
    `,
      kindOfEmbed: "error",
    }),
  ],
  components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Chrono")
        .setURL(`https://github.com/wanasit/chrono`)
        .setEmoji("🕙")
        .setStyle(ButtonStyle.Link),
    ),
  ],
  ephemeral: true,
};
