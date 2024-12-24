import "jsr:@std/dotenv/load";

const configKeys = [
  "DATA_DIR",
  "DC_TOKEN",
  "DC_CLIENT_ID",
  "PRIVATE",
  "PRIVATE_USERS",
  "PRIVATE_GUILDS",
  "SEXY_PORT",
  "SEXY_URL",
  "SEXY_TITLE_URL",
  "SEXY_LOG_CHANNELS",
  "SEXY_LOG_ROLE",
  "LASTFM_KEY",
  "REMINDER_TIMEOUT",
  "CLASHOFCODE_KEY",
] as const;
type ConfigKeys = typeof configKeys[number];

export const config: Record<ConfigKeys, string> = Object
  .fromEntries(
    configKeys.map((key) => {
      const env = Deno.env.get(key)
      if (!env) throw new Error(`Please configure your dotenv correctly. Missing: ${key}`);

      return [key, env]
    }),
  ) as Record<ConfigKeys, string>;
