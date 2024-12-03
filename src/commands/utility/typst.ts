import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import {
  AttachmentBuilder,
  ModalActionRowComponentBuilder,
  TextInputStyle,
} from "discord.js";
import { embed } from "$utils/embed.ts";
import { basename } from "@std/path/basename";
import { Buffer } from "node:buffer";
import { SlashCommandSubcommandBuilder } from "discord.js";

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

const codeModal = (transparantBackground: boolean, attachFile: boolean) => {
  const codeInput = new TextInputBuilder()
    .setCustomId("code")
    .setLabel("Typst code.")
    .setStyle(TextInputStyle.Paragraph);

  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(codeInput);

  return new ModalBuilder()
    .setTitle("Typst editor.")
    .setCustomId(`${command.command.name}_${Number(transparantBackground)}_${Number(attachFile)}`)
    .addComponents(inputRow);
};

const typstRender = async (
  input: string,
  transparant: boolean,
  outputPath: string,
): Promise<void | TypstError> => {
  const typstCommand = new Deno.Command("typst", {
    args: [
      "compile",
      "--root",
      import.meta.dirname!,
      "-f",
      "png",
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
	#set page(height: auto, width: auto, margin: 1em${transparant ? ", fill: none" : ""})
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
  transparant: boolean
): Promise<TypstSuccess | TypstError> => {
  const tempImageFile = await Deno.makeTempFile({
    prefix: "typst_",
    suffix: ".png",
  });

  const typst = await typstRender(input, transparant, tempImageFile);
  if (typst !== undefined) return typst;

  return {
    asset: new AttachmentBuilder(tempImageFile),
    imageName: basename(tempImageFile),
    deleteFile: async () => await Deno.remove(tempImageFile),
  };
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
        "Makes the png background transparant. ONLY COMPATIBLE WITH DISCORD DARK MODE.",
      )
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
        .addBooleanOption((opts) =>
          opts
            .setName("file")
            .setDescription("Attaches the given typst code as a file.")
        )
    ),
  execute: async (interaction) => {
    if (!typstInstalled) {
      interaction.reply({
        embeds: [embed({
          title: "Typst",
          message:
            "Typst wasn't setup properly on the server. (note to dev: please include typst in path.)",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const transparantBackground = interaction.options.getBoolean("transparant") ?? true
    if (interaction.options.getSubcommand(true) === "multiline") {
      await interaction.showModal(
        codeModal(transparantBackground, interaction.options.getBoolean("file") ?? false)
      );
      return;
    }

    const inlineTypst = interaction.options.getString("code");
    if (!inlineTypst) {
      interaction.reply({
        embeds: [embed({
          title: "Typst",
          message: "Please provide valid typst code.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const typst = await typstMessage(inlineTypst, transparantBackground);
    if (isTypstError(typst)) {
      interaction.reply({
        embeds: [embed({
          title: "Typst",
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
      files: [typst.asset],
      ephemeral: false,
    });

    typst.deleteFile();
  },
  modal: async (interaction) => {
    await interaction.deferReply();
    const input = interaction.fields.getField("code");
    const attachFile = interaction.customId.split("_")[2] === "1";
    const transparantBackground = interaction.customId.split("_")[1] === "1";

    if (!input) {
      await interaction.followUp({
        embeds: [embed({
          title: "Typst",
          kindOfEmbed: "error",
          message: "Please provide a valid input.",
        })],
      });
      return;
    }

    const typst = await typstMessage(input.value, transparantBackground);
    if (isTypstError(typst)) {
      interaction.followUp({
        embeds: [embed({
          title: "Typst",
          message:
            `Error while using running typst (${typst.error}).` + typst.errorMsg
              ? `\`\`\`${typst.errorMsg}\`\`\``
              : "",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const files: AttachmentBuilder[] = [typst.asset];
    if (attachFile) {
      const typstFile = new AttachmentBuilder(
        Buffer.from(new TextEncoder().encode(input.value)),
      );
      typstFile.setName("main.typ");
      files.push(typstFile);
    }
    console.log(!attachFile);
    await interaction.followUp({
      files: files,
    });
  },
};

export default command;
