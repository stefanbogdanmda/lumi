import { Concept } from "./types";

/** v1.1 dictionary: tighter matchers (require a tech anchor) + broader coverage (~36 concepts). */
export const CONCEPTS: Concept[] = [
  { id: "git-commit", label: "Git commit", category: "git",
    matchers: [/git\s+commit/i, /\bcommit(ted|s|ting)?\b.{0,30}\b(branch|repo|stage|change|git|main)/i, /\b(make|create|new)\s+a?\s*commit\b/i] },
  { id: "git-branch", label: "Git branch", category: "git",
    matchers: [/git\s+branch/i, /\bbranch(es|ing)?\b.{0,30}\b(git|commit|merge|repo|main|master|checkout)/i, /\b(checkout|switch\s+to)\b.{0,12}branch/i] },
  { id: "git-push", label: "Git push", category: "git",
    matchers: [/git\s+push/i, /\bpush(ed|ing)?\b.{0,20}\b(origin|remote|branch|repo)/i] },
  { id: "git-merge", label: "Git merge", category: "git",
    matchers: [/git\s+merge/i, /\bmerge\s+conflict/i, /\bmerg(e|ed|ing)\b.{0,20}\bbranch/i] },
  { id: "git-pull", label: "Git pull", category: "git",
    matchers: [/git\s+pull/i, /\bpull(ed|ing)?\b.{0,20}\b(origin|remote|latest|changes)/i] },
  { id: "repository", label: "Code repository", category: "git",
    matchers: [/\brepository\b/i, /\brepo\b/i, /\bgit\s+repo/i] },
  { id: "pull-request", label: "Pull request", category: "git",
    matchers: [/\bpull\s+request/i, /\bPR\b.{0,15}\b(merge|review|open|branch)/i] },
  { id: "git-diff", label: "Code diff", category: "git",
    matchers: [/git\s+diff/i, /\bdiff\b.{0,20}\b(commit|branch|change|file)/i] },
  { id: "npm-install", label: "Installing packages (npm)", category: "node",
    matchers: [/npm\s+install/i, /\bnode_modules\b/, /\byarn\s+add\b/i, /\bpnpm\s+(install|add)/i] },
  { id: "npm-script", label: "npm scripts", category: "node",
    matchers: [/npm\s+run\b/i, /\bpackage\.json\b.{0,20}\bscripts/i] },
  { id: "dependency", label: "Dependency", category: "node",
    matchers: [/\bdependenc(y|ies)\b/i, /\bdevDependencies\b/] },
  { id: "env-var", label: "Environment variable", category: "shell",
    // `\b\.env\b` never matched a space-preceded ".env" (no word boundary before a dot),
    // missing the very common "add a .env file". `\.env\b` catches .env / .env.local etc.
    matchers: [/\benvironment\s+variable/i, /\bprocess\.env\b/, /\.env\b/, /\benv\s+var/i] },
  { id: "cli", label: "Command-line interface (CLI)", category: "shell",
    matchers: [/\bcommand[- ]line/i, /\bCLI\b/, /\bterminal\s+command/i] },
  { id: "shell-script", label: "Shell script", category: "shell",
    matchers: [/\bshell\s+script/i, /\bbash\s+script/i, /\.sh\b/] },
  { id: "ssh", label: "SSH / secure shell", category: "shell",
    matchers: [/\bssh\b/i, /\bSSH\s+key/i] },
  { id: "api", label: "API", category: "web",
    matchers: [/\bAPI\b.{0,25}\b(call|request|endpoint|key|response|REST|returns?|data|json|fetch|serves?)/i, /\bREST\s+API/i, /\bendpoint\b/i] },
  { id: "http-status", label: "HTTP status code", category: "web",
    matchers: [/\bHTTP\b.{0,8}\b\d{3}\b/i, /\bstatus\s+code\b/i, /\b(404|500|403|401)\b.{0,15}\b(error|not\s+found|server|unauthorized|forbidden)/i] },
  { id: "http-request", label: "HTTP request", category: "web",
    matchers: [/\bHTTP\s+request/i, /\b(GET|POST|PUT|DELETE)\b.{0,15}\b(request|endpoint|api|route)/i] },
  { id: "webhook", label: "Webhook", category: "web",
    matchers: [/\bwebhook/i] },
  { id: "port", label: "Network port", category: "web",
    matchers: [/\bport\s+\d{2,5}\b/i, /\blocalhost:\d+/i] },
  { id: "localhost", label: "localhost", category: "web",
    matchers: [/\blocalhost\b/i, /\b127\.0\.0\.1\b/] },
  { id: "json", label: "JSON", category: "data",
    matchers: [/\bJSON\b/, /\.json\b/] },
  { id: "database", label: "Database", category: "data",
    matchers: [/\bdatabase\b/i, /\bSQL\b/, /\bquery\b.{0,20}\b(database|row|select)/i] },
  { id: "schema", label: "Data schema", category: "data",
    matchers: [/\bschema\b.{0,20}\b(table|field|database|json|data|column)/i, /\b(database|json|data|table)\s+schema\b/i] },
  { id: "docker", label: "Docker container", category: "devops",
    matchers: [/\bDocker\b/, /\bcontainer\b.{0,20}\b(docker|image|run|build)/i, /\bDockerfile\b/] },
  { id: "deploy", label: "Deploying", category: "devops",
    // Anchored to a software-deploy context so "deploy the team / troops / resources"
    // (ordinary English) no longer triggers a lesson.
    matchers: [
      /\bdeploy(ed|ing|ment)?\b.{0,30}\b(app|application|site|website|web\s*app|server|production|staging|cloud|host(ing)?|build|release|code|container|service|api|function|vercel|netlify|heroku|aws|azure|render)\b/i,
      /\b(app|application|site|website|web\s*app|code|build|release|container|service|frontend|backend)\b.{0,30}\bdeploy(ed|ing|ment)?\b/i,
      /\bdeploy(ing)?\s+to\s+(production|staging|prod|the\s+(server|cloud)|vercel|netlify|heroku|aws)\b/i,
      /\bproduction\s+server\b/i,
      /\bdeployment\s+(pipeline|process|config|target|environment|url)\b/i,
    ] },
  { id: "ci", label: "Continuous Integration (CI)", category: "devops",
    matchers: [/\bCI\b.{0,15}\b(pipeline|build|run|workflow|test)/i, /\bGitHub\s+Actions/i, /\bcontinuous\s+integration/i] },
  { id: "compile", label: "Compiling code", category: "build",
    matchers: [/\bcompil(e|ed|ing|ation)\b/i, /\btsc\b/, /\bTypeScript\b.{0,20}\b(compile|build)/i] },
  { id: "build-tool", label: "Build / bundling", category: "build",
    matchers: [/\bbundl(e|er|ing)\b/i, /\bbuild\s+step/i, /\bwebpack\b|\bvite\b|\besbuild\b/i] },
  { id: "test-suite", label: "Automated tests", category: "testing",
    matchers: [/\btest\s+suite/i, /\b(tests?)\b.{0,15}\b(pass(ed|ing)?|fail(ed|ing)?)/i, /\bvitest\b|\bpytest\b|\bjest\b/i] },
  { id: "unit-test", label: "Unit test", category: "testing", priority: 2,
    matchers: [/\bunit\s+test(s|ing)?\b/i, /\bunit\b.{0,15}\b(test|spec|assert|expect|mock)/i] },
  { id: "integration-test", label: "Integration test", category: "testing", priority: 2,
    matchers: [/\bintegration\s+test(s|ing)?\b/i, /\bend[- ]to[- ]end\s+test/i, /\be2e\s+test/i] },
  { id: "test-coverage", label: "Test coverage", category: "testing", priority: 2,
    matchers: [/\btest\s+coverage\b/i, /\bcoverage\b.{0,20}\b(report|percent|threshold|line|branch|statement)/i, /\bcode\s+coverage\b/i] },
  { id: "mocking", label: "Mocking / test doubles", category: "testing", priority: 1,
    matchers: [/\bmock(ed|ing|s)?\b.{0,20}\b(function|module|api|service|call|dependency|object|class)/i, /\bstub(bed|bing|s)?\b.{0,15}\b(function|method|call|api|response)/i, /\bspy\b.{0,15}\b(function|method|call|jest|vitest)/i] },
  { id: "assertion", label: "Test assertion", category: "testing", priority: 1,
    matchers: [/\bassert(ion|s|ed|ing)?\b.{0,20}\b(expect|equal|fail|pass|throw|true|false|value|result)/i, /\bexpect\b.{0,15}\b(toBe|toEqual|toContain|toThrow|toMatch|toHaveLength|toBeNull|toBeTruthy|toBeFalsy)/i] },
  { id: "function", label: "Function", category: "programming",
    matchers: [
      /\bfunction\b.{0,25}\b(call|return|parameter|argument|define|javascript|typescript|python|method)/i,
      /\b(JavaScript|TypeScript|Python)\s+function/i,
      // reverse order: "a parameter/argument/return value … to the function"
      /\b(parameters?|arguments?|return\s+value)\b.{0,20}\bfunction\b/i,
    ] },
  { id: "async", label: "Asynchronous code", category: "programming",
    matchers: [/\basync\/await\b/i, /\basync\b.{0,20}\b(function|code|operation|call|javascript|promise|task|method)/i, /\bawait\b.{0,20}\b(promise|async|function|call|result|response|fetch)/i, /\bpromise\b.{0,20}\b(resolve|reject|async|await|then)/i] },
  { id: "regex", label: "Regular expression", category: "programming",
    matchers: [/\bregex\b/i, /\bregular\s+expression/i] },
  { id: "type-system", label: "Types / type checking", category: "programming",
    matchers: [/\btype\s+(error|check|annotation|definition)/i, /\bTypeScript\s+types?/i] },
  { id: "stack-trace", label: "Stack trace / error log", category: "programming",
    matchers: [/\bstack\s+trace/i, /\btraceback\b/i] },
  { id: "package-manager", label: "Package manager", category: "node",
    matchers: [/\bpackage\s+manager/i, /\bnpm\b.{0,15}\bregistry/i] },
  // --- v1.2 dictionary expansion (scary-but-common terms + priority) ---
  { id: "migration", label: "Database migration", category: "data", priority: 3,
    matchers: [/\b(database|schema|db|data)\s+migration/i, /\bmigrat(e|ion|ing)\b.{0,20}\b(database|schema|table|column)/i] },
  { id: "race-condition", label: "Race condition", category: "programming", priority: 3,
    matchers: [/\brace\s+condition/i] },
  { id: "authentication", label: "Authentication", category: "web", priority: 3,
    matchers: [/\bauthenticat(e|ed|ion|ing)/i, /\bsign(ing)?\s+in\b.{0,15}\b(token|session|auth|credential)/i] },
  { id: "authorization", label: "Authorization", category: "web", priority: 2,
    matchers: [/\bauthoriz(e|ed|ation|ing)\b.{0,20}\b(role|access|grant|denied|token|api|request|action|endpoint|resource|header)/i, /\b(role|access|grant|denied|token|api|request|endpoint|resource|user)\b.{0,20}\bauthoriz(e|ed|ation|ing)/i, /\bpermission(s)?\b.{0,15}\b(role|access|grant|denied)/i] },
  { id: "token", label: "Access token", category: "web", priority: 2,
    matchers: [/\b(access|auth|bearer|api)\s+token/i, /\btoken\b.{0,15}\b(expire|refresh|secret|header)/i] },
  { id: "rate-limit", label: "Rate limiting", category: "web", priority: 2,
    matchers: [/\brate[- ]limit/i, /\btoo many requests/i, /\b429\b/] },
  { id: "cors", label: "CORS (cross-origin)", category: "web", priority: 2,
    matchers: [/\bCORS\b/, /\bcross[- ]origin/i] },
  { id: "lint", label: "Linting", category: "build", priority: 1,
    matchers: [/\blint(er|ing)?\b/i, /\beslint\b|\bprettier\b/i] },
  { id: "null-value", label: "Null / undefined value", category: "programming", priority: 2,
    matchers: [/\b(null|undefined)\b.{0,20}\b(error|reference|value|check|pointer)/i, /\bcannot read propert/i] },
  { id: "exception", label: "Exception / error handling", category: "programming", priority: 2,
    matchers: [
      /\b(throw|threw|throws|catch|caught|raise[d]?|unhandled|uncaught|runtime|null\s*pointer)\b.{0,14}\bexception/i,
      /\bexception\b.{0,15}\b(thrown|caught|handler|handling|stack|error|class)/i,
      /\btry[\/ ]?catch/i,
      /\bthrow(n|s)?\s+an?\s+error/i,
    ] },
  { id: "refactor", label: "Refactoring", category: "programming", priority: 1,
    matchers: [/\brefactor(ing|ed)?\b.{0,20}\b(code|module|function|class|component|method|file|logic|app|service|test|helper)/i, /\b(code|module|function|class|component|method|file|logic|app|service|test|helper)\b.{0,20}\brefactor(ing|ed)?\b/i] },
  { id: "rollback", label: "Rollback", category: "devops", priority: 2,
    matchers: [/\broll(ed)?\s*back\b.{0,15}\b(deploy|commit|change|migration|database|release|version|server)/i, /\b(deploy|commit|change|migration|release|version)\b.{0,15}\broll(ed)?\s*back/i, /\brevert(ed|ing)?\b.{0,15}\b(commit|change|deploy)/i] },
  { id: "environment-stage", label: "Staging / production environment", category: "devops", priority: 2,
    matchers: [/\b(staging|production)\b.{0,15}\b(environment|deploy|server|database)/i] },
  { id: "file-path", label: "File path", category: "shell", priority: 1,
    matchers: [/\bfile\s+path/i, /\bworking\s+directory/i, /\b(absolute|relative)\s+path/i] },
  { id: "exit-code", label: "Exit code", category: "shell", priority: 1,
    matchers: [/\bexit\s+code/i, /\bexited\s+with\s+(code\s+)?\d+/i, /\bnon-zero\s+exit/i] },
  { id: "semver", label: "Semantic versioning", category: "build", priority: 1,
    matchers: [/\bsemantic\s+versioning/i, /\bsemver\b/i, /\bmajor\.minor\.patch/i] },
  { id: "caching", label: "Caching", category: "web", priority: 2,
    matchers: [
      /\bcach(e|ing|ed)\b.{0,25}\b(store|memory|invalidat|clear|browser|layer|key|server|response|result|data|api|query|performance|speed|faster|fast|expensive)/i,
      /\bcache\s+(hit|miss)\s+rate/i,
    ] },
  { id: "logging", label: "Logging", category: "programming", priority: 1,
    matchers: [
      /\bconsole\.log/i,
      /\blog(ging|s)?\b.{0,15}\b(console|output|level|debug|stderr|stdout|file)/i,
    ] },
  // --- v1.3 dictionary expansion (databases, concurrency, security, data structures) ---
  { id: "database-query", label: "Database query / SQL", category: "data", priority: 2,
    matchers: [
      /\bSQL\b/,
      /\bSELECT\b.{0,20}\bFROM\b/i,
      // Require a DB token (sql/database/row/join/column) near "query" — bare "table" removed to avoid
      // firing on benign prose like "the query about the table reservation"
      /\bquery\b.{0,15}\b(sql|database|row|join|column)\b/i,
      // query + table only when a DB anchor (SELECT/sql) is also present in the near context
      /\bquery\b.{0,30}\btable\b.{0,30}\b(SELECT|sql|column|join|row)\b/i,
      /\b(SELECT|sql)\b.{0,30}\btable\b/i,
    ] },
  { id: "index", label: "Database index", category: "data", priority: 1,
    matchers: [
      /\b(database|db)\s+index/i,
      /\bindex(ed|ing)?\b.{0,15}\b(column|table|query|database)/i,
      /\bindexing\b.{0,15}\b(column|table|query|database)/i,
    ] },
  { id: "foreign-key", label: "Foreign key / primary key", category: "data", priority: 1,
    matchers: [
      /\bforeign\s+key/i,
      /\bprimary\s+key/i,
    ] },
  { id: "endpoint-route", label: "API endpoint / route", category: "web", priority: 1,
    matchers: [
      /\b(route|endpoint)\b.{0,15}\b(api|http|get|post|handler|url)/i,
      /\b(api|http|get|post|handler|url)\b.{0,15}\b(route|endpoint)\b/i,
    ] },
  { id: "middleware", label: "Middleware", category: "web", priority: 1,
    matchers: [
      /\bmiddleware\b/i,
    ] },
  { id: "dependency-injection", label: "Dependency injection", category: "programming", priority: 1,
    matchers: [
      /\bdependency\s+injection/i,
    ] },
  { id: "interface-type", label: "Interface / type definition", category: "programming", priority: 1,
    matchers: [
      /\binterface\b.{0,15}\b(typescript|implement|method|define|type)/i,
    ] },
  { id: "enum", label: "Enum / enumeration", category: "programming", priority: 1,
    matchers: [
      /\benum(eration)?\b.{0,15}\b(value|type|constant|define|status|each)/i,
    ] },
  { id: "boolean", label: "Boolean value", category: "programming", priority: 1,
    matchers: [
      /\bboolean\b.{0,15}\b(value|flag|true|false|type|field|return|expression|variable|condition)/i,
      /\b(true|false)\b.{0,10}\bboolean\b/i,
    ] },
  { id: "array", label: "Array", category: "programming", priority: 1,
    matchers: [
      /\barray\b.{0,15}\b(index|element|list|item|length|push|bounds)/i,
      // reverse order: "every item / the elements / the index … of the array"
      /\b(items?|elements?|indices|index|iterate)\b.{0,15}\barray\b/i,
    ] },
  { id: "loop", label: "Loop / iteration", category: "programming", priority: 1,
    matchers: [
      /\b(for|while)\s+loop\b/i,
      /\bloop\b.{0,15}\b(iterate|array|over|each)/i,
    ] },
  { id: "recursion", label: "Recursion", category: "programming", priority: 2,
    matchers: [
      /\brecursi(on|ve)\b/i,
    ] },
  { id: "concurrency", label: "Concurrency", category: "programming", priority: 3,
    matchers: [
      /\bconcurrency\b/i,
      /\bconcurren(t)\b.{0,15}\b(thread|process|task|request|access|lock|run|execution|operation|user|connection)/i,
      /\bparallel\b.{0,15}\b(process|thread|task|run)/i,
    ] },
  { id: "thread", label: "Thread", category: "programming", priority: 2,
    matchers: [
      /\bthread(ing|s)?\b.{0,15}\b(main|background|worker|block|pool)/i,
    ] },
  { id: "memory-leak", label: "Memory leak", category: "programming", priority: 3,
    matchers: [
      /\bmemory\s+leak/i,
    ] },
  { id: "garbage-collection", label: "Garbage collection", category: "programming", priority: 1,
    matchers: [
      /\bgarbage\s+collect(ion|or)?\b/i,
    ] },
  { id: "encryption", label: "Encryption / decryption", category: "web", priority: 3,
    matchers: [
      /\bencrypt(ion|ed|ing)?\b/i,
      /\bdecrypt(ion|ed|ing)?\b/i,
    ] },
  { id: "hashing", label: "Hashing", category: "web", priority: 2,
    matchers: [
      /\bhash(ed|ing)?\b.{0,15}\b(password|function|value|algorithm|sha|md5)/i,
    ] },
  { id: "websocket", label: "WebSocket", category: "web", priority: 2,
    matchers: [
      /\bwebsocket/i,
      /\bws:\/\//i,
    ] },
  { id: "latency", label: "Latency", category: "web", priority: 2,
    matchers: [
      /\blatency\b/i,
    ] },
  { id: "idempotent", label: "Idempotent", category: "web", priority: 2,
    matchers: [
      /\bidempoten(t|cy)\b/i,
    ] },
  // --- v1.4 dictionary expansion (web infra, devops, JS internals) ---
  { id: "cookie", label: "HTTP cookie", category: "web", priority: 2,
    matchers: [
      /\bcookie\b.{0,15}\b(browser|session|http|store|consent|set|header)/i,
      /\b(browser|session|http)\b.{0,15}\bcookie\b/i,
    ] },
  { id: "session", label: "User session", category: "web", priority: 2,
    matchers: [
      /\bsession\b.{0,15}\b(token|cookie|login|user|expire|id|storage|state)/i,
      /\b(login|user)\b.{0,15}\bsession\b/i,
    ] },
  { id: "jwt", label: "JSON Web Token (JWT)", category: "web", priority: 3,
    matchers: [
      /\bJWT\b/,
      /\bjson\s+web\s+token/i,
    ] },
  { id: "oauth", label: "OAuth", category: "web", priority: 3,
    matchers: [
      /\boauth\b/i,
    ] },
  { id: "ssl-tls", label: "SSL / TLS", category: "web", priority: 2,
    matchers: [
      /\bSSL\b/,
      /\bTLS\b/,
      /\bcertificate\b.{0,15}\b(ssl|tls|https|sign|expire|domain)/i,
    ] },
  { id: "dns", label: "DNS", category: "web", priority: 2,
    matchers: [
      /\bDNS\b/,
      /\bdomain\s+name\s+system/i,
    ] },
  { id: "cdn", label: "CDN (content delivery network)", category: "web", priority: 2,
    matchers: [
      /\bCDN\b.{0,20}\b(cache|asset|edge|latency|static|cloudflare|akamai|deliver|serve|host|origin)/i,
      /\b(cache|asset|edge|static)\b.{0,20}\bCDN\b/i,
      /\bcontent\s+delivery\s+network/i,
    ] },
  { id: "proxy", label: "Proxy server", category: "web", priority: 2,
    matchers: [
      /\breverse\s+proxy/i,
      /\bproxy\b.{0,15}\b(server|http|request|forward)/i,
    ] },
  { id: "serverless", label: "Serverless", category: "devops", priority: 2,
    matchers: [
      /\bserverless\b/i,
      /\blambda\s+function/i,
    ] },
  { id: "kubernetes", label: "Kubernetes", category: "devops", priority: 2,
    matchers: [
      /\bkubernetes\b/i,
      /\bk8s\b/i,
    ] },
  { id: "container-image", label: "Container image", category: "devops", priority: 1,
    matchers: [
      /\b(docker|container)\s+image/i,
      /\bimage\b.{0,12}\b(docker|registry|build|pull|push|tag)/i,
    ] },
  { id: "microservice", label: "Microservice", category: "devops", priority: 2,
    matchers: [
      /\bmicroservices?\b/i,
    ] },
  { id: "callback", label: "Callback function", category: "programming", priority: 1,
    matchers: [
      /\bcallback\b.{0,15}\b(function|async|invoke|fire|handler|pass)/i,
      /\bpass\b.{0,20}\bcallback\b/i,
    ] },
  { id: "serialization", label: "Serialization", category: "data", priority: 1,
    matchers: [
      /\b(de)?serializ(e|ed|ing|ation)\b/i,
    ] },
  { id: "base64", label: "Base64 encoding", category: "data", priority: 1,
    matchers: [
      /\bbase64\b/i,
    ] },
  { id: "cron", label: "Cron / scheduled job", category: "devops", priority: 1,
    matchers: [
      /\bcron\b/i,
      /\bscheduled\s+(task|job)/i,
    ] },
  { id: "debounce-throttle", label: "Debounce / throttle", category: "programming", priority: 1,
    matchers: [
      /\bdebounce\b/i,
      /\bthrottl(e|ing)\b.{0,15}\b(request|function|rate|api|event)/i,
    ] },
  // --- v1.5 security lens (high-priority risk concepts) ---
  { id: "hardcoded-secret", label: "Hardcoded secret / API key", category: "security", priority: 4,
    matchers: [
      // assignment of known secret-like variable names to a string literal
      /\b(api[_-]?key|secret[_-]?key|auth[_-]?token|private[_-]?key|access[_-]?key|client[_-]?secret|aws[_-]?secret|secret)\s*[=:]\s*["'][^"']{6,}["']/i,
      // common provider key prefixes committed as literals (allow 6+ chars after prefix)
      /["']?(sk-|sk_live_|pk_live_|rk_live_|AIza|AKIA)[A-Za-z0-9_\-]{6,}/,
      // generic password= "value" in code
      /\bpassword\s*=\s*["'][^"']{4,}["']/i,
      // AWS_SECRET_ACCESS_KEY with literal value
      /\bAWS_SECRET_ACCESS_KEY\s*=\s*["']?[A-Za-z0-9+/]{10,}/i,
      // prose: "the API key is hardcoded" / "hardcoded secret" (browser-builder users
      // describe this in plain English, not code). Anchored to a secret-ish noun so
      // "hardcoded the timeout / keyboard shortcut" does not fire. The negative
      // lookbehind keeps preventive phrasing ("prevent/avoid/never hardcode secrets")
      // from raising a false alarm.
      /(?<!\b(?:prevent|prevents|prevented|avoid|avoids|stop|block|never|without|no)\s)\bhard[- ]?cod(e|ed|ing)\b.{0,30}\b(secret|password|passwd|token|credential|api[ _-]?key|access[ _-]?key|private[ _-]?key)s?\b/i,
      /(?<!\b(?:prevent|prevents|prevented|avoid|avoids|stop|block|never|without|no)\s)\b(secret|password|passwd|token|credential|api[ _-]?key|access[ _-]?key|private[ _-]?key)s?\b.{0,30}\bhard[- ]?cod(e|ed|ing)\b/i,
    ] },
  { id: "secret-in-frontend", label: "Secret exposed in frontend / client bundle", category: "security", priority: 4,
    matchers: [
      // Next.js, Vite, CRA public env var prefixes holding a secret-sounding name
      /\bNEXT_PUBLIC_[A-Z_]*(SECRET|KEY|TOKEN|PASS|PWD|API)[A-Z_]*\s*=/i,
      /\bVITE_[A-Z_]*(SECRET|KEY|TOKEN|PASS|PWD|API)[A-Z_]*\s*=/i,
      /\bREACT_APP_[A-Z_]*(SECRET|KEY|TOKEN|PASS|PWD|API)[A-Z_]*\s*=/i,
    ] },
  { id: "missing-auth", label: "Missing authentication on endpoint", category: "security", priority: 4,
    matchers: [
      /\bno\s+auth(entication)?\b.{0,30}\b(routes?|endpoints?|middleware|required|check)/i,
      /\b(routes?|endpoints?|handlers?)\b.{0,30}\bno\s+auth(entication)?/i,
      /\bunauthenticated\b.{0,30}\b(endpoints?|routes?|access|requests?)/i,
      /\b(skip|bypass|missing|without|lacks?)\b.{0,20}\bauth(entication|orization)?\b.{0,20}\b(middleware|check|guard|routes?|endpoints?)/i,
    ] },
  { id: "missing-input-validation", label: "Missing input validation / sanitization", category: "security", priority: 3,
    matchers: [
      // Risk-framed: user input that IS currently unsanitized/unvalidated (present state)
      /\buser\s+input\b.{0,30}\b(not\s+sanitized|unsanitized|unvalidated|without\s+sanitiz)/i,
      /\b(not\s+sanitized|unsanitized|unvalidated)\b.{0,30}\b(input|data|value|field|param)/i,
    ] },
  { id: "sql-injection-risk", label: "SQL injection risk", category: "security", priority: 4,
    matchers: [
      // string concatenation building a SQL query: the + must follow a quote/paren/backtick
      // (NOT whitespace — removing \s prevents O(n²) scanning on whitespace-heavy text)
      // so bare prose like "UPDATE: 3 + 1" does not trigger.
      /[`"')]\s*\+\s*\w+.{0,60}\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i,
      /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.{0,60}["'`\)]\s*\+\s*\w+/i,
      // template literal with ${ inside a SQL string
      /[`"']\s*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.{0,80}\$\{/i,
      // explicit mention of sql injection
      /\bsql\s+injection/i,
    ] },
  { id: "env-file-exposed", label: ".env file exposed / committed", category: "security", priority: 4,
    matchers: [
      // .env passed to git add/commit/push
      /git\s+(add|commit|push)\b.{0,60}\.env\b/i,
      /\.env\b.{0,60}git\s+(add|commit|push)/i,
      // console.log of process.env (printing secrets to stdout)
      /console\.log\s*\(.{0,30}process\.env/i,
      // cat/print .env piped somewhere dangerous
      /\bcat\s+\.env\b.{0,40}(curl|wget|http|upload|send|post)/i,
      // explicit phrasing about .env being committed or printed
      /\.env\b.{0,30}\b(commit(ted)?|push(ed)?|expos(ed|ing)|print(ed|ing)?|leak(ed|ing)?)/i,
    ] },
  { id: "plaintext-http", label: "Plaintext HTTP (not HTTPS)", category: "security", priority: 3,
    matchers: [
      // http:// URL that is NOT localhost / 127.0.0.1 / 0.0.0.0 / local dev
      /\bhttp:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1)[a-z0-9][\w.\-]*\.[a-z]{2,}/i,
    ] },
  { id: "weak-password-storage", label: "Weak password storage (plaintext / MD5)", category: "security", priority: 4,
    matchers: [
      /\bpasswords?\b.{0,30}\b(plain\s*text|plaintext|not\s+hashed?|without\s+hash)/i,
      /\bstore\b.{0,30}\bpasswords?\b.{0,30}\b(plain|directly|as.is|without)/i,
      /\bmd5\b.{0,25}\bpassword/i,
      /\bpasswords?\b.{0,25}\bmd5\b/i,
      /\bsha\s*1\b.{0,25}\bpassword/i,
    ] },
  { id: "eval-injection", label: "eval() / code injection risk", category: "security", priority: 4,
    matchers: [
      // Tightened (no /i flag on this matcher): require the argument after eval( is NOT an
      // all-lowercase word immediately closed by ')' — that pattern is English prose like
      // "eval(uation)". The case-sensitive [a-z]+ negative lookahead excludes it because
      // "uation" is all lowercase then ')'. Code identifiers that matter are camelCase
      // (eval(userInput) has 'I') or start with a non-alpha char (eval('code'), eval( x )).
      /\beval\(\s*(?![a-z]+\))[^)\s]/,
      /\bdangerouslySetInnerHTML\b/i,
      /\bnew\s+Function\s*\(/i,
      /\bsetTimeout\s*\(\s*["'`]/i,
      /\bsetInterval\s*\(\s*["'`]/i,
    ] },
  { id: "open-cors", label: "Open CORS (allow all origins)", category: "security", priority: 3,
    matchers: [
      // header set to wildcard — matches setHeader(..., "*") or "Access-Control-Allow-Origin: *"
      /Access-Control-Allow-Origin\b.{0,30}\*/,
      // cors config object with wildcard origin value
      /\borigin\s*:\s*['"`]\*['"`]/i,
    ] },

  // --- v1.6 dictionary expansion: Part A — deeper security coverage ---

  { id: "xss", label: "Cross-site scripting (XSS)", category: "security", priority: 4,
    matchers: [
      // explicit XSS / cross-site scripting terminology
      /\bcross[- ]site\s+scripting\b/i,
      /\bXSS\b/,
      // innerHTML / outerHTML assigned with a variable (not a literal string)
      /\b(inner|outer)HTML\s*=\s*(?!["'`])[a-zA-Z_$][\w$]*/,
      // rendering/outputting unescaped HTML
      /\b(render|output|inject|insert|display)ing?\b.{0,30}\bunescaped\b.{0,20}\bHTML\b/i,
      /\bunescaped\b.{0,30}\b(HTML|output|content|variable)\b/i,
    ] },

  { id: "csrf", label: "CSRF (cross-site request forgery)", category: "security", priority: 3,
    matchers: [
      // explicit CSRF / cross-site request forgery terminology
      /\bcross[- ]site\s+request\s+forgery\b/i,
      // no/missing CSRF — risk-framed only (not mere presence of a token)
      /\bno\s+CSRF\b/i,
      /\bmissing\s+CSRF\b/i,
      // CSRF followed by a genuine risk signal (disabled, missing, without, vulnerab, not configured)
      /\bCSRF\b.{0,40}\b(missing|disabled|without|not\s+(?:set|configured|protected|enabled)|vulnerab)\b/i,
      // risk word IMMEDIATELY before CSRF ("disabled CSRF", "without CSRF protection")
      // — adjacency avoids false fires like "Without doubt, the CSRF token is present".
      /\b(missing|disabled|without)\s+CSRF\b/i,
    ] },

  { id: "path-traversal", label: "Path traversal attack", category: "security", priority: 4,
    matchers: [
      // explicit terminology
      /\bpath\s+traversal\b/i,
      /\bdirectory\s+traversal\b/i,
      // dot-dot-slash sequences in a string (filename/path context)
      /[`"'(]\s*\.\.[\\/]/,
      // mention of traversal that reads system files
      /\btraversal\b.{0,30}\b(etc\/passwd|system\s+file|read\s+file|file\s+access)/i,
    ] },

  { id: "ssrf", label: "SSRF (server-side request forgery)", category: "security", priority: 4,
    matchers: [
      // explicit SSRF terminology only — avoid firing on generic "server request" prose
      /\bSSRF\b/,
      /\bserver[- ]side\s+request\s+forgery\b/i,
    ] },

  { id: "idor", label: "IDOR (insecure direct object reference)", category: "security", priority: 4,
    matchers: [
      // explicit terminology
      /\bIDOR\b/,
      /\binsecure\s+direct\s+object\s+reference\b/i,
      // no ownership check — must have both "ownership" and a risk-framing term
      /\bno\s+ownership\s+check\b/i,
      // missing/bypassed ownership check (removed before\s+access / before\s+returning — those match working checks)
      /\bmissing\s+ownership\s+check\b/i,
      /\bownership\s+check\b.{0,30}\b(bypass(ed)?|skipped?|absent)\b/i,
    ] },

  { id: "insecure-deserialization", label: "Insecure deserialization", category: "security", priority: 4,
    matchers: [
      // explicit terminology
      /\binsecure\s+deserializ/i,
      // deserializing untrusted / user-supplied data
      /\bdeserializ(e|ing|ation)\b.{0,30}\b(untrusted|user[- ]suppl|user\s+input|user\s+data|request|attacker)/i,
      /\b(untrusted|user[- ]suppl|user\s+input)\b.{0,30}\bdeserializ/i,
      // dangerous deserialization functions applied to external input
      /\bpickle\.loads?\s*\(/i,
      /\bunserializ(e|ing)\b.{0,25}\b(user|untrusted|request|input)/i,
    ] },

  { id: "missing-rate-limit", label: "Missing rate limiting", category: "security", priority: 3,
    matchers: [
      // "no rate limit" or "missing rate limit" on something (endpoint, login, api)
      /\bno\s+rate[- ]limit/i,
      /\bmissing\s+rate[- ]limit/i,
      // "rate limit" absent on a specific endpoint type — bare "no" removed (fires on "..., no problem")
      /\brate[- ]limit\b.{0,30}\b(missing|none|not\s+set|not\s+configured|disabled|without)\b/i,
      // brute force enabled by absent rate limiting
      /\bbrute\s+force\b.{0,30}\b(no\s+rate[- ]limit|rate[- ]limit|unprotected)/i,
    ] },

  { id: "default-credentials", label: "Default credentials (unchanged)", category: "security", priority: 4,
    matchers: [
      // admin/admin or root/root pattern
      /\badmin\s*[/|]\s*admin\b/i,
      /\broot\s*[/|]\s*root\b/i,
      // default password never changed
      /\bdefault\s+(password|credentials?)\b.{0,30}\b(never|not|still|unchanged)/i,
      /\b(never|not)\s+changed?\b.{0,30}\bdefault\s+(password|credentials?)\b/i,
      /\bstill\s+using\s+(the\s+)?default\s+(password|credentials?)/i,
      // default credentials were left
      /\bdefault\s+credentials?\b.{0,30}\b(never|unchanged|left|not\s+changed|were\s+never)/i,
    ] },

  { id: "sensitive-data-in-logs", label: "Sensitive data in logs", category: "security", priority: 3,
    matchers: [
      // logging a password, token, or secret specifically via a code logging call
      /\bconsole\.log\s*\(.{0,30}\b(password|token|secret|api[_-]?key)\b/i,
      // logger.*/log.info/debug/error/warn with a secret-sounding term
      /\b(logger|log)\s*[.(](info|debug|error|warn|write)?\s*\(?.{0,30}\b(password|token|secret|api[_-]?key|private[_-]?key)\b/i,
      // print / stdout with secret term (Python / generic)
      /\b(print|stdout)\s*\(.{0,30}\b(password|token|secret|api[_-]?key)\b/i,
      // code-oriented: sensitive term in logs / written to log — requires "to (the)? log(s)"
      /\b(passwords?|auth\s+tokens?|api\s+keys?|access\s+tokens?|secrets?|private\s+keys?)\b.{0,30}\b(log(ged|ging)?|written\s+to\s+(the\s+)?log)/i,
      // "logging the <secret>" — needs code-logging anchor: console/logger/log.*/stdout
      /\b(console|logger|stdout)\b.{0,20}\b(passwords?|auth\s+tokens?|api\s+keys?|access\s+tokens?|secrets?|private\s+keys?)\b/i,
      // code-ish "logging the auth token" — require "auth token" / "api key" (not bare "password") so diary prose doesn't match
      /\b(logging|logged)\b.{0,20}\b(auth\s+token|api\s+key|access\s+token|private\s+key)\b/i,
      // PII logged — requires a code-ish logging term (logging/logged + stdout/console/logger, or a PII term + to stdout)
      /\b(console\.log|logger|stdout|console)\b.{0,40}\b(credit\s+card|ssn|social\s+security|pii|email)\b/i,
      /\b(logging|logged)\b.{0,30}\b(credit\s+card|ssn|social\s+security|pii)\b/i,
      /\b(credit\s+card|ssn|social\s+security|pii)\b.{0,30}\b(to\s+(the\s+)?(stdout|console|logs?))\b/i,
      // explicit "sensitive data in logs" phrasing tied to a technical context (requires "logs" not "log" which could mean diary)
      /\bsensitive\s+(data|information)\b.{0,30}\blogs?\b.{0,20}\b(server|stdout|file|leak|expos)\b/i,
      /\blogs?\b.{0,20}\b(server|stdout|file|leak|expos)\b.{0,30}\bsensitive\s+(data|information)\b/i,
    ] },

  { id: "mass-assignment", label: "Mass assignment vulnerability", category: "security", priority: 3,
    matchers: [
      // explicit terminology
      /\bmass[- ]assignment\b/i,
      // spreading entire request body into a model/create call
      /\.\.\.\s*req\.body\b/,
      /\bObject\.assign\s*\(.{0,20}req\.body/i,
      // passing the whole request body straight into an ORM persistence call
      // (User.create(req.body), Model.update(req.body), new User(req.body), …)
      /\b(create|update|save|build|insert|bulkCreate|insertMany|updateOne|updateMany|findOneAndUpdate)\s*\(\s*req\.body\s*\)/i,
      /\bnew\s+[A-Z]\w*\s*\(\s*req\.body\s*\)/,
      // can overwrite / set admin / privileged fields via mass assignment framing
      /\bmass[- ]assign\b/i,
    ] },

  { id: "debug-mode-in-prod", label: "Debug mode in production", category: "security", priority: 3,
    matchers: [
      // DEBUG=True/1/on in production
      /\bDEBUG\s*=\s*(True|1|on|true)\b.{0,40}\bprod(uction)?\b/i,
      /\bprod(uction)?\b.{0,40}\bDEBUG\s*=\s*(True|1|on|true)\b/i,
      // debug mode enabled on the production server
      /\bdebug\s+mode\b.{0,30}\b(enabled?|on|still|left\s+on)\b.{0,30}\bprod(uction)?\b/i,
      /\bprod(uction)?\b.{0,30}\bdebug\s+mode\b.{0,30}\b(enabled?|on|still)/i,
      // Node-specific: NODE_ENV left at development on a production server (requires
      // prod context, so safe local "NODE_ENV=development" does not fire)
      /\bNODE_ENV\s*[=:]\s*["']?(development|dev)["']?\b.{0,45}\bprod(uction)?\b/i,
      /\bprod(uction)?\b.{0,45}\bNODE_ENV\s*[=:]\s*["']?(development|dev)["']?/i,
      // stack traces exposed to users in production
      /\bstack\s+trac(e|es)\b.{0,30}\bexposed?\b.{0,30}\b(user|prod|public|end\s*user)/i,
      /\bexposed?\b.{0,30}\bstack\s+trac(e|es)\b.{0,30}\b(user|prod|public)/i,
    ] },

  // --- v1.7 security lens deepening — 7 additional high-signal concepts ---

  { id: "open-redirect", label: "Open redirect (unvalidated redirect)", category: "security", priority: 3,
    matchers: [
      // explicit "open redirect" terminology
      /\bopen\s+redirect\b/i,
      // redirect to a user-supplied / unvalidated URL
      /\bredirect\b.{0,30}\b(unvalidated|user[- ]supplied|user[- ]controlled|user\s+input)\b/i,
      /\b(unvalidated|user[- ]supplied|user[- ]controlled)\b.{0,30}\bredirect\b/i,
      // res.redirect with req.query / req.body (code pattern)
      /\bres\.redirect\s*\(\s*req\.(query|body|params)\b/i,
    ] },

  { id: "jwt-alg-none", label: "JWT algorithm none / signature bypass", category: "security", priority: 4,
    matchers: [
      // alg: none / algorithm: none in JWT context (quotes around alg key are common in JSON)
      /["']?alg["']?\s*[=:]\s*["']none["']/i,
      /\balgorithm\s*[=:]\s*["']none["']/i,
      // jsonwebtoken-style options: algorithms: ["none"] (only when "none" is in the array;
      // the safe algorithms: ["HS256"] must NOT match)
      /\balgorithms?\s*[=:]\s*\[[^\]]*["']none["'][^\]]*\]/i,
      // JWT(s) without signature verification — JWTs (plural) is common
      // Note: no trailing \b after stems like "verif" since the word continues (verifying, verified, verification)
      /\bJWTs?\b.{0,50}(without\s+verif\w*|signature\s+not\s+verif\w*|not\s+verif(ied|ying|ication)|bypass\b|skip(ped|ping)?)\b/i,
      /(without\s+verif\w*|signature\s+not\s+verif\w*|not\s+verif(ied|ying|ication)|bypass)\b.{0,40}\bJWTs?\b/i,
      // explicit attack name
      /\bjwt[- ]?alg[- ]?none\b/i,
    ] },

  { id: "insecure-cookie", label: "Insecure cookie (missing httpOnly/Secure/sameSite)", category: "security", priority: 3,
    matchers: [
      // missing security flag near cookie
      /\b(auth|session|login)\s+cookies?\b.{0,40}\b(without|missing|no|lacks?)\b.{0,20}\b(httpOnly|http[- ]only|Secure|sameSite|same[- ]site)\b/i,
      /\bcookies?\b.{0,30}\b(without|missing|no|lacks?)\b.{0,20}\b(httpOnly|http[- ]only|Secure|sameSite|same[- ]site)\b/i,
      // reversed: flag name then absence signal then cookie
      /\b(httpOnly|http[- ]only|Secure|sameSite|same[- ]site)\b.{0,20}\b(missing|not\s+set|absent|disabled)\b.{0,20}\bcookies?\b/i,
    ] },

  { id: "verbose-error-exposed", label: "Verbose error / stack trace exposed to users", category: "security", priority: 3,
    matchers: [
      // stack trace + user/client/response within a 60-char window (any order).
      // Note: users?/clients? so the common plural ("…to users") also matches.
      /\bstack\s+trace\b.{0,60}\b(users?|clients?|response|public|end[- ]users?)\b/i,
      /\b(users?|clients?|response|public|end[- ]users?)\b.{0,60}\bstack\s+trace\b/i,
      // internal error details returned / sent / in the response body
      // the .{0,50} window is wide enough to cover "back in the HTTP response body"
      /\b(internal\s+error|error\s+details?)\b.{0,50}\b(return(ed|ing)?|sends?|sent|expos(ed|ing)?|response\s+body|back\s+in|back\s+to)\b/i,
      /\b(return(ed|ing)?|sends?|sent|expos(ed|ing)?)\b.{0,30}\b(internal\s+error|error\s+details?)\b/i,
      // verbose error message exposes internals
      /\bverbose\s+error\b.{0,30}\b(expos(ed|ing|es?)|reveal|leak|sent?|show)\b/i,
      // sending a stack trace straight to the client via a response method
      // (res.send(err.stack), res.json({error: e.stack}), …) — NOT safe server-side
      // logging like console.log(err.stack), which uses .log() and is excluded.
      /\.(send|json|end|write)\s*\([^)]{0,80}\.stack\b/i,
    ] },

  { id: "cleartext-token-storage", label: "Auth token stored in plaintext (localStorage)", category: "security", priority: 3,
    matchers: [
      // token/JWT stored in localStorage — requires a token-type term (space, underscore, or hyphen separator)
      /\b(auth[\s_-]?tokens?|access[\s_-]?tokens?|JWTs?|bearer[\s_-]?tokens?|id[\s_-]?tokens?|session[\s_-]?tokens?)\b.{0,40}\blocal[sS]torage\b/i,
      /\blocal[sS]torage\b.{0,40}\b(auth[\s_-]?tokens?|access[\s_-]?tokens?|JWTs?|bearer[\s_-]?tokens?|id[\s_-]?tokens?|session[\s_-]?tokens?)\b/i,
      // localStorage.setItem with a token-sounding key
      /\blocal[sS]torage\.(setItem|getItem)\s*\(\s*["'][^"']{0,20}(token|auth|jwt|credential)["']/i,
    ] },

  { id: "directory-listing", label: "Directory listing enabled", category: "security", priority: 3,
    matchers: [
      // explicit "directory listing" or "directory browsing" + enabled / on / allowed
      /\bdirectory\s+(listing|browsing)\b.{0,30}\b(enabled?|on|allowed|expos|open)\b/i,
      /\b(enabled?|on|allowed|expos|open)\b.{0,30}\bdirectory\s+(listing|browsing)\b/i,
      // nginx/apache autoindex on
      /\bautoindex\s+(on|enabled?)\b/i,
      // "Options +Indexes" (Apache)
      /\bOptions\b.{0,10}\+Indexes\b/,
    ] },

  { id: "ssti", label: "Server-side template injection (SSTI)", category: "security", priority: 4,
    matchers: [
      // explicit SSTI / server-side template injection terminology
      /\bSSTI\b/,
      /\bserver[- ]side\s+template\s+injection\b/i,
      // user input passed into a named template engine (Jinja2, Twig, Pebble, Handlebars, etc.)
      /\buser\s+input\b.{0,40}\b(Jinja2?|Twig|Pebble|Mako|Handlebars|Nunjucks|Mustache|Velocity|FreeMarker)\b/i,
      /\b(Jinja2?|Twig|Pebble|Mako|Handlebars|Nunjucks|Mustache|Velocity|FreeMarker)\b.{0,40}\buser\s+(input|data|supplied)\b/i,
    ] },

  // --- v1.6 dictionary expansion: Part B — high-frequency general concepts ---

  { id: "orm", label: "ORM (object-relational mapper)", category: "data", priority: 2,
    matchers: [
      // explicit ORM / object-relational mapper
      /\bORM\b/,
      /\bobject[- ]relational\s+mapper\b/i,
      // named ORMs
      /\b(Prisma|Sequelize|TypeORM|Hibernate|ActiveRecord|SQLAlchemy|Drizzle)\b.{0,30}\b(model|schema|query|database|table|ORM)\b/i,
      /\b(model|schema|query)\b.{0,30}\b(Prisma|Sequelize|TypeORM|Hibernate|ActiveRecord|SQLAlchemy|Drizzle)\b/i,
    ] },

  { id: "rest-api", label: "REST API / RESTful design", category: "web", priority: 2,
    matchers: [
      // explicit RESTful / REST design language (not just "REST API" alone — too generic)
      /\bRESTful\b/i,
      /\bREST\s+(API|endpoint|convention|resource|design|architecture|interface)/i,
      /\bREST\b.{0,25}\b(convention|resource|design|architecture|naming)/i,
    ] },

  { id: "graphql", label: "GraphQL", category: "web", priority: 2,
    matchers: [
      /\bGraphQL\b/i,
      /\bgql\b.{0,15}\b(query|mutation|schema|resolver|subscription)/i,
    ] },

  { id: "message-queue", label: "Message queue / job queue", category: "devops", priority: 2,
    matchers: [
      // explicit terminology
      /\bmessage\s+queue\b/i,
      /\bjob\s+queue\b/i,
      /\btask\s+queue\b/i,
      // named queue systems
      /\b(RabbitMQ|BullMQ|SQS|Kafka|Celery|Sidekiq)\b/i,
      // queue in a decouple / async processing context (not bare "queue")
      /\bqueue\b.{0,20}\b(worker|consumer|producer|broker|async|process|decouple)/i,
    ] },

  { id: "feature-flag", label: "Feature flag / feature toggle", category: "devops", priority: 1,
    matchers: [
      /\bfeature[- ]flag\b/i,
      /\bfeature[- ]toggle\b/i,
      /\bfeature\s+flag\b/i,
      /\bfeature\s+toggle\b/i,
    ] },

  { id: "error-monitoring", label: "Error monitoring / crash reporting", category: "devops", priority: 2,
    matchers: [
      // explicit terminology
      /\berror\s+monitor(ing)?\b/i,
      /\bcrash\s+report(ing)?\b/i,
      // named error monitoring services
      /\b(Sentry|Datadog|Rollbar|Bugsnag|Raygun|New\s+Relic)\b.{0,30}\b(error|crash|monitor|track|report|alert)/i,
      /\b(error|crash|exception)\b.{0,30}\b(Sentry|Datadog|Rollbar|Bugsnag|Raygun)\b/i,
    ] },

  { id: "uptime-monitoring", label: "Uptime monitoring / health checks", category: "devops", priority: 1,
    matchers: [
      // explicit uptime monitoring
      /\buptime\s+monitor(ing)?\b/i,
      // health check endpoint in a monitoring context
      /\bhealth[- ]?check\b.{0,30}\b(endpoint|monitor|ping|service|alert|down)/i,
      // "site goes down" / "alert when down" monitoring framing
      /\b(alert|notify)\b.{0,30}\b(site|service|server)\b.{0,20}\b(down|unreachable|unavailable)/i,
      /\b(uptime|downtime)\b.{0,20}\b(monitor|track|alert|check|report)\b/i,
    ] },

  { id: "load-balancer", label: "Load balancer", category: "devops", priority: 2,
    matchers: [
      /\bload[- ]balanc(er|ing|ed)\b/i,
      /\bload\s+balanc(er|ing|ed)\b/i,
    ] },

  { id: "pagination", label: "Pagination", category: "web", priority: 2,
    matchers: [
      /\bpaginat(e|ion|ing|ed)\b/i,
      // cursor-based / offset-based / page-based paging (not bare "page")
      /\b(cursor|offset|page)[- ]based\s+pag(ination|ing)\b/i,
      /\bpag(ination|ing)\b.{0,20}\b(cursor|offset|limit|next\s+page|infinite\s+scroll|results?)\b/i,
    ] },

  { id: "backup", label: "Data backup / restore", category: "devops", priority: 2,
    matchers: [
      // backup in a data/database context
      /\b(database|data|db)\s+backup\b/i,
      /\bbackup\b.{0,20}\b(database|data|restore|schedule|S3|bucket|nightly|daily|snapshot)\b/i,
      // restore from backup
      /\brestore\s+(from\s+)?backup\b/i,
    ] },

  { id: "webhook-signature", label: "Webhook signature verification", category: "web", priority: 3,
    matchers: [
      // explicit webhook + signature / HMAC framing
      /\bwebhook\b.{0,30}\b(signature|HMAC|sign|verify|secret|validat)\b/i,
      /\b(signature|HMAC|sign|verify|validat)\b.{0,30}\bwebhook\b/i,
      // specific Stripe / GitHub webhook secret pattern
      /\bwebhook[- ]?secret\b/i,
    ] },
];
