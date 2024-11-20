import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isButton()) return;

  const command = interaction.client.slashCommands.get(interaction.customId.split("_")[0]);
  if (!command || !command.button) return;

  interaction.deferUpdate();
  command.button(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
