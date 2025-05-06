import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  codeBlock,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Buffer } from "node:buffer";
import { SlashCommand } from "$/commandLoader.ts";
import { basename } from "@std/path/basename";
import { embed } from "$utils/embed.ts";
import { checkOrCreateDir } from "$utils/dir.ts";
import { join } from "@std/path/join";
import { config } from "$utils/config.ts";
import { delButtonRow } from "$utils/deleteBtn.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";

const TYPST_DIR = join(config.DATA_DIR, "typst");
// Typst installed check
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

// Create seperate typst directory.
checkOrCreateDir(TYPST_DIR);

// Typst running and checking errors
type TypstError = { error: "WriteZero" | "TypstError"; errorMsg?: string };
type TypstSuccess = {
  asset: AttachmentBuilder;
  imageName: string;
  deleteFile: () => void;
};
const isTypstError = (
  result: TypstError | TypstSuccess,
): result is TypstError => {
  return (result as TypstError).error !== undefined;
};

const typstRender = async (
  input: string,
  transparant: boolean,
  outputPath: string,
): Promise<void | TypstError> => {
  const formatDate = (n: number): string => n.toString().padStart(2, "0");
  const now = new Date();

  const typstCommand = new Deno.Command("typst", {
    args: [
      "compile",
      "--root",
      TYPST_DIR,
      "-f",
      "png",
      "--input",
      `now=${`${now.getFullYear()} ${formatDate(now.getMonth() + 1)} \
${formatDate(now.getDate())} ${formatDate(now.getHours())} \
${formatDate(now.getMinutes())} ${formatDate(now.getSeconds())}`}`,
      "-",
      outputPath,
    ],
    stdin: "piped",
    stderr: "piped",
  });
  const typstChild = typstCommand.spawn();
  typstChild.ref();

  const typstWriter = typstChild.stdin.getWriter();
  try {
    await typstWriter.write(new TextEncoder()
      .encode(`
	#set page(height: auto, width: auto, margin: 0.5em${
        transparant ? ", fill: none" : ""
      })
	${transparant ? "#set text(fill: white)" : ""}
	${input}
      `));
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
  transparant: boolean,
): Promise<TypstSuccess | TypstError> => {
  const tempImageFile = await Deno.makeTempFile({
    prefix: "typst_",
    suffix: ".png",
    dir: TYPST_DIR,
  });

  const typst = await typstRender(input, transparant, tempImageFile);
  if (typst !== undefined) return typst;

  return {
    asset: new AttachmentBuilder(tempImageFile),
    imageName: basename(tempImageFile),
    deleteFile: async () => await Deno.remove(tempImageFile),
  };
};

// Interaction handler
const typstHandler = async (
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  transparantBackground: boolean,
  attachFile: boolean,
  input?: string,
): Promise<void> => {
  if (!input) {
    await interaction.followUp({
      embeds: [embed({
        title: "Typst",
        kindOfEmbed: "error",
        message: "Please provide valid typst code.",
      })],
      components: [
        delButtonRow(`${command.command.name}_delete_${interaction.user.id}`),
      ],
    });
    return;
  }

  const typst = await typstMessage(input, transparantBackground);
  if (isTypstError(typst)) {
    interaction.followUp({
      embeds: [embed({
        title: "Typst",
        message: `Error while using running typst (${typst.error}).` +
          codeBlock((typst.errorMsg ?? "").replaceAll("`", "")), // IDC that it changes your error.
        kindOfEmbed: "error",
      })],
      components: [
        delButtonRow(`${command.command.name}_delete_${interaction.user.id}`),
      ],
    });
    return;
  }

  const files: AttachmentBuilder[] = [typst.asset];
  if (attachFile) {
    const typstFile = new AttachmentBuilder(
      Buffer.from(new TextEncoder().encode(input)),
    );
    typstFile.setName("main.typ");
    files.push(typstFile);
  }

  await interaction.followUp({ files });
  typst.deleteFile();
};

// Typst editor modal
const codeModal = (transparantBackground: boolean, attachFile: boolean) => {
  const codeInput = new TextInputBuilder()
    .setCustomId("code")
    .setLabel("Typst code.")
    .setStyle(TextInputStyle.Paragraph);

  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(codeInput);

  return new ModalBuilder()
    .setTitle("Typst editor.")
    .setCustomId(
      `${command.command.name}_${Number(transparantBackground)}_${
        Number(attachFile)
      }`,
    )
    .addComponents(inputRow);
};

const commonCommands = (
  subc: SlashCommandSubcommandBuilder,
  reqCmds?: (
    subc: SlashCommandSubcommandBuilder,
  ) => SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder => ((reqCmds ? reqCmds(subc) : subc)
  .addBooleanOption((opts) =>
    opts
      .setName("transparant")
      .setDescription(
        "Makes the png background transparant. ONLY COMPATIBLE WITH DISCORD DARK MODE. (ENABLED)",
      )
  )
  .addBooleanOption((opts) =>
    opts
      .setName("file")
      .setDescription("Attaches the given typst code as a file. (DISABLED)")
  ));

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("typst")
    .setDescription("Compiles typst code.")
    .addSubcommand((subc) =>
      commonCommands(subc, (subc) =>
        subc
          .addStringOption((opts) =>
            opts
              .setName("code")
              .setDescription("Provide typst code.")
              .setRequired(true)
          ))
        .setName("inline")
        .setDescription("Compiles the given typst-oneline code to an image.")
    )
    .addSubcommand((subc) =>
      commonCommands(subc)
        .setName("multiline")
        .setDescription("Compiles the given typst code to an image.")
    ),
  execute: async (interaction) => {
    if (!typstInstalled) {
      await interaction.reply({
        embeds: [embed({
          title: "Typst",
          message:
            "Typst wasn't setup properly on the server. (note to dev: please include typst in path.)",
          kindOfEmbed: "error",
        })],
        components: [
          delButtonRow(`${command.command.name}_delete_${interaction.user.id}`),
        ],
      });
      return;
    }

    const transparantBackground =
      interaction.options.getBoolean("transparant") ?? true;
    const includeFile = interaction.options.getBoolean("file") ?? false;
    if (interaction.options.getSubcommand(true) === "multiline") {
      await interaction.showModal(
        codeModal(transparantBackground, includeFile),
      );
      return;
    }

    const code = interaction.options.getString("code", true);

    await interaction.deferReply();
    await typstHandler(interaction, transparantBackground, includeFile, code);
  },

  modal: async (interaction) => {
    const file = interaction.customId.split("_")[2] === "1";
    const transparant = interaction.customId.split("_")[1] === "1";
    const code = interaction.fields.getField("code");

    await interaction.deferReply();
    await typstHandler(interaction, transparant, file, code.value);
  },

  button: async (interaction) => {
    const id = interaction.customId;
    const command = id.split("_")[1];

    if (command !== "delete") return;
    if (interaction.user.id !== id.split("_")[2]) {
      await interaction.reply({
        embeds: [accessDeniedEmbed],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();
    await interaction.deleteReply();
  },
};

export default command;
