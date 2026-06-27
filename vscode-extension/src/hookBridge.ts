import * as fs from "node:fs";
import * as path from "node:path";
import { readEventsSince, lessonFromEvent } from "@lumi/core";
import type { FeedEvent } from "@lumi/core";
import type { Lesson } from "@lumi/core";

/** Watches the Lumi feed file and emits ready Lesson objects for each new "lesson" FeedEvent. */
export class HookBridge {
  private offset = 0;
  private seenIds = new Set<string>();
  private watcher?: fs.FSWatcher;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private feedPath: string,
    private onLesson: (lesson: Lesson) => void,
    private onStuck?: (advice: string) => void,
  ) {}

  start(): void {
    fs.mkdirSync(path.dirname(this.feedPath), { recursive: true });
    if (!fs.existsSync(this.feedPath)) fs.writeFileSync(this.feedPath, "");
    // Start at the file's current size so only NEW events are delivered.
    this.offset = fs.statSync(this.feedPath).size;
    this.watcher = fs.watch(this.feedPath, () => this.readNew());
    // Fallback interval poll in case fs.watch misses events (e.g. network drives).
    this.intervalId = setInterval(() => this.readNew(), 2000);
  }

  private readNew(): void {
    const result = readEventsSince(this.feedPath, this.offset);
    this.offset = result.offset;
    for (const event of result.events) {
      if (event.type === "stuck" && event.stuck && this.onStuck) {
        this.onStuck(event.stuck.advice);
        continue;
      }
      if (event.type !== "lesson") continue;
      if (this.seenIds.has(event.id)) continue;
      this.seenIds.add(event.id);
      // Cap the dedupe set to avoid unbounded growth over long sessions.
      // Clearing is safe because monotonically-advancing offsets already prevent
      // re-reading old events; the Set only guards against duplicate delivery
      // in the brief window after a file truncation/resync.
      if (this.seenIds.size > 1000) this.seenIds.clear();
      const lesson = lessonFromEvent(event);
      if (lesson) this.onLesson(lesson);
    }
  }

  dispose(): void {
    this.watcher?.close();
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
  }
}
