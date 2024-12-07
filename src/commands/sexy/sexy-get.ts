import {
  ActionRowBuilder,
  AutocompleteInteraction,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionResponse,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { embed } from "$utils/embed.ts";
import {
  dir,
  imageFileTypes,
  usernameAutocomplete,
} from "$utils/sexyHelper.ts";
import { join } from "@std/path/join";
import { serveDir } from "@std/http/file-server";

const getSexyImages = async (
  nickname: string,
): Promise<string[][] | undefined> => {
  const images: string[][] = [[]];

  try {
    const sexyImageFiles = Deno.readDir(
      join(dir, nickname),
    );

    for await (const image of sexyImageFiles) {
      if (!imageFileTypes.some((v) => image.name.endsWith(v))) continue;
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
        `${command.command.name}_${userId}_toPage_${nickname}_${
          currentPage + (isLeft ? -1 : 1)
        }`,
      )
      .setStyle(ButtonStyle.Primary)
      .setLabel(isLeft ? "⬅️" : "➡️")
      .setDisabled(
        (isLeft && currentPage === 0) || (!isLeft && currentPage === maxPages),
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
        new URL(`/${nickname}/${v}`, config.SEXY_URL)
          .toString(),
      )
      .setURL(config.SEXY_TITLE_URL)
      .setAuthor({ name: "Images may take a moment to load." })
  );
  images[currentPage].map((v) =>
    console.log(
      new URL(`/${nickname}/${v}`, config.SEXY_URL)
        .toString(),
    )
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

const sendNotFoundEmbed = (
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<InteractionResponse> =>
  interaction.reply({
    embeds: [
      embed({ message: "That sexy mf wasn't found :/", kindOfEmbed: "error" }),
    ],
    ephemeral: true,
  });

const addCommonSubCommandOptions = (
  subc: SlashCommandSubcommandBuilder,
  requiredCommands?: (
    arg0: SlashCommandSubcommandBuilder,
  ) => SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder => {
  subc
    .addStringOption((opt) =>
      opt
        .setName(`nickname`)
        .setDescription("The nickname of the sexy mf.")
        .setAutocomplete(true)
        .setRequired(true)
    );
  subc = requiredCommands ? requiredCommands(subc) : subc;
  return subc.addBooleanOption((opt) =>
    opt
      .setName(`public`)
      .setDescription(
        "This option makes the response visible to all, disabled by default.",
      )
  );
};
const subCommandImage = (
  subc: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder =>
  addCommonSubCommandOptions(subc, (subc) =>
    subc
      .addStringOption((opt) =>
        opt
          .setName("image")
          .setDescription(
            "View a specific image.",
          )
          .setAutocomplete(true)
          .setRequired(true)
      ))
    .setName("image")
    .setDescription("View a specific sexy image.");
const subCommandCarousel = (
  subc: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder =>
  addCommonSubCommandOptions(subc)
    .setDescription("Display all sexy images in a carousel.")
    .addIntegerOption((opt) =>
      opt
        .setName("page")
        .setDescription(
          "Sets the default page for the carousel. (default: 0)",
        )
        .setAutocomplete(true)
    )
    .setName("carousel");

const command: SlashCommand = {
  inDm: true,
  permissions: "select_few",

  command: new SlashCommandBuilder()
    .setName("sexy")
    .setDescription(
      "Retrieves an not-so appealing image from the server's file system.",
    )
    .addSubcommand(subCommandImage)
    .addSubcommand(subCommandCarousel),

  execute: async (interaction) => {
    const nickname = interaction.options.getString("nickname", true);
    const page = interaction.options.getInteger("page");
    const image = interaction.options.getString("image");
    const pub = interaction.options.getBoolean("public");

    const subc = interaction.options.getSubcommand(true);

    let images: string[][] = [];
    if (subc === "image" && image) {
      try {
        await Deno.lstat(
          join(
            dir,
            nickname,
            image,
          ),
        );
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
        sendNotFoundEmbed(interaction);
        return;
      }

      images = [[image]];
    } else {
      const imgs = await getSexyImages(nickname);
      if (!imgs) {
        sendNotFoundEmbed(interaction);
        return;
      }
      images = imgs;
    }

    interaction.reply({
      ...imagesPageProps(
        images,
        nickname,
        interaction.user.id,
        image ? 0 : (page && page <= images.length && page >= 0) ? page : 0,
      ),
      ephemeral: pub == null ? true : !pub,
    });
  },

  button: async (interaction: ButtonInteraction) => {
    const id = interaction.customId;
    const command = id.split("_")[2];

    if (command.includes("toPage")) {
      const nickname = id.split("_")[3];
      let page = parseInt(id.split("_")[4]);

      const images: string[][] | undefined = await getSexyImages(nickname);
      if (!images) {
        await sendNotFoundEmbed(interaction);
        return;
      }

      const length = images.length - 1;
      if (page > length - 1) page = length;

      await interaction.update({
        ...imagesPageProps(
          images,
          nickname,
          interaction.user.id,
          page,
        ),
      });
    }
  },

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);
    const respondWithNotFound = async (msg: "nickname" | "image") => {
      const messages: Record<typeof msg, string> = {
        "nickname": "That sexy mf wasn't found :/",
        "image": "That sexy mf doesn't have any images.",
      };

      await interaction.respond([{
        name: messages[msg],
        value: "",
      }]);
    };

    switch (focusedOption.name) {
      case "nickname": {
        await interaction.respond(
          await usernameAutocomplete(25, focusedOption.value),
        );
        break;
      }
      case "page": {
        const nickname = interaction.options.getString("nickname");

        if (!nickname) {
          await respondWithNotFound("nickname");
          break;
        }

        const images = await getSexyImages(nickname);
        if (!images) {
          await respondWithNotFound("image");
          break;
        }

        let options = Array.from({ length: images.length })
          .map((_, index) => ({
            name: index.toString(),
            value: index,
          }));

        if (focusedOption.value === "") {
          const length = images.length - 1;
          options = options.splice(0, 10);
          if (length > 10) {
            options.push({
              name: length.toString(),
              value: length,
            });
          }
        } else {
          options = options
            .filter((v) => v.name.startsWith(focusedOption.value))
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
          respondWithNotFound("nickname");
          break;
        }

        const images = await getSexyImages(nickname);
        if (!images) {
          respondWithNotFound("image");
          break;
        }

        let options = images.flat();
        if (focusedOption.value === "") {
          options = options.splice(0, 25);
        } else {
          options = options
            .filter((v) => v.includes(focusedOption.value))
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

Deno.serve({ port: parseInt(config.SEXY_PORT) }, (req) => { // the 'cdn'
  return serveDir(req, {
    fsRoot: `${dir}`,
  });
});

export default command;
