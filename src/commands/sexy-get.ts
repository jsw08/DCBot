import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  InteractionResponse,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";
import { AutocompleteInteraction } from "discord.js";
import { embed } from "../utils/embed.ts";
import config from "../../config.json" with { type: "json" };
import { join } from "@std/path/join";
import { ChatInputCommandInteraction } from "discord.js";


const button = new ButtonBuilder()
  .setStyle(ButtonStyle.Danger)
  .setLabel("Delete")
  .setCustomId("sexy-get_delete");
const row = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(button);

const sexyMfWasntFoundEmbed = (
  interaction: ChatInputCommandInteraction,
): Promise<InteractionResponse> =>
  interaction.reply({
    embeds: [
      embed({ message: "That sexy mf wasn't found :/", kindOfEmbed: "error" }),
    ],
    ephemeral: true,
  });

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("sexy-get")
    .setDescription("Grabs a sexy mother fucking picture from the server's fs.")
    .addStringOption((opt) =>
      opt
        .setName("nickname")
        .setDescription("The nickname of the sexy mf.")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("public")
        .setDescription(
          "This option makes the response visible to everyone, disabled by default.",
        )
    ),
  execute: async (interaction) => {
    const nickname = interaction.options.getString("nickname");
    const revEphmeral = interaction.options.getBoolean("public");

    if (!nickname || nickname === "NOSEXY") {
      sexyMfWasntFoundEmbed(interaction);
      return;
    }

    const images: string[][] = [[]];
    try {
      const sexyImageFiles = Deno.readDir(
        join(import.meta.dirname!, "../../", config["sexy-mfs"].dir, nickname),
      );
      for await (const image of sexyImageFiles) {
	if (images[images.length - 1].length === 10) images.push([]);
	images[images.length - 1].push(image.name);
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        console.error(e);
        interaction.reply({
          embeds: [embed({
            message: "Something went wrong :/",
            kindOfEmbed: "error",
          })],
        });
        return;
      }

      sexyMfWasntFoundEmbed(interaction);
      return;
    }
    
    for (const imageSubset of images) { // #TODO: Add forward and backward buttons for next pages, as this won't work (unknown interaction).
      interaction.reply({
	embeds: imageSubset.map((v) =>
	  embed({ title: nickname.at(0)?.toUpperCase() + nickname.slice(1), kindOfEmbed: "success" })
	    .setImage(new URL(`/${nickname}/${v}`, config["sexy-mfs"].image_url).toString())
	    .setURL(config["sexy-mfs"].title_url)
	),
	components: [row],
	ephemeral: revEphmeral == null ? true : !revEphmeral,
      });
    }
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply();
  },
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const files = Deno.readDir(
      join(import.meta.dirname!, "../../", config["sexy-mfs"].dir),
    );
    const sexymfs: { name: string; value: string }[] = [];
    for await (const sexymf of files) sexymfs.push({ name: sexymf.name, value: sexymf.name });
    
    if (sexymfs.length === 0) {
      sexymfs.push({
        name: "There are currently no sexy motherfuckers available",
        value: "NOSEXY",
      });
    }

    interaction.respond(
      sexymfs,
    );
  },
};



export default command;

import { serveDir } from "@std/http/file-server";

Deno.serve((req) => {
  return serveDir(req, {
    fsRoot: `${config["sexy-mfs"].dir}`,
  });
});


