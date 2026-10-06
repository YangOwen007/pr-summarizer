import type { Analysis } from "@/lib/analysis-schema";

// The demo payload keeps the app usable without an API key while still showing the intended UX.
export const demoAnalysis: Analysis = {
  overallAssessment:
    "This sample filters revoked sessions and changes login failures. Deleting prior sessions during login may affect users on other devices; callers also need to handle the mixed failure contract.",
  positives: [
    "The session lookup now filters revoked sessions, which tightens authorization correctness.",
    "The missing-user branch returns an explicit invalid_credentials reason that callers can inspect.",
  ],
  issues: [
    {
      title: "All existing sessions are deleted on every successful login",
      severity: "medium",
      file: "src/lib/auth.ts",
      confidence: 0.95,
      whyItMatters:
        "Deleting every session on login can unexpectedly sign users out from other devices or tabs and may create a poor multi-device experience.",
      suggestedFix:
        "Decide whether single-session login is a product requirement. If not, only rotate the current session or delete expired sessions instead of clearing every session record.",
    },
    {
      title: "Error handling is now inconsistent across invalid login paths",
      severity: "medium",
      file: "src/lib/auth.ts",
      confidence: 0.87,
      whyItMatters:
        "One invalid-credential path now returns an object while another still throws, which can create branching bugs for callers that expect one behavior.",
      suggestedFix:
        "Normalize the login contract so every invalid-credential case either returns the same typed result or throws the same domain error.",
    },
  ],
  uncertainty: [
    "The review assumes multi-device sessions are supported; if single-session login is intentional, deleting prior sessions may be expected behavior.",
    "No surrounding controller or client code was provided, so caller expectations for the new login return shape are inferred rather than confirmed.",
  ],
  prSummary: {
    shortSummary:
      "Updates authentication flow to ignore revoked sessions, adds structured failure handling for unknown users, and clears existing sessions before creating a new one.",
    affectedAreas: ["Authentication service", "Session lifecycle", "Login API contract"],
    behavioralChanges: [
      "Revoked sessions are excluded during session verification.",
      "Missing-user login attempts now return a typed failure object instead of throwing.",
      "Successful login clears all prior sessions for the user before creating a new session.",
    ],
    risks: [
      "Users may be signed out from other active devices.",
      "Consumers may break if they only handle thrown errors for invalid credentials.",
    ],
    testRecommendations: [
      "Add integration tests for successful login from two devices in sequence.",
      "Assert both invalid-credential branches return or throw the same shape.",
      "Add a verification test that revoked sessions cannot authenticate.",
    ],
  },
};
