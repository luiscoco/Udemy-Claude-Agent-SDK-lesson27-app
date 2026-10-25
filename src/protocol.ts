export type Mode =
  | "hook-deny"
  | "deny-bypass"
  | "ask-bypass"
  | "allow-rule"
  | "callback-deny"
  | "accept-edits"
  | "dont-ask";
export interface RunConfig {
  mode: Mode;
  prediction?: "execute" | "block";
}
export interface Trace {
  phase: "hook" | "callback" | "post";
  tool: string;
  decision: string;
  reason?: string;
}
export interface Evidence {
  mode: Mode;
  prediction?: string;
  predictedCorrect?: boolean;
  expectedStage: string;
  expectedOutcome: string;
  observedOutcome: string;
  fileCreated: boolean;
  fileContents: string | null;
  protectedFixtureUnchanged: boolean;
  trace: Trace[];
  completed: string[];
  callbackCalls: number;
  warningCodes: string[];
  nativeErrors: number;
}
export type LabEvent =
  | { type: "options"; config: RunConfig; options: unknown }
  | { type: "configuration"; files: { name: string; contents: string }[] }
  | { type: "initialized"; model: string; sessionId: string; tools: string[] }
  | { type: "trace"; entry: Trace }
  | { type: "message"; sdkType: string; summary: string }
  | { type: "tool"; name: string; args: unknown }
  | { type: "native-result"; name: string; isError: boolean; content: unknown }
  | { type: "warning"; code: string; explanation: string }
  | { type: "answer"; text: string }
  | { type: "result"; status: string; text: string; costUsd: number }
  | ({ type: "evidence" } & Evidence)
  | { type: "error" | "notice"; text: string };
