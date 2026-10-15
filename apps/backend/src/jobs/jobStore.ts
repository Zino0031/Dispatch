import type { JobRepository } from "./types.js";
import { memoryJobs } from "./memoryJobStore.js";
import { SupabaseJobs } from "./supabaseJobStore.js";
import { getSupabase } from "../supabase.js";

export type { HistoryEntry, JobInput, JobRepository, PrintJobRecord } from "./types.js";

let repo: JobRepository | null = null;
let warned = false;

/** Supabase/Postgres when configured, else ephemeral memory (issue #9). */
export function getJobs(): JobRepository {
  if (repo) return repo;
  const sb = getSupabase();
  if (sb) {
    repo = new SupabaseJobs(sb);
  } else {
    if (!warned) {
      warned = true;
      // eslint-disable-next-line no-console
      console.log("jobs: SUPABASE not configured — ephemeral in-memory store (no SLA)");
    }
    repo = memoryJobs;
  }
  return repo;
}
