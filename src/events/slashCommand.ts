import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { accessDeniedEmbed, checkAccess } from "../utils/accessCheck.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command) return;

  if (!checkAccess(interaction.user.id, interaction.guildId, command.inGuild)) {
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
