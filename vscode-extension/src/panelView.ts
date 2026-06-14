import * as vscode from "vscode";
import { Lesson } from "@lumi/core";

export class LumiPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  constructor(private extensionUri: vscode.Uri, private onGotIt: (conceptId: string) => void) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((m) => {
      if (m.type === "gotit") this.onGotIt(m.conceptId);
    });
  }

  showLesson(lesson: Lesson): void {
    this.view?.webview.postMessage({ type: "lesson", lesson });
  }
  setProgress(count: number): void {
    this.view?.webview.postMessage({ type: "progress", count });
  }

  private html(webview: vscode.Webview): string {
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.css"));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.js"));
    const fs = require("node:fs") as typeof import("node:fs");
    const html = fs.readFileSync(vscode.Uri.joinPath(media, "panel.html").fsPath, "utf8");
    return html.replace("__CSS__", css.toString()).replace("__JS__", js.toString());
  }
}
