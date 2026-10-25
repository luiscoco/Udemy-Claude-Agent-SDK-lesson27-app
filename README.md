# Claude Agent SDK · Lesson 27 · How permissions are evaluated

Five linked student pages, large text, actual SDK experiments and coloured code in all thirteen UML steps.

## What you will learn

- Predict the six-stage order: Read the documented order: PreToolUse hooks, deny rules, ask rules, permission mode, allow rules and canUseTool. Some stages resolve a call before later checks. The app shows this as reference guidance, not a fabricated SDK internal trace.
- Observe hooks before later checks: A hook deny blocks the classroom Write even when Write is pre-approved. In a separate experiment, hook allow passes a bounded file-removal attempt onward but does not override its matching deny rule.
- Compare deny and ask against bypass: A scoped Bash(rm *) deny blocks the attempted disposable-fixture removal in bypassPermissions. A bare Write ask rule sends a write to the host callback even in bypass mode. The callback allows only the fixed classroom output.
- Understand callback shadowing: An allow rule or acceptEdits can approve a Write before canUseTool, so the callback count remains zero. The TypeScript SDK emits CLAUDE_SDK_CAN_USE_TOOL_SHADOWED for some configurations; acceptEdits does not trigger that construction-time warning.
- Distinguish fallback denial from dontAsk: With default mode and no matching rule, the Write reaches a callback that denies it. In dontAsk, the unresolved Write is denied without invoking the callback. Both keep the file absent, but their traces differ.
- Verify tool outcomes independently: Inspect actual PreToolUse and PostToolUse events, native tool results, callback invocations and host file checks. A denied tool may be followed by a successful final model response. A model statement alone does not prove that a file changed.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson27-app.git
cd .\Udemy-Claude-Agent-SDK-lesson27-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations use `cd .\agent-sdk\lesson27-permission-pipeline`. Open http://127.0.0.1:3127 and keep the terminal running. Node.js 24+, API credit and model access are required. Windows may require Git Bash.

## Create your .env file

Preserve an existing file. Enter your own model key, then restart. Existing shell values take precedence.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3127
# Windows if needed: CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe

```

No GitHub token or Managed Agents IDs are required. Secrets, dependencies and teaching media stay outside Git.

## Run the experiments

### Predict hook, deny and ask outcomes

Choose a mode and predict execute or block. Run the experiment and inspect actual hook decisions, callback counts and file evidence. The bypass modes are bounded classroom demonstrations.

```powershell
npm run sample:env -- hook-deny
npm run sample:env -- deny-bypass
npm run sample:env -- ask-bypass
```

### Compare automatic approval and callback fallback

Compare Allow rule with Callback deny. Both use default mode, but the allow rule resolves Write before the callback. Callback deny reaches the host fallback and leaves the file absent.

```powershell
npm run sample:env -- allow-rule
npm run sample:env -- callback-deny
```

### Compare acceptEdits with dontAsk

acceptEdits approves the classroom Write without a callback. dontAsk denies an unresolved Write without a callback. Use PostToolUse and host file checks to distinguish their outcomes.

```powershell
npm run sample:env -- accept-edits
npm run sample:env -- dont-ask
npm test
```

## How the app was built

### 1. Validate the prediction and experiment

Only fixed classroom modes and execute/block predictions are accepted. Browser input cannot supply arbitrary tool commands, paths or permission rules.

Source: `src/permissions.ts`, selected lines 88–94. Surrounding code omitted.

```typescript
export function validateConfig(value: unknown): RunConfig {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !MODES.includes((value as RunConfig).mode)
  )
```

### 2. Prepare a disposable workspace

A verified temporary run directory contains a protected fixture and an initially absent output. Agent operations do not use the lesson repository as their working directory.

Source: `src/workspace.ts`, selected lines 9–16. Surrounding code omitted.

```typescript
const root = resolve(parent, randomUUID()),
    cwd = join(root, "project"),
    home = join(root, "home"),
    sdkHome = join(root, "sdk");
  const rel = relative(parent, root);
  if (!rel || rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Invalid classroom workspace.");
  for (const dir of [cwd, home, sdkHome]) await mkdir(dir, { recursive: true });
```

### 3. Configure scoped rules and mode

Pass the chosen allow/deny rules, ask settings and permission mode into the real SDK. Bare deny names remove tools; this lesson uses a scoped Bash deny so the attempt remains observable.

Source: `src/agent.ts`, selected lines 55–61. Surrounding code omitted.

```typescript
allowedTools: s.allowed,
    disallowedTools: s.denied,
    settings: { permissions: { ask: s.ask } },
    settingSources: [],
    skills: [],
    plugins: [],
    strictMcpConfig: true,
```

### 4. Guard the exact classroom operation

The host permits only exact fixture-removal command forms or the fixed output write. This boundary narrows the teaching exercise; it is not presented as an operating-system sandbox.

Source: `src/permissions.ts`, selected lines 118–124. Surrounding code omitted.

```typescript
const target = resolve(cwd, "permission-target.txt").replaceAll("\\", "/");
    const command = String(input.command).replaceAll("\\", "/");
    return (
      name === "Bash" &&
      [
        "rm -f permission-target.txt",
        `rm -f "${target}"`,
```

### 5. Record the PreToolUse decision

The hook denies the hook experiment, allows the bounded deny-rule experiment onward, or returns no decision for the remaining allowed classroom operation.

Source: `src/agent.ts`, selected lines 92–99. Surrounding code omitted.

```typescript
const decision =
                !allowed || c.mode === "hook-deny"
                  ? "deny"
                  : c.mode === "deny-bypass"
                    ? "allow"
                    : "pass";
              record({ phase: "hook", tool: input.tool_name, decision });
              if (decision === "pass") return {};
```

### 6. Keep deny stronger than bypass

The reference configuration combines a scoped Bash deny, a matching allow and bypass mode. The live evidence must show a hook allow, no successful removal and an unchanged fixture.

Source: `src/permissions.ts`, selected lines 39–46. Surrounding code omitted.

```typescript
"deny-bypass": {
    stage: "Scoped deny rule",
    outcome: "block",
    mode: "bypassPermissions",
    allowed: ["Bash(rm *)"],
    denied: ["Bash(rm *)"],
    ask: [],
  },
```

### 7. Force the ask-rule callback

The Write ask rule routes bypass-mode Write to this host callback. Only the fixed ask-bypass operation is allowed here; unresolved calls in other modes are denied.

Source: `src/agent.ts`, selected lines 131–138. Surrounding code omitted.

```typescript
canUseTool: async (name, input) => {
      const allow =
        c.mode === "ask-bypass" &&
        hostAllows(workspace.cwd, c.mode, name, input);
      record({
        phase: "callback",
        tool: name,
        decision: allow ? "allow" : "deny",
```

### 8. Start the real model query

The host supplies one bounded task and the fresh workspace. The model must make the actual tool attempt and accept denial without another approach.

Source: `src/agent.ts`, selected lines 205–211. Surrounding code omitted.

```typescript
const run = query({
    prompt:
      PROMPTS[c.mode] +
      `\nCurrent classroom directory: ${workspace.cwd}\nAllowed output file: ${join(workspace.cwd, "result.txt")}`,
    options,
  });
  const names = new Map<string, string>();
```

### 9. Capture actual tool requests

Record real tool-use IDs, names and inputs. A tool request is an attempt, not proof that the permission pipeline allowed it to execute.

Source: `src/agent.ts`, selected lines 232–235. Surrounding code omitted.

```typescript
if (block.type === "tool_use") {
            names.set(block.id, block.name);
            emit({ type: "tool", name: block.name, args: block.input });
          }
```

### 10. Capture native denial feedback

Native tool-result errors remain visible. A permission rejection is distinct from a crashed query, and the model may still finish with a successful explanation.

Source: `src/agent.ts`, selected lines 240–246. Surrounding code omitted.

```typescript
if (block.is_error) nativeErrors++;
            emit({
              type: "native-result",
              name: names.get(block.tool_use_id) || block.tool_use_id,
              isError: Boolean(block.is_error),
              content: JSON.parse(redact(JSON.stringify(block.content))),
            });
```

### 11. Observe successful completion

PostToolUse marks successful tool completion. Compare it with callback counts to see whether an earlier permission stage approved the operation.

Source: `src/agent.ts`, selected lines 118–124. Surrounding code omitted.

```typescript
completed.push(input.tool_name);
                record({
                  phase: "post",
                  tool: input.tool_name,
                  decision: "completed",
                });
              }
```

### 12. Verify files independently

The host compares actual output content and protected fixture state before cleanup. This check does not rely on the model claiming success.

Source: `src/workspace.ts`, selected lines 32–35. Surrounding code omitted.

```typescript
fileCreated: fileContents !== null,
        fileContents,
        protectedFixtureUnchanged: fixture === FIXTURE,
      };
```

### 13. Render prediction feedback

Render the actual outcome and compare it with the student prediction. Keep reference expectations separate from recorded hook and callback events.

Source: `src/client.ts`, selected lines 63–65. Surrounding code omitted.

```typescript
$("verdict").textContent =
      `Observed: ${e.observedOutcome}. Prediction: ${e.prediction || "not provided"}. ` +
      feedback;
```

## Reference topics and limits

- Documented pipeline versus observable evidence: The six-step diagram is reference guidance. Public events expose hooks, callback invocations, native results and completion, not every internal rule comparison. Reference stage labels describe the configured experiment and do not pretend to be internal SDK telemetry.
- Ask is distinct from hook allow: A hook allow does not skip deny or ask rules. The ask experiment uses a bare Write ask rule and a programmed callback that approves only the bounded classroom output. It is not a human approval UI.
- Bare versus scoped deny: A bare disallowedTools name removes the tool definition, preventing that attempt. Bash(rm *) keeps Bash available and blocks matching commands as written. It is not a universal detector of every command spelling. The host guard independently restricts this lab to one disposable target.
- File rule details: Bare Write ask and allow entries are used here. For path-scoped rules governing built-in writes, current docs specify Edit(path), including Write and NotebookEdit. Do not assume Write(path) works the same way.
- Modes and safe built-ins: acceptEdits auto-approves eligible file operations; default can approve safe reads or read-only shell commands without a callback. allowedTools is pre-approval, not a complete tool inventory or universal whitelist. This lab narrows available tools explicitly.
- Warnings are partial diagnostics: The SDK can warn for bypass mode or bare allow entries. acceptEdits can skip the callback without that construction-time warning. Matching rules from settings may also affect execution without being visible to the warning check.
- Plan and critical-path exceptions: Plan mode routes write operations for approval regardless of allow rules. Some user-interaction tools and recognized critical-path removals are not automatically approved. This application never tests critical-path removal, production pushes or unrelated shell operations.
- Cost and isolation: Each real model query uses an SDK budget threshold of $0.25, not a prepaid cap. A fresh bounded workspace and exact operation guard constrain the demonstration; SDK permission settings alone are not an operating-system sandbox. Credentials and all teaching media remain outside Git.

## References

- [Official SDK permissions documentation](https://code.claude.com/docs/en/agent-sdk/permissions)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Regenerate student pages with `python scripts/build-pages.py`. Run `npm test` for offline boundaries, workspace and startup checks.
