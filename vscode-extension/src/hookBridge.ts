import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
    if (size <= this.pos) { this.pos = size; return; }
    const fd = fs.openSync(this.feedPath, "r");
    try {
      const buf = Buffer.alloc(size - this.pos);
      fs.readSync(fd, buf, 0, buf.length, this.pos);
      this.pos = size;
      for (const line of buf.toString("utf8").split("\n")) {
        if (!line.trim()) continue;
        this.onText(this.extractText(line));
      }
    } finally { fs.closeSync(fd); }
  }

  /** Pull readable text out of a hook JSON line; fall back to the raw line. */
  private extractText(line: string): string {
    try {
      const obj = JSON.parse(line);
      return obj.transcript ?? obj.message ?? obj.output ?? obj.text ?? line;
    } catch { return line; }
  }

  dispose(): void { this.watcher?.close(); }
}
