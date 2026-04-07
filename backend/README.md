# Backend Scaffolding

This directory establishes the Trainio-style runtime separation for Lightning Classics.

Current runtime surfaces:

- `backend/public-api/`
  anonymous-safe reads
- `backend/auth-api/`
  authenticated user actions
- `backend/privileged-api/`
  privileged or moderated Add Book enrichment and audit flows
- `backend/shared/`
  shared edge helpers

These files are the beginning of the AWS runtime implementation.

Authority, validation, persistence, and external-service calls should be implemented behind these runtime surfaces rather than pushed back into the browser.

## Current Commands

From `backend/`:

- `npm install`
- `npm run build`
- `npm run typecheck`
- `npm run serve:local`
- `npm run dev`
- `npm run seed:catalog`
- `npm run import:catalog -- --input ../docs/examples/trusted-catalog-import.sample.json --dry-run`
- `npm run bootstrap:smoke-user`

## Local Testable Runtime

The backend now has a local HTTP runtime for developer verification.

Default local URL:

- `http://127.0.0.1:8787`

Default local behavior:

- `APP_ENV=local`
- local backend entrypoints auto-load `backend/.env` and then `backend/.env.local`
- file-backed user-state persistence when no DynamoDB table name is configured
- file-backed catalog persistence when no `BOOKS_TABLE_NAME` is configured
- local-only auth headers accepted for authenticated routes only when `ALLOW_LOCAL_AUTH_HEADERS=true`
- Cognito bearer tokens accepted for authenticated routes when `COGNITO_USER_POOL_ID` and `COGNITO_APP_CLIENT_ID` are configured
- file-backed Add Book suggestion audit persistence when no `BOOK_SUGGESTIONS_TABLE_NAME` is configured
- file-backed Add Book submission persistence when no `BOOK_SUGGESTIONS_TABLE_NAME` is configured
- optional backend OpenAI usage for Add Book enrichment, with offline fallback when `OPENAI_API_KEY` is absent

Important:

- the local auth-header bridge is for local development only
- JWT/Cognito remains the only approved auth path for non-local environments
- local persistence is a fast-feedback seam, not the production architecture

## Current Persistence Status

Implemented in code:

- DynamoDB-backed repository and service support for shared catalog reads and writes
- trusted-metadata bulk catalog import path for compact JSON or NDJSON inputs
- DynamoDB-backed repository and service support for favorites
- DynamoDB-backed repository and service support for reading lists
- backend Cognito bearer-token verification for authenticated routes
- authenticated route handlers for those features
- CORS preflight handling for authenticated browser calls
- local HTTP dev server plus file-backed local user-state adapter
- local HTTP dev server plus file-backed local catalog adapter
- privileged Add Book suggestion search, detail, submit, and moderator-accept handlers
- local file-backed Add Book suggestion store adapter
- DynamoDB catalog seed/bootstrap command
- deployed Lambda-backed public and authenticated runtime surfaces in the local CDK stack
- deployed Lambda-backed privileged runtime surface in the local CDK stack
- API Gateway HTTP API wiring plus Cognito JWT authorizer for deployed `/auth/*`
- API Gateway HTTP API wiring plus Cognito JWT authorizer for deployed `/privileged/*`

## Local AWS-Backed Run Path

To run the app locally with real Cognito and DynamoDB:

1. run `env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs`
2. start the backend with `npm run dev`

This bootstrap script:

- resolves or creates the `lightning-*` local Cognito and DynamoDB resources
- refreshes `backend/.env.local` and `literary-light/.env.local`
- reruns `npm run seed:catalog` unless `--skip-seed` is provided

Smoke-user bootstrap:

- `npm run bootstrap:smoke-user` now confirms or creates the local smoke user, enforces the supplied password, removes temporary moderator access, and seeds the minimum DynamoDB-backed user-state baseline
- `scripts/bootstrap-local-aws.mjs --ensure-smoke-user` now runs that helper as part of the integrated local bootstrap path

Trusted catalog import:

- `npm run import:catalog -- --input ../docs/examples/trusted-catalog-import.sample.json --dry-run`
- `npm run import:catalog -- --input /absolute/path/to/trusted-catalog.json`
- the importer accepts:
  - a JSON array of compact book records
  - a JSON object with a top-level `books` array
  - NDJSON / JSONL files with one record per line
- supported record fields are intentionally compact:
  - `title`
  - `author` or `authors`
  - optional metadata such as `year`, `country`, `category`, `workType`, `summary`, `authorBio`, `tags`, `source`, and `publicDomainNotes`
- the importer keeps catalog growth cost-effective by:
  - reading a local metadata file instead of calling AI or external APIs
  - deduping against the existing catalog before writes
  - deduping repeated title/author pairs within the same import file
  - skipping records explicitly marked non-public-domain
  - storing only compact catalog metadata in DynamoDB or the local file-backed catalog store
- optional flags:
  - `--dry-run`
  - `--limit <count>`
  - `--default-source <value>`
  - `--default-public-domain-notes <value>`

Local data recovery:

- `/Users/steve/Documents/GitHub/Lightning/scripts/export-local-dynamo-backup.mjs` exports the current local DynamoDB tables into `backend/.local/backups/`
- `/Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs --dry-run` now reports a restore plan against the current local stack
- `/Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs --backup-dir ...` now restores exported items back into the current local tables

Current local AWS-backed baseline on this machine:

- region: `eu-west-2`
- Cognito user pool name: `lightning-users-local`
- Cognito user pool ID: `eu-west-2_XUvLTh3ek`
- Cognito app client name: `lightning-web-local`
- Cognito app client ID: `g7bdf28kd08fse6lhtsle0fci`
- Cognito moderator group: `lightning-catalog-moderators-local`
- DynamoDB tables:
  - `lightning-books-local`
  - `lightning-user-state-local`
  - `lightning-book-suggestions-local`
- expected local frontend origin: `http://127.0.0.1:5175`
- deployed local-stack API outputs:
  - `HttpApiUrl`
  - `PublicApiBaseUrl`
  - `AuthApiBaseUrl`
  - `PrivilegedApiBaseUrl`

Current live local-stack runtime verification:

- public/auth routes are live through API Gateway and Lambda
- privileged Add Book search/details/submit are live through API Gateway and Lambda for authenticated users
- moderator queue reads are live through API Gateway and Lambda for moderator users
- moderator defer/reject decisions with notes are live through the local Node backend and the deployed API Gateway/Lambda path
- non-moderator privileged accept returns `403`
- duplicate-protected privileged accept returns `409 Conflict` for existing catalog titles when the moderator path is used
- browser-led deployed verification now also covers comment create/delete, rating persistence, and review create/delete
- browser-led deployed verification can also confirm the loaded moderation queue when `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
- browser-led deployed verification can now also execute a real moderator reject or defer decision against a deterministic synthetic submission
