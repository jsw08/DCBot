// Require the necessary discord.js classes
import { join } from "@std/path/join";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import config from "../config.json" with { type: "json" };
import { SlashCommand } from "./types.d.ts";

const client = new Client({ intents: [] });

client.slashCommands = new Collection<string, SlashCommand>();
const handlersDir = join(import.meta.dirname!, "./handlers");
for (const i of Deno.readDirSync(handlersDir)) {
	if (!i.isFile || !i.name.endsWith(".ts")) break;
	const module: { default: (client: Client) => void } = await import(
		`file:///${handlersDir}/${i.name}`
	);
	module.default(client);
}

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});
client.login(config.token);
