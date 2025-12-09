import { BotEvent } from "$/eventLoader.ts";

const event: BotEvent = {
  name: "ready",
  once: true,
  execute: (client) => {
    console.log("Client's ready.");
  },
};

export default event;
