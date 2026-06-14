import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { extractLatestAssistantText } from "@lumi/core";

/** Watches the Lumi feed file and emits each new line of Claude output text. */
export class HookBridge {
  private pos = 0;
  private watcher?: fs.FSWatcher;

  constructor(private feedPath: string, private onText: (text: string) => void) {}

  static defaultFeedPath(configured?: string): string {
    if (configured && configured.trim()) return configured.trim();
    return path.join(os.homedir(), ".lumi", "feed.jsonl");
  }

  start(): void {
    fs.mkdirSync(path.dirname(this.feedPath), { recursive: true });
    if (!fs.existsSync(this.feedPath)) fs.writeFileSync(this.feedPath, "");
    this.pos = fs.statSync(this.feedPath).size; // start at end; only new output
    this.watcher = fs.watch(this.feedPath, () => this.readNew());
  }

  private readNew(): void {
    let size: number;
    try { size = fs.statSync(this.feedPath).size; } catch { return; }
    if (size < this.pos) { this.pos = size; return; } // file shrank/rotated in place
    if (size === this.pos) return;
    const fd = fs.openSync(this.feedPath, "r");
    try {
      const buf = Buffer.alloc(size - this.pos);
      fs.readSync(fd, buf, 0, buf.length, this.pos);
      const text = buf.toString("utf8");
      const lastNl = text.lastIndexOf("\n");
      if (lastNl === -1) return; // no complete line yet; leave pos so we re-read next event
      this.pos += Buffer.byteLength(text.slice(0, lastNl + 1), "utf8");
      for (const line of text.slice(0, lastNl).split("\n")) {
        if (!line.trim()) continue;
        const extracted = extractLatestAssistantText(line);
        if (extracted) this.onText(extracted);
      }
    } finally { fs.closeSync(fd); }
  }

  dispose(): void { this.watcher?.close(); }
}
