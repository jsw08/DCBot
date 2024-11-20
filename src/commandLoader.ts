import {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  ModalSubmitInteraction,
  REST,
  SlashCommandBuilder,
} from "discord.js";
import { API } from "@discordjs/core";
import { Client } from "discord.js";
import config from "../config.json" with { type: "json" };
import { join } from "@std/path";
import { ButtonInteraction } from "discord.js";
import { SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface SlashCommand {
  command: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => void;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
  button?: (interaction: ButtonInteraction<CacheType>) => void;
  inDm?: boolean;
}
declare module "discord.js" {
  export interface Client {
    slashCommands: Collection<string, SlashCommand>;
  }
}

const main = async (client: Client) => {
  const commandDir = join(import.meta.dirname!, "./commands/");

  for await (const commandFile of Deno.readDir(commandDir)) {
    if (!commandFile.isFile || !commandFile.name.endsWith(".ts")) {
      continue;
    }

    const command: SlashCommand =
      (await import(`./commands/${commandFile.name}`))
        .default;

    client.slashCommands.set(command.command.name, command);
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  const api = new API(rest);
  await api.applicationCommands.bulkOverwriteGlobalCommands(
    config.client_id,
    client.slashCommands.map((v) => {
	const commandBuilder = v.command.toJSON();
	const inDm = v.inDm ?? true;

	commandBuilder["contexts"] = inDm ? [0,1,2] : [0,1];
	console.log(commandBuilder)

	return commandBuilder;
    }),
  );

  console.log("Loaded slash commands");
};
export default main;
