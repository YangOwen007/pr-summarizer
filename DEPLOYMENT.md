# Deployment guide

## Supported runtime

Node.js 24.x and npm 11.x. This is a Next.js server application, not a static export. Build with `npm ci` followed by `npm run build`; start with `npm start`. The lockfile fixes dependency resolution, but AI responses and generated build IDs are not byte-for-byte deterministic. Fonts use local fallbacks; builds do not fetch external font assets.

No database, migration, seed, object storage, or background worker is required. Model access is optional; use the default sample demo for public evaluation.

## Vercel (intended managed target)

1. Publish the repository, sign in to a Vercel account, and import it as a Next.js project.
2. Select Node.js 24.x. Set install command `npm ci` and build command `npm run build`; leave the Next.js output setting at its platform default.
3. For a demo, set `USE_DEMO_ANALYSIS=true`. Leave API credentials unset.
4. For live mode, set `USE_DEMO_ANALYSIS=false`, `OPENAI_API_KEY`, and a random `ANALYSIS_ACCESS_TOKEN` of at least 32 characters. Optional: `OPENAI_MODEL`. Keep these values server-side and separate across Preview and Production. Use a separate restricted provider project/key for previews or keep previews in demo mode.
5. Deploy and perform the checks below. The analyze route declares a 60-second maximum duration; confirm the account supports that duration. Share the live access token only with trusted reviewers.

No Vercel account, hosted URL, or domain has been configured by this repository. Platform quotas and model billing depend on the owner's accounts. [Vercel's Next.js documentation](https://vercel.com/docs/frameworks/full-stack/nextjs) describes the managed integration.

## Existing Node server

```sh
npm ci
npm run check
npm audit --omit=dev --audit-level=high
npm start -- --hostname 127.0.0.1 --port 3000
```

Supply environment variables through your process manager or a private `.env.local` file. Bind to localhost behind an HTTPS reverse proxy; configure request body and time limits at the proxy as well. `npm start -- --hostname 0.0.0.0 --port 3000` is available when a container/platform requires it, but it must sit behind the platform's network and TLS controls.

Use a process manager to restart failed workers and forward termination signals to Next.js. The application owns no long-lived worker or database connection; Next.js handles server shutdown. Verify graceful connection draining with the selected platform. Follow the [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) for proxy and hosting behavior.

## Verify after deployment

```sh
curl -f https://YOUR_HOST/api/health
```

Expected demo response: `{"status":"ok","mode":"demo","requiresAccessToken":false}`. This checks configuration, not model availability. Open the page, load the sample, generate the report, copy the summary, and download Markdown. The report must say **Fixed sample demo**; arbitrary code in demo mode must produce an explanatory error.

For live mode, confirm an unauthenticated `POST /api/analyze` returns 401. Enter the review access token in the UI and review a small, non-sensitive change. This real request costs tokens and is necessary to verify provider access. Confirm empty-findings reports render correctly. Check mobile layout and keyboard focus.

`GET /api/health` and review responses should use `Cache-Control: no-store`. Confirm frame denial, content-type sniffing protection, and HTTPS at the host. Ensure platform logs do not capture authorization headers or request bodies.

## Recovery and rollback

- **503 / configuration_required:** inspect the demo flag and presence of the live key/token; never paste their values into an issue or log. Redeploy/restart after correcting configuration.
- **401:** obtain the current access token from the owner; it is not the OpenAI API key.
- **422:** load the exact sample diff and choose Diff for demo mode.
- **429:** wait at least a minute; limits are shared within the process.
- **502/504:** check provider availability, billing, model access, and platform duration. Errors intentionally conceal raw provider details. There is no automatic retry.
- **Build/install failure:** check Node/npm versions and run `npm ci`; do not delete the lockfile to bypass a failure.

For Vercel, redeploy/promote the previous verified deployment. For a Node host, restore the prior release checkout and its compatible environment, then reinstall with `npm ci`, build, and restart. Record the release commit and re-run health and sample checks. There is no application data backup because reports are not stored; users retain any downloaded reports themselves.

If credentials are exposed, revoke/rotate them at the provider and hosting platform, redeploy, and inspect history/logs separately. Removing a file or changing an access token locally does not revoke an exposed provider key.

## Observability and release boundary

Use hosting status codes, latency, health monitoring, and provider usage dashboards. The app does not log submitted code or tokens and has no error-reporting vendor. Monitor 401/429/502/504 rates without storing bodies. In-memory limits do not provide a global budget; use a shared quota service and user authentication before a public live service.

Before publishing a release: run `npm run check`, the full dependency audit, Gitleaks, and a real live review if claiming live functionality works on that deployment. Document unresolved findings. CI verifies demo and mocked provider paths; it cannot verify external account access without a real configured call.
