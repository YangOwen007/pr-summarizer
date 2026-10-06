// Live mode is opt-in: a stray API key must never enable paid public requests.
export function getServerConfig(env: Record<string, string | undefined> = process.env) {
  const demo = env.USE_DEMO_ANALYSIS !== "false";
  const apiKey = env.OPENAI_API_KEY?.trim();
  const accessToken = env.ANALYSIS_ACCESS_TOKEN?.trim();
  const validFlag = !env.USE_DEMO_ANALYSIS || ["true", "false"].includes(env.USE_DEMO_ANALYSIS);
  const ready = validFlag && (demo || Boolean(apiKey && accessToken && accessToken.length >= 32));
  return { demo, apiKey, accessToken, ready, model: env.OPENAI_MODEL?.trim() || "gpt-4.1-mini" };
}
