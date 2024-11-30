import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { accessDeniedEmbed, checkAccess } from "../utils/accessCheck.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isButton()) return;

  const command = interaction.client.slashCommands.get(
    interaction.customId.split("_")[0],
  );
  if (!command || !command.button) return;

  if (
    !checkAccess(interaction.user.id, interaction.guildId, command.permissions)
  ) {
    interaction.reply({
      embeds: [accessDeniedEmbed],
      ephemeral: true,
    });
    return;
  }
  command.button(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
