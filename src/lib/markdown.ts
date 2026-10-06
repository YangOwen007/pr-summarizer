import type { Analysis } from "@/lib/analysis-schema";

// Export provenance so a fixed fixture cannot appear to be a live review.
export function toMarkdownReport(title: string, analysis: Analysis, source: "demo" | "openai" = "openai") {
  const issueLines = analysis.issues
    .map(
      (issue, index) =>
        [
          `${index + 1}. **${issue.title}**`,
          `Severity: ${issue.severity.toUpperCase()} | File: ${issue.file} | Confidence: ${Math.round(issue.confidence * 100)}%`,
          `${issue.whyItMatters}`,
          `Suggested fix: ${issue.suggestedFix}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    `# ${title}`,
    "",
    source === "demo" ? "> Fixed sample demo. No model call was made." : "> AI-generated review. Verify findings against the code; confidence is not calibrated.",
    "",
    "## Overall Assessment",
    analysis.overallAssessment,
    "",
    "## Key Issues",
    issueLines || "No concrete issues reported. This does not guarantee correctness.",
    "",
    "## Positives",
    ...analysis.positives.map((positive) => `- ${positive}`),
    "",
    "## Uncertainty",
    ...analysis.uncertainty.map((item) => `- ${item}`),
    "",
    "## PR Summary",
    analysis.prSummary.shortSummary,
    "",
    "### Affected Areas",
    ...analysis.prSummary.affectedAreas.map((area) => `- ${area}`),
    "",
    "### Behavioral Changes",
    ...analysis.prSummary.behavioralChanges.map((change) => `- ${change}`),
    "",
    "### Risks",
    ...analysis.prSummary.risks.map((risk) => `- ${risk}`),
    "",
    "### Test Recommendations",
    ...analysis.prSummary.testRecommendations.map((test) => `- ${test}`),
  ].join("\n");
}
