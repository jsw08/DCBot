import { Client, Collection } from "discord.js";
import "jsr:@std/dotenv/load";
import commandLoader, { SlashCommand } from "$/commandLoader.ts";
import eventLoader from "$/eventLoader.ts";
import { GatewayIntentBits } from "discord.js";
import { config } from "$utils/config.ts";

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
