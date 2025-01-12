import { SlashCommand } from "$/commandLoader.ts";
import {
  ActionRowBuilder,
  APIEmbedField,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  time,
  userMention,
} from "discord.js";
import {
  Clash,
  CommonPlayerClash,
  GAMEMODES,
  Handler,
  HandlerSignals,
  InGamePlayerClash,
  LANGUAGES,
  USERID,
} from "$utils/clash.ts";
import { GameModes, Languages } from "$/commands/utility/coc.ts";
import { accessDeniedEmbed } from "$utils/accessCheck.ts";
import { embed } from "$utils/embed.ts";
import { decodeSubset, encodeSubset } from "$utils/ascii.ts";
import ms from "ms";
import { addSigListener } from "$utils/sighandler.ts";
import { spreadEvenlyFields } from "$utils/formatting.ts";

const LONGEST_LANGUAGE = LANGUAGES.toSorted((a, b) => a.length - b.length).at(
  -1,
);
const LOWERCASE_LANGUAGES = LANGUAGES.map((v) => v.toLowerCase());
const ALL_GAMEMODE_COMBINATIONS: GameModes[] = [
  ...Array(1 << GAMEMODES.length).keys(),
]
  .slice(1)
  .map((i) => GAMEMODES.filter((_, j) => i & (1 << j)));

const SIGNAL_RESPONSES: { [Key in HandlerSignals]?: BaseMessageOptions } = {
  [HandlerSignals.LobbyTimedOut]: {
    embeds: [setCodinGameStyles(
      embed({
        kindOfEmbed: "warning",
        message: "This clash has timed out, please create a new one.",
      }),
      false,
    )],
  },
};

const activeClashes: { [x: string]: Clash } = {};
let rateLimits: string[] = [];

function deleteClash(handle: string): void {
  if (!Object.hasOwn(activeClashes, handle)) return;

  activeClashes[handle].handler = () => {};
  delete activeClashes[handle];
}
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
}
function clashMessage(
  clash: Clash,
  ownerID: string,
): BaseMessageOptions {
  const game = clash.data;

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

  const players = game.started
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
            (p.criterion ? `(${p.criterion} bytes)` : "")
          : "";
        return `${p.rank}\\. ${status} ${p.nickname}${stats}`;
      })
    : game.players.map((p) => `- ${p.nickname}`);
  const languages = game.langs.length === 0 ? ["All"] : game.langs; 

  const fields: APIEmbedField[] = [
    spreadEvenlyFields(
      languages.map((v) => `- ${v}`),
      "Programming languages",
    ),
    spreadEvenlyFields(
      players,
      "Players",
    ),
    [{
      name: "Game modes",
      value: game.modes.map((v) => `- ${v}`).join("\n") + " ",
      inline: true,
    }],
  ]
    .sort((a, b) => b.length - a.length)
    .flat();

  return {
    embeds: [
      setCodinGameStyles(
        embed({
          title: `Clash of Code - ${
            !game.started ? "Lobby" : game.finished ? "Finished" : game.mode
          } ${clash.connected ? "" : "- reconnecting"}`,
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
        .addFields(fields),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        joinButton,
        ...(!game.started ? [startButton] : []),
        playAgainButton,
      ),
    ],
  };
}
const clashHandlerBuilder =
  (interaction: ButtonInteraction | ChatInputCommandInteraction): Handler =>
  async (clash, code) => {
    const data = clash.data;
    const handle = data.handle;

    if (!code) {
      await interaction.editReply(clashMessage(clash, interaction.user.id));
      return;
    }

    switch (code) {
      case HandlerSignals.InteractionTimedOut: {
        await interaction.editReply({
          ...clashInteractionTimeoutMessage(interaction, clash),
        });
        break;
      }
      case HandlerSignals.Disconnected: {
        await interaction.editReply({
          embeds: [embed({})],
        });

        deleteClash(handle);
        break;
      }
      case HandlerSignals.Finished: {
	await interaction.editReply(clashMessage(clash, interaction.user.id));
	deleteClash(handle)
	break
      }
      default: {
        interaction.editReply({
          content: "",
          components: [],
          embeds: [],
          ...(Object.hasOwn(SIGNAL_RESPONSES, code)
            ? SIGNAL_RESPONSES[code]
            : {}),
        });
        break;
      }
    }
  };
const clashInteractionTimeoutMessage = ( // Interaction timeout message
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  clash: Clash,
): BaseMessageOptions => ({
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
          `${command.command.name}_continue_${clash.data.handle}_${interaction.user.id}`,
        ),
    )],
});
async function clashCreateManager( // 1. Checks for ratelimit, 2. creates an clash, 3. set's appropriate timeouts
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  langs: Languages,
  modes: GameModes,
) {
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
  if (rateLimits.includes(interaction.channelId)) {
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
  rateLimits.push(interaction.channelId);
  setTimeout(
    () => rateLimits = rateLimits.filter((v) => v !== interaction.channelId),
    15 * 1000,
  );

  const clash = await Clash.createNew(
    langs,
    modes,
    clashHandlerBuilder(interaction),
  );
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

  activeClashes[clash.data.handle] = clash;
  await interaction.reply(clashMessage(clash, interaction.user.id));

  setTimeout(() => {
    activeClashes[clash.data.handle].handler(
      clash,
      HandlerSignals.InteractionTimedOut,
    );
  }, 10 * 1000 * 60);
}

addSigListener(async () => {
  for (const clash of Object.values(activeClashes)) {
    await clash.handler(clash, HandlerSignals.InteractionTimedOut);
  }
});

const command: SlashCommand = {
  inDm: true,
  permissions: "everywhere",

  command: new SlashCommandBuilder()
    .setName("newcoc")
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
    await clashCreateManager(interaction, langs, modes);
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

        const result = Object.hasOwn(activeClashes, params[3]) &&
          await activeClashes[params[3]].start();
        await interaction.reply({
          embeds: [
            setCodinGameStyles(
              embed({
                title: "Clash of Code",
                message: !result
                  ? "Start signal sent!"
                  : "Something went wrong while sending the start signal, did the game already start?",
                kindOfEmbed: "error",
              }),
              !result,
            ),
          ],
          ephemeral: true,
        });
        setTimeout(() => interaction.deleteReply(), 5000);
        break;
      }
      case "continue": {
	await interaction.deferReply();
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
        if (!params[2]) {
          await notExist();
          return;
        }

        let clash: Clash | undefined;
        if (Object.hasOwn(activeClashes, params[2])) {
          clash = activeClashes[params[2]];
          clash.handler = clashHandlerBuilder(interaction);
        } else {
          clash = await Clash.createExisting(
            params[2],
            clashHandlerBuilder(interaction),
          );
        }
        if (!clash || !await clash.fetch()) {
          await notExist();
          return;
        }

        const me =
          (clash.data.players as (InGamePlayerClash | CommonPlayerClash)[])
            .find((v) => v.userID === USERID);
        if (!me) {
          await interaction.editReply({
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
        if (clash.data.started && !(me as InGamePlayerClash).completed) {
          console.log(await clash.submitAI())
        }
        await interaction.editReply(clashMessage(clash, params[3]));

        if (
          !clash.data.started ||
          clash.data.started &&
            !clash.data.finished &&
            (clash.data.endDate.getTime() - Date.now() > 10 * 1000 * 60)
        ) {
          setTimeout(() => {
            activeClashes[clash.data.handle].handler(
              clash,
              HandlerSignals.InteractionTimedOut,
            );
          }, 10 * 1000 * 60);
        }

        break;
      }
      case "restart": {
        await clashCreateManager(
          interaction,
          decodeSubset(params[3], LANGUAGES),
          decodeSubset(params[2], GAMEMODES),
        );
      }
    }
  },
};

export default command;
