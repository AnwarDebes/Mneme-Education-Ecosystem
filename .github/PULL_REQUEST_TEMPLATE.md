<!-- Thanks for sending a patch. Filling this in keeps the review tight. -->

## What this changes

One or two sentences explaining the change.

## Why

The problem it solves or the motivation behind it. Link to an issue
if one exists (`Closes #123`).

## How to verify

Steps the reviewer can take to convince themselves the change works.
For pipeline changes, attach an example `RunSummary` before and after
if the output shape changed.

## Checklist

- [ ] `make test lint typecheck` passes locally.
- [ ] New behaviour is covered by a test.
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]`.
- [ ] If a prompt template changed semantically, `PROMPT_VERSION` was
      bumped in `src/mneme/llm/prompts.py`.
- [ ] If a new runtime dependency was added, the README and
      `requirements.txt` justify it.
