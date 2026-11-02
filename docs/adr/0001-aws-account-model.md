# ADR-0001: Activate AWS advanced features on the 2026 account plan

- Status: accepted
- Date: 2026-11-02

## Context

The AWS account was created under the 2026 account plans (Free plan, then upgraded to the Paid plan to keep the sign-up credits). Accounts on these plans are "projects" inside an AWS-managed organization, and AWS applies service control policies the owner cannot change. Two of them conflict with the plan in `docs/architecture.md`:

- **Region lock.** The project Region is assigned from the contact address. Every Asia Pacific address, Singapore included, is locked to `ap-southeast-2` (Sydney). It cannot be changed. The architecture uses `ap-southeast-1` (Singapore) for Lambda, Bedrock and Neon.
- **Identity restrictions.** `DenyIAMRestrictedActions` denies `iam:*LoginProfile*`, so IAM users cannot have console passwords, and IAM Identity Center cannot be created. ROADMAP M0-03 assumed Identity Center.

Resources that must live outside the project Region (for example an ACM certificate in `us-east-1` for a CloudFront custom domain) are also unavailable.

## Options considered

1. **Stay on the simplified plan and move to `ap-southeast-2`.** Keeps the hard spend limit (USD 20, pauses the project). Costs: roughly 80–100 ms extra round-trip latency from Malaysia, no CloudFront custom domain certificate, sign-in limited to the AWS Builder ID, and further AWS-managed SCPs that Terraform may run into without warning.
2. **Activate advanced features.** Irreversible. Removes the spend limit permanently. Gives a standard AWS Organization: owner-managed SCPs, any Region, IAM Identity Center, full Billing and Cost Management. Requires a separate management account email.

## Decision

Option 2. The owner activated advanced features on 2026-11-02, then edited the `RegionFloor` statement so the workload account allows `ap-southeast-1` instead of `ap-southeast-2`.

## Consequences

- The architecture stays as designed: `ap-southeast-1` for everything; global services through `us-east-1`.
- There is no hard spend cap. Cost control relies on the pay-per-request-only rule, AWS Budgets (credits excluded) and Cost Anomaly Detection in the management account (`docs/infra.md` → "Cost watch").
- The sign-up credits moved to the management account and still apply to the whole organization.
- The workload account has no usable root user and can never leave the organization. If a removable account is ever needed, create a new member account and move resources.
- CLI access uses `aws login` (short-lived credentials) instead of `aws sso login`. Identity Center users can be added later if collaborators join.
