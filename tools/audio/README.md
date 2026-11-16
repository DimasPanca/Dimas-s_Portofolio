# Audio tooling

UI cues are packed into one sprite; tonal cues (boot stinger, unlock chimes, section swell) and the ambient bed are synthesised in the browser with Web Audio (`apps/web/src/lib/audio/engine.ts`), so they need no files.

## Rebuild the sprite

1. Put the source WAVs listed in `SOURCES` (see `build-sprite.mjs`) into `tools/audio/raw/` (git-ignored).
   They come from Kenney's **Interface Sounds** pack — CC0 — https://kenney.nl/assets/interface-sounds
2. Run with an ffmpeg binary: `FFMPEG=/path/to/ffmpeg node tools/audio/build-sprite.mjs`

Outputs: `apps/web/public/audio/sfx.sprite.{webm,m4a}`, `apps/web/src/data/sfx-sprite.json`, `tools/audio/LEDGER.json` and `apps/web/src/data/audio-ledger.json` (shown on `/credits`).

## Rules

- Only licenses on the allow-list in `build-sprite.mjs` (CC0 preferred). Every file gets a ledger entry.
- Never commit raw downloads; only the processed sprite ships.
- To swap a cue, change its `file` in `SOURCES` and rebuild. To use a recorded ambient loop instead of the synthesised bed, add it to the engine and record its source in the ledger.
