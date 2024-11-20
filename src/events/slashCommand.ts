import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  //priv.enabled && priv.user_id !== interaction.user.id)

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command) return;

  command.execute(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
