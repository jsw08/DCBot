import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { embed } from "$utils/embed.ts";
import { AttachmentBuilder } from "discord.js";
import { basename } from "@std/path/basename";
import { join } from "@std/path/join";

let typstInstalled = true;
try {
  new Deno.Command("typst", {
    args: ["--version"],
    stdout: "null",
    stderr: "null",
  })
    .spawn();
} catch (e) {
  if (!(e instanceof Deno.errors.NotFound)) throw e;

  console.error(
    "Typst is not installed. Command will be disabled, restart the program to re-run this check.",
  );
  typstInstalled = false;
}

const typstModal = () => {
  const typstInput = new TextInputBuilder()
    .setCustomId("typst")
    .setLabel("Typst code.")
    .setStyle(TextInputStyle.Paragraph);

  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(typstInput);

  return new ModalBuilder()
    .setTitle("Typst editor.")
    .setCustomId(`${command.command.name}`)
    .addComponents(inputRow);
};

type TypstError = { error: "WriteZero" | "TypstError"; errorMsg?: string };
type TypstSuccess = {
  asset: AttachmentBuilder;
  imageName: string;
  deleteFile: () => void;
};
const typstRender = async (
  input: string,
  outputPath: string,
): Promise<void | TypstError> => {
  const typstCommand = new Deno.Command("typst", {
    args: ["compile", "--root", import.meta.dirname!, "-f", "png", "-", outputPath],
    stdin: "piped",
    stderr: "piped",
  });
  const typstChild = typstCommand.spawn();
  typstChild.ref();

  const typstWriter = typstChild.stdin.getWriter();
  try {
    await typstWriter.write(new TextEncoder()
      .encode(`#set page(height: auto, width: auto, margin: 1em)\n${input}`));
    await typstWriter.close();
  } catch (e) {
    if (!(e instanceof Deno.errors.WriteZero)) throw e;

    return { error: "WriteZero" };
  }

  const status = await typstChild.output();
  if (!status.success) {
    return {
      error: "TypstError",
      errorMsg: new TextDecoder().decode(status.stderr),
    };
  }
};
const typstMessage = async (
  input: string,
): Promise<TypstSuccess | TypstError> => {
  const tempImageFile = await Deno.makeTempFile({
    prefix: "typst_",
    suffix: ".png",
  });

  const typst = await typstRender(input, tempImageFile);
  if (typst !== undefined) return typst;

  return {
    asset: new AttachmentBuilder(tempImageFile),
    imageName: basename(tempImageFile),
    deleteFile: async () => await Deno.remove(tempImageFile),
  };
};
const isTypstError = (
  result: TypstError | TypstSuccess,
): result is TypstError => {
  return (result as TypstError).error !== undefined;
};

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("typst")
    .setDescription("Compiles the provided typst code to an image.")
    .addStringOption((opts) =>
      opts
        .setName("typst-inline")
        .setDescription(
          "Single line typst input. Prevents the modal from showing up.",
        )
    ),

  execute: async (interaction) => {
    if (!typstInstalled) {
      interaction.reply({
        embeds: [embed({
          title: "Typst Error",
          message:
            "Typst wasn't setup properly on the server. (note to dev: please include typst in path.)",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const inlineTypst = interaction.options.getString("typst-inline");
    if (!inlineTypst) {
      await interaction.showModal(typstModal());
      return;
    }

    const typst = await typstMessage(inlineTypst);
    if (isTypstError(typst)) {
      interaction.reply({
        embeds: [embed({
          title: "Typst Error",
          message:
            `Error while using running typst (${typst.error}).` + typst.errorMsg
              ? `\`\`\`${typst.errorMsg}\`\`\``
              : "",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        embed({
          title: "Typst Compiler",
          kindOfEmbed: "success",
        }).setImage(`attachment:///${typst.imageName}`),
      ],
      files: [typst.asset],
      ephemeral: false,
    });

    typst.deleteFile();
  },
  modal: async (interaction) => {
    await interaction.deferReply();
    const input = interaction.fields.getField("typst");

    if (!input) {
      await interaction.followUp({
        embeds: [embed({
          title: "Typst compiler",
          kindOfEmbed: "error",
          message: "Please provide a valid input.",
        })],
      });
      return;
    }

    const typst = await typstMessage(input.value);
    if (isTypstError(typst)) {
      interaction.followUp({
        embeds: [embed({
          title: "Server Error",
          message:
            `Error while using running typst (${typst.error}).` + typst.errorMsg
              ? `\`\`\`${typst.errorMsg}\`\`\``
              : "",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    await interaction.followUp({
      embeds: [
        embed({
          title: "Typst compiler",
          kindOfEmbed: "success",
        }).setImage(`attachment:///${typst.imageName}`),
      ],
      files: [typst.asset],
      ephemeral: false,
    });
  },
};

export default command;
