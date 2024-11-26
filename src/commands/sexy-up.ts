import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { embed } from "../utils/embed.ts";
import { AutocompleteInteraction } from "discord.js";
import { imageFileTypes, usernameAutocomplete } from "../utils/sexyHelper.ts";
import { join } from "@std/path/join";
import config from "../../config.json" with { type: "json" };

const contentTypes: string[] = imageFileTypes.map((v) =>
  `image/${v.replace(".", "")}`
);
const command: SlashCommand = {
  inGuild: "select_few",
  command: new SlashCommandBuilder()
    .setName("sexy-up")
    .setDescription("Upload a sexy picture to the server.")
    .addStringOption((opt) =>
      opt
        .setName("nickname")
        .setDescription(
          "The nickname under which the image will be stored. You may also fill in a new nickname.",
        )
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("image")
        .setDescription("The image file you'll be uploading to the server.")
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const nickname = interaction.options.getString("nickname");
    const image = interaction.options.getAttachment("image");

    if (!nickname) {
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message: `Please provide a valid nickname.`,
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    if (
      image === null || image.contentType === null || image.url === null ||
      !contentTypes.includes(image.contentType)
    ) {
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message: "Please provide a valid image.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const dir = join(
      import.meta.dirname!,
      "../../",
      config["sexy-mfs"].dir,
      nickname,
    );
    let createDir = false;
    try {
      await Deno.lstat(dir);
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;

      createDir = true;
    }

    if (!createDir) {
      try {
        await Deno.lstat(join(dir, image.name));
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
      await Deno.mkdir(dir);
    }
    const resp = await fetch(image.url);
    if (!resp.ok || !resp.body || resp.status === 404) {
      await interaction.reply({
        embeds: [embed({
          title: "Error!",
          message: "Something went wrong while downloading the file to the server.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const file = await Deno.create(join(dir, image.name));
    resp.body.pipeTo(file.writable);

    await interaction.reply({
      embeds: [
        embed({
          message: `'${image.name}' was uploaded successfully!`,
          kindOfEmbed: "success",
        }),
      ],
      ephemeral: true
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
