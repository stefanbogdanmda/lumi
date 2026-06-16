import * as vscode from "vscode";
import * as fs from "node:fs";
import { Lesson } from "@lumi/core";
import { getNonce, buildHtml } from "./panelUtils";

/** Any message the webview can send to the extension host. */
export type InboundMessage =
  | { type: "gotit"; conceptId: string }
  | { type: "fuzzy"; conceptId: string }
  | { type: "explain"; term: string }
  | { type: "requestGlossary" }
  | { type: "requestReview" }
  | { type: "requestProgress" }
  | { type: "requestNext" }
  | { type: "polishPrompt"; idea: string }
  | { type: "paste"; text: string }
  | { type: "requestPaths" }
  | { type: "requestDigest" }
  | { type: "requestEntitlement" }
  | { type: "activateLicense"; key: string };

export { getNonce, buildHtml };

export class LumiPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  constructor(
    private extensionUri: vscode.Uri,
    private onMessage: (msg: InboundMessage) => void,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((m: InboundMessage) => this.onMessage(m));
  }

  /** Generic outbound post to the webview. */
  post(msg: unknown): void {
    this.view?.webview.postMessage(msg);
  }

  showLesson(lesson: Lesson): void {
    this.post({ type: "lesson", lesson });
  }

  private html(webview: vscode.Webview): string {
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.css"));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.js"));
    const nonce = getNonce();
    const rawHtml = fs.readFileSync(vscode.Uri.joinPath(media, "panel.html").fsPath, "utf8");
    return buildHtml(rawHtml, css.toString(), js.toString(), webview.cspSource, nonce);
  }
}
