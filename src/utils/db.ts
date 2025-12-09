import { Database } from "@db/sqlite";
import { join } from "@std/path/join";
import { config } from "./config.ts";
import { addSigListener } from "./sighandler.ts";

const db = new Database(join(config.DATA_DIR, "db.db"));

const closeListener = () => {
  console.log("Closing DB");
  db.close();
};
addSigListener(closeListener);

console.log("Initialised DB");
export default db;
