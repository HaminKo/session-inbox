# To do 31: Tray: the setting toggled faster than the tray can follow (small)

Claude's suggestion after the to-do #30 review (2026-11-15); the user took the suggested answer
(a Someday to-do).

## Problem / Goal
Two rare cases where the tray ends up wrong after `sessionInbox.trayIcon` is switched quickly:
1. **Off and on within about half a second** (for example a double-click on the checkbox): no tray
   icon. The extension starts `-Stop` and the new tray copy at the same moment, without waiting for
   one another. If the new copy looks for the stop event before `-Stop` has set it, the old copy
   looks like it's still running, so the new one leaves. Then the old copy stops.
   Measured in to-do #30: new copy started 0 ms after `-Stop`, 1 failure in 12 replays; 500 ms
   after, 0 in 12.
2. **Off, on, off within ~2 s:** a tray keeps running with the setting off. The second `-Stop`
   arrives while the new copy waits for the old one; the new copy resets the stop event when it
   takes over, so that `-Stop` is lost. Found by the review, not measured; older than #30.

Goal: after any quick sequence of toggles, the tray matches the setting's final value: one icon if
on, none if off.

- Seen by the user: nothing. Both were found by Claude (the replay in #30 and the review).
- Ruled out: the takeover itself (fixed in #30: the moment where the old copy has let go but its
  process is still ending).

## Read first
- docs/research/tray.md, "Fix (2026-11-15, to-do #30)" ("Still open" and "Also left").
- `extension/src/extension.ts`, the `onDidChangeConfiguration` listener for
  `sessionInbox.trayIcon` (~104-113).
- `extension/src/tray.ts`: `runTray`, `startTray`, `stopTray` (~11-32).
- `tray/session-tray.ps1`: `-Stop` (~291-298) and the takeover (~300-315).

## Approach
- Case 1: in the extension, start the tray only after a `-Stop` this window started has exited
  (keep the last stop's promise; `startTray` waits for it). Every window does the same, so each
  start comes after at least one finished `-Stop`.
- Case 2: needs another idea. For example, the new copy checks the setting's final value, or
  `-Stop` waits until the mutex has an owner that isn't stopping, or the extension sends `-Stop`
  again after a start that followed a stop. Decide in the build session.
- The one-copy rule stays (docs/decisions.md, the tray entry).

## Ask the user
1. Fix both cases, or only case 1? Suggested: case 1 first (small, clear). Case 2 only if its fix
   stays small.
2. How to test it? Suggested: a GUI test step that turns the setting off and on in the same tick,
   then checks that one tray runs. Plus the replay with 0 ms between `-Stop` and the start (method
   in docs/research/tray.md).

## Test
- Claude: the GUI test step from question 2; the replay at 0 ms, 30 runs with no failure; the
  full checks.
- User: in Settings (`Ctrl+,`), double-click the `sessionInbox.trayIcon` checkbox a few times.
  When it ends ticked, there is one tray icon; when it ends unticked, there is none.
