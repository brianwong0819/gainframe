# ADR-0002: CloudFront reaches the API through origin access control

- Status: proposed
- Date: 2026-11-03

## Context

CloudFront serves the site and forwards `/api/*` to a Lambda function URL. A function URL is a public HTTPS endpoint, so without a guard anyone who learns its host name can call the API directly, bypassing CloudFront (and any future CloudFront-level protection) and invoking the function at our cost. The ROADMAP requires the raw function URL to reject direct calls.

## Options considered

1. **Origin access control (OAC).** The function URL uses `AuthType AWS_IAM`; CloudFront signs every origin request with SigV4, and a resource policy lets only this distribution invoke the function. Direct calls fail at the IAM layer with 403 before the function runs, so they cost nothing and need no code. Constraints: CloudFront replaces the viewer's `Authorization` header with its own signature, so the client must send its Cognito token in another header; `PUT` and `POST` requests must carry the SHA-256 of the body in `x-amz-content-sha256` (Lambda does not accept unsigned payloads).
2. **`AuthType NONE` plus a secret header.** CloudFront adds a custom header holding a shared secret, and Hono rejects requests without it. The client uses a normal `Authorization` header and needs no body hash. Costs: every direct call still invokes the function; the secret lives in Terraform state and the CloudFront configuration and has to be rotated by hand; the check is application code that a refactor can break.

## Decision

Option 1: OAC with signing behaviour `always`, plus two Lambda permissions for `cloudfront.amazonaws.com` scoped to the distribution ARN (`lambda:InvokeFunctionUrl`, and `lambda:InvokeFunction` limited to invocations through the function URL), as the CloudFront documentation requires.

## Consequences

- The `/api/*` behaviour forwards viewer headers except `Host` (managed policy `AllViewerExceptHostHeader`); forwarding `Host` would break the signature.
- The web app calls the API through one fetch wrapper (M2, `src/sync` and the API client). It sends the Cognito ID token in `x-gainframe-token`, never in `Authorization`, and adds `x-amz-content-sha256` (Web Crypto `SHA-256` of the exact body bytes) to every `PUT` and `POST`. The API's auth middleware (M2-02) reads the token from that header.
- Meal photos go to S3 with presigned URLs, not through the API, so body hashing stays limited to small JSON bodies.
- Response streaming for the coach (M6-03) through OAC must be checked when that task starts.
- Verification: a request to the function URL itself returns 403; the same path through CloudFront returns 200.
