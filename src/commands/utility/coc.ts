import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  codeBlock,
  EmbedBuilder,
  GuildEmoji,
  SlashCommandBuilder,
  time,
  userMention,
} from "discord.js";
import { SlashCommand } from "$/commandLoader.ts";
import { config } from "$utils/config.ts";
import { embed } from "$utils/embed.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { io } from "socket.io-client";
import ms from "ms";
import { decodeSubset, encodeSubset, generateTable } from "$utils/ascii.ts";
import { ChatInputCommandInteraction } from "discord.js";
import { addSigListener } from "$utils/sighandler.ts";
import { client } from "$/main.ts";

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
const ALL_GAMEMODE_COMBINATIONS: GameModes[] = [
  ...Array(1 << GAMEMODES.length).keys(),
]
  .slice(1)
  .map((i) => GAMEMODES.filter((_, j) => i & (1 << j)));

type GameModes = (typeof GAMEMODES)[number][];
type Languages = (typeof LANGUAGES)[number][];

// Types
type CommonClash = {
  handle: string;
  langs: Languages;
  modes: GameModes;
};
type CommonPlayerClash = {
  nickname: string;
  userID: number;
};
type InGamePlayerClash = CommonPlayerClash & {
  completed: boolean;
  rank: number;
  score: number;
  duration: number | 0;
  criterion?: number;
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
      criterion?: number;
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
type ClashEventManagerCallback = (
  data: LobbyClash | InGameClash,
  newMessage?: boolean,
) => void | Promise<void>;

const activeCocHandlers: {
  [x: string]: ClashEventManagerCallback;
} = {};
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
          userID: v.codingamerId,
          rank: v.rank,
          score: v.score,
          completed: v.testSessionStatus === "COMPLETED",
          duration: v.duration,
          criterion: v.criterion,
        })),
      }
      : {
        started: false,
        players: clashData.players.map((v) => ({
          nickname: v.codingamerNickname,
          userID: v.codingamerId,
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

const clashEventManagerCloseHandler = async () => {
  for (const [handle, handler] of Object.entries(activeCocHandlers)) {
    await handler({
      handle,
      langs: [],
      modes: [],
      players: [{ nickname: "loading...", userID: 0 }],
      started: false,
    }, true);
  }
};
addSigListener(clashEventManagerCloseHandler);

const clashEventManagerCallback = (
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): ClashEventManagerCallback =>
async (updatedClash, newMessage) => {
  if (newMessage) {
    activeCocHandlers[updatedClash.handle] = () => {};

    await interaction.deleteReply();
    await interaction.followUp({
      embeds: [],
      content: "# Please update this message by pressing the button below.",
      components: [new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel("Continue")
            .setCustomId(
              `${command.command.name}_continue_${updatedClash.handle}_${interaction.user.id}`,
            ),
        )],
    });
    return;
  }

  await interaction.editReply(
    clashMessage(updatedClash, interaction.user.id),
  );
};
const clashEventManager = async (handle: string): Promise<undefined> => {
  const clash = await getClash(handle);
  if (!clash) return;
  if (!Object.hasOwn(activeCocHandlers, clash.handle)) return;
  activeCocHandlers[clash.handle](clash);

  if (clash.started && clash.finished) return;
  const newMessageInterval = setInterval(() => {
    activeCocHandlers[clash.handle](clash, true);
  }, 10 * 1000 * 60);

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

        const justStarted = clashData.started && !started &&
          !clashData.finished;
        if (justStarted) {
          started = true;
          await submitCode(
            handle,
            "// thank you :3",
            clashData.programmingLanguages[0] || "Ruby",
          );
        }

        activeCocHandlers[handle]({
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
                score: v.d,
                userID: v.id,
              })),
            }
            : {
              started: false,
              players: clashData.minifiedPlayers.map((v) => ({
                nickname: v.k,
                userID: v.id,
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

        activeCocHandlers[clashData.handle](clashData);

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

    clearInterval(newMessageInterval);

    delete activeCocHandlers[clash.handle];
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
): BaseMessageOptions => {
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

  const playerField = game.started
    ? game.players
      .sort((a, b) => a.rank - b.rank)
      .map((p) => {
        const status = p.completed
          ? (p.score === 100
            ? "<:helYea:261861228370984971>"
            : p.score > 0
            ? "<:helMeh:734272318536417280>"
            : "<:helNa:261861228542951434>")
          : "⌛";
        const stats = p.completed
          ? ` - ${ms(p.duration)} ` +
            (p.criterion ? `(${p.criterion})` : "")
          : "";
        return `${p.rank}. ${status} ${p.nickname}${stats}`;
      })
      .join("\n") + " "
    : game.players.map((p) => `- ${p.nickname}`).join("\n") + " ";

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
            ? `The game has finished.\n# ${
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
            value: playerField,
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
      ephemeral: true,
    });
    return;
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

  await interaction.reply(
    {
      ...clashMessage({
        handle: clash,
        langs,
        modes,
        players: [{ nickname: "loading...", userID: 0 }],
        started: false,
      }, interaction.user.id),
    },
  );

  activeCocHandlers[clash] = clashEventManagerCallback(interaction);
  await clashEventManager(clash);
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
    const params = interaction.customId.split("_");
    const command = params[1];

    switch (command) {
      case "start": {
        if (params[2] !== interaction.user.id) {
          interaction.reply({
            embeds: [setCodinGameStyles(accessDeniedEmbed, false)],
            ephemeral: true,
          });
          return;
        }

        const result = await startClash(params[3]);
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
      case "continue": {
        const notExist = () =>
          interaction.reply({
            embeds: [embed({
              kindOfEmbed: "error",
              title: "Clash of Code - ERROR",
              message: "This clash does not exist anymore.",
            })],
            ephemeral: true,
          });

        if (!params[3]) {
          await interaction.reply({
            embeds: [embed({
              kindOfEmbed: "error",
              title: "Clash of Code - ERROR",
              message:
                "Internal error.\n-# This button doesn't have an owner parameter.",
            })],
            ephemeral: true,
          });
        }

        const clash = await getClash(params[2]);
        if (!clash) {
          await notExist();
          console.log(clash);
          return;
        }
        console.log(clash);
        if (clash.started && clash.finished) {
          await interaction.update({
            content: "",
            ...clashMessage(clash, params[3]),
          });
          return;
        }

        await interaction.update({
          content: "",
          ...clashMessage(clash, params[3]),
        });
        activeCocHandlers[clash.handle] = clashEventManagerCallback(
          interaction,
        );

        if (!Object.hasOwn(activeCocHandlers, params[2])) {
          await clashEventManager(clash.handle);
        }
        break;
      }
      case "restart": {
        createClashManager(
          decodeSubset(params[3], LANGUAGES),
          decodeSubset(params[2], GAMEMODES),
          interaction,
        );

        break;
      }
    }
  },
};

export default command;
