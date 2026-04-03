# Lightning Classics Implementation Status

## Status Date

2026-04-02

## Working Rule

This file is the running implementation ledger for the modernization.

Every meaningful migration slice should update:

- this file
- the affected canonical document in `docs/`

## Completed Slices

### Slice A: Canonical docs baseline

Completed:

- established `docs/architecture.md`
- established `docs/environment-topology.md`
- established `docs/runtime-config.md`
- established `docs/migration-baseline.md`
- aligned the project to `lightningclassics.com`

### Slice B: Repo boundary groundwork

Completed:

- introduced shared contracts under `contracts/`
- introduced backend scaffolding under `backend/`
- introduced frontend runtime config and auth-client boundaries
- removed active Lovable Vite-plugin usage from the current frontend runtime path

### Slice C: Cognito-ready frontend auth

Completed:

- added Amplify frontend dependency
- added frontend Amplify bootstrap with `sessionStorage` token storage and no cookie storage
- implemented Cognito-backed sign-up, sign-in, sign-out, current-user lookup, confirm-sign-up, and resend-sign-up-code client flows
- kept the existing modal auth UX shape while adding the required 6-digit email confirmation step
- switched sign-in UX to allow email or immutable username
- enforced the approved password-policy baseline in the frontend flow
- preserved a local fallback auth client for non-Cognito environments

Verification:

- `npm run build` passes in `literary-light/`
- `npm run lint` still fails on pre-existing repo issues outside this migration slice

### Slice D: Favorites and reading-lists client boundary

Completed:

- added shared user-state contracts for favorites and reading lists
- added authenticated backend route scaffolding for favorites and reading lists
- refactored frontend favorites and reading-list hooks behind a dedicated user-state client boundary
- preserved the existing UI behavior while moving these features off direct hook-local `localStorage` logic
- kept local fallback behavior when no authenticated API base URL is configured
- added an authenticated HTTP client scaffold that can call the future backend with a Cognito bearer token

Current limitation:

- authenticated backend routes are scaffolded but still return `501 Not Implemented` until the DynamoDB slice lands
- production cutover for favorites and reading lists must wait for backend persistence

Verification:

- `npm run build` passes in `literary-light/`
- targeted eslint passes for the new user-state client, hooks, and touched UI files

### Slice E: DynamoDB-backed backend user-state code

Completed:

- added a dedicated backend package and TypeScript build for runtime verification
- added shared backend env and DynamoDB helpers
- implemented DynamoDB-backed repository code for favorites and reading lists
- implemented service-layer functions for favorites and reading lists
- replaced authenticated favorites and reading-lists stub handlers with real backend code
- added authenticated CORS preflight handling for browser calls

Current limitation:

- this code is not live until AWS resources are provisioned and deployed
- the frontend still uses local fallback unless `VITE_API_AUTH_BASE_URL` points at a deployed authenticated API
- comments, ratings, and reviews are not yet migrated

Verification:

- `npm run build` passes in `backend/`

### Slice F: Testable local user-state runtime

Completed:

- added a local backend HTTP dev server
- added a local file-backed user-state repository behind the same service boundary as DynamoDB
- added a local-only frontend-to-backend auth bridge for non-Cognito development
- verified favorites and reading lists over real local HTTP routes
- documented the local full-stack run path

Verification:

- local backend health route responds on `http://127.0.0.1:8787/health`
- local favorites create/read smoke test passes
- local reading-list create/read smoke test passes
- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- targeted eslint passes for the new local auth bridge files

### Slice G: Comments, ratings, and reviews community slice

Completed:

- reviewed and absorbed durable context from `lightning-classics-product-brief.md` and `loveable-prompt-lightning-classics.md`
- moved those source files into `docs/archive/` instead of deleting them
- added shared contracts for comments, ratings, and reviews
- added public-read backend routes for comments, review lists, and rating summaries
- added authenticated backend routes for creating and deleting comments and reviews, and for setting and loading the caller's rating
- extended the local file-backed backend store and DynamoDB repository pattern to include book-scoped comments, reviews, and ratings
- added a dedicated frontend community client boundary with local and HTTP implementations
- refactored the comments, ratings, and reviews hooks to use the new boundary
- preserved the current card, comment, review, and star-rating UX while moving authority out of direct hook-local `localStorage`
- fixed local CORS preflight handling for the local-auth custom headers

Current limitation:

- live AWS deployment is still pending, so this slice is verified locally and by build, not in a provisioned cloud environment yet

Verification:

- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- targeted eslint passes for the new frontend community client, hooks, and touched UI files
- local HTTP smoke tests pass for:
  - `GET /public/books/:bookId/comments`
  - `POST /auth/books/:bookId/comments`
  - `DELETE /auth/books/:bookId/comments/:commentId`
  - `GET /public/books/:bookId/ratings`
  - `GET /auth/books/:bookId/ratings/me`
  - `PUT /auth/books/:bookId/ratings`
  - `GET /public/books/:bookId/reviews`
  - `POST /auth/books/:bookId/reviews`
  - `DELETE /auth/books/:bookId/reviews/:reviewId`

### Slice H: Public catalog boundary

Completed:

- moved shared seed books and FAQ content into a shared contracts-backed seed layer
- implemented public backend repository/service handlers for:
  - `GET /public/books`
  - `GET /public/faq`
  - `GET /public/authors/:name/books`
- replaced the backend public books stub with a working local public catalog surface
- added a frontend catalog client boundary with local and HTTP implementations
- refactored `useBooks` so public catalog reads come from the public API when configured
- preserved the current Add Book experience by keeping user-added books as a temporary local overlay until the moderated Add Book slice lands
- added dedicated hooks for FAQ entries and author-book reads
- moved the FAQ page and author page onto the public catalog boundary

Current limitation:

- the shared catalog is still seed-backed rather than DynamoDB-backed
- Add Book still writes a local overlay and still relies on browser-held OpenAI access, so this slice improves read boundaries but does not yet harden shared catalog writes

Verification:

- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- targeted eslint passes for the new frontend catalog client, hooks, and touched pages
- local HTTP smoke tests pass for:
  - `GET /public/books`
  - `GET /public/faq`
  - `GET /public/authors/:name/books`

### Slice I: Add Book hardening

Completed:

- added a dedicated Add Book suggestion contract surface for search, details, and acceptance audit events
- added a privileged backend route surface for Add Book suggestion search, detail enrichment, and acceptance audit recording
- moved the active Add Book search and details flow off browser-held OpenAI access
- added an optional backend OpenAI provider for Add Book enrichment with a deterministic offline fallback for local verification
- added a local file-backed suggestion-audit adapter for the privileged Add Book flow
- preserved the visible Add Book UX while recording accepted suggestions through the privileged audit path

Current limitation:

- accepted books still become a temporary frontend local overlay rather than a shared persisted catalog record
- suggestion-audit persistence is local-file-backed rather than DynamoDB-backed
- live privileged-route auth and moderation policy is still a deployment-time decision, not a provisioned cloud implementation

Verification:

- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- targeted eslint passes for:
  - `src/api/book-suggestions`
  - `src/pages/AddBook.tsx`
  - `src/config/runtime.ts`
- local HTTP smoke tests pass for:
  - `POST /privileged/book-suggestions/search`
  - `POST /privileged/book-suggestions/details`
  - `POST /privileged/book-suggestions/accept`

### Slice J: Shared catalog persistence

Completed:

- added a backend-owned catalog store with local file-backed and DynamoDB-backed implementations
- moved public catalog reads onto that shared catalog store instead of a frontend-owned overlay
- added a backend-owned catalog create path for accepted Add Book records
- moved Add Book acceptance to persist the created catalog record through backend authority
- added a DynamoDB-backed suggestion-audit repository path alongside the local file-backed adapter
- removed the frontend local overlay as the active Add Book persistence path
- locked the project decision that all durable application data belongs in DynamoDB for cloud environments

Current limitation:

- local verification still uses file-backed catalog and suggestion-audit adapters until AWS tables are provisioned
- comments, ratings, and reviews still need live DynamoDB validation even though their backend code path already exists
- privileged-route moderation and auth policy for live environments is still not finalized

Verification:

- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- targeted eslint passes for:
  - `src/api/catalog`
  - `src/api/book-suggestions`
  - `src/hooks/useBooks.ts`
  - `src/pages/AddBook.tsx`
- local HTTP smoke tests pass for:
  - `GET /public/books`
  - `POST /privileged/book-suggestions/details`
  - `POST /privileged/book-suggestions/accept`
- duplicate catalog writes are rejected with a backend error response
- local catalog persistence is confirmed in `backend/.local/lightning-catalog-local.json`

### Slice K: Local AWS auth and bootstrap readiness

Completed:

- added backend Cognito bearer-token verification using the official AWS JWT verifier
- kept the local auth-header bridge as a fallback for non-AWS local development
- added a repeatable DynamoDB catalog seed command
- tightened catalog duplicate protection so seeded books and created books cannot coexist as accidental duplicates by title and author

Current limitation:

- authenticated frontend clients still use the existing bearer-token path, but full end-to-end Cognito smoke validation has not yet been run in this repo

Verification:

- `npm run build` passes in `backend/`
- `npm run build` passes in `literary-light/`
- local `/auth/me` still works with the local auth-header bridge
- `npm run seed:catalog` is now available as the DynamoDB catalog bootstrap command

### Slice L: Local AWS provisioning and live smoke validation

Completed:

- provisioned the local Cognito user pool `lightning-users-local` in `eu-west-2`
- provisioned the local Cognito SPA app client `lightning-web-local`
- provisioned the local DynamoDB tables:
  - `lightning-books-local`
  - `lightning-user-state-local`
  - `lightning-book-suggestions-local`
- fixed the backend local runtime so `npm run dev` and `npm run seed:catalog` auto-load `backend/.env` and `backend/.env.local`
- added ignored local runtime wiring in `backend/.env.local` and `literary-light/.env.local`
- moved the frontend dev-server baseline to `http://127.0.0.1:5175`
- seeded the catalog into `lightning-books-local`
- ran live Cognito-backed local API smoke tests against the running backend

Verification:

- Cognito sign-up succeeded for a smoke-test account and produced an email-code delivery step
- admin confirmation plus `email_verified=true` let us verify sign-in by immutable username and by email alias against the live local user pool
- `GET /auth/me` succeeded with a real Cognito bearer token
- `PUT /auth/favorites/:bookId` and `GET /auth/favorites` succeeded against DynamoDB-backed user state
- `PUT /auth/reading-lists/:bookId` and `GET /auth/reading-lists` succeeded against DynamoDB-backed user state
- `POST /auth/books/:bookId/comments` and `GET /public/books/:bookId/comments` succeeded against DynamoDB-backed community state
- `PUT /auth/books/:bookId/ratings` and `GET /public/books/:bookId/ratings` plus `GET /auth/books/:bookId/ratings/me` succeeded against DynamoDB-backed community state
- `POST /privileged/book-suggestions/accept` succeeded against the DynamoDB-backed catalog and suggestion-audit tables
- repeating the same privileged accept request returned `409 Conflict`, confirming duplicate protection on the DynamoDB-backed catalog path

### Slice M: Browser-led local smoke validation

Completed:

- added a repeatable headless local browser smoke script in `scripts/local-frontend-smoke.mjs`
- verified the local frontend on `http://127.0.0.1:5175` against the live Cognito and DynamoDB-backed backend

Verification:

- the browser smoke script loaded the rendered home page and confirmed the Lightning Classics brand, Search button, and auth entry point
- the script signed in through the live frontend auth dialog using the Cognito-backed flow
- the signed-in navbar state rendered correctly with `Local Smoke` and `Sign Out`
- the script opened `/favorites` through the SPA UI and confirmed DynamoDB-backed state rendered in-browser
- the Favorites page showed the persisted `Pride and Prejudice` favorite, the `Currently Reading` status, and the existing comment count from the live local data path

Current command:

- `env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... /usr/local/bin/node scripts/local-frontend-smoke.mjs`

### Slice N: Local infrastructure codification and bootstrap automation

Completed:

- added a CDK-based local infrastructure layer in `infra/`
- codified the intended local/dev Cognito and DynamoDB resource shape in `infra/lib/lightning-local-stack.ts`
- added a repeatable local bootstrap script in `scripts/bootstrap-local-aws.mjs`
- verified `npm run synth` in `infra/`
- verified the bootstrap script against the current local resources, including env-file refresh and catalog reseeding

Verification:

- `infra/` now synthesizes a local stack with:
  - `lightning-users-local`
  - `lightning-web-local`
  - `lightning-books-local`
  - `lightning-user-state-local`
  - `lightning-book-suggestions-local`
- the synthesized Cognito app client now disables OAuth defaults and aligns with the current SPA auth model
- `scripts/bootstrap-local-aws.mjs` completed successfully against the live local resources and returned the resolved Cognito IDs and table names
- the bootstrap script refreshed `backend/.env.local` and `literary-light/.env.local`
- the bootstrap script reran `npm run seed:catalog` successfully

Current commands:

- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run synth`
- `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node scripts/bootstrap-local-aws.mjs`

### Slice O: Expanded browser-led local smoke coverage

Completed:

- added stable non-visual test hooks to the live book-card, review, and Add Book UI surfaces
- expanded `scripts/local-frontend-smoke.mjs` beyond sign-in and favorites rendering
- verified review creation and deletion through the live browser UI against the Cognito and DynamoDB-backed local stack
- verified the Add Book UI search and details path through the live browser against the privileged local backend
- kept the browser smoke idempotent by stopping at Add Book details instead of committing a new catalog write on every run

Verification:

- `npm run build` passes in `literary-light/`
- targeted eslint passes for:
  - `src/components/BookCard.tsx`
  - `src/components/ReviewsSection.tsx`
  - `src/pages/AddBook.tsx`
- `env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... /usr/local/bin/node scripts/local-frontend-smoke.mjs` passed against:
  - `http://127.0.0.1:5175`
  - `http://127.0.0.1:8787`
- the live browser smoke confirmed:
  - Cognito sign-in through the rendered auth dialog
  - DynamoDB-backed favorites rendering
  - review create/delete through the rendered reviews UI
  - Add Book search and details rendering for a live suggestion result

### Slice P: Local infrastructure ownership hardening groundwork

Completed:

- added a non-destructive local AWS ownership report in `scripts/check-local-aws-ownership.mjs`
- added a local DynamoDB backup/export command in `scripts/export-local-dynamo-backup.mjs`
- upgraded `scripts/bootstrap-local-aws.mjs` so it now prefers CloudFormation outputs when `LightningLocalStack` exists
- added a stack-only bootstrap mode with `scripts/bootstrap-local-aws.mjs --require-cdk`
- documented the local CDK cutover and safety workflow in `docs/local-infrastructure-control.md`
- recorded the recommended local hardening direction as clean recreation under CDK control instead of CloudFormation import

Verification:

- local script syntax checks pass for:
  - `scripts/bootstrap-local-aws.mjs`
  - `scripts/check-local-aws-ownership.mjs`
  - `scripts/export-local-dynamo-backup.mjs`
- `npm run synth` in `infra/` passes
- the live ownership report now returns:
  - `ownershipStatus: manual-resources-detected`
  - `recommendedAction: clean-recreate-under-cdk-recommended`
- the live DynamoDB backup export now exists at:
  - `backend/.local/backups/local-aws-2026-04-02T08-54-48-566Z/`
- the current exported table counts are:
  - `lightning-books-local`: 23
  - `lightning-user-state-local`: 4
  - `lightning-book-suggestions-local`: 3

Current limitation:

- this slice adds the runbook and tooling, but it does not yet perform the destructive local cutover to CDK-managed resources
- the current local resources remain transitional until the ownership report returns `stack-managed`

### Slice Q: Local CDK cutover completion

Completed:

- deleted the manual local Cognito user pool and DynamoDB tables after exporting the DynamoDB backup
- deployed `LightningLocalStack` into `eu-west-2`
- refreshed local env wiring from CloudFormation outputs with `scripts/bootstrap-local-aws.mjs --require-cdk`
- reseeded the catalog into the new CDK-managed `lightning-books-local` table
- recreated the local smoke user in the new Cognito user pool
- seeded the minimal smoke-user favorite and reading-list records required for browser verification
- corrected the ownership-report matching logic so it now compares live resources to CloudFormation outputs instead of assumed logical IDs
- restarted the local backend and frontend so they picked up the new Cognito IDs and table-backed runtime state

Verification:

- the live ownership report now returns:
  - `ownershipStatus: stack-managed`
  - `recommendedAction: use-cdk-as-system-of-record`
- the live local resource IDs are now:
  - Cognito user-pool ID `eu-west-2_XUvLTh3ek`
  - Cognito app-client ID `g7bdf28kd08fse6lhtsle0fci`
- `scripts/bootstrap-local-aws.mjs --require-cdk` succeeds and resolves `resourceResolutionSource: cdk-stack`
- backend health succeeds on `http://127.0.0.1:8787/health`
- frontend responds on `http://127.0.0.1:5175`
- the browser smoke passes against the CDK-managed local stack, including:
  - Cognito sign-in
  - DynamoDB-backed favorites rendering
  - review create/delete
  - Add Book search/details

Current limitation:

- the preserved pre-cutover DynamoDB backup is not yet paired with an automated restore path
- the local smoke user was recreated manually through Cognito admin APIs rather than a dedicated bootstrap helper

### Slice R: Deployed public/auth runtime baseline

Completed:

- hardened the local auth-header bridge so it only activates when `ALLOW_LOCAL_AUTH_HEADERS=true`
- kept deployed/authenticated runtimes on Cognito JWT validation only
- extended `LightningLocalStack` with Lambda-backed public and authenticated runtime surfaces
- added an API Gateway HTTP API with CORS for `http://127.0.0.1:5175`
- added a Cognito JWT authorizer for the deployed `/auth/*` routes
- added stack outputs for `HttpApiUrl`, `PublicApiBaseUrl`, `AuthApiBaseUrl`, `PublicApiFunctionName`, and `AuthApiFunctionName`
- deployed the public/auth runtime baseline into the CDK-managed local stack

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run synth` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local` passes
- deployed public runtime verification passes for:
  - `GET /public/health`
  - `GET /public/books`
- deployed authenticated runtime verification with a real Cognito ID token passes for:
  - `GET /auth/me`
  - `GET /auth/favorites`
  - `PUT /auth/favorites/:bookId`
  - `DELETE /auth/favorites/:bookId`
- DynamoDB verification confirms the temporary deployed favorite write was created and then removed from `lightning-user-state-local`

Current limitation:

- the privileged Add Book runtime is still local-only and not yet deployed through the local stack at this stage of the migration ledger; this is resolved in Slice S
- the frontend workspace still points to the local Node backend by default rather than the deployed API Gateway URL
- deployed live validation is currently strongest for public/auth favorites and identity; broader browser-led AWS runtime smoke coverage is still the next step

### Slice S: Deployed privileged runtime baseline

Completed:

- deployed the privileged Add Book runtime into `LightningLocalStack` as `lightning-privileged-api-local`
- added the `/privileged/{proxy+}` API Gateway route and `PrivilegedApiBaseUrl` stack output
- created the Cognito moderator group `lightning-catalog-moderators-local`
- attached the Cognito JWT authorizer to the deployed `/privileged/*` route
- upgraded the frontend privileged HTTP client to attach auth headers opportunistically when a local session or Cognito session exists, without requiring them yet

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run synth` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local` passes
- deployed privileged runtime verification passes for:
  - `POST /privileged/book-suggestions/search`
  - `POST /privileged/book-suggestions/details`
  - `POST /privileged/book-suggestions/submit` for an authenticated user
  - `POST /privileged/book-suggestions/accept` returning `403` for an authenticated non-moderator
- DynamoDB verification confirms the deployed details call wrote an audit entry into `lightning-book-suggestions-local`

Current limitation:

- moderator publication is still API-only because a review dashboard has not landed yet
- the frontend workspace still points `VITE_API_PRIVILEGED_BASE_URL` at the local Node backend by default rather than the deployed API Gateway URL
- browser-led smoke coverage against the deployed privileged route is still pending

### Slice T: Browser-led API Gateway smoke path

Completed:

- added an explicit frontend bootstrap mode switch for `local-backend` versus `deployed-api`
- used the bootstrap script to point the local frontend at the deployed `PublicApiBaseUrl`, `AuthApiBaseUrl`, and `PrivilegedApiBaseUrl`
- restarted the Vite dev server on `http://127.0.0.1:5175`
- ran the existing browser smoke through the real frontend while it was configured for API Gateway instead of the local Node backend
- restored the frontend workspace to `local-backend` mode after verification so the default dev loop remains fast

Verification:

- the browser smoke passed against `http://127.0.0.1:5175` while the frontend env pointed at `https://ktd23ui3vc.execute-api.eu-west-2.amazonaws.com`
- the rendered app completed:
  - Cognito sign-in
  - signed-in navbar rendering
  - deployed favorites rendering through the frontend
  - review create/delete through the rendered UI
  - Add Book search/details through the rendered UI
- the final smoke snapshot ended on `/add-book` with `Middlemarch` details visible and the temporary review removed

Current limitation:

- deployed browser-led coverage still does not explicitly exercise comments and ratings
- the smoke still stops before Add Book acceptance to avoid duplicate catalog writes on repeat runs
- moderator publication is still API-only because a review dashboard has not landed yet

### Slice U: Deployed community coverage completion

Completed:

- added stable smoke-test hooks for comments and book-card ratings
- extended the browser smoke to create and delete a comment through the rendered UI
- extended the browser smoke to persist a stable 5-star rating through the rendered UI
- reran the browser smoke against the deployed API Gateway path with comments, ratings, reviews, and Add Book search/details covered
- restored the frontend workspace to `local-backend` mode after the expanded deployed verification

Verification:

- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs` passes
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- the expanded browser smoke passed against `http://127.0.0.1:5175` while the frontend env pointed at `https://ktd23ui3vc.execute-api.eu-west-2.amazonaws.com`
- the smoke output confirms:
  - comment create/delete through the rendered UI
  - rating persistence to `5` through the rendered UI
  - review create/delete through the rendered UI
  - Add Book search/details through the rendered UI

Current limitation:

- ratings do not yet have a delete/reset path, so the dedicated smoke user now intentionally retains a persisted 5-star rating for the smoke book
- the smoke still stops before Add Book acceptance to avoid duplicate catalog writes on repeat runs
- moderator publication is still API-only because a review dashboard has not landed yet

### Slice V: Packaged deployed browser verification

Completed:

- added a first-class deployed smoke wrapper in `scripts/run-deployed-frontend-smoke.mjs`
- added `npm run smoke:deployed-api` in `literary-light/package.json`
- packaged the deployed frontend verification flow so it now switches to `deployed-api`, starts a temporary Vite dev server on `http://127.0.0.1:5175`, runs the browser smoke, and restores `local-backend` mode automatically
- kept the wrapper intentionally non-destructive by requiring port `5175` to be free instead of killing an existing frontend dev server

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/run-deployed-frontend-smoke.mjs` passes
- the packaged deployed smoke passed on 2026-04-02 against `https://ktd23ui3vc.execute-api.eu-west-2.amazonaws.com` and restored `local-backend` mode afterward

Current limitation:

- the packaged deployed smoke still requires a free `127.0.0.1:5175` port because it starts its own temporary frontend dev server to guarantee the correct env is loaded
- ratings do not yet have a delete/reset path, so the dedicated smoke user still intentionally retains a persisted 5-star rating for the smoke book
- the smoke still stops before Add Book acceptance to avoid duplicate catalog writes on repeat runs
- moderator publication is still API-only because a review dashboard has not landed yet

### Slice W: Privileged route auth and moderation lock-in

Completed:

- changed the user-facing Add Book action from direct publication to persistent submission for review
- made the privileged HTTP client require authentication instead of sending auth headers opportunistically
- added persistent suggestion submissions to the backend-owned suggestion store
- enforced authenticated access for privileged search, details, and submit operations in both the local Node backend and the deployed API Gateway route
- enforced moderator-only access for `/privileged/book-suggestions/accept` and `/privileged/books` using `lightning-catalog-moderators-<env>`
- extended the local auth-header bridge with `x-lightning-local-user-groups` so local moderator-path verification can stay explicit and local-only

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/backend && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && npm run deploy:local` passes
- `scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed` now refreshes `CATALOG_MODERATOR_GROUP_NAME=lightning-catalog-moderators-local`
- local anonymous `POST /privileged/book-suggestions/search` now returns `401`
- deployed anonymous `POST /privileged/book-suggestions/search` now returns `401 Unauthorized`
- local authenticated `POST /privileged/book-suggestions/submit` returns `pending_review`
- local moderator-path `POST /privileged/book-suggestions/accept` reaches duplicate protection and returns `409 Conflict` for an existing catalog title
- deployed authenticated `POST /privileged/book-suggestions/submit` returns `pending_review`
- deployed authenticated non-moderator `POST /privileged/book-suggestions/accept` returns `403`
- the packaged deployed browser smoke passed again on 2026-04-02 after the auth lock-in, with Add Book still working through search/details and now rendering `Submit for review`

Current limitation:

- moderator approval is still API-only; no review dashboard or queue UI exists yet
- the browser-led smoke intentionally stops before submission to keep repeated runs idempotent
- local and deployed verification currently prove the gate and queue behavior, but not a full moderator publish workflow through a dedicated UI

### Slice X: Moderator workflow surface

Completed:

- added moderator group awareness to the frontend auth state and runtime config
- added a moderator-only `/moderation` route and navigation entry in the main frontend
- added a dedicated frontend moderation client boundary and queue hook
- added a moderator-only backend route for `GET /privileged/book-suggestions/submissions`
- granted the privileged Lambda read/write access to `lightning-book-suggestions-local` so deployed moderation reads are allowed
- hardened authenticated request parsing so deployed Lambda runtimes merge API Gateway JWT-authorizer claims with the verified Cognito token, keeping group-based moderation consistent with the local Node backend
- extended the repeatable browser smoke so it can verify the moderation queue when `LIGHTNING_SMOKE_VERIFY_MODERATION=true`

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/backend && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && npm run deploy:local` passes after the privileged-table IAM fix and auth-claims consistency fix
- local moderator `GET /privileged/book-suggestions/submissions` returns the pending queue through the local Node backend
- deployed moderator `GET /privileged/book-suggestions/submissions` returns the pending queue through API Gateway and Lambda with a real Cognito ID token
- deployed moderator `POST /privileged/book-suggestions/accept` returns `409 Conflict` for a known duplicate submission, confirming the moderator publish path is live without mutating the shared catalog
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... LIGHTNING_SMOKE_VERIFY_MODERATION=true npm run smoke:deployed-api` passes on 2026-04-02 and shows the loaded moderation queue before restoring `local-backend` mode

Current limitation:

- browser-led moderation verification at this slice proves the queue UI loads with the new controls; end-to-end defer/reject browser coverage is added later in Slice AA
- moderator-user lifecycle is still an operational runbook step, not an automated bootstrap task
- the browser-led smoke still stops before Add Book submission or acceptance so repeated runs remain idempotent

### Slice Y: Moderator decision hardening

Completed:

- extended the moderation data model with `deferred` and `rejected` statuses plus moderator notes and last-decision metadata
- added moderator-only backend routes for `POST /privileged/book-suggestions/defer` and `POST /privileged/book-suggestions/reject`
- required moderator notes for defer and reject decisions
- updated the moderation page to capture notes per submission and expose explicit approve, defer, and reject actions
- extended the moderation queue API so submissions can be listed by moderation status, not only `pending_review`
- tightened the publish path so only `pending_review` submissions can be approved into the shared catalog

Verification:

- `cd /Users/steve/Documents/GitHub/Lightning/backend && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && npm run build` passes
- `cd /Users/steve/Documents/GitHub/Lightning/infra && npm run deploy:local` passes
- local backend verification passes for:
  - `POST /privileged/book-suggestions/reject`
  - `GET /privileged/book-suggestions/submissions?status=rejected`
- deployed API Gateway verification passes for:
  - `POST /privileged/book-suggestions/defer`
  - `GET /privileged/book-suggestions/submissions?status=deferred`
- browser-led local moderation verification passes with `LIGHTNING_SMOKE_VERIFY_MODERATION=true` and shows the loaded queue plus the new notes and action controls

Current limitation:

- moderator decisions do not yet support a separate “return for edits” state beyond `deferred`

### Slice Z: Moderator lifecycle automation

Completed:

- added a dedicated moderator lifecycle helper in `scripts/manage-local-moderator.mjs`
- taught the helper to resolve the local Cognito user pool and moderator group from `LightningLocalStack`
- allowed the helper to accept either immutable username or sign-in email via `--identifier`
- taught the helper to resolve immutable Cognito usernames automatically when an email identifier is supplied
- added explicit `status`, `grant`, and `revoke` actions for repeatable local/dev moderation setup
- extended `scripts/local-frontend-smoke.mjs` so moderation-enabled smoke runs can auto-grant and auto-revoke moderator membership with `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
- verified the same moderator automation path through the packaged deployed browser-smoke command while restoring `local-backend` mode afterward

Verification:

- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/manage-local-moderator.mjs` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs` passes
- moderator status verification resolves the smoke user by email and confirms:
  - the immutable Cognito username
  - empty group membership before the smoke
  - empty group membership again after cleanup
- local browser smoke passes with:
  - `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
  - `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
- packaged deployed browser smoke passes with:
  - `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
  - `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
  - automatic restore to `local-backend` mode afterward

Current limitation:

- moderator lifecycle automation currently focuses on access grant and cleanup; the decision coverage now lives in Slice AA
- the smoke still stops before Add Book submission or acceptance so repeated runs remain idempotent
- the local smoke-user creation path is still separate from moderator lifecycle automation

### Slice AA: Browser-led moderation decision coverage

Completed:

- added a deterministic smoke moderation submission helper in `backend/scripts/manageSmokeModerationSubmission.mjs`
- added a repo-level wrapper in `scripts/manage-smoke-moderation-submission.mjs`
- taught the helper to upsert a synthetic `pending_review` submission into `lightning-book-suggestions-<env>` for repeatable smoke verification
- extended the browser smoke to prepare that synthetic submission before visiting `/moderation`
- extended the moderation-page test hooks with submission metadata so the smoke can target the correct queue item precisely
- extended the browser smoke to add moderator notes, click a real defer or reject action, and verify the resulting persisted moderation status
- verified the same moderation-decision coverage through the packaged deployed API Gateway smoke path while restoring `local-backend` mode afterward

Verification:

- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/backend/scripts/manageSmokeModerationSubmission.mjs` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/manage-smoke-moderation-submission.mjs` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs` passes
- the smoke submission helper successfully prepares `book-suggestion-submission:lightning-smoke-moderation-local` in `lightning-book-suggestions-local`
- browser-led local smoke passes with:
  - `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
  - `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
  - a real `reject` decision through the rendered moderation UI
  - persisted `rejected` status confirmed afterward
- packaged deployed browser smoke passes with:
  - `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
  - `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
  - the same synthetic moderation submission prepared against DynamoDB
  - a real `reject` decision through the rendered moderation UI against API Gateway
  - persisted `rejected` status confirmed afterward
  - automatic restore to `local-backend` mode afterward

Current limitation:

- the moderation decision smoke currently covers `reject` by default and supports `defer` through `LIGHTNING_SMOKE_MODERATION_ACTION=defer`, but it does not exercise `approve and publish`
- the smoke still stops before Add Book submission or acceptance so repeated runs remain idempotent
- the local smoke-user creation path is still separate from the main bootstrap command

### Slice AB: Smoke-user bootstrap automation

Completed:

- added a dedicated local smoke-user bootstrap helper in `backend/scripts/bootstrapSmokeUser.mjs`
- added a repo-level wrapper in `scripts/bootstrap-local-smoke-user.mjs`
- added `npm run bootstrap:smoke-user` in `backend/package.json`
- taught the helper to resolve the local Cognito user pool, user-state table, and moderator group from `LightningLocalStack` or local env files
- taught the helper to create or confirm the smoke user by email, keep the immutable Cognito username stable, enforce a permanent password, and set the visible `name` attribute
- taught the helper to remove temporary moderator access so the smoke user returns to a clean non-moderator baseline after bootstrap
- taught the helper to seed the minimal DynamoDB-backed smoke-user state for browser verification:
  - favorite book `1`
  - reading-list book `1`
  - reading-list type `currentlyReading`
- extended `scripts/bootstrap-local-aws.mjs` with `--ensure-smoke-user` so local env bootstrap and smoke-user bootstrap can now run as one integrated path

Verification:

- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/backend/scripts/bootstrapSmokeUser.mjs` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-smoke-user.mjs` passes
- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs` passes
- the dedicated smoke-user bootstrap command succeeds with:
  - `LIGHTNING_SMOKE_IDENTIFIER=lightning-local-smoke-20260402@example.com`
  - `LIGHTNING_SMOKE_PASSWORD=...`
  - confirmed Cognito status `CONFIRMED`
  - `email_verified=true`
  - no moderator-group membership afterward
  - seeded favorite and reading-list records in `lightning-user-state-local`
- the integrated bootstrap path succeeds with:
  - `scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed --ensure-smoke-user`
  - `smokeUserBootstrapped: true`
  - embedded smoke-user bootstrap output in the final JSON result
- browser-led local smoke passes afterward using the bootstrapped smoke account, including moderation coverage

Current limitation:

- smoke-user bootstrap currently seeds the minimum browser-smoke baseline rather than a fully resettable per-run fixture set
- the browser smoke still stops before Add Book submission or acceptance so repeated runs remain idempotent
- local DynamoDB restore/import automation now exists separately from smoke-user bootstrap and is tracked in Slice AC

### Slice AC: Local DynamoDB restore automation

Completed:

- added a dedicated local DynamoDB restore tool in `scripts/restore-local-dynamo-backup.mjs`
- taught the restore tool to resolve the latest backup automatically when `--backup-dir` is omitted
- taught the restore tool to read `manifest.json` plus exported `*.items.json` files from the existing backup format
- taught the restore tool to map backup tables onto the current `LightningLocalStack` table outputs by logical category
- added a conservative dry-run mode that reports the recovery plan without writing
- added a non-empty target guard so live restore aborts unless `--allow-non-empty` is explicitly supplied
- added retry-aware batch-write handling for DynamoDB restore/import requests
- verified the live restore path against a fresh same-data backup of the current local tables

Verification:

- `/usr/local/bin/node --check /Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs` passes
- a fresh live backup export succeeded to:
  - `backend/.local/backups/local-aws-2026-04-02T11-48-36-281Z`
- dry-run restore now succeeds and reports:
  - all three target tables
  - current target item counts
  - `wouldRequireAllowNonEmpty: true` for the current non-empty local stack
- live restore with:
  - `--backup-dir /Users/steve/Documents/GitHub/Lightning/backend/.local/backups/local-aws-2026-04-02T11-48-36-281Z`
  - `--allow-non-empty`
  passed and rewrote the current local tables with their own current contents
- live restore verification confirmed matching before/after counts for:
  - `lightning-books-local` `22 -> 22`
  - `lightning-user-state-local` `3 -> 3`
  - `lightning-book-suggestions-local` `42 -> 42`

Current limitation:

- restore automation currently targets DynamoDB table contents only; Cognito user export/import is still not automated
- restore/import currently supports merge-style overwrite into non-empty tables when explicitly allowed, but it does not yet offer a selective per-table or per-item restore mode
- the browser smoke still stops before Add Book submission or acceptance so repeated runs remain idempotent

### Cross-slice standard: AWS resource naming

Fixed decision:

- human-controlled AWS resource names must use the `lightning-` prefix
- preferred format is `lightning-<resource>-<env>`
- this applies to DynamoDB table names and Cognito user-pool names
- AWS-generated identifiers such as Cognito user-pool IDs remain AWS-assigned and are not expected to carry the prefix

### Slice AD: Frontend hosting and production cutover prep

Completed:

- added a dedicated Route 53 DNS stack as `LightningDnsStack`
- added dedicated Amplify frontend-hosting stacks as `LightningStagingFrontendStack` and `LightningProductionFrontendStack`
- codified the hosted frontend naming baseline as:
  - `lightning-frontend-staging`
  - `lightning-frontend-prod`
- wired the hosted frontend stacks to consume the live backend stack outputs for:
  - API base URL
  - Cognito user-pool ID
  - Cognito app-client ID
  - moderator-group name
- codified a Vite-compatible Amplify build spec for the `literary-light/` app
- codified baseline hosted security headers and SPA rewrite rules for Amplify Hosting
- added deploy-time parameters so Amplify hosting stays prep-only until:
  - a GitHub access token is supplied
  - custom-domain association is explicitly enabled
- codified the default hosted certificate path as Amplify-managed, with optional custom ACM certificate support via `AmplifyCustomCertificateArn`
- added a dedicated hosted-frontend cutover runbook in `docs/frontend-hosting-cutover.md`
- deployed `LightningDnsStack` successfully on 2026-04-02
- captured the live Route 53 hosted zone ID `Z016489723I788PVTRF68`
- captured the live authoritative nameservers:
  - `ns-999.awsdns-60.net`
  - `ns-1755.awsdns-27.co.uk`
  - `ns-269.awsdns-33.com`
  - `ns-1042.awsdns-02.org`

Verification:

- `npm run build` passes in `infra/`
- `npm run synth:dns` passes
- `npm run synth:frontend:staging` passes
- `npm run synth:frontend:production` passes
- `npm run deploy:dns` passes
- the synthesized frontend stacks expose the expected deploy-time controls for:
  - `AmplifyRepositoryUrl`
  - `AmplifyAccessToken`
  - `EnableCustomDomainAssociation`
  - `AmplifyCustomCertificateArn`

Current limitation:

- the staging custom domain is not attached yet because registrar delegation is still pending
- the live custom-domain cutover still depends on registrar delegation
- repository-connected Amplify CI/CD still depends on valid GitHub access later

### Slice AE: Live staging hosted-frontend rollout

Completed:

- updated the hosted-frontend stacks to support both `MANUAL` and `REPOSITORY` deployment modes
- made `MANUAL` the default hosted-frontend deployment mode so staging can ship without GitHub repo access
- added the manual Amplify artifact deployment helper at `scripts/deploy-manual-amplify-frontend.mjs`
- deployed `LightningStagingFrontendStack` successfully on 2026-04-02
- brought the staging hosted frontend live as:
  - Amplify app ID `dy2grocxp5fe9`
  - default domain `dy2grocxp5fe9.amplifyapp.com`
  - hosted URL `https://staging.dy2grocxp5fe9.amplifyapp.com`
- fixed the manual artifact-packaging bug by uploading the contents of `dist/` at the zip root instead of the parent `dist` directory
- added a branded SVG favicon for Lightning Classics while retaining the legacy `.ico` file as a fallback

Verification:

- `node --check scripts/deploy-manual-amplify-frontend.mjs` passes
- `npm run deploy:frontend:staging` passes
- the latest manual Amplify deployment completed with status `SUCCEED`
- `curl -I https://staging.dy2grocxp5fe9.amplifyapp.com` returns `HTTP/2 200`
- `curl -I https://staging.dy2grocxp5fe9.amplifyapp.com/favicon.svg` returns `HTTP/2 200`

Current limitation:

- `staging.lightningclassics.com` is not attached yet because registrar delegation is still pending
- production hosted frontend deployment is still separate from the custom-domain cutover
- repository-connected Amplify CI/CD is still deferred until GitHub access is intentionally re-enabled

### Slice AF: Live production pre-cutover rollout

Completed:

- added a packaged production browser verification wrapper at `scripts/run-production-frontend-smoke.mjs`
- added `npm run smoke:production` in `literary-light/package.json`
- added `npm run deploy:production:precutover` and `npm run deploy:frontend:production:precutover` in `infra/package.json`
- deployed `LightningProductionStack` successfully on 2026-04-02
- seeded the production catalog and bootstrapped the dedicated production smoke user
- deployed `LightningProductionFrontendStack` successfully on 2026-04-02
- brought the production hosted frontend live as:
  - Amplify app ID `d1te9vk2z7t41u`
  - default domain `d1te9vk2z7t41u.amplifyapp.com`
  - hosted URL `https://main.d1te9vk2z7t41u.amplifyapp.com`
- verified the branded favicon on the production default Amplify domain
- completed packaged browser-led production verification against the live production API Gateway runtime

Verification:

- `npm run deploy:production:precutover` passes
- `scripts/bootstrap-local-aws.mjs --require-cdk --ensure-smoke-user` succeeds against `LightningProductionStack`
- `npm run deploy:frontend:production:precutover` passes
- the latest manual production Amplify deployment completed with status `SUCCEED`
- `curl -I https://main.d1te9vk2z7t41u.amplifyapp.com` returns `HTTP/2 200`
- `curl -I https://main.d1te9vk2z7t41u.amplifyapp.com/favicon.svg` returns `HTTP/2 200`
- `npm run smoke:production` passes

Current limitation:

- `lightningclassics.com` is not delegated to Route 53 yet and still resolves via GoDaddy nameservers as of 2026-04-02
- production custom-domain attachment is still pending
- the production stack currently includes `http://127.0.0.1:5175` in CORS as a deliberate pre-cutover smoke allowance and must be redeployed without that override after domain cutover
- repository-connected Amplify CI/CD is still deferred until GitHub access is intentionally re-enabled

### Slice AG: Domain cutover readiness automation

Completed:

- added a shared domain-cutover helper at `scripts/domain-cutover-lib.mjs`
- added a dedicated registrar-delegation readiness check at `scripts/check-domain-cutover-readiness.mjs`
- added a repeatable hosted-frontend domain-attachment helper at `scripts/attach-hosted-frontend-domains.mjs`
- added `npm run check:domain:delegation`, `npm run deploy:frontend:staging:domain`, `npm run deploy:frontend:production:domain`, and `npm run deploy:frontend:domains` in `infra/package.json`
- updated the hosted-frontend cutover runbook so post-delegation domain attachment is explicit and script-backed instead of being a manual parameter recipe only

Verification:

- `/usr/local/bin/node --check scripts/domain-cutover-lib.mjs` passes
- `/usr/local/bin/node --check scripts/check-domain-cutover-readiness.mjs` passes
- `/usr/local/bin/node --check scripts/attach-hosted-frontend-domains.mjs` passes
- `/usr/local/bin/node scripts/check-domain-cutover-readiness.mjs` confirms on 2026-04-02 that:
  - expected Route 53 nameservers remain `ns-1042.awsdns-02.org`, `ns-1755.awsdns-27.co.uk`, `ns-269.awsdns-33.com`, and `ns-999.awsdns-60.net`
  - current registrar delegation still resolves to `ns37.domaincontrol.com` and `ns38.domaincontrol.com`
  - `delegationMatches` is `false`

Current limitation:

- the registrar still must be pointed at the Route 53 nameservers before the domain-attachment helper can proceed without override
- production post-cutover CORS cleanup remains a separate deliberate step via `npm run deploy:production`

### Slice AH: Domain verification and cutover lock-down prep

Completed:

- added post-attachment verification support in `scripts/domain-cutover-lib.mjs`
- added a dedicated hosted-domain verification helper at `scripts/verify-hosted-frontend-domains.mjs`
- added `npm run verify:frontend:staging:domain`, `npm run verify:frontend:production:domain`, and `npm run verify:frontend:domains` in `infra/package.json`
- updated the cutover runbook so post-attach verification is explicit before the final production CORS cleanup deploy

Verification:

- `/usr/local/bin/node --check scripts/verify-hosted-frontend-domains.mjs` passes
- `/usr/local/bin/node scripts/verify-hosted-frontend-domains.mjs --environment all` confirms on 2026-04-02 that:
  - registrar delegation still resolves to `ns37.domaincontrol.com` and `ns38.domaincontrol.com`
  - `delegationMatches` remains `false`
  - neither Amplify app has a `lightningclassics.com` domain association yet
  - both staging and production custom-domain readiness remain `false`

Current limitation:

- until the registrar delegation changes, the verification helper will continue to report that the Route 53 hosted zone is not yet authoritative
- final production lock-down still depends on the domain attachment succeeding first

### Slice AI: Final cutover orchestration

Completed:

- added a guarded cutover finalizer at `scripts/finalize-hosted-domain-cutover.mjs`
- added `npm run cutover:finalize` in `infra/package.json`
- updated the hosted-frontend runbook so the final attach, verify, and production lock-down flow can run as one command

Verification:

- `/usr/local/bin/node --check scripts/finalize-hosted-domain-cutover.mjs` passes
- `/usr/local/bin/npm run cutover:finalize -- --dry-run` passes on 2026-04-02 and correctly plans:
  - hosted-domain attachment
  - hosted-domain verification with `--wait --require-ready`
  - production CORS lock-down via `npm run deploy:production`
  while also reporting that registrar delegation is still on `ns37.domaincontrol.com` and `ns38.domaincontrol.com`

Current limitation:

- the finalizer still depends on registrar delegation moving to Route 53 before it can execute the real cutover path without override
- the finalizer has not been executed live yet because the domain is still delegated to GoDaddy as of 2026-04-02

### Slice AJ: Hosted frontend browser smoke

Completed:

- added a hosted frontend browser-smoke wrapper at `scripts/run-hosted-frontend-smoke.mjs`
- added `npm run smoke:staging:hosted` and `npm run smoke:production:hosted` in `literary-light/package.json`
- made the hosted smoke target selection automatic:
  - use the default Amplify domain before custom-domain cutover
  - prefer the custom domain automatically once Amplify marks it ready
- updated the frontend and hosting runbooks so hosted-frontend browser verification is part of the supported verification path

Verification:

- `/usr/local/bin/node --check scripts/run-hosted-frontend-smoke.mjs` passes
- `npm run smoke:staging:hosted` passes on 2026-04-02 against `https://staging.dy2grocxp5fe9.amplifyapp.com` after the staging Amplify artifact refresh
- `npm run smoke:production:hosted` passes on 2026-04-02 against `https://main.d1te9vk2z7t41u.amplifyapp.com`

Current limitation:

- until the custom domains are attached, hosted smoke verification will continue to target the default Amplify domains
- live hosted smoke still depends on valid staging or production smoke-user credentials

### Slice AK: Pre-cutover hosted frontend CORS fix

Completed:

- discovered through live hosted smoke that the default Amplify frontend domains were not yet present in backend CORS for staging and production
- added `extraCorsOrigins` support to the shared CDK environment config in `infra/lib/environment-config.ts` and `infra/bin/lightning-infra.ts`
- added a repeatable pre-cutover backend helper at `scripts/prepare-hosted-frontend-cors.mjs`
- added `npm run prepare:staging:hosted-smoke` and `npm run prepare:production:hosted-smoke` in `infra/package.json`
- strengthened the final cutover finalizer so production lock-down now verifies removal of both:
  - `http://127.0.0.1:5175`
  - the default Amplify production hostname

Verification:

- `/usr/local/bin/node --check scripts/prepare-hosted-frontend-cors.mjs` passes
- `npm run prepare:staging:hosted-smoke` passes on 2026-04-02 and updates `LightningStagingStack` `CorsAllowedOrigins` to include:
  - `https://staging.lightningclassics.com`
  - `http://127.0.0.1:5175`
  - `https://staging.dy2grocxp5fe9.amplifyapp.com`
- `npm run prepare:production:hosted-smoke` passes on 2026-04-02 and updates `LightningProductionStack` `CorsAllowedOrigins` to include:
  - `https://lightningclassics.com`
  - `http://127.0.0.1:5175`
  - `https://main.d1te9vk2z7t41u.amplifyapp.com`
- `npm run smoke:production:hosted` passes on 2026-04-02 against `https://main.d1te9vk2z7t41u.amplifyapp.com`

Current limitation:

- the final steady-state policy remains the canonical custom domain only; the default Amplify hostname allowance is transitional

### Slice AL: Post-cutover hosted browser verification orchestration

Completed:

- extended `scripts/finalize-hosted-domain-cutover.mjs` so it can optionally run hosted browser smoke on the actual custom domains after attachment and production lock-down
- added environment-specific smoke credential resolution for:
  - `LIGHTNING_STAGING_SMOKE_IDENTIFIER`
  - `LIGHTNING_STAGING_SMOKE_PASSWORD`
  - `LIGHTNING_PRODUCTION_SMOKE_IDENTIFIER`
  - `LIGHTNING_PRODUCTION_SMOKE_PASSWORD`
- added `npm run cutover:finalize:with-hosted-smoke` in `infra/package.json`
- updated the hosted-frontend cutover runbook so the final cutover path can include browser-led custom-domain verification, not only infrastructure-level checks

Verification:

- `/usr/local/bin/node --check scripts/finalize-hosted-domain-cutover.mjs` passes after the hosted-smoke extension
- `/usr/local/bin/npm run cutover:finalize:with-hosted-smoke -- --dry-run` passes on 2026-04-02 and correctly plans:
  - custom-domain attachment
  - custom-domain verification
  - production CORS lock-down
  - optional hosted browser smoke on both custom domains
  while also reporting that `LIGHTNING_STAGING_SMOKE_*` and `LIGHTNING_PRODUCTION_SMOKE_*` credentials are required to execute the hosted-smoke stage

Current limitation:

- the hosted-smoke finalizer path still cannot be executed live until registrar delegation moves to Route 53 and the custom domains are attached
- if the environment-specific smoke credentials are absent, the hosted-smoke stage is skipped unless the operator explicitly requires it

### Slice AM: Operator cutover status report

Completed:

- added a one-command status report at `scripts/print-cutover-status.mjs`
- added `npm run cutover:status` in `infra/package.json`
- updated the cutover runbook so the operator can fetch the current delegation, hosted URLs, CORS allow-lists, and final cutover command from one place

Verification:

- `/usr/local/bin/node --check scripts/print-cutover-status.mjs` passes

Current limitation:

- the status report is informational; it does not change infrastructure state
- the real cutover remains blocked until registrar delegation moves to Route 53

### Slice AN: Operational readiness baseline

Completed:

- added a codified CloudWatch observability baseline for `staging` and `production`
- added environment-specific CloudWatch dashboards for API and Lambda health
- added low-noise alarms for:
  - HTTP API 5xx
  - public API Lambda errors and throttles
  - authenticated API Lambda errors and throttles
  - privileged API Lambda errors and throttles
- added `scripts/print-operations-status.mjs`
- added `npm run ops:status`, `npm run ops:status:staging`, and `npm run ops:status:production`
- added `docs/operations-guide.md`
- added `docs/incident-and-rollback-runbook.md`
- deployed the new operational baseline live to staging
- deployed the new operational baseline live to production through the pre-cutover path
- restored the temporary default-Amplify CORS allowances after the observability deploy so hosted pre-cutover smoke remains supported

Verification:

- `npm run build` passes in `infra/`
- `npm run synth:staging` passes
- `npm run synth:production` passes
- live staging deploy succeeds through `npm run deploy:frontend:staging`
- live production deploy succeeds through `npm run deploy:frontend:production:precutover`
- live pre-cutover CORS restoration succeeds through:
  - `npm run prepare:staging:hosted-smoke`
  - `npm run prepare:production:hosted-smoke`
- `/usr/local/bin/node --check scripts/print-operations-status.mjs` passes
- live `npm run ops:status` now reports:
  - staging public health `200`
  - production public health `200`
  - all new staging alarms `OK`
  - all new production alarms `OK`
- hosted browser smoke still passes after the observability rollout through:
  - `npm run smoke:staging:hosted`
  - `npm run smoke:production:hosted`

Current limitation:

- alarms currently have no SNS, PagerDuty, or Incident Manager actions attached
- API Gateway access logs and tracing are still future hardening work rather than part of the current baseline

### Slice AO: Access logs and tracing hardening

Completed:

- added API Gateway access logging to the shared environment stack on the `$default` stage
- added dedicated access-log groups:
  - `/aws/apigateway/lightning-http-api-access-staging`
  - `/aws/apigateway/lightning-http-api-access-prod`
- enabled active Lambda tracing for public, authenticated, and privileged runtimes
- updated `scripts/print-operations-status.mjs` to surface `ApiAccessLogGroupName`
- extended `scripts/prepare-hosted-frontend-cors.mjs` with explicit forced refresh support through `--force-deploy`
- added `npm run prepare:staging:hosted-smoke:force` and `npm run prepare:production:hosted-smoke:force`
- fixed the HTTP API stage migration by reusing the original default-stage logical ID instead of creating a second `$default` stage
- updated the shared CDK bootstrap stack in `eu-west-2` so the deployment role could complete the observability rollout
- deployed the access-log and tracing baseline live to staging and production through the safe pre-cutover path

Verification:

- `npm run build` passes in `infra/`
- the stack now synthesizes the original `BackendHttpApiDefaultStage...` resource path with access-log settings instead of attempting to create a second `$default` stage
- live staging forced refresh succeeds through `npm run prepare:staging:hosted-smoke:force`
- live production forced refresh succeeds through `npm run prepare:production:hosted-smoke:force`
- live `npm run ops:status` reports:
  - staging public health `200`
  - production public health `200`
  - all staging alarms `OK`
  - all production alarms `OK`
  - access-log group outputs for both environments
- hosted browser smoke passes again through:
  - `npm run smoke:staging:hosted`
  - `npm run smoke:production:hosted`
- live Lambda tracing verification passes for sampled runtime surfaces in staging and production with `TracingConfig.Mode=Active`
- live API Gateway access-log tails now show real staging and production traffic after hosted smoke

Current limitation:

- alarms still have no SNS, PagerDuty, or Incident Manager actions attached

### Slice AP: Alarm notification baseline

Completed:

- added one SNS alarm topic per long-lived cloud environment:
  - `lightning-operations-alerts-staging`
  - `lightning-operations-alerts-prod`
- wired every codified CloudWatch alarm in staging and production to the matching SNS alarm topic
- extended `scripts/print-operations-status.mjs` to surface:
  - `OperationsAlarmTopicArn`
  - `OperationsAlarmTopicName`
  - `alarmActionCoverage`
- tightened `ops:status` so an environment is only `allClear` when alarm-action coverage is complete, not just when alarms are `OK`
- deployed the SNS-backed alarm-action baseline live to staging and production through the safe pre-cutover path

Verification:

- `npm run build` passes in `infra/`
- `npm run synth:staging` passes
- live staging forced refresh succeeds through `npm run prepare:staging:hosted-smoke:force`
- live production forced refresh succeeds through `npm run prepare:production:hosted-smoke:force`
- live `npm run ops:status` reports:
  - staging public health `200`
  - production public health `200`
  - staging alarm topic `lightning-operations-alerts-staging`
  - production alarm topic `lightning-operations-alerts-prod`
  - complete alarm-action coverage in both environments
- hosted browser smoke still passes after the rollout through:
  - `npm run smoke:staging:hosted`
  - `npm run smoke:production:hosted`

Current limitation:

- the SNS alarm topics exist and are wired, but they do not yet have email, chat, PagerDuty, or Incident Manager subscriptions attached

### Slice AQ: Alarm subscription readiness

Completed:

- added optional deploy-time alarm notification email configuration through:
  - context `alarmNotificationEmails=...`
  - env var `LIGHTNING_ALARM_NOTIFICATION_EMAILS=...`
- added optional SNS email subscriptions on top of the existing per-environment alarm topics
- added `OperationsAlarmNotificationEmailCount` stack output for staging and production
- extended `scripts/print-operations-status.mjs` to report:
  - `alarmTopicSubscriptions`
  - `alarmSubscriptionReadiness`
- tightened `ops:status` so configured-but-unconfirmed alarm email routing would mark the environment as not fully clear
- deployed the new output/status baseline live to staging and production with zero configured alarm emails

Verification:

- `npm run build` passes in `infra/`
- `/usr/local/bin/node --check scripts/print-operations-status.mjs` passes
- `npm run synth:staging` passes
- live staging forced refresh succeeds through `npm run prepare:staging:hosted-smoke:force`
- live production forced refresh succeeds through `npm run prepare:production:hosted-smoke:force`
- live `npm run ops:status` reports:
  - `OperationsAlarmNotificationEmailCount = 0` in both environments
  - `alarmTopicSubscriptions = []` in both environments
  - `alarmSubscriptionReadiness.ready = true` in both environments

Current limitation:

- no alarm subscriptions are configured yet, so notifications still stop at the topic boundary until we attach destinations

### Slice AR: Hosted frontend CSP and environment-safe manual publishes

Completed:

- added a codified hosted-frontend CSP and `Cross-Origin-Resource-Policy` baseline in the Amplify frontend-hosting stack
- fixed the manual Amplify publish path so staging and production builds now resolve environment-specific Vite values from the selected frontend stack outputs
- removed the manual publish path's dependency on developer-local `.env.local` for:
  - `VITE_APP_ENV`
  - `VITE_AWS_REGION`
  - Cognito user-pool and app-client IDs
  - API base URLs
  - moderator group name
  - `VITE_SITE_URL`
- expanded browser-smoke diagnostics so hosted verification failures now surface console, exception, and network clues
- republished staging and production through the fixed manual Amplify path
- re-verified both hosted Amplify frontends after the republish with live browser smoke

Verification:

- `npm run build` passes in `literary-light/`
- `/usr/local/bin/node --check scripts/deploy-manual-amplify-frontend.mjs` passes
- staging manual Amplify republish succeeds on 2026-04-02 with job `6`
- production manual Amplify republish succeeds on 2026-04-02 with job `4`
- `curl -I https://staging.dy2grocxp5fe9.amplifyapp.com` returns:
  - `HTTP/2 200`
  - `content-security-policy`
  - `cross-origin-resource-policy: same-site`
- `curl -I https://main.d1te9vk2z7t41u.amplifyapp.com` returns:
  - `HTTP/2 200`
  - `content-security-policy`
  - `cross-origin-resource-policy: same-site`
- hosted browser smoke passes again through:
  - `LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:staging:hosted`
  - `LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:production:hosted`

Current limitation:

- staging and production hosted frontends still run in manual Amplify mode until we intentionally switch to repository-connected CI/CD later
- custom-domain attachment for `staging.lightningclassics.com` and `lightningclassics.com` is still blocked by registrar delegation

### Slice AS: Hosted frontend release metadata

Completed:

- added a machine-readable hosted release manifest to the manual Amplify publish path at `/lightning-release.json`
- added explicit release identifiers for hosted manual publishes in the format `<environment>-<timestamp>-<shortSha>`
- included build provenance in the hosted release manifest:
  - git commit SHA
  - short SHA
  - source branch
  - dirty-worktree flag
  - dirty-file count
- included runtime provenance in the hosted release manifest:
  - selected frontend stack name
  - Amplify app ID, branch, default domain, and job ID
  - site URL
  - API base URLs
  - Cognito user-pool and app-client IDs
  - moderator group name
  - no-cookie/session-storage auth baseline
- added `scripts/print-hosted-frontend-release-status.mjs`
- added operator commands:
  - `npm run frontend:release:status`
  - `npm run frontend:release:status:staging`
  - `npm run frontend:release:status:production`
- republished staging and production so the release manifest is live on both hosted Amplify frontends

Verification:

- `/usr/local/bin/node --check scripts/deploy-manual-amplify-frontend.mjs` passes
- `/usr/local/bin/node --check scripts/print-hosted-frontend-release-status.mjs` passes
- `npm run build` passes in `literary-light/`
- `npm run build` passes in `infra/`
- production manual Amplify republish succeeds on 2026-04-02 with job `5`
- staging manual Amplify republish succeeds on 2026-04-02 with job `7`
- live release verification passes with:
  - `/usr/local/bin/node scripts/print-hosted-frontend-release-status.mjs --environment all --require-match`
- current live hosted release IDs are:
  - staging `staging-20260402T180527Z-19f9354`
  - production `production-20260402T180456Z-19f9354`

Current limitation:

- the hosted release manifest gives precise release provenance, but custom-domain verification still depends on DNS delegation and the default Amplify hosts until cutover completes

### Slice AT: Hosted frontend retained-archive rollback

Completed:

- extracted the manual Amplify frontend release logic into a shared helper module:
  - `scripts/amplify-frontend-release-lib.mjs`
- added retained local frontend release archives under:
  - `/Users/steve/Documents/GitHub/Lightning/.local/frontend-releases/<environment>/<releaseId>/`
- each retained archive now includes:
  - the original uploaded frontend zip
  - `release-archive.json`
  - zip SHA-256 metadata
- added archive inventory commands:
  - `npm run frontend:release:archives`
  - `npm run frontend:release:archives:staging`
  - `npm run frontend:release:archives:production`
- added first-class redeploy commands:
  - `npm run frontend:release:redeploy:staging -- --release-id <release-id>`
  - `npm run frontend:release:redeploy:production -- --release-id <release-id>`
- added a top-level repo `.gitignore` so local release archives and `.DS_Store` do not pollute the worktree
- republished staging and production through the retained-archive path so both long-lived hosted frontends now have local rollback artifacts
- live-verified the retained-archive redeploy path by replaying the current staging release back into Amplify

Verification:

- `/usr/local/bin/node --check scripts/amplify-frontend-release-lib.mjs` passes
- `/usr/local/bin/node --check scripts/deploy-manual-amplify-frontend.mjs` passes
- `/usr/local/bin/node --check scripts/redeploy-hosted-frontend-release.mjs` passes
- `/usr/local/bin/node --check scripts/list-hosted-frontend-release-archives.mjs` passes
- staging retained-archive publish succeeds on 2026-04-02 with job `8`
- production retained-archive publish succeeds on 2026-04-02 with job `6`
- `npm run frontend:release:archives` reports retained staging and production release archives with zip SHA-256 values
- `npm run frontend:release:redeploy:staging -- --release-id staging-20260402T182519Z-19f9354` succeeds with redeploy job `9`
- `npm run frontend:release:status:staging` still reports `allMatch = true` after the staging archive redeploy
- `LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:staging:hosted` still passes after the staging archive redeploy

Current limitation:

- retained frontend rollback artifacts were local-only at the end of this slice and were extended into durable S3 storage in Slice AU
- the retained-archive redeploy path has been live-verified on staging; production rollback rehearsal is still deferred unless needed

### Slice AU: Hosted frontend durable remote archive storage

Completed:

- extended the hosted frontend stacks with dedicated per-environment release-archive buckets:
  - `lightning-frontend-releases-staging-310505389001-eu-west-2`
  - `lightning-frontend-releases-prod-310505389001-eu-west-2`
- added stack outputs for:
  - `FrontendReleaseArchiveBucketName`
  - `FrontendReleaseArchivePrefix`
- taught the shared hosted-frontend release helper to:
  - upload retained release zips plus `release-archive.json` into S3
  - list remote archive metadata
  - download remote archive metadata and zips back into a local archive root
  - resolve rollback archives locally first and then from S3 when the local copy is missing
- republished staging and production through the new durable archive path so the current long-lived hosted releases now have both local and remote retention
- extended archive inventory reporting so the operator view now includes:
  - `storagePresence.local`
  - `storagePresence.remote`
  - remote bucket and object-key details
  - remote upload timestamps
- live-verified the remote restore path on staging by redeploying from an empty temporary `LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT`, forcing the retained release zip and metadata to be downloaded from S3 before Amplify publish
- added richer Favorites-page diagnostics to the browser smoke so hosted post-deploy failures now report page state, visible books, and client-side fetch failures instead of a blind timeout
- diagnosed a real pre-cutover staging CORS drift during remote-restore verification and revalidated the codified recovery path with `prepare:staging:hosted-smoke:force`

Verification:

- `/usr/local/bin/node --check scripts/amplify-frontend-release-lib.mjs` passes
- `/usr/local/bin/node --check scripts/deploy-manual-amplify-frontend.mjs` passes
- `/usr/local/bin/node --check scripts/redeploy-hosted-frontend-release.mjs` passes
- `/usr/local/bin/node --check scripts/list-hosted-frontend-release-archives.mjs` passes
- `/usr/local/bin/node --check scripts/local-frontend-smoke.mjs` passes
- `npm run build` passes in `infra/`
- `npm run synth:frontend:staging` passes with `FrontendReleaseArchiveBucketName=lightning-frontend-releases-staging-310505389001-eu-west-2`
- `npm run synth:frontend:production` passes with `FrontendReleaseArchiveBucketName=lightning-frontend-releases-prod-310505389001-eu-west-2`
- `npm run deploy:frontend:staging` succeeds and creates the staging archive bucket outputs
- `npm run deploy:frontend:production` succeeds and creates the production archive bucket outputs
- staging manual Amplify republish succeeds on 2026-04-02 with job `10`
- production manual Amplify republish succeeds on 2026-04-02 with job `7`
- current live retained release IDs are:
  - staging `staging-20260402T205356Z-19f9354`
  - production `production-20260402T205429Z-19f9354`
- `npm run frontend:release:archives` now reports `storagePresence.local = true` and `storagePresence.remote = true` for those latest staging and production releases
- `npm run frontend:release:status` still reports `allMatch = true` after the durable-archive republishes
- `LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT=/tmp/lightning-remote-release-test-staging-20260402T2109 npm run frontend:release:redeploy:staging -- --release-id staging-20260402T205356Z-19f9354` succeeds with redeploy job `11`
- the temporary remote-restore archive root now contains:
  - `frontend-dist.zip`
  - `release-archive.json`
- staging and production hosted verification both surfaced missing `Access-Control-Allow-Origin` for their default Amplify hostnames, and the codified refresh path succeeded with:
  - `npm run prepare:staging:hosted-smoke:force`
  - `npm run prepare:production:hosted-smoke:force`
  - `curl -s -i -H 'Origin: https://staging.dy2grocxp5fe9.amplifyapp.com' https://pbs76ug4gc.execute-api.eu-west-2.amazonaws.com/public/books`
  - `curl -s -i -H 'Origin: https://main.d1te9vk2z7t41u.amplifyapp.com' https://ejyo5np488.execute-api.eu-west-2.amazonaws.com/public/books`
  - `LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:staging:hosted`
  - `LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:production:hosted`

Current limitation:

- both long-lived environments now have archive durability, integrity verification, and remote-restore rehearsal coverage; the remaining hosted-frontend blocker is still custom-domain cutover

### Slice AW: Hosted frontend archive integrity verification

Completed:

- added `scripts/verify-hosted-frontend-release-archives.mjs`
- added operator commands:
  - `npm run frontend:release:verify`
  - `npm run frontend:release:verify:staging`
  - `npm run frontend:release:verify:production`
- taught the verification path to:
  - compare retained local and remote metadata for each hosted frontend release
  - require remote presence when desired
  - download the retained remote zip into a temporary workspace
  - compute the remote zip SHA-256 and compare it with the recorded release metadata
  - fail the command when remote presence or integrity checks do not pass

Verification:

- `/usr/local/bin/node --check scripts/verify-hosted-frontend-release-archives.mjs` passes
- `npm run frontend:release:verify` succeeds on 2026-04-03
- verification confirms for all four retained releases:
  - `storagePresence.remote = true`
  - `metadataConsistent = true`
  - `zipIntegrityValid = true`
- the retained remote SHA-256 values match the recorded archive metadata for:
  - `production-20260402T182542Z-19f9354`
  - `production-20260402T205429Z-19f9354`
  - `staging-20260402T182519Z-19f9354`
  - `staging-20260402T205356Z-19f9354`

Current limitation:

- the remote-restore redeploy path is integrity-verified, but only the current retained release in each environment has been live-rehearsed as a restore target

### Slice AX: Hosted frontend production remote-restore rehearsal

Completed:

- live-rehearsed the production remote-restore redeploy path from S3 using an empty temporary archive root:
  - `LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT=/tmp/lightning-remote-release-test-production-20260403T0727 npm run frontend:release:redeploy:production -- --release-id production-20260402T205429Z-19f9354`
- confirmed the temporary production restore root was populated with:
  - `frontend-dist.zip`
  - `release-archive.json`
- revalidated the deployed production manifest and hosted browser smoke after the remote restore

Verification:

- `LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT=/tmp/lightning-remote-release-test-production-20260403T0727 npm run frontend:release:redeploy:production -- --release-id production-20260402T205429Z-19f9354` succeeds with redeploy job `8`
- the temporary production remote-restore archive root contains:
  - `frontend-dist.zip`
  - `release-archive.json`
- `npm run frontend:release:status:production` still reports `allMatch = true` after the remote restore
- `LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com LIGHTNING_SMOKE_PASSWORD=... npm run smoke:production:hosted` passes after the remote restore

Current limitation:

- the remote-restore redeploy path is proven for the current retained release in both long-lived environments, but not every historical retained release has been individually rehearsed as a restore target

### Slice AV: Hosted frontend archive backfill sync

Completed:

- added `scripts/sync-hosted-frontend-release-archives.mjs`
- added operator commands:
  - `npm run frontend:release:sync`
  - `npm run frontend:release:sync:staging`
  - `npm run frontend:release:sync:production`
- taught the sync path to:
  - scan retained local hosted-frontend archives
  - compare them with the current contents of the environment-specific S3 archive buckets
  - upload only the missing releases unless `--force` is used
  - update local `release-archive.json` metadata with `remoteArchive` details as each backfill completes
- backfilled the older retained staging and production releases that were still local-only:
  - `staging-20260402T182519Z-19f9354`
  - `production-20260402T182542Z-19f9354`

Verification:

- `/usr/local/bin/node --check scripts/sync-hosted-frontend-release-archives.mjs` passes
- `npm run frontend:release:sync` succeeds on 2026-04-03
- sync uploads exactly the two previously local-only retained releases and skips the two already-remote current releases
- `npm run frontend:release:archives` now reports `storagePresence.remote = true` for all four retained staging and production releases
- `npm run frontend:release:status` still reports `allMatch = true` after the archive backfill

Current limitation:

- the archive backfill sync now closes the remote-storage gap, but it does not by itself prove each retained release as a restore target; that rehearsal coverage is tracked separately

## Current State

The repo is now in a transition state:

- the frontend is Cognito-ready
- the frontend now has explicit user-state boundaries for favorites and reading lists
- the backend now has DynamoDB-backed code for favorites and reading lists
- the repo now has a testable local HTTP path for favorites and reading lists
- comments, ratings, and reviews now sit behind explicit frontend/backend boundaries with public-read and authenticated-write local HTTP paths
- books, FAQ entries, and author-book reads now sit behind a public frontend/backend catalog boundary when a public API base URL is configured
- the active Add Book flow now uses a privileged frontend/backend suggestion boundary with local HTTP verification and audit recording
- Add Book submissions now persist through a backend-owned suggestion store instead of a frontend overlay
- shared-catalog publication is now moderator-only instead of being part of the user-facing Add Book flow
- the authenticated backend surface can now verify Cognito bearer tokens when Cognito env vars are configured
- the repo now includes a repeatable DynamoDB catalog seed command for the local/dev cloud-backed path
- the frontend local workspace is now wired to a provisioned Lightning Classics Cognito user pool
- favorites and reading lists use local fallback unless an authenticated API base URL is configured
- the shared catalog is now served from a backend-owned public API seam when configured
- the browser no longer needs an active OpenAI key for the primary Add Book flow
- local persistence can now run against real Cognito and DynamoDB in this workspace
- file-backed adapters remain available only as the fast-feedback fallback when the AWS env vars are removed
- the repo now has a repeatable browser-level local smoke path, not only API-level smoke checks
- the browser-led local smoke path now exercises review mutations and Add Book search/details in addition to auth and favorites
- the repo now has a codified CDK infrastructure layer plus a repeatable local AWS bootstrap script
- the repo now has explicit tooling to report local AWS ownership and export local DynamoDB state before CDK cutover
- the local AWS environment is now CloudFormation-owned and CDK-managed
- the bootstrap path now resolves local resources from CloudFormation outputs in stack-only mode
- the local frontend and backend are now running against the CDK-managed Cognito and DynamoDB resources
- the local stack now also includes a deployed Lambda/API Gateway public/auth runtime path in addition to the local Node backend
- the deployed `/auth/*` path has now been live-verified with a real Cognito JWT and DynamoDB-backed user-state reads and writes
- the local auth-header bridge is now explicitly gated behind `ALLOW_LOCAL_AUTH_HEADERS=true` and is no longer implicitly enabled by `APP_ENV=local`
- the local stack now also includes a deployed privileged Add Book runtime path with live API verification
- the deployed privileged path is now Cognito-protected and no longer open in local/dev
- the moderator group baseline is now `lightning-catalog-moderators-<env>`
- the repo now has a repeatable way to switch the frontend between local-backend mode and deployed-API mode for smoke verification
- browser-led verification has now passed against the deployed API Gateway path, not only the local Node backend
- browser-led deployed verification now covers comments, ratings, reviews, and Add Book search/details from the real frontend
- the main frontend now includes a moderator-only `/moderation` queue powered by the privileged API surface
- browser-led deployed verification can now also confirm the loaded moderation queue when the smoke user is temporarily placed in the moderator group
- moderators can now defer or reject queued submissions with required notes, not only publish them
- moderation submissions now persist last-decision notes and status metadata for deferred/rejected outcomes
- the repo now has a first-class deployed browser-smoke command that restores `local-backend` mode automatically after verification
- the repo now also has a dedicated moderator lifecycle helper plus smoke-time automatic moderator grant and cleanup for local/dev verification
- the repo now also has deterministic browser-led moderation decision coverage using a synthetic queue submission and persisted reject/defer verification
- the repo now also has a repeatable smoke-user bootstrap helper plus an opt-in `bootstrap-local-aws --ensure-smoke-user` path
- the repo now also has a repeatable local DynamoDB restore/import path for exported backups
- the repo now also has explicit CDK environment scaffolding for `local`, `staging`, and `production`
- the long-lived rollout model is now fixed at `local + staging + production`
- review environments remain intentionally ephemeral rather than a permanent fourth stack
- the CDK app now synthesizes `LightningStagingStack` and `LightningProductionStack` in addition to the existing `LightningLocalStack`
- non-local stateful resources now synthesize with `RETAIN` removal policy and DynamoDB deletion protection
- the production stack now synthesizes with CloudFormation termination protection
- the staging stack has now been deployed live in `eu-west-2`
- staging stack outputs are now:
  - API base URL `https://pbs76ug4gc.execute-api.eu-west-2.amazonaws.com`
  - user pool ID `eu-west-2_8k7xYV4Bi`
  - app client ID `54fkqa4iernu1lh2bs8ddcrp4d`
- staging catalog seeding and smoke-user bootstrap now pass against the live stack
- browser-led staging verification now passes through `npm run smoke:staging`
- staging API CORS now allows both the real staging site and the local Vite smoke origin `http://127.0.0.1:5175`
- the repo now also includes a dedicated Route 53 DNS stack for `lightningclassics.com`
- the Route 53 hosted zone is now live with authoritative nameservers ready for registrar cutover
- the repo now also includes dedicated Amplify-hosting stacks for staging and production
- the hosted frontend stacks now support both manual artifact deployment and repository-connected Amplify mode
- the staging hosted frontend is now live at `https://staging.dy2grocxp5fe9.amplifyapp.com`
- the production stack is now live at `https://ejyo5np488.execute-api.eu-west-2.amazonaws.com`
- the production hosted frontend is now live at `https://main.d1te9vk2z7t41u.amplifyapp.com`
- packaged browser smoke now passes against both staging and production
- hosted browser smoke now also passes against both staging and production Amplify frontends
- hosted browser smoke now also passes against the production Amplify frontend
- the manual Amplify publish path is now environment-safe and no longer depends on local `.env.local` for staging or production artifacts
- the default Amplify hosts now return the codified `Content-Security-Policy` and `Cross-Origin-Resource-Policy` headers
- the default Amplify hosts now also expose machine-readable hosted release manifests at `/lightning-release.json`
- the repo now also retains local hosted frontend release archives with scripted archive listing and redeploy commands
- the frontend now prefers a branded SVG favicon with the legacy `.ico` retained as a fallback
- the repo now includes a script-backed domain cutover readiness check and attach-domain path for staging and production
- the repo now also includes a script-backed custom-domain verification path for staging and production
- the repo now also includes a one-command final cutover path for hosted-domain attachment, verification, and production CORS lock-down
- the repo now also includes direct hosted-frontend browser-smoke paths for staging and production
- the repo now also includes a repeatable pre-cutover backend CORS preparation path for hosted-frontend smoke on the default Amplify domains
- the repo now also includes an optional post-cutover hosted-smoke stage in the finalizer for real custom-domain browser verification
- the repo now also includes a one-command cutover status report for registrar handoff and operator readiness
- the repo now also includes a wait-and-run domain cutover watcher that can poll delegation and hand off automatically into the guarded finalizer
- the new wait-and-run cutover watcher has now been dry-run verified against the live DNS and AWS state
- the repo now also includes a cutover evidence capture command for timestamped DNS, Amplify, HTTPS, CORS, and optional hosted-smoke snapshots
- the cutover evidence capture command has now been live-verified against the current pre-cutover AWS and DNS state
- the repo now also includes a one-command cutover completion wrapper that combines waiting, finalization, and post-cutover evidence capture
- the end-to-end cutover completion wrapper has now been dry-run verified against the live DNS and AWS state
- staging and production now both have live CloudWatch operations dashboards and low-noise alarm baselines
- the repo now also includes a live operations status report plus dedicated operations and incident runbooks
- staging and production now also have live API Gateway access logs and active Lambda tracing
- registrar delegation for `lightningclassics.com` now matches the Route 53 hosted zone as of 2026-04-03
- `staging.lightningclassics.com` is now attached in Amplify and serving over HTTPS
- `lightningclassics.com` is now attached in Amplify and serving over HTTPS
- the guarded custom-domain finalizer now passes end to end with hosted browser smoke on both live custom domains
- production CORS is now locked to `https://lightningclassics.com` only; the temporary localhost and default-Amplify production origins are removed
- the cutover orchestration now handles two live-discovered edge cases:
  - domain attachment must pass stack-scoped frontend parameters
  - post-cutover production cleanup must deploy through `deploy:frontend:production` so the frontend stack stays in the same CDK graph as the backend exports
- the hosted-domain verification and hosted-smoke helpers now treat the apex production domain as ready when Amplify reports `domainStatus=AVAILABLE` and HTTPS succeeds, even though the apex `verified` flag remains `false`
- environment-specific hosted smoke credentials are now bridged into the inner browser smoke runner automatically
- a post-cutover evidence snapshot is now archived at `docs/archive/cutover-evidence/cutover-evidence-2026-04-03T08-41-30Z.json`

## Immediate Next Steps

### Next slice: Post-Go-Live Hardening

Needed:

- capture and archive a post-cutover operator snapshot with `npm run cutover:evidence`
- attach real email, chat, PagerDuty, or Incident Manager subscriptions to the live SNS alarm topics
- decide whether staging and production should stay on manual Amplify artifact deploys or move to repository-connected Amplify CI/CD
- decide whether to add `www.lightningclassics.com` as a redirect or secondary hostname
- add lifecycle or replication rules to the hosted frontend release-archive buckets if longer retention or disaster-recovery duplication is required
- decide later whether to keep manual Amplify deploys or switch staging and production to repository-connected CI/CD
- keep review environments ephemeral and separate from the long-lived stack set
- keep the current privileged API gate and queue model as the only allowed shared-catalog write path
- keep repeated runs idempotent and isolated from normal catalog content

### After live local AWS validation

Then:

- connect the deployed auth API to the frontend via `VITE_API_AUTH_BASE_URL` as an explicit opt-in path
- connect the deployed public API to the frontend via `VITE_API_PUBLIC_BASE_URL` as an explicit opt-in path
- connect the deployed privileged API to the frontend via `VITE_API_PRIVILEGED_BASE_URL` as an explicit opt-in path
- run browser-led smoke tests against the deployed public/auth/privileged runtime, not only the local Node backend
- add ephemeral review-environment remocal tests in line with Yan Cui's serverless testing guidance

## Open Blockers

- the browser-led smoke intentionally stops short of Add Book acceptance so repeated local runs do not create duplicate catalog entries
- SNS alarm topics are live but still have no real notification subscriptions attached
