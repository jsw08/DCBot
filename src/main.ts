import { join } from "@std/path/join";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import config from "../config.json" with { type: "json" };
import setupCommands, { SlashCommand } from "./commands.ts"

declare module "discord.js" {
  export interface Client {
    slashCommands: Collection<string, SlashCommand>;
  }
}


const client = new Client({ intents: [] });

client.slashCommands = new Collection<string, SlashCommand>();
setupCommands(client)


client.login(config.token);

