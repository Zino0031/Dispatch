import fs from "node:fs";

/** Free bytes available on the filesystem containing `dir` (docs/OPERATIONS.md). */
export function freeBytes(dir: string): number {
  try {
    const st = fs.statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return 0;
  }
}
