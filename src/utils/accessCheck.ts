import config from "../../config.json" with { type: "json" };
import { type Permissions } from "../commandLoader.ts";
import { embed } from "./embed.ts";

export function checkAccess(userId: string): boolean;
export function checkAccess(
  userId: string,
  guildId?: string | null,
  commandScope?: Permissions | null,
): boolean;
export function checkAccess(
  userId: string,
  guildId?: string | null,
  commandScope?: Permissions | null,
): boolean {
  if (!config.private.enabled) return true;
  if (config.private.user_ids.includes(userId)) return true;
  if (guildId && commandScope) {
    return commandScope === "everywhere" ||
      (commandScope === "select_few" &&
        config.private.guild_ids.includes(guildId));
  }

  return false;
}

export const accessDeniedEmbed = embed({
  message: "Access denied",
  kindOfEmbed: "error",
});
