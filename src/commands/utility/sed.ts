import { embed } from "$utils/embed.ts";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { ContextMenu } from "../../commandLoader.ts";

async function expiredModal(interaction: MessageContextMenuCommandInteraction) {
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [
      embed({
        kindOfEmbed: "error",
        title: "Error",
        message:
          "Your modal expired. Please try again (it expires in 5minutes).",
      }),
    ],
  });
}

function replaceInObject<T>(obj: T, search: RegExp, replace: string): T {
  if (typeof obj === "string") {
    return obj.replaceAll(search, replace) as T;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replaceInObject(item, search, replace)) as T;
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        replaceInObject(value, search, replace),
      ]),
    ) as T;
  }

  return obj;
}

const command: ContextMenu = {
  inDm: true,
  permissions: "everywhere",

  command: new ContextMenuCommandBuilder()
    .setName("sed")
    .setType(ApplicationCommandType.Message),
  execute: async (interaction) => {
    const searchInput = new TextInputBuilder()
      .setLabel("Search")
      .setCustomId("search")
      .setStyle(TextInputStyle.Short);
    const replaceInput = new TextInputBuilder()
      .setLabel("Replace")
      .setCustomId("replace")
      .setStyle(TextInputStyle.Short);

    const row1 =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        searchInput,
      );
    const row2 =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        replaceInput,
      );

    const modal = new ModalBuilder()
      .setTitle("SED")
      .setCustomId(command.command.name)
      .addComponents(row1, row2);
    await interaction.showModal(modal);

    const submitted = await interaction
      .awaitModalSubmit({
        time: 300_000,
        filter: (i) => i.user.id === interaction.user.id,
      })
      .catch(async (error) => {
        await expiredModal(interaction);
        console.error(error);
        return null;
      });

    if (!submitted) {
      expiredModal(interaction);
      return;
    }

    const search = new RegExp(
      submitted.fields.getTextInputValue("search"),
      "g",
    );
    const replace = submitted.fields.getTextInputValue("replace");

    const message = interaction.targetMessage;
    submitted.reply({
      content: `-# \`s/${search.source}/${replace}/g\`\n${replaceInObject(message.content, search, replace)}`,
      embeds: message.embeds.map((v) => {
        const newEmbed = new EmbedBuilder()
          .setURL(v.url)
          .setImage(v.image?.url ?? null)
          .setColor(v.color)
          .setTimestamp(v.timestamp ? new Date(v.timestamp) : null)
          .setThumbnail(v.thumbnail?.url ?? null)
          .setTitle(v.title?.replaceAll(search, replace) ?? null)
          .setDescription(v.description?.replaceAll(search, replace) ?? null)
          .setFields(replaceInObject(v.fields, search, replace));

        if (v.author)
          newEmbed.setAuthor({
            ...v.author,
            name: v.author?.name.replaceAll(search, replace) ?? "",
          });
        if (v.footer)
          newEmbed.setFooter({
            ...v.footer,
            text: v.footer?.text.replaceAll(search, replace) ?? "",
          });

        return newEmbed;
      }),
    });
  },
};

export default command;
