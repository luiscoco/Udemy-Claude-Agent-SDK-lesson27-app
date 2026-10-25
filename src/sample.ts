import { runAgent, validateConfig } from "./agent.js";
await runAgent(validateConfig({ mode: process.argv[2] || "hook-deny" }), (e) =>
  console.log(JSON.stringify(e)),
);
