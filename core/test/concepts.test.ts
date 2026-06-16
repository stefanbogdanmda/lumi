/**
 * concepts.test.ts — dictionary integrity + new concept matcher tests
 *
 * TDD: these tests were written BEFORE the new concepts were added.
 * They will fail first, then pass after implementation.
 */

import { describe, it, expect } from "vitest";
import { CONCEPTS } from "../src/concepts";
import { detectConcepts } from "../src/detector";

// ---------------------------------------------------------------------------
// Dictionary integrity
// ---------------------------------------------------------------------------

describe("CONCEPTS dictionary integrity", () => {
  it("all concept ids are unique", () => {
    const ids = CONCEPTS.map((c) => c.id);
    const unique = new Set(ids);
    expect(ids.length, "duplicate concept ids found").toBe(unique.size);
  });

  it("every concept has a non-empty id, label, category, and at least one matcher", () => {
    for (const c of CONCEPTS) {
      expect(c.id.length, `${c.id} has empty id`).toBeGreaterThan(0);
      expect(c.label.length, `${c.id} has empty label`).toBeGreaterThan(0);
      expect(c.category.length, `${c.id} has empty category`).toBeGreaterThan(0);
      expect(c.matchers.length, `${c.id} has no matchers`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Part A — new security concepts: true-positive tests
// ---------------------------------------------------------------------------

describe("new security concept — xss", () => {
  it("detects XSS / cross-site scripting mention", () => {
    expect(detectConcepts("cross-site scripting vulnerability in the HTML output")).toContain("xss");
  });
  it("detects innerHTML assignment with user data", () => {
    expect(detectConcepts("element.innerHTML = userInput")).toContain("xss");
  });
  it("detects unescaped HTML output", () => {
    expect(detectConcepts("rendering unescaped HTML directly into the page")).toContain("xss");
  });
  it("FALSE-POSITIVE: 'the script runs on page load' does NOT fire xss", () => {
    expect(detectConcepts("the script runs on page load")).not.toContain("xss");
  });
  it("FALSE-POSITIVE: 'write a script to automate backups' does NOT fire xss", () => {
    expect(detectConcepts("write a script to automate backups")).not.toContain("xss");
  });
});

describe("new security concept — csrf", () => {
  it("detects CSRF / cross-site request forgery mention", () => {
    expect(detectConcepts("no CSRF token on the form submission")).toContain("csrf");
  });
  it("detects missing CSRF protection", () => {
    expect(detectConcepts("cross-site request forgery protection is missing")).toContain("csrf");
  });
  it("detects lack of csrf protection on POST route", () => {
    expect(detectConcepts("POST route has no csrf protection")).toContain("csrf");
  });
  it("FALSE-POSITIVE: 'use CORS on the API' does NOT fire csrf", () => {
    expect(detectConcepts("configure CORS on the API server")).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: 'the form has validation' does NOT fire csrf", () => {
    expect(detectConcepts("the form has proper validation and error messages")).not.toContain("csrf");
  });
});

describe("new security concept — path-traversal", () => {
  it("detects path traversal in description", () => {
    expect(detectConcepts("attacker uses path traversal to read /etc/passwd")).toContain("path-traversal");
  });
  it("detects directory traversal attack mention", () => {
    expect(detectConcepts("directory traversal attack via the filename parameter")).toContain("path-traversal");
  });
  it("detects ../ sequences in filename", () => {
    expect(detectConcepts("filename = '../../../etc/passwd'")).toContain("path-traversal");
  });
  it("FALSE-POSITIVE: 'navigate to the folder' does NOT fire path-traversal", () => {
    expect(detectConcepts("navigate to the folder and open the file")).not.toContain("path-traversal");
  });
  it("FALSE-POSITIVE: 'relative path to the config' does NOT fire path-traversal", () => {
    expect(detectConcepts("use a relative path to the config file")).not.toContain("path-traversal");
  });
});

describe("new security concept — ssrf", () => {
  it("detects SSRF mention", () => {
    expect(detectConcepts("this endpoint is vulnerable to SSRF attacks")).toContain("ssrf");
  });
  it("detects server-side request forgery mention", () => {
    expect(detectConcepts("server-side request forgery via the URL parameter")).toContain("ssrf");
  });
  it("FALSE-POSITIVE: 'server sends a request to the database' does NOT fire ssrf", () => {
    expect(detectConcepts("the server sends a request to the database")).not.toContain("ssrf");
  });
  it("FALSE-POSITIVE: 'make a request to an external API' does NOT fire ssrf", () => {
    expect(detectConcepts("make a request to an external API for the weather data")).not.toContain("ssrf");
  });
});

describe("new security concept — idor", () => {
  it("detects IDOR mention", () => {
    expect(detectConcepts("IDOR vulnerability: no ownership check before returning record")).toContain("idor");
  });
  it("detects insecure direct object reference", () => {
    expect(detectConcepts("insecure direct object reference allows reading other users data")).toContain("idor");
  });
  it("detects no ownership check on resource", () => {
    expect(detectConcepts("no ownership check before accessing the document")).toContain("idor");
  });
  it("FALSE-POSITIVE: 'fetch the document by ID' does NOT fire idor", () => {
    expect(detectConcepts("fetch the document by its ID from the database")).not.toContain("idor");
  });
  it("FALSE-POSITIVE: 'check the owner field in the UI' does NOT fire idor", () => {
    expect(detectConcepts("display the owner field in the UI next to each item")).not.toContain("idor");
  });
});

describe("new security concept — insecure-deserialization", () => {
  it("detects insecure deserialization mention", () => {
    expect(detectConcepts("insecure deserialization of user-supplied data")).toContain("insecure-deserialization");
  });
  it("detects deserializing untrusted data", () => {
    expect(detectConcepts("deserializing untrusted input from the request body")).toContain("insecure-deserialization");
  });
  it("detects pickle.loads on user data", () => {
    expect(detectConcepts("pickle.loads(user_data) in the handler")).toContain("insecure-deserialization");
  });
  it("FALSE-POSITIVE: 'JSON.parse the response' does NOT fire insecure-deserialization", () => {
    expect(detectConcepts("JSON.parse the API response to get the user object")).not.toContain("insecure-deserialization");
  });
  it("FALSE-POSITIVE: 'serialize the payload before sending' does NOT fire insecure-deserialization", () => {
    expect(detectConcepts("serialize the payload before sending it over the wire")).not.toContain("insecure-deserialization");
  });
});

describe("new security concept — missing-rate-limit", () => {
  it("detects no rate limiting on login endpoint", () => {
    expect(detectConcepts("the login endpoint has no rate limiting")).toContain("missing-rate-limit");
  });
  it("detects missing rate limit on API", () => {
    expect(detectConcepts("missing rate limit on the /api/send-email route")).toContain("missing-rate-limit");
  });
  it("detects brute force due to no rate limit", () => {
    expect(detectConcepts("allows brute force because there is no rate limit on login")).toContain("missing-rate-limit");
  });
  it("FALSE-POSITIVE: 'rate limiting docs' prose does NOT fire missing-rate-limit", () => {
    expect(detectConcepts("rate limiting can help protect your API from abuse")).not.toContain("missing-rate-limit");
  });
  it("FALSE-POSITIVE: 'configure rate limiting for safety' does NOT fire missing-rate-limit", () => {
    expect(detectConcepts("you should configure rate limiting for safety")).not.toContain("missing-rate-limit");
  });
});

describe("new security concept — default-credentials", () => {
  it("detects admin/admin default credentials", () => {
    expect(detectConcepts('login with admin/admin — the default credentials were never changed')).toContain("default-credentials");
  });
  it("detects default password warning", () => {
    expect(detectConcepts("still using the default password for the database")).toContain("default-credentials");
  });
  it("detects never changed default credentials", () => {
    expect(detectConcepts("default credentials were never changed after install")).toContain("default-credentials");
  });
  it("FALSE-POSITIVE: 'admin panel overview' does NOT fire default-credentials", () => {
    expect(detectConcepts("open the admin panel to see the overview dashboard")).not.toContain("default-credentials");
  });
  it("FALSE-POSITIVE: 'set a password for the new user' does NOT fire default-credentials", () => {
    expect(detectConcepts("set a strong password for the new user account")).not.toContain("default-credentials");
  });
});

describe("new security concept — sensitive-data-in-logs", () => {
  it("detects logging a password", () => {
    expect(detectConcepts("console.log(password) in the authentication handler")).toContain("sensitive-data-in-logs");
  });
  it("detects logging a token to stdout", () => {
    expect(detectConcepts("logging the auth token to the server logs")).toContain("sensitive-data-in-logs");
  });
  it("detects PII logged to console", () => {
    expect(detectConcepts("logging user email and credit card number to stdout")).toContain("sensitive-data-in-logs");
  });
  it("FALSE-POSITIVE: 'logging requests for debugging' does NOT fire sensitive-data-in-logs", () => {
    expect(detectConcepts("logging incoming requests for debugging purposes")).not.toContain("sensitive-data-in-logs");
  });
  it("FALSE-POSITIVE: 'view the server logs' does NOT fire sensitive-data-in-logs", () => {
    expect(detectConcepts("view the server logs to diagnose the issue")).not.toContain("sensitive-data-in-logs");
  });
});

describe("new security concept — mass-assignment", () => {
  it("detects mass assignment vulnerability", () => {
    expect(detectConcepts("mass assignment vulnerability: user can overwrite isAdmin field")).toContain("mass-assignment");
  });
  it("detects spread of request body into database record", () => {
    expect(detectConcepts("User.create({ ...req.body }) allows mass assignment of any field")).toContain("mass-assignment");
  });
  it("FALSE-POSITIVE: 'assign values to the form fields' does NOT fire mass-assignment", () => {
    expect(detectConcepts("assign values to the form fields before submitting")).not.toContain("mass-assignment");
  });
  it("FALSE-POSITIVE: 'bulk assign tasks to team members' does NOT fire mass-assignment", () => {
    expect(detectConcepts("bulk assign tasks to team members in the project")).not.toContain("mass-assignment");
  });
});

describe("new security concept — debug-mode-in-prod", () => {
  it("detects debug mode enabled in production", () => {
    expect(detectConcepts("DEBUG=True in production exposes stack traces to users")).toContain("debug-mode-in-prod");
  });
  it("detects stack traces exposed in production", () => {
    expect(detectConcepts("stack traces are exposed to end users in the production environment")).toContain("debug-mode-in-prod");
  });
  it("detects debug mode left on in prod", () => {
    expect(detectConcepts("debug mode is still enabled on the production server")).toContain("debug-mode-in-prod");
  });
  it("FALSE-POSITIVE: 'enable debug logging locally' does NOT fire debug-mode-in-prod", () => {
    expect(detectConcepts("enable debug logging locally to trace the issue")).not.toContain("debug-mode-in-prod");
  });
  it("FALSE-POSITIVE: 'check the stack trace in development' does NOT fire debug-mode-in-prod", () => {
    expect(detectConcepts("check the stack trace in development to find the bug")).not.toContain("debug-mode-in-prod");
  });
});

// ---------------------------------------------------------------------------
// Part B — new general concepts: true-positive tests
// ---------------------------------------------------------------------------

describe("new general concept — orm", () => {
  it("detects ORM mention", () => {
    expect(detectConcepts("use an ORM like Prisma or Sequelize to query the database")).toContain("orm");
  });
  it("detects object-relational mapper", () => {
    expect(detectConcepts("an object-relational mapper abstracts SQL queries")).toContain("orm");
  });
  it("FALSE-POSITIVE: 'database query' alone does NOT fire orm", () => {
    expect(detectConcepts("run a database query to fetch all users")).not.toContain("orm");
  });
});

describe("new general concept — graphql", () => {
  it("detects GraphQL mention", () => {
    expect(detectConcepts("use GraphQL to fetch only the fields you need")).toContain("graphql");
  });
  it("detects GraphQL query/mutation", () => {
    expect(detectConcepts("write a GraphQL mutation to create a new post")).toContain("graphql");
  });
  it("FALSE-POSITIVE: 'graph-based data structure' does NOT fire graphql", () => {
    expect(detectConcepts("use a graph-based data structure for the network")).not.toContain("graphql");
  });
});

describe("new general concept — message-queue", () => {
  it("detects message queue mention", () => {
    expect(detectConcepts("use a message queue to decouple the email sending")).toContain("message-queue");
  });
  it("detects job queue / task queue", () => {
    expect(detectConcepts("add the job to the task queue and process it async")).toContain("message-queue");
  });
  it("detects RabbitMQ or Redis Queue", () => {
    expect(detectConcepts("RabbitMQ routes messages between services")).toContain("message-queue");
  });
  it("FALSE-POSITIVE: 'queue of items in a list' does NOT fire message-queue", () => {
    expect(detectConcepts("there is a queue of items waiting to be processed in the list")).not.toContain("message-queue");
  });
});

describe("new general concept — feature-flag", () => {
  it("detects feature flag mention", () => {
    expect(detectConcepts("use a feature flag to roll out the new checkout UI gradually")).toContain("feature-flag");
  });
  it("detects feature toggle mention", () => {
    expect(detectConcepts("enable the feature toggle to test the beta version")).toContain("feature-flag");
  });
  it("FALSE-POSITIVE: 'flag an issue' does NOT fire feature-flag", () => {
    expect(detectConcepts("flag this issue for review by the team")).not.toContain("feature-flag");
  });
});

describe("new general concept — error-monitoring", () => {
  it("detects error monitoring mention", () => {
    expect(detectConcepts("set up error monitoring with Sentry to track crashes")).toContain("error-monitoring");
  });
  it("detects crash reporting tool", () => {
    expect(detectConcepts("crash reporting is handled by the monitoring dashboard")).toContain("error-monitoring");
  });
  it("FALSE-POSITIVE: 'handle errors in the code' does NOT fire error-monitoring", () => {
    expect(detectConcepts("handle errors gracefully in the code")).not.toContain("error-monitoring");
  });
});

describe("new general concept — uptime-monitoring", () => {
  it("detects uptime monitoring", () => {
    expect(detectConcepts("uptime monitoring alerts you when the site goes down")).toContain("uptime-monitoring");
  });
  it("detects health check endpoint mention", () => {
    expect(detectConcepts("add a health check endpoint so the monitor knows if the service is up")).toContain("uptime-monitoring");
  });
  it("FALSE-POSITIVE: 'server is running' does NOT fire uptime-monitoring", () => {
    expect(detectConcepts("make sure the server is running before deploying")).not.toContain("uptime-monitoring");
  });
});

describe("new general concept — load-balancer", () => {
  it("detects load balancer mention", () => {
    expect(detectConcepts("put a load balancer in front of the API servers")).toContain("load-balancer");
  });
  it("detects load balancing traffic", () => {
    expect(detectConcepts("load balancing distributes traffic across multiple instances")).toContain("load-balancer");
  });
  it("FALSE-POSITIVE: 'balance the workload manually' does NOT fire load-balancer", () => {
    expect(detectConcepts("balance the workload manually between the two team members")).not.toContain("load-balancer");
  });
});

describe("new general concept — pagination", () => {
  it("detects pagination mention", () => {
    expect(detectConcepts("add pagination to the results list so you don't load all 10000 rows")).toContain("pagination");
  });
  it("detects page/cursor-based paging", () => {
    expect(detectConcepts("use cursor-based pagination for the infinite scroll feed")).toContain("pagination");
  });
  it("FALSE-POSITIVE: 'page title' does NOT fire pagination", () => {
    expect(detectConcepts("set the page title in the HTML head element")).not.toContain("pagination");
  });
});

describe("new general concept — backup", () => {
  it("detects database backup mention", () => {
    expect(detectConcepts("schedule a database backup every night to S3")).toContain("backup");
  });
  it("detects data backup / restore", () => {
    expect(detectConcepts("restore from backup after the accidental data deletion")).toContain("backup");
  });
  it("FALSE-POSITIVE: 'back up the changes' in general prose does NOT fire backup", () => {
    expect(detectConcepts("make sure to save your work before you close the editor")).not.toContain("backup");
  });
});

describe("new general concept — webhook-signature", () => {
  it("detects webhook signature verification", () => {
    expect(detectConcepts("verify the webhook signature to confirm it came from Stripe")).toContain("webhook-signature");
  });
  it("detects HMAC signature check on incoming webhook", () => {
    expect(detectConcepts("validate the HMAC signature on the incoming webhook payload")).toContain("webhook-signature");
  });
  it("FALSE-POSITIVE: 'webhook fires when event happens' does NOT fire webhook-signature", () => {
    expect(detectConcepts("a webhook fires when the payment event happens")).not.toContain("webhook-signature");
  });
});

describe("new general concept — rest-api", () => {
  it("detects REST API design mention", () => {
    expect(detectConcepts("design a RESTful API with proper resource naming conventions")).toContain("rest-api");
  });
  it("detects REST resource conventions", () => {
    expect(detectConcepts("follow REST conventions: GET /users, POST /users, DELETE /users/:id")).toContain("rest-api");
  });
  it("FALSE-POSITIVE: 'API endpoint' alone does NOT fire rest-api", () => {
    expect(detectConcepts("call the API endpoint with the correct parameters")).not.toContain("rest-api");
  });
});

// ---------------------------------------------------------------------------
// Part A (new additions) — 7 more security concepts
// ---------------------------------------------------------------------------

describe("new security concept — open-redirect", () => {
  it("detects open redirect terminology", () => {
    expect(detectConcepts("the endpoint has an open redirect via the returnUrl param")).toContain("open-redirect");
  });
  it("detects redirect to unvalidated user-supplied URL", () => {
    expect(detectConcepts("redirect to the unvalidated user-supplied URL without checking")).toContain("open-redirect");
  });
  it("detects res.redirect to user-controlled URL", () => {
    expect(detectConcepts("res.redirect(req.query.next) — redirecting to user-controlled URL")).toContain("open-redirect");
  });
  it("FALSE-POSITIVE: 'redirect user to dashboard after login' does NOT fire open-redirect", () => {
    expect(detectConcepts("redirect the user to the dashboard after login")).not.toContain("open-redirect");
  });
  it("FALSE-POSITIVE: '301 redirect from old to new URL' does NOT fire open-redirect", () => {
    expect(detectConcepts("add a 301 redirect from /old to /new in the routes config")).not.toContain("open-redirect");
  });
});

describe("new security concept — jwt-alg-none", () => {
  it("detects JWT alg:none attack", () => {
    expect(detectConcepts('JWT with alg:"none" bypasses signature verification')).toContain("jwt-alg-none");
  });
  it("detects JWT signature not verified", () => {
    expect(detectConcepts("the server accepts JWTs without verifying the signature")).toContain("jwt-alg-none");
  });
  it("detects algorithm none in JWT header", () => {
    expect(detectConcepts('JWT header {"alg":"none"} disables signing')).toContain("jwt-alg-none");
  });
  it("FALSE-POSITIVE: 'decode a JWT to read claims' does NOT fire jwt-alg-none", () => {
    expect(detectConcepts("decode a JWT to read the user claims from the payload")).not.toContain("jwt-alg-none");
  });
  it("FALSE-POSITIVE: 'sign JWT with HS256' does NOT fire jwt-alg-none", () => {
    expect(detectConcepts("sign the JWT with HS256 using the secret key")).not.toContain("jwt-alg-none");
  });
});

describe("new security concept — insecure-cookie", () => {
  it("detects auth cookie without httpOnly", () => {
    expect(detectConcepts("auth cookie is set without the httpOnly flag")).toContain("insecure-cookie");
  });
  it("detects session cookie missing Secure attribute", () => {
    expect(detectConcepts("session cookie is missing the Secure attribute so it travels over HTTP")).toContain("insecure-cookie");
  });
  it("detects cookie without sameSite", () => {
    expect(detectConcepts("cookie without sameSite attribute makes it vulnerable to CSRF")).toContain("insecure-cookie");
  });
  it("FALSE-POSITIVE: 'set a cookie for the user session' does NOT fire insecure-cookie", () => {
    expect(detectConcepts("set a cookie for the user session on login")).not.toContain("insecure-cookie");
  });
  it("FALSE-POSITIVE: 'accept cookies policy banner' does NOT fire insecure-cookie", () => {
    expect(detectConcepts("show the accept cookies policy banner to new visitors")).not.toContain("insecure-cookie");
  });
});

describe("new security concept — verbose-error-exposed", () => {
  it("detects stack trace returned to the user", () => {
    expect(detectConcepts("the API returns the full stack trace to the user on error")).toContain("verbose-error-exposed");
  });
  it("detects internal error details in response", () => {
    expect(detectConcepts("server sends internal error details back in the HTTP response body")).toContain("verbose-error-exposed");
  });
  it("detects verbose error message exposing internals", () => {
    expect(detectConcepts("verbose error message exposes the database path to clients")).toContain("verbose-error-exposed");
  });
  it("FALSE-POSITIVE: 'handle errors gracefully' does NOT fire verbose-error-exposed", () => {
    expect(detectConcepts("handle errors gracefully and show a friendly message to users")).not.toContain("verbose-error-exposed");
  });
  it("FALSE-POSITIVE: 'log the error server-side' does NOT fire verbose-error-exposed", () => {
    expect(detectConcepts("log the error on the server side for debugging")).not.toContain("verbose-error-exposed");
  });
});

describe("new security concept — cleartext-token-storage", () => {
  it("detects auth token stored in localStorage", () => {
    expect(detectConcepts("localStorage.setItem('authToken', token) stores the token in plaintext")).toContain("cleartext-token-storage");
  });
  it("detects JWT in localStorage", () => {
    expect(detectConcepts("storing the JWT in localStorage makes it accessible to XSS attacks")).toContain("cleartext-token-storage");
  });
  it("detects access token written to localStorage", () => {
    expect(detectConcepts("save the access token to localStorage for later use")).toContain("cleartext-token-storage");
  });
  it("FALSE-POSITIVE: 'store user preferences in localStorage' does NOT fire cleartext-token-storage", () => {
    expect(detectConcepts("store user preferences like theme and language in localStorage")).not.toContain("cleartext-token-storage");
  });
  it("FALSE-POSITIVE: 'use sessionStorage for temporary UI state' does NOT fire cleartext-token-storage", () => {
    expect(detectConcepts("use sessionStorage for temporary UI state that resets on tab close")).not.toContain("cleartext-token-storage");
  });
});

describe("new security concept — directory-listing", () => {
  it("detects directory listing enabled on server", () => {
    expect(detectConcepts("directory listing is enabled on the web server exposing all files")).toContain("directory-listing");
  });
  it("detects autoindex on in nginx", () => {
    expect(detectConcepts("autoindex on in nginx config allows directory listing of uploads folder")).toContain("directory-listing");
  });
  it("detects directory browsing enabled", () => {
    expect(detectConcepts("directory browsing is enabled, letting attackers enumerate all files")).toContain("directory-listing");
  });
  it("FALSE-POSITIVE: 'list files in directory with ls' does NOT fire directory-listing", () => {
    expect(detectConcepts("list the files in a directory using the ls command")).not.toContain("directory-listing");
  });
  it("FALSE-POSITIVE: 'show a listing of products' does NOT fire directory-listing", () => {
    expect(detectConcepts("show a listing of products on the homepage")).not.toContain("directory-listing");
  });
});

describe("new security concept — ssti", () => {
  it("detects server-side template injection", () => {
    expect(detectConcepts("server-side template injection via the name parameter")).toContain("ssti");
  });
  it("detects SSTI abbreviation", () => {
    expect(detectConcepts("the endpoint is vulnerable to SSTI attacks through the template engine")).toContain("ssti");
  });
  it("detects user input passed into Jinja2 template", () => {
    expect(detectConcepts("user input is passed directly into the Jinja2 template without sanitization")).toContain("ssti");
  });
  it("FALSE-POSITIVE: 'use a template for the email layout' does NOT fire ssti", () => {
    expect(detectConcepts("use a template for the email layout")).not.toContain("ssti");
  });
  it("FALSE-POSITIVE: 'render the HTML template with static data' does NOT fire ssti", () => {
    expect(detectConcepts("render the HTML template with static data from the config file")).not.toContain("ssti");
  });
});

// ---------------------------------------------------------------------------
// Part B (new) — false-positive fix guards for sensitive-data-in-logs + database-query
// ---------------------------------------------------------------------------

describe("sensitive-data-in-logs — Part B FP fix guards", () => {
  it("FALSE-POSITIVE: journaling prose 'log my password to the diary' does NOT fire", () => {
    expect(detectConcepts("I need to log my password to the diary so I don't forget it")).not.toContain("sensitive-data-in-logs");
  });
  it("FALSE-POSITIVE: 'Logging sensitive information about feelings' does NOT fire", () => {
    expect(detectConcepts("Logging sensitive information about my feelings in a journal")).not.toContain("sensitive-data-in-logs");
  });
  it("TRUE-POSITIVE: 'console.log(password)' still fires sensitive-data-in-logs", () => {
    expect(detectConcepts("console.log(password) in the authentication handler")).toContain("sensitive-data-in-logs");
  });
  it("TRUE-POSITIVE: 'logger.info(token)' still fires sensitive-data-in-logs", () => {
    expect(detectConcepts("logger.info('token: ' + token)")).toContain("sensitive-data-in-logs");
  });
  it("TRUE-POSITIVE: 'logging the user auth token' still fires sensitive-data-in-logs", () => {
    expect(detectConcepts("logging the user's auth token to the server logs")).toContain("sensitive-data-in-logs");
  });
});

describe("database-query — Part B FP fix: bare 'table' guard", () => {
  it("FALSE-POSITIVE: 'query about the table reservation' does NOT fire database-query", () => {
    expect(detectConcepts("The query about the table reservation was answered.")).not.toContain("database-query");
  });
  it("TRUE-POSITIVE: 'query the users table with SELECT' still fires database-query", () => {
    expect(detectConcepts("query the users table with SELECT * FROM users")).toContain("database-query");
  });
  it("TRUE-POSITIVE: 'SQL query on the users table' still fires database-query", () => {
    expect(detectConcepts("run an SQL query on the users table to fetch active accounts")).toContain("database-query");
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #1 — CSRF matcher must not fire on correctly-secured code
// ---------------------------------------------------------------------------

describe("csrf matcher — false-positive guards for correctly-secured code", () => {
  it("FALSE-POSITIVE: 'CSRF token is added to every form' must NOT fire csrf", () => {
    // A developer who added CSRF protection should NOT be warned they're vulnerable
    expect(detectConcepts("The CSRF token is added to every form")).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: 'we add a CSRF token for safety' must NOT fire csrf", () => {
    expect(detectConcepts("We add a CSRF token for safety")).not.toContain("csrf");
  });
  it("FALSE-POSITIVE: 'CSRF protection is handled by the framework' must NOT fire csrf", () => {
    expect(detectConcepts("CSRF protection is handled by the framework")).not.toContain("csrf");
  });
  it("TRUE-POSITIVE: 'no CSRF protection' still fires csrf", () => {
    expect(detectConcepts("no CSRF protection on this form")).toContain("csrf");
  });
  it("TRUE-POSITIVE: 'CSRF protection is missing' still fires csrf", () => {
    expect(detectConcepts("CSRF protection is missing from the POST route")).toContain("csrf");
  });
  it("TRUE-POSITIVE: 'CSRF token is disabled' still fires csrf", () => {
    expect(detectConcepts("CSRF token is disabled in the middleware")).toContain("csrf");
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #3 — rate-limit matcher bare 'no' alternative must be removed
// ---------------------------------------------------------------------------

describe("missing-rate-limit matcher — false-positive guard for bare 'no'", () => {
  it("FALSE-POSITIVE: 'the rate limit is 100 requests, no problem' must NOT fire missing-rate-limit", () => {
    expect(detectConcepts("the rate limit is 100 requests, no problem")).not.toContain("missing-rate-limit");
  });
  it("TRUE-POSITIVE: 'no rate limiting on login' still fires missing-rate-limit", () => {
    expect(detectConcepts("no rate limiting on login")).toContain("missing-rate-limit");
  });
});

// ---------------------------------------------------------------------------
// Regression: FIX #4 — IDOR matcher must not fire on working ownership checks
// ---------------------------------------------------------------------------

describe("idor matcher — false-positive guards for working ownership checks", () => {
  it("FALSE-POSITIVE: 'ownership check runs before returning the document' must NOT fire idor", () => {
    expect(detectConcepts("the ownership check runs before returning the document")).not.toContain("idor");
  });
  it("FALSE-POSITIVE: 'ownership check runs before access' must NOT fire idor", () => {
    expect(detectConcepts("the ownership check runs before access to the resource")).not.toContain("idor");
  });
  it("TRUE-POSITIVE: 'missing ownership check' still fires idor", () => {
    expect(detectConcepts("missing ownership check on the document endpoint")).toContain("idor");
  });
  it("TRUE-POSITIVE: 'ownership check is bypassed' still fires idor", () => {
    expect(detectConcepts("ownership check is bypassed in the delete route")).toContain("idor");
  });
});
