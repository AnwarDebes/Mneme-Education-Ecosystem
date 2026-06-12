# mneme

Local-first AI flashcard ecosystem. Drop a textbook chapter / PDF / URL,
get a deck. Then study it 11 different ways with FSRS scheduling,
AI tutoring, retention prediction, course mode, and ~120 other things.

**Nothing leaves your machine.** Frontend talks only to the local FastAPI
backend, which talks only to local Ollama. No accounts, no telemetry, no
cloud calls.

## Quick start

```bash
# Backend: from repo root
pip install -e .
ollama pull qwen2.5:7b-instruct        # or gemma3:12b, llama3.1:8b
uvicorn mneme.server.app:app --port 8000

# Frontend: in a second terminal
cd frontend
npm install
cp .env.example .env.local              # only if backend isn't on :8000
npm run dev
```

Open <http://localhost:3000>.

## What you get

**11 study modes:** Flip (FSRS), Quiz, Cloze, Write, Match, Speed, Cram,
Test, AI Tutor (Socratic conversation), Listen (hands-free TTS),
Voice-only (auto-graded by speech recognition).

**6 ways to make a deck:**
1. Generator: drop a file (PDF / EPUB / Markdown / HTML / text)
2. URL ingest: paste any http(s) link, backend fetches + runs the pipeline
3. Quick cards: paste text, get instant flashcards
4. Import: .apkg from Anki, CSV/TSV from Quizlet, JSON, share URLs
5. Sample decks: one-click preloaded examples
6. Image -> cards: vision model OCRs an image, then generates

**4 AI workflows beyond generation:**
- Chat with the deck's source (grounded in atomic facts)
- AI Tutor: Socratic per-card coaching with the answer hidden
- AI Explainer: walks you through any card you got wrong
- AI Suggest: finds gaps in your deck, proposes new cards
- AI Improve: rewrite a card (clarify / simplify / variation / harder)
- AI Tags: 1-3 short tags for any card
- AI Summarize: 3-5 bullet TL;DR of the deck's source
- AI Translate: every card into any language

**Analytics:** Daily streak, 90-day heatmap, hour-of-day accuracy,
forgetting curve, retention prediction per card, weekly digest, longitudinal
growth (weeks / months), tag accuracy, hardest cards, mistake patterns,
learner archetype, personal bests, exam-readiness gauge.

**Curriculum:** Group decks into collections, sequence them as courses
with mastery goals, visualize the skill tree, schedule practice exams on
a tightening cadence with .ics calendar export.

**Card content:** LaTeX math, syntax-highlighted code, images (URL or
paste), voice memos, hand-drawn sketches, hints, multi-phrasing variants,
prerequisites, related links, chains for step-by-step procedures.

**Power workflow:** Bulk multi-select edits, deck merge, deck split by
topic, deck cloning, deck snapshots (point-in-time restore), sub-deck
export from any tag filter, AnkiConnect push to running Anki.

**Discovery:** Cross-deck search (inverted index), near-duplicate finder,
auto-glossary, concept maps (per-deck + global), deck comparison view,
global card view, error book with AI explanations.

**Gamification:** XP & levels, 12 built-in achievements + custom
achievement creator, 3 daily quests, streak freezes (earned at XP
milestones), daily challenge card.

**Anywhere:** PWA installable, offline shell + deck cache, command palette
(Cmd/Ctrl+K), voice commands, 4 theme variants + custom HSL theme
designer + custom CSS, per-deck color + banner, custom keyboard shortcuts,
mobile bottom nav, swipe gestures.

**Data is yours:** Backup/restore as JSON. Snapshots per deck. Notes per
deck. Study journal per day. Reading sessions with persistent highlights.
Pomodoro history. Exam plans + .ics export.

## The 22 pages

| Route | What it does |
|---|---|
| `/` | Hero, ecosystem showcase, daily spotlight card |
| `/library` | Deck dashboard with stats, collections, level + quests, achievements |
| `/today` | Due-card queue, session goal, streak freezes, daily challenge, journal |
| `/insights` | Heatmap, longitudinal growth, weekly digest, retention, learner profile, ... |
| `/feed` | Chronological history of every grade |
| `/mistakes` | Error book - every "again" card with AI explanations |
| `/search` | Cross-deck search with saved searches |
| `/duplicates` | Near-duplicate finder across all decks |
| `/cards` | Every card in one flat list |
| `/compare` | Side-by-side deck comparison |
| `/learn` | Memory-science lessons with checks |
| `/help` | Q&A help center |
| `/showcase` | Animated feature tour |
| `/generator` | File / URL upload + live SSE pipeline |
| `/import` | .apkg / CSV / JSON / share URL import |
| `/study` | The 11-mode study screen |
| `/decks/[id]` | The full per-deck workspace |
| `/decks/[id]/edit` | Spreadsheet bulk edit |
| `/decks/[id]/print` | Printable cheat sheet |
| `/decks/[id]/source` | Source viewer with highlights |
| `/courses/[id]` | Course mode with skill tree |
| `/about` | Architecture + how it works |

## Backend endpoints

24 endpoints across generation, study, chat, vision, translate, summarize,
explain, suggest, import, export. See `/about` for the full architecture
picture.

## Schedulers

mneme runs two side-by-side schedulers per card and uses FSRS as the
canonical interval source:

- **FSRS v5** (default): 19-parameter Anki-style model
- **SM-2 lite**: simpler ease+interval baseline used as fallback

## Storage

Everything user-side is in `localStorage` under the `mneme:` namespace:
overrides, schedule, FSRS state, stats, achievements, plans, courses,
collections, journal, hints, anchors, ratings, snapshots, sketches, voice
memos, highlights, chains, variants, custom CSS, banners, ICS calendars.
Settings > Backup exports / restores the whole thing as JSON.

## Testing

```bash
npm run test         # vitest unit tests
npm run typecheck    # tsc --noEmit
npm run build        # next build
cd .. && python3 -m pytest -q   # backend (58 tests)
```

## Deployment

The frontend is a standard Next.js app. Deploys to Vercel out-of-the-box:

1. Build command: `npm run build` (default)
2. Set `NEXT_PUBLIC_API_BASE` to the URL of your backend (use tailscale-funnel
   / cloudflared / ngrok to expose a locally-running backend).

The backend can't run on Vercel because it needs Ollama. Run it on the
machine that hosts your Ollama daemon and expose it.

## License

MIT.
