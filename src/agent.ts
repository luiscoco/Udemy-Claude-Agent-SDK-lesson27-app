import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { join } from "node:path";
import {
  validateConfig,
  MODES,
  SCENARIOS,
  PIPELINE,
  hostAllows,
} from "./permissions.js";
import { prepareWorkspace } from "./workspace.js";
import type { Mode, RunConfig, LabEvent, Trace, Evidence } from "./protocol.js";
export { MODES, validateConfig };
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
export const DEFAULT_CONFIG: RunConfig = {
  mode: "hook-deny",
  prediction: "block",
};
export const PROMPTS = Object.fromEntries(
  MODES.map((mode) => [
    mode,
    mode === "deny-bypass"
      ? "Attempt Bash exactly once with command rm -f permission-target.txt in the provided current working directory. This file is a disposable classroom fixture. If denied, stop without another approach. Briefly describe the actual tool result."
      : "Attempt Write exactly once to create result.txt in the provided current working directory with content exactly PERMISSION-27 followed by a single newline. Use the absolute path supplied in the task. If denied, stop without another tool or workaround. Briefly describe the actual tool result.",
  ]),
) as Record<Mode, string>;
export function redact(text: string) {
  for (const value of [
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
  ].filter(Boolean) as string[])
    text = text.split(value).join("[REDACTED]");
  return text.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 22000);
}
export async function runAgent(
  config: RunConfig,
  emit: (e: LabEvent) => void,
  controller = new AbortController(),
) {
  const c = validateConfig(config),
    s = SCENARIOS[c.mode],
    workspace = await prepareWorkspace();
  const trace: Trace[] = [],
    completed: string[] = [],
    warningCodes: string[] = [];
  const record = (entry: Trace) => {
    trace.push(entry);
    emit({ type: "trace", entry });
  };
  let nativeErrors = 0;
  const options: Options = {
    model: MODEL,
    cwd: workspace.cwd,
    tools: c.mode === "deny-bypass" ? ["Bash"] : ["Write"],
    mcpServers: {},
    allowedTools: s.allowed,
    disallowedTools: s.denied,
    settings: { permissions: { ask: s.ask } },
    settingSources: [],
    skills: [],
    plugins: [],
    strictMcpConfig: true,
    permissionMode: s.mode,
    allowDangerouslySkipPermissions: s.mode === "bypassPermissions",
    persistSession: false,
    effort: "low",
    thinking: { type: "disabled" },
    maxTurns: 4,
    maxBudgetUsd: 0.25,
    abortController: controller,
    env: {
      ...process.env,
      HOME: workspace.home,
      USERPROFILE: workspace.home,
      CLAUDE_CONFIG_DIR: workspace.sdkHome,
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      ENABLE_CLAUDEAI_MCP_SERVERS: "false",
    },
    systemPrompt:
      "This is a bounded classroom permission experiment. Make exactly the requested tool attempt even if it may be denied. Do not anticipate the outcome, simulate calls, retry, change the command, use another path or bypass a rejection. Summarize the real tool result briefly.",
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input) => {
              if (input.hook_event_name !== "PreToolUse") return {};
              const allowed = hostAllows(
                workspace.cwd,
                c.mode,
                input.tool_name,
                input.tool_input as Record<string, unknown>,
              );
              const decision =
                !allowed || c.mode === "hook-deny"
                  ? "deny"
                  : c.mode === "deny-bypass"
                    ? "allow"
                    : "pass";
              record({ phase: "hook", tool: input.tool_name, decision });
              if (decision === "pass") return {};
              return {
                hookSpecificOutput: {
                  hookEventName: "PreToolUse",
                  permissionDecision: decision,
                  permissionDecisionReason: allowed
                    ? "Classroom hook decision; later deny/ask rules still apply."
                    : "Outside the fixed classroom operation.",
                },
              };
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            async (input) => {
              if (input.hook_event_name === "PostToolUse") {
                completed.push(input.tool_name);
                record({
                  phase: "post",
                  tool: input.tool_name,
                  decision: "completed",
                });
              }
              return {};
            },
          ],
        },
      ],
    },
    canUseTool: async (name, input) => {
      const allow =
        c.mode === "ask-bypass" &&
        hostAllows(workspace.cwd, c.mode, name, input);
      record({
        phase: "callback",
        tool: name,
        decision: allow ? "allow" : "deny",
      });
      return allow
        ? { behavior: "allow", updatedInput: input }
        : {
            behavior: "deny",
            message:
              "Classroom callback denies this request. Stop without retry or workaround.",
          };
    },
  };
  emit({
    type: "configuration",
    files: [
      {
        name: "Actual permission configuration",
        contents: JSON.stringify(
          {
            permissions: { allow: s.allowed, deny: s.denied, ask: s.ask },
            permissionMode: s.mode,
            hook:
              c.mode === "hook-deny"
                ? "deny"
                : c.mode === "deny-bypass"
                  ? "allow, subject to later rules"
                  : "pass bounded operation",
            callback:
              c.mode === "ask-bypass"
                ? "allow bounded Write"
                : "deny unresolved calls",
          },
          null,
          2,
        ),
      },
    ],
  });
  emit({
    type: "options",
    config: c,
    options: {
      model: MODEL,
      tools: options.tools,
      allowedTools: s.allowed,
      disallowedTools: s.denied,
      settings: options.settings,
      permissionMode: s.mode,
      allowDangerouslySkipPermissions: options.allowDangerouslySkipPermissions,
      referencePipeline: PIPELINE,
      expectedStage: s.stage,
      expectedOutcome: s.outcome,
      cwd: "fresh isolated classroom directory",
    },
  });
  const warningListener = (warning: Error) => {
    const code = (warning as NodeJS.ErrnoException).code;
    if (code === "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED") {
      warningCodes.push(code);
      emit({
        type: "warning",
        code,
        explanation:
          "The SDK detected configuration that can resolve permission before the callback. This does not prove a specific call executed.",
      });
    }
  };
  process.on("warning", warningListener);
  const run = query({
    prompt:
      PROMPTS[c.mode] +
      `\nCurrent classroom directory: ${workspace.cwd}\nAllowed output file: ${join(workspace.cwd, "result.txt")}`,
    options,
  });
  const names = new Map<string, string>();
  let status = "no_result";
  try {
    for await (const message of run) {
      emit({
        type: "message",
        sdkType: message.type,
        summary:
          "subtype" in message ? String(message.subtype) : "Actual SDK message",
      });
      if (message.type === "system" && message.subtype === "init")
        emit({
          type: "initialized",
          model: message.model,
          sessionId: message.session_id,
          tools: message.tools,
        });
      if (message.type === "assistant")
        for (const block of message.message.content) {
          if (block.type === "text")
            emit({ type: "answer", text: redact(block.text) });
          if (block.type === "tool_use") {
            names.set(block.id, block.name);
            emit({ type: "tool", name: block.name, args: block.input });
          }
        }
      if (message.type === "user" && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === "tool_result") {
            if (block.is_error) nativeErrors++;
            emit({
              type: "native-result",
              name: names.get(block.tool_use_id) || block.tool_use_id,
              isError: Boolean(block.is_error),
              content: JSON.parse(redact(JSON.stringify(block.content))),
            });
          }
      if (message.type === "result") {
        status =
          message.subtype === "success"
            ? message.is_error
              ? "error"
              : "success"
            : message.subtype;
        emit({
          type: "result",
          status,
          text: redact(
            message.subtype === "success"
              ? message.result
              : message.errors.join("\n"),
          ),
          costUsd: message.total_cost_usd,
        });
      }
    }
    const files = await workspace.inspect();
    const observedOutcome = completed.length > 0 ? "execute" : "block";
    const evidence: Evidence = {
      mode: c.mode,
      prediction: c.prediction,
      predictedCorrect: c.prediction
        ? c.prediction === observedOutcome
        : undefined,
      expectedStage: s.stage,
      expectedOutcome: s.outcome,
      observedOutcome,
      ...files,
      trace,
      completed,
      callbackCalls: trace.filter((e) => e.phase === "callback").length,
      warningCodes,
      nativeErrors,
    };
    emit({ type: "evidence", ...evidence });
  } finally {
    run.close();
    process.off("warning", warningListener);
    await workspace.cleanup();
  }
}
