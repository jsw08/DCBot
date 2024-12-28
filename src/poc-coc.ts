import { config } from "$utils/config.ts";
import {io} from "socket.io-client"

const TOKEN = config.CLASHOFCODE_KEY;
const USERID = +TOKEN.slice(0,7)

const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const codingameReq = (file: string, body: string) => fetch(
  new URL(file, "https://www.codingame.com").toString(),
  {
    "headers": {
      "Content-Type": "application/json;charset=utf-8",
      "Cookie": `rememberMe=${config.CLASHOFCODE_KEY}`,
    },
    "method": "POST",
    body,
  }
)

const socket = io("https://push-community.codingame.com", {withCredentials: true, extraHeaders: {
  "Cookie": `rememberMe=${config.CLASHOFCODE_KEY}`,
  "Origin": "https://www.codingame.com",
}})

socket.on("connect", async () => {
  socket.emit("register", USERID)

  const create = await codingameReq("/services/ClashOfCode/createPrivateClash", JSON.stringify( [ USERID, [ "Ruby" ], [ "SHORTEST" ] ] ))
  
  const handle = ( await create.json() ).publicHandle
  socket.emit("joinGroup", `clashLobby_as;dlkfj;asflkdj`)
  console.log(`https://www.codingame.com/clashofcode/clash/${ handle }`)

  await sleep(20000)

  await codingameReq("services/ClashOfCode/startClashByHandle", JSON.stringify([USERID, handle]))

  console.log("Started")
});


let started = false;
socket.on("clash", e => {
  console.log(e)
  if (e.status !== "updateCurrentClash" || !e.clashDto) return

  const clashInfo = JSON.parse(e.clashDto)
  if (clashInfo.started && !started) {
    started = true
    console.log("Starting!!!")
  }
  console.log(clashInfo)
})

