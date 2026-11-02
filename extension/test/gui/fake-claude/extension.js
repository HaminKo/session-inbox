// GUI-test stand-in for Claude Code (test/gui/reveal.gui.ts): appends each session id that
// `claude-vscode.primaryEditor.open` is called with to the file in FAKE_CLAUDE_LOG, one per line.
const { appendFileSync } = require("node:fs");
const vscode = require("vscode");

exports.activate = (context) => {
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-vscode.primaryEditor.open", (sessionId) => {
      appendFileSync(process.env.FAKE_CLAUDE_LOG, `${String(sessionId)}\n`);
    }),
  );
};
