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
  const fileTypes: string[] = [
    ".png",
    ".PNG",
    ".jpeg",
    ".jpg",
    ".JPG",
    ".gif",
    ".GIF",
    ".webp",
  ];
  const images: string[][] = [[]];

  try {
    const sexyImageFiles = Deno.readDir(
      join(import.meta.dirname!, "../../", config["sexy-mfs"].dir, nickname),
    );
    for await (const image of sexyImageFiles) {
      if (!fileTypes.some((v) => image.name.endsWith(v))) continue;
      if (images[images.length - 1].length === 4) images.push([]);
      images[images.length - 1].push(image.name);
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;

    console.error("Sexy mf (or image) wasn't found: ", nickname);
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
    const isLeft = direction === "l";
    return new ButtonBuilder()
      .setCustomId(
        `${command.command.name}_${userId}_toPage_${nickname}_${currentPage + (isLeft ? -1 : 1)}`,
      )
      .setStyle(ButtonStyle.Primary)
      .setLabel(isLeft ? "⬅️" : "➡️")
      .setDisabled(
        (isLeft && currentPage === 0) || (!isLeft && currentPage === maxPages)
      );
  };
  
  const counterButton = new ButtonBuilder()
    .setDisabled(true)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(`${currentPage}/${maxPages}`)
    .setCustomId(
      `${command.command.name}_${userId}_toPage_${nickname}_${currentPage}`,
    );

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
  const embeds = images[currentPage].map((v) =>
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
  );
  return {
    embeds: embeds.length ? embeds : [
      embed({
        message: "No images were found of this sexy mf :/",
        kindOfEmbed: "error",
      }),
    ],
    components: images.length > 1
      ? [paginatorRow(nickname, userId, currentPage, images.length - 1)]
      : [],
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
    .addStringOption((opt) =>
      opt
        .setName("image")
        .setDescription(
          "Overwrite the image instead of displaying all images as a carousel. This is prioritised over page.",
        )
        .setAutocomplete(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("page")
        .setDescription(
          "Sets the default page for the carousel. Obsolete when overwriting the image. (default: 0)",
        )
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
    const image = interaction.options.getString("image");
    const pub = interaction.options.getBoolean("public");

    if (!nickname || nickname === "") {
      sexyMfWasntFoundEmbed(interaction);
      return;
    }

    let images: string[][] = [];
    if (image) {
      try {
        await Deno.lstat(
          join(
            import.meta.dirname!,
            "../../",
            config["sexy-mfs"].dir,
            nickname,
            image,
          ),
        );
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
        sexyMfWasntFoundEmbed(interaction);
        return;
      }

      images = [[image]];
    } else {
      const imgs = await getSexyImages(nickname);
      if (!imgs) {
        sexyMfWasntFoundEmbed(interaction);
        return;
      }
      images = imgs;
    }

    interaction.reply({
      ...imagesPageProps(
        images,
        nickname,
        interaction.user.id,
        image ? 
          0 
          : (page && page <= images.length && page >= 0) ? page : 0,
      ),
      ephemeral: pub == null ? true : !pub,
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
    const focussedOption = interaction.options.getFocused(true);
    const nickname404 = async () =>
      await interaction.respond([{
        name: "That sexy mf wasn't found :/",
        value: "",
      }]);

    switch (focussedOption.name) {
      case "nickname": {
        const files = Deno.readDir(
          join(import.meta.dirname!, "../../", config["sexy-mfs"].dir),
        );
        const sexymfs: string[] = [];
        for await (const sexymf of files) {
          sexymfs.push(sexymf.name);
        }

        let options: string[] = [];
        if (sexymfs.length === 0) {
          options.push("There are currently no sexy motherfuckers available");
        } else if (focussedOption.value === "") {
          options = sexymfs.slice(0, 25);
        } else {
          options = sexymfs.filter((v) => v.startsWith(focussedOption.value))
            .splice(0, 25);
        }

        await interaction.respond(
          options.map((v) => ({ name: v, value: v })),
        );
        break;
      }
      case "page": {
        const nickname = interaction.options.getString("nickname");
        const image = interaction.options.getString("image");

        if (image) {
          await interaction.respond([{
            name:
              "You can't specify a page if you've already selected an image.",
            value: 0,
          }]);
          return;
        }

        if (!nickname) {
          await nickname404();
          break;
        }

        const images = await getSexyImages(nickname);
        if (!images) {
          await nickname404();
          break;
        }

        let options = Array.from({ length: images.length })
          .map((_, index) => ({
            name: (index).toString(),
            value: index,
          }));

        if (focussedOption.value === "") {
          options = options.splice(0, 10);
          if (options.some((v) => v.value !== images.length - 1)) {
            options.push({
              name: (images.length - 1).toString(),
              value: images.length - 1,
            });
          }
        } else {
          options = options
            .filter((v) => v.name.startsWith(focussedOption.value))
            .splice(0, 25);
        }

        await interaction.respond(
          options,
        );
        break;
      }
      case "image": {
        const nickname = interaction.options.getString("nickname");

        if (!nickname) {
          nickname404();
          break;
        }

        const images = await getSexyImages(nickname);
        if (!images) {
          nickname404();
          break;
        }

        let options = images.flat();
        if (focussedOption.value === "") {
          options = options.splice(0, 25);
        } else {
          options = options
            .filter((v) => v.includes(focussedOption.value))
            .slice(0, 25);
        }

        await interaction.respond(
          options.map((v) => ({
            name: v,
            value: v,
          })),
        );
        break;
      }
    }
  },
};

Deno.serve({ port: config["sexy-mfs"].port }, (req) => { // the 'cdn'
  return serveDir(req, {
    fsRoot: `${config["sexy-mfs"].dir}`,
  });
});

export default command;
