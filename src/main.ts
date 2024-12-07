import { Client, Collection, GatewayIntentBits } from "discord.js";
import "jsr:@std/dotenv/load";
import commandLoader, { SlashCommand } from "$/commandLoader.ts";
import eventLoader from "$/eventLoader.ts";
import { config } from "$utils/config.ts";
import { checkOrCreateDir } from "$utils/dir.ts";

if (Object.values(config).some((v) => v === "")) {
  throw Error("Please configure your dotenv correctly.");
}
checkOrCreateDir(config.DATA_DIR);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});
client.slashCommands = new Collection<string, SlashCommand>();

commandLoader(client);
eventLoader(client);

client.login(config.DC_TOKEN);
