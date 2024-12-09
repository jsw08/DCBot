import { Database } from "@db/sqlite";
import { join } from "@std/path/join";
import { config } from "$utils/config.ts";

const db = new Database(join(config.DATA_DIR, "db.db"));

db.sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      lastfm_username TEXT NOT NULL
    )
`
console.log("Ran db code.")

const closeListener = () => {
  console.log("Closing DB");
  db.close()
  Deno.exit();
}
if (Deno.build.os !== "windows") Deno.addSignalListener("SIGTERM", closeListener);
Deno.addSignalListener("SIGINT", closeListener);

export default db

