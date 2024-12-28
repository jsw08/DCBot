import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { InteractionReplyOptions } from "discord.js";
import { embed } from "$utils/embed.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { io } from "socket.io-client";

const TOKEN = config.CLASHOFCODE_KEY;
const USERID = +TOKEN.slice(0, 7);

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
  LANGUAGES.toSorted((a, b) => a.length - b.length)
);
const LOWERCASE_LANGUAGES = LANGUAGES.map((v) => v.toLowerCase());
const GAMEMODES = ["FASTEST", "SHORTEST", "REVERSE"];
const ENCODE_STRING = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ALL_GAMEMODE_COMBINATIONS: GameModes[] = [
  ...Array(1 << GAMEMODES.length).keys(),
]
  .slice(1)
  .map((i) => GAMEMODES.filter((_, j) => i & (1 << j)));

type GameModes = (typeof GAMEMODES)[number][];
type Languages = (typeof LANGUAGES)[number][];

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
        base
      );
      return base[0]; // COPING 101
    }
    return base[index];
  });

type CommonClash = {
  handle: string;
  langs: Languages;
  modes: GameModes;
  players: {
    nickname: string;
    position: number;
  }[];
};

type LobbyClash = CommonClash & {
  started: false;
};

type InGameClash = CommonClash & {
  started: true;
  finished: boolean;
  endDate: Date;
  mode: typeof GAMEMODES[number];
};

type CommonClashAPI = {
  nbPlayersMin: number;
  nbPlayersMax: number;
  publicHandle: string;
  clashDurationTypeId: "SHORT";
  startTimestamp: number;
  finished: boolean;
  programmingLanguages: Languages;
  modes: GameModes;
  type: "PRIVATE";
} & (
  | {
      started: true;
      mode: typeof GAMEMODES[number];
      msBeforeEnd: number;
    }
  | {
      started: false;
    }
);
type UpdateClashAPI = CommonClashAPI & {
  minifiedPlayers: {
    id: number; // Player ID
    k: string; // Nickname
    d: number; // score
    o: boolean; // isOnwer
    r: number; // Rank
    p: number; // position
  }[];
};
type FetchClashAPI = CommonClashAPI & {
  players: {
    codingamerId: number;
    codingamerNickname: string;
    codingamerHandle: string;
    score: number; 
    duration: number;
    status: "OWNER" | "STANDARD";
    testSessionStatus: "COMPLETED" | "READY";
    languageId: (typeof LANGUAGES)[number];
    rank: number;
    position: number;
    solutionShared: boolean;
    testSessionHandle: string;
    submissionId: number;
  }[];
};

const codingameReq = (file: string, body: string) =>
  fetch(new URL(file, "https://www.codingame.com").toString(), {
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Cookie: `rememberMe=${TOKEN}`,
    },
    method: "POST",
    body,
  });
const createPrivateClash = async (
  langs: Languages,
  gamemode: GameModes
): Promise<string | undefined> => {
  const req = await codingameReq(
    "/services/ClashOfCode/createPrivateClash",
    JSON.stringify([USERID, langs, gamemode])
  );
  if (!req.ok) {
    console.error("Coc: Error creating private clash.", req.statusText);
    return undefined;
  }
  const publicHandle = (await req.json()).publicHandle;
  if (!publicHandle) {
    console.error("Coc: No public handle.", req);
    return undefined;
  }
  return publicHandle;
};
const startClash = async (clash: string) => {
  const req = await codingameReq(
    "/services/ClashOfCode/startClashByHandle",
    JSON.stringify([USERID, clash])
  );
  if (!req.ok || req.status !== 204) {
    console.error(`Error starting game. ${JSON.stringify(req)}`);
    return false;
  }
  return true;
};
const getClash = async (handle: string): Promise<FetchClashAPI | undefined> =>
{ 
  const req = await codingameReq(
    "/services/ClashOfCode/findClashByHandle",
    JSON.stringify([handle])
  );

  return req.ok && req.status === 200 ? (await req.json()) : undefined;
 }
const submitCode = async (handle: string, code: string, language: typeof LANGUAGES[number]) => {
  const testSesh = await codingameReq("/services/ClashOfCode/startClashTestSession", JSON.stringify([USERID, handle]));
  if (!testSesh.ok || testSesh.status !== 200) return;

  const testSeshHandle = (await testSesh.json()).handle;
  await codingameReq("/services/TestSession/submit", JSON.stringify([testSeshHandle, {code, programmingLanguageId: language}, null]));
  await codingameReq("/services/ClashOfCode/shareCodinGamerSolutionByHandle", JSON.stringify([USERID, handle]));
}

const clashEventManager = async (
  handle: string,
  updateMessage: (data: LobbyClash | InGameClash) => void
): Promise<boolean> => {
  const clash = await getClash(handle);
  if (!clash || clash.finished) return false;

  const socket = io("https://push-community.codingame.com", {
    withCredentials: true,
    extraHeaders: {
      Cookie: `rememberMe=${TOKEN}`,
      Origin: "https://www.codingame.com",
    },
  });
  socket.emit("register", USERID);
  socket.emit("joinGroup", `clashLobby_${handle}`);

  let started = clash.started;
  socket.on("clash", async (data) => {
    if (!data.status) return;

    switch (data.status) {
      case "updateCurrentClash": {
        if (
          !data.clashDto
        ) {
          console.log("No clashDto");
          return;
        }

        const clashData: UpdateClashAPI = JSON.parse(data.clashDto);
        if (
          !clashData.publicHandle ||
          clashData.publicHandle !== handle
        ) {console.log("PublicHandle ain thte same"); return;}

        console.log(started, clashData.started)
        if (clashData.started && !started) {
          started = true;
          console.log("Started!!")
          setTimeout(() => {submitCode(handle, "// thank you :3", clashData.programmingLanguages[0] || "Ruby");}, 2000)
        }

        updateMessage({
          handle,
          langs: clashData.programmingLanguages,
          modes: clashData.modes,
          players: clashData.minifiedPlayers.map((v) => ({
            nickname: v.k,
            position: v.p,
          })),
          started: clashData.started,
          ...(clashData.started ? {
            finished: clashData.finished,
            endDate: new Date(Date.now() + clashData.msBeforeEnd),
            mode: clashData.mode
          } : {
            started: false
          })
        })
        break;
      }
      case "updateClash": {
        if (!data.clashHandle || data.clashHandle !== handle) return;

        const clashData = await getClash(handle);
        if (!clashData) return;

        updateMessage({
          handle,
          langs: clashData.programmingLanguages,
          modes: clashData.modes,
          players: clashData.players.map((v) => ({
            nickname: v.codingamerNickname,
            position: v.position,
          })),
          started: clashData.started,
          ...(clashData.started ? {
            finished: clashData.finished,
            endDate: new Date(Date.now() + clashData.msBeforeEnd),
            mode: clashData.mode
          } : {
            started: false
          })
        });
        break
      }
    }
  });
  socket.on("notification", (data) => {
    if (
      data.type !== "clash-over" ||
      !data.data ||
      !data.handle ||
      data.handle !== handle
    )
      return;

    socket.close();
  });

  return true;
};

const generateTable = (columns: number, items: string[]): string => {
  columns = items.length > columns ? columns : items.length;
  const columnWidths: number[] = items.reduce(
    (reduced, current, currentIndex) => {
      const columnIndex = currentIndex % columns;
      reduced[columnIndex] = Math.max(reduced[columnIndex], current.length);
      return reduced;
    },
    new Array(columns).fill(0)
  );

  const rows: string[] = items
    .reduce<string[][]>((reduced, current, currentIndex) => {
      if (currentIndex % columns === 0) reduced.push([]);
      reduced[reduced.length - 1].push(current);
      return reduced;
    }, [])
    .map((item) => {
      const paddedRow = [...item, ...Array(columns - item.length).fill("")];
      return `║ ${paddedRow
        .map((value, index) => value.padEnd(columnWidths[index], " "))
        .join(" ║ ")} ║`;
    });

  const headFootSeparator = (begin: string, separate: string, end: string) =>
    begin +
    columnWidths.map((width) => "═".repeat(width + 2)).join(separate) +
    end;

  return [
    headFootSeparator("╔", "╦", "╗"),
    ...rows,
    headFootSeparator("╚", "╩", "╝"),
  ].join("\n");
};

const setCodinGameStyles = (
  emb: EmbedBuilder,
  color?: boolean
): EmbedBuilder => {
  emb.setAuthor({
    iconURL:
      "https://static.codingame.com/assets/apple-touch-icon-152x152-precomposed.300c3711.png",
    url: "https://www.codingame.com",
    name: "CodinGame",
  });
  if (color) emb.setColor("#f2bb13");
  return emb;
};

const clashMessage = async (
  channelID: string,
  ownerID: string,
  langs: Languages,
  modes: GameModes
): Promise<[InteractionReplyOptions, string | undefined]> => {
  if (rateLimits[channelID] !== undefined) {
    return [
      {
        embeds: [
          setCodinGameStyles(
            embed({
              title: "Clash of Code - Ratelimited",
              message:
                "Hi, there's a rate-limit of 15 seconds on this command. This is to prevent button/command-spamming and getting me blocked from codingame.",
              kindOfEmbed: "error",
            }),
            false
          ),
        ],
      },
      undefined,
    ];
  }
  rateLimits[channelID] = setTimeout(
    () => delete rateLimits[channelID],
    15_000
  );

  const clash = await createPrivateClash(langs, modes);
  if (!clash) {
    return [
      {
        embeds: [
          setCodinGameStyles(
            embed({
              title: "Clash of Code - ERROR",
              message: "Something went wrong with creating the clash.",
              kindOfEmbed: "error",
            })
          ),
        ],
        ephemeral: true,
      },
      undefined,
    ];
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
      `${command.command.name}_restart_${encodeSubset(
        modes,
        GAMEMODES
      )}_${encodeSubset(langs, LANGUAGES)}`
    );

  const bt = "```";
  return [
    {
      embeds: [
        setCodinGameStyles(
          embed({
            kindOfEmbed: "normal",
            title: `Clash of Code - ${modes.join(" & ")}`,
            message: `
	  <@${ownerID}> is the current host, meaning only he may start the game. Anyone can open a new game though.

	  **Allowed programming languages**
	  ${bt + generateTable(MAX_COLUMNS, langs) + bt} 
	  `,
          }),
          true
        ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          urlButton,
          startButton,
          newButton
        ),
      ],
    },
    clash,
  ];
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
          }))
        )
    ),

  execute: async (interaction) => {
    const modes = interaction.options.getString("gamemodes", true);
    let langInput = interaction.options
      .getString("languages", true)
      .split(",")
      .reduce<Languages>((reduced, current) => {
        const index = LOWERCASE_LANGUAGES.indexOf(current.toLowerCase());
        if (index !== -1) reduced.push(LANGUAGES[index]);

        return reduced;
      }, []);
    if (langInput.includes("All")) langInput = ["All"];

    const [clashMsg, clashHandle] = await clashMessage(
      interaction.channelId,
      interaction.user.id,
      langInput,
      modes.split(",")
    );
    await interaction.reply({content: "HI", ...clashMsg});

    if (!clashHandle) return;
    await clashEventManager(clashHandle, async (data) => {
      await interaction.editReply({ content: JSON.stringify(data) });
    });
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
        !input.includes(current) &&
        (cInput === "" || current.startsWith(cInput))
      )
        reduce.push(current);

      return reduce;
    }, []).slice(-25);

    const autocompleteRes = resLangs.map((v) => {
      v = [...input.slice(0, -1), v].join(",");
      return { name: v, value: v };
    });
    await interaction.respond(
      `${input.join(",")},${LONGEST_LANGUAGES}`.length <= 100
        ? autocompleteRes
        : [
            {
              name: "You've selected too many options for discord to handle.",
              value: "",
            },
          ]
    );
  },

  button: async (interaction) => {
    const id = interaction.customId.split("_");
    const command = id[1];

    switch (command) {
      case "start": {
        if (id[2] !== interaction.user.id) {
          interaction.reply({
            embeds: [setCodinGameStyles(accessDeniedEmbed, false)],
            ephemeral: true,
          });
          return;
        }

        const result = await startClash(id[3]);
        await interaction.reply({
          embeds: [
            setCodinGameStyles(
              embed({
                title: "Clash of Code",
                message: result
                  ? "Start signal sent!"
                  : "Something went wrong while sending the start signal, did the game already start?",
                kindOfEmbed: "error",
              }),
              result
            ),
          ],
          ephemeral: true,
        });
        break;
      }
      case "restart": {
        const [replyOptions] = await clashMessage(
          interaction.channelId,
          interaction.user.id,
          decodeSubset(id[3], LANGUAGES),
          decodeSubset(id[2], GAMEMODES)
        );

        await interaction.reply(replyOptions);
        break;
      }
    }
  },
};

export default command;
