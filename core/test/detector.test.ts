import { describe, it, expect } from "vitest";
import { detectConcepts, scoreConcepts, resolveConcept, suggestConcepts } from "../src/detector";

describe("detectConcepts", () => {
  it("detects a git commit from CLI output", () => {
    const out = "Created commit 2f591a4 on branch main";
    const ids = detectConcepts(out);
    expect(ids).toContain("git-commit");
    expect(ids).toContain("git-branch");
  });

  it("detects npm install", () => {
    expect(detectConcepts("Running `npm install` ...")).toContain("npm-install");
  });

  it("returns each concept at most once", () => {
    const ids = detectConcepts("git commit, then another git commit, then git commit again");
    expect(ids.filter((i) => i === "git-commit")).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(detectConcepts("the weather is nice today")).toEqual([]);
  });
});

describe("scoreConcepts", () => {
  it("scores by number of matching matchers and sorts descending", () => {
    const ranked = scoreConcepts("git commit on a git branch, then git push");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
    const ids = ranked.map((r) => r.id);
    expect(ids).toContain("git-commit");
    expect(ids).toContain("git-branch");
  });

  it("returns empty array when nothing matches", () => {
    expect(scoreConcepts("the weather is nice")).toEqual([]);
  });
});

describe("resolveConcept", () => {
  it("resolves an exact concept id", () => {
    expect(resolveConcept("git-commit")?.id).toBe("git-commit");
  });

  it("resolves by exact label (case-insensitive)", () => {
    expect(resolveConcept("Git commit")?.id).toBe("git-commit");
  });

  it("resolves via a matcher when id/label do not match", () => {
    expect(resolveConcept("env var")?.id).toBe("env-var");
  });

  it("returns undefined for empty input", () => {
    expect(resolveConcept("")).toBeUndefined();
    expect(resolveConcept("   ")).toBeUndefined();
  });

  it("returns undefined for an unknown term", () => {
    expect(resolveConcept("zzzznotathing")).toBeUndefined();
  });

  it("does not resolve 1-2 character terms via partial label", () => {
    expect(resolveConcept("a")).toBeUndefined();
    expect(resolveConcept("pr")).toBeUndefined();
  });
  it("still resolves real terms", () => {
    expect(resolveConcept("git-commit")?.id).toBe("git-commit");
    expect(resolveConcept("env var")?.id).toBe("env-var");
  });
});

describe("detector false positives", () => {
  const benign = [
    "I'm committed to the plan",
    "the marketing branch of the company",
    "our budget is $500 this month",
    "exercise is a function of willpower",
    "we await your reply soon",
    "the async nature of modern life",
    "the color schema of the brand",
    "please make an exception for me this once",
    "without exception, everyone attended the meeting",
    "he kept a cache of old letters in the attic",
    "logging my work hours in the timesheet",
  ];
  it("does not fire on benign everyday sentences", () => {
    for (const s of benign) {
      expect(detectConcepts(s)).toEqual([]);
    }
  });
  it("still detects real technical usage", () => {
    expect(detectConcepts("ran git commit on branch main")).toContain("git-commit");
    expect(detectConcepts("the server returned HTTP 404")).toContain("http-status");
    expect(detectConcepts("define a JavaScript function and call it")).toContain("function");
    expect(detectConcepts("use async/await to fetch data")).toContain("async");
    expect(detectConcepts("an uncaught exception was thrown")).toContain("exception");
    expect(detectConcepts("improve the cache hit rate")).toContain("caching");
    expect(detectConcepts("add console.log debugging")).toContain("logging");
    expect(detectConcepts("a race condition from concurrent threads")).toContain("concurrency");
    expect(detectConcepts("improving concurrency in the server")).toContain("concurrency");
    expect(detectConcepts("store the result in a boolean flag")).toContain("boolean");
  });
});

describe("new concepts (v1.2 dictionary)", () => {
  const cases: [string, string][] = [
    ["ran a database migration to add a column", "migration"],
    ["fixed a race condition in the worker", "race-condition"],
    ["the user must authenticate before continuing", "authentication"],
    ["the user lacks authorization for this action", "authorization"],
    ["the access token expired overnight", "token"],
    ["got a 429 rate-limit from the API", "rate-limit"],
    ["a CORS error blocked the request", "cors"],
    ["run the linter before pushing", "lint"],
    ["cannot read property of undefined", "null-value"],
    ["wrap it in a try/catch to handle the exception", "exception"],
    ["I refactored the payment module", "refactor"],
    ["we had to roll back the deploy", "rollback"],
    ["it works in staging but not in the production environment", "environment-stage"],
    ["check the absolute path of the file", "file-path"],
    ["the process exited with code 1", "exit-code"],
    ["follow semantic versioning for releases", "semver"],
    ["clear the browser cache to invalidate it", "caching"],
    ["check the console.log output", "logging"],
  ];
  it.each(cases)("detects %s -> %s", (sentence, id) => {
    expect(detectConcepts(sentence)).toContain(id);
  });
});

describe("new concepts false positives", () => {
  const benign = [
    "a smooth migration to our new office",
    "the authorization to enter the building",
    "I refactored my morning routine",
    "please log your hours",
    "we ran concurrent sessions at the conference",
    "he is serving three concurrent prison sentences",
    "concurrent enrollment in college courses",
    "a boolean question in philosophy class",
  ];
  const newIds = [
    "migration", "race-condition", "authentication", "authorization", "token",
    "rate-limit", "cors", "lint", "null-value", "exception", "refactor",
    "rollback", "environment-stage", "file-path", "exit-code", "semver",
    "caching", "logging", "concurrency", "boolean",
  ];
  it("does not fire any new concept on benign sentences", () => {
    for (const s of benign) {
      const fired = detectConcepts(s).filter((id) => newIds.includes(id));
      expect(fired).toEqual([]);
    }
  });
});

describe("new concepts (v1.3 dictionary — databases, concurrency, security, data structures)", () => {
  const cases: [string, string][] = [
    ["a SELECT * FROM users query", "database-query"],
    ["the SQL query returned 0 rows", "database-query"],
    ["add a database index on the email column", "index"],
    ["indexing the table improves query speed", "index"],
    ["the foreign key references the users table", "foreign-key"],
    ["set a primary key on the id column", "foreign-key"],
    ["define a GET endpoint for the api route", "endpoint-route"],
    ["attach middleware to handle auth", "middleware"],
    ["use dependency injection to pass the service", "dependency-injection"],
    ["define an interface for the TypeScript type", "interface-type"],
    ["the enum defines each status value", "enum"],
    ["the boolean value is either true or false", "boolean"],
    ["the array index is out of bounds, check the length", "array"],
    ["use a for loop to iterate over each element", "loop"],
    ["the function uses recursion to traverse the tree", "recursion"],
    ["handle concurrency with locks", "concurrency"],
    ["the background thread blocks the main thread", "thread"],
    ["there is a memory leak in the worker process", "memory-leak"],
    ["garbage collection paused the runtime", "garbage-collection"],
    ["the data is encrypted at rest", "encryption"],
    ["hash the password with sha256 before storing", "hashing"],
    ["open a WebSocket connection to the server", "websocket"],
    ["the API has high latency under load", "latency"],
    ["the endpoint should be idempotent", "idempotent"],
  ];
  it.each(cases)("detects '%s' -> %s", (sentence, id) => {
    expect(detectConcepts(sentence)).toContain(id);
  });
});

describe("new concepts v1.3 false positives", () => {
  const v13Ids = [
    "database-query", "index", "foreign-key", "endpoint-route", "middleware",
    "dependency-injection", "interface-type", "enum", "boolean", "array",
    "loop", "recursion", "concurrency", "thread", "memory-leak",
    "garbage-collection", "encryption", "hashing", "websocket", "latency",
    "idempotent",
  ];

  const benign: [string, string[]][] = [
    // "index" should not fire on "the index of the book"
    ["the index of the book was helpful", ["index"]],
    // "thread" should not fire on "a thread of yarn"
    ["I have a thread of yarn on the spool", ["thread"]],
    // "loop" should not fire on "a loop in the rollercoaster"
    ["there is a loop in the rollercoaster track", ["loop"]],
    // "array" should not fire on "an array of options at the store"
    ["an array of beautiful paintings at the gallery", ["array"]],
    // "enum" should not fire on "enumeration of residents"
    ["the enumeration of residents was complete", ["enum"]],
    // "interface" without tech anchor
    ["the interface between two departments", ["interface-type"]],
    // "foreign key" in diplomatic sense — but "foreign key" is very technical, keep as-is
    // "latency" is purely technical — no common benign usage to guard against
    // "middleware" is purely technical — no benign usage
    // "encryption" — "encryption of the contract terms" should NOT fire because "encryption" is tech
    //   but per spec, encryption IS techy so it fires. Skip that false-positive guard.
    // "hashing" non-tech: "hashing potatoes"
    ["she was hashing the potatoes for dinner", ["hashing"]],
    // "recursion" is purely a CS term — no benign usage
    // "memory" without "leak" should not fire
    ["I have a good memory for faces", ["memory-leak"]],
    // garbage without collection context
    ["take out the garbage please", ["garbage-collection"]],
  ];

  it.each(benign)("does not fire %j for ids %j", (sentence, guardIds) => {
    const fired = detectConcepts(sentence).filter((id) => guardIds.includes(id));
    expect(fired).toEqual([]);
  });

  it("does not fire any v1.3 concept on clearly benign sentences", () => {
    const clearlyBenign = [
      "the weather is nice today",
      "I went for a walk in the park",
      "she cooked dinner and watched a film",
    ];
    for (const s of clearlyBenign) {
      const fired = detectConcepts(s).filter((id) => v13Ids.includes(id));
      expect(fired).toEqual([]);
    }
  });
});

describe("new concepts (v1.4 dictionary — web infra, devops, JS internals)", () => {
  const cases: [string, string][] = [
    // cookie
    ["the browser sets a session cookie with the http header", "cookie"],
    // session
    ["the login session token expired for that user", "session"],
    // jwt
    ["verify the JWT before granting access", "jwt"],
    ["decode the JSON web token payload", "jwt"],
    // oauth
    ["sign in with OAuth to connect your account", "oauth"],
    // ssl-tls
    ["the SSL certificate expired for the domain", "ssl-tls"],
    ["configure TLS on the server", "ssl-tls"],
    // dns
    ["update the DNS record for the domain", "dns"],
    // cdn
    ["serve static assets through a CDN", "cdn"],
    ["use a content delivery network to reduce latency", "cdn"],
    // proxy
    ["configure a reverse proxy in nginx", "proxy"],
    ["route the http request through the proxy server", "proxy"],
    // serverless
    ["deploy a serverless function to the cloud", "serverless"],
    // kubernetes
    ["scale the pods in the kubernetes cluster", "kubernetes"],
    ["deploy to k8s with a manifest file", "kubernetes"],
    // container-image
    ["build and push the docker image to the registry", "container-image"],
    ["pull the container image from the registry", "container-image"],
    // microservice
    ["the microservices communicate over gRPC", "microservice"],
    // callback
    ["pass a callback function to handle the async response", "callback"],
    // serialization
    ["serialize the object before sending over the wire", "serialization"],
    ["deserialized the JSON payload into a struct", "serialization"],
    // base64
    ["encode the binary data as base64", "base64"],
    // cron
    ["the cron job runs every night at midnight", "cron"],
    ["set up a scheduled task to clean old logs", "cron"],
    // debounce-throttle
    ["debounce the search input to avoid too many API calls", "debounce-throttle"],
    ["throttling the request rate to prevent API abuse", "debounce-throttle"],
  ];
  it.each(cases)("detects '%s' -> %s", (sentence, id) => {
    expect(detectConcepts(sentence)).toContain(id);
  });
});

describe("new concepts v1.4 false positives", () => {
  const v14Ids = [
    "cookie", "session", "jwt", "oauth", "ssl-tls", "dns", "cdn", "proxy",
    "serverless", "kubernetes", "container-image", "microservice", "callback",
    "serialization", "base64", "cron", "debounce-throttle",
  ];

  const benign: [string, string[]][] = [
    // cookie: plain food context
    ["I'd like a chocolate chip cookie with my coffee", ["cookie"]],
    // session: conference context
    ["the morning session at the conference was inspiring", ["session"]],
    // proxy: voting context
    ["she submitted a proxy vote at the shareholder meeting", ["proxy"]],
    // callback: non-tech phone sense
    ["I'm waiting for a callback from the doctor's office", ["callback"]],
    // cdn: Canadian dollars context
    ["the order was priced in CDN funds", ["cdn"]],
    ["the CDN exchange rate moved today", ["cdn"]],
  ];

  it.each(benign)("does not fire %j for ids %j", (sentence, guardIds) => {
    const fired = detectConcepts(sentence).filter((id) => guardIds.includes(id));
    expect(fired).toEqual([]);
  });

  it("does not fire any v1.4 concept on clearly benign sentences", () => {
    const clearlyBenign = [
      "the weather is nice today",
      "I went for a walk in the park",
      "she cooked dinner and watched a film",
    ];
    for (const s of clearlyBenign) {
      const fired = detectConcepts(s).filter((id) => v14Ids.includes(id));
      expect(fired).toEqual([]);
    }
  });

  it("still detects real CDN usage after anchoring", () => {
    expect(detectConcepts("serve static assets from a CDN")).toContain("cdn");
    expect(detectConcepts("a content delivery network")).toContain("cdn");
  });
});

describe("suggestConcepts", () => {
  it("suggests the right concept for a typo", () => {
    const ids = suggestConcepts("comit").map((s) => s.id);
    expect(ids).toContain("git-commit");
  });

  it("tolerates plurals and related wording", () => {
    expect(suggestConcepts("containers").map((s) => s.id)).toContain("docker");
    expect(suggestConcepts("databse").map((s) => s.id)).toContain("database");
  });

  it("returns no suggestions for gibberish", () => {
    expect(suggestConcepts("zzzzzqqq")).toEqual([]);
  });

  it("returns nothing for very short terms", () => {
    expect(suggestConcepts("a")).toEqual([]);
    expect(suggestConcepts("ab")).toEqual([]);
  });

  it("respects the limit and sorts strongest first", () => {
    const out = suggestConcepts("commit", undefined, 2);
    expect(out.length).toBeLessThanOrEqual(2);
    if (out.length > 1) expect(out[0].score).toBeGreaterThanOrEqual(out[1].score);
  });

  it("does not suggest for an ordinary non-tech phrase", () => {
    expect(suggestConcepts("definitely not a concept")).toEqual([]);
  });
});
