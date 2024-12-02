import {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  ModalSubmitInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import {
  ButtonInteraction,
  Client,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import config from "config" with { type: "json" };
import { join } from "@std/path";
import { walk } from "@std/fs/walk";

export type Permissions = "everywhere" | "select_few" | "nowhere";
export interface SlashCommand {
  command:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => void;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
  button?: (interaction: ButtonInteraction<CacheType>) => void;
  inDm?: boolean;
  permissions?: Permissions;
}
declare module "discord.js" {
  export interface Client {
    slashCommands: Collection<string, SlashCommand>;
  }
}

const main = async (client: Client) => {
  const commandDir = join(import.meta.dirname!, "./commands/");

  for await (
    const commandFile of walk(commandDir, {
      includeDirs: false,
      includeSymlinks: false,
      exts: [".ts"],
    })
  ) {
    const command: SlashCommand = (await import(`file:///${commandFile.path}`))
      .default;

    client.slashCommands.set(command.command.name, command);
  }

  const rest = new REST({ version: "10" }).setToken(config.token);

  console.log("Loading slash commands...");
  try {
    const data = await rest.put(
      Routes.applicationCommands(config.client_id),
      {
        body: client.slashCommands.map((v) => {
          const commandBuilder = v.command.toJSON();
          //const inGuild = v.permissions !== "nowhere";

          commandBuilder.contexts = [
            //...(inGuild ? [0] : []),
            0,
            ...(v.inDm ?? true ? [1, 2] : []),
          ];

          return commandBuilder;
        }),
      },
    );
  } catch (e) {
    console.error(JSON.stringify(e));
  }

  console.log("Loaded slash commands");
};
export default main;
