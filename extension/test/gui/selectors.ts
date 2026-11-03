// DOM selectors for the VS Code workbench, shared by the GUI test and the screenshots.

// VS Code gives a status bar item the id "<publisher>.<name>" of the extension that made it.
export const statusItem = '[id="session-inbox.session-inbox"]';
export const statusBar = "#workbench\\.parts\\.statusbar";
// VS Code's own problems counter (errors and warnings), next to our item.
export const problemsItem = '[id="status.problems"]';

// The Activity Bar entry of the Session Inbox container; its badge is ".badge-content" inside.
export const activityItem = '.activitybar .action-item:has(.action-label[aria-label^="Session Inbox"])';
export const sideBar = "#workbench\\.parts\\.sidebar";
export const treeRow = `${sideBar} .monaco-list-row`;
