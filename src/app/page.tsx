"use client";

import { useEffect, useState } from "react";

import { analyzeResponseSchema, analysisRequestSchema, type Analysis, type InputMode, type Severity } from "@/lib/analysis-schema";
import { sampleDiff } from "@/lib/sample-input";
import { toMarkdownReport } from "@/lib/markdown";

type AnalyzeResponse = {
  analysis: Analysis;
  source: "openai" | "demo";
  title: string;
  mode: InputMode;
};

const severityClasses: Record<Severity, string> = {
  high: "bg-[rgba(185,28,28,0.12)] text-[var(--danger)]",
  medium: "bg-[rgba(217,119,6,0.14)] text-[var(--warning)]",
  low: "bg-[rgba(31,122,92,0.14)] text-[var(--success)]",
};

// This single-page workbench is deliberate for the MVP: fast to demo, easy to explain, and simple to extend.
export default function Home() {
  const [mode, setMode] = useState<InputMode>("diff");
  const [title, setTitle] = useState("Session management cleanup");
  const [rawInput, setRawInput] = useState(sampleDiff);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [deploymentMode, setDeploymentMode] = useState<"demo" | "live" | null>(null);

  // Discover runtime mode without putting server secrets in the client bundle.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Server configuration is incomplete.");
        const health = await response.json();
        if (health.mode !== "demo" && health.mode !== "live") throw new Error("Unable to determine deployment mode.");
        setDeploymentMode(health.mode);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, []);

  // Export the submitted snapshot, not fields edited after the request.
  const markdownReport = result ? toMarkdownReport(result.title, result.analysis, result.source) : "";

  async function handleAnalyze() {
    const input = analysisRequestSchema.safeParse({ mode, title, rawInput });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setIsSubmitting(true);
    setError(null);
    setCopied(false);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(input.data),
        signal: AbortSignal.timeout(60_000),
      });

      const data = (await response.json()) as AnalyzeResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to analyze the pasted input.");
      }

      const validated = analyzeResponseSchema.parse(data);
      setResult({ ...validated, title: validated.source === "demo" ? "Session management cleanup (sample)" : input.data.title || "PR Review Report", mode: input.data.mode });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while generating the review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopySummary() {
    if (!result) {
      return;
    }

    try {
      const summary = result.source === "demo" ? `Fixed sample demo: ${result.analysis.prSummary.shortSummary}` : result.analysis.prSummary.shortSummary;
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch { setError("Clipboard access failed. You can download the report instead."); }
  }

  function handleDownload() {
    if (!markdownReport) {
      return;
    }

    const blob = new Blob([markdownReport], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pr-review-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="grid-lines min-h-screen px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass-panel overflow-hidden rounded-[32px] border px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                PR Summarizer
              </p>
              <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
                Structured AI code reviews for diffs and snippets.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                Paste a diff or code snippet for a structured review with severity,
                reasoning, suggested fixes, and a concise PR summary.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Input" value="Diff / Snippet" />
              <MetricCard label="Output" value="Review + PR Summary" />
              <MetricCard label="Context" value="Uncertainty Included" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel rounded-[28px] border p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                  Review Workbench
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {deploymentMode === "demo" ? "Fixed sample demo: no model is called. Load the sample diff to view its prepared report." : deploymentMode === "live" ? "Live reviews send your input to OpenAI. Remove secrets and confidential code before submitting." : "Checking deployment mode..."}
                </p>
              </div>

              <div className="inline-flex rounded-full bg-[rgba(20,33,61,0.06)] p-1">
                {(["diff", "snippet"] as InputMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    disabled={isSubmitting}
                    onClick={() => setMode(option)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                      mode === option
                        ? "bg-[var(--foreground)] text-white"
                        : "text-[var(--ink-soft)]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Change title</span>
                <input
                  value={title}
                  maxLength={120}
                  disabled={isSubmitting}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Short label for the review run"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <label htmlFor="raw-input">Raw input</label>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => { setRawInput(sampleDiff); setMode("diff"); setTitle("Session management cleanup"); setResult(null); setError(null); }}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]"
                  >
                    Load sample
                  </button>
                </div>
                <textarea
                  id="raw-input"
                  wrap="off"
                  value={rawInput}
                  maxLength={20000}
                  disabled={isSubmitting}
                  onChange={(event) => setRawInput(event.target.value)}
                  placeholder="Paste a git diff, patch, or code snippet here..."
                  className="min-h-[400px] rounded-[24px] border border-[var(--border)] bg-[#fffdf9] px-4 py-4 font-mono text-sm leading-6 outline-none transition focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              {deploymentMode === "live" ? (
                <label className="grid gap-2 text-sm font-semibold">
                  Review access token
                  <input type="password" autoComplete="off" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} disabled={isSubmitting} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3" />
                  <span className="font-normal text-[var(--ink-soft)]">Ask the deployment owner for access. The token stays in memory for this page session.</span>
                </label>
              ) : null}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isSubmitting || deploymentMode === null}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Analyzing..." : "Generate structured review"}
              </button>
              <p className="text-sm text-[var(--ink-soft)]">
                The app clearly labels uncertainty and should be treated as an assistant, not a
                guaranteed static analyzer.
              </p>
            </div>

            {error ? (
              <div role="alert" className="mt-4 rounded-2xl border border-[rgba(185,28,28,0.18)] bg-[rgba(185,28,28,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>

          <div aria-live="polite" aria-busy={isSubmitting} className="glass-panel min-w-0 break-words rounded-[28px] border p-5 sm:p-6">
            {result ? (
              <div className="flex h-full flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                      Analysis Output
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                      {result.analysis.prSummary.shortSummary}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Pill>{result.source === "demo" ? "Fixed sample demo" : "Live model"}</Pill>
                    <Pill>{result.mode === "diff" ? "Diff review" : "Snippet review"}</Pill>
                  </div>
                </div>

                <section className="rounded-[24px] bg-[var(--panel-strong)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                    Overall assessment
                  </p>
                  <p className="mt-3 text-sm leading-7">{result.analysis.overallAssessment}</p>
                </section>

                <section className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">
                      Key issues
                    </h3>
                    <span className="text-sm text-[var(--ink-soft)]">
                      {result.analysis.issues.length} findings
                    </span>
                  </div>

                  {result.analysis.issues.map((issue) => (
                    <article
                      key={`${issue.file}-${issue.title}`}
                      className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-base font-semibold">{issue.title}</h4>
                          <p className="mt-1 text-sm text-[var(--ink-soft)]">{issue.file}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${severityClasses[issue.severity]}`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6">{issue.whyItMatters}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                        <strong className="text-[var(--foreground)]">Suggested fix:</strong>{" "}
                        {issue.suggestedFix}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                        Model confidence estimate {Math.round(issue.confidence * 100)}% (not calibrated)
                      </p>
                    </article>
                  ))}
                  {result.analysis.issues.length === 0 ? <p className="text-sm">No concrete issues reported. This does not guarantee correctness.</p> : null}
                </section>

                <section className="grid gap-4 rounded-[24px] bg-[var(--panel-strong)] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ListBlock title="Positives" items={result.analysis.positives} />
                    <ListBlock title="Uncertainty" items={result.analysis.uncertainty} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ListBlock title="Affected Areas" items={result.analysis.prSummary.affectedAreas} />
                    <ListBlock
                      title="Behavioral Changes"
                      items={result.analysis.prSummary.behavioralChanges}
                    />
                    <ListBlock title="Risks" items={result.analysis.prSummary.risks} />
                    <ListBlock
                      title="Test Recommendations"
                      items={result.analysis.prSummary.testRecommendations}
                    />
                  </div>
                </section>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
                  >
                    {copied ? "Summary copied" : "Copy PR summary"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
                  >
                    Download markdown report
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[520px] flex-col justify-between rounded-[24px] bg-[var(--panel-strong)] p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                    Output Preview
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
                    Review results will appear here.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-soft)]">
                    Generate a review to see findings, a change summary, and suggested tests.
                    Findings depend on supplied context and need human verification.
                  </p>
                </div>

                <div className="grid gap-3">
                  <PreviewCard title="Code Review" body="Overall assessment, concrete issues, severity, reasoning, and fix direction." />
                  <PreviewCard title="PR Summary" body="Short summary, affected areas, behavioral changes, risks, and test recommendations." />
                  <PreviewCard title="Context" body="Specific positives and missing context that may affect the review." />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[rgba(255,255,255,0.55)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold">{value}</p>
    </div>
  );
}

function PreviewCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white px-4 py-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{body}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[rgba(20,33,61,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">
      {children}
    </span>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-[var(--ink-soft)]">None reported.</p> : null}
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--ink-soft)]">
        {items.map((item) => (
          <li key={item} className="rounded-2xl bg-white px-3 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
