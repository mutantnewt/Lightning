# Lightning Classics Environment Topology

## Status

This document records what exists now and the target AWS environment shape for Lightning Classics.

Where something does not exist yet, that is stated explicitly.

## 1. Current Baseline

### 1.1 Local environment

The repo currently supports local frontend-oriented development from:

- `literary-light/`

Current local commands are centered on the Vite app only.

### 1.2 Hosted environment baseline

Current hosted history is not yet a single clean canonical story.

Known facts:

- the app contains Lovable project metadata
- the app contains a Render static-hosting config
- stakeholder guidance says the app was also deployed via Replit

Repo evidence for Replit-specific runtime configuration is not present today.

### 1.3 AWS environment baseline

No project-specific AWS environment topology document existed before this one.

A codified Lightning Classics AWS deployment implementation now exists in this repo under `infra/`.

Transitional implementation status:

- frontend code is now prepared to consume Cognito runtime configuration once AWS resources exist
- local Lightning Classics AWS resources are now provisioned in `eu-west-2`
- the current local AWS-backed baseline is:
  - Cognito user-pool name `lightning-users-local`
  - Cognito user-pool ID `eu-west-2_XUvLTh3ek`
  - Cognito app-client name `lightning-web-local`
  - Cognito app-client ID `g7bdf28kd08fse6lhtsle0fci`
  - DynamoDB tables `lightning-books-local`, `lightning-user-state-local`, and `lightning-book-suggestions-local`
  - Lambda functions `lightning-public-api-local`, `lightning-auth-api-local`, and `lightning-privileged-api-local`
  - an HTTP API whose base URL is emitted as the `HttpApiUrl`, `PublicApiBaseUrl`, `AuthApiBaseUrl`, and `PrivilegedApiBaseUrl` stack outputs

## 2. Target Environment Model

The approved long-lived target shape is:

- local
- staging
- production

Review environments remain approved as optional and ephemeral, not as a permanent fourth long-lived stack.

## 3. Environment Matrix

### 3.1 Local

Purpose:

- day-to-day development and verification

Target shape:

- local frontend dev server
- local or cloud-backed backend integration depending on implementation slice
- CLI-reproducible auth/config setup

Hostname:

- local-only
- current frontend default is `http://127.0.0.1:5175`

Status:

- exists today for frontend work
- a testable local backend runtime now exists for authenticated user-state work, public catalog reads, and privileged Add Book suggestion flows

Current local implementation:

- frontend can run with local auth or Cognito-backed auth and the local API base URLs
- backend can run as a local HTTP server on `127.0.0.1:8787`
- backend local entrypoints now auto-load `backend/.env` and `backend/.env.local`
- `scripts/bootstrap-local-aws.mjs` now provides the repeatable local resource reconciliation/bootstrap path for Cognito, DynamoDB, env-file wiring, and catalog seeding
- `scripts/bootstrap-local-aws.mjs` now prefers CloudFormation stack outputs when `LightningLocalStack` exists and can be forced into stack-only mode with `--require-cdk`
- `scripts/check-local-aws-ownership.mjs` now reports whether the local AWS resources are stack-managed or still manual
- `scripts/export-local-dynamo-backup.mjs` now provides a non-destructive DynamoDB backup/export step before local cutover
- authenticated local HTTP calls use a local-only auth-header bridge only when `ALLOW_LOCAL_AUTH_HEADERS=true`
- authenticated local HTTP calls can also use Cognito bearer tokens when the user-pool env is configured
- favorites and reading lists persist to a local file by default in local mode
- public API reads can share the same local backend base URL
- books, FAQ entries, and author-book reads now have a real local public-read HTTP path
- catalog content now persists locally in `backend/.local/lightning-catalog-local.json` when `BOOKS_TABLE_NAME` is not configured
- comments, reviews, and rating summaries now have a real local public-read HTTP path
- privileged Add Book suggestion routes can share the same local backend base URL
- Add Book suggestion audit entries write to `backend/.local/lightning-book-suggestions-local.json` by default
- Add Book submissions now write through the backend into the local suggestion store by default
- moderator-approved Add Book publication writes through the backend into the local catalog store
- if `OPENAI_API_KEY` is not configured locally, Add Book suggestion verification falls back to a deterministic offline suggestion catalog
- the local stack now also exposes deployed public, authenticated, and privileged Lambda/API Gateway surfaces for AWS-backed verification without replacing the local Node backend
- the deployed `/auth/*` routes are protected by a Cognito JWT authorizer in API Gateway
- the deployed `/privileged/*` routes are protected by the same Cognito JWT authorizer in API Gateway
- moderator-only shared-catalog publication is controlled by `lightning-catalog-moderators-<env>`
- `scripts/bootstrap-local-aws.mjs` can now switch the frontend `.env.local` between `local-backend` mode and `deployed-api` mode for repeatable browser-led verification
- the main frontend now includes a moderator-only `/moderation` page backed by the privileged API surface
- the browser smoke can now verify the loaded moderation queue when `LIGHTNING_SMOKE_VERIFY_MODERATION=true` and the signed-in user is temporarily placed in the moderator group
- local and deployed privileged routes now support `pending_review`, `deferred`, and `rejected` moderation states in addition to `accepted`

Important:

- this local path is for fast feedback and contract verification
- it does not replace higher-confidence AWS-backed verification
- this workspace now also has a real local AWS-backed path, not only the file-backed seam
- the CDK app now models local, staging, and production explicitly while preserving the current local stack name and behavior

### 3.2 Review

Purpose:

- branch or PR validation without touching production

Target shape:

- Amplify preview deployment for frontend
- backend review strategy to be defined alongside backend rollout

Hostname:

- Amplify-generated preview URL

Status:

- not yet created
- intentionally kept out of the long-lived CDK stack set for now

Testing-strategy note:

- following Yan Cui's guidance, the long-term preference is ephemeral review environments for high-confidence serverless testing after the fast local feedback loop is in place
- local testing stays valuable, but cloud-backed remote and end-to-end tests should be added as the next maturity step

Reference:

- [Why you should use ephemeral environments when you do serverless](https://theburningmonk.com/2019/09/why-you-should-use-temporary-stacks-when-you-do-serverless/)

### 3.3 Staging

Purpose:

- pre-production verification against AWS-managed runtime surfaces

Target shape:

- dedicated staging frontend
- dedicated staging Cognito
- dedicated staging Lambda surfaces
- dedicated staging DynamoDB resources

Hostname:

- `https://staging.lightningclassics.com`

Status:

- deployed in `eu-west-2` on 2026-04-02

Current staging implementation:

- stack id `LightningStagingStack`
- API base URL `https://pbs76ug4gc.execute-api.eu-west-2.amazonaws.com`
- Cognito user-pool name `lightning-users-staging`
- Cognito user-pool ID `eu-west-2_8k7xYV4Bi`
- Cognito app-client name `lightning-web-staging`
- Cognito app-client ID `54fkqa4iernu1lh2bs8ddcrp4d`
- DynamoDB tables `lightning-books-staging`, `lightning-user-state-staging`, and `lightning-book-suggestions-staging`
- Lambda functions `lightning-public-api-staging`, `lightning-auth-api-staging`, and `lightning-privileged-api-staging`
- API Gateway access log group `/aws/apigateway/lightning-http-api-access-staging`
- SNS alarm topic `lightning-operations-alerts-staging`
- configured alarm-notification email count `0`
- current confirmed live alarm-destination count `0`
- route-level API throttling now further tightens authenticated and privileged writes on top of the stage default throttle
- staging API CORS now explicitly allows both:
  - `https://staging.lightningclassics.com`
  - `http://127.0.0.1:5175`
  - `https://staging.dy2grocxp5fe9.amplifyapp.com`

Verification status:

- staging catalog was seeded from the repo
- a dedicated staging smoke user was bootstrapped successfully
- browser-led staging verification now passes against the live API Gateway runtime from the local Vite dev server
- browser-led hosted staging verification now also passes against the live Amplify frontend on `https://staging.dy2grocxp5fe9.amplifyapp.com`
- the codified staging default-Amplify CORS refresh path was revalidated on 2026-04-02 with `prepare:staging:hosted-smoke:force`
- the staging manual Amplify artifact path now builds from `LightningStagingFrontendStack` outputs instead of developer-local `.env.local`
- the staging default Amplify host now returns the codified `Content-Security-Policy` and `Cross-Origin-Resource-Policy` headers
- the staging default Amplify host now also exposes `/lightning-release.json` for release verification
- the staging hosted frontend now also has a retained local release archive under `.local/frontend-releases/staging/`
- the staging hosted frontend now also has a durable remote release-archive bucket `lightning-frontend-releases-staging-310505389001-eu-west-2`
- all retained staging hosted-frontend releases now also exist in the staging S3 archive bucket after the backfill sync
- retained staging hosted-frontend archive integrity can now be verified directly against S3 with `frontend:release:verify:staging`
- the staging remote-restore redeploy path has now been live-rehearsed from S3 with hosted browser smoke after the restore
- the latest staging retained release has now been live-restored from that S3 bucket by redeploying from an empty temporary archive root
- staging API Gateway access logs are now live in `/aws/apigateway/lightning-http-api-access-staging`
- staging Lambda tracing is now active for public, authenticated, and privileged runtimes
- staging codified alarms now all publish to `arn:aws:sns:eu-west-2:310505389001:lightning-operations-alerts-staging`
- staging alarm subscription readiness is now visible in `ops:status`
- staging `ops:status` now only reports alarm-subscription readiness once at least one destination is confirmed, unless a higher configured-email target is in use
- the Amplify-hosted staging frontend stack is now deployed as `LightningStagingFrontendStack`
- staging hosted-frontend outputs are now:
  - Amplify app ID `dy2grocxp5fe9`
  - default domain `dy2grocxp5fe9.amplifyapp.com`
  - hosted staging URL `https://staging.dy2grocxp5fe9.amplifyapp.com`
  - deployment mode `MANUAL`
- the default Amplify staging URL now responds successfully over HTTPS
- the custom staging hostname `https://staging.lightningclassics.com` now responds successfully over HTTPS
- browser-led hosted staging verification now also passes against `https://staging.lightningclassics.com`
- the repo now includes a dedicated cutover-readiness checker and attach-domain helper so staging/production domain attachment can be executed only after delegation is confirmed
- the repo now also includes a dedicated hosted-domain verification helper so post-attach health can be checked before production lock-down
- the repo now also includes a final cutover orchestrator so post-delegation attach, verification, and production lock-down can be executed as one guarded sequence

### 3.4 Production

Purpose:

- public live environment

Target shape:

- Amplify-hosted frontend
- CloudFront delivery
- Route 53 custom domain routing
- ACM-managed TLS
- Cognito identity
- Lambda-backed backend surfaces
- DynamoDB persistence
- CloudWatch observability

Hostname:

- `https://lightningclassics.com`
- `https://www.lightningclassics.com` can be added later as a redirect or secondary host, but the canonical application origin is `https://lightningclassics.com`

Status:

- deployed in `eu-west-2` on 2026-04-02

Current production implementation:

- stack id `LightningProductionStack`
- API base URL `https://ejyo5np488.execute-api.eu-west-2.amazonaws.com`
- Cognito user-pool name `lightning-users-prod`
- Cognito user-pool ID `eu-west-2_Pi9wmd5S9`
- Cognito app-client name `lightning-web-prod`
- Cognito app-client ID `7nhs7brc3dphqg1dlaovinlbar`
- DynamoDB tables `lightning-books-prod`, `lightning-user-state-prod`, and `lightning-book-suggestions-prod`
- Lambda functions `lightning-public-api-prod`, `lightning-auth-api-prod`, and `lightning-privileged-api-prod`
- API Gateway access log group `/aws/apigateway/lightning-http-api-access-prod`
- SNS alarm topic `lightning-operations-alerts-prod`
- configured alarm-notification email count `0`
- current confirmed live alarm-destination count `0`
- route-level API throttling now further tightens authenticated and privileged writes on top of the stage default throttle
- production API CORS now allows only:
  - `https://lightningclassics.com`
- the Amplify-hosted production frontend stack is now deployed as `LightningProductionFrontendStack`
- production hosted-frontend outputs are now:
  - Amplify app ID `d1te9vk2z7t41u`
  - default domain `d1te9vk2z7t41u.amplifyapp.com`
  - hosted production URL `https://main.d1te9vk2z7t41u.amplifyapp.com`
  - deployment mode `MANUAL`

Verification status:

- production catalog was seeded from the repo
- a dedicated production smoke user was bootstrapped successfully
- browser-led production verification now passes against the live production API Gateway runtime from the local Vite dev server
- browser-led hosted production verification now also passes against the live Amplify frontend on `https://main.d1te9vk2z7t41u.amplifyapp.com`
- the codified production default-Amplify CORS refresh path was revalidated on 2026-04-02 with `prepare:production:hosted-smoke:force`
- the production manual Amplify artifact path now builds from `LightningProductionFrontendStack` outputs instead of developer-local `.env.local`
- the production default Amplify host now returns the codified `Content-Security-Policy` and `Cross-Origin-Resource-Policy` headers
- the production default Amplify host now also exposes `/lightning-release.json` for release verification
- the production hosted frontend now also has a retained local release archive under `.local/frontend-releases/production/`
- the production hosted frontend now also has a durable remote release-archive bucket `lightning-frontend-releases-prod-310505389001-eu-west-2`
- all retained production hosted-frontend releases now also exist in the production S3 archive bucket after the backfill sync
- retained production hosted-frontend archive integrity can now be verified directly against S3 with `frontend:release:verify:production`
- the production remote-restore redeploy path has now been live-rehearsed from S3 with hosted browser smoke after the restore
- production API Gateway access logs are now live in `/aws/apigateway/lightning-http-api-access-prod`
- production Lambda tracing is now active for public, authenticated, and privileged runtimes
- production codified alarms now all publish to `arn:aws:sns:eu-west-2:310505389001:lightning-operations-alerts-prod`
- production alarm subscription readiness is now visible in `ops:status`
- production `ops:status` now only reports alarm-subscription readiness once at least one destination is confirmed, unless a higher configured-email target is in use
- the default Amplify production URL now responds successfully over HTTPS
- the custom production hostname `https://lightningclassics.com` now responds successfully over HTTPS
- browser-led hosted production verification now also passes against `https://lightningclassics.com`
- the repo now includes a repeatable post-delegation attach path instead of relying on manual stack parameter entry at cutover time
- the repo now also includes a repeatable verification path for custom-domain HTTPS health after Amplify attachment
- the repo now also includes a repeatable finalization path that verifies the production CORS lock-down after cutover

### 3.5 DNS and hosted frontend control plane

Purpose:

- own the public DNS zone for `lightningclassics.com`
- attach long-lived hosted frontend environments to the right custom domains

Target shape:

- Route 53 public hosted zone for `lightningclassics.com`
- Amplify-hosted staging frontend on `staging.lightningclassics.com`
- Amplify-hosted production frontend on `lightningclassics.com`
- optional custom ACM certificate in `us-east-1` only if Amplify-managed certificates are not acceptable

Status:

- fully deployed and cut over on 2026-04-03

Current implementation:

- `LightningDnsStack`
- `LightningStagingFrontendStack`
- `LightningProductionFrontendStack`
- hosted zone ID `Z016489723I788PVTRF68`
- authoritative nameservers:
  - `ns-999.awsdns-60.net`
  - `ns-1755.awsdns-27.co.uk`
  - `ns-269.awsdns-33.com`
  - `ns-1042.awsdns-02.org`
- staging hosted frontend is live in manual-deploy mode
- production hosted frontend is live in manual-deploy mode
- external registrar delegation now points at the Route 53 nameservers as of 2026-04-03
- `staging.lightningclassics.com` is now attached and serving through Amplify
- `lightningclassics.com` is now attached and serving through Amplify
- repository-connected Amplify mode remains available later when GitHub access is ready

## 4. AWS Service Topology

### 4.1 Frontend delivery

- AWS Amplify hosts the SPA build
- CloudFront delivers the frontend globally
- Route 53 owns DNS for the custom domain
- ACM provides TLS certificates for the custom domain

Current implementation status:

- the repo now contains dedicated CDK stacks for hosted DNS and Amplify frontend delivery
- hosted frontend delivery is modeled separately for staging and production
- hosted frontend delivery now supports both manual artifact deployments and repository-connected Amplify mode
- Amplify-managed certificates are the default hosted certificate path
- optional custom ACM certificate support is exposed through a deploy-time parameter rather than being forced into the baseline
- manual hosted-artifact deploys now resolve environment-specific Vite variables from the selected frontend stack outputs
- hosted frontend responses now carry the codified CSP/security-header baseline
- hosted frontend artifacts now also carry a machine-readable release manifest for operator verification and rollback tracing
- hosted frontend manual publishes now also retain local rollback archives with zip checksum metadata
- hosted frontend manual publishes now also upload the retained release zip plus archive metadata into environment-specific S3 archive buckets for durable rollback recovery

### 4.2 Identity and security

- Cognito owns user sign-up, sign-in, and session identity
- IAM roles are separated per runtime surface

Identity pools should only be added if the browser genuinely needs scoped AWS credentials. They are not the default assumption for this project.

Implementation status:

- Cognito client integration is now present in the frontend code
- the local/dev Cognito user pool and SPA app client now exist in `eu-west-2`
- optional identity-pool resources are still intentionally absent
- the hosted frontend stacks now inject the required Cognito and API base URLs into Amplify branch environment variables

### 4.3 Backend authority

- Lambda hosts backend runtime surfaces
- public, authenticated, and privileged surfaces should be maintained conceptually, even if they are deployed through a shared gateway layer later

Current implementation status:

- the local runtime now exercises all three surfaces on the same local server for contract verification
- the authenticated surface can now verify Cognito bearer tokens directly when the local environment is wired to a real user pool
- the CDK-managed local stack now deploys the public, authenticated, and privileged surfaces as Lambda functions behind an HTTP API
- `/auth/*` on that deployed HTTP API now uses a Cognito JWT authorizer
- `/privileged/*` on that deployed HTTP API now also uses the Cognito JWT authorizer
- the CDK app now uses one shared stack model with environment-specific defaults for local, staging, and production
- the staging stack now uses that shared model in a live deployed environment

### 4.4 Data and state

- DynamoDB is the application persistence layer
- S3 is optional and should be used only for true object-storage needs such as exports, media, or generated artifacts

Current implementation direction:

- public catalog reads are now served from local backend handlers backed by a shared catalog store
- that catalog store targets `lightning-books-<env>` in cloud environments and a local file-backed adapter during local verification
- the first authenticated persistence slice now targets a `lightning-user-state-<env>` DynamoDB table
- that table now holds favorites, reading-list items, book comments, book reviews, and book ratings in the backend code path
- Add Book auditability now targets `lightning-book-suggestions-<env>` in cloud-backed environments and is live locally in DynamoDB-backed mode

### 4.5 Monitoring and operations

- CloudWatch captures logs and metrics
- SES is optional for product or operational email needs

Current codified monitoring baseline for `staging` and `production`:

- one CloudWatch dashboard per environment
- Lambda errors alarms for public, authenticated, and privileged surfaces
- Lambda throttles alarms for public, authenticated, and privileged surfaces
- HTTP API 5xx alarm
- dedicated API Gateway access log group per environment
- active X-Ray tracing on Lambda runtime surfaces
- one SNS alarm topic per environment for codified alarm delivery
- operator status command in `infra/` for health and alarm-state review
- operator status now also reports alarm-subscription readiness and live SNS subscription state

Live status on 2026-04-02:

- the alarm and dashboard baseline is now deployed in both `LightningStagingStack` and `LightningProductionStack`
- the API Gateway access-log baseline is now deployed in both `LightningStagingStack` and `LightningProductionStack`
- Lambda tracing is now active in both `LightningStagingStack` and `LightningProductionStack`
- SNS-backed alarm actions are now live in both `LightningStagingStack` and `LightningProductionStack`
- `ops:status` reports public health `200`, all alarms `OK`, complete alarm-action coverage, and subscription readiness in both environments

## 5. Resource Naming Baseline

To avoid confusion with other projects, Lightning Classics AWS resources should use a shared name prefix:

- `lightning-`

Preferred pattern:

- `lightning-<resource>-<env>`

Examples:

- `lightning-users-prod` for the Cognito user-pool name
- `lightning-web-prod` for the Cognito SPA app-client name
- `lightning-books-prod` for the catalog DynamoDB table
- `lightning-user-state-prod` for the user-state DynamoDB table
- `lightning-book-suggestions-prod` for the moderation/suggestions DynamoDB table
- `lightning-public-api-prod` and `lightning-auth-api-prod` for Lambda function names

Important:

- AWS-generated identifiers such as Cognito user-pool IDs, app-client IDs, hosted-zone IDs, and ACM certificate ARNs are not human-controlled and will not follow this prefix convention

Trade-off note:

- Yan Cui has noted that AWS often recommends letting CloudFormation generate names because it reduces collisions and helps with ephemeral stacks
- this project is deliberately choosing `lightning-` prefixed human-readable names for operator clarity and cross-project separation
- to retain the benefits of Yan Cui's testing guidance, ephemeral review environments should still be used later so name clarity does not become the only isolation mechanism

Reference:

- [AppSync: how to inject table names into DynamoDB batch & transact operations](https://theburningmonk.com/2020/07/appsync-how-to-inject-table-names-into-dynamodb-batch-transact-operations/)

## 6. Region and Ownership Baseline

The primary workload region baseline is now:

- `eu-west-2` for Lightning Classics application resources

Supporting rule:

- if the production frontend is delivered through CloudFront, ACM certificates for that distribution still belong in `us-east-1`

Current ownership baseline:

- the local/dev Lightning Classics resources now exist in the same AWS account already used for adjacent project work in this workspace
- the repo now contains a CDK definition for the local, staging, and production stacks in `infra/`
- the repo now includes a dedicated runbook in `docs/local-infrastructure-control.md`
- as of 2026-04-02, the local resources have been recreated under `LightningLocalStack`
- as of 2026-04-02, the first non-local environment has also been deployed as `LightningStagingStack`
- as of 2026-04-02, `scripts/check-local-aws-ownership.mjs` reports `stack-managed` for the live local resources
- the local/dev stack is now CloudFormation-owned and CDK-managed
- the approved long-lived rollout model is now `local + staging + production`
- non-local stacks are now synthesized with safer defaults than local:
  - DynamoDB deletion protection enabled
  - `RETAIN` removal policy on stateful resources
  - CloudFormation termination protection enabled for production

Note:

- if a custom certificate is used for Amplify Hosting, ACM certificate placement must follow Amplify requirements and therefore use `us-east-1`
- Route 53 will assign four authoritative nameservers only after the hosted zone is created
- those four nameservers are the values that must be set at the domain registrar when cutover time comes

## 7. What Does Not Exist Yet

The following are intentionally not implied:

- no confirmed review environment yet
- no production custom-domain attachment yet
