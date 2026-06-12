# Security policy

## Supported versions

mneme is in alpha. Security fixes land on `main` and are released in
the next patch version. There is no long-term support branch.

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | yes (current line) |
| < 0.1   | no                 |

## Reporting a vulnerability

If you believe you have found a security issue in mneme, please do
**not** open a public GitHub issue. Instead, email the maintainer at
the address listed on the GitHub profile, with:

- a description of the issue,
- the version of mneme you tested against,
- a minimal proof-of-concept (source file, CLI invocation, expected
  vs observed behaviour),
- your assessment of impact.

You can expect:

- An acknowledgement within 7 days.
- A fix or mitigation plan within 30 days for issues that affect
  installed users (e.g., path traversal in source loaders, deserialisation
  of untrusted inputs, code execution from a crafted source).
- Credit in the changelog when the fix lands, unless you prefer
  anonymity.

## Threat model

mneme is a **local-first** tool. The threat model assumes:

- The user trusts the source documents they feed into the pipeline.
  We do not run untrusted PDFs in a sandbox.
- The user trusts their local Ollama daemon. We do not authenticate
  against it.
- The user trusts their local Anki install and the AnkiConnect add-on.

Out of scope:

- Compromise of the user's machine through a malicious mneme install
  (the install path is the user's package manager; we cannot defend
  against compromised mirrors).
- DoS via a pathological source document. The chunker caps work per
  chunk; truly hostile inputs are the user's responsibility.
- Cloud-side attacks. There is no mneme cloud.

In scope:

- Path traversal in source loaders.
- Code execution from a crafted prompt response or .apkg input.
- Cross-site scripting in the optional FastAPI / Next.js frontend.
- Leakage of source content to anywhere other than the local Ollama
  daemon.
