export const checkOrCreateDir = async (dir: string): Promise<void> => {
  try {
    const tdir = await Deno.lstat(dir);
    if (!tdir.isDirectory) {
      throw Error("Thing exists but isn't a directory." + JSON.stringify(tdir));
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
    await Deno.mkdir(dir);
  }
};
