import { hashString } from "$utils/ascii.ts";
import { config } from "$utils/config.ts";
import { walk } from "@std/fs/walk";
import { join } from "@std/path";
import {
  AutocompleteInteraction,
  ButtonInteraction,
  CacheType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export type Permissions = "everywhere" | "select_few" | "nowhere";
interface BaseCommand {
  modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
  button?: (interaction: ButtonInteraction<CacheType>) => void;
  inDm?: boolean;
  inGuild?: boolean;
  permissions?: Permissions;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
}
export interface SlashCommand extends BaseCommand {
  command:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;

  execute: (interaction: ChatInputCommandInteraction) => void;
}
export interface ContextMenu extends BaseCommand {
  command: ContextMenuCommandBuilder;
  execute: (
    interaction: MessageContextMenuCommandInteraction,
    // | ContextMenuCommandInteraction
    // | MessageContextMenuCommandInteraction
    // | UserContextMenuCommandInteraction,
  ) => void;
}
declare module "discord.js" {
  export interface Client {
    slashCommands: Collection<string, SlashCommand | ContextMenu>;
  }
}

const main = async (client: Client) => {
  const commandDir = join(import.meta.dirname!, "./commands/");

  console.log("Loading slash commands...");
  for await (const commandFile of walk(commandDir, {
    includeDirs: false,
    includeSymlinks: false,
    exts: [".ts"],
  })) {
    const command: SlashCommand = (await import(`file:///${commandFile.path}`))
      .default;

    client.slashCommands.set(command.command.name, command);
  }
  console.log("Loaded slash commands.");

  const commandsBody = client.slashCommands.map((v) => {
    const commandBuilder = v.command.toJSON();
    commandBuilder.contexts = [
      ...((v.inGuild ?? true) ? [0] : []),
      ...((v.inDm ?? true) ? [1, 2] : []),
    ];

    return commandBuilder;
  });
  const hashedCommands = await hashString(JSON.stringify(commandsBody));
  const commandHashFile = join(config.DATA_DIR, "commands.txt");
  let updateCommands = false;

  try {
    const previousHashedCommands = await Deno.readFile(commandHashFile);
    updateCommands =
      new TextDecoder().decode(previousHashedCommands) !== hashedCommands;
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
    updateCommands = true;
  }
  console.log(
    updateCommands
      ? "Commands have to be updated."
      : "Commands don't need to be updated.",
  );

  if (updateCommands) {
    await Deno.writeFile(
      commandHashFile,
      new TextEncoder().encode(hashedCommands),
    );
    const rest = new REST({ version: "10" }).setToken(config.DC_TOKEN);

    rest
      .put(Routes.applicationCommands(config.DC_CLIENT_ID), {
        body: client.slashCommands.map((v) => {
          const commandBuilder = v.command.toJSON();
          commandBuilder.contexts = [
            ...((v.inGuild ?? true) ? [0] : []),
            ...((v.inDm ?? true) ? [1, 2] : []),
          ];

          return commandBuilder;
        }),
      })
      .then((_) => console.log("Updated slash commands."))
      .catch((e) => console.error(JSON.stringify(e)));
  }
};
export default main;
