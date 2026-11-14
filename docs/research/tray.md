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
- Not fixed: no user has seen it (it needs the setting turned off and on within ~2 s).

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
