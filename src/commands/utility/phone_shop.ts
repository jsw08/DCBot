import { SlashCommand } from "$/commandLoader.ts";
import { embed } from "$utils/embed.ts";
import { ComponentType } from "discord.js";
import { InteractionUpdateOptions } from "discord.js";
import { InteractionReplyOptions } from "discord.js";
import { StringSelectMenuOptionBuilder } from "discord.js";
import { ButtonStyle } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { config } from "$utils/config.ts";
import { join } from "@std/path";

const phones_text = await Deno.readTextFile(
  join(config.DATA_DIR, "phones.json"),
).catch((e) => {
  console.error(`
    Failed to read phones json file. Please create a json file containing the following file structure: '{phones: []}' with the phones items being the following type: 
    {
      name: string;
      codeName: string;
      url: string;
      payUrl: string[];
      price: number[];
    }
  `);
  throw e;
});

const PHONES = (JSON.parse(phones_text) as {
  phones: {
    name: string;
    codeName: string;
    url: string;
    payUrl: string[]; // This is sensitive information, hence the json file.
    price: number[];
  }[];
}).phones;
const COLORS: string[] = [
  "Black",
  "White",
];
const STRENGTH: string[] = [
  "Nokia",
  "Normal",
  "Weak",
];
const DELIVERY: { name: string; description: string }[] = [
  { name: "cld", description: "Meetup during a break at the cld." },
  { name: "delft", description: "Meetup somewhere near Delft (I'll dm you)." },
];

const command: SlashCommand = {
  inDm: true,
  permissions: "nowhere",

  command: new SlashCommandBuilder()
    .setName("setupshop")
    .setDescription(
      "ADMIN ONLY - Creates a message where users can order mock phones from.",
    )
    .addStringOption((opts) =>
      opts
        .setName("name")
        .setDescription("Your user name for the title.")
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const name = interaction.options.getString("name", true);
    if (name.length > 60) {
      await interaction.reply({
        embeds: [embed({
          title: "Error creating shop.",
          message: "Name's too long. Must be shorter than 60chars.",
          kindOfEmbed: "error",
        })],
      });
    }

    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setCustomId(`setupshop_start`)
      .setEmoji("📲")
      .setLabel("Purchase Now!");
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(button);

    await interaction.reply({
      embeds: [embed({
        title: `${name}'s Phone Shop`,
        message:
          `Are you tempted to prank your teachers with the new phone policy in place? 
Now you can do it affordably, order yours today!
-# Price will depend on the model and strength that you choose.
-# Expect delivery between 2 - 10 business days (if you choose to receive it at cld-mhp).`,
        kindOfEmbed: "success",
      })],
      components: [row],
    });
  },
  button: async (interaction) => {
    if (interaction.customId !== "setupshop_start") {
      return;
    }

    const selectAmount = 4;
    const phoneModelSelect = new StringSelectMenuBuilder()
      .setCustomId("model")
      .setId(1)
      .setPlaceholder("What kind of phone do you want?")
      .addOptions(
        ...(PHONES.map((v) =>
          new StringSelectMenuOptionBuilder().setLabel(v.name).setValue(
            v.codeName,
          )
        )),
      );
    const colourSelect = new StringSelectMenuBuilder()
      .setCustomId("color")
      .setId(2)
      .setPlaceholder("Give it a touch of color.")
      .addOptions(
        ...(COLORS.map((v) =>
          new StringSelectMenuOptionBuilder().setLabel(v).setValue(
            v.toLowerCase(),
          )
        )),
      );
    const strengthSelect = new StringSelectMenuBuilder()
      .setCustomId("strength")
      .setId(3)
      .setPlaceholder("How strong must it be?")
      .addOptions(
        ...(STRENGTH.map((v, i) =>
          new StringSelectMenuOptionBuilder().setLabel(v).setValue(i.toString())
        )),
      );
    const deliverySelect = new StringSelectMenuBuilder()
      .setCustomId("delivery")
      .setId(4)
      .setPlaceholder("How would you like to receive the order?")
      .addOptions(
        ...(DELIVERY.map((v) =>
          new StringSelectMenuOptionBuilder().setLabel(v.description).setValue(
            v.name,
          )
        )),
      );

    const submitButton = new ButtonBuilder()
      .setLabel("Order!")
      .setEmoji("867104440342675466")
      .setCustomId("setupshop_order")
      .setStyle(ButtonStyle.Success);

    const buildMessage = ():
      & InteractionReplyOptions
      & InteractionUpdateOptions => {
      const phoneModelRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(phoneModelSelect);
      const colourRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(colourSelect);
      const strengthRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(strengthSelect);
      const deliveryRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(deliverySelect);
      const submitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        submitButton,
      );

      return {
        embeds: [embed({
          title: "Shopping",
          message: "Please configure your order.",
          kindOfEmbed: "success",
        })],
        components: [
          phoneModelRow,
          colourRow,
          strengthRow,
          deliveryRow,
          submitRow,
        ],
      };
    };
    const res = await interaction.reply({
      ...buildMessage(),
      withResponse: true,
      flags: "Ephemeral",
    });

    const selections: (string | undefined)[] = new Array(selectAmount).fill(
      undefined,
    );
    const selectCollector = res.resource?.message
      ?.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300_000, // 5 minutes
      });
    const buttonCollector = res.resource?.message
      ?.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300_000,
      });
    selectCollector?.on("collect", async (i) => {
      if (!i.component.id) {
        await i.reply({
          embeds: [embed({
            title: "Error",
            message: "Error setting the selection value.",
            kindOfEmbed: "error",
          })],
          flags: "Ephemeral",
        });

        return;
      }
      selections[+i.component.id - 1] = i.values[0];

      await i.deferReply({ flags: "Ephemeral" });
      await i.deleteReply();
    });
    buttonCollector?.on("collect", async (i) => {
      if (selections.includes(undefined)) {
        const reply = await i.reply({
          embeds: [embed({
            title: "Error",
            message: "Please select all options before ordering.",
            kindOfEmbed: "error",
          })],
          flags: "Ephemeral",
        });
        setTimeout(() => reply.delete(), 2000);
        return;
      }

      const phone = PHONES.find((v) => v.codeName == selections[0]);
      const strength = +(selections[2] ?? "0");
      const price = phone?.price[strength].toString() ?? "UNKNOWN";

      const preview = new ButtonBuilder()
        .setLabel("Preview")
        .setEmoji("👀")
        .setStyle(ButtonStyle.Link)
        .setURL(phone?.url ?? "https://jsw.tf");
      const pay = new ButtonBuilder()
        .setLabel("Pay")
        .setEmoji("💳")
        .setStyle(ButtonStyle.Link)
        .setURL(phone?.payUrl[+(selections[2] ?? "0")] ?? "https://jsw.tf");
      const confirm = new ButtonBuilder()
        .setCustomId("setupshop_confirm")
        .setEmoji("✅")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        preview,
        pay,
        confirm,
      );

      const res = await i.update({
        embeds: [embed({
          title: "Confirm order",
          message:
            `Please pay for your order and press the confirmation button afterwards (otherwise I won't receive the order). It'll cost you €${price}.`,
        })],
        components: [row],
      });

      try {
        await res.awaitMessageComponent({
          filter: (i) =>
            i.user.id == interaction.user.id &&
            i.customId == "setupshop_confirm",
          time: 240_000,
        });

        fetch(`https://ntfy.sh/${config.PHONE_SECRET}`, {
          method: "post",
          body: `USER: ${i.user.globalName} (${i.user.displayName})
SERVER: ${i.guild?.name ?? "DM"}
PHONE: ${phone?.name}
COLOR: ${selections[1]}
STRENGTH: ${STRENGTH[strength]}
PRICE: ${price}
DELIVERY: ${selections[3]}`,
        });

        res.edit({
          embeds: [embed({
            title: "Succeeded",
            message:
              "The order has been created. Sit back, relax and wait until your new phone has been printed.",
            kindOfEmbed: "success",
          })],
          components: [],
        });
      } catch {
        res.edit({
          embeds: [embed({
            title: "Error",
            message: "Timed out.",
            kindOfEmbed: "error",
          })],
          components: [],
        });
      }
    });
  },
};

export default command;
