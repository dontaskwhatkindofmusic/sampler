# letter sampler

Static, browser-local sampler. Upload these files to the root of a GitHub repository and configure GitHub Pages to serve that branch/root. No build or dependencies. Keep index.html and the supporting JavaScript/CSS files together. Microphone capture needs HTTPS or localhost.

## Tutorial and transport

First-time visitors are offered a guided tutorial; restart it from Help. The tutorial walks through recording a sound, enabling Click and Write Live, making a loop, editing steps, effects and backups. One Stop button and Esc stop playback and recording.

## Play and record

Desktop and touch layouts share index.html and the same four locally saved projects. Tap an empty letter to start recording, then tap again to finish; holding for 350 ms or longer stops on release. Threshold mode waits for sound before capture. Microphone access is requested only for recording or an explicit microphone check. Tracks close after recording to restore normal playback routing. Safari controls whether it asks for permission again.

Tap loaded pads to play. Import an audio file or drag one onto a desktop pad. Recordings/imports are limited to 12 seconds of mono PCM WAV at the original audio rate. Browser/device latency varies. Samples stay on this device and origin; moving from the old hosted site to GitHub Pages does not transfer browser storage. Export projects from the old site and import them on the new one. Export backups before replacing your deployment.

## Delete

Tap Delete to enter multi-select mode. Tap any number of loaded pads to select or deselect them. Tap Delete again to remove the selection. With nothing selected, the button says Cancel Delete. Undo restores the whole deletion. Shift+X enters/confirms Delete on a keyboard.

## Sequence

Choose 1–32 steps, shown in four pages of eight. Old ten-step projects/backups migrate without losing steps. Digits 1–8 address the current page; [ and ] change pages. Hold digits and play a letter to toggle it on those steps. Touch users select steps, switch to Play, and tap pads to assign them. Release Steps clears the selection for free playback. BPM, sequence length and quarter/eighth/sixteenth-note timing can change while playing. A 32-step sixteenth-note sequence is two bars of 4/4. Default remains eight quarter notes.

## Effects

Sample level is a GainNode. Sample FX includes pitch/speed, optional low-pass filtering, pan, and compressor presets (off, 4:1, 8:1, 20:1; threshold −24 dB). Master settings offer gain and a bypassable DynamicsCompressorNode with threshold and ratio. Default master gain remains 0.65; compression is off for new projects. Explicitly saved master settings are retained. Settings save per project and travel in backups. Master gain/compressor changes affect existing playback; sample effects apply on the next hit.

Keyboard: Shift+Y sample FX, Shift+U master, Shift+G sample gain, Space transport, Esc stop all, Shift+1–4 projects. Other controls show shortcuts. In dialogs use Tab, arrows and Enter.

## Recovery changes

Saved audio decodes without waiting for autoplay permission. A playing gesture resumes audio. Failed decodes retain the original stored sample and can retry on a pad tap. Restored trim bounds are clamped to decoded duration. Interrupted pad touches reset correctly. Storage-read failure blocks saves instead of overwriting unread data. Automated logic checks cover persistence recovery, recording gestures, deletion, 32-step mapping and effects; physical iPhone/Safari testing remains necessary to verify device routing.

## Pad recovery and clearing

Setup → Clear All Pads clears only the current project after confirmation; Undo Clear restores that group and its sequence notes. Desktop also supports Shift+Q. Selected/playing buttons use border outlines with no yellow fill. Threshold is a horizontal slider with a live dBFS value.

A named pad whose stored audio is not decoded shows “retry,” rather than pretending it is playable. Both pads and the mobile Listen button retry decoding. Concurrent requests share one decode; deleted/replaced samples cannot be resurrected by late results. Demo drums wait for project loading and block overlapping imports/project changes. Corrupt saved audio is retained for backup/re-import, not silently discarded.

Regression checks: run the files in `tests/` using Node from the repository root. These are logic checks, not a physical iPhone audio test.

## Returning after screen lock

The first pad/Play gesture after leaving the page rebuilds the audio output while retaining decoded buffers and saved sample data. The same recovery handles Safari's interrupted state and returning from the browser's page cache. A stalled resume times out with a retry message rather than hanging the instrument. Playback does not restart automatically in the background.

Saved PCM16 WAV files—including built-in drums and the app's normalized recordings/imports—are read directly into audio buffers, avoiding the browser codec decoder on restoration. Other legacy encodings still use the native decoder. Invalid/truncated files remain preserved and report an error. An unfinished recording is cancelled when the page is hidden, preserving any previous saved sample; a take already being saved can finish.

The screen-lock regression test simulates interruptions, silent/stuck output, a failed codec decoder and hung resume. Physical iPhone verification remains necessary.

## Offline and Home Screen

Setup → Make Available Offline downloads and verifies the complete static instrument using an opt-in service worker. Wait for Ready. The dialog explains Safari → Share → Add to Home Screen and keeping Open as Web App enabled. Open the Home Screen icon online and save offline there too; export/import projects if iOS gives that app separate storage. Saved projects remain in IndexedDB, separate from the replaceable app cache. Browser eviction can remove offline data; backups still matter.

The cache is scoped to this repository's URL path, supports GitHub Pages subpaths and layout query strings, and installs updates as a complete bundle. In Setup, an available update offers Reload Update; playback/recording must be stopped first. Failed downloads preserve the previous offline version. Missing cached assets can be repaired while online. Normal online updates wait until old app windows close, or Reload Update is chosen.

After changing any app asset or the service worker, run `python3 scripts/version-offline.py` before committing, so installed offline copies receive an update. No build dependencies are required.

## Repeat mode and sample stop

Sample → Repeat chooses Layer (poly, the existing/default behavior) or Restart (mono, each hit cuts the previous voice of that pad). The setting persists with each sample and is included in backups. Other pads remain independent. Mono also respects scheduled sequencer hits.

Stop Samples (Shift+R) cuts currently sounding sample voices without stopping the loop, metronome, or upcoming hits. Play/Stop and Esc still stop the full transport. Step pages are four buttons above the steps, with a border on the active page; bracket shortcuts still work. In mobile portrait, Play aligns in width with Bank 1.

## Quantize

Quantize defaults on. Find it in Steps on mobile or Transport on desktop; Shift+K toggles it. With Write Live enabled, On snaps newly played notes to the selected quarter/eighth/sixteenth step grid. Off preserves their timing within the loop, including multiple hits of the same pad in a step. Existing notes are unchanged by the toggle. Timing scales with BPM and step-division changes and is included in browser saves/backups.

Unquantized hits are marked ~ in their step. Select that step and tap the corresponding pad to remove its hits; tapping again places a grid note. Clear Pattern clears both kinds of notes. Shortening a loop preserves notes beyond the new length for later. Live recording is bounded to 4096 unquantized hits per project.

## Desktop Safari recording fidelity

Desktop Safari on macOS requests a 48 kHz microphone stream and uses a 48 kHz audio context to reduce clock changes when opening the microphone. iPhone/iPad and other browsers retain their native audio-context configuration. The browser may choose a different microphone track rate; recordings always use the AudioWorklet clock, never the track rate, because Web Audio can resample the input.

New recordings and imports retain their original sample rate in mono 16-bit WAV rather than dropping samples to force 22.05 kHz. This avoids aliasing from the previous nearest-neighbor conversion, at the cost of roughly double storage for 44.1/48 kHz recordings. Replacement recordings explicitly start with zero pitch shift, unity sample gain and no sample compressor. Existing recordings and effects are unchanged.

Master compression is now opt-in for new projects. For existing projects, Master → Compression Off immediately bypasses that compressor and saves the change. This leaves sample-level effects intact. If an old recording was captured incorrectly, the app cannot infer its original pitch; test a fresh recording after updating. Automated tone tests verify frequency, duration and RMS through WAV encoding/restoration at 22.05, 44.1, 48 and 96 kHz; the desktop Safari hardware workaround still needs a real MacBook recording test.
