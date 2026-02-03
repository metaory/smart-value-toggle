import * as vscode from 'vscode';
import { cycle } from './cycle.js';

/** @param {vscode.ExtensionContext} context */
export function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('value-cycle.cycle', (args = {}) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const config = vscode.workspace.getConfiguration('value-cycle');
      const disabled = new Set(config.get('disabledTypes') ?? []);
      const rules = (config.get('rules') ?? []).filter((r) => !disabled.has(r.type));
      cycle(editor, {
        direction: args.direction ?? 'increment',
        count: args.count ?? 1,
        global: args.global ?? false
      }, rules);
    })
  );
}

export function deactivate() {}
