# To do 30: Flaky unit test: a tray started while the old one stops takes over (small)

User, 2026-11-14: "Flaky unit test: a tray started while the old one stops takes over
(docs/research/tray.md)", on Claude's suggestion after to-do #29.

## Problem / Goal
`npm test` failed in 2 of 6 runs on 2026-11-14 (measured, during to-do #29, which changed no code).
One failure was captured: `extension/test/unit/tray.test.ts:393`, "the new tray left instead of
taking over". The new tray copy exited within 4 s, when it should have taken over from the copy
being stopped. That run's suite took 4.9 s instead of ~8.7 s, so the new copy probably left right
away, not after its 5 s wait (estimated from the timing).

Goal: the test passes every run, and the take-over works for a user who turns
`sessionInbox.trayIcon` off and straight back on.

- Seen by the user: nothing, only the failing test. The real-life case is the setting turned off
  and on again within ~2 s (one tick of the old copy).
- Ruled out: a clash with the real tray. Each test uses its own mutex name (`trayEnv`,
  `SESSION_INBOX_TRAY_MUTEX` with the test's pid).

## Read first
- docs/research/tray.md, "Flaky unit test: …" (the finding and possible causes).
- `tray/session-tray.ps1`:
  - 285–314: `-Stop`, the mutex and the stop event.
  - 471–477: `$exitTray`.
  - ~507: where the timer checks the stop event.
- `extension/test/unit/tray.test.ts`: 380–399 (the test), 117–136 (`trayEnv`, `exitsWithin`).
- docs/decisions.md: the tray entry (one copy by mutex).

## Approach
The cause is unknown, so find it before changing code. For each possible cause, run the cheapest
test first. Possible causes (estimated, not tested):
1. **A gap between the two checks.** The new copy finds the mutex held (line 301), but the old copy
   ends before line 307 and takes the last handle of the stop event with it. `TryOpenExisting`
   then finds no event, and the new copy leaves. This fits the early exit.
   - Cheap test: give each way out of that block its own exit code (temporarily), and run the test
     in a loop.
2. **`AbandonedMutexException` not caught.** The old copy never calls `ReleaseMutex`, so its mutex
   is abandoned when it ends. If PowerShell wraps the exception in a `MethodInvocationException`,
   `catch [System.Threading.AbandonedMutexException]` misses it and the script stops.
   - Cheap test: a short PowerShell script that abandons a mutex in one process and calls
     `WaitOne` on it in another, with the same `catch`.
3. **A busy machine.** The old copy's next tick (every 2 s) comes after the new copy's 5 s wait.
   This is less likely, because the old copy did exit within the test's 4 s.
   - Cheap test: the loop from 1, with the machine busy.

Then fix `session-tray.ps1` only. For example: look for the stop event before taking the mutex,
or wait on the mutex for a moment even when no stop event is found. The one-copy rule stays.

## Ask the user
1. How many clean runs count as fixed? Suggested: 30 runs in a row of the tray tests alone
   (`node --test test/unit/tray.test.ts` in a loop, from `extension/`) without a failure.
2. What if the cause isn't found quickly? Suggested: give the test more time only once the cause
   is understood. Never raise a timeout just to hide the failure.

## Test
- Claude:
  - The loop from question 1, both before the fix (to measure how often it fails) and after.
  - The full `npm test`, lint, tsc, and the GUI test (it has a tray test).
- User: with `sessionInbox.trayIcon` on, turn it off and straight back on in Settings (`Ctrl+,`).
  The tray icon comes back: one icon, not two and not none.
