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
    .setCustomId("typst-input")
    .setLabel("Enter your typst code here.")
    .setStyle(TextInputStyle.Paragraph);
  const inputRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(typstInput);

  return new ModalBuilder()
    .setTitle("Enter your typst code here.")
    .setCustomId(`${command.command.name}`)
    .addComponents(inputRow);
};

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("typst")
    .setDescription("Compiles the provided typst code to a png."),

  execute: async (interaction) => {
    await interaction.showModal(typstModal());
  },
  modal: async (interaction) => {
    const input = interaction.fields.getField("typst-input");

    const tempImageFile = await Deno.makeTempFile({
      prefix: "typst_",
      suffix: ".png",
    });
    const typstCommand = new Deno.Command("typst", {
      args: ["compile", "-f", "png", "-", tempImageFile],
      stdin: "piped",
    });
    const typstChild = typstCommand.spawn();
    typstChild.ref();

    const typstWriter = typstChild.stdin.getWriter();
    try {
      await typstWriter.write(new TextEncoder().encode(input.value));
      await typstWriter.close();
    } catch (e) {
      if (!(e instanceof Deno.errors.WriteZero)) throw e;

      await interaction.reply({
        embeds: [embed({
          title: "Error",
          message:
            "Something went wrong wile writing your message to the typst compiler.",
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const status = await typstChild.status;
    if (!status.success) {
      console.info(tempImageFile);
      await interaction.reply({
        embeds: [embed({
          title: "Error",
          message:
            `Something went wrong with compiling your typst code to a png.`,
          kindOfEmbed: "error",
        })],
        ephemeral: true,
      });
      return;
    }

    const image = new AttachmentBuilder(tempImageFile);
    await interaction.reply({
      embeds: [embed({
        title: "Typst compiler",
        message: `${tempImageFile}`,
        kindOfEmbed: "success",
      }).setImage(`attachment:///${basename(tempImageFile)}`)],
      files: [image],
      //ephemeral: true,
    });
  },
};

export default command;
