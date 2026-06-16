import { describe, it, expect } from "vitest";
import { detectStuck, unstuckAdvice } from "../src/unstuck";

// ---------------------------------------------------------------------------
// PART 1: detectStuck — repeated error line (strong signal)
// ---------------------------------------------------------------------------

describe("detectStuck — repeated error line", () => {
  it("detects the same TypeError line appearing 3 times → stuck:true with repeatedError set", () => {
    const text = [
      "Attempt 1:",
      "TypeError: x is not a function",
      "  at Object.<anonymous> (app.js:10:5)",
      "",
      "Attempt 2:",
      "TypeError: x is not a function",
      "  at Object.<anonymous> (app.js:10:5)",
      "",
      "Attempt 3:",
      "TypeError: x is not a function",
      "  at Object.<anonymous> (app.js:10:5)",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
    // repeatedError must be the exact trimmed error line (not just any truthy value)
    expect(result.repeatedError).toBe("TypeError: x is not a function");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("detects the same 'error TS' line appearing 2 times → stuck:true", () => {
    const errorLine = "error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.";
    const text = [
      errorLine,
      "  src/index.ts:5:10",
      "",
      "I'll try fixing it differently.",
      "",
      errorLine,
      "  src/index.ts:5:10",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
    // repeatedError must be the exact repeated line
    expect(result.repeatedError).toBe(errorLine);
  });

  it("detects the same Exception line appearing 2 times → stuck:true", () => {
    const errorLine = "Exception: Connection refused at db.connect():42";
    const text = [
      errorLine,
      "Retrying...",
      errorLine,
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
    // repeatedError must be the exact repeated line
    expect(result.repeatedError).toBe(errorLine);
  });

  it("detects the same Traceback line appearing 2 times → stuck:true", () => {
    const text = [
      "Traceback (most recent call last):",
      "  File 'app.py', line 10, in <module>",
      "ValueError: invalid literal for int()",
      "",
      "Traceback (most recent call last):",
      "  File 'app.py', line 10, in <module>",
      "ValueError: invalid literal for int()",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PART 2: detectStuck — frustration/loop phrases
// ---------------------------------------------------------------------------

describe("detectStuck — frustration/loop phrases", () => {
  it("'still failing after I tried that' + an error → stuck:true", () => {
    const text = [
      "Error: Cannot find module './utils'",
      "still failing after I tried that",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("'same error' phrase adjacent to an error → stuck:true", () => {
    const text = [
      "Error: ENOENT: no such file or directory, open 'config.json'",
      "I keep getting the same error every time I try.",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'still not working' near error output → stuck:true", () => {
    const text = [
      "Error: listen EADDRINUSE: address already in use :::3000",
      "still not working, I don't know what to do",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'tried that already' near error → stuck:true", () => {
    const text = [
      "TypeError: Cannot read properties of undefined (reading 'map')",
      "tried that already and it keeps failing",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'that didn't work' near error → stuck:true", () => {
    const text = [
      "SyntaxError: Unexpected token '}' at line 42",
      "that didn't work, same problem",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'back to the same' near error → stuck:true", () => {
    const text = [
      "Error: Module not found: Can't resolve 'react'",
      "We're back to the same issue as before",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'keeps happening' near error → stuck:true", () => {
    const text = [
      "RuntimeError: maximum recursion depth exceeded",
      "This keeps happening every time I run it.",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("'again' adjacent to error context → stuck:true", () => {
    const text = [
      "Error: Segmentation fault (core dumped)",
      "it crashed again",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PART 3: detectStuck — multiple consecutive attempt markers
// ---------------------------------------------------------------------------

describe("detectStuck — consecutive attempt markers", () => {
  it("multiple 'let me try' / 'trying again' markers → stuck:true", () => {
    const text = [
      "let me try changing the import",
      "Error: Module not found",
      "trying again with a different path",
      "Error: Module not found",
      "let me try once more",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("multiple 'attempt' markers with errors → stuck:true", () => {
    const text = [
      "attempt 1: change the config",
      "Error: Invalid configuration",
      "attempt 2: revert the change",
      "Error: Invalid configuration",
      "attempt 3: try a different approach",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PART 4: False-positive guards — must NOT flag
// ---------------------------------------------------------------------------

describe("detectStuck — false-positive guards", () => {
  it("a single clean error (no repetition, no frustration) → stuck:false", () => {
    const text = [
      "Error: Cannot find module 'express'",
      "Run npm install to fix this.",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
    expect(result.repeatedError).toBeUndefined();
  });

  it("success output → stuck:false", () => {
    const text = [
      "✓ 42 tests passed",
      "Build complete. Output: dist/index.js",
      "Server running on http://localhost:3000",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("benign prose with no errors → stuck:false", () => {
    const text = "I'm learning how git branches work. That's really interesting!";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("'same error handling' (not a loop) → stuck:false", () => {
    const text = "We use the same error handling approach across all the routes.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("repeated 'let me try' in benign prose with NO error → stuck:false", () => {
    const text = [
      "let me try the pasta recipe this weekend",
      "and let me try the bread one too",
    ].join("\n");
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("'again' in ordinary prose WITHOUT error context → stuck:false", () => {
    const text = "I watched that movie again last night, great film.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("a single Traceback with no repetition → stuck:false", () => {
    const text = [
      "Traceback (most recent call last):",
      "  File 'app.py', line 5",
      "NameError: name 'foo' is not defined",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("two different unique errors (not repeated) → stuck:false", () => {
    const text = [
      "Error: Module not found: 'express'",
      "Fixed that, now a new issue:",
      "TypeError: res.json is not a function",
    ].join("\n");

    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("'same' used in non-error prose → stuck:false", () => {
    const text = "Let's use the same approach for all our components.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("'still' in non-error context → stuck:false", () => {
    const text = "I'm still learning TypeScript but it's going well.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PART 5: unstuckAdvice — framing output
// ---------------------------------------------------------------------------

describe("unstuckAdvice — when stuck", () => {
  it("includes a concrete reframed-prompt template when stuck", () => {
    const signal = {
      stuck: true,
      reasons: ["same error repeated 3 times"],
      repeatedError: "TypeError: x is not a function",
    };
    const advice = unstuckAdvice(signal);
    expect(typeof advice).toBe("string");
    expect(advice.length).toBeGreaterThan(50);
    // Must contain a prompt template the user can paste
    expect(advice).toMatch(/stop|pause|step back/i);
    expect(advice).toMatch(/explain|root cause|why/i);
  });

  it("mentions the specific repeated error when available", () => {
    const signal = {
      stuck: true,
      reasons: ["repeated error detected"],
      repeatedError: "TypeError: x is not a function",
    };
    const advice = unstuckAdvice(signal);
    expect(advice).toContain("TypeError");
  });

  it("still produces a useful template even without a named repeatedError", () => {
    const signal = {
      stuck: true,
      reasons: ["frustration phrase: still not working"],
    };
    const advice = unstuckAdvice(signal);
    expect(advice.length).toBeGreaterThan(50);
    expect(advice).toMatch(/stop|pause|step back/i);
  });
});

describe("unstuckAdvice — when not stuck", () => {
  it("returns a calm 'no loop detected' message when stuck:false", () => {
    const signal = { stuck: false, reasons: [] };
    const advice = unstuckAdvice(signal);
    expect(typeof advice).toBe("string");
    expect(advice.length).toBeGreaterThan(0);
    // Should be reassuring, not alarming
    expect(advice).toMatch(/moving|no loop|looks like|progress/i);
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #6 — standalone frustration phrase must require error context
// ---------------------------------------------------------------------------

describe("detectStuck — FIX 6: frustration phrases must require hasAnyError", () => {
  it("FALSE-POSITIVE: 'That didn't work out as a marketing strategy' with no error → stuck:false", () => {
    // "that didn't work" is a frustration phrase, but without any error line it should not fire
    const text = "That didn't work out as a marketing strategy for Q3.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("FALSE-POSITIVE: 'still failing to find customers' with no error → stuck:false", () => {
    const text = "We are still failing to find customers in that market segment.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("FALSE-POSITIVE: 'tried that already in our last campaign' with no error → stuck:false", () => {
    const text = "We tried that already in our last campaign and it underperformed.";
    const result = detectStuck(text);
    expect(result.stuck).toBe(false);
  });

  it("TRUE-POSITIVE: 'still failing' WITH an error line → stuck:true", () => {
    const text = [
      "TypeError: Cannot read property 'x' of undefined",
      "still failing after the fix",
    ].join("\n");
    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });

  it("TRUE-POSITIVE: repeated error + 'still failing' → stuck:true", () => {
    const text = [
      "TypeError: x is not a function",
      "still failing",
      "TypeError: x is not a function",
    ].join("\n");
    const result = detectStuck(text);
    expect(result.stuck).toBe(true);
  });
});
