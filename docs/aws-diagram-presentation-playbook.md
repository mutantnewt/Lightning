# AWS Presentation Diagram Playbook

## Purpose

Use this playbook to create a presentation-quality architecture diagram for any AWS project.

The goal is not just to make the diagram accurate. The goal is to make it:

- easy to understand in under a minute
- visually calm and uncluttered
- faithful to the real system boundaries
- reusable across architecture reviews, delivery discussions, and operating runbooks

## Standard Output Set

Do not try to explain the whole platform in one giant canvas.

Default to a small diagram set:

1. **System Overview**
   Show the user-facing request path and the core service layout.
2. **Operations and Delivery**
   Show deployment flow, monitoring, logging, tracing, alerting, and rollback surfaces.
3. **Optional Deep Dive**
   Add only if the system has a genuinely complex area such as data pipelines, networking, or security controls.

If a single diagram has more than about 12 to 15 meaningful boxes, split it.

## Step 1: Define the Audience

Before drawing anything, decide who the diagram is for.

Typical audiences:

- product and leadership
- engineering team
- operations and support
- security and compliance

This choice changes what belongs in the visual.

Examples:

- leadership needs fewer boxes and clearer outcomes
- engineering needs service boundaries and flow direction
- operations needs alarms, logs, dashboards, and incident paths

## Step 2: Choose the Story Each Diagram Must Tell

Each diagram should answer one clear question.

Good examples:

- How does traffic reach the application and where is state stored?
- How is identity handled?
- How do releases happen and how are failures detected?
- What are the critical trust boundaries?

If a box does not help answer the story question, leave it out.

## Step 3: Build a Service Inventory First

Write down the real components before you draw:

- entry points
- hosted frontends
- DNS
- CDNs
- identity providers
- API layers
- compute services
- data stores
- background processing
- observability services
- alert delivery
- deployment automation

Then sort them into concern-based groups.

Good grouping patterns:

- users and clients
- edge and hosting
- identity
- application runtime
- data
- observability
- delivery and automation
- alerting

## Step 4: Use the Official AWS Icons

Use the current AWS Architecture Icons pack from AWS.

Recommended workflow:

- draft structure in Mermaid or markdown first
- build final artwork in diagrams.net / draw.io with AWS icons
- export SVG for docs and PNG for quick sharing

Use AWS icons for AWS services and simple neutral boxes for:

- users
- browsers
- third-party systems
- GitHub or other external tooling
- email or chat endpoints

## Step 5: Lay Out the Diagram by Responsibility

Prefer lanes or columns based on responsibility, not random placement.

A strong default left-to-right layout is:

1. users and clients
2. edge and hosting
3. identity
4. application runtime
5. data

For operations views:

1. delivery and automation
2. hosted and runtime targets
3. observability
4. alert delivery

This gives the viewer a predictable reading path.

## Step 6: Keep Labels Short

The box label should identify the component, not explain the whole system.

Good:

- `Amazon Cognito`
- `API Gateway`
- `Orders table`
- `Hosted frontend`

Less good:

- `Amazon Cognito user pool responsible for sign-in, token issuance, and group-based authorization`

Put detailed meaning in one of these places instead:

- nearby notes
- edge labels
- diagram caption
- supporting markdown below the diagram

## Step 7: Label Flows, Not Just Boxes

Boxes show what exists. Arrows show why it matters.

Add short labels to the flows that matter most:

- sign-in
- catalog reads
- authenticated writes
- async events
- deployment
- log export
- alarm notification

Do not label every line. Label only the ones that clarify meaning.

## Step 8: Show Trust Boundaries Clearly

A presentation-quality diagram should make security shape obvious without turning into a network blueprint.

Call out boundaries such as:

- public internet vs AWS-hosted entry
- identity boundary
- privileged or moderator path
- production vs staging
- external automation assuming AWS roles

Use soft containers, lane titles, or annotations rather than dense network detail unless the audience truly needs VPC-level depth.

## Step 9: Reduce Repetition

Do not duplicate the same environment detail in every box.

Instead of:

- `API Gateway staging`
- `API Gateway production`
- `Lambda staging`
- `Lambda production`

Prefer:

- `API Gateway`
  - staging and production
- `Lambda runtime`
  - staging and production

Only split environments into separate boxes when the architecture differs materially.

## Step 10: Use Visual Hierarchy Intentionally

A good diagram has three visual layers:

1. primary system components
2. grouping containers
3. supporting notes

Make the primary components visually strongest.

Recommended style:

- consistent box sizes within a lane
- soft background containers for grouped services
- restrained color palette by concern
- minimal decorative effects

Avoid:

- too many colors
- gradient overload
- thick borders everywhere
- crossing lines when a cleaner layout is possible

## Step 11: Create a Clean Final Version in draw.io

When converting from draft to polished diagram:

1. Start from the structure, not from icon hunting.
2. Add the AWS icons only after the lane layout is stable.
3. Align everything to a visible grid.
4. Keep spacing consistent between columns and rows.
5. Make connector routing deliberate and repeatable.
6. Export to SVG after every meaningful layout revision.

Practical rule:

- if the viewer needs you to narrate where to look first, the layout still needs work

## Step 12: Review Against a Checklist

Before calling the diagram done, check:

- Is the story of the diagram obvious?
- Can a new reader understand the system flow in under a minute?
- Are the most important services present and the incidental ones omitted?
- Are trust boundaries visible?
- Are arrows directional and meaningful?
- Is the terminology consistent with the real system and docs?
- Would this still look clean on a slide or in a wiki page?
- Does it match the live environment, not an older design?

## Suggested Repo Output Pattern

For a project repo, a good diagram file set is:

- `docs/<project>-diagram-blueprint.md`
- `docs/<project>-diagram-presentation-playbook.md`
- `docs/diagrams/<project>-architecture-draft.md`
- `docs/diagrams/<project>-architecture.drawio`
- `docs/diagrams/<project>-architecture-overview.svg`
- `docs/diagrams/<project>-architecture-operations.svg`

## Fast Working Method

Use this sequence:

1. Inventory services and flows in markdown.
2. Draft the shape in Mermaid.
3. Review the Mermaid for story clarity.
4. Convert the approved shape into draw.io with AWS icons.
5. Export SVGs for documentation.
6. Update the architecture docs in the same change set.

That keeps the diagram accurate, reviewable, and much easier to maintain over time.
