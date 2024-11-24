import { Interaction } from "discord.js";
import { BotEvent } from "../eventLoader.ts";
import { checkAccess} from "../utils/accessCheck.ts";

const execute = (interaction: Interaction) => {
  if (!interaction.isAutocomplete()) return;
  
  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command || !command.autocomplete) return;

  if (!checkAccess(interaction.user.id, interaction.guildId, command.inGuild)) {
    interaction.respond([{
      name: "You don't have access. Please remove this bot from your account.",
      value: ""
    }])
    interaction.options.getFocused(true).type === AutocompleteFocusedOp.ion.type
    return;
  }

  command.autocomplete(interaction);
};

const event: BotEvent = {
  name: "interactionCreate",
  execute,
};
export default event;
