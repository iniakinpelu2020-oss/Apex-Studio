# Apex Studio — Media Gen

Make video, voice and music on your own machine. One file, `index.html`, no server, no
account, no card, nothing uploaded.

**Status: built and working.** Three tools in one page.

## Video

Photo sequence → video file. Add images, set how long each one holds, and the app records
the result in the browser.

- 16:9, 9:16 or 1:1, at 720p or 1080p.
- Every scene drifts slowly (alternating zoom in and out) and crossfades through black. That
  movement is the whole difference between this and a slideshow.
- A caption line over the bottom third, wrapped and shadowed so it stays readable on any
  image.
- An optional music or voiceover file, muxed into the recording.
- Output is MP4 where the browser supports it, WebM otherwise.

The one real limitation: **recording happens in real time**, because the browser captures
the canvas as it plays. A 30-second video takes about 30 seconds. That is a browser
constraint, not a shortcut — the alternative is a video encoder service, which means a card.

## Voice

The device's own speech engine. Type a script, pick a voice from the ones installed, set
speed and pitch, and it speaks.

**It plays, it does not download.** Browsers deliberately provide no way to save their own
speech output to a file, because that would make free voice cloning trivial and would remove
the last reason anyone pays for a speech API. Saving audio needs a service with a key. On
Android, the system recorder can capture it, and that is the honest path.

## Music

A generator that composes from a scale and a rhythm, using oscillators and noise — no
samples, no licence, no upload.

- Three moods, tempo from 50 to 160 BPM, up to three minutes, drums optional.
- Renders through `OfflineAudioContext`, so generating 30 seconds takes a fraction of a
  second rather than 30.
- Downloads as a real 16-bit 44.1 kHz WAV, written by hand in about 40 lines.

This is synthesis, not a model. A model that turns a sentence into music needs a hosted
service, and those are not card-free — which is exactly why this is worth having.

## What is honestly missing

**AI video generation, voice cloning and music from a description.** All three need a hosted
model, and every provider that does them well wants a payment method on file. The free-tier
options that exist are short, watermarked or queue-limited, and none of them will run for
free indefinitely. If that changes, `Apex-Backup`'s Worker pattern is the place to add them:
one route, one key stored as a secret, never in this file.

## Known limits

- A long video means a long recording, and a phone will get warm. Keep clips under a couple
  of minutes.
- Memory is the bound on very large photos; resizing before import helps.
- WebM from Firefox is smaller but less widely editable than MP4 from Chrome.

## How to run it

Open `index.html`, or upload that one file to Firebase Hosting, Netlify or Cloudflare Pages.

## What you need to do

Nothing. No accounts, no keys, no card.

## Still to build, in order

1. Text overlays with timing, so a caption can change mid-scene.
2. Audio trimming inside the app, so a track can be cut to the video length.
3. A trim tool for existing video, through WebCodecs.
4. Save the project (images, order, timings) so a video can be reopened later.
