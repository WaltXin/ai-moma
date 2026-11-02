# Security Policy

## Supported versions

AI MoMA is pre-1.0. Only the latest commit on `main` gets security fixes.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/WaltXin/ai-moma/security/advisories/new).
Only the maintainers can see it.

Please include:

- what the issue is and where it is (file, route or endpoint)
- steps to reproduce or a proof of concept
- the impact you think it has

We aim to acknowledge reports within 3 days, and we'll keep you updated until it's resolved.
We're happy to credit you in the advisory.

## Scope

Especially relevant for this project:

- leaking provider API keys or other secrets to the client
- upload handling (file type and size checks, content stored or served from uploads)
- abuse of `/api/generate` that runs up provider costs
- bypassing exhibition moderation
