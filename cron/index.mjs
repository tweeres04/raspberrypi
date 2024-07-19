import { readFileSync } from "node:fs";
import { entries } from "../db/schema";

const sqlite = new Database("/app/database.db");
const db = drizzle(sqlite, { logger: true });

for (let i = 0; i < 10; i++) {
  try {
    const data = readFileSync("/app/in_temp_input", "utf8");

    const lines = data.split("\n");
    const firstLine = lines[0];
    const temp = Number(firstLine) / 1000;

    const dbEntry = {
      timestamp: new Date().toISOString(),
      value: temp,
    };
    db.insert(entries)
      .values()
      .then(() => {
        console.log(`Inserted ${temp} at ${timestamp}`);
      });
    break;
  } catch (err) {
    if (err.code !== "EIO") {
      console.error(err);
    }
  }
}
