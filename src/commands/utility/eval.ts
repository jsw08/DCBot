import {
  ButtonInteraction,
  InteractionReplyOptions,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";

const codeReplyOptions = (
  input: string,
  output: string[],
): InteractionReplyOptions => ({
  embeds: [embed({
    title: "Evaluated code.",
    kindOfEmbed: "success",
    message: `
      # Input \n
      \`\`\`ts\n
      ${input} 
      \`\`\`\n
      # Ouput
      \`\`\`ts\n${
	output
	  .map((e) => `${Deno.inspect(e, { compact: false, depth: 2 })}`)
	  .join("\n")
      }\`\`\``,
  })],
});
const codeHandler = async (
  code?: string,
  ephemeral?: boolean,
): Promise<InteractionReplyOptions> => {
    const results: string[] = [];
    const ephemeralObject = ephemeral ? {ephemeral: true} : {}

    if (!code) {
      return {
        embeds: [embed({
          kindOfEmbed: "error",
          title: "Error!",
          message: "Please provide a code string.",
        })],
	...ephemeralObject
      };
    }

    try {
      if (code.includes("await")) {
        results.push(
          await eval(`(async () => {
	      ${code.replace("console.log", "results.push")}
	  })()`),
        );
      } else {
        results.push(await eval(code.replace("console.log", "results.push")));
      }

      return {
        ...(codeReplyOptions(code, results)),
	...ephemeralObject
      }
    } catch (e) {
      const err = e as Error;
      return {
        embeds: [embed({
          title: "Error!",
          message: `\`\`\`js\n${err.name}: ${err.message}\nLine: ${
            err.stack
              ? err.stack.match(/<anonymous>:\d:\d/)?.[0].match(/\d:\d/)?.[0]
              : ""
          }\`\`\``,
          kindOfEmbed: "error",
        })],
	...ephemeralObject
      };
    }
}

const command: SlashCommand = {
  inDm: true,
  permissions: "nowhere",

  command: new SlashCommandBuilder()
    .setName("ts")
    .setDescription("Runs the provided javascript code.")
    .addSubcommand(subc => subc
      .setName("inline")
      .setDescription("For your beautiful ts-oneliners.")
      .addStringOption((opts) =>
	opts
	  .setName("code")
	  .setDescription("Write your javascript code here.")
	  .setRequired(true)
      ),
    )
    .addSubcommand(subc => subc
      .setName("multiline")
      .setDescription("For your longer codepieces.")
    ) 
  ,
  execute: async (interaction) => {
    const code = interaction.options.getString("code");
    const results: string[] = [];

    if (!code) {
      interaction.reply({
        embeds: [embed({
          kindOfEmbed: "error",
          title: "Error!",
          message: "Please provide a code string.",
        })],
      });
      return;
    }

    try {
      if (code.includes("await")) {
        results.push(
          await eval(`(async () => {
	      ${code.replace("console.log", "results.push")}
	  })()`),
        );
      } else {
        results.push(eval(code.replace("console.log", "results.push")));
      }

      await interaction.reply({
        ...(codeReplyOptions(code, results)),
        ephemeral: true,
      });
    } catch (e) {
      const err = e as Error;
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message: `\`\`\`js\n${err.name}: ${err.message}\nLine: ${
            err.stack
              ? err.stack.match(/<anonymous>:\d:\d/)?.[0].match(/\d:\d/)?.[0]
              : ""
          }\`\`\``,
          kindOfEmbed: "error",
        })],
      });
    }
  },

  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
};

export default command;
