# Lightning Classics AWS Diagram Blueprint

## Purpose

This document is the fastest route to a clean Lightning Classics AWS architecture diagram using standard AWS icons in diagrams.net / draw.io.

Use it to produce:

- a high-level system overview diagram
- a focused operations and delivery diagram

Use it together with:

- `docs/aws-diagram-presentation-playbook.md`

The intent is:

- standard AWS iconography
- low visual clutter
- accurate current-state representation
- easy maintenance as the architecture evolves

## Recommended Tooling

Use:

- diagrams.net / draw.io
- the current AWS Architecture Icons pack from AWS

Recommended output files:

- source: `.drawio`
- documentation export: `.svg`
- quick sharing export: `.png`

Recommended working location in the repo:

- source diagram: `docs/diagrams/lightning-aws-architecture.drawio`
- exported overview image: `docs/diagrams/lightning-aws-architecture-overview.svg`
- exported operations image: `docs/diagrams/lightning-aws-architecture-operations.svg`

## Diagram Set

Do not try to fit everything into one oversized diagram.

Create two diagrams:

1. System Overview
2. Operations and Delivery

## Diagram 1: System Overview

### Goal

Show how users, frontend hosting, identity, backend runtime surfaces, and persistence fit together.

### Suggested Layout

Use five vertical lanes from left to right:

1. Users and clients
2. Edge and hosting
3. Identity
4. Application runtime
5. Data

### Suggested AWS Icons

Users and clients:

- generic user icon
- browser / laptop icon

Edge and hosting:

- Route 53
- AWS Amplify
- Amazon CloudFront

Identity:

- Amazon Cognito

Application runtime:

- Amazon API Gateway
- AWS Lambda

Data:

- Amazon DynamoDB
- Amazon S3

### System Overview Boxes

Place these boxes in the diagram:

Users and clients:

- Public Reader
- Signed-In Reader
- Moderator

Edge and hosting:

- Route 53
  - `lightningclassics.com`
  - `staging.lightningclassics.com`
- Amplify Hosting
  - production app
  - staging app
- CloudFront distribution
  - managed by Amplify

Identity:

- Cognito User Pool
  - production
  - staging

Application runtime:

- API Gateway HTTP API
  - production
  - staging
- Lambda: Public API
- Lambda: Auth API
- Lambda: Privileged API

Data:

- DynamoDB: `lightning-books-<env>`
- DynamoDB: `lightning-user-state-<env>`
- DynamoDB: `lightning-book-suggestions-<env>`
- S3: frontend release archives

### Connector List

Draw these arrows:

1. User -> Route 53
2. Route 53 -> Amplify / CloudFront
3. Hosted frontend -> Cognito
4. Hosted frontend -> API Gateway
5. API Gateway -> Public API Lambda
6. API Gateway -> Auth API Lambda
7. API Gateway -> Privileged API Lambda
8. Auth API Lambda -> `lightning-user-state-<env>`
9. Public API Lambda -> `lightning-books-<env>`
10. Privileged API Lambda -> `lightning-book-suggestions-<env>`
11. Privileged API Lambda -> `lightning-books-<env>` for moderator-approved publication
12. Frontend release process -> S3 release archive bucket

### Labeling Guidance

Keep edge labels short:

- anonymous catalog reads
- Cognito sign-in
- authenticated writes
- moderated catalog submissions
- approved catalog publish

### Visual Grouping Guidance

Within the application runtime lane, group the three Lambda boxes inside a soft container labeled:

- `Lightning API Runtime`

Within the data lane, group the three DynamoDB tables inside a soft container labeled:

- `Application Data`

## Diagram 2: Operations and Delivery

### Goal

Show how deployments, smoke tests, logging, tracing, alarms, and notifications work.

### Suggested Layout

Use four vertical lanes from left to right:

1. Source and automation
2. Hosted/runtime targets
3. Observability
4. Alert delivery

### Suggested AWS Icons

Source and automation:

- GitHub icon or generic pipeline box
- AWS IAM

Hosted/runtime targets:

- AWS Amplify
- Amazon API Gateway
- AWS Lambda

Observability:

- Amazon CloudWatch
- AWS X-Ray

Alert delivery:

- Amazon SNS
- email icon

### Operations Diagram Boxes

Source and automation:

- GitHub Actions
  - validation
  - hosted smoke
  - frontend release
  - cutover evidence
  - alarm subscription workflow
- GitHub OIDC Roles

Hosted/runtime targets:

- Amplify frontend
  - staging
  - production
- API Gateway
  - staging
  - production
- Lambda runtime surfaces
  - public
  - auth
  - privileged

Observability:

- CloudWatch Dashboards
  - `lightning-operations-staging`
  - `lightning-operations-prod`
- CloudWatch Alarms
  - HTTP API 5xx
  - Lambda errors
  - Lambda throttles
- CloudWatch Logs
  - API Gateway access logs
  - Lambda logs
- X-Ray traces

Alert delivery:

- SNS topic: `lightning-operations-alerts-staging`
- SNS topic: `lightning-operations-alerts-prod`
- confirmed alert inbox: `agilehosts@gmail.com`

### Connector List

Draw these arrows:

1. GitHub Actions -> GitHub OIDC Roles
2. GitHub OIDC Roles -> Amplify release path
3. GitHub OIDC Roles -> staging hosted smoke
4. GitHub OIDC Roles -> production hosted smoke
5. API Gateway -> CloudWatch Logs
6. Lambda -> CloudWatch Logs
7. Lambda -> X-Ray
8. CloudWatch metrics -> CloudWatch Dashboards
9. CloudWatch Alarms -> SNS topics
10. SNS topics -> confirmed email destination

### Labeling Guidance

Keep labels practical:

- deploy frontend
- run hosted smoke
- collect evidence
- route alarms
- access logs
- tracing

## Current-State Accuracy Notes

The diagram should reflect the current live state:

- production frontend is on `https://lightningclassics.com`
- `https://www.lightningclassics.com` redirects to the apex host
- staging frontend is on `https://staging.lightningclassics.com`
- production and staging each have:
  - one API Gateway
  - three Lambda runtime surfaces
  - one Cognito user pool
  - three DynamoDB tables
  - one SNS alarm topic
  - one CloudWatch operations dashboard
- alert delivery is now operationally complete because the chosen inbox is confirmed

## Keep Out of the Diagram

To keep the diagrams readable, do not show:

- every single route path
- every frontend page
- local-only development tools
- file-backed local adapters
- historical hosting systems like Render, Replit, or Lovable
- implementation-detail script names

Those belong in docs, not in the architecture image.

## Suggested Build Order in draw.io

1. Turn on AWS shape libraries.
2. Build the five-lane overview diagram first.
3. Add the environment labels:
   - local
   - staging
   - production
4. Duplicate the page and simplify it into the operations view.
5. Export both pages as SVG.

## Maintenance Rule

When the live AWS shape changes, update:

- this blueprint
- the exported diagram files
- the matching canonical docs:
  - `docs/architecture.md`
  - `docs/environment-topology.md`
  - `docs/operations-guide.md`
