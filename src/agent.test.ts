import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SCENARIOS, validateConfig, hostAllows } from "./permissions.js";
import { prepareWorkspace } from "./workspace.js";
test("requests accept only listed experiments and predictions", () => {
  assert.throws(() => validateConfig({ mode: "custom" }));
  assert.throws(() =>
    validateConfig({ mode: "hook-deny", prediction: "maybe" }),
  );
  assert.deepEqual(
    validateConfig({ mode: "allow-rule", prediction: "execute" }),
    { mode: "allow-rule", prediction: "execute" },
  );
});
test("host boundaries allow only one exact disposable operation", () => {
  const cwd = resolve("classroom");
  assert.equal(
    hostAllows(cwd, "allow-rule", "Write", {
      file_path: resolve(cwd, "result.txt"),
      content: "PERMISSION-27\n",
    }),
    true,
  );
  assert.equal(
    hostAllows(cwd, "allow-rule", "Write", {
      file_path: resolve(cwd, "../escape.txt"),
      content: "PERMISSION-27\n",
    }),
    false,
  );
  assert.equal(
    hostAllows(cwd, "deny-bypass", "Bash", {
      command: "rm -f permission-target.txt",
    }),
    true,
  );
  assert.equal(
    hostAllows(cwd, "deny-bypass", "Bash", { command: "rm -rf .." }),
    false,
  );
  assert.deepEqual(SCENARIOS["deny-bypass"].denied, ["Bash(rm *)"]);
});
test("fresh workspace evidence begins unchanged and cleanup stays inside its run", async () => {
  const a = await prepareWorkspace();
  try {
    assert.deepEqual(await a.inspect(), {
      fileCreated: false,
      fileContents: null,
      protectedFixtureUnchanged: true,
    });
  } finally {
    await a.cleanup();
  }
});
