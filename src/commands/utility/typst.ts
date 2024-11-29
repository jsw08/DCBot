import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "discord.js";
import { SlashCommand } from "../../commandLoader.ts";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { embed } from "../../utils/embed.ts";
import { AttachmentBuilder } from "discord.js";
import { basename } from "@std/path/basename";

let typstInstalled = false;
new Deno.Command("typst", {
  args: ["--version"],
  stdout: "null",
  stderr: "null",
})
  .spawn()
  .output()
  .then((v) => typstInstalled = v.success);

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

type TypstError = {error: "WriteZero" | "TypstError", errorMsg?: string };
const typstRender = async (input: string, outputPath: string): Promise<void | TypstError> => {
  const typstCommand = new Deno.Command("typst", {
    args: ["compile", "-f", "png", "-", outputPath],
    stdin: "piped",
    stderr: "piped"
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

    return { error: "WriteZero" }
  }

  const status = await typstChild.output();
  if (!status.success) return { error: "TypstError", errorMsg: new TextDecoder().decode(status.stderr) }
}
const typstMessage = async (input: string): Promise<{asset: AttachmentBuilder, imageName: string, deleteFile: () => void} | TypstError> => {
  const tempImageFile = await Deno.makeTempFile({
    prefix: "typst_",
    suffix: ".png",
  });

  const typst = await typstRender(input, tempImageFile);
  if (typst) return typst;

  return {asset: new AttachmentBuilder(tempImageFile), imageName: basename(tempImageFile), deleteFile: async () => await Deno.remove(tempImageFile)}
}
const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("typst")
    .setDescription("Compiles the provided typst code to an image.")
    .addStringOption(opts => opts
      .setName("typst-inline")
      .setDescription("Single line typst input. Prevents the modal from showing up.")
    ) // 
  ,

  execute: async (interaction) => {
    if (!typstInstalled) {
      interaction.reply({
	embeds: [embed({
	  title: "Server Error",
	  message: "Typst wasn't setup properly on the server. (note to dev: please include typst in path.)",
	  kindOfEmbed: "error"
	})]
      })
    }

    const inlineTypst = interaction.options.getString("typst-inline");
    if (!inlineTypst) {
      await interaction.showModal(typstModal());
      return
    }

    const typst = typstMessage(inlineTypst)
  },
  modal: async (interaction) => {
    await interaction.deferReply()
    const input = interaction.fields.getField("typst");

    const tempImageFile = await Deno.makeTempFile({
      prefix: "typst_",
      suffix: ".png",
    });
    const typstCommand = new Deno.Command("typst", {
      args: ["compile", "-f", "png", "-", tempImageFile],
      stdin: "piped",
      stderr: "piped"
    });
    const typstChild = typstCommand.spawn();
    typstChild.ref();

    const typstWriter = typstChild.stdin.getWriter();
    try {
      await typstWriter.write(new TextEncoder()
	.encode(`#set page(height: auto, width: auto, margin: 1em)\n${input.value}`));
      await typstWriter.close();
    } catch (e) {
      if (!(e instanceof Deno.errors.WriteZero)) throw e;

      await interaction.followUp({
        embeds: [embed({
          title: "Server Error",
          message:
            "Something went wrong wile writing your message to the typst compiler.",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const status = await typstChild.output();

    if (!status.success) {
      console.info(tempImageFile);
      await interaction.followUp({
        embeds: [embed({
          title: "Typst Error",
          message:
            `Something went wrong with compiling your typst code to a png. \`\`\`${new TextDecoder().decode(status.stderr)}\`\`\``,
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const image = new AttachmentBuilder(tempImageFile);
    await interaction.followUp({
      embeds: [embed({
        title: "Typst compiler",
        kindOfEmbed: "success",
      }).setImage(`attachment:///${basename(tempImageFile)}`)],
      files: [image],
      ephemeral: false,
    });

    await Deno.remove(tempImageFile);
  },
};

export default command;
