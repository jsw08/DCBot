import { Colors } from "discord.js";
import { EmbedBuilder } from "discord.js";

type ColorKinds = "success" | "normal" | "warning" | "error";
const ColorKinds: { [x in ColorKinds]: number } = {
  success: Colors.Green,
  normal: Colors.Default,
  warning: Colors.Yellow,
  error: Colors.Red,
};

type EmbedParams = {
  title?: string;
  message?: string;
  kindOfEmbed?: ColorKinds;
};

export const embed = (parms: EmbedParams): EmbedBuilder => {
  const embed = new EmbedBuilder();

  embed.setFooter({
    text: "Working with all one's might for my master. Take a look at github:jsw08/DCBot!",
    iconURL:
      "https://cdn.discordapp.com/avatars/809362634947690527/f14201f0d5ee26fa0c73fd2f3828ee28.png",
  });
  parms.kindOfEmbed && embed.setColor(ColorKinds[parms.kindOfEmbed]);
  parms.title && embed.setTitle(parms.title);
  parms.message && embed.setDescription(parms.message);

  return embed;
};
