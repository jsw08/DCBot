import { Client, REST, Routes, SlashCommandBuilder } from "discord.js";
import { join } from "@std/path/join";
import { SlashCommand } from "../types.d.ts";
import config from "../../config.json" with { type: "json" };

const main = async (client: Client) => {
	const slashCommands: SlashCommandBuilder[] = [];

	const slashCommandsDir = join(import.meta.dirname!, "../commands");

	for await (const i of Deno.readDir(slashCommandsDir)) {
		if (!i.isFile || !i.name.endsWith(".ts")) return;
		const commandModule: {default: SlashCommand} = await import(
			`file:///${slashCommandsDir}/${i.name}`
		);
		const command = commandModule.default;
		console.log(command)

		slashCommands.push(command.command);
		client.slashCommands.set(command.command.name, command);
	}

	const rest = new REST({ version: "10" }).setToken(config.token);

	rest.put(Routes.applicationCommands(config.client_id), {
		body: slashCommands.map((command) => command.toJSON()),
	})
		.then((data: any) => {
			console.log(
				"text",
				`🔥 Successfully loaded ${data.length} slash command(s)`,
			);
			console.log(data);
		}).catch((e) => {
			console.log(e);
		});
};

export default main;
