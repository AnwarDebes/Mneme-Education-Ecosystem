# LLM response cache

mneme caches every LLM response on disk by default. A re-run on an
unchanged source skips the model entirely, which is the difference
between "wait seven minutes" and "wait two seconds" for a typical
textbook chapter.

## What is cached

Every `complete(...)` call made through `CachedLLMBackend` is keyed
by the inputs that affect the response:

- the prompt template version (`PROMPT_VERSION`),
- the model name,
- the seed,
- the temperature (effective, with the config default applied),
- the system prompt text,
- the user prompt text,
- the `json_mode` flag.

A single byte change in any of those produces a different cache key
and a miss. There is no fuzzy matching; the cache is a hash table,
not a similarity search.

## Where the cache lives

```
<cache_dir>/llm_cache/
    stats.json                       # rolling hit / miss / last_run counters
    v<PROMPT_VERSION>/
        <sha256[:2]>/
            <sha256>.json            # one file per response
```

Default `cache_dir` is `~/.cache/mneme`. Override with
`config.cache_dir = "/path/to/dir"` in YAML, or set the
`MNEME_CACHE_DIR` environment variable (the loader picks it up via
`MNEME_*` env conventions).

## How to use it

It is on by default. Three knobs:

```bash
# Single-run opt-out
mneme build textbook.pdf --no-cache

# Permanent opt-out
echo "llm: { cache_enabled: false }" >> mneme.yaml
mneme build textbook.pdf --config mneme.yaml

# Inspect
mneme cache info

# Wipe everything
mneme cache clear

# Drop entries older than 30 days
mneme cache prune --older-than 30
```

## When the cache misses on purpose

The cache is strictly correct: it never returns a stale result for a
changed input. The common cases where you will see misses:

- You bumped `PROMPT_VERSION` after editing a prompt template. The
  new bucket starts empty; the old bucket is preserved on disk so
  you can roll back the prompt change cheaply.
- You changed `config.llm.model` or `config.llm.seed`.
- You edited the source file. Even a one-character change in the
  chapter text produces different chunks (the chunker is
  deterministic but content-sensitive), each with a different cache
  key.
- The cache file got corrupted (rare; usually a half-finished write
  from a process kill). The cache treats unreadable entries as
  misses and silently overwrites them on the next call.

## Performance

On a typical 80-chunk textbook with `qwen2.5:7b-instruct` on a
consumer GPU, a cold run takes about seven minutes; a warm re-run
takes about three seconds (mostly chunker + embedding + Anki write).
On CPU the speedup is larger because the cold LLM call is slower in
absolute terms.

## Pitfalls

The cache stores raw LLM responses, including any prompt content
that might be sensitive. If you process private material, the cache
holds the prompts that contained that material until you clear it.
The default location is your home directory; treat it as you would
any other tool's cache.

Two writers on the same `cache_dir` are safe: writes go through a
tempfile + `os.replace` so the on-disk entry is always either the
old version or the new one, never a half-write.
