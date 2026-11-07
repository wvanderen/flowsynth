import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error The recording CLI helper is plain JavaScript, outside tsc's program.
import { updateReportDocument } from "./dev/update-report-document.mjs";

describe("report document publication", () => {
  it("refuses a concurrent prose edit and cleans staging and lock files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "report-update-"));
    const path = join(dir, "report.md");
    try {
      await writeFile(path, "original prose\nold figures");
      await expect(updateReportDocument(path, async () => {
        await writeFile(path, "edited prose\nold figures");
        return "original prose\nnew figures";
      })).rejects.toThrow(/Concurrent edit/);
      expect(await readFile(path, "utf8")).toBe("edited prose\nold figures");
      expect(await readdir(dir)).toEqual(["report.md"]);
      await updateReportDocument(path, (text: string) => text.replace("old figures", "new figures"));
      expect(await readFile(path, "utf8")).toBe("edited prose\nnew figures");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses another generator writer while the lock is held", async () => {
    const dir = await mkdtemp(join(tmpdir(), "report-update-"));
    const path = join(dir, "report.md");
    try {
      await writeFile(path, "original");
      await updateReportDocument(path, async () => {
        await expect(updateReportDocument(path, () => "other writer")).rejects.toThrow(/EEXIST/);
        return "first writer";
      });
      expect(await readFile(path, "utf8")).toBe("first writer");
      expect(await readdir(dir)).toEqual(["report.md"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
