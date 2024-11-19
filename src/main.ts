import { Client, Collection } from "discord.js";
import config from "../config.json" with { type: "json" };
import commandLoader, { SlashCommand } from "./commandLoader.ts";
import eventLoader from "./eventLoader.ts";

const client = new Client({ intents: [] });
client.slashCommands = new Collection<string, SlashCommand>();

commandLoader(client);
eventLoader(client);

client.login(config.token);
