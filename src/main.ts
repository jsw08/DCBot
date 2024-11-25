import { Client, Collection } from "discord.js";
import config from "../config.json" with { type: "json" };
import commandLoader, { SlashCommand } from "./commandLoader.ts";
import eventLoader from "./eventLoader.ts";
import { GatewayIntentBits } from "discord.js";

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

client.login(config.token);
