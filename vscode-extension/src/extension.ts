import * as vscode from "vscode";
import {
  Lumi, JsonFileProfile, JsonFileCache, ClaudeCliGenerator, FallbackGenerator, MockGenerator,
  profilePath, cachePath, feedPath, lumiHome,
  levelFromCount, milestoneFor, CONCEPTS,
  currentEntitlement, verifyLicense, JsonFileLicenseStore,
} from "@lumi/core";
import type { Lesson } from "@lumi/core";
import { join } from "node:path";
import { HookBridge } from "./hookBridge";
import { LumiPanel } from "./panelView";
import { handleMessage } from "./messageHandler";
import type { MessageHandlerDeps } from "./messageHandler";

export function activate(context: vscode.ExtensionContext): void {
  const lumi = new Lumi({
    profile: new JsonFileProfile(profilePath()),
    cache: new JsonFileCache(cachePath()),
    generator: new FallbackGenerator(
      new ClaudeCliGenerator(),
      new MockGenerator(),
      () => vscode.window.setStatusBarMessage(
        "Lumi: showing a basic offline lesson — install the `claude` CLI for tailored ones", 5000),
    ),
  });

  const conceptLabel = new Map(CONCEPTS.map((c) => [c.id, c.label] as const));

  const panel = new LumiPanel(context.extensionUri, async (msg) => {
    const deps: MessageHandlerDeps = {
      lumi,
      panelPost: (m) => panel.post(m),
      conceptLabel: (id) => conceptLabel.get(id),
      currentEntitlement: () => currentEntitlement({}),
      verifyLicense: (key) => verifyLicense(key),
      storeLicense: (key) => {
        new JsonFileLicenseStore(join(lumiHome(), "license.json")).setKey(key);
      },
    };
    await handleMessage(msg, deps);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("lumiPanel", panel)
  );

  const configured = vscode.workspace.getConfiguration("lumi").get<string>("watchFile");
  const watch = (configured && configured.trim()) ? configured.trim() : feedPath();

  function postProgress(): void {
    const count = lumi.listLearned().length;
    panel.post({
      type: "progress",
      count,
      level: levelFromCount(count),
      milestone: milestoneFor(count),
    });
  }

  const bridge = new HookBridge(watch, (lesson: Lesson) => {
    panel.showLesson(lesson);
    postProgress();
  });
  bridge.start();
  context.subscriptions.push({ dispose: () => bridge.dispose() });
  postProgress();
}

export function deactivate(): void {}
