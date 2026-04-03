# Project Technical Setup Standard (v0.11.3)

> **Status:** Reusable standard
> **Audience:** Technical founders, lead engineers, platform engineers, delivery leads
> **Purpose:** Define the technical setup standard that should be used when standing up a modern project so future projects benefit from the same working practices used on Trainio.

---

## 1. Intent

This document is not a project-specific setup note.

It is a reusable standard for how to set up a project so that:

- local development is fast
- frontend and backend work remain separated
- AWS and CLI usage are predictable
- git workflows are disciplined
- testing exists from the beginning
- release and rollback paths are explicit
- documentation is part of the setup, not an afterthought

The goal is to avoid projects that are technically “working” but operationally unclear.

---

## 2. Technical Setup Principles

### 2.1 Separate frontend and backend from day one

Even if a project lives in one repository, setup should make it obvious where frontend ends and backend begins.

- frontend owns rendering, browser interaction, and user flow
- backend owns authority, validation, persistence, and secrets handling
- shared contracts sit at the boundary between them
- test, build, and deploy workflows should be runnable independently per surface

### 2.2 Prefer boring, inspectable tooling

Choose tools that are:

- easy to install
- easy to verify
- scriptable
- widely understood

Avoid setup that depends on hidden local knowledge or fragile manual steps.

### 2.3 Everything important must be command-line reproducible

Any critical technical action should be runnable from the CLI:

- install
- run locally
- test
- build
- package
- deploy
- verify
- rollback

If something can only be done by clicking around a UI, the setup is incomplete.

### 2.4 Production setup should not differ in principle from local setup

Local development and production will differ in scale and security, but the shape of the system should stay recognizable:

- same route boundaries
- same authority model
- same deployment surfaces
- same contract rules

### 2.5 Setup must include documentation and verification

A technical setup is not complete unless it includes:

- documentation of the setup itself
- automated verification
- clear operator expectations

---

## 3. Recommended Repository Structure

For most application projects, the following top-level layout is a strong baseline:

- `frontend/`
  browser app or UI surface
- `backend/`
  server/runtime code, worker code, and deployment scripts
- `contracts/`
  shared boundary contracts, manifests, and schemas
- `scripts/`
  repo-level guardrails and shared automation
- `docs/`
  active documentation and archive
- `.github/`
  CI, checks, and repository automation if used

If a project has only one runtime surface, the same principle still applies:

- keep user-interface code, runtime code, and shared contracts distinct

---

## 4. Frontend Setup Standard

### 4.1 Core tooling

Choose and document:

- runtime version
- package manager
- framework
- build tool
- router/state approach
- test framework

A strong example baseline:

- Node.js LTS
- npm or pnpm
- modern framework such as Vue, React, or Svelte
- fast bundler/dev server such as Vite
- unit test runner
- browser-level smoke or end-to-end tests

### 4.2 Frontend folder organization

At minimum:

- `src/views`
- `src/components`
- `src/composables` or equivalent
- `src/api`
- `src/shared`
- `src/assets`

This keeps presentation, orchestration, transport, and pure rules separate.

### 4.3 Local frontend run standard

The project should define:

- install command
- local dev command
- build command
- unit test command
- browser smoke test command
- default local URL
- alternate local review URL convention

This should all be written down in the build guide.

---

## 5. Backend Setup Standard

### 5.1 Runtime organization

Backend setup should separate:

- entrypoints
- handlers/controllers
- request parsing
- auth/permission gates
- services
- models
- data-access adapters

Do not put all backend behavior in one large entry file.

### 5.2 Backend folder organization

A useful baseline looks like:

- `backend/<runtime-surface>/index.*`
- `backend/<runtime-surface>/src/`
- `backend/scripts/`

Where each runtime surface can be tested and deployed independently.

### 5.3 Backend run and verification standard

The backend setup should define:

- test command per runtime surface
- packaging command
- deploy command
- verify-only deploy command
- live-check or drift-check command if applicable

---

## 6. AWS Setup Standard

### 6.1 AWS principles

Use AWS in a way that keeps the project explainable:

- prefer managed services over custom operational burden when they fit
- make trust boundaries explicit
- keep IAM permissions as narrow as practical
- separate public and privileged workloads where possible

### 6.2 AWS baseline categories to define

Every project using AWS should document:

- region baseline
- account or environment ownership model
- hosting layer
- API layer
- identity layer
- compute layer
- data layer
- monitoring/logging layer
- secrets/configuration strategy

### 6.3 Typical AWS services to decide on explicitly

Depending on the project:

- Amplify or CloudFront/S3 for frontend hosting
- API Gateway for HTTP surface
- Lambda or container runtime for backend compute
- Cognito or equivalent for identity
- DynamoDB, RDS, or other data store
- CloudWatch for logs and metrics
- IAM for runtime role separation
- S3 for uploads or assets if needed

### 6.4 AWS environment separation

Document clearly whether the project currently has:

- local only
- local + production
- local + staging + production
- preview/review environments

If staging does not exist yet, say so explicitly rather than implying it.

### 6.5 AWS role and permission standard

Avoid shared catch-all roles for unrelated workloads.

Best practice:

- one role per major runtime surface
- document which permissions each runtime actually needs
- add drift verification where practical

---

## 7. CLI Tooling Standard

### 7.1 Required CLI tools

Projects should explicitly state the required CLI stack.

Common examples:

- `git`
- language runtime CLI such as `node`
- package manager such as `npm`
- cloud CLI such as `aws`
- GitHub CLI such as `gh`
- test runner CLIs

### 7.2 CLI usage rules

Best practice:

- important operations must be scriptable
- manual UI-only steps should be minimized
- scripts should prefer explicit output and predictable exit codes
- verify-only modes should exist for risky deploy operations

### 7.3 Script categories to maintain

Useful script families include:

- install/setup
- local run
- tests
- builds
- deploys
- drift checks
- live health checks
- cleanup utilities

---

## 8. Git Standard

### 8.1 Branching

Define clearly:

- default integration branch
- feature-branch naming convention
- release branch policy if used
- hotfix handling

### 8.2 Commit discipline

Commits should be:

- scoped
- readable
- intentional
- easy to audit later

Avoid “misc fixes” commit culture for serious platform work.

### 8.3 Pull request / review discipline

If GitHub or another forge is used, define:

- when PRs are required
- review expectations
- CI requirements
- merge policy

### 8.4 Git hygiene

The standard should expect:

- clean worktree before release
- no destructive git recovery without explicit intent
- archived work documented rather than hidden in local branches only

---

## 9. Testing Standard

### 9.1 Minimum testing layers

Every serious project should define:

- unit tests for pure logic
- service/handler/runtime tests for backend seams
- build verification
- browser-visible smoke tests for key user flows

### 9.2 What to test first

Prioritize tests around:

- trust boundaries
- request/response contracts
- auth/session behavior
- critical user flows
- extracted pure helpers

### 9.3 Test commands must be stable

The technical setup should expose stable, named commands for:

- unit tests
- browser tests
- backend tests
- full local verification

---

## 10. Development Workflow Standard

### 10.1 Local setup checklist

A new engineer should be able to:

1. install dependencies
2. run the app locally
3. run the tests
4. understand the local URL
5. know which environment variables are required

without asking for tribal knowledge.

### 10.2 Day-to-day development flow

A strong default flow is:

1. update branch
2. implement in the correct layer
3. run local verification
4. update docs if needed
5. commit intentionally
6. push for review or deploy

### 10.3 Frontend/backend coordination

When a feature touches both sides:

- update or define the contract first
- implement backend authority and validation
- implement frontend integration against that contract
- verify both surfaces independently

---

## 11. Environment Variables And Secrets Standard

### 11.1 Separate configuration from code

Every project should define:

- which values are runtime config
- which are secrets
- which are frontend-exposed
- which are backend-only

### 11.2 Minimum documentation expectations

For every environment variable, document:

- name
- surface using it
- purpose
- required/optional
- example format
- where it is set

### 11.3 Secrets rules

- never hardcode secrets
- never expose backend-only secrets to the frontend
- document secret ownership and rotation expectations

---

## 12. Build And Release Standard

### 12.1 Build guide

Every project should maintain a build guide covering:

- install
- local run
- test
- build
- package
- deploy
- post-deploy verification

### 12.2 Release readiness gate

Do not release based on intuition.

A release should require:

- clean worktree
- passing tests
- passing build
- passing docs check
- known deploy path
- known rollback path
- critical flow verification

### 12.3 Release notes and changelog

The technical setup should include both:

- release notes for version-level summary
- changelog for chronological record

---

## 13. Observability And Operations Standard

### 13.1 Monitoring baseline

Projects should define:

- logs location
- key metrics
- error visibility
- health checks

### 13.2 Incident response baseline

Every project should have a runbook covering:

- first response
- common incident classes
- rollback path
- minimum post-fix verification
- evidence capture

### 13.3 Drift and health verification

Where practical, include scripts for:

- live configuration checks
- role/permission drift
- service health
- data-path readiness

---

## 14. Documentation Set Required To Support This Technical Standard

The following doc set should exist for any project using this standard.

### 14.1 Documentation index

Explains:

- which docs are authoritative
- which docs are supporting
- which docs are archived
- how to keep the docs set tidy over time

### 14.2 Technical setup standard

Explains:

- the tooling, runtime, AWS, CLI, git, testing, development, build, and release model used by the project
- how future projects should be structured technically

### 14.3 Architecture document

Explains:

- system shape
- trust boundaries
- runtime surfaces
- key data and request flows

### 14.4 Environment topology document

Explains:

- local, review, staging, and production environments
- what exists now and what does not

### 14.5 Build guide

Explains:

- exact commands required to install, run, test, build, and deploy

### 14.6 Runtime configuration document

Explains:

- all environment variables, config inputs, and secrets expectations

### 14.7 API / contract document

Explains:

- route boundaries
- request/response expectations
- action or endpoint catalogue

### 14.8 Data schema document

Explains:

- persisted data model and access patterns

### 14.9 Security and access document

Explains:

- auth model
- roles/permissions
- trust rules
- non-regression constraints

### 14.10 Operations guide

Explains:

- how the system is run, monitored, maintained, and debugged

### 14.11 Incident and rollback runbook

Explains:

- how to respond when something breaks

### 14.12 Release readiness checklist

Explains:

- what must pass before release or wider review

### 14.13 Platform status snapshot

Explains:

- the best-known current state of the project right now

### 14.14 Roadmap / forward plan

Explains:

- what should happen next after the current baseline

### 14.15 Capability matrix

Explains:

- what is implemented, partial, placeholder, or planned

### 14.16 Changelog and release notes

Explain:

- what changed
- when it changed
- why a release matters

---

## 15. Recommended Setup Checklist For A New Project

When standing up a new project, the recommended order is:

1. choose runtime and cloud baseline
2. define frontend and backend boundaries
3. define repo structure
4. set up CLI install/run/test/build commands
5. set up AWS/environment ownership model
6. set up git workflow and branch policy
7. set up unit tests and browser smoke tests
8. write the initial docs set
9. define release and rollback workflow
10. only then expand product scope

---

## 16. Anti-Patterns This Technical Standard Rejects

- mixed frontend/backend logic without an explicit boundary
- runtime behavior that can only be understood from local memory
- setup steps that exist only in chat or verbal onboarding
- release flows with no rollback path
- cloud permissions that are broader than necessary
- projects with tests but no documented way to run them
- projects with docs but no operational verification

---

## 17. Why This Standard Matters

Projects fail operationally long before they fail technically.

The purpose of this technical setup standard is to ensure that future projects begin with:

- clear boundaries
- reproducible tooling
- sensible cloud setup
- disciplined git practice
- testability
- deployment clarity
- documentation that stays useful

That foundation makes delivery faster, not slower.
