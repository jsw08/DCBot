import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { InteractionReplyOptions } from "discord.js";

let rateLimits: {[x: string]: number} = {};

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
const longestLanguage = (v => v[v.length -1])(languages.sort((a,b) => a.length - b.length))
const lowercaseLanguages = languages.map((v) => v.toLowerCase());
type Languages = (typeof languages[number])[];

const encodeString = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const encodeSubset = (subset: string[], base: string[]): string =>
  subset.map((v) => encodeString.at(base.indexOf(v))).join("");
const decodeSubset = (encodedString: string, base: string[]): Languages =>
  [...encodedString].map((encodedChar) => {
    const index = encodeString.indexOf(encodedChar);
    if (index === -1 || index > base.length - 1) {
      console.error("COC: Error while decoding. Invalid char.", encodedChar, index, base);
      return base[0];
    }
    return base[index];
  });

const gameModes = ["FASTEST", "SHORTEST", "REVERSE"];
type GameModes = (typeof gameModes[number])[];
const allGameModeCombinations: GameModes[] = [
  ...Array(1 << gameModes.length).keys(),
]
  .slice(1)
  .map((i) => gameModes.filter((_, j) => i & (1 << j)));

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

const clashMessage = async (
  channelID: string,
  langs: Languages,
  modes: GameModes,
): Promise<InteractionReplyOptions> => {
  if (rateLimits[channelID] !== undefined) return {
    content: "There's a ratelimit of 1min :)"
  }
  rateLimits[channelID] = setTimeout(() => delete rateLimits[channelID], 60_000)
  
  const clash = await createPrivateClash(
    langs,
    modes,
  );
  if (!clash) {
    return {
      content: `Something went wrong with creating a clash.`,
      ephemeral: true,
    };
  }

  const startButton = new ButtonBuilder()
    .setCustomId(`${command.command.name}_start_${clash}`)
    .setLabel("Start game")
    .setStyle(ButtonStyle.Secondary);
  const restartButton = new ButtonBuilder()
    .setCustomId(
      `${command.command.name}_restart_${encodeSubset(modes, gameModes)}_${
        encodeSubset(langs, languages)
      }`,
    )
    .setLabel("Start game")
    .setStyle(ButtonStyle.Secondary);

  return {
    content: `https://www.codingame.com/clashofcode/clash/${clash}`,
    components: [new ActionRowBuilder<ButtonBuilder>()
      .addComponents(startButton, restartButton)],
  };
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
          allGameModeCombinations.flatMap((v) => ({
            name: v.map((v) => v.toLowerCase()).join(" & "),
            value: v.join(","),
          })),
        )
    ),

  execute: async (interaction) => {
    const modes = interaction.options.getString("gamemodes", true);
    let langInput = interaction.options.getString("languages", true)
      .split(",")
      .reduce<Languages>((reduced, current) => {
        const index = lowercaseLanguages.indexOf(current.toLowerCase());
        if (index !== -1) reduced.push(languages[index]);

        return reduced;
      }, []);
    if (langInput.includes("All")) langInput = ["All"];

    interaction.reply(await clashMessage(interaction.channelId, langInput, modes.split(",")));
  },

  autocomplete: async (interaction) => {
    const focusedOption = interaction.options.getFocused(true);

    const input = focusedOption.value.split(",");
    const cInput = input[input.length - 1];
    const found = input.slice(0, -1).find((v) => !lowercaseLanguages.some((l) => l === v));

    if (found) {
      await interaction.respond([{
        name: `${found} is not a valid language.`,
        value: "",
      }]);
      return;
    }

    const resLangs = languages
      .reduce<string[]>((reduce, current) => {
        current = current.toLowerCase();

        if (
          !input.includes(current) &&
          (cInput === "" || current.startsWith(cInput))
        ) reduce.push(current);
        //console.log(current, input, input.includes(current), (cInput === "" || current.startsWith(cInput)))
        return reduce;
      }, [])
      .slice(-25);
    const autocompleteRes = resLangs.map((v) => {
        v = [...input.slice(0, -1), v].join(",");
        return { name: v, value: v };
    })
    console.log(autocompleteRes[9], )
    await interaction.respond(
      `${input.join(",")},${longestLanguage}`.length < 100 ? autocompleteRes : [{
	name: "You've selected too many options for discord to handle.",
	value: ""
      }]
    );
  },

  button: async (interaction) => {
    const id = interaction.customId.split("_");
    const command = id[1];

    switch (command) {
      case "start": {
        const result = await startClashByHandle(id[2]);
        await interaction.reply({
          content: result
            ? "Start signal sent."
            : "Something went wrong with sending the start signal.",
          ephemeral: true,
        });
        break;
      }
      case "restart": {
        console.log(this);
        await interaction.reply(
          await clashMessage(
	    interaction.channelId,
            decodeSubset(id[3], languages),
            decodeSubset(id[2], gameModes),
          ),
        );
        break;
      }
    }
  },
};

export default command;
