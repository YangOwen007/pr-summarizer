import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { readFile } from "node:fs/promises";

// Exercise the built server, not the development compiler; use no external credentials.
async function run(mode, check) {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, USE_DEMO_ANALYSIS: mode, OPENAI_API_KEY: "", ANALYSIS_ACCESS_TOKEN: "", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "ignore", windowsHide: true,
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) throw new Error("Production server exited before startup.");
      try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Production server must start within 15 seconds");
    await check(base);
  } finally {
    child.kill();
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); });
  }
}
const post = (base, body, extra = {}) => fetch(`${base}/api/analyze`, {
  method: "POST", headers: { "Content-Type": "application/json", ...extra }, body,
});
await run("true", async (base) => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, "demo");
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.match(await page.text(), /PR Summarizer/);
  assert.equal((await post(base, "{")).status, 400);
  const unrelated = await post(base, JSON.stringify({ mode: "snippet", rawInput: "x".repeat(80) }));
  assert.equal(unrelated.status, 422);
  assert.equal((await post(base, JSON.stringify("x".repeat(100001)))).status, 413);
  // Load the actual exported fixture through its source instead of duplicating sample code.
  const source = await readFile("src/lib/sample-input.ts", "utf8");
  const sampleDiff = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));
  const review = await post(base, JSON.stringify({ mode: "diff", rawInput: sampleDiff }));
  assert.equal(review.status, 200);
  assert.equal((await review.json()).source, "demo");
  console.log("Production smoke: page, headers, health, sample, validation and body cap passed.");
});
await run("false", async (base) => {
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  assert.equal((await post(base, "{}")).status, 503);
  console.log("Production smoke: incomplete live configuration fails closed.");
});
