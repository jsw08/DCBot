import config from "../../config.json" with { type: "json" };
import { type inGuild } from "../commandLoader.ts";
import { embed } from "./embed.ts";

export function checkAccess(userId: string): boolean;
export function checkAccess(
  userId: string,
  guildId?: string | null,
  commandScope?: inGuild | null,
): boolean;
export function checkAccess(
  userId: string,
  guildId?: string | null,
  commandScope?: inGuild | null,
): boolean {
  if (!config.private.enabled) return true;
  if (guildId && commandScope) {
    return commandScope === "everywhere" ||
      (commandScope === "select_few" &&
        config.private.guild_ids.includes(guildId));
  }

  return config.private.user_ids.includes(userId);
}

export const accessDeniedEmbed = embed({
  message: "Access denied",
  kindOfEmbed: "error",
});
