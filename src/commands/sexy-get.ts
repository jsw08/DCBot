import { ActionRowBuilder, EmbedBuilder, ButtonBuilder, SlashCommandBuilder, ButtonInteraction } from "discord.js";
import { SlashCommand } from "../commandLoader.ts";
import { ButtonStyle } from "discord.js";
import { AutocompleteInteraction } from "discord.js";
import { join } from "@std/path/join";
import { Colors } from "discord.js";
import { AttachmentBuilder } from "discord.js";

const button = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setLabel("Delete")
    .setCustomId("sexy-get_delete")
const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(button)

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("sexy-get")
    .setDescription("Grabs a sexy mother fucking picture from the server's fs.")
    .addStringOption(opt =>
      opt
	.setName("nickname") 
	.setDescription("The nickname of the sexy mf.")
	.setAutocomplete(true)
	.setRequired(true)
  )
  ,
  execute: async (interaction) => {
    const fileTypes = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
    const images: {name: string, file: AttachmentBuilder}[] = [];
    const nickname = interaction.options.getString("nickname");

    try {
      for await (const file of Deno.readDir(join(import.meta.dirname!, `../../sexy-mfs/${nickname}/`))) {
	const suffix = fileTypes.find(v => file.name.endsWith(v))
	if (!file.isFile || !suffix) return;

	const name = file.name.split(".")[0]
	const attachement = new AttachmentBuilder(join(import.meta.dirname!, `../../sexy-mfs/${nickname}/${file.name}`), {name: name})
	
	images.push({name, file: attachement});
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
      
      interaction.reply({
	embeds: [new EmbedBuilder()
	  .setColor(Colors.Red)	 
	  .setDescription("That sexy motherfucker was not found :/")
          .setFooter({text: "Brought to you by jsw's slaafje."}),
	],
	ephemeral: true
      })
      return
    }

    interaction.reply({
      embeds: [new EmbedBuilder()
	.setImage(`attachement://${images[0].name}`)
	.setTitle(images[0].name)
      ],
      files: [images[0].file],
      components: [row]
    });
	//   interaction.reply({
	//     embeds: images.map(v => (new EmbedBuilder()
	//.setImage(v.image)
	//.setTitle(v.name)
	//     )),
	//     components: [row]
	//   });
  },
  button: (interaction: ButtonInteraction) => {
    interaction.deleteReply()
  },
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const userNames: string[] = [];

    for await (const user of Deno.readDir(join(import.meta.dirname!, "../../sexy-mfs"))) {
      if (!user.isDirectory) continue;
      userNames.push(user.name)
    }
    
    interaction.respond(userNames.map(v => ({name: v, value: v})))
  }
};

export default command;
