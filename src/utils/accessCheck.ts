import { type Permissions } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { config } from "$utils/config.ts";

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
  if (
    config.PRIVATE !== "1" ||
    config.PRIVATE_USERS.split(",").includes(userId)
  ) {
    return true;
  }
  if (commandScope === "nowhere") return false;

  return commandScope
    ? commandScope === "everywhere" ||
        (commandScope === "select_few" &&
          config.PRIVATE_GUILDS.split(",").includes(guildId ?? ""))
    : false;
}

export const accessDeniedEmbed = embed({
  message: "Access denied",
  kindOfEmbed: "error",
});
