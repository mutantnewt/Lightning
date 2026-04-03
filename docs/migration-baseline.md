# Lightning Classics Migration Baseline

## Objective

Modernize Lightning Classics from a browser-authoritative prototype into an AWS-hosted application that follows the Trainio standards without materially changing the current UX.

## Implementation Status

Completed so far:

- canonical project docs
- shared contracts scaffolding
- backend scaffolding
- frontend auth boundary refactor
- Cognito-ready frontend auth flow with email verification and `sessionStorage` token storage
- favorites and reading-lists client boundary with backend route scaffolding
- DynamoDB-backed backend code for favorites and reading lists
- a testable local HTTP path for authenticated user-state work
- a testable local HTTP path for public-read plus authenticated-write comments, reviews, and ratings
- a testable local public API path for books, FAQ entries, and author-book reads
- a testable local privileged Add Book suggestion path with audit recording and backend-controlled enrichment
- a testable local backend-owned Add Book moderation queue
- backend Cognito bearer-token verification code for authenticated local and deployed routes
- a repeatable DynamoDB catalog seed/bootstrap command
- deployed local-stack public and authenticated Lambda/API Gateway runtime surfaces
- live verification of the deployed public/auth path with a real Cognito JWT and DynamoDB-backed user-state access
- deployed local-stack privileged Lambda/API Gateway runtime surface
- live verification of the deployed privileged Add Book search/details path, authenticated submission path, and moderator-only publication gate
- browser-led smoke verification against the deployed API Gateway path from the real frontend
- browser-led deployed community verification for comments, ratings, and reviews
- browser-led deployed moderation-queue verification through the real frontend when the smoke user is temporarily elevated into the moderator group
- automated local/dev moderator lifecycle management for smoke verification
- browser-led moderation decision verification through the real frontend using a deterministic synthetic queue submission
- repeatable local smoke-user bootstrap automation with Cognito confirmation and DynamoDB user-state seeding
- repeatable local DynamoDB restore/import automation for exported backup snapshots
- codified long-lived CDK environment scaffolding for local, staging, and production with safer non-local defaults
- first live non-local staging deployment with seeded catalog, seeded smoke user, and browser-led verification
- codified Route 53 DNS and Amplify frontend-hosting stacks for staging and production
- first live Amplify-hosted staging frontend deployment in manual artifact mode, with the default Amplify staging URL verified over HTTPS
- first live production deployment with seeded catalog, seeded smoke user, and browser-led verification
- first live Amplify-hosted production frontend deployment in manual artifact mode, with the default Amplify production URL verified over HTTPS
- live registrar delegation of `lightningclassics.com` into Route 53
- live custom-domain attachment for `staging.lightningclassics.com` and `lightningclassics.com`
- post-cutover production redeploy with final CORS lock-down to `https://lightningclassics.com`
- hosted browser smoke verification on both live custom domains

Not yet completed:

- ephemeral review-environment testing path
- repository-connected Amplify CI/CD for staging and production

## 1. Current Capability To Target Mapping

### Catalog browsing

Current:

- backend-owned catalog content with a public API seam available locally when configured
- local backend runs persist catalog changes to a file-backed store until `BOOKS_TABLE_NAME` is configured

Target:

- public read path backed by DynamoDB and backend authority where needed

### Authentication

Current:

- simulated account system in `localStorage`

Target:

- Cognito-managed sign-up, sign-in, sign-out, and session identity
- alias-based sign-in with immutable username plus verified email
- DynamoDB keyed by Cognito `sub`
- browser tokens stored in `sessionStorage`, not cookies

### Favorites

Current:

- per-browser `localStorage`

Target:

- authenticated persistence in DynamoDB

### Reading lists

Current:

- per-browser `localStorage`

Target:

- authenticated persistence in DynamoDB

### Comments, ratings, and reviews

Current:

- per-browser `localStorage`

Target:

- public read path for book-community content where needed to preserve today’s discovery UX
- authenticated write path with DynamoDB persistence
- moderation-ready data model for future trust and abuse controls

Current status:

- local and deployed browser-led validation now cover comment create/delete, rating persistence, and review create/delete
- the remaining open work is not basic runtime validation, but longer-term moderation and environment rollout

### Recommendations

Current:

- client-side logic based on locally stored favorites

Target:

- same visible behavior, fed by persisted user-state data

### Add Book

Current:

- frontend form calling a privileged suggestion client with local and HTTP implementations
- active search and detail enrichment now run behind backend or local authority rather than a browser-held OpenAI key
- authenticated users can now submit reviewed-book suggestions into a backend-owned queue
- suggestion audit entries now persist through a backend-owned audit store in local mode
- moderator users can now review the pending queue in the main frontend and publish through the privileged backend path
- moderator users can now also defer or reject queued submissions with required notes

Target:

- backend-controlled suggestion/enrichment flow
- no browser-held secret
- shared-catalog writes moved behind explicit authority or moderation

## 2. Non-Regression Rules

- keep the current routes unless there is a compelling structural reason to change one
- keep the visual language and component behavior stable
- preserve public browsing and reading discovery
- keep the product trustworthy for non-technical readers by making copyright and provenance handling clearer over time, not murkier
- keep sign-in prompts narrow and contextual
- do not introduce avoidable UX churn during backend migration

## 3. Required Security Corrections

The following changes are required even if they create small implementation differences:

- remove browser-exposed OpenAI usage
- replace fake `localStorage` auth with Cognito
- stop storing password-like data in the browser
- stop treating browser state as authoritative shared persistence

## 4. Ordered Migration Slices

### Slice 1: Canonical docs and boundaries

- establish architecture, environment, config, and migration docs
- define public vs authenticated vs privileged behavior
- decide repo target structure

### Slice 2: Repo and runtime separation

- separate frontend, backend, contracts, and scripts
- remove Lovable/Render-specific drift from the active implementation path
- normalize build and verification commands

### Slice 3: Cognito integration with UX preservation

- keep the current auth-dialog experience where possible
- replace local auth hooks with Cognito-backed equivalents
- preserve route access behavior for public and signed-in areas
- generate immutable Cognito usernames in the background
- require email confirmation code entry before first sign-in
- configure non-cookie token storage

Current status:

- frontend implementation complete
- backend bearer-token verification code is now implemented
- AWS provisioning and live-environment validation still pending

### Slice 4: Backend surfaces for user-state features

- add authenticated backend routes for favorites
- add authenticated backend routes for reading lists
- add public-read plus authenticated-write backend routes for comments, ratings, and reviews
- migrate the existing hooks to API-backed implementations without materially changing the current UI

Current status:

- favorites and reading-lists contracts, hook boundaries, backend repository/service code, and route handlers are implemented
- comments, ratings, and reviews now have contracts, frontend client boundaries, backend repository/service code, and public/auth route handlers
- the public/auth runtime baseline is now deployed in the CDK-managed local stack
- deployed live validation now covers `/auth/me`, `/auth/favorites`, `PUT /auth/favorites/:bookId`, `DELETE /auth/favorites/:bookId`, and `GET /public/books`
- broader deployed live validation across comments, ratings, and reviews is still pending before cloud cutover

### Slice 5: Catalog persistence

- move shared catalog data into DynamoDB
- serve public catalog data from a public backend surface
- preserve current search/filter UX

Current status:

- public books, FAQ, and author-book reads now sit behind a local public API seam
- local accepted Add Book writes now persist through a backend-owned catalog store instead of a frontend overlay
- the cloud system of record for catalog and FAQ data remains the `lightning-books-<env>` DynamoDB table once provisioned
- the repo now includes a repeatable catalog seed/bootstrap command for DynamoDB-backed environments
- the deployed local-stack public API now serves the DynamoDB-backed catalog successfully via `GET /public/books`

### Slice 6: Add-book hardening

- move OpenAI-assisted enrichment to backend if retained
- add moderation or privileged-write control for shared catalog changes
- remove the active `VITE_OPENAI_API_KEY` dependency from frontend runtime

Current status:

- implemented locally for Add Book suggestion search, detail enrichment, and acceptance audit recording
- active browser-secret dependency removed from the main Add Book path
- accepted-book persistence now uses a backend-owned catalog path locally
- the privileged runtime is now deployed in the local CDK stack
- deployed live validation now covers Add Book search, details, and duplicate-protected accept conflict handling
- browser-led API Gateway validation is now complete for search/details
- the remaining gaps are broader deployed community coverage plus the final auth/moderation policy for privileged routes

### Slice 7: Cleanup and verification

- remove Lovable plugin and docs drift
- remove Render config if no longer used
- resolve nested-repo cleanup intentionally
- add tests and smoke checks at the new seams

## 5. Recommended First Implementation Slice

The best first code slice is:

- keep the current frontend where it is for now
- introduce project docs and target boundaries
- scaffold backend and contracts structure
- replace auth first, then migrate persisted user-state features one group at a time

This keeps UX stable while moving the highest-risk authority problems off the browser first.

## 6. Known Open Decisions

These still need to be fixed explicitly before production rollout:

- whether add-book remains public, authenticated, or moderated-only

The environment-rollout decision is now fixed:

- long-lived environments are `local + staging + production`
- review environments remain ephemeral and should not become a permanent fourth stack

The hosted-frontend direction is now fixed:

- Route 53 is the DNS control plane for `lightningclassics.com`
- staging and production are hosted as separate Amplify apps
- Amplify-managed certificates are the default hosted-frontend certificate path
- a custom ACM certificate remains optional, not the default

The current local/dev backend HTTP front door baseline is now:

- API Gateway HTTP API for deployed public/auth runtime verification
- the same API Gateway HTTP API now also fronts the deployed privileged runtime in local/dev

The following persistence decision is now fixed:

- all durable application data belongs in DynamoDB for cloud environments

The following auth decisions are now fixed and should not be reopened without a clear reason:

- Cognito alias-based sign-in
- immutable generated usernames
- verified email alias sign-in
- Cognito `sub` as the backend identity key
- no cookie-based frontend auth storage
- `lightning-<resource>-<env>` as the AWS resource naming convention for human-controlled names
- `eu-west-2` as the current Lightning Classics workload-region baseline

The following infrastructure direction is now fixed for local/dev codification:

- AWS CDK is the chosen infrastructure-as-code baseline for Lightning Classics in this repo
- local infrastructure hardening should prefer clean recreation under CDK control over CloudFormation import unless preserving existing local IDs becomes mandatory

## 7. Working Assumptions

Unless changed by project direction, this baseline assumes:

- the product name remains Lightning Classics for now
- the production domain is `lightningclassics.com`
- anonymous users can continue browsing the catalog
- signed-in features remain available, but with real identity and backend persistence
- durable product guidance from historical prompt or brief files should be absorbed into `docs/` and the originals moved to `docs/archive/`

## 8. Testing Strategy Direction

Lightning Classics should follow a two-speed testing strategy aligned with Yan Cui's serverless guidance:

- fast local testing for developer feedback
- ephemeral-environment remocal and end-to-end tests for high confidence

Current status:

- the fast local path now exists for authenticated user-state work, public catalog reads, and privileged Add Book suggestion verification
- the fast local path now also includes a repeatable browser-led smoke script at `scripts/local-frontend-smoke.mjs`
- deployed API Gateway verification now also has a first-class wrapper at `scripts/run-deployed-frontend-smoke.mjs`
- the browser-led smoke path now covers live Cognito sign-in, DynamoDB-backed favorites rendering, review creation/deletion, and Add Book search/details rendering
- the browser-led smoke path now also covers a real moderator reject/defer decision against a deterministic synthetic submission without polluting the live queue
- the local bootstrap path can now also confirm the smoke user and seed its minimal Cognito/DynamoDB baseline in one command
- the local infrastructure runbook now also includes a repeatable DynamoDB restore/import path for post-recreation recovery
- the repo now also includes explicit CDK synth and deploy commands for local, staging, and production
- the repo now also includes explicit CDK synth and deploy commands for `LightningDnsStack`, `LightningStagingFrontendStack`, and `LightningProductionFrontendStack`
- the repo now also includes a packaged `npm run smoke:staging` path for browser-led verification against `LightningStagingStack`
- the repo now also includes a packaged `npm run smoke:production` path for browser-led verification against `LightningProductionStack`
- the repo now also includes packaged manual Amplify artifact deployment commands for staging and production from `literary-light/`
- ephemeral review-environment testing is still a planned next step after AWS provisioning

Reference:

- [Why you should use ephemeral environments when you do serverless](https://theburningmonk.com/2019/09/why-you-should-use-temporary-stacks-when-you-do-serverless/)
