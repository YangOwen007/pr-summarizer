# Security

This is a prototype for pasted-code reviews. The default deployment is a fixed sample demo. Live mode is restricted by a shared access token and modest per-process limits, not a complete account or billing system.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/YangOwen007/pr-summarizer/security/advisories/new) through the repository's Security tab. Do not include credentials, confidential code, or exploit payloads containing private data in a public issue. No response-time commitment or supported-version policy has been established.

## Credentials and input

Only server environment variables may contain the OpenAI key and review access token. Keep `.env.local` and hosting credentials out of Git. Never expose them with `NEXT_PUBLIC_`, URL parameters, screenshots, build arguments, or logs. Use HTTPS and rotate the shared access token when reviewer access should end.

Next.js also generates preview and action-signing values in `.next` server manifests. These are private runtime artifacts, not source files. Keep `.next` ignored and never serve the entire build directory as public static files; only Next.js should serve its designated browser assets.

Submitted code is data, not executed. The app does not fetch supplied URLs, access a user database, accept uploads, render raw model HTML, or invoke tools on model instructions. Those attack surfaces are absent, not independently secured features. Prompt injection and inaccurate model output remain possible.

## Checks and known dependency issue

Run `npm run scan:secrets` before publication and `npm run scan:secrets -- --build` after building. The local scanner reports paths/rules, not secret values. CI adds Gitleaks history scanning and production dependency auditing. Neither scan guarantees that sensitive material is absent.

The 2026-10-06 full npm audit retains five high-severity findings through the ESLint `braces` chain. Production dependencies passed the same-day audit after updates. See the README for the unresolved advisory and rationale for avoiding a forced downgrade. Run audits again before each release; these results are time-bound.

If a secret is discovered, revoke or rotate it externally first, remove it from files, inspect Git history and platform logs, and coordinate any history cleanup without destructive rewrites. Never claim remediation solely because the working tree no longer contains it.
