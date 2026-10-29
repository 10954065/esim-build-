/**
 * Keeps a free-plan Supabase project from pausing after a week without activity. Installs a
 * pg_cron job inside the database that writes a heartbeat row every 6 hours. Safe to rerun.
 * Supabase only (local Postgres has no pg_cron), so it lives outside the Prisma migrations:
 *   DOTENV_CONFIG_PATH=.env.supabase pnpm db:keepalive           install or refresh the job
 *   DOTENV_CONFIG_PATH=.env.supabase pnpm db:keepalive status    show the latest heartbeat and runs
 */
import "dotenv/config";
import { Client } from "pg";
import { poolConfig } from "../src/server/db-config";

const JOB_NAME = "roamwell-keepalive";
const SCHEDULE = "17 */6 * * *";
const BEAT = "update keepalive.heartbeat set beat_at = now(), beats = beats + 1 where id = 1";

const INSTALL = [
  "create extension if not exists pg_cron",
  // Its own schema keeps it out of Prisma's view and away from the Data API roles.
  "create schema if not exists keepalive",
  "revoke all on schema keepalive from public",
  `create table if not exists keepalive.heartbeat (
     id smallint primary key default 1 check (id = 1),
     beat_at timestamptz not null default now(),
     beats bigint not null default 0
   )`,
  "insert into keepalive.heartbeat (id) values (1) on conflict (id) do nothing",
  // cron.schedule replaces an existing job with the same name, so reruns do not duplicate it.
  `select cron.schedule('${JOB_NAME}', '${SCHEDULE}', $$${BEAT}$$)`,
];

async function printStatus(client: Client) {
  const beat = await client.query("select beat_at, beats from keepalive.heartbeat where id = 1");
  const job = await client.query("select jobid, schedule, active from cron.job where jobname = $1", [JOB_NAME]);
  const runs = await client.query(
    `select status, start_time, return_message from cron.job_run_details
     where jobid = (select jobid from cron.job where jobname = $1) order by start_time desc limit 5`,
    [JOB_NAME],
  );
  console.info("Heartbeat:", beat.rows[0] ?? "missing");
  console.info("Job:", job.rows[0] ?? "not scheduled");
  console.info("Recent runs:", runs.rows.length ? runs.rows : "none yet");
}

async function main() {
  // DDL goes over the direct connection when one is configured, not the transaction pooler.
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  const client = new Client(poolConfig({ ...process.env, DATABASE_URL: url }));
  await client.connect();
  try {
    if (process.argv[2] !== "status") {
      for (const sql of INSTALL) await client.query(sql);
      // Prove the write works now instead of waiting for the first scheduled run.
      await client.query(BEAT);
      console.info(`Installed ${JOB_NAME} (${SCHEDULE}).`);
    }
    await printStatus(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
