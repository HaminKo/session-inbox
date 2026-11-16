# Tray icon (`tray/session-tray.ps1`)

## Flaky unit test: "a tray started while the old one stops takes over" (2026-11-14)
- Seen during to-do #29 (docs only, no code changed; tree clean at start). Measured: `npm test`
  failed in 2 of 6 runs, 96/96 passing in the others. One failure was captured:
  `test/unit/tray.test.ts:393`, "the new tray left instead of taking over" (the new copy exited
  within 4 s); the other run's test name wasn't captured (also a `true !== false` assertion).
- Possible causes, not tested (estimated from reading `session-tray.ps1:300-312`): the new copy
  waits for the mutex only while the stop event is still set (`$quitting.WaitOne(0)`), so it
  leaves if the old copy resets or closes that event before letting go of the mutex; or the old
  copy takes longer than the 5 s `WaitOne(5000)` to let go when the machine is busy.
  **Partly right, partly wrong** (2026-11-15, to-do #30): see the measured cause below. The 5 s
  wait was never the problem.
- Not fixed then: no user has seen it (it needs the setting turned off and on within ~2 s).
  Fixed on 2026-11-15, see "Fix" below; the rest is to-do #31.

### Cause, measured 2026-11-15 (to-do #30)
- Method: an instrumented copy of the script (a log line with time and pid at each step) and a
  Node script that replays the test's steps (old copy, `-Stop`, new copy, the same 3 s / 4 s / 4 s
  waits), several replays at once. Both lived in the session scratchpad, not in the repo.
- Measured: quiet machine, 0 failures in 18 replays and 0 in 7 `npm test` runs. With every CPU
  busy (one busy-loop thread per logical CPU, 32), 1 failure in 18 replays. The cause is a race
  that only opens up when the machine is slow.
- The failing replay's log (times in s, from the new copy's first log line, once PowerShell had
  started):
  - 0.067 the old copy notices the stop event; 0.091 closes the stop event; 0.122 releases the
    mutex (its process is still ending, so its mutex handle is still open).
  - 0.147 the new copy's `New-Object Mutex` returns `createdNew = False`: the mutex *name* still
    exists, though no one owns it any more.
  - 0.199 the new copy finds no stop event (closed at 0.091), so it leaves. Result: no tray.
- So the script reads `createdNew = False` as "another copy owns the mutex", but it only means
  "the mutex still exists". And the old copy closes its stop event before it lets go of the
  mutex, so a new copy can find neither a stop event nor a free-looking mutex.
- Ruled out (measured): `catch [System.Threading.AbandonedMutexException]` does catch an abandoned
  mutex in Windows PowerShell 5.1 (a script that abandons a mutex in one process and `WaitOne`s it
  in another: caught). Also ruled out: the old copy taking longer than the 5 s wait (it let go
  within 0.2 s in every log).

### Fix (2026-11-15, to-do #30)
- A starting copy looks up the stop event first and keeps it open, then makes the mutex without
  owning it and *tries* to take it: `WaitOne(5000)` if the stop event is set, else `WaitOne(0)`.
  `createdNew` is no longer used. The old copy now lets go of the mutex before it closes the stop
  event, and a copy that takes over keeps the old event open until it has made its own. So "no
  stop event" means the mutex is free, or the other copy is still starting (then the new copy
  leaves, as before).
- The one-copy rule is unchanged: a running copy that wasn't told to stop still makes a new copy
  leave at once.
- Unit test for the exact moment that failed: `tray.test.ts`, "a tray takes over a mutex that was
  let go but is still open" (a helper releases the mutex and keeps it open, with no stop event).
  It failed on the old script every time (measured, 1 run: the tray left after 1.6 s) and passes
  on the new one.
- Measured after the fix: 0 failures in 54 replays with every CPU busy (before: 1 in 18).
- Still open (found by the review, measured; to-do #31): the extension starts `-Stop` and the
  new copy without waiting for one another (`extension.ts`, the `sessionInbox.trayIcon`
  listener). If the new copy looks for the stop event before `-Stop` has set it, it leaves, and
  then the old copy stops: no tray. Replays that start the new copy N ms after `-Stop` is started
  (not after it ended), on a machine running other tests: N = 0, 1 failure in 12; N = 500, 0 in
  12. So only a toggle faster than about half a second (a double-click on the checkbox) can hit
  it. **Fixed 2026-11-15 (to-do #31)**, see below.
- Also left (from the review, not measured, older than this fix; to-do #31): a `-Stop` that
  arrives while a new copy waits for the old one is lost, because the new copy resets the event
  once it takes over (off, on, off within ~2 s leaves a tray running with the setting off).
  **Measured and fixed 2026-11-15 (to-do #31)**, see below.

## Quick toggles of the setting (2026-11-15, to-do #31)
- Two ways a quick toggle left the wrong tray state (both found by Claude, never seen by the user):
  1. Off and on within ~0.5 s: no tray. The cause is measured above ("Still open").
  2. Off, on, off within ~2 s: a tray kept running with the setting off. The second `-Stop` gets
     lost in two ways:
     - it comes while the new copy waits for the old one, and the new copy resets the stop event
       once it takes over;
     - it comes before the new copy has started, after the old copy has closed the event: nothing
       to set, so the new copy starts unopposed.
- Measured before the fix (case 2): old copy running → `-Stop` → new copy started once that
  `-Stop` exited → a second `-Stop` G ms after the start → after 9 s the new copy still ran in 11 of
  12 replays at G = 0 and 3 of 12 at G = 300. 12 replays ran at once (a busy machine). Method as
  in to-do #30: a Node script in the session scratchpad, not in the repo.
- Measured: `-Stop` needs ~0.38 s from spawn to exit (5 runs, quiet machine), so a starting copy
  reaches its mutex check about as fast.
- Fix, in the extension only (`trayFollower` in `extension/src/tray.ts`); the script is unchanged:
  - "On" starts the tray only once every `-Stop` this window sent has exited, the second one
    included (so the stop event is set when the new copy looks). It doesn't start at all if the
    setting is off again by then or the window has closed.
  - "Off" sends `-Stop`, and a second `-Stop` 15 s later if the setting is still off. A copy
    started before then has taken over or left by then (≈0.4 s start + at most the 5 s wait).
- Why case 2 can't be fixed in the script alone: a stop event can't tell a `-Stop` meant for the
  old copy from one meant for the new copy, because PowerShell processes start in no fixed order.
  Only the extension knows the order of the toggles.
- Measured after the fix, through the real `trayFollower` and script (12 replays at once per
  line):
  - Case 1 (off, then on at 0 ms): 0 failures in 30, one tray running each time. Before the fix:
    1 in 12, from to-do #30's measurement above.
  - Case 2 (off, on, then off G ms later; checked after 20 s):
    - G = 0, 300, 600 ms: 0 failures in 36. The start was skipped every time: the first `-Stop`
      hadn't exited yet.
    - G = 700, 900, 1100 ms with the second `-Stop` turned off: 9 failures in 36. This shows that
      these gaps hit the lost `-Stop`.
    - The same gaps with the second `-Stop`: 0 in 36.
    - G = 1500 ms: 0 in 12, with or without the second `-Stop`.
  - After the review fixes, run again: case 1, 0 in 30; case 2 at G = 900 and 1100 ms, 0 in 24.
- Unit tests with fake processes: `tray.test.ts`, "following the tray setting".
- Not covered by the GUI test: it toggles by writing `settings.json`, and VS Code merges writes
  that close together, so it can't make a same-moment toggle. Its on/off step still runs the new
  code.
- Left: if PowerShell takes over ~10 s to start (a very slow machine), the second `-Stop` can
  still arrive too early. Never measured; also, a 5 s wait that runs out is older than this fix
  and leaves no tray with the setting on.

## The tray icon on other monitors (2026-11-14)
Question: can the tray icon (a WinForms `NotifyIcon`) also show on the taskbars of other monitors?

Nothing here was tested on this machine; everything is from the sources below.

- Windows 11 shows the notification area (the tray icons) only on the main display's taskbar.
  "Show my taskbar on all displays" (Settings > Personalization > Taskbar > Taskbar behaviors)
  gives the other monitors app buttons, the clock and the Notification Center, but no tray icons.
  No Insider build was found that changes this (searched 2026-11-14).
- An app can't place its own tray icon on another taskbar: there is one notification area, and
  `Shell_NotifyIcon` (what `NotifyIcon` uses) has no monitor parameter.
- Built in: Settings > System > Display > "Make this my main display" moves the tray to that
  monitor (along with the main-display role: where new windows and most full-screen games open).
- Windhawk mod "Taskbar multi-tray" (EDM115, MIT) copies the tray icons onto the other taskbars (all,
  or chosen monitor numbers). Known issues: tray popups can open on the main monitor (issue #4678);
  icons that other mods add aren't copied; it conflicts with "Taskbar auto-hide per monitor"
  (#4585). Like every Windhawk mod it hooks Explorer and can break after a Windows update (more
  likely on Insider builds). Not tried with this tray: whether a click on the copy reaches our
  icon is unknown. Our menu opens at the mouse pointer (`ShowContextMenu`), so it should appear on
  the monitor that was clicked (estimate).
- Windhawk mod "Primary taskbar on secondary monitor" moves the full taskbar (with the tray) to
  another monitor without changing the main display.
- Paid tools DisplayFusion and Actual Multiple Monitors are named by guides for this (not checked).

Options in this project (none built):
- A taskbar button with a count badge (an overlay icon on a small window of the tray script):
  app buttons do show on every monitor when "show my taskbar apps on" is "All taskbars". Drawbacks:
  a window that exists only for its button takes a taskbar slot and shows in Alt+Tab, and it's a
  second look to keep in step with the tray. Worth it only if the Windhawk mod doesn't work.
- The VS Code status bar already shows the count in every VS Code window, on any monitor.

Sources:
- Microsoft Q&A, system tray on multiple screens:
  https://learn.microsoft.com/en-us/answers/questions/5883859/system-tray-on-multiple-screens
- Microsoft Tech Community, "Windows 11 system tray on second monitor" (2025, no Microsoft answer):
  https://techcommunity.microsoft.com/discussions/windowsinsiderprogram/windows-11-system-tray-on-second-monitor/4447343
- Taskbar multi-tray: https://windhawk.net/mods/taskbar-multi-tray, issues
  https://github.com/ramensoftware/windhawk-mods/issues/4678 and
  https://github.com/ramensoftware/windhawk-mods/issues/4585
- Windhawk taskbar mods overview: https://ramensoftware.com/windhawk-mods-for-the-windows-11-taskbar
- Guide naming DisplayFusion / Actual Multiple Monitors:
  https://windowsreport.com/show-tray-icons-all-monitors/
