import { Client, Collection } from "discord.js";
import "jsr:@std/dotenv/load";
import commandLoader, { SlashCommand } from "$/commandLoader.ts";
import eventLoader from "$/eventLoader.ts";
import { GatewayIntentBits } from "discord.js";

if (!Deno.env.get("DC_TOKEN") || !Deno.env.get("DC_CLIENT_ID") || !Deno.env.get("DATA_DIR")) {
  throw Error("Please provide at least DC_TOKEN, DC_CLIENT_ID and DATA_DIR")
}

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

client.login(Deno.env.get("DC_TOKEN"));
