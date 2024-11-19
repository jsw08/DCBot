import {
	AutocompleteInteraction,
	CacheType,
	ChatInputCommandInteraction,
	Collection,
	ModalSubmitInteraction,
	SlashCommandBuilder,
} from "discord.js";

export interface SlashCommand {
	command: SlashCommandBuilder;
	execute: (interaction: ChatInputCommandInteraction) => void;
	autocomplete?: (interaction: AutocompleteInteraction) => void;
	modal?: (interaction: ModalSubmitInteraction<CacheType>) => void;
	cooldown?: number; // in seconds
}

declare module "discord.js" {
	export interface Client {
		slashCommands: Collection<string, SlashCommand>;
		cooldowns: Collection<string, number>;
	}
}
