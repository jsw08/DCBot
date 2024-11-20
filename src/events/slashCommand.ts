import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { checkAccess, accessDeniedEmbed } from "../utils/accessCheck.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!checkAccess(interaction.user.id)) {
    interaction.reply({
	embeds: [accessDeniedEmbed],
	ephemeral: true
    })
    return
  }

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command) return;

  command.execute(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
