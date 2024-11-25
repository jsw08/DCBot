import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { checkAccess } from "../utils/accessCheck.ts";
import { ApplicationCommandOptionType } from "discord-api-types/v10";

const execute = (interaction: Interaction) => {
  if (!interaction.isAutocomplete()) return;

  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command || !command.autocomplete) return;

  if (!checkAccess(interaction.user.id, interaction.guildId, command.inGuild)) {
    if (
      interaction.options.getFocused(true).type ===
        ApplicationCommandOptionType.Integer
    ) {
      interaction.respond([{
        name:
          "You don't have access. (In this location.)",
        value: 0,
      }]);
    } else {
      interaction.respond([{
        name:
          "You don't have access. (In this location.)",
        value: "",
      }]);
    }
    return;
  }

  command.autocomplete(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
