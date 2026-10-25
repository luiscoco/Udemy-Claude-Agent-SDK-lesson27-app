import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
export const FIXTURE = "Protected classroom fixture · PERMISSION-27\n";
export async function prepareWorkspace() {
  const parent = resolve(realpathSync.native(tmpdir()), "claude-sdk27");
  const root = resolve(parent, randomUUID()),
    cwd = join(root, "project"),
    home = join(root, "home"),
    sdkHome = join(root, "sdk");
  const rel = relative(parent, root);
  if (!rel || rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Invalid classroom workspace.");
  for (const dir of [cwd, home, sdkHome]) await mkdir(dir, { recursive: true });
  await writeFile(join(cwd, "permission-target.txt"), FIXTURE, "utf-8");
  return {
    cwd,
    home,
    sdkHome,
    async inspect() {
      let fileContents: string | null = null,
        fixture: string | null = null;
      try {
        fileContents = await readFile(join(cwd, "result.txt"), "utf-8");
      } catch {}
      try {
        fixture = await readFile(join(cwd, "permission-target.txt"), "utf-8");
      } catch {}
      return {
        fileCreated: fileContents !== null,
        fileContents,
        protectedFixtureUnchanged: fixture === FIXTURE,
      };
    },
    async cleanup() {
      const resolved = resolve(root),
        r = relative(parent, resolved);
      if (!r || r.startsWith("..") || isAbsolute(r))
        throw new Error("Refusing cleanup outside this run.");
      await rm(resolved, { recursive: true, force: true });
    },
  };
}
