import { Client, GuildEmoji } from "discord.js";

export const emojis: {[x: string]: GuildEmoji} = {}
export const setEmojis = (client: Client) => {
  for (const current of ["1324333786225184769","1324333784723750993","1324333786225184769"]) {
    const v = client.emojis.cache.get(current)
    if (!v || v === null || v.name === null) throw Error(`Couldn't find emoji: '${current}'`);

    emojis[v.name] = v;
  }
}
