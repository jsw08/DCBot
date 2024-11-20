import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, ModalSubmitInteraction, SlashCommandBuilder, REST, Routes } from "discord.js";
import { join } from "@std/path/join";
import { Client } from "discord.js";
import config from "../config.json" with {type: "json"};

export interface SlashCommand {
  command: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => void;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
}

const main = async (client: Client) => {
  const commandDir = join(import.meta.dirname!, "/commands");
  const slashCommands: SlashCommandBuilder[] = [];
  for await (const commandFile of Deno.readDir(commandDir)) {
    if (!commandFile.isFile || !commandFile.name.endsWith(".ts")) continue;
    const command: SlashCommand = (await import(join(commandDir, `/${commandFile.name}`))).default

    slashCommands.push(command.command)
    client.slashCommands.set(command.command.name, command)
  }


  const rest = new REST({ version: "10" }).setToken(config.token);
  rest.put(Routes.applicationCommands(config.client_id), {
    body: slashCommands.map((command) => command.toJSON()),
  })
    .then((data: any) => { 
      console.log(`Loaded ${data.length} slash commands.`);
    }).catch((e: any) => {
      console.log(e);
    });
}

export default main
