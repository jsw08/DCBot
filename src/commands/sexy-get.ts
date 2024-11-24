import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  InteractionResponse,
  SlashCommandBuilder,
} from "discord.js";
import config from "../../config.json" with { type: "json" };
import { AutocompleteInteraction } from "discord.js";
import { BaseMessageOptions } from "discord.js";
import { ButtonStyle } from "discord.js";
import { ChatInputCommandInteraction } from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { embed } from "../utils/embed.ts";
import { join } from "@std/path/join";
import { serveDir } from "@std/http/file-server";

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
const paginatorRow = (
  nickname: string,
  userId: string,
  currentPage: number,
  maxPages: number,
) => {
  const arrowButton = (direction: "l" | "r"): ButtonBuilder => {
    return new ButtonBuilder()
      .setCustomId(
        `${command.command.name}_${userId}_toPage_${nickname}_` +
          (direction === "l" ? `${currentPage - 1}` : `${currentPage + 1}`),
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
    .setLabel(`${currentPage + 1}/${maxPages + 1}`)
    .setCustomId(`${command.command.name}_${userId}_toPage_${nickname}_${currentPage}`);

  return new ActionRowBuilder<ButtonBuilder>().setComponents(
    arrowButton("l"),
    counterButton,
    arrowButton("r"),
  );
};
const imagesPageProps = (
  images: string[][],
  nickname: string,
  userId: string,
  currentPage: number,
): BaseMessageOptions => {
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
        .setAuthor({ name: "Images might take some time to load in." })
    ),
    components: [
      paginatorRow(nickname, userId, currentPage, images.length - 1),
    ],
  };
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

const command: SlashCommand = {
  inGuild: "select_few",
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
    .addIntegerOption(opt =>
      opt
	.setName("page")
	.setDescription("The page that will be opened.")
	.setAutocomplete(true)
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
    const page = interaction.options.getInteger("page");
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
      ...imagesPageProps(images, nickname, interaction.user.id, page ?? 0),
      ephemeral: revEphmeral == null ? true : !revEphmeral,
    });
  },
  button: async (interaction: ButtonInteraction) => {
    const id = interaction.customId;
    const command = id.split("_")[2];

    if (command.includes("toPage")) {
      const nickname = id.split("_")[3];
      const page = id.split("_")[4];

      const images: string[][] | undefined = await getSexyImages(nickname);
      if (!images) {
        await sexyMfWasntFoundEmbed(interaction);
        return;
      }

      await interaction.update({
        ...imagesPageProps(
          images,
          nickname,
          interaction.user.id,
          parseInt(page),
        ),
      });
    }
  },
  autocomplete: async (interaction: AutocompleteInteraction) => {
    console.log(interaction.options.getFocused(true).name)
    switch (interaction.options.getFocused(true).name) {
      case "nickname": {
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

	await interaction.respond(
	  sexymfs,
	);
	break
      }
      case "page": {
	const nickname = interaction.options.getString("nickname");
	if (!nickname) { 
	  await interaction.respond([{name: "That sexy mf wasn't found :/", value:""}]) 
	  break; 
	}

	const images = await getSexyImages(nickname)
	if (!images) {
	  await interaction.respond([{name: "That sexy mf wasn't found :/", value:""}])
	  break
	}

	await interaction.respond(
	  Array.from({ length: images.length })
	    .map((_, index) => ({
	      name: (index + 1).toString(),
	      value: index
	    }))
	)
	break
      }
    }
  },
};

Deno.serve({ port: config["sexy-mfs"].port }, (req) => {
  return serveDir(req, {
    fsRoot: `${config["sexy-mfs"].dir}`,
  });
});

export default command;
