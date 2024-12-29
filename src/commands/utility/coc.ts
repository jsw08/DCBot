import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  codeBlock,
  EmbedBuilder,
  SlashCommandBuilder,
  time,
  userMention,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { InteractionReplyOptions } from "discord.js";
import { embed } from "$utils/embed.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { io } from "socket.io-client";
import { generateTable } from "$utils/ascii.ts";
import { ChatInputCommandInteraction } from "discord.js";

// Constants
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

type GameModes = (typeof GAMEMODES)[number][];
type Languages = (typeof LANGUAGES)[number][];

// Utils
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

// Types
type CommonClash = {
  handle: string;
  langs: Languages;
  modes: GameModes;
};
type CommonPlayerClash = {
  nickname: string;
};
type InGamePlayerClash = CommonPlayerClash & {
  completed: boolean;
  rank: number;
  duration: number | 0;
  criteria?: number;
};

type LobbyClash = CommonClash & {
  started: false;
  players: CommonPlayerClash[];
};

type InGameClash = CommonClash & {
  started: true;
  finished: boolean;
  endDate: Date;
  mode: typeof GAMEMODES[number];
  players: InGamePlayerClash[];
};

type CommonClashAPI =
  & {
    nbPlayersMin: number;
    nbPlayersMax: number;
    publicHandle: string;
    clashDurationTypeId: "SHORT";
    startTimestamp: number;
    finished: boolean;
    programmingLanguages: Languages;
    modes: GameModes;
    type: "PRIVATE";
  }
  & (
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
  players: (
    & {
      codingamerId: number;
      codingamerNickname: string;
      codingamerHandle: string;
      score: number;
      duration: number;
      status: "OWNER" | "STANDARD";
      rank: number;
      position: number;
      criteria?: number;
    }
    & ({
      testSessionStatus: "COMPLETED";
      submissionId: number;
      testSessionHandle: string;
      solutionShared: boolean;
      languageId: (typeof LANGUAGES)[number];
    } | { testSessionStatus: "READY" })
  )[];
};

const rateLimits: { [x: string]: number } = {};

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
  gamemode: GameModes,
): Promise<string | undefined> => {
  const req = await codingameReq(
    "/services/ClashOfCode/createPrivateClash",
    JSON.stringify([USERID, langs, gamemode]),
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
    JSON.stringify([USERID, clash]),
  );
  if (!req.ok || req.status !== 204) {
    console.error(`Error starting game. ${JSON.stringify(req)}`);
    return false;
  }
  return true;
};
const getClash = async (
  handle: string,
): Promise<LobbyClash | InGameClash | undefined> => {
  const req = await codingameReq(
    "/services/ClashOfCode/findClashByHandle",
    JSON.stringify([handle]),
  );
  if (!req.ok || req.status !== 200) return undefined;

  const clashData: FetchClashAPI = await req.json();
  return {
    handle,
    langs: clashData.programmingLanguages,
    modes: clashData.modes,
    ...(clashData.started
      ? {
        started: true,
        finished: clashData.finished,
        endDate: new Date(Date.now() + clashData.msBeforeEnd),
        mode: clashData.mode,
        players: clashData.players.map((v) => ({
          nickname: v.codingamerNickname,
          rank: v.rank,
          completed: v.testSessionStatus === "COMPLETED",
          duration: v.duration,
          criteria: v.criteria,
        })),
      }
      : {
        started: false,
        players: clashData.players.map((v) => ({
          nickname: v.codingamerNickname,
        })),
      }),
  };
};
const submitCode = async (
  handle: string,
  code: string,
  language: typeof LANGUAGES[number],
) => {
  const testSesh = await codingameReq(
    "/services/ClashOfCode/startClashTestSession",
    JSON.stringify([USERID, handle]),
  );
  if (!testSesh.ok || testSesh.status !== 200) return;

  const testSeshHandle = (await testSesh.json()).handle;
  await codingameReq(
    "/services/TestSession/submit",
    JSON.stringify([
      testSeshHandle,
      { code, programmingLanguageId: language },
      null,
    ]),
  );
  await codingameReq(
    "/services/ClashOfCode/shareCodinGamerSolutionByHandle",
    JSON.stringify([USERID, handle]),
  );
};

const clashEventManager = async (
  handle: string,
  updateMessage: (data: LobbyClash | InGameClash) => void,
): Promise<undefined> => {
  const clash = await getClash(handle);
  if (!clash) return;

  updateMessage(clash);
  if (clash.started && clash.finished) return;

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
        if (!data.clashDto) {
          console.log("No clashDto");
          return;
        }

        const clashData: UpdateClashAPI = JSON.parse(data.clashDto);
        if (
          !clashData.publicHandle ||
          clashData.publicHandle !== handle
        ) {
          console.log("Update clash handle mismatch");
          return;
        }

        if (clashData.started && !started && !clashData.finished) {
          started = true;
          submitCode(
            handle,
            "// thank you :3",
            clashData.programmingLanguages[0] || "Ruby",
          );
        }

        updateMessage({
          handle,
          langs: clashData.programmingLanguages,
          modes: clashData.modes,
          started: clashData.started,
          ...(clashData.started
            ? {
              finished: clashData.finished,
              endDate: new Date(Date.now() + clashData.msBeforeEnd),
              mode: clashData.mode,
              players: clashData.minifiedPlayers.map((v) => ({
                nickname: v.k,
                completed: false,
                duration: 0,
                rank: v.r,
              })),
            }
            : {
              started: false,
              players: clashData.minifiedPlayers.map((v) => ({
                nickname: v.k,
              })),
            }),
        });

        if (clashData.finished) socket.close();
        break;
      }
      case "updateClash": {
        if (!data.clashHandle || data.clashHandle !== handle) return;

        const clashData = await getClash(handle);
        if (!clashData) return;

        updateMessage(clashData);

        if (clashData.started && clashData.finished) socket.close();
        break;
      }
    }
  });
  socket.on("notification", (data) => {
    if (
      data.type !== "clash-over" ||
      !data.data ||
      !data.handle ||
      data.handle !== handle
    ) {
      return;
    }

    socket.close();
  });

  return;
};

const setCodinGameStyles = (
  emb: EmbedBuilder,
  color: boolean = true,
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
const clashMessage = (
  game: LobbyClash | InGameClash,
  ownerID: string,
): InteractionReplyOptions => {
  const urlButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Open")
    .setURL(`https://www.codingame.com/clashofcode/clash/${game.handle}`);
  const startButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Success)
    .setLabel("Start")
    .setCustomId(`${command.command.name}_start_${ownerID}_${game.handle}`);
  const newButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("New")
    .setCustomId(
      `${command.command.name}_restart_${
        encodeSubset(
          game.modes,
          GAMEMODES,
        )
      }_${encodeSubset(game.langs, LANGUAGES)}`,
    );

  return {
    embeds: [
      setCodinGameStyles(
        embed({
          title: `Clash of Code - ${
            !game.started ? "Lobby" : game.finished ? "Finished" : game.mode
          }`,
          message: !game.started
            ? `${
              userMention(ownerID)
            } is the host and can start the game. Others may start a new game.`
            : game.finished
            ? `The game has finished. ${
              game.players.find((v) => v.rank === 1)?.nickname
            } is the winner!`
            : `The game is currently running. Join now, before it ends!\n-# ${
              time(game.endDate, "R")
            }`,
        }),
        true,
      )
        .addFields(
          {
            name: "Programming languages",
            value: codeBlock(generateTable(MAX_COLUMNS, game.langs)),
            inline: false,
          },
          {
            name: "Players",
            value:
              (!game.started
                ? game.players.map((v) => `- ${v.nickname}`)
                : game.players.sort((a, b) => a.rank - b.rank).map((v) =>
                  `${`${v.rank}. ${v.completed ? "✅" : "⌛"} ${v.nickname} ${
                    v.completed
                      ? `- ${v.duration / 1000} ${
                        v.criteria !== undefined ? `- (${v.criteria})` : ""
                      }`
                      : ""
                  }`}`
                ))
                .join("\n") +
              " ",
            inline: true,
          },
          {
            name: "Game modes",
            value: game.modes.map((v) => `- ${v}`).join("\n") + " ",
            inline: true,
          },
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        urlButton,
        newButton,
        ...(!game.started ? [startButton] : []),
      ),
    ],
  };
};

const createClashManager = async (
  langs: Languages,
  modes: GameModes,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
) => {
  if (!interaction.channelId) {
    interaction.reply({
      embeds: [
        setCodinGameStyles(
          embed({
            title: "Clash of Code - ERROR",
            message: "This interaction is not in a channel.",
            kindOfEmbed: "error",
          }),
          false,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (rateLimits[interaction.channelId] !== undefined) {
    interaction.reply({
      embeds: [
        setCodinGameStyles(
          embed({
            title: "Clash of Code - Ratelimited",
            message:
              "Hi, there's a rate-limit of 15 seconds on this command. This is to prevent button/command-spamming and getting me blocked from codingame.",
            kindOfEmbed: "error",
          }),
          false,
        ),
      ],
    });
  }

  rateLimits[interaction.channelId] = setTimeout(
    () => {
      delete rateLimits[interaction.channelId];
    },
    15_000,
  );

  const clash = await createPrivateClash(langs, modes);
  if (!clash) {
    await interaction.reply({
      embeds: [
        setCodinGameStyles(
          embed({
            title: "Clash of Code - ERROR",
            message: "Something went wrong with creating the clash.",
            kindOfEmbed: "error",
          }),
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply(clashMessage({
    handle: clash,
    langs,
    modes,
    players: [{ nickname: "loading..." }],
    started: false,
  }, interaction.user.id));

  await clashEventManager(clash, async (data) => {
    await interaction.editReply(clashMessage(data, interaction.user.id));
  });
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
    const modes: GameModes = interaction.options.getString("gamemodes", true)
      .split(",");
    let langInput = interaction.options
      .getString("languages", true)
      .split(",")
      .reduce<Languages>((reduced, current) => {
        const index = LOWERCASE_LANGUAGES.indexOf(current.toLowerCase());
        if (index !== -1) reduced.push(LANGUAGES[index]);

        return reduced;
      }, []);
    if (langInput.includes("All")) langInput = ["All"];

    await createClashManager(langInput, modes, interaction);
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
      ) {
        reduce.push(current);
      }

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
        ],
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
              result,
            ),
          ],
          ephemeral: true,
        });
        break;
      }
      case "restart": {
        createClashManager(
          decodeSubset(id[3], LANGUAGES),
          decodeSubset(id[2], GAMEMODES),
          interaction,
        );

        break;
      }
    }
  },
};

export default command;
