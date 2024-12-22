import { Client, Collection, GatewayIntentBits } from "discord.js";
import commandLoader, { SlashCommand } from "$/commandLoader.ts";
import eventLoader from "$/eventLoader.ts";
import { config } from "$utils/config.ts";
import { checkOrCreateDir } from "$utils/dir.ts";

checkOrCreateDir(config.DATA_DIR);

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});
client.slashCommands = new Collection<string, SlashCommand>();

eventLoader(client);
commandLoader(client);

client.login(config.DC_TOKEN);
