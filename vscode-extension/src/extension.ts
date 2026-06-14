import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { Lumi, JsonFileProfile, JsonFileCache, ClaudeCliGenerator } from "@lumi/core";
import { HookBridge } from "./hookBridge";
import { LumiPanel } from "./panelView";

export function activate(context: vscode.ExtensionContext): void {
  const lumiDir = path.join(os.homedir(), ".lumi");
  const lumi = new Lumi({
    profile: new JsonFileProfile(path.join(lumiDir, "profile.json")),
    cache: new JsonFileCache(path.join(lumiDir, "cache.json")),
    generator: new ClaudeCliGenerator(),
  });

  const panel = new LumiPanel(context.extensionUri, (conceptId) => {
    lumi.markLearned(conceptId);
    panel.setProgress(lumi.listLearned().length);
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("lumiPanel", panel)
  );

  const configured = vscode.workspace.getConfiguration("lumi").get<string>("watchFile");
  const feedPath = HookBridge.defaultFeedPath(configured);
  // Note: onText is async and fire-and-forget; under bursty input lessons may render
  // slightly out of order. That's cosmetic for this card list.
  const bridge = new HookBridge(feedPath, async (text) => {
    try {
      const lessons = await lumi.processOutput(text);
      for (const lesson of lessons) panel.showLesson(lesson);
      if (lessons.length) panel.setProgress(lumi.listLearned().length);
    } catch (err) {
      console.error("Lumi:", err);
      vscode.window.setStatusBarMessage("Lumi: couldn't load a lesson (is `claude` installed?)", 5000);
    }
  });
  bridge.start();
  context.subscriptions.push({ dispose: () => bridge.dispose() });
  panel.setProgress(lumi.listLearned().length);
}

export function deactivate(): void {}
