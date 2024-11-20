import { EmbedBuilder, Interaction } from "discord.js";
import config from "../../config.json" with {type: "json"}
import { Colors } from "discord.js";

export const checkAccess = (id: string): boolean => {
    return !config.private.enabled || config.private.user_ids.includes(id)
}
export const accessDeniedEmbed = new EmbedBuilder()
    .setDescription("Access denied")
    .setColor(Colors.Red)
    .setFooter({text: "brought to you by jsw's slaafje"})
