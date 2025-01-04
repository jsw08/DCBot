import { config } from "$utils/config.ts";
import { io, Socket } from "socket.io-client";
const TOKEN = config.CLASHOFCODE_KEY;
const USERID = +TOKEN.slice(0, 7);

const GAMEMODES = ["FASTEST", "SHORTEST", "REVERSE"];
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
type GameMode = (typeof LANGUAGES)[number];
type Language = (typeof LANGUAGES)[number];

type CommonClash = {
  handle: string;
  langs: Language[];
  modes: GameMode[];
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
  mode: (typeof GAMEMODES)[number];
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
    type: "PRIVATE";
    programmingLanguages: Language[];
    modes: GameMode[];
  }
  & (
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
    & (
      | {
        testSessionStatus: "COMPLETED";
        submissionId: number;
        testSessionHandle: string;
        solutionShared: boolean;
        languageId: (typeof LANGUAGES)[number];
      }
      | { testSessionStatus: "READY" }
    )
  )[];
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

export enum ClashErrorCodes {
  LobbyTimedOut,
  SocketTimedOut,
  StartError,
  SubmitError,
  ClashNotFound,
  Disconnected,
}
type Handler = (clash: Clash | ClashErrorCodes) => void;
export class Clash {
  #clash: LobbyClash | InGameClash = {
    handle: "",
    langs: [],
    modes: [],
    players: [],
    started: false,
  };
  declare public handler: Handler;

  declare private socket: Socket;
  declare private cancelClashInterval: number;
  private constructor(handler: Handler) {
    this.handler = handler;
  }

  get data() {
    return this.#clash;
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
      console.error("Coc: data.", req);
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
    this.#clash = clash;

    if (this.#clash.started && this.#clash.finished) return false;

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
      this.socket.emit("joinGroup", `clashLobby_${this.#clash.handle}`);
    });

    try {
      await socketTimeout;
    } catch {
      return true;
    }

    this.cancelClashInterval = setInterval(
      () => {
        if (this.#clash.started) clearInterval(this.cancelClashInterval);

        this.disconnect();
      },
      5 * 1000 * 60,
    );

    this.setupSocketEventHandlers();
  }

  public disconnect() {
    clearInterval(this.cancelClashInterval);
    this.socket.close();
    this.handler(ClashErrorCodes.Disconnected);
  }
  public async start(): Promise<boolean> {
    if (this.#clash.started) return false;

    const req = await codingameReq(
      "/services/ClashOfCode/startClashByHandle",
      JSON.stringify([USERID, this.#clash.handle]),
    );

    const notOk = !req.ok || req.status !== 204;
    if (notOk) console.error(`Error starting game. ${Deno.inspect(req)}`);

    return notOk;
  }
  public async submit(
    code: string,
    language?: (typeof this)["data"]["langs"][number],
  ): Promise<boolean> {
    if (language && !this.#clash.langs.includes(language)) return true;
    else language = "Ruby";

    const testSesh = await codingameReq(
      "/services/ClashOfCode/startClashTestSession",
      JSON.stringify([USERID, this.#clash.handle]),
    );
    if (notOk(testSesh)) return true;

    const testSeshHandle = (await testSesh.json()).handle;
    await codingameReq(
      "/services/TestSession/submit",
      JSON.stringify([
        testSeshHandle,
        { code, programmingLanguageId: language },
        null,
      ]),
    );
    const codeSubmit = await codingameReq(
      "/services/ClashOfCode/shareCodinGamerSolutionByHandle",
      JSON.stringify([USERID, this.#clash.handle]),
    );
    if (notOk(codeSubmit)) return true;

    return false;
  }
  public async fetch(handle?: string): Promise<this["data"] | undefined> {
    const req = await codingameReq(
      "/services/ClashOfCode/findClashByHandle",
      JSON.stringify([handle ?? this.#clash.handle]),
    );
    if (notOk(req)) return undefined;

    const clashData: FetchClashAPI = await req.json();
    const data: this["data"] = {
      handle: this.#clash.handle,
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
    if (!handle) this.#clash = data;

    return handle ? data : this.data;
  }

  private setupSocketEventHandlers() {
    let started = this.#clash.started;

    this.socket.on("clash", async (data) => {
      if (!data.status) return;

      switch (data.status) {
        case "updateCurrentClash": {
          if (!data.clashDto) {
            console.log("COC: No clashDto, ", data, this.#clash);
            return;
          }

          const clashData: UpdateClashAPI = JSON.parse(data.clashDto);
          if (
            !clashData.publicHandle ||
            clashData.publicHandle !== this.#clash.handle
          ) {
            console.log("COC: Update clash handle mismatch");
            return;
          }

          const justStarted = clashData.started &&
            !clashData.finished &&
            !started &&
            !clashData.finished;
          if (justStarted) {
            started = true;
            await this.submit(
              "// thank you :3",
              this.#clash.langs[0].includes("Ruby") ||
                this.#clash.langs.length < 1
                ? "Ruby"
                : this.#clash.langs[0],
            );
          }

          this.#clash = {
            handle: this.#clash.handle,
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
          this.handler(this);

          if (clashData.finished) this.disconnect();
          break;
        }
        case "updateClash": {
          if (!data.clashHandle || data.clashHandle !== this.#clash.handle) {
            return;
          }

          const clashData = await this.fetch();
          if (!clashData) return;
          this.handler(this);

          if (clashData.started && clashData.finished) this.disconnect();
          break;
        }
      }
    });
  }
}

//const test = await Clash.createNew(["Ruby"], ["SHORTEST"], v => console.log(typeof(v) === "number" ? v : v.data))
//console.log(test?.data)
//
//setTimeout(() => {console.log("halfway before starting")}, 10000)
//setTimeout(() => {test?.start()}, 20000)
