import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { config } from "$utils/config.ts";
import { join } from "@std/path/join";
import { checkOrCreateDir } from "$utils/dir.ts";

export const usernameAutocomplete = async (
  amount: number,
  focusedValue: string,
): Promise<ApplicationCommandOptionChoiceData<string>[]> => {
  const files = Deno.readDir(join(config.DATA_DIR, "sexy"));
  const sexymfs: string[] = [];
  for await (const sexymf of files) {
    if (!sexymf.isDirectory) continue;
    sexymfs.push(sexymf.name);
  }

  let options: string[] = [];
  if (sexymfs.length === 0) {
    options.push("There are currently no sexy motherfuckers available");
  } else if (focusedValue === "") {
    options = sexymfs.slice(0, amount);
  } else {
    options = sexymfs.filter((v) => v.startsWith(focusedValue))
      .splice(0, amount);
  }

  return options.map((v) => ({ name: v, value: v }));
};

const upperArr = (v: string[]) => v.flatMap(v => [v, v.toUpperCase()])
const mimeMap = (extensions: string[], type: string) => extensions.map(v => `${type}/${v.replace(".", "")}`)
const imageFileTypes: string[] = upperArr([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
])
const videoFileTypes: string[] = upperArr([
  ".mp4",
  ".webm",
  ".mov"
])

export const fileTypes: string[] = [...videoFileTypes, ...imageFileTypes]
export const fileMimes: string[] = [
  ...mimeMap(imageFileTypes, "image"),
  ...mimeMap(videoFileTypes, "video")
];

export const dir = join(config.DATA_DIR, "sexy");
checkOrCreateDir(dir);
