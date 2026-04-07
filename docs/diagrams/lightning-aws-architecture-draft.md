# Lightning Classics AWS Architecture Draft

## Purpose

This file is the first-pass diagram draft for Lightning Classics.

It is intentionally:

- easy to edit in markdown
- quick to review in GitHub
- suitable as a drafting source before producing the final AWS-icon diagram in draw.io

Use this draft together with:

- `docs/aws-diagram-blueprint.md`

## Diagram 1: System Overview

```mermaid
flowchart LR
  subgraph U["Users and Clients"]
    PublicUser["Public Reader"]
    SignedInUser["Signed-In Reader"]
    Moderator["Moderator"]
  end

  subgraph E["Edge and Hosting"]
    Route53["Route 53
lightningclassics.com
staging.lightningclassics.com"]
    Amplify["AWS Amplify Hosting
production app
staging app"]
    CloudFront["CloudFront
managed by Amplify"]
  end

  subgraph I["Identity"]
    Cognito["Amazon Cognito
user pools
staging + production"]
  end

  subgraph A["Application Runtime"]
    HttpApi["API Gateway HTTP API
staging + production"]

    subgraph Runtime["Lightning API Runtime"]
      PublicLambda["Lambda
Public API"]
      AuthLambda["Lambda
Auth API"]
      PrivLambda["Lambda
Privileged API"]
    end
  end

  subgraph D["Data"]
    BooksTable["DynamoDB
lightning-books-<env>"]
    UserStateTable["DynamoDB
lightning-user-state-<env>"]
    SuggestionsTable["DynamoDB
lightning-book-suggestions-<env>"]
    ReleaseArchive["S3
frontend release archives"]
  end

  PublicUser --> Route53
  SignedInUser --> Route53
  Moderator --> Route53

  Route53 --> Amplify
  Amplify --> CloudFront

  Amplify -->|"Cognito sign-in"| Cognito
  Amplify -->|"anonymous catalog reads
authenticated writes
moderated submissions"| HttpApi

  HttpApi --> PublicLambda
  HttpApi --> AuthLambda
  HttpApi --> PrivLambda

  PublicLambda --> BooksTable
  AuthLambda --> UserStateTable
  PrivLambda --> SuggestionsTable
  PrivLambda -->|"approved catalog publish"| BooksTable

  Amplify -. "frontend release artifacts" .-> ReleaseArchive
```

## Diagram 2: Operations and Delivery

```mermaid
flowchart LR
  subgraph S["Source and Automation"]
    GitHub["GitHub Actions
validation
hosted smoke
frontend release
cutover evidence
alarm subscriptions"]
    OIDC["GitHub OIDC Roles"]
  end

  subgraph R["Hosted and Runtime Targets"]
    HostedFrontend["Amplify Frontend
staging + production"]
    ApiRuntime["API Gateway
staging + production"]
    Lambdas["Lambda Runtime Surfaces
public
auth
privileged"]
  end

  subgraph O["Observability"]
    Dashboards["CloudWatch Dashboards
lightning-operations-staging
lightning-operations-prod"]
    Alarms["CloudWatch Alarms
HTTP API 5xx
Lambda errors
Lambda throttles"]
    Logs["CloudWatch Logs
API Gateway access logs
Lambda logs"]
    Traces["AWS X-Ray
active tracing"]
  end

  subgraph N["Alert Delivery"]
    SnsStaging["SNS
lightning-operations-alerts-staging"]
    SnsProd["SNS
lightning-operations-alerts-prod"]
    AlertInbox["Confirmed alert inbox
agilehosts@gmail.com"]
  end

  GitHub -->|"assume role"| OIDC
  OIDC -->|"deploy frontend"| HostedFrontend
  OIDC -->|"run hosted smoke"| HostedFrontend
  OIDC -->|"collect ops evidence"| ApiRuntime

  ApiRuntime --> Logs
  Lambdas --> Logs
  Lambdas --> Traces

  ApiRuntime --> Alarms
  Lambdas --> Alarms
  ApiRuntime --> Dashboards
  Lambdas --> Dashboards

  Alarms --> SnsStaging
  Alarms --> SnsProd

  SnsStaging --> AlertInbox
  SnsProd --> AlertInbox
```

## Draft Notes

- This draft is for structure and review, not final presentation.
- The final polished version should use standard AWS icons in draw.io.
- Keep the final visual split into:
  - overview
  - operations and delivery

## Next Step

Translate this draft into:

- `docs/diagrams/lightning-aws-architecture.drawio`

Then export:

- `docs/diagrams/lightning-aws-architecture-overview.svg`
- `docs/diagrams/lightning-aws-architecture-operations.svg`
