import {
  ActionRowBuilder,
  BaseMessageOptions,
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
import { embed } from "$utils/embed.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { io } from "socket.io-client";
import ms from "ms";
import { decodeSubset, encodeSubset, generateTable } from "$utils/ascii.ts";
import { ChatInputCommandInteraction } from "discord.js";
import { addSigListener } from "$utils/sighandler.ts";

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

// Constants
const TOKEN = config.CLASHOFCODE_KEY;
const USERID = +TOKEN.slice(0, 7);

const MAX_COLUMNS = 4;
const LANGUAGES = [
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

export type GameModes = (typeof GAMEMODES)[number][];
export type Languages = (typeof LANGUAGES)[number][];

type ClashEventManagerHandler = (
  data:
    | ((LobbyClash | InGameClash) & { isMessage?: false })
    | (BaseMessageOptions & { isMessage: true }),
  newMessage?: boolean,
) => void | Promise<void>;

const activeClashHandlers: {
  [x: string]: ClashEventManagerHandler;
} = {}; // Callback functions that update the message with new clash info. Setting this as a global variable allows different parts of the code to access it.
const rateLimits: { [x: string]: number } = {}; // List of channel ids that are ratelimited.

// HTTP Requests and api endpoints
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
    console.error("Coc: Error creating private clash.", Deno.inspect(req));
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
    console.error(`Error starting game. ${Deno.inspect(req)}`);
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

// SocketIO Listener, and interaction timeout related code (some timeouts in the socketio handler also helps with this.)
const clashEventManagerCloseHandler = async () => {
  for (const [handle, handler] of Object.entries(activeClashHandlers)) {
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

const newMessageTimeout = (clash: LobbyClash | InGameClash) =>
  setTimeout(() => {
    try {
      activeClashHandlers[clash.handle](clash, true);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
    }
  }, 10 * 1000 * 60);

const clashEventManagerCallback = (
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): ClashEventManagerHandler =>
async (data, newMessage) => {
  if (data.isMessage) {
    interaction.editReply(data);
    return;
  }
  if (newMessage) {
    activeClashHandlers[data.handle] = () => {};

    await interaction.deleteReply();
    await interaction.followUp({
      embeds: [setCodinGameStyles(embed({
        message:
          "I'll be unable to edit this message soon, due to a [Discord limitation](<https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-callback>). Please press the button to continue showing a live-feed of the clash.",
      }))],
      components: [new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel("Continue")
            .setCustomId(
              `${command.command.name}_continue_${data.handle}_${interaction.user.id}`,
            ),
        )],
    });
    return;
  }

  await interaction.editReply(
    clashMessage(data, interaction.user.id),
  );
};
const clashEventManager = async (handle: string): Promise<undefined> => {
  const clash = await getClash(handle);
  if (!clash) return;
  if (!Object.hasOwn(activeClashHandlers, clash.handle)) return;
  activeClashHandlers[clash.handle](clash);

  if (clash.started && clash.finished) return;
  const newMessage = newMessageTimeout(clash);
  const cancelClash = setInterval(async () => {
    const clash = await getClash(handle);
    if (!clash || !activeClashHandlers[handle] || clash.started) {
      clearInterval(cancelClash);
      return;
    }
    if (clash.players.length > 1) return;

    activeClashHandlers[handle]({
      isMessage: true,
      content: "",
      components: [],
      embeds: [setCodinGameStyles(
        embed({
          kindOfEmbed: "warning",
          message: "This clash has timed out, please create a new one.",
        }),
        false,
      )],
    });
    disconnect();
  }, 5 * 1000 * 60);

  const disconnect = () => {
    clearTimeout(newMessage);
    clearTimeout(cancelClash);

    delete activeClashHandlers[clash.handle];
    socket.close();
  };
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
          console.log("COC: No clashDto, ", data, clash);
          return;
        }

        const clashData: UpdateClashAPI = JSON.parse(data.clashDto);
        if (
          !clashData.publicHandle ||
          clashData.publicHandle !== handle
        ) {
          console.log("COC: Update clash handle mismatch");
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

        activeClashHandlers[handle]({
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

        if (clashData.finished) disconnect();
        break;
      }
      case "updateClash": {
        if (!data.clashHandle || data.clashHandle !== handle) return;

        const clashData = await getClash(handle);
        if (!clashData) return;
        activeClashHandlers[clashData.handle](clashData);

        if (clashData.started && clashData.finished) disconnect();
        break;
      }
    }
  });
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
  const joinButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Join")
    .setURL(`https://www.codingame.com/clashofcode/clash/${game.handle}`)
    .setEmoji("1324822050497630313");
  const startButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Success)
    .setLabel("Start Game")
    .setCustomId(`${command.command.name}_start_${ownerID}_${game.handle}`);
  const playAgainButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("Play Again")
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
  if (!game.langs.length) game.langs.push("All");

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
        joinButton,
        ...(!game.started ? [startButton] : []),
        playAgainButton,
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

  activeClashHandlers[clash] = clashEventManagerCallback(interaction);
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

    await createClashManager(langs, modes, interaction);
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
        setTimeout(() => interaction.deleteReply(), 2000);
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
          return;
        }
        if (!clash.players.find((v) => v.userID === USERID)) {
          await interaction.update({
            content: "",
            embeds: [setCodinGameStyles(
              embed({
                kindOfEmbed: "error",
                message:
                  "Unable to manage this game anymore. I probably disconnected before the game started.",
              }),
              false,
            )],
            components: [],
          });
          return;
        }

        await interaction.update({
          content: "# Loading... 💫",
          embeds: [],
          components: [],
        }); // Sadly, update is unable to show emojis properly, kind of a hacky fix.
        await interaction.editReply({
          content: "",
          ...clashMessage(clash, params[3]),
        });
        if (clash.started && clash.finished) return;
        if (
          !clash.started ||
          clash.started &&
            (clash.endDate.getTime() - Date.now() > 10 * 1000 * 60)
        ) newMessageTimeout(clash);

        const hasEventManager = Object.hasOwn(activeClashHandlers, params[2]);
        activeClashHandlers[clash.handle] = clashEventManagerCallback(
          interaction,
        );

        if (!hasEventManager) await clashEventManager(clash.handle);
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
