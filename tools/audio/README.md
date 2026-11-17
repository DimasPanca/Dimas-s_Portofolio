# Audio

All sound on the site is synthesised in the browser with the Web Audio API
(`apps/web/src/lib/audio/engine.ts`): the generative music, the UI pops and notes, and the wind whooshes.
No audio files are downloaded or shipped, so there is no third-party audio to license.

If recorded audio is ever added, it must be free for commercial use (CC0 preferred), processed before it
ships, and listed on the `/credits` page through `apps/web/src/data/audio-ledger.json`.
