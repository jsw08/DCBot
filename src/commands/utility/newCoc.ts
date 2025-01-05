import { SlashCommand } from "$/commandLoader.ts";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Clash, GAMEMODES, LANGUAGES } from "$utils/clash.ts";
import { GameModes, Languages } from "$/commands/utility/coc.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { embed } from "$utils/embed.ts";

const LONGEST_LANGUAGE = LANGUAGES.toSorted((a, b) => a.length - b.length).at(-1)
const LOWERCASE_LANGUAGES = LANGUAGES.map((v) => v.toLowerCase());
const ALL_GAMEMODE_COMBINATIONS: GameModes[] = [
  ...Array(1 << GAMEMODES.length).keys(),
]
  .slice(1)
  .map((i) => GAMEMODES.filter((_, j) => i & (1 << j)));

const activeClashes: {[x: string]: Clash} = {}

function setCodinGameStyles(
  emb: EmbedBuilder,
  color: boolean = true,
): EmbedBuilder {
  emb.setAuthor({
    iconURL:
      "https://static.codingame.com/assets/apple-touch-icon-152x152-precomposed.300c3711.png",
    url: "https://www.codingame.com",
    name: "CodinGame",
  });
  if (color) emb.setColor("#f2bb13");
  return emb;
};

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("coc")
    .setDescription("Start clash of code games from discord!")
    .addStringOption((opts) =>
      opts
        .setName("gamemodes")
        .setDescription("Kind of games to play. Defaults to SHORTEST.")
        .setChoices(
          ALL_GAMEMODE_COMBINATIONS.flatMap((v) => ({
            name: v.map((v) => v.toLowerCase()).join(" & "),
            value: v.join(","),
          })),
        )
    )
    .addStringOption((opts) =>
      opts
        .setName("languages")
        .setDescription(
          "Coding languages for the clash (comma-separated). Leave blank for all.",
        )
        .setAutocomplete(true)
    ),

  execute: async (interaction) => {
    const modes: GameModes =
      interaction.options.getString("gamemodes")?.split(",") ?? ["SHORTEST"];
    const langs: Languages =
      interaction.options.getString("languages")?.split(",")
        .reduce<Languages>((reduced, current) => {
          const index = LOWERCASE_LANGUAGES.indexOf(current.toLowerCase());
          if (index !== -1) reduced.push(LANGUAGES[index]);

          return reduced;
        }, []) ?? [];

    const clash = await Clash.createNew(langs, modes, () => {})
    if (!clash) {

      return
    }
    activeClashes[clash.data.handle] = clash;
  },

  autocomplete: async (interaction) => {
    const focusedOption = interaction.options.getFocused(true);

    const input = focusedOption.value.split(",");
    const cInput = input[input.length - 1];
    const found = input
      .slice(0, -1)
      .find((v) => !LOWERCASE_LANGUAGES.some((l) => l === v));

    if (found) {
      await interaction.respond([
        {
          name: `${found} is not a valid language.`,
          value: "",
        },
      ]);
      return;
    }

    const resLangs = LANGUAGES.reduce<string[]>((reduce, current) => {
      current = current.toLowerCase();

      if (
        !input.slice(0, -1).includes(current) &&
        (cInput === "" || current.startsWith(cInput))
      ) {
        reduce.push(current);
      }
      if (reduce.length === 1) reduce.push(reduce[0] + ",");

      return reduce;
    }, []).slice(-25);

    const autocompleteRes = resLangs.map((v) => {
      v = [...input.slice(0, -1), v].join(",");
      return { name: v, value: v };
    });
    await interaction.respond(
      `${input.join(",")},${LONGEST_LANGUAGE}`.length <= 100
        ? autocompleteRes
        : [
          {
            name: "You've selected too many options for discord to handle.",
            value: "",
          },
        ],
    );
  },

	// button: async (interaction) => {
	//   const params = interaction.customId.split("_");
	//   const command = params[1];
	//
	//   switch (command) {
	//     case "start": {
	//       if (params[2] !== interaction.user.id) {
	//         interaction.reply({
	//           embeds: [setCodinGameStyles(accessDeniedEmbed, false)],
	//           ephemeral: true,
	//         });
	//         return;
	//       }
	//
	//       //const result = await startClash(params[3]); FIXME:
	//const result = true;
	//       await interaction.reply({
	//         embeds: [
	//           setCodinGameStyles(
	//             embed({
	//               title: "Clash of Code",
	//               message: result
	//                 ? "Start signal sent!"
	//                 : "Something went wrong while sending the start signal, did the game already start?",
	//               kindOfEmbed: "error",
	//             }),
	//             result,
	//           ),
	//         ],
	//         ephemeral: true,
	//       });
	//       setTimeout(() => interaction.deleteReply(), 2000);
	//       break;
	//     }
	//     case "continue": {
	//       const notExist = () =>
	//         interaction.reply({
	//           embeds: [embed({
	//             kindOfEmbed: "error",
	//             title: "Clash of Code - ERROR",
	//             message: "This clash does not exist anymore.",
	//           })],
	//           ephemeral: true,
	//         });
	//
	//       if (!params[3]) {
	//         await interaction.reply({
	//           embeds: [embed({
	//             kindOfEmbed: "error",
	//             title: "Clash of Code - ERROR",
	//             message:
	//               "Internal error.\n-# This button doesn't have an owner parameter.",
	//           })],
	//           ephemeral: true,
	//         });
	//       }
	//
	//       const clash = await getClash(params[2]);
	//       if (!clash) {
	//         await notExist();
	//         return;
	//       }
	//       if (!clash.players.find((v) => v.userID === USERID)) {
	//         await interaction.update({
	//           content: "",
	//           embeds: [setCodinGameStyles(
	//             embed({
	//               kindOfEmbed: "error",
	//               message:
	//                 "Unable to manage this game anymore. I probably disconnected before the game started.",
	//             }),
	//             false,
	//           )],
	//           components: [],
	//         });
	//         return;
	//       }
	//
	//       await interaction.update({
	//         content: "# Loading... 💫",
	//         embeds: [],
	//         components: [],
	//       }); // Sadly, update is unable to show emojis properly, kind of a hacky fix.
	//       await interaction.editReply({
	//         content: "",
	//         ...clashMessage(clash, params[3]),
	//       });
	//       if (clash.started && clash.finished) return;
	//       if (
	//         !clash.started ||
	//         clash.started &&
	//           (clash.endDate.getTime() - Date.now() > 10 * 1000 * 60)
	//       ) newMessageTimeout(clash);
	//
	//       const hasEventManager = Object.hasOwn(activeClashHandlers, params[2]);
	//       activeClashHandlers[clash.handle] = clashEventManagerCallback(
	//         interaction,
	//       );
	//
	//       if (!hasEventManager) await clashEventManager(clash.handle);
	//       break;
	//     }
	//     case "restart": {
	//       createClashManager(
	//         decodeSubset(params[3], LANGUAGES),
	//         decodeSubset(params[2], GAMEMODES),
	//         interaction,
	//       );
	//
	//       break;
	//     }
	//   }
	// },
};

export default command;
