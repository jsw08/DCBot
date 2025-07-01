import { config } from "$utils/config.ts";
import { io, Socket } from "socket.io-client";
import { initChat } from "@mumulhl/duckduckgo-ai-chat";
import { count } from "node:console";
export const TOKEN = config.CLASHOFCODE_KEY;
export const USERID = +TOKEN.slice(0, 7);

export const GAMEMODES = ["FASTEST", "SHORTEST", "REVERSE"];
export const LANGUAGES = [
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
export type GameMode = (typeof LANGUAGES)[number];
export type Language = (typeof LANGUAGES)[number];

type CommonClash = {
  handle: string;
  langs: Language[];
  modes: GameMode[];
};
export type CommonPlayerClash = {
  nickname: string;
  userID: number;
};
export type InGamePlayerClash = CommonPlayerClash & {
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
  mode: (typeof GAMEMODES)[number];
  players: InGamePlayerClash[];
};

type CommonClashAPI = {
  nbPlayersMin: number;
  nbPlayersMax: number;
  publicHandle: string;
  clashDurationTypeId: "SHORT";
  startTimestamp: number;
  finished: boolean;
  type: "PRIVATE";
  programmingLanguages: Language[];
  modes: GameMode[];
} & (
  | {
      started: true;
      mode: (typeof GAMEMODES)[number];
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
  players: ({
    codingamerId: number;
    codingamerNickname: string;
    codingamerHandle: string;
    score: number;
    duration: number;
    status: "OWNER" | "STANDARD";
    rank: number;
    position: number;
    criterion?: number;
  } & (
    | {
        testSessionStatus: "COMPLETED";
        submissionId: number;
        testSessionHandle: string;
        solutionShared: boolean;
        languageId: (typeof LANGUAGES)[number];
      }
    | { testSessionStatus: "READY" }
  ))[];
};

type CreateClashAPI = {
  clashDurationTypeId: "SHORT";
  finished: boolean;
  nbPlayersMax: number;
  nbPlayersMin: number;
  players: {
    codingamerId: number;
    codingamerNickname: string;
    duration: number;
    status: "OWNER" | "STANDARD";
  }[];
  publicHandle: string;
  started: boolean;
  startTimestamp: number;
  type: "PRIVATE";
};
type TestCase = { input: string; output: string };

const codingameReq = (file: string, body: string) =>
  fetch(new URL(file, "https://www.codingame.com").toString(), {
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Cookie: `rememberMe=${TOKEN}`,
    },
    method: "POST",
    body,
  });
const notOk = (res: Response) => !res.ok || res.status !== 200;

export enum HandlerSignals { // TODO: implement this in populate with more errors and return those instead of boolean.
  LobbyTimedOut,
  InteractionTimedOut,
  Disconnected,
  Finished,
}
export type Handler = (
  clash: Clash,
  code?: HandlerSignals,
) => Promise<void> | void;
export class Clash {
  declare private clash: LobbyClash | InGameClash;
  declare public handler: Handler;
  public receiveSignals: boolean = true;

  declare private socket: Socket;
  declare private cancelClashInterval: number;
  private constructor(handler: Handler) {
    this.handler = handler;
  }

  get data() {
    return this.clash;
  }
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
  private async runHandler(signal?: HandlerSignals) {
    if (!this.receiveSignals) return;
    await this.handler(this, signal);
  }

  public static async createNew(
    langs: Language[],
    modes: GameMode[],
    handler: Handler,
  ): Promise<Clash | undefined> {
    const that = new Clash(handler);

    const req = await codingameReq(
      "/services/ClashOfCode/createPrivateClash",
      JSON.stringify([USERID, langs, modes]),
    );
    if (notOk(req)) {
      console.error("Coc: Error creating private clash.", Deno.inspect(req));
      return;
    }

    const data: CreateClashAPI | undefined = await req.json();
    if (!data) {
      console.error("Coc: No data.", req);
      return undefined;
    }
    await that.populate({
      handle: data.publicHandle,
      langs,
      modes,
      started: false,
      players: data.players.map((v) => ({
        userID: v.codingamerId,
        nickname: v.codingamerNickname,
      })),
    });

    return that;
  }
  public static async createExisting(handle: string, handler: Handler) {
    const that = new Clash(handler);
    const clash = await that.fetch(handle);
    if (!clash) return;

    await that.populate(clash);
    return that;
  }

  private async populate(clash: LobbyClash | InGameClash) {
    this.clash = clash;

    if (this.clash.started && this.clash.finished) return false;

    let socketTimeoutResolve: (value: PromiseLike<void> | void) => void;
    const socketTimeout = new Promise<void>((resolve, reject) => {
      socketTimeoutResolve = resolve;
      setTimeout(reject, 1500);
    });

    this.socket = io("https://push-community.codingame.com", {
      withCredentials: true,
      extraHeaders: {
        Cookie: `rememberMe=${TOKEN}`,
        Origin: "https://www.codingame.com",
      },
    });
    this.socket.once("connect", () => {
      socketTimeoutResolve();
      this.socket.emit("register", USERID);
      this.socket.emit("joinGroup", `clashLobby_${this.clash.handle}`);
    });

    try {
      await socketTimeout;
    } catch {
      return true;
    }

    this.cancelClashInterval = setInterval(
      async () => {
        if (this.clash.started) clearInterval(this.cancelClashInterval);
        if (this.clash.players.length > 1) return;

        await this.disconnect(HandlerSignals.LobbyTimedOut);
      },
      5 * 1000 * 60,
    );

    this.setupSocketEventHandlers();
  }

  public async disconnect(signal?: HandlerSignals) {
    clearInterval(this.cancelClashInterval);
    await this.runHandler(signal ?? HandlerSignals.Disconnected);
    this.socket.close();
  }
  public async start(): Promise<boolean> {
    if (this.clash.started) return false;

    const req = await codingameReq(
      "/services/ClashOfCode/startClashByHandle",
      JSON.stringify([USERID, this.clash.handle]),
    );

    const notOk = !req.ok || req.status !== 204;
    if (notOk) console.error(`Error starting game. ${Deno.inspect(req)}`);

    return notOk;
  }
  public async submit(
    code:
      | string
      | ((
          question: {
            statement: string;
            stubGenerator: string;
            testCases: TestCase[];
          },
          language: (typeof this)["data"]["langs"][number],
        ) => string | Promise<string>),
    language?: (typeof this)["data"]["langs"][number],
  ): Promise<boolean> {
    if (!this.clash.started || (this.clash.started && this.clash.finished)) {
      return true;
    }
    if (language && !this.clash.langs.includes(language)) return true;
    else language = this.clash.langs[0] ?? "Ruby";

    const testSeshStart = await codingameReq(
      "/services/ClashOfCode/startClashTestSession",
      JSON.stringify([USERID, this.clash.handle]),
    );
    if (notOk(testSeshStart)) return true;
    const testSeshHandle = (await testSeshStart.json()).handle;

    let resCode = "";
    if (typeof code !== "string") {
      const testSesh = await codingameReq(
        "/services/TestSession/startTestSession",
        JSON.stringify([testSeshHandle]),
      );
      if (notOk(testSesh)) return true;

      const questionObj: {
        statement?: string;
        stubGenerator?: string;
        testCases?: { inputBinaryId: number; outputBinaryId: number }[];
      } = (await testSesh.json()).currentQuestion?.question;
      if (
        !questionObj ||
        !questionObj.statement ||
        !questionObj.stubGenerator ||
        !questionObj.testCases ||
        !(questionObj.testCases instanceof Array)
      )
        return true;

      const statement = questionObj.statement
        .replace(/<style.*?>.*?<\/style>/gs, "")
        .replace(/<[^>]+>/g, "");
      const testCases: TestCase[] = [];

      for (const i of questionObj.testCases) {
        const inputReq = await fetch(
          `https://static.codingame.com/servlet/fileservlet?id=${i.inputBinaryId}`,
        );
        const outputReq = await fetch(
          `https://static.codingame.com/servlet/fileservlet?id=${i.outputBinaryId}`,
        );

        if (notOk(inputReq) || notOk(outputReq)) continue;
        testCases.push({
          input: await inputReq.text(),
          output: await outputReq.text(),
        });
      }

      resCode = await code(
        {
          statement: statement.trim(),
          testCases,
          stubGenerator: questionObj.stubGenerator,
        },
        language,
      );
    } else {
      resCode = code;
    }

    const codeSubmit = await codingameReq(
      "/services/TestSession/submit",
      JSON.stringify([
        testSeshHandle,
        { code: resCode, programmingLanguageId: language },
        null,
      ]),
    );
    const codeShare = await codingameReq(
      "/services/ClashOfCode/shareCodinGamerSolutionByHandle",
      JSON.stringify([USERID, this.clash.handle]),
    );

    return notOk(codeSubmit) || notOk(codeShare);
  }
  async submitAI() {
    if (!this.clash.started) return;

    const chat = await this.submit(async (question, language) => {
      const prompt = `
write shortest possible code with least amount of bytes in ${language}.
Write only the code, in a markdown block. No additional text, or explainations I REPEAT, NO TALKING.
Use ${language}'s io. So for example, in ruby that'd be 'gets'/'ARGF' (ARGF IS ONLY BETTER IF YOU HANDLE MULTIPLE INPUTS). Javascript is special, use 'readline()' there.
Pay attention to the amount of input lines.
Write your code with the least amount of bytes.
The gamemode is ${
        (this.clash as InGameClash).mode
      }. In the 'reverse' gamemode, you'll have to pay a lot of attention to the tests that will come later.

The coding problem is:
${question.statement}

You can start your code with the following (pseudocode)
${question.stubGenerator}

And these are the test cases.
${question.testCases
  .slice(0, 2)
  .map((v) => `INPUT:\n${v.input}\nOUTPUT:\n${v.output}`)
  .join("\n\n")}
    `;

      const res = await fetch("https://ai.hackclub.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.status !== 200)
        return "Error while chatting with the ai. (STATUSCODE)";
      const json: { choices: { message: { content: string } }[] } =
        await res.json();

      let message = "";
      try {
        message =
          json.choices.at(0)?.message.content.trim() ??
          "Error while chatting with the ai. (UNDEFINED)";
      } catch (e) {
        if (e instanceof TypeError)
          return "Error while chatting with the ai. (INVALID OBJ)";

        console.error(e);
        return "Error, see logs.";
      }

      const msgLines = message.split("\n");
      if (msgLines[0].includes("```"))
        message = msgLines.splice(1, msgLines.length - 2).join("\n");
      console.log(message);

      return message;
    });

    return chat;
  }
  //
  public async fetch(handle?: string): Promise<this["data"] | undefined> {
    const hasHandle = handle !== undefined;
    if (!hasHandle && !this.clash.handle) return;
    if (!hasHandle) handle = this.clash.handle;

    const req = await codingameReq(
      "/services/ClashOfCode/findClashByHandle",
      JSON.stringify([handle]),
    );
    if (notOk(req)) return undefined;

    const clashData: FetchClashAPI = await req.json();
    const data: this["data"] = {
      handle: handle!,
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

    if (!hasHandle) this.clash = data;
    return data;
  }

  private setupSocketEventHandlers() {
    let started = this.clash.started;

    this.socket.on("clash", async (data) => {
      if (!data.status) return;

      switch (data.status) {
        case "updateCurrentClash": {
          if (!data.clashDto) {
            console.log("COC: No clashDto, ", data, this.clash);
            return;
          }

          const clashData: UpdateClashAPI = JSON.parse(data.clashDto);
          if (
            !clashData.publicHandle ||
            clashData.publicHandle !== this.clash.handle
          ) {
            console.log("COC: Update clash handle mismatch");
            return;
          }

          this.clash = {
            handle: this.clash.handle,
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
          };
          await this.runHandler();

          if (clashData.started && !clashData.finished && !started) {
            started = true;
            await this.submitAI();
          }
          if (clashData.finished) {
            await this.disconnect(HandlerSignals.Finished);
          }
          break;
        }
        case "updateClash": {
          if (!data.clashHandle || data.clashHandle !== this.clash.handle) {
            return;
          }

          const clashData = await this.fetch();
          if (!clashData) return;
          await this.runHandler();

          if (clashData.started && clashData.finished) {
            await this.disconnect(HandlerSignals.Finished);
          }
          break;
        }
      }
    });

    this.socket.on("disconnect", async (reason) => {
      if (reason.includes("io")) {
        await this.runHandler(HandlerSignals.Disconnected);
        return;
      }

      await this.runHandler();
    });
    this.socket.on("reconnect", async () => {
      await this.fetch();
      await this.runHandler();
    });
  }
}
