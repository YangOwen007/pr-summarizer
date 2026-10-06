import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Lightweight local prevention, complemented by full-history Gitleaks in CI.
// Report only paths and rule names: never print matching credential material.
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["OpenAI token", /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["credential URL", /https?:\/\/[^\s/:]+:[^\s/@]+@/],
  ["assigned credential", /(?:OPENAI_API_KEY|ANALYSIS_ACCESS_TOKEN)\s*=\s*["']?[A-Za-z0-9_-]{24,}/],
];
const ignored = new Set([".git", "node_modules", ".next", ".vercel", "coverage", "artifacts"]);
let findings = 0;
let files = 0;
async function scan(directory, build = false) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { await scan(file, build); continue; }
    const content = await readFile(file);
    if (content.includes(0)) continue;
    files++;
    const source = content.toString("utf8");
    for (const [name, pattern] of patterns) {
      if (pattern.test(source)) { findings++; console.error(`${path.relative(process.cwd(), file)}: ${name}`); }
    }
    // Source files should be portable; generated build paths can legitimately be absolute.
    if (!build && /[A-Z]:[\\/]Users[\\/]/i.test(source)) {
      findings++; console.error(`${path.relative(process.cwd(), file)}: machine-specific user path`);
    }
    if (/^\.env(?:\.|$)/.test(entry.name) && entry.name !== ".env.example") {
      findings++; console.error(`${path.relative(process.cwd(), file)}: local environment file in scan scope`);
    }
  }
}
// git's file listing excludes ignored local credentials; still inspect all publishable source.
const { execFileSync } = await import("node:child_process");
const publishable = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of publishable) {
  const content = await readFile(file);
  if (content.includes(0)) continue;
  files++;
  const source = content.toString("utf8");
  for (const [name, pattern] of patterns) if (pattern.test(source)) { findings++; console.error(`${file}: ${name}`); }
  if (/[A-Z]:[\\/]Users[\\/]/i.test(source)) { findings++; console.error(`${file}: machine-specific user path`); }
  if (/^\.env(?:\.|$)/.test(path.basename(file)) && path.basename(file) !== ".env.example") { findings++; console.error(`${file}: environment file`); }
}
if (process.argv.includes("--build")) {
  await scan(".next/static", true);
  await scan(".next/server", true);
}
console.log(`Scanned ${files} text files; ${findings} potential sensitive artifacts. This is not proof of absence.`);
process.exitCode = findings ? 1 : 0;
