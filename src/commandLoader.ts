import {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  ModalSubmitInteraction,
  REST,
  SlashCommandBuilder,
} from "discord.js";
import {API} from "@discordjs/core"
import { Client } from "discord.js";
import config from "../config.json" with { type: "json" };
import { join } from "@std/path";

export interface SlashCommand {
  command: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => void;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
}
declare module "discord.js" {
  export interface Client {
    slashCommands: Collection<string, SlashCommand>;
  }
}

const main = async (client: Client) => {
  console.log(import.meta.dirname!);
  const commandDir = join(import.meta.dirname!, "./commands/");
  const slashCommands: SlashCommandBuilder[] = [];

  for await (const commandFile of Deno.readDir(commandDir)) {
    if (!commandFile.isFile || !commandFile.name.endsWith(".ts")) continue;

    const command: SlashCommand = (await import(`./commands/${commandFile.name}`)).default;

    slashCommands.push(command.command);
    client.slashCommands.set(command.command.name, command);
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  const api = new API(rest)
  await api.applicationCommands.bulkOverwriteGlobalCommands(config.client_id, slashCommands.map(v => v.toJSON()))

  console.log("Loaded slash commands")
};

export default main;
