import { z } from "zod";

// Shared enums keep the UI, validation, and model prompt aligned on the same vocabulary.
export const severitySchema = z.enum(["high", "medium", "low"]);
export const inputModeSchema = z.enum(["diff", "snippet"]);

// Each issue is intentionally structured so the UI can explain both the risk and the next step.
export const issueSchema = z.object({
  title: z.string().min(1),
  severity: severitySchema,
  file: z.string().min(1),
  confidence: z.number().min(0).max(1),
  whyItMatters: z.string().min(1),
  suggestedFix: z.string().min(1),
});

// The PR summary mirrors how engineers usually communicate review-ready change context.
export const prSummarySchema = z.object({
  shortSummary: z.string().min(1),
  affectedAreas: z.array(z.string().min(1)),
  behavioralChanges: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  testRecommendations: z.array(z.string().min(1)),
});

// The top-level analysis object is the contract both the AI output and UI rendering depend on.
export const analysisSchema = z.object({
  overallAssessment: z.string().min(1),
  positives: z.array(z.string().min(1)),
  issues: z.array(issueSchema),
  uncertainty: z.array(z.string().min(1)),
  prSummary: prSummarySchema,
});

// Request validation is kept separate so the API can reject bad inputs before spending tokens.
export const analysisRequestSchema = z.object({
  mode: inputModeSchema,
  title: z.string().trim().max(120).optional(),
  rawInput: z
    .string()
    .trim()
    .min(40, "Paste at least 40 characters so the model has enough context to review.")
    .max(20000, "Keep the input under 20,000 characters for the MVP."),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type InputMode = z.infer<typeof inputModeSchema>;
export type Severity = z.infer<typeof severitySchema>;

// Validate model output on the server and network responses in the browser.
export const analyzeResponseSchema = z.object({
  analysis: analysisSchema,
  source: z.enum(["openai", "demo"]),
});
