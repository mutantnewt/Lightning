# Lightning Classics Architecture

## Status

This document is the current architecture baseline for Lightning Classics.

It is intentionally split into:

- current state
- approved target state

That keeps the doc truthful while the modernization is in progress.

## 1. Product Objective

Lightning Classics is a classic-literature discovery application.

The modernization objective is:

- preserve the current user experience and page structure as far as practical
- remove Lovable, Replit, Render, and browser-secret coupling
- move authority and persistence out of the browser
- host the frontend on AWS Amplify
- use Cognito for identity and DynamoDB for persistence
- serve production from `lightningclassics.com`

Lightning Classics is aimed primarily at:

- independent learners and lifelong readers exploring classic literature
- students and educators who need dependable summaries and metadata
- curators, librarians, and reading-group organizers growing a trusted shared catalog

The product promise that should survive the refactor is:

- search-first discovery with low friction
- trustworthy public-domain guidance and clear provenance
- guided catalog growth without exposing shared-write authority directly to the browser

## 2. Current State

### 2.1 Runtime shape

The current app is a React/Vite/Tailwind single-page app under `literary-light/`.

It currently provides these routes:

- `/`
- `/add-book`
- `/favorites`
- `/recommendations`
- `/moderation`
- `/author/:name`
- `/faq`

### 2.2 Authority and persistence

Today, the browser is doing too much.

Current implementation facts:

- authentication is simulated in-browser with `localStorage`
- user accounts are stored in `localStorage`
- favorites, comments, ratings, reviews, reading lists, theme, and country preferences are stored in `localStorage`
- the local full-stack path now serves catalog reads from a backend-owned catalog store
- local accepted Add Book records now persist through that backend-owned catalog store rather than a frontend overlay
- a legacy browser OpenAI helper still exists in the repo, but the active Add Book path now uses a privileged suggestion boundary instead

This does not meet the Trainio standard because browser state is currently acting as both authority and persistence.

Transitional implementation status:

- the frontend auth layer has now been refactored behind an explicit auth-client boundary
- a Cognito-backed frontend client has been implemented
- sign-up confirmation by emailed code is now supported in the frontend flow
- password-reset request and confirm-reset-password are now supported in the frontend flow
- frontend token storage is configured for `sessionStorage`
- non-local frontend runtime fallback is now fail-closed rather than silently degrading to local auth or seed/local data paths
- a public catalog client boundary now exists for books, FAQ entries, and author-book reads
- local public API handlers now serve catalog and FAQ content from a backend-owned store
- a privileged Add Book client boundary now exists for suggestion search, detail enrichment, and acceptance audit recording
- local privileged API handlers now provide Add Book suggestion search, details, and accept-audit routes
- local catalog and suggestion-audit persistence now use file-backed adapters when DynamoDB tables are not configured
- the authenticated backend surface can now verify Cognito bearer tokens directly when user-pool env vars are configured
- the CDK-managed local stack now deploys Lambda-backed public and authenticated runtimes behind an HTTP API
- the deployed `/auth/*` routes now use a Cognito JWT authorizer in API Gateway
- the CDK-managed local stack now also deploys a Lambda-backed privileged runtime behind the same HTTP API
- the deployed `/privileged/*` route now uses the Cognito JWT authorizer in API Gateway
- authenticated users can search, enrich, and submit Add Book suggestions for review
- moderator group members now get a dedicated `/moderation` queue in the main frontend for reviewing pending submissions
- shared-catalog publication now requires the Cognito moderator group `lightning-catalog-moderators-<env>`
- deployed Lambda auth now merges API Gateway authorizer claims with the verified Cognito token so moderator-group evaluation stays consistent between local and deployed runtimes
- the local auth-header bridge now requires `ALLOW_LOCAL_AUTH_HEADERS=true` and is not implicitly enabled by `APP_ENV=local`
- local fallback behavior still exists until AWS auth is provisioned for this project

### 2.3 Deployment drift

Current repo evidence shows legacy hosting/tooling drift:

- Lovable-generated README and Vite plugin references
- `render.yaml` committed in the app
- stakeholder-confirmed Replit usage, but no Replit config present in the repo
- a nested git repository under `literary-light/`

## 3. Non-Negotiable Constraints

The following constraints should guide every implementation slice:

- keep the visible UX and route structure as stable as possible
- keep anonymous browsing available
- keep core search and discovery usable without requiring an account
- move secrets off the frontend
- move authenticated actions behind real identity and backend authority
- separate frontend, backend, and contracts clearly
- keep all important build, test, deploy, and verify actions CLI-reproducible
- document public vs authenticated behavior explicitly
- preserve accessibility, clarity, and trust cues rather than optimizing only for engineering convenience

## 4. Approved Target State

### 4.1 Runtime components

The target AWS shape for Lightning Classics is:

- frontend SPA hosted on AWS Amplify
- CloudFront distribution managed through Amplify hosting
- Route 53 for `lightningclassics.com`
- ACM certificates for the custom domain
- Cognito for user identity
- Lambda-backed backend surfaces for authority, validation, and persistence orchestration
- DynamoDB for catalog and user-state persistence
- CloudWatch for logs and metrics
- IAM role separation per runtime surface
- S3 only where object storage is genuinely needed
- S3 is now also used for durable hosted-frontend release archive retention
- SES only if email customization or operational email requires it

AWS Organizations and AWS Support are account/governance concerns, not application runtime surfaces, but they remain part of the wider operating context.

Current codification status:

- the repo now includes dedicated CDK stacks for Route 53 DNS and Amplify frontend hosting
- hosted frontend delivery is now modeled separately for staging and production rather than being left as a one-off manual console step
- the hosted frontend stacks default to prep-only mode until GitHub repository access and optional domain association are explicitly enabled at deploy time
- manual Amplify artifact publishing is now environment-safe because the selected frontend hosting stack outputs are injected into the Vite build instead of relying on developer-local `.env.local`
- the hosted frontend stacks now emit a codified browser security-header baseline including `Content-Security-Policy` and `Cross-Origin-Resource-Policy`
- the hosted frontend stacks now also emit dedicated per-environment S3 release archive buckets so retained frontend rollback artifacts are durable rather than local-only
- staging and production now also have a codified CloudWatch operations baseline with low-noise alarms and dashboards
- staging and production now also have API Gateway access logs routed into dedicated CloudWatch log groups
- staging and production Lambda runtimes now run with active AWS X-Ray tracing
- staging and production now also have dedicated SNS alarm topics with codified CloudWatch alarms wired to them
- alarm-routing destinations are now deploy-time configuration rather than hard-coded infrastructure state

### 4.1.1 Hosted frontend delivery model

The approved hosted frontend model is:

- one dedicated Amplify app for staging
- one dedicated Amplify app for production
- branch-to-environment mapping kept explicit rather than inferred

Current baseline:

- staging app name `lightning-frontend-staging`
- production app name `lightning-frontend-prod`
- staging branch `staging`
- production branch `main`
- staging custom domain `staging.lightningclassics.com`
- production custom domain `lightningclassics.com`

This keeps long-lived environment isolation aligned with the backend stack model.

Hosted frontend hardening baseline:

- manual artifact deployment must resolve build-time runtime values from stack outputs for the selected environment
- hosted responses must include a restrictive CSP with explicit allowances only for the current public dependencies
- hosted artifacts must expose a machine-readable release manifest so live frontend provenance can be verified without guessing
- manual hosted releases should retain redeployable local artifacts with checksum metadata so frontend rollback stays operationally lightweight
- hosted responses must keep the existing no-cookie policy intact

### 4.1.2 Identity UX baseline

The approved identity UX baseline is:

- immutable Cognito username generated by the application
- sign-in allowed by verified email or immutable username
- sign-up confirmation by emailed 6-digit code
- password reset by emailed 6-digit code
- no cookie-based auth storage

Implementation status:

- the current modal auth surface now supports sign-in, sign-up, email verification, forgot-password request, and confirm-reset-password flows
- Cognito-backed auth uses Amplify with `sessionStorage`
- the local auth fallback mirrors the same modal flow for local verification consistency
### 4.1.3 Frontend certificate model

The current hosted frontend certificate baseline is:

- use Amplify-managed certificates by default
- allow an optional custom ACM certificate ARN only when policy or account controls require it

Custom-certificate rule:

- if a custom certificate is used for Amplify Hosting, it must be requested or imported in `us-east-1`

Implementation status:

- the CDK frontend hosting stacks now accept an optional `AmplifyCustomCertificateArn`
- leaving that value blank keeps the hosted frontend on the Amplify-managed certificate path

### 4.1.4 Resource naming standard

To avoid cross-project confusion, application-managed AWS resource names must use the `lightning-` prefix.

Required naming pattern:

- `lightning-<resource>-<env>`

Examples:

- `lightning-books-prod`
- `lightning-user-state-staging`
- `lightning-book-suggestions-prod`
- `lightning-users-prod`
- `lightning-public-api-prod`
- `lightning-auth-api-prod`

This naming rule applies to human-controlled resource names such as:

- DynamoDB tables
- Cognito user-pool names
- Cognito app-client names where naming is configurable
- identity-pool names if identity pools are introduced
- Lambda function names
- Amplify app names
- S3 bucket names, with any extra uniqueness suffix only where AWS requires it

Important distinction:

- generated identifiers such as Cognito user-pool IDs, app-client IDs, and hosted-zone IDs are AWS-assigned values and will not necessarily start with `lightning-`
- environment variables should continue to store those AWS-generated IDs where required, while the underlying resource names follow the `lightning-` naming convention

### 4.1.5 Environment rollout model

The approved long-lived environment model is:

- local
- staging
- production

Review environments remain encouraged, but they should stay ephemeral and branch-scoped in line with Yan Cui's serverless testing guidance rather than becoming a permanent fourth stack.

Current codification status:

- the CDK app now models `LightningLocalStack`, `LightningStagingStack`, and `LightningProductionStack`
- local remains the working deployed baseline today
- staging and production are now synthable from the repo with safer defaults for stateful resources than local

Environment defaults:

- local uses destructive cleanup defaults because it is the disposable developer environment
- staging uses `RETAIN` plus deletion protection for stateful resources
- production uses the same retained stateful-resource model plus CloudFormation termination protection

### 4.2 Boundary model

The app should be split into explicit surfaces.

#### Public surface

Anonymous-safe reads only:

- browse catalog
- search and filter books
- author pages
- FAQ and static support content
- read-only community content where public visibility preserves the existing discovery UX, such as comment threads, reviews, and aggregate rating signals

#### Authenticated surface

Requires Cognito-authenticated user context:

- favorites
- reading lists
- creating or deleting comments
- setting a personal rating
- creating or deleting reviews
- any user-specific recommendations

#### Privileged/moderated surface

Requires stricter control than normal signed-in usage:

- book-ingestion or suggestion enrichment workflows
- OpenAI-backed metadata generation if retained
- moderation queue reads and approve actions
- catalog write operations that affect shared library data
- moderation or approval of Add Book submissions before they affect the shared catalog

This split is important. Shared library writes should not remain anonymous browser actions.

### 4.2.1 Identity model

The approved Cognito model for Lightning Classics is:

- Cognito user pools for identity
- alias-based sign-in configuration, not username-attributes-only configuration
- sign-in allowed with immutable username or verified email address
- Cognito `sub` used as the immutable identity key in DynamoDB and backend authorization logic
- Cognito `username` generated by the application in the background and treated as immutable
- `preferred_username` not used as the primary identifier

The application-generated immutable username should:

- be lowercase
- avoid email format
- be short enough to type if needed
- never be user-editable

Recommended format:

- `lc_<ulid-or-equivalent>`

### 4.2.2 Verification and password policy

The approved verification and password model is:

- Cognito-assisted email verification enabled
- user signs up with email and password
- Cognito sends the confirmation code by email
- the frontend collects the confirmation code and calls Cognito confirmation APIs
- user cannot sign in until confirmation succeeds
- email updates must require reverification before the new value becomes active for sign-in

Password policy direction:

- minimum length 8
- require uppercase
- require lowercase
- require number
- require symbol
- do not store plaintext passwords anywhere outside Cognito

### 4.2.3 Browser session model

The approved browser-session model is:

- no cookie-based auth storage
- no CookieStorage usage in the frontend
- token storage via `sessionStorage` as the default browser persistence layer
- if stricter browser persistence is later required, shared in-memory storage can replace `sessionStorage`

Implementation status:

- this is now implemented in the frontend bootstrap path

### 4.3 Frontend/backend separation target

The repo should evolve toward a Trainio-style layout:

- `frontend/`
  browser app
- `backend/`
  Lambda/runtime code and deploy scripts
- `infra/`
  infrastructure-as-code for Cognito, DynamoDB, and later runtime deployment surfaces
- `contracts/`
  shared route contracts, DTOs, enums, and validation shapes
- `docs/`
  active project documentation
- `scripts/`
  repo-level verification and automation

The current `literary-light/` app is the functional starting point, not the desired end-state structure.

### 4.4 Data ownership target

Frontend responsibilities:

- rendering
- interaction patterns
- local transient UI state
- user flow coordination

Backend responsibilities:

- authorization
- validation
- persistence rules
- moderation rules
- secrets access
- OpenAI or third-party service calls that require secrets

Transitional implementation status:

- favorites and reading lists now sit behind an explicit frontend user-state client boundary
- backend route shapes and DynamoDB-backed handler code now exist for those features
- comments, reviews, and ratings now sit behind a dedicated community client boundary with public-read and authenticated-write local/API paths
- community reads for comments and reviews are now bounded server-side and return pagination metadata
- the frontend comments and reviews UX now consumes that pagination contract with explicit load-more controls instead of silently capping visibility at the first page
- comment and review writes now have explicit server-side length limits with matching frontend input constraints
- review writes are now constrained to one active review per user per book
- staging and production HTTP API stages now apply default-route throttling as a baseline API-edge abuse control
- staging and production HTTP API stages now also apply stricter route-level throttles for authenticated and privileged write surfaces behind the namespace catch-all routes
- manual hosted frontend publishes now run under a repo-local deploy lock so staging and production cannot race on the same build output
- books, FAQ entries, and author pages now have a dedicated public catalog client boundary with a local/API path
- Add Book enrichment and audit recording now sit behind a dedicated privileged client boundary with local/API paths
- Add Book submissions now flow through a backend-owned moderation queue in local mode
- moderator-only routes can publish, defer, or reject reviewed Add Book records
- a repeatable catalog seed/bootstrap command now exists for DynamoDB-backed environments
- a CDK-based local infrastructure layer now exists in `infra/`
- a repeatable local AWS bootstrap script now exists in `scripts/bootstrap-local-aws.mjs`
- a non-destructive local AWS ownership report now exists in `scripts/check-local-aws-ownership.mjs`
- a local DynamoDB backup/export command now exists in `scripts/export-local-dynamo-backup.mjs`
- the local infrastructure hardening runbook now lives in `docs/local-infrastructure-control.md`
- the public/auth runtime baseline is now deployed in the local CDK stack and live-verified with a real Cognito JWT
- the privileged deployed runtime is now also live in the local CDK stack and verified non-destructively
- the repo now also includes dedicated CDK stacks for hosted DNS and Amplify frontend delivery
- frontend cutover to hosted staging or production still remains a live deployment step rather than a code-level gap

### 4.5 Persistence target

DynamoDB should become the system of record for:

- books catalog
- user favorites
- reading-list state
- comments
- ratings
- reviews
- book suggestions or moderation queue items

Working decision:

- all durable Lightning Classics application data belongs in DynamoDB in cloud environments
- local file-backed persistence is acceptable only as the fast-feedback seam before AWS resources are provisioned

`localStorage` should remain only for low-risk local preferences where appropriate, such as theme, and not for cross-device user data or application authority.

### 4.5.1 Initial user-state table pattern

The current backend implementation direction uses a single user-state table for authenticated user state and book-community data.

Current code-level pattern:

- table name follows `lightning-user-state-<env>`
- partition key groups by authenticated user
- sort key separates entity type and book identity

Current key shape:

- `pk = USER#<cognito-sub>`
- `sk = FAVORITE#<bookId>`
- `sk = READING_LIST#<bookId>`
- `pk = BOOK#<bookId>`
- `sk = COMMENT#<commentId>`
- `sk = REVIEW#<reviewId>`
- `sk = RATING#USER#<cognito-sub>`

This is the first implemented DynamoDB pattern in the repo and should remain documented as it evolves.

### 4.5.2 Add-book auditability target

The product brief makes traceability an explicit quality goal for AI-assisted catalog growth.

That means the target backend design should preserve an audit trail for suggestion flows, including:

- raw user input
- enrichment outcome
- moderation or acceptance status
- resolved shared-catalog record when applicable

Current implementation status:

- local Add Book search, details, submit, and accept actions now record audit entries through the backend-owned suggestion store
- Add Book submissions now persist through the backend-owned local suggestion store
- moderator-only acceptance can publish a reviewed record into the backend-owned catalog store
- deferred and rejected decisions now persist moderator notes and last-decision metadata in the suggestion store
- the public/auth deployed runtime path is now live in the local CDK stack
- the privileged deployed runtime path is now also live in the local CDK stack
- the remaining design gap is now richer moderator workflow and lifecycle tooling rather than privileged-route policy

## 5. Route and Data Contract Direction

The project should introduce shared contracts for:

- public read routes
- authenticated write routes
- entity identifiers
- request and response shapes
- enums such as reading-list status and work type

Validation should be derived from those contracts rather than duplicated in both browser and backend logic.

## 6. Immediate Modernization Risks

The highest-risk current issues are:

- browser-exposed OpenAI usage
- fake auth implemented in `localStorage`
- user persistence implemented entirely in-browser
- no real trust boundary between anonymous and authenticated behavior
- repo/tooling drift across Lovable, Render, Replit history, and nested git state

## 7. Architectural Decisions To Hold Constant During Refactor

- preserve page-level UX where security does not require a change
- keep public reading/browsing open
- preserve trusted, low-friction discovery for anonymous users
- treat Cognito as the identity source of truth
- treat DynamoDB as the persistence source of truth
- keep backend calls thin at the edge and layered underneath
- avoid direct browser-to-database authority patterns
