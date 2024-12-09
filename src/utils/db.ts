import { Database } from "@db/sqlite";
import { join } from "@std/path/join";
import { config } from "$utils/config.ts";

const db = new Database(join(config.DATA_DIR, "db.db"));

const closeListener = () => {
  console.log("Closing DB");
  db.close();
  Deno.exit();
};
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", closeListener);
}
Deno.addSignalListener("SIGINT", closeListener);

console.log("Initialised DB");
export default db;
