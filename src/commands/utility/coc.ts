import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { InteractionReplyOptions } from "discord.js";
import { embed } from "$utils/embed.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";

const MAX_COLUMNS = 4;
const LANGUAGES = [
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
const LONGEST_LANGUAGES = ((v) => v[v.length - 1])(
  LANGUAGES.toSorted((a, b) => a.length - b.length),
);
const LOWERCASE_LANGUAGES = LANGUAGES.map((v) => v.toLowerCase());
const GAMEMODES = ["FASTEST", "SHORTEST", "REVERSE"];
const ENCODE_STRING = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ALL_GAMEMODE_COMBINATIONS: GameModes[] = [
  ...Array(1 << GAMEMODES.length).keys(),
]
  .slice(1)
  .map((i) => GAMEMODES.filter((_, j) => i & (1 << j)));

type GameModes = (typeof GAMEMODES[number])[];
type Languages = (typeof LANGUAGES[number])[];

const rateLimits: { [x: string]: number } = {};

const encodeSubset = (subset: string[], base: string[]): string =>
  subset.map((v) => ENCODE_STRING.at(base.indexOf(v))).join("");
const decodeSubset = (encodedString: string, base: string[]): Languages =>
  [...encodedString].map((encodedChar) => {
    const index = ENCODE_STRING.indexOf(encodedChar);
    if (index === -1 || index > base.length - 1) {
      console.error(
        "COC: Error while decoding. Invalid char.",
        encodedChar,
        index,
        base,
      );
      return base[0]; // COPING 101
    }
    return base[index];
  });

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

const generateTable = (columns: number, items: string[]): string => {
  const columnWidths: number[] = items.reduce(
    (reduced, current, currentIndex) => {
      const columnIndex = currentIndex % columns;
      reduced[columnIndex] = Math.max(reduced[columnIndex], current.length);
      return reduced;
    },
    new Array(columns).fill(0),
  );

  const rows: string[] = items.reduce<string[][]>(
    (reduced, current, currentIndex) => {
      if (currentIndex % columns === 0) reduced.push([]);
      reduced[reduced.length - 1].push(current);
      return reduced;
    },
    [],
  ).map((item) => {
    const paddedRow = [...item, ...Array(columns - item.length).fill('')];
    return `║ ${paddedRow.map((value, index) => value.padEnd(columnWidths[index], " ")).join(" ║ ")} ║`;
  });

  const headFootSeparator = (begin: string, separate: string, end: string) =>
    begin + columnWidths.map((width) => "═".repeat(width + 2)).join(separate) + end;

  return [
    headFootSeparator("╔", "╦", "╗"),
    ...rows,
    headFootSeparator("╚", "╩", "╝"),
  ].join("\n");
};

const clashMessage = async (
  channelID: string,
  ownerID: string,
  langs: Languages,
  modes: GameModes,
): Promise<InteractionReplyOptions> => {
  if (rateLimits[channelID] !== undefined) {
    return {
      content: "There's a ratelimit of 1min :)",
    };
  }
  rateLimits[channelID] = setTimeout(
    () => delete rateLimits[channelID],
    60_000,
  );

  const clash = await createPrivateClash(
    langs,
    modes,
  );
  if (!clash) {
    return {
      embeds: [embed({
        title: "Clash of Code - ERROR",
        message: "Something went wrong with creating the clash.",
        kindOfEmbed: "error",
      })],
      ephemeral: true,
    };
  }

  const urlButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Open")
    .setURL(`https://www.codingame.com/clashofcode/clash/${clash}`);
  const startButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Success)
    .setLabel("Start")
    .setCustomId(`${command.command.name}_start_${ownerID}_${clash}`);
  const newButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("New")
    .setCustomId(
      `${command.command.name}_restart_${encodeSubset(modes, GAMEMODES)}_${
        encodeSubset(langs, LANGUAGES)
      }`,
    );

  const bt = "```"
  return {
    embeds: [
      embed({
        kindOfEmbed: "normal",
        title: `Clash of Code - ${modes.join(" & ")}`,
        message: `
	  <@${ownerID}> is the current host, meaning only he may start the game. Anyone can open a new game though.

	  **Allowed programming languages**
	  ${bt + generateTable(3, langs) + bt} 
	  `,
      })
        .setAuthor({
          iconURL:
            "https://static.codingame.com/assets/apple-touch-icon-152x152-precomposed.300c3711.png",
          url: "https://www.codingame.com",
          name: "CodinGame",
        })
        .setColor("#f2bb13"),
    ],
    components: [new ActionRowBuilder<ButtonBuilder>()
      .addComponents(urlButton, startButton, newButton)],
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
          ALL_GAMEMODE_COMBINATIONS.flatMap((v) => ({
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
        const index = LOWERCASE_LANGUAGES.indexOf(current.toLowerCase());
        if (index !== -1) reduced.push(LANGUAGES[index]);

        return reduced;
      }, []);
    if (langInput.includes("All")) langInput = ["All"];

    interaction.reply(
      await clashMessage(
        interaction.channelId,
        interaction.user.id,
        langInput,
        modes.split(","),
      ),
    );
  },

  autocomplete: async (interaction) => {
    const focusedOption = interaction.options.getFocused(true);

    const input = focusedOption.value.split(",");
    const cInput = input[input.length - 1];
    const found = input.slice(0, -1).find((v) =>
      !LOWERCASE_LANGUAGES.some((l) => l === v)
    );

    if (found) {
      await interaction.respond([{
        name: `${found} is not a valid language.`,
        value: "",
      }]);
      return;
    }

    const resLangs = LANGUAGES
      .reduce<string[]>((reduce, current) => {
        current = current.toLowerCase();

        if (
          !input.includes(current) &&
          (cInput === "" || current.startsWith(cInput))
        ) reduce.push(current);

        return reduce;
      }, [])
      .slice(-25);

    const autocompleteRes = resLangs.map((v) => {
      v = [...input.slice(0, -1), v].join(",");
      return { name: v, value: v };
    });
    await interaction.respond(
      `${input.join(",")},${LONGEST_LANGUAGES}`.length <= 100
        ? autocompleteRes
        : [{
          name: "You've selected too many options for discord to handle.",
          value: "",
        }],
    );
  },

  button: async (interaction) => {
    const id = interaction.customId.split("_");
    const command = id[1];

    switch (command) {
      case "start": {
        if (id[2] !== interaction.user.id) {
          interaction.reply({ embeds: [accessDeniedEmbed], ephemeral: true });
          return;
        }

        const result = await startClashByHandle(id[3]);
        await interaction.reply({
          content: result
            ? "Start signal sent."
            : "Something went wrong with sending the start signal.",
          ephemeral: true,
        });
        break;
      }
      case "restart": {
        await interaction.reply(
          await clashMessage(
            interaction.channelId,
            interaction.user.id,
            decodeSubset(id[3], LANGUAGES),
            decodeSubset(id[2], GAMEMODES),
          ),
        );
        break;
      }
    }
  },
};

export default command;
