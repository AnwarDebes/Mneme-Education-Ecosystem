# The mneme ecosystem

mneme is more than a flashcard generator. It is a stack of pieces
that can be used independently or together. This document maps the
pieces and explains who each one is for.

## The five pieces

```
+-------------------+        +------------------+
|  CLI              |        |  Python library  |
|  `mneme build`    |        |  `from mneme...` |
+---------+---------+        +---------+--------+
          |                            |
          v                            v
+-------------------------------------------------+
|                  Pipeline                       |
|   source -> chunks -> facts -> cards            |
|             -> quality -> dedup -> difficulty   |
+---------+---------+---------+-------------------+
          |         |         |
          v         v         v
+-----------+ +----------+ +----------------+
|  Ollama   | |  Anki    | |  FastAPI       |
|  daemon   | |  (Connect| |  server        |
|  (LLM)    | |   or .apkg| | (REST + SSE)  |
+-----------+ +----------+ +--------+-------+
                                    |
                                    v
                          +-------------------+
                          |  Next.js frontend |
                          |  (study app)      |
                          +-------------------+
```

### 1. The CLI

For users who want a "drop in a PDF, get a deck out" workflow.
Subcommands:

- `mneme build` runs the pipeline.
- `mneme demo` runs a mock pipeline with no external dependencies.
- `mneme doctor` diagnoses environment problems.
- `mneme models` lists what's available on Ollama.
- `mneme config print | schema` inspects the configuration model.

### 2. The Python library

For users who want to embed mneme into a larger workflow. The
public surface is six imports
(`Config, Pipeline, Source, Card, AtomicFact, Chunk`) and the
backends are Protocols you can swap.
See [`docs/EXTENDING.md`](EXTENDING.md).

### 3. The pipeline core

The pipeline is the orchestrator that the CLI and the library both
call. It is small (185 lines) on purpose: every stage is a separate
module so a contributor can replace one stage without reading the
others. See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the
stage-by-stage contract.

### 4. The FastAPI server

For users who want a browser UI but do not want to manage CLI
invocations. The server wraps the pipeline in a REST API plus an
SSE event stream so progress updates flow to the frontend in real
time. It also exposes endpoints the frontend uses for chat,
explanations, vision, and other features not part of the offline
pipeline.

The server is optional. Nothing in the library depends on it.

### 5. The Next.js frontend

The study experience. It is a single-page app that talks to the
server for generation and runs entirely client-side for the actual
studying (FSRS scheduler, study modes, stats, achievements,
journal). Browser `localStorage` is the only persistence: no
account, no sync, no cloud.

The frontend is optional. The CLI's `.apkg` output is enough to
study in regular Anki.

## Who uses what

| If you want to... | Use |
|---|---|
| ...turn one PDF into one deck quickly | the CLI |
| ...batch-process a hundred sources | the library, from a script |
| ...build your own UI around mneme | the library or the server |
| ...study generated cards in Anki | the `.apkg` output |
| ...study generated cards in the browser | the server + frontend |
| ...add a new LLM provider | implement `LLMBackend`, pass to `Pipeline` |
| ...trial mneme without installing Ollama | `mneme demo` |

## What is NOT in the ecosystem

The project is local-first. There is no cloud, no telemetry, no
account system, no usage tracking, no marketplace of decks. Anything
that would compromise the local-first guarantee is out of scope.

There is also no plan to ship a hosted instance. The project's goal
is to make it trivial for an individual to run mneme on their own
machine; running it for other people is the user's business, not
the project's.
