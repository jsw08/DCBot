import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { embed } from "$utils/embed.ts";

const firstUpper = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);

const languages = [
  "All",
  "Bash",
  "C",
  "C#",
  "C++",
  "Clojure",
  "D",
  "Dart",
  "F#",
  "Go",
  "Groovy",
  "Haskell",
  "Java",
  "Javascript",
  "Kotlin",
  "Lua",
  "OCaml",
  "ObjectiveC",
  "PHP",
  "Pascal",
  "Perl",
  "Python3",
  "Ruby",
  "Rust",
  "Scala",
  "Swift",
  "TypeScript",
  "VB.NET",
];
type Languages = (typeof languages[number])[];

const encodeString = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const encodeLang = (langs: Languages): string =>
  langs.map((v) => encodeString.at(languages.indexOf(v))).join();
const decodeLang = (str: string): Languages =>
  [...str].map((v) => {
    const index = encodeString.indexOf(v);
    if (!index || index > languages.length - 1) {
      console.error("COC: Error while decoding. Invalid char.")
      return languages[0]
    }
    return languages[index];
  });
const validateLanguagesInput = (input: string[]): string | undefined => input.slice(0, -1).find((v) => !languages.includes(firstUpper(v)));
   

const gameModes = ["FASTEST", "SHORTEST", "REVERSE"];
type GameModes = (typeof gameModes[number])[];
const getAllGameModeCombinations = (): GameModes[] => {
  return [...Array(1 << gameModes.length).keys()]
    .slice(1)
    .map((i) => gameModes.filter((_, j) => i & (1 << j)));
};

const createPrivateClash = async (
  langs: Languages,
  gamemode: GameModes,
): Promise<string | false> => {
  const uid = config.CLASHOFCODE_KEY.substring(0, 7);
  const token = config.CLASHOFCODE_KEY;
  let publicHandle = "";

  try {
    const req = await fetch(
      "https://www.codingame.com/services/ClashOfCode/createPrivateClash",
      {
        "headers": {
          "Content-Type": "application/json;charset=utf-8",
          "Cookie": `rememberMe=${token}`,
        },
        "body": JSON.stringify([uid, langs, gamemode]),
        "method": "POST",
      },
    );
    const json = await req.json();
    publicHandle = json.publicHandle;

    if (!publicHandle) throw Error("No public handle.");
  } catch (e) {
    console.error("Coc: ", e);
    return false;
  }

  return publicHandle;
};

const startClashByHandle = async (clash: string) => {
  const uid = config.CLASHOFCODE_KEY.substring(0, 7);
  const token = config.CLASHOFCODE_KEY;

  try {
    const req = await fetch(
      "https://www.codingame.com/services/ClashOfCode/startClashByHandle",
      {
        "headers": {
          "Content-Type": "application/json;charset=utf-8",
          "Cookie": `rememberMe=${token}`,
        },
        "body": JSON.stringify([uid, clash]),
        "method": "POST",
      },
    );
    if (!req.ok) throw Error("Error starting game.");
  } catch (e) {
    console.error("Coc: ", e);
    return false;
  }
  return true;
};

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("coc")
    .setDescription("Start clash of code games from discord!")
    .addStringOption((opts) =>
      opts
        .setName("languages")
        .setDescription("The coding lanugages for the clash (comma seperated).")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((opts) =>
      opts
        .setName("gamemodes")
        .setDescription("Kind of games to play.")
        .setRequired(true)
        .setChoices(
          getAllGameModeCombinations().flatMap((v) => ({
            name: v.map((v) => v.toLowerCase()).join(" & "),
            value: JSON.stringify(v),
          })),
        )
    ),

  execute: async (interaction) => {
    let languages = [...new Set(interaction.options.getString("languages", true)
      .split(",")
      .map(firstUpper))];
    const modes = interaction.options.getString("gamemodes", true);

    if (languages.includes("All")) languages = ["All"]
    const validateLang = validateLanguagesInput(languages);
    if (validateLang) {
      interaction.reply({
        embeds: [embed({
          title: "Clash of code ERROR",
          message: "Please provide a valid language.",
          kindOfEmbed: "error",
        })],
      });
      return;
    }

    const clash = await createPrivateClash(
      languages.includes("All") ? [] : languages,
      JSON.parse(modes),
    );
    if (!clash) {
      await interaction.reply({
        content: `Something went wrong with creating a clash.`,
        ephemeral: true,
      });
      return;
    }

    const startButton = new ButtonBuilder()
      .setCustomId(`${command.command.name}_${clash}_start`)
      .setLabel("Start game")
      .setStyle(ButtonStyle.Secondary);
    const restartButton = new ButtonBuilder()
      .setCustomId(
        `${command.command.name}_${clash}_restart_${encodeLang(languages)}`,
      )
      .setLabel("Start game")
      .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
      content: `https://www.codingame.com/clashofcode/clash/${clash}`,
      components: [new ActionRowBuilder<ButtonBuilder>()
        .addComponents(startButton)],
    });
  },

  autocomplete: async (interaction) => {
    const focusedOption = interaction.options.getFocused(true);

    const input = focusedOption.value.split(",");
    const cInput = input[input.length - 1];
    const found = validateLanguagesInput(input.map(firstUpper));

    if (found) {
      await interaction.respond([{
        name: `${found} is not a valid language.`,
        value: "",
      }]);
      return;
    }

    const resLangs = languages
      .map((v) => v.toLowerCase())
      .filter(v => !input.includes(v))
      .filter((v) => cInput === "" || v.startsWith(cInput))
      .slice(-25);
    await interaction.respond(
      resLangs.map((v) => {
        v = [...input.slice(0, -1), v].join(",");
        return { name: v, value: v };
      }),
    );
  },

  button: async (interaction) => {
    const id = interaction.customId.split("_");
    const clashId = id[1];
    const command = id[2];

    switch (command) {
      case "start": {
	const result = await startClashByHandle(clashId);
	await interaction.reply({
	  content: result
	    ? "Start signal sent."
	    : "Something went wrong with sending the start signal.",
	  ephemeral: true,
	});
	break
      }
      case "restart": {
	console.log(id[3], decodeLang(id[3]))
      }
    }

  },
};

export default command;
