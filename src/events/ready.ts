import { Client } from "discord.js";
import { BotEvent } from "../eventLoader.ts";

const execute = (client: Client) => {
  console.log("Ready up fuckers!");
};

const event: BotEvent = {
  name: "ready",
  once: true,
  execute,
};
export default event;
