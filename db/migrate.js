import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function getAppliedMigrations() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  const result = await client.query(
    "SELECT filename FROM _migrations ORDER BY id"
  );
  return result.rows.map((r) => r.filename);
}

function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function migrate() {
  try {
    await client.connect();

    const applied = await getAppliedMigrations();
    const files = getMigrationFiles();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    let appliedCount = 0;

    for (const file of files) {
      if (applied.includes(file)) {
        continue;
      }

      const numMatch = file.match(/^(\d+)/);
      if (!numMatch) {
        throw new Error(
          `Migration file "${file}" does not start with a numeric prefix. Aborting.`
        );
      }
      const fileNum = parseInt(numMatch[1], 10);

      const appliedNums = applied.map((f) => {
        const m = f.match(/^(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      });
      const maxApplied = Math.max(0, ...appliedNums);
      if (fileNum <= maxApplied) {
        throw new Error(
          `Out-of-order migration detected: "${file}" has number ${fileNum}, ` +
            `but migrations up to ${maxApplied} have already been applied. ` +
            `Add this migration with a higher number. Aborting.`
        );
      }

      console.log(`Applying migration: ${file}`);
      await client.query("BEGIN");

      try {
        const sql = fs.readFileSync(
          path.join(__dirname, "migrations", file),
          "utf8"
        );
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        appliedCount++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log("No new migrations.");
    } else {
      console.log(`Applied ${appliedCount} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});