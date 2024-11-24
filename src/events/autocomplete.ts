import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { checkAccess } from "../utils/accessCheck.ts";

const execute = (interaction: Interaction) => {
  console.log(interaction)
  if (!interaction.isAutocomplete()) return;
  console.log(interaction.options.getString("nickname"));
  //if (!checkAccess(interaction.user.id)) {
  if (!checkAccess(interaction.user.id)) {
    interaction.respond([{
      name: "You don't have access. Please remove this bot from your account.",
      value: ""
    }])
    return;
  }

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command || !command.autocomplete) return;

  command.autocomplete(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
