import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  InteractionReplyOptions,
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

const paginatorRow = (nickname: string, currentPage: number, maxPages: number) => {
  const arrowButton = (direction: "l" | "r"): ButtonBuilder => {
    return new ButtonBuilder()
      .setCustomId(
        `${command.command.name}_toPage_${nickname}_` + (direction === "l"
          ? `${currentPage - 1}`
          : `${currentPage + 1}`)
      )
      .setStyle(ButtonStyle.Primary)
      .setLabel(direction === "l" ? "⬅️" : "➡️")
      .setDisabled(
        direction === "l" && currentPage === 0 ||
          direction === "r" && currentPage === maxPages,
      );
  };
  const counterButton = new ButtonBuilder()
    .setDisabled(true)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(`${currentPage}/${maxPages}`)
    .setCustomId(`${command.command.name}_toPage_${nickname}_${currentPage}`)
  
  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    arrowButton("l"),
    counterButton,
    arrowButton("r"),
  );
};

const sexyMfWasntFoundEmbed = (
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<InteractionResponse> =>
  interaction.reply({
    embeds: [
      embed({ message: "That sexy mf wasn't found :/", kindOfEmbed: "error" }),
    ],
    ephemeral: true,
  });

const getSexyImages = async (
  nickname: string,
): Promise<string[][] | undefined> => {
  const images: string[][] = [[]];

  try {
    const sexyImageFiles = Deno.readDir(
      join(import.meta.dirname!, "../../", config["sexy-mfs"].dir, nickname),
    );
    for await (const image of sexyImageFiles) {
      if (images[images.length - 1].length === 4) images.push([]);
      images[images.length - 1].push(image.name);
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      console.error(e);
      return;
    }

    console.error("Sexy mf wasn't found: ", nickname);
    return;
  }

  return images;
};

const imagesPageProps = (images: string[][], nickname: string, currentPage: number): BaseMessageOptions => {
  return {
    embeds: images[currentPage].map((v) =>
      embed({
	title: nickname.at(0)?.toUpperCase() + nickname.slice(1),
	kindOfEmbed: "success",
      })
	.setImage(
	  new URL(`/${nickname}/${v}`, config["sexy-mfs"].image_url)
	    .toString(),
	)
	.setURL(config["sexy-mfs"].title_url)
	.setAuthor({name: "Images might take some time to load in."})
    ),
    components: [paginatorRow(nickname, currentPage, images.length -1)],
  }
}

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

    const images: string[][] | undefined = await getSexyImages(nickname);
    if (!images) {
      sexyMfWasntFoundEmbed(interaction);
      return;
    }

    interaction.reply({
      ...imagesPageProps(images, nickname, 0),
      ephemeral: revEphmeral == null ? true : !revEphmeral,
    });
  },
  button: async (interaction: ButtonInteraction) => {
    const id = interaction.customId;
    const command = id.split("_")[1]; 

    if (command.includes("toPage")) {
      const nickname = id.split("_")[2]
      const page = id.split("_")[3]
      
      const images: string[][] | undefined = await getSexyImages(nickname)
      if (!images) {
	await sexyMfWasntFoundEmbed(interaction)
	return
      }

      await interaction.update({
	...imagesPageProps(images, nickname, parseInt(page))
      })   
    }
  },
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const files = Deno.readDir(
      join(import.meta.dirname!, "../../", config["sexy-mfs"].dir),
    );
    const sexymfs: { name: string; value: string }[] = [];
    for await (const sexymf of files) {
      sexymfs.push({ name: sexymf.name, value: sexymf.name });
    }

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
import { Interaction } from "discord.js";
import { BaseMessageOptions } from "discord.js";

Deno.serve({ port: config["sexy-mfs"].port }, (req) => {
  return serveDir(req, {
    fsRoot: `${config["sexy-mfs"].dir}`,
  });
});
