# letter sampler

Static, browser-local sampler. Upload these files to the root of a GitHub repository and configure GitHub Pages to serve that branch/root. No build or dependencies. Keep index.html and the supporting JavaScript/CSS files together. Microphone capture needs HTTPS or localhost.

## Tutorial and transport

First-time visitors are offered a guided tutorial; restart it from Help. The tutorial walks through recording a sound, enabling Click and Write Live, making a loop, editing steps, effects and backups. One Stop button and Esc stop playback and recording.

## Play and record

Desktop and touch layouts share index.html and the same four locally saved projects. Tap an empty letter to start recording, then tap again to finish; holding for 350 ms or longer stops on release. Threshold mode waits for sound before capture. Microphone access is requested only for recording or an explicit microphone check. Tracks close after recording to restore normal playback routing. Safari controls whether it asks for permission again.

Tap loaded pads to play. Import an audio file or drag one onto a desktop pad. Recordings/imports are limited to 12 seconds of 22.05 kHz mono WAV. Browser/device latency varies. Samples stay on this device and origin; moving from the old hosted site to GitHub Pages does not transfer browser storage. Export projects from the old site and import them on the new one. Export backups before replacing your deployment.

## Delete

Tap Delete to enter multi-select mode. Tap any number of loaded pads to select or deselect them. Tap Delete again to remove the selection. With nothing selected, the button says Cancel Delete. Undo restores the whole deletion. Shift+X enters/confirms Delete on a keyboard.

## Sequence

Choose 1–32 steps, shown in four pages of eight. Old ten-step projects/backups migrate without losing steps. Digits 1–8 address the current page; [ and ] change pages. Hold digits and play a letter to toggle it on those steps. Touch users select steps, switch to Play, and tap pads to assign them. Release Steps clears the selection for free playback. BPM, sequence length and quarter/eighth/sixteenth-note timing can change while playing. A 32-step sixteenth-note sequence is two bars of 4/4. Default remains eight quarter notes.

## Effects

Sample level is a GainNode. Sample FX includes pitch/speed, optional low-pass filtering, pan, and compressor presets (off, 4:1, 8:1, 20:1; threshold −24 dB). Master settings offer gain and a bypassable DynamicsCompressorNode with threshold and ratio. Default master gain remains 0.65 with compression enabled, matching the previous version. Settings save per project and travel in backups. Master gain/compressor changes affect existing playback; sample effects apply on the next hit.

Keyboard: Shift+Y sample FX, Shift+U master, Shift+G sample gain, Space transport, Esc stop all, Shift+1–4 projects. Other controls show shortcuts. In dialogs use Tab, arrows and Enter.

## Recovery changes

Saved audio decodes without waiting for autoplay permission. A playing gesture resumes audio. Failed decodes retain the original stored sample and can retry on a pad tap. Restored trim bounds are clamped to decoded duration. Interrupted pad touches reset correctly. Storage-read failure blocks saves instead of overwriting unread data. Automated logic checks cover persistence recovery, recording gestures, deletion, 32-step mapping and effects; physical iPhone/Safari testing remains necessary to verify device routing.

## Pad recovery and clearing

Setup → Clear All Pads clears only the current project after confirmation; Undo Clear restores that group and its sequence notes. Desktop also supports Shift+Q. Selected/playing buttons use border outlines with no yellow fill. Threshold is a horizontal slider with a live dBFS value.

A named pad whose stored audio is not decoded shows “retry,” rather than pretending it is playable. Both pads and the mobile Listen button retry decoding. Concurrent requests share one decode; deleted/replaced samples cannot be resurrected by late results. Demo drums wait for project loading and block overlapping imports/project changes. Corrupt saved audio is retained for backup/re-import, not silently discarded.

Regression checks: run the files in `tests/` using Node from the repository root. These are logic checks, not a physical iPhone audio test.
