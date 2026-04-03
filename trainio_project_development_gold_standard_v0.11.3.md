# Trainio Project Development Gold Standard (v0.11.3)

> **Status:** Reusable standard
> **Audience:** Founders, product leads, engineers, architects, delivery managers
> **Purpose:** Capture the development standard proven during the Trainio v0.11.3 modernization so future Trainio work, and other projects, can reuse the same approach.

---

## 1. Outcome This Standard Is Designed To Achieve

This standard is intended to produce projects that are:

- understandable by a new engineer without tribal knowledge
- safe to change under delivery pressure
- explicit about boundaries, contracts, and authority
- testable at the right seams
- documented in a way that stays useful after the project moves on
- operationally verifiable before release

The core idea is simple:

**do not scale complexity by adding more undocumented code paths.**

Instead:

- narrow the architecture
- centralize rules
- split responsibilities cleanly
- verify continuously
- archive working material once it has served its purpose

---

## 2. Core Principles

### 2.1 One architectural truth

There must be one current architectural story, not several competing ones.

- Keep one authoritative architecture document.
- Make route boundaries, trust boundaries, and ownership boundaries explicit.
- If a system has public and authenticated behavior, document and enforce that split everywhere.

### 2.2 Thin edges, focused internals

Entrypoints should be thin.

- UI pages should mainly coordinate rendering and flow wiring.
- API handlers should mainly dispatch, validate, authorize, and delegate.
- Large mixed files should be decomposed into focused helpers, services, models, composables, or shared rule modules.

### 2.3 Shared contracts over duplicated assumptions

If frontend and backend must agree, write the rule once.

- Use shared machine-readable contracts for routes, request shapes, response expectations, enums, and limits where practical.
- Derive validation and routing behavior from those contracts instead of copying rules into several files.

### 2.4 Security boundaries are structural, not optional

Security cannot depend on page behavior or developer memory.

- Trust boundaries must exist in the runtime architecture.
- Authenticated operations must stay on authenticated surfaces.
- Public operations must stay on public surfaces.
- Browser state must never be treated as sufficient authority.

### 2.5 Standardize before expanding

Before adding more features:

- remove drift
- align patterns
- centralize primitives
- reduce special cases

Feature speed improves when the base platform is more predictable.

### 2.6 Documentation is part of the product

Docs are not a retrospective.

- active docs must describe the actual codebase
- working plans should be archived when completed
- temporary handoff material should not remain in the active root forever

### 2.7 Keep frontend and backend development separate

Frontend and backend work should be deliberately separated, even when they live in the same repository.

- frontend should own rendering, interaction patterns, browser state, and user flow coordination
- backend should own authority, validation, persistence rules, and security decisions
- frontend release risk and backend release risk should be independently understandable
- frontend tests and backend tests should be runnable independently
- frontend docs and backend docs should both exist, but they must agree through shared contracts rather than informal assumptions

Separation does **not** mean duplication.

The correct pattern is:

- separate implementation layers
- separate test layers
- separate deploy paths where appropriate
- shared explicit contracts at the boundary

---

## 3. Gold-Standard Delivery Lifecycle

### 3.1 Phase 1: Assess and stabilize boundaries

Start by identifying:

- runtime surfaces
- trust boundaries
- role/permission model
- current deployment path
- highest-risk drift between code and docs

Expected outputs:

- current architecture snapshot
- explicit non-regression constraints
- prioritized modernization or cleanup plan

### 3.2 Phase 2: Standardize platform seams

Before broad feature work:

- centralize route selection
- centralize auth/session rules
- centralize request shaping and validation
- centralize shared UI primitives

Expected outputs:

- fewer one-off patterns
- one source of truth for common decisions
- clearer public vs authenticated behavior

### 3.3 Phase 3: Decompose by responsibility

Refactor large files into clear layers.

Recommended splits:

- page shell -> section components + composables + shared helpers
- handler -> request parser + auth gate + service + model + data access
- shared widget -> render shell + shared state helper/composable
- large stylesheet -> stable entrypoint + focused modules

Expected outputs:

- smaller files
- clearer ownership
- better testability

### 3.4 Phase 4: Add verification at the new seams

Every structural split should improve verification, not weaken it.

- add unit tests for extracted pure helpers
- add handler/service tests for backend edges
- keep browser smoke tests around visible user flows
- maintain build/test/deployment guardrails

Expected outputs:

- faster confidence on change
- easier diagnosis when behavior breaks

### 3.5 Phase 5: Align docs to the final state

After implementation:

- update active docs to describe the real end state
- rename or align old versioned docs if they remain current
- archive refactor-only plans, handoffs, and chat exports

Expected outputs:

- current root docs are current
- archive contains history, not operational ambiguity

### 3.6 Phase 6: Declare readiness and switch to validation

Do not refactor forever.

Once architecture, contracts, docs, and tests are stable:

- run the broader validation pass
- record readiness
- resume feature development

Expected outputs:

- explicit “ready for features” baseline
- no confusion about whether the project is still in restructuring mode

---

## 4. Recommended Project Structure Standard

### 4.1 Frontend

Use a structure where each concern has a clear home:

- `src/views`
  page shells only
- `src/components`
  reusable or page-scoped visual components
- `src/composables`
  orchestration and lifecycle logic
- `src/shared`
  pure rules, config, normalization, formatting, and decision helpers
- `src/api`
  transport and contract-facing boundaries
- `src/assets/css`
  stable theme entrypoints with focused submodules

### 4.2 Backend

Prefer a layered edge:

- lambda entrypoint / route map
- handler
- request model / request parser
- auth gate
- service
- domain model
- ddb or external-service adapter

This keeps the handler surface narrow and the logic below it testable.

### 4.3 Contracts

Keep shared contracts in a clear repo-level location, for example:

- route boundary manifest
- request-shape manifests
- enum or action manifests

These should inform both browser and server behavior.

### 4.4 Documentation

Use three doc classes only:

- active canonical docs
- supporting current docs
- archive

Do not let working notes stay mixed with active standards once the work is complete.

### 4.5 Frontend/backend separation standard

The standard project layout should make it easy to reason about frontend and backend independently.

At minimum:

- frontend code should be grouped so UI work can evolve without digging through backend implementation details
- backend code should be grouped so authority, persistence, and runtime behavior can evolve without relying on page-level knowledge
- shared contracts should live in a neutral location, not buried inside either side
- build, test, and deploy workflows should be documented per surface

This allows teams to:

- validate the browser independently
- validate the runtime independently
- change one side without silently destabilizing the other

---

## 5. Architecture Decisions This Standard Recommends

### 5.1 Explicit route boundary model

If a project has more than one API surface, define and enforce which actions belong to which surface.

Example pattern:

- public surface for safe public reads and anonymous-safe flows
- authenticated surface for signed-in or privileged operations

### 5.2 No duplicated validation logic

Validation should be shared or derived, not repeatedly rewritten.

- normalize once
- clamp once
- validate once
- reuse everywhere

### 5.3 Thin UI primitives with shared rule helpers

Shared UI components should not become logic sinks.

- keep rendering in components
- move state logic into composables
- move pure decision logic into shared helpers

### 5.4 Versioned but current docs

Versioned documentation can be useful, but the active version set must stay coherent.

- if old docs are still current, align them
- if they are no longer current, archive them

### 5.5 Operational verifiability

A project is not ready because it “looks done.”

It is ready when:

- test suites pass
- builds pass
- deployment paths are known
- drift checks pass
- local review surface works
- current docs match the code

---

## 6. Quality Gates

Before declaring a platform refactor complete, require:

- clean worktree
- current docs aligned to current code
- frontend unit tests passing
- browser smoke tests passing
- frontend production build passing
- backend unit tests passing for each runtime surface
- repository guardrail checks passing
- local review URL working
- clear branch baseline recorded

Optional but recommended:

- live environment smoke checks
- deployment verification scripts
- open issue / open PR backlog check

---

## 7. UI Standardization Rules

When standardizing UI during a modernization:

- establish shared primitives first
- remove duplicate one-off styles second
- reduce instructional clutter on operational screens
- keep help and policy guidance in dedicated support pages
- improve small-screen density without shrinking readability
- preserve brand consistency across headers, buttons, tabs, forms, and empty states

Do not:

- invent new page-local patterns unless necessary
- leave inline styling drift in place
- mix temporary UX guidance with operational flows

---

## 8. Testing Standard

### 8.1 Test extracted rules directly

When pure helpers are created, add direct unit coverage for them.

This is one of the biggest payoffs of refactoring.

### 8.2 Keep visible user flows protected

Maintain browser smoke coverage for:

- landing page and navigation
- authentication entry flows
- key search and browse flows
- key forms and submissions
- role-sensitive surfaces

### 8.3 Test handler edges, not just helpers

If backend handlers are refactored into factories or smaller modules, add direct handler-level tests so the real edge behavior remains protected.

---

## 9. Documentation Standard

### 9.1 What must stay in the active root

Keep only:

- architecture
- build/deploy
- runtime configuration
- API actions/contracts
- schema
- active UI standards
- current release/changelog
- a small number of long-lived supporting docs

### 9.2 What should move to archive

Archive when a file becomes:

- a completed plan
- a one-time readiness checkpoint
- a refactor handoff note
- a working transcript or backup export
- a superseded version snapshot

### 9.3 Stakeholder communication

For major modernization work, always produce:

- a concise stakeholder summary
- a readiness summary
- a current project resume or handoff

Then archive the temporary documents once feature development resumes.

### 9.4 Minimum required document set for any serious project

The following document set should be treated as the minimum reusable standard.

Document names may vary by project, but each project should maintain an equivalent set with the same purpose.

#### Documentation index

Purpose:

- explain how the docs folder is organized
- identify which documents are authoritative
- separate current docs from archive/history

Must include:

- active canonical set
- supporting current docs
- archive policy
- update rule

#### Architecture document

Purpose:

- describe the system as it actually exists

Must include:

- major runtime components
- trust boundaries
- request/response or event boundaries
- data flow
- security model
- deployment model
- non-negotiable constraints

#### Architecture decisions / ADR document

Purpose:

- preserve why important structural decisions were made

Must include:

- decision
- rationale
- consequences
- alternatives rejected
- date or version context

#### Build and local-development guide

Purpose:

- show how to install, run, test, package, and build the project locally

Must include:

- toolchain versions
- install commands
- local run commands
- test commands
- build commands
- local review URL conventions
- deploy preflight commands if they exist

#### Environment topology document

Purpose:

- describe the environments that exist and how they relate

Must include:

- local environment
- review/staging environment
- production environment
- hostnames/URLs
- region/account/tenant baseline where relevant
- what does not exist yet

#### Runtime configuration / environment variables document

Purpose:

- define every required environment variable or runtime configuration item

Must include:

- variable name
- where it is used
- whether it is frontend or backend scoped
- whether it is required or optional
- expected format/example
- notes on secrets handling

#### API / contract document

Purpose:

- define how system boundaries are called and what they accept/return

Must include:

- public vs authenticated boundaries if applicable
- action or endpoint catalogue
- request shapes
- response shapes
- auth expectations
- reserved/planned families if relevant
- boundary non-regression rules

#### Data model / schema document

Purpose:

- define the persisted data model and access patterns

Must include:

- tables/collections/entities
- key fields and identifiers
- ownership and relationship rules
- write constraints
- access/query patterns
- future planned structures if already committed to

#### Security and access document

Purpose:

- make authority and trust explicit

Must include:

- identity model
- auth model
- role and permission model
- privileged action rules
- boundary rules
- session/token rules
- constraints that must never regress

#### Operations guide

Purpose:

- describe how the system is run in production

Must include:

- deployment flow
- verification steps
- monitoring expectations
- logging expectations
- maintenance cadence
- known future operational improvements

#### Incident and rollback runbook

Purpose:

- provide a short operational response path under pressure

Must include:

- first-response steps
- common incident classes
- rollback paths
- minimum verification after recovery
- evidence to capture

#### Release notes

Purpose:

- explain what a version/release delivered

Must include:

- headline changes
- platform changes
- user-visible changes
- compatibility notes
- recommended reading order if helpful

#### Changelog

Purpose:

- keep a chronological record of important changes

Must include:

- date or version entries
- concise summary of what changed
- enough detail to reconstruct project evolution

#### Platform status / current-state snapshot

Purpose:

- summarize the best-known state of the project right now

Must include:

- active version baseline
- environment baseline
- verification baseline
- implemented vs partial vs placeholder state
- current priorities
- current non-negotiable constraints

#### Roadmap / forward plan

Purpose:

- define what should happen next after the current release baseline

Must include:

- near-term priorities
- medium-term priorities
- long-term opportunities
- sequencing guidance
- explicit non-goals for the next phase

#### Capability matrix

Purpose:

- show what is implemented versus incomplete across the product

Must include:

- major capability areas
- status classification
- notes clarifying whether something is real, partial, placeholder, or planned

#### Release readiness checklist

Purpose:

- provide a repeatable signoff gate

Must include:

- local verification steps
- docs checks
- security/boundary checks
- deployment preflight
- live verification
- signoff questions

#### UI standard document

Purpose:

- define the visual and interaction system for projects with a UI

Must include:

- layout primitives
- typography/color/token rules
- interaction patterns
- state patterns
- responsive rules
- accessibility expectations
- guidance on placeholders and empty states

#### Stakeholder summary

Purpose:

- give non-engineering stakeholders a concise explanation of what changed

Must include:

- major improvements
- important non-regression points
- readiness outcome
- business-relevant framing rather than internal implementation detail

#### Project development standard

Purpose:

- preserve the team’s agreed way of delivering healthy projects

Must include:

- core principles
- lifecycle phases
- quality gates
- documentation rules
- anti-patterns
- adoption checklist

### 9.5 Optional but valuable documents

Depending on the project, these are often worth adding:

- marketing/messaging guide
- onboarding guide for new engineers
- glossary
- support handbook
- migration guide
- compliance evidence map

---

## 10. Definition Of “Ready For New Features”

A project is ready to resume feature development when:

- structural drift is under control
- current docs describe current behavior
- main trust boundaries are explicit and enforced
- large hotspots have been reduced to understandable layers
- the main verification suite is green
- local review surface is working
- the team can explain where new code should go without guessing

At that point, stop default refactoring and return to product delivery.

---

## 11. Anti-Patterns This Standard Rejects

- multiple undocumented ways to call the backend
- public and authenticated concerns mixed in one implicit surface
- UI deciding authority without server confirmation
- large mixed files that own rendering, validation, transport, and persistence together
- page-local reinvention of buttons, tables, forms, or layout systems
- documentation sets where the current version is unclear
- keeping completed planning and handoff files in the active docs root indefinitely
- endless refactoring after the system is already ready for feature work

---

## 12. Recommended Adoption Checklist

Use this checklist when applying the standard to another project:

- Define the active architecture and trust boundaries.
- Write the non-regression constraints.
- Identify the biggest mixed files and duplicated rules.
- Centralize route, auth, and request-shape decisions.
- Standardize shared UI primitives.
- Split large files by responsibility.
- Add tests at the new seams.
- Align the docs to the end state.
- Archive refactor-only working material.
- Record readiness.
- Resume feature development from the cleaned baseline.

---

## 13. Trainio-Specific Proof That This Standard Works

The Trainio v0.11.3 modernization demonstrated that this approach can:

- reduce architectural drift without a product rewrite
- keep the live product moving while internals improve
- increase test coverage while shrinking hotspots
- improve small-screen usability and UI consistency
- produce a codebase that is easier to hand off, validate, and extend

That is why this document should be treated as a reusable delivery standard, not just a retrospective note.
