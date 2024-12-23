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
  "LASTFM_KEY",
  "REMINDER_TIMEOUT",
  "CLASHOFCODE_KEY",
] as const;
type ConfigKeys = typeof configKeys[number];

export const config: Record<ConfigKeys, string | undefined> = Object
  .fromEntries(
    configKeys.map((key) => [key, Deno.env.get(key)]),
  ) as Record<ConfigKeys, string | undefined>;

const missingKey = configKeys.find((key) => config[key] === undefined);
if (missingKey) {
  throw new Error(
    `Please configure your dotenv correctly. Missing: ${missingKey}`,
  );
}
