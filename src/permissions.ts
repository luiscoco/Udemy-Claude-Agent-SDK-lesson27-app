import { resolve, relative, isAbsolute } from "node:path";
import type { Mode, RunConfig } from "./protocol.js";
export const MODES: Mode[] = [
  "hook-deny",
  "deny-bypass",
  "ask-bypass",
  "allow-rule",
  "callback-deny",
  "accept-edits",
  "dont-ask",
];
export const PIPELINE = [
  "PreToolUse hooks",
  "Deny rules",
  "Ask rules",
  "Permission mode",
  "Allow rules",
  "canUseTool",
];
export const SCENARIOS: Record<
  Mode,
  {
    stage: string;
    outcome: "execute" | "block";
    mode: "default" | "bypassPermissions" | "acceptEdits" | "dontAsk";
    allowed: string[];
    denied: string[];
    ask: string[];
  }
> = {
  "hook-deny": {
    stage: "PreToolUse hook",
    outcome: "block",
    mode: "default",
    allowed: ["Write"],
    denied: [],
    ask: [],
  },
  "deny-bypass": {
    stage: "Scoped deny rule",
    outcome: "block",
    mode: "bypassPermissions",
    allowed: ["Bash(rm *)"],
    denied: ["Bash(rm *)"],
    ask: [],
  },
  "ask-bypass": {
    stage: "Ask rule → canUseTool",
    outcome: "execute",
    mode: "bypassPermissions",
    allowed: [],
    denied: [],
    ask: ["Write"],
  },
  "allow-rule": {
    stage: "Allow rule",
    outcome: "execute",
    mode: "default",
    allowed: ["Write"],
    denied: [],
    ask: [],
  },
  "callback-deny": {
    stage: "canUseTool fallback",
    outcome: "block",
    mode: "default",
    allowed: [],
    denied: [],
    ask: [],
  },
  "accept-edits": {
    stage: "acceptEdits mode",
    outcome: "execute",
    mode: "acceptEdits",
    allowed: [],
    denied: [],
    ask: [],
  },
  "dont-ask": {
    stage: "dontAsk denies unresolved call",
    outcome: "block",
    mode: "dontAsk",
    allowed: [],
    denied: [],
    ask: [],
  },
};
export function validateConfig(value: unknown): RunConfig {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !MODES.includes((value as RunConfig).mode)
  )
    throw new Error("Choose a listed permission experiment.");
  const c = value as RunConfig;
  if (
    c.prediction !== undefined &&
    !["execute", "block"].includes(c.prediction)
  )
    throw new Error("Choose execute or block for your prediction.");
  return {
    mode: c.mode,
    ...(c.prediction ? { prediction: c.prediction } : {}),
  };
}
export function inside(cwd: string, path: string) {
  const r = relative(resolve(cwd), resolve(path));
  return r !== "" && !r.startsWith("..") && !isAbsolute(r);
}
export function hostAllows(
  cwd: string,
  mode: Mode,
  name: string,
  input: Record<string, unknown>,
) {
  if (mode === "deny-bypass") {
    const target = resolve(cwd, "permission-target.txt").replaceAll("\\", "/");
    const command = String(input.command).replaceAll("\\", "/");
    return (
      name === "Bash" &&
      [
        "rm -f permission-target.txt",
        `rm -f "${target}"`,
        `rm -f '${target}'`,
        `rm -f ${target}`,
      ].includes(command)
    );
  }
  if (name !== "Write" || typeof input.file_path !== "string") return false;
  const file = resolve(cwd, input.file_path);
  return (
    inside(cwd, file) &&
    file === resolve(cwd, "result.txt") &&
    input.content === "PERMISSION-27\n"
  );
}
