# Lightning Classics Runtime Configuration

## Status

This document records:

- current runtime configuration found in the repo
- target runtime configuration expected after AWS modernization

Anything marked as target-state is not yet implemented unless noted otherwise.

Working rule:

- all durable Lightning Classics application data should live in DynamoDB in cloud environments
- local file-backed persistence remains an approved fast-feedback seam until AWS resources are provisioned

## 1. Current Configuration

### 1.1 Frontend variables still present in legacy code paths

#### `VITE_OPENAI_API_KEY`

Scope:

- frontend

Used by:

- `literary-light/src/services/openai.ts`

Required today:

- no for the active add-book flow

Status:

- legacy
- inactive in the primary Add Book path
- should not be set in new environments
- can be removed completely once the legacy helper file is retired

Reason:

- browser-exposed secrets do not meet the approved security model
- the active Add Book flow now uses a privileged backend/local client boundary instead

## 2. Target Frontend Configuration

Frontend configuration must contain only public, browser-safe values.

Implementation status:

- the frontend runtime config module now consumes Cognito and API base-URL variables
- the frontend Amplify bootstrap now activates only when Cognito config is present
- the frontend auth flow now depends on the Cognito variables below when running in Cognito mode

### `VITE_APP_ENV`

Scope:

- frontend

Required:

- yes

Example:

- `local`
- `review`
- `staging`
- `production`

Approved long-lived baseline:

- `local`
- `staging`
- `production`

Notes:

- `review` remains reserved for ephemeral preview and test environments rather than a permanent long-lived stack
- the production application environment string stays `production` even though human-readable AWS resource names use the suffix `prod`

### `VITE_AWS_REGION`

Scope:

- frontend

Required:

- yes

Purpose:

- regional identity/runtime configuration

### `VITE_COGNITO_USER_POOL_ID`

Scope:

- frontend

Required:

- yes once Cognito is integrated

### `VITE_COGNITO_USER_POOL_CLIENT_ID`

Scope:

- frontend

Required:

- yes once Cognito is integrated

Notes:

- this should be a public app client for the SPA
- do not expose a Cognito app client secret in the frontend

### `VITE_COGNITO_IDENTITY_POOL_ID`

Scope:

- frontend

Required:

- optional

Use only if:

- the browser must obtain scoped AWS credentials for an approved use case

### `VITE_API_PUBLIC_BASE_URL`

Scope:

- frontend

Required:

- yes once public API reads are introduced

Use for:

- public catalog reads
- FAQ and author-page reads
- anonymous-safe book-community reads such as comments, reviews, and aggregate rating data

Implementation status:

- the frontend catalog client now uses this value for books, FAQ entries, and author-book reads
- if this value is absent, those reads continue to use the local in-app seed fallback
- the current workspace default still points this at the local Node backend for fast feedback
- this value can also point at the deployed `PublicApiBaseUrl` output from `LightningLocalStack` for AWS-backed verification
- the new `npm run smoke:staging` path now temporarily points it at the deployed staging API Gateway URL while still serving the frontend from `http://127.0.0.1:5175`

### `VITE_API_AUTH_BASE_URL`

Scope:

- frontend

Required:

- yes once authenticated backend routes are introduced

Implementation status:

- the frontend favorites and reading-lists client boundary now switches to authenticated HTTP mode when this value is configured
- if this value is absent, those features continue to use the local fallback client
- in local mode without Cognito, the frontend now uses a local-only auth-header bridge for backend testing
- authenticated community writes now also use this base URL when configured
- the current workspace default still points this at the local Node backend for fast feedback
- this value can also point at the deployed `AuthApiBaseUrl` output from `LightningLocalStack` for AWS-backed verification
- the staging smoke path now uses the live `LightningStagingStack` auth API URL

### `VITE_API_PRIVILEGED_BASE_URL`

Scope:

- frontend

Required:

- recommended once Add Book enrichment is routed through backend authority

Use for:

- Add Book suggestion search
- Add Book suggestion details lookup
- moderation queue reads
- moderator publish, defer, and reject actions
- Add Book suggestion acceptance audit

Implementation status:

- the frontend Add Book flow and moderator queue now use this value when configured
- if this value is absent, the Add Book HTTP client falls back to the authenticated or public API base URL before finally using the local offline suggestion client
- no browser secret is required for the active Add Book path
- the current workspace still points this at the local Node backend by default for fast feedback
- this value can also point at the deployed `PrivilegedApiBaseUrl` output from `LightningLocalStack` for AWS-backed verification
- the staging smoke path now uses the live `LightningStagingStack` privileged API URL

### `VITE_SITE_URL`

Scope:

- frontend

Required:

- recommended

Purpose:

- canonical URL generation and environment-aware links

Expected baseline values:

- local: `http://127.0.0.1:5175`
- staging: `https://staging.lightningclassics.com`
- production: `https://lightningclassics.com`

Implementation note:

- during browser-led staging verification, the local Vite dev server still runs at `http://127.0.0.1:5175`, but `VITE_SITE_URL` is temporarily set to the staging site URL and the staging API allows that local origin for smoke testing
- the live hosted staging frontend now serves from both `https://staging.dy2grocxp5fe9.amplifyapp.com` and `https://staging.lightningclassics.com`, with `https://staging.lightningclassics.com` as the canonical URL
- during browser-led production pre-cutover verification, the local Vite dev server still runs at `http://127.0.0.1:5175`, but `VITE_SITE_URL` is temporarily set to `https://lightningclassics.com`
- the live hosted production frontend now serves from both `https://main.d1te9vk2z7t41u.amplifyapp.com` and `https://lightningclassics.com`, with `https://lightningclassics.com` as the canonical URL

### `VITE_CATALOG_MODERATOR_GROUP_NAME`

Scope:

- frontend

Required:

- recommended once moderator-only frontend affordances are enabled

Use for:

- deciding whether to expose the `/moderation` route and moderator navigation

Implementation status:

- populated into `literary-light/.env.local` by `scripts/bootstrap-local-aws.mjs`
- defaults to `lightning-catalog-moderators-<env>` when unset
- used by the frontend auth/runtime layer to determine moderator access in the main app shell

### Frontend auth storage rule

The frontend must configure Amplify/Cognito token storage to use `sessionStorage`, not cookies.

Cookie-based auth storage is prohibited for this project.

Implementation status:

- implemented in `literary-light/src/config/amplify.ts`
- local frontend development in this workspace is now wired through `literary-light/.env.local`
- current local frontend AWS region baseline is `eu-west-2`

### Hosted frontend build-time injection

Scope:

- Amplify-hosted staging and production frontend branches

Required:

- yes for hosted frontend deployment

Current implementation status:

- the CDK frontend hosting stacks now inject branch-level build variables for:
  - `VITE_APP_ENV`
  - `VITE_AWS_REGION`
  - `VITE_COGNITO_USER_POOL_ID`
  - `VITE_COGNITO_USER_POOL_CLIENT_ID`
  - `VITE_CATALOG_MODERATOR_GROUP_NAME`
  - `VITE_API_PUBLIC_BASE_URL`
  - `VITE_API_AUTH_BASE_URL`
  - `VITE_API_PRIVILEGED_BASE_URL`
  - `VITE_SITE_URL`
- staging and production hosted frontend builds therefore consume the same runtime contract shape as local development, without introducing a separate browser configuration model

### Hosted frontend connection parameters

Scope:

- CDK deploy-time parameters for Amplify hosting

Current baseline:

- `AmplifyDeploymentMode`
  - defaults to `MANUAL`
  - switch to `REPOSITORY` only when GitHub-connected Amplify CI/CD is intentionally enabled
- `AmplifyRepositoryUrl`
  - defaults to `https://github.com/mutantnewt/Lightning`
- `AmplifyAccessToken`
  - required only when `AmplifyDeploymentMode=REPOSITORY`
- `EnableCustomDomainAssociation`
  - defaults to `false` until DNS delegation is in place
- `AmplifyCustomCertificateArn`
  - optional
  - if used, it must point to a certificate in `us-east-1`

## 3. Target Backend Configuration

Backend configuration may contain secrets and authority-bearing values, but only on backend runtime surfaces.

### Resource naming rule

Where a backend environment variable points to a human-named AWS resource, the resource name must be prefixed with `lightning-`.

Preferred pattern:

- `lightning-<resource>-<env>`

Important distinction:

- table names and Cognito user-pool names are human-controlled and must follow this prefix rule
- values such as Cognito user-pool IDs and app-client IDs are AWS-generated identifiers and are not expected to start with `lightning-`

### `APP_ENV`

Scope:

- backend

Required:

- yes

### `AWS_REGION`

Scope:

- backend

Required:

- yes

Current local baseline:

- `eu-west-2`

### `BOOKS_TABLE_NAME`

Scope:

- backend

Required:

- yes once catalog persistence moves to DynamoDB

Example value:

- `lightning-books-prod`

Implementation status:

- active in code when configured
- local runs without this variable now fall back to a file-backed catalog store for fast feedback
- the target cloud system of record for catalog and FAQ data remains DynamoDB
- `backend/scripts/seedCatalog.ts` now provides the catalog bootstrap path for DynamoDB-backed environments

### `LOCAL_CATALOG_FILE`

Scope:

- backend

Required:

- optional for local-only development

Default behavior:

- local catalog storage defaults to `backend/.local/lightning-catalog-local.json`

Purpose:

- controls the path used by the local file-backed catalog adapter while the local test seam remains file-backed

### `USER_STATE_TABLE_NAME`

Scope:

- backend

Required:

- yes once favorites, reading lists, ratings, reviews, and comments move to DynamoDB

Example value:

- `lightning-user-state-prod`

This may later become one consolidated app table, but the runtime contract should still document the final table name explicitly.

Implementation status:

- backend auth handlers for favorites and reading lists now expect this table when deployed
- current code uses it as the initial authenticated user-state table for favorites and reading-list items
- the next community-data slice extends the same table pattern with book-scoped comments, reviews, and ratings

### `USER_STATE_STORAGE_MODE`

Scope:

- backend

Required:

- optional

Allowed values:

- `dynamodb`
- `file`

Default behavior:

- local runs without `USER_STATE_TABLE_NAME` fall back to file storage
- non-local runs default to DynamoDB

Current implementation status:

- local backend runs now store favorites, reading lists, comments, reviews, and ratings in the local file store when file mode is active

Purpose:

- explicit override for local versus DynamoDB-backed user-state persistence

### `LOCAL_STATE_FILE`

Scope:

- backend

Required:

- optional for local-only development

Default behavior:

- local file storage defaults to `backend/.local/lightning-user-state-local.json`

Purpose:

- controls the path used by the local file-backed user-state adapter

### `BOOK_SUGGESTIONS_TABLE_NAME`

Scope:

- backend

Required:

- recommended if add-book submissions are moderated separately from the live catalog

Example value:

- `lightning-book-suggestions-prod`

Implementation status:

- active in code when configured
- local Add Book auditability currently uses a file-backed adapter instead

### `LOCAL_BOOK_SUGGESTIONS_FILE`

Scope:

- backend

Required:

- optional for local-only development

Default behavior:

- local suggestion audit storage defaults to `backend/.local/lightning-book-suggestions-local.json`

Purpose:

- controls the path used by the local file-backed Add Book audit adapter

### `COGNITO_USER_POOL_ID`

Scope:

- backend

Required:

- yes for authenticated route validation and user-management integrations

Naming note:

- this variable stores the AWS-generated user-pool ID
- the corresponding Cognito user-pool name should still use a `lightning-` prefix, for example `lightning-users-prod`

Implementation status:

- active in code for backend bearer-token verification when Cognito-backed auth is enabled

### `COGNITO_APP_CLIENT_ID`

Scope:

- backend

Required:

- recommended

Purpose:

- backend-side verification and Cognito user-management flows where needed

Naming note:

- this variable stores the AWS-generated app-client ID
- the corresponding app-client name should still use a `lightning-` prefix, for example `lightning-web-prod`

Implementation status:

- active in code for backend Cognito JWT client validation when bearer-token verification is enabled

### `ALLOW_LOCAL_AUTH_HEADERS`

Scope:

- backend

Required:

- no

Allowed values:

- `true`
- unset or any other value disables the bridge

Use only if:

- the local Node backend must accept the repo's development-only `x-lightning-local-*` headers

Implementation status:

- local Node development now sets this explicitly through `backend/.env.local`
- deployed Lambda runtimes must leave this unset so Cognito JWT validation remains the only authenticated path
- the local bridge now also accepts `x-lightning-local-user-groups` for local-only moderator-path verification
- deployed runtimes now merge API Gateway JWT-authorizer claims with the verified bearer token so group-based authorization remains consistent without relying on this bridge

### `CATALOG_MODERATOR_GROUP_NAME`

Scope:

- backend

Required:

- yes

Example:

- `lightning-catalog-moderators-local`
- `lightning-catalog-moderators-prod`

Use only if:

- moderator-only publication must be enforced for shared catalog writes

Implementation status:

- populated from `LightningLocalStack` outputs by `scripts/bootstrap-local-aws.mjs`
- used by the privileged backend to protect `/privileged/book-suggestions/submissions`, `/privileged/book-suggestions/accept`, and `/privileged/books`

### `CORS_ALLOW_ORIGIN`

Scope:

- backend

Required:

- yes

Example:

- `https://lightningclassics.com`
- `http://127.0.0.1:5175` for local frontend development

Implementation status:

- backend HTTP helpers now apply this origin to API responses and preflight handling
- the production steady-state deployment now exposes only:
  - `https://lightningclassics.com`
- the repo now also supports temporary pre-cutover hosted-frontend verification through the `extraCorsOrigins` CDK context and `LIGHTNING_EXTRA_CORS_ORIGINS`
- `prepare:staging:hosted-smoke` and `prepare:production:hosted-smoke` use that path to add the default Amplify hostname to backend CORS while the custom domains are still pending
- current pre-cutover hosted-smoke origins now include:
  - staging `https://staging.dy2grocxp5fe9.amplifyapp.com`
  - production `https://main.d1te9vk2z7t41u.amplifyapp.com`
- after custom-domain cutover on 2026-04-03, the production stack was redeployed through `deploy:frontend:production` and the temporary localhost/default-Amplify production origins were removed from `CorsAllowedOrigins`
- the final cutover flow now also verifies that the temporary default Amplify production origin is removed from `CorsAllowedOrigins`

### `OPENAI_API_KEY`

Scope:

- backend

Required:

- optional

Use only if:

- AI-assisted book enrichment remains part of the product after migration

Current implementation status:

- the privileged local/backend Add Book flow uses this when configured
- if absent, local Add Book verification still works by falling back to a deterministic offline suggestion catalog

### `SES_FROM_EMAIL`

Scope:

- backend

Required:

- optional

Use only if:

- the project adds SES-backed email behavior

### `LOG_LEVEL`

Scope:

- backend

Required:

- recommended

## 3.1 Local Env File Loading

Backend local entrypoints now load runtime variables in this order:

- shell-defined environment variables
- `backend/.env.local`
- `backend/.env`

Frontend local Vite development continues to use Vite's standard `.env` and `.env.local` handling.

Implementation status:

- `backend/dev-server.ts` and `backend/scripts/seedCatalog.ts` now auto-load local backend env files
- `backend/.env.local` and `literary-light/.env.local` are now populated in this workspace for the current local AWS-backed setup
- `scripts/bootstrap-local-aws.mjs` now refreshes those `.env.local` files from the resolved local AWS resource IDs
- when `LightningLocalStack` exists, `scripts/bootstrap-local-aws.mjs` now prefers CloudFormation outputs as the local source of truth
- `scripts/bootstrap-local-aws.mjs --require-cdk` now provides a stack-only env refresh path once local AWS ownership is hardened
- the stack outputs also expose deployed `PublicApiBaseUrl`, `AuthApiBaseUrl`, and `PrivilegedApiBaseUrl`, but switching the frontend from the local Node backend to those deployed URLs remains an explicit opt-in step
- `LIGHTNING_FRONTEND_API_MODE=deployed-api` now provides that explicit opt-in switch when running `scripts/bootstrap-local-aws.mjs`
- `scripts/run-deployed-frontend-smoke.mjs` now packages that switch, a temporary frontend dev server, the browser smoke, and safe restoration back to `local-backend` mode into one repeatable command

## 4. Secrets Handling Rules

- no secrets in frontend environment variables
- no OpenAI key in browser code
- Cognito tokens prove identity but do not replace backend authorization checks
- backend secrets should be stored in approved AWS secret/config facilities
- environment docs must be updated whenever a variable is added, removed, or renamed
- no cookie-based token persistence for frontend auth

## 5. Legacy Browser State To Retire As System Of Record

The following current browser-managed state must move out of `localStorage` as the modernization progresses:

- auth session and user records
- favorites
- reading lists
- comments
- ratings
- reviews
- user-added shared catalog records

Low-risk local preferences may remain browser-local if desired:

- theme
- non-authoritative display preferences
