import { accessDeniedEmbed, checkAccess } from "$utils/accessCheck.ts";
import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isContextMenuCommand()) return;

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command) return;

  if (
    !checkAccess(interaction.user.id, interaction.guildId, command.permissions)
  ) {
    interaction.reply({
      embeds: [accessDeniedEmbed],
      ephemeral: true,
    });
    return;
  }

  command.execute(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
