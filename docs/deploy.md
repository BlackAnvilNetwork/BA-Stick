# Deploying stick-web (gated)

Public deploy is **not enabled**. `.github/workflows/pages.yml` runs only on manual
dispatch and only when the repo variable `ENABLE_PAGES_DEPLOY` is `true`; Pages must
also be switched on in repo settings. Nothing deploys until a maintainer does both.

Config (repo variables):
- `VITE_WS_URL` — server websocket URL the built client connects to (required).
- `ENABLE_PAGES_DEPLOY` — `true` to allow the workflow to run.

Local check: `VITE_WS_URL=ws://localhost:8787 pnpm --filter @bellgrave/stick-web build && npx vite preview`.

Vite `base: "./"` keeps asset URLs relative, so the build works under `/<repo>/`.

Server side: add the Pages origin (e.g. `https://<org>.github.io`) to the server's
`AUTH_ORIGINS`; otherwise the server rejects the websocket handshake. Verified locally:
a build with `VITE_WS_URL=ws://localhost:8787` served from :4180 dials that server and is
refused only by the origin allowlist (the dev server allows :5174).
