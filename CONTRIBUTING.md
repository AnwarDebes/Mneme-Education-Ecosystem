# Contributing to mneme

Thanks for reading this. mneme is a single-author research project, and
contributions that fit the design are very welcome.

## Project values

These are the trade-offs the codebase optimises for, in priority order.
Patches that pull in the opposite direction will probably be rejected.

1. **Local-first.** No cloud calls, no telemetry, no API keys. Every
   piece of the pipeline runs on the user's machine.
2. **Interpretability over accuracy.** The difficulty classifier
   produces a rationale even when the rationale costs a few percent
   in F1.
3. **Modular blocks.** Backends are Protocols; the pipeline never
   knows whether it talks to Ollama, a mock, or a future swap-in.
4. **Honest documentation.** Numbers in the README that have not been
   measured are marked `NOT YET RUN`. New claims need new measurements.
5. **No new dependencies without a paragraph.** Each runtime dep in
   `requirements.txt` carries its own justification; new ones should
   too.

## Development setup

```bash
# 1. Clone, create a venv, install in editable mode with dev extras.
git clone https://github.com/AnwarDebes/Mneme-Education-Ecosystem.git
cd mneme
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,embeddings]"

# 2. Run the test suite. None of the tests require Ollama, AnkiConnect,
#    or a GPU.
make test

# 3. Verify lint, types, and coverage before sending a patch.
make lint
make typecheck
make coverage
```

The `Makefile` wraps the common workflows. `make help` lists every
target.

## Code style

- **Python**: ruff is the formatter and linter. Run `make lint` (or
  `pre-commit run --all-files`). Type hints are required on every
  public function.
- **Frontend**: ESLint + the Next.js config. Run `npm run lint` inside
  `frontend/`. TypeScript `strict` mode is on; new code must pass
  `npm run typecheck`.
- **Commits**: imperative mood, present tense ("add chunker overlap
  test", not "added"). Keep the subject line under 72 characters.

## Tests

- New code needs a test. The pipeline classes ship with mock-backed
  end-to-end tests; mirror that pattern for new modules.
- `pytest -k <name>` runs a subset.
- The full suite must stay under 30 seconds on a laptop CPU. If a
  test needs more, mark it `@pytest.mark.slow` so contributors can
  skip it locally.

## Pull-request checklist

- [ ] `make test lint typecheck` passes locally.
- [ ] New behaviour is covered by a test.
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]`.
- [ ] If you bumped a prompt template, you also bumped `PROMPT_VERSION`
      in `src/mneme/llm/prompts.py`.
- [ ] If you added a runtime dependency, the README and `requirements.txt`
      explain why.

## Reporting bugs

Please use the GitHub issue tracker and the bug-report template. A
minimal reproducer (a source file, the exact CLI invocation, and the
generated `.summary.json`) makes the bug fixable in one round.

## Security issues

See [`SECURITY.md`](SECURITY.md). Do not open a public issue for
suspected vulnerabilities; email the maintainer instead.
