// Serialize generator writers and refuse publication when the document
// changed while rendering/staging. This is optimistic concurrency with
// ordinary editors (which do not participate in the generator lock).
import { open, readFile, rename, unlink } from "node:fs/promises";

export async function updateReportDocument(path, transform) {
  const lockPath = `${path}.figures.lock`;
  const lock = await open(lockPath, "wx");
  const staging = `${path}.figures-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
  try {
    const original = await readFile(path, "utf8");
    const updated = await transform(original);
    if (updated === original) return;
    const handle = await open(staging, "wx");
    try {
      await handle.writeFile(updated, "utf8");
    } finally {
      await handle.close();
    }
    if (await readFile(path, "utf8") !== original) {
      throw new Error(`Concurrent edit to ${path}; refusing to replace it. Retry regeneration after the edit is complete.`);
    }
    await rename(staging, path);
  } finally {
    await unlink(staging).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await lock.close();
    await unlink(lockPath);
  }
}
