import { SlashCommand } from "$/commandLoader.ts";
import {
  AutocompleteInteraction,
  Channel,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { embed } from "$utils/embed.ts";
import {
  dir,
  imageFileTypes,
  usernameAutocomplete,
} from "$utils/sexyHelper.ts";
import { join } from "@std/path/join";
import { config } from "$utils/config.ts";
import { client } from "$/main.ts";

const getSexyChannels = (): TextChannel[] => {
  const channels: TextChannel[] = [];
  if (!client.isReady()) {
    console.error("SexyUP: Client isn't ready yet. Unable to get channels.");
    return [];
  }

  for (const i of config.SEXY_LOG_CHANNELS.split(",")) {
    const channel: Channel | null | undefined = client.channels.cache.get(i);

    if (!channel || channel === null) {
      console.error("SexyUP: Channel wasn't found.", i);
      continue;
    }
    if (!(channel instanceof TextChannel)) {
      console.error("SexyUP: This isn't a text channel", i);
      continue;
    }
    if (!client.user) {
      console.error(
        "SexyUP: Something went terribly wrong, the bot user doesn't exist? Very weird.",
      );
      continue;
    }

    const permissions = channel.permissionsFor(client.user);
    if (
      !permissions || !permissions.has("ViewChannel") ||
      !permissions.has("SendMessages")
    ) {
      console.error(
        "SexyUP: No permissions to send messages in this channel. ",
        i,
        permissions?.toArray(),
      );
      continue;
    }

    channels.push(channel);
  }
  return channels;
};

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
          title: "Sexy upload - Error!",
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

    const filetype = ((v) => v[v.length - 1])(image.name.split("."));
    if (!createDir) {
      try {
        await Deno.lstat(join(nickDir, `${filename}.${filetype}`));
        await interaction.reply({
          embeds: [embed({
            title: "Sexy upload - Error!",
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
          title: "Sexy upload - Error!",
          message:
            "Something went wrong while downloading the file to the server.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        embed({
          title: "Sexy upload - halfway there",
          message:
            `The image was uploaded sucessfully to discord. Currently downloading to the server.`,
          kindOfEmbed: "warning",
        }),
      ],
      ephemeral: true,
    });

    const file = await Deno.create(
      join(nickDir, `${filename}.${filetype}.TMP`),
    );
    await resp.body.pipeTo(file.writable);
    await Deno.rename(
      join(nickDir, `${filename}.${filetype}.TMP`),
      join(nickDir, `${filename}.${filetype}`),
    )

    await interaction.editReply({
      embeds: [
        embed({
          title: "Sexy upload - completed",
          message:
            `'${image.name}' was uploaded successfully to '${nickname}'! The new filename is '${filename}.${filetype}'. It is currently being downloaded to the server, it might take a few seconds before it is available in sexy carousel.`,
          kindOfEmbed: "success",
        }),
      ],
    });

    for (const channel of getSexyChannels()) {
      channel.send({
        embeds: [
          embed({
            title: `${nickname}`,
            message: `${filename}`,
	    kindOfEmbed: "success"
          })
            .setImage(
              new URL(`/${nickname}/${filename}.${filetype}`, config.SEXY_URL)
                .toString(),
            ),
        ],
      });
    }
  },

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);

    await interaction.respond(
      await usernameAutocomplete(25, focusedOption.value),
    );
  },
};

export default command;
