# Tray icon (`tray/session-tray.ps1`)

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
