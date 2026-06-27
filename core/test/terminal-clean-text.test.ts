import { describe, it, expect } from "vitest";
import { createCleanTextSink } from "../src/terminal/clean-text";

describe("createCleanTextSink", () => {
  it("strips ANSI color/escape codes, leaving rendered text", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 10 });
    sink.feed("\x1b[32mhello\x1b[0m world\r\n");
    const out = await sink.drain();
    expect(out).toContain("hello world");
    expect(out).not.toContain("\x1b[");
  });

  it("drain resets the buffer so the next chunk is independent", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 10 });
    sink.feed("first\r\n");
    expect(await sink.drain()).toContain("first");
    sink.feed("second\r\n");
    const out = await sink.drain();
    expect(out).toContain("second");
    expect(out).not.toContain("first");
  });

  it("captures lines that scrolled beyond the viewport (reads scrollback)", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 5 }); // tiny viewport
    let feed = "";
    for (let i = 1; i <= 12; i++) feed += "line" + i + "\r\n";
    sink.feed(feed);
    const out = await sink.drain();
    expect(out).toContain("line1");   // scrolled off the 5-row viewport
    expect(out).toContain("line12");  // newest
  });

  it("returns empty-ish text for a blank feed", async () => {
    const sink = createCleanTextSink();
    sink.feed("");
    expect((await sink.drain()).trim()).toBe("");
  });

  it("preserves internal blank lines", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 10 });
    sink.feed("line1\r\n\r\nline2\r\n");
    const out = await sink.drain();
    expect(out).toContain("line1\n\nline2");
  });

  it("resolves carriage-return overwrites to final rendered state", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 5 });
    sink.feed("abcde\rXY"); // no trailing newline; cursor back to col 0
    const out = await sink.drain();
    expect(out).toContain("XYcde");
    expect(out).not.toContain("abcde");
  });

  it("does not duplicate a no-trailing-newline chunk across drains", async () => {
    const sink = createCleanTextSink({ cols: 80, rows: 5 });
    sink.feed("partial");
    expect(await sink.drain()).toContain("partial");
    sink.feed("next\r\n");
    const out = await sink.drain();
    expect(out).toContain("next");
    expect(out).not.toContain("partial");
  });
});
