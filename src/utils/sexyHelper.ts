import { type ApplicationCommandOptionChoiceData } from "discord.js";
import { join } from "@std/path/join";
import { config } from "$utils/config.ts";

export const usernameAutocomplete = async (
  amount: number,
  focusedValue: string,
): Promise<ApplicationCommandOptionChoiceData<string>[]> => {
  const files = Deno.readDir(config.DATA_DIR);
  const sexymfs: string[] = [];
  for await (const sexymf of files) {
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

export const imageFileTypes: string[] = [
  ".GIF",
  ".JPG",
  ".PNG",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
];
