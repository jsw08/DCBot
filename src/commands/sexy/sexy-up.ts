import { SlashCommand } from "$/commandLoader.ts";
import { AutocompleteInteraction, SlashCommandBuilder } from "discord.js";
import { embed } from "$utils/embed.ts";
import {
  dir,
  imageFileTypes,
  usernameAutocomplete,
} from "$utils/sexyHelper.ts";
import { join } from "@std/path/join";

const checkFilename = (str: string): boolean => {
  const invalidCharsPattern = /[<>:"/\\|?*]/;
  return !invalidCharsPattern.test(str);
};

const contentTypes: string[] = imageFileTypes.map((v) =>
  `image/${v.replace(".", "")}`
);
const command: SlashCommand = {
  permissions: "select_few",
  inDm: true,

  command: new SlashCommandBuilder()
    .setName("sexy-upload")
    .setDescription("Upload a sexy picture to the server.")
    .addStringOption((opt) =>
      opt
        .setName("nickname")
        .setDescription(
          "The nickname for storing the image. You can also enter a new nickname.",
        )
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("filename")
        .setDescription(
          "Pick a descriptive filename (no ext like .png).",
        )
        .setMinLength(4)
        .setMaxLength(60)
        .setRequired(true)
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("image")
        .setDescription("The image file you will upload to the server.")
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const nickname = interaction.options.getString("nickname", true);
    const filename = interaction.options.getString("filename", true);
    const image = interaction.options.getAttachment("image", true);

    if (
      checkFilename(filename) &&
      !contentTypes.includes(image.contentType ?? "")
    ) {
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message: "Please provide valid parameters.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const nickDir = join(
      dir,
      nickname,
    );

    let createDir = false;
    try {
      await Deno.lstat(nickDir);
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;

      createDir = true;
    }

    if (!createDir) {
      try {
        await Deno.lstat(join(nickDir, filename));
        await interaction.reply({
          embeds: [embed({
            title: "Error!",
            message:
              "There already exists a file with this name on the server. Please choose a different name.",
            kindOfEmbed: "error",
          })],
          ephemeral: true,
        });
        return;
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    } else {
      await Deno.mkdir(nickDir);
    }
    const resp = await fetch(image.url);
    if (!resp.ok || !resp.body || resp.status === 404) {
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message:
            "Something went wrong while downloading the file to the server.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const filetype = image.name.split(".");
    const file = await Deno.create(
      join(nickDir, `${filename}.${filetype[filetype.length - 1]}`),
    );
    resp.body.pipeTo(file.writable);

    await interaction.reply({
      embeds: [
        embed({
          message:
            `'${image.name}' was uploaded successfully to '${nickname}'! The new filename is '${filename}.${
              filetype[filetype.length - 1]
            }'`,
          kindOfEmbed: "success",
        }),
      ],
      ephemeral: true,
    });
  },

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);

    await interaction.respond(
      await usernameAutocomplete(25, focusedOption.value),
    );
  },
};

export default command;
