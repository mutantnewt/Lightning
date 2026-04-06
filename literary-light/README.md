# Lightning Classics Frontend

## Purpose

This directory contains the current Lightning Classics frontend application.

It is the existing React/Vite/Tailwind SPA that will be preserved at the UX layer while the project is migrated to the AWS target architecture defined in:

- `/Users/steve/Documents/GitHub/Lightning/docs/architecture.md`
- `/Users/steve/Documents/GitHub/Lightning/docs/environment-topology.md`
- `/Users/steve/Documents/GitHub/Lightning/docs/runtime-config.md`
- `/Users/steve/Documents/GitHub/Lightning/docs/migration-baseline.md`

## Current State

Today this frontend still contains some transition-era implementation details, including local-storage-backed auth and user state, plus a legacy browser OpenAI helper that is no longer part of the active Add Book path.

Those are being replaced incrementally with:

- AWS Amplify hosting
- Cognito-backed identity
- Lambda-backed authority
- DynamoDB persistence

## Local Development

### Install

```sh
npm install
```

### Run the dev server

```sh
npm run dev
```

Default local URL:

- `http://127.0.0.1:5175`

## Local Full-Stack Development

The project now supports a testable local path for public, authenticated, and privileged backend work.

Backend:

```sh
cd /Users/steve/Documents/GitHub/Lightning/backend
npm install
npm run dev
```

Frontend:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
npm install
npm run dev
```

Recommended local frontend env:

- `VITE_API_PUBLIC_BASE_URL=http://127.0.0.1:8787`
- `VITE_API_AUTH_BASE_URL=http://127.0.0.1:8787`
- `VITE_API_PRIVILEGED_BASE_URL=http://127.0.0.1:8787`
- `VITE_AWS_REGION=eu-west-2`
- `VITE_SITE_URL=http://127.0.0.1:5175`

Local note:

- this workspace now includes a `.env.local` wired to the current local Cognito and API values
- if the local AWS resources are recreated, update `literary-light/.env.local` to match the new Cognito IDs
- the preferred way to refresh those values is now the repo bootstrap script:
  - `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs`
- to refresh the env and confirm the smoke user in one step:
  - `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --ensure-smoke-user`
- the bootstrap script now also supports an explicit browser-smoke mode against API Gateway:
  - `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_FRONTEND_API_MODE=deployed-api /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed`
- restore the normal fast-feedback local backend mode with:
  - `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_FRONTEND_API_MODE=local-backend /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed`
- the dedicated smoke-user bootstrap helper is also available at:
  - `env LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-smoke-user.mjs`

### Repeatable Browser Smoke Test

The repo now includes a browser-led local smoke script at:

- `/Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs`

It drives a headless local Chrome session against `http://127.0.0.1:5175`, signs in through the live Cognito flow, opens Favorites, verifies DynamoDB-backed user state in the browser, posts and deletes a comment, persists a rating, posts and deletes a review through the rendered UI, and exercises the Add Book search/details flow against the privileged backend. It can also verify the moderator queue and its controls when explicitly enabled.

The Add Book UI now requires sign-in and submits suggestions for moderation rather than publishing directly to the shared catalog.

Example:

```sh
env \
  LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com \
  LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' \
  /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs
```

Optional smoke inputs:

- `LIGHTNING_SMOKE_COMMENT_TEXT` to override the temporary comment body used for the create/delete check
- `LIGHTNING_SMOKE_REVIEW_TEXT` to override the temporary review body used for the create/delete check
- `LIGHTNING_SMOKE_TARGET_RATING` to override the persisted rating target, default `5`
- `LIGHTNING_SMOKE_ADD_BOOK_QUERY` to force a single Add Book search term
- `LIGHTNING_SMOKE_ADD_BOOK_QUERIES` to provide a comma-separated fallback list of Add Book search terms
- `LIGHTNING_SMOKE_VERIFY_MODERATION=true` to make the smoke visit `/moderation` and verify the loaded queue or empty state for a moderator user
- `LIGHTNING_SMOKE_AUTO_MODERATOR=true` to temporarily grant and later revoke moderator access for the smoke user
- `LIGHTNING_SMOKE_MODERATOR_IDENTIFIER` to target a different Cognito user for temporary moderator elevation if needed
- `LIGHTNING_SMOKE_MODERATION_ACTION=defer` to exercise defer instead of the default `reject` decision against the synthetic moderation probe

Current behavior:

- the script stops at Add Book details by design so repeated local runs do not create duplicate catalog entries
- the smoke now also works when the frontend is temporarily switched to the deployed API Gateway URLs through `LIGHTNING_FRONTEND_API_MODE=deployed-api`
- the supported deployed verification path is now `npm run smoke:deployed-api`, which switches into `deployed-api`, starts a temporary Vite dev server, runs the browser smoke, and restores `local-backend` mode automatically
- the supported staging verification path is now `npm run smoke:staging`, which points the same browser smoke at `LightningStagingStack`, uses the staging API Gateway URL, and restores the workspace back to the local stack afterward
- the supported production pre-cutover verification path is now `npm run smoke:production`, which points the same browser smoke at `LightningProductionStack`, uses the production API Gateway URL, and restores the workspace back to the local stack afterward
- the supported hosted staging verification path is now `npm run smoke:staging:hosted`, which drives the browser smoke directly against the staging hosted frontend and prefers the custom domain automatically once Amplify marks it ready
- the supported hosted production verification path is now `npm run smoke:production:hosted`, which drives the browser smoke directly against the production hosted frontend and prefers the custom domain automatically once Amplify marks it ready
- `npm run smoke:deployed-api` requires port `127.0.0.1:5175` to be free because it will not kill an existing frontend dev server for safety
- `npm run smoke:staging` has the same port requirement
- `npm run smoke:production` has the same port requirement
- `npm run smoke:staging:hosted` does not require the local frontend dev server because it targets the hosted frontend URL directly
- `npm run smoke:production:hosted` does not require the local frontend dev server because it targets the hosted frontend URL directly
- as of 2026-04-02, `npm run smoke:staging:hosted` passes against `https://staging.dy2grocxp5fe9.amplifyapp.com`
- as of 2026-04-02, `npm run smoke:production:hosted` passes against `https://main.d1te9vk2z7t41u.amplifyapp.com`
- ratings are currently persistent in smoke runs because the app does not yet expose a rating delete/reset path
- moderation verification requires the signed-in test user to be in `lightning-catalog-moderators-<env>` for that run unless `LIGHTNING_SMOKE_AUTO_MODERATOR=true` is set
- moderation verification now prepares a synthetic queue submission and executes a real reject or defer decision through the rendered moderation UI
- the smoke-user bootstrap helper seeds the minimum DynamoDB-backed favorite and reading-list state expected by the browser smoke

### Packaged deployed browser smoke

From `/Users/steve/Documents/GitHub/Lightning/literary-light`:

```sh
env \
  LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com \
  LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' \
  npm run smoke:deployed-api
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-staging-smoke-password' \
npm run smoke:staging
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-production-smoke-password' \
npm run smoke:production
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-staging-smoke-password' \
npm run smoke:staging:hosted
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-production-smoke-password' \
npm run smoke:production:hosted
```

This command:

- refreshes `.env.local` from the current `LightningLocalStack` outputs in `deployed-api` mode
- starts a temporary Vite dev server on `http://127.0.0.1:5175`
- runs `/Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs`
- restores `.env.local` to `local-backend` mode afterward

For the hosted smoke commands:

- the wrapper resolves the correct hosted URL from the frontend stack outputs
- `--target auto` is the default behavior, so it uses the default Amplify domain until the custom domain is attached and verified
- once Amplify marks the custom domain ready, the same command will prefer `staging.lightningclassics.com` or `lightningclassics.com` automatically
- before custom-domain cutover, run the matching `prepare:<env>:hosted-smoke` helper in `/Users/steve/Documents/GitHub/Lightning/infra` if the backend CORS allow-list does not yet include the default Amplify hostname
- after custom-domain cutover, the repo-level finalizer can run the same hosted browser smoke on the custom domains when `LIGHTNING_STAGING_SMOKE_*` and `LIGHTNING_PRODUCTION_SMOKE_*` are supplied

Optional moderator example:

```sh
env \
  LIGHTNING_SMOKE_IDENTIFIER=your-moderator-test-user@example.com \
  LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' \
  LIGHTNING_SMOKE_VERIFY_MODERATION=true \
  LIGHTNING_SMOKE_AUTO_MODERATOR=true \
  npm run smoke:deployed-api
```

Optional defer variant:

```sh
env \
  LIGHTNING_SMOKE_IDENTIFIER=your-moderator-test-user@example.com \
  LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' \
  LIGHTNING_SMOKE_VERIFY_MODERATION=true \
  LIGHTNING_SMOKE_AUTO_MODERATOR=true \
  LIGHTNING_SMOKE_MODERATION_ACTION=defer \
  npm run smoke:deployed-api
```

Local auth behavior:

- if Cognito env vars are absent in `local`, the frontend uses the local auth client
- if Cognito env vars are absent in `staging` or `production`, the frontend now fails closed and surfaces an authentication/runtime error
- if Cognito env vars are present, the frontend uses Amplify/Cognito with `sessionStorage` token handling and sends bearer tokens to authenticated backend routes
- the modal auth flow now supports forgot-password and reset-password confirmation in both Cognito mode and local fallback mode
- when the API base URLs are present, the app uses the configured backend over HTTP for catalog, user-state, community, and Add Book suggestion flows
- when API base URLs are missing in `local`, the app can still use the local fallback clients
- when API base URLs are missing in `staging` or `production`, the app now fails closed instead of dropping into seed or local persistence paths
- the backend accepts local auth headers only when `ALLOW_LOCAL_AUTH_HEADERS=true`
- the Add Book privileged flow works without a backend secret by falling back to deterministic offline suggestions
- Add Book suggestions now persist through the backend-owned moderation queue in full-stack mode
- shared catalog publication now requires moderator access instead of being part of the normal Add Book flow

This keeps the contracts and route shapes aligned with the AWS target while still giving a fast local test loop.

### Build for production

```sh
npm run build
```

### Build with development mode settings

```sh
npm run build:dev
```

### Lint

```sh
npm run lint
```

## Frontend Runtime Configuration

Copy `.env.example` to `.env` or `.env.local` and fill in only browser-safe values.

Do not put backend secrets in the frontend runtime.

Do not add `VITE_OPENAI_API_KEY` to new frontend environments. The active Add Book path now runs through backend authority when configured.

## Notes

- The frontend currently lives in `literary-light/` as a transitional location.
- Shared contracts now live in `/Users/steve/Documents/GitHub/Lightning/contracts`.
- Project-level canonical docs now live in `/Users/steve/Documents/GitHub/Lightning/docs`.
