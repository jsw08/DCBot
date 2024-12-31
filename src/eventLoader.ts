import { Client } from "discord.js";
import { join } from "@std/path/join";

export interface BotEvent {
  name: string;
  once?: boolean | false;
  execute: (...args: any[]) => void;
}

const main = async (client: Client) => {
  const eventsDir = join(import.meta.dirname!, "/events");

  for await (const file of Deno.readDir(eventsDir)) {
    if (!file.isFile || !file.name.endsWith(".ts")) return;

    const event: BotEvent = (await import(`./events/${file.name}`)).default;
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
  console.log("Loaded all events.");
};

export default main;

// vim: ts=2 sts=2 sw=2
