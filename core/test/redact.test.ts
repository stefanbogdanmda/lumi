import { describe, it, expect } from "vitest";
import { redactSecrets } from "../src/redact";

const PLACEHOLDER = "[REDACTED]";

describe("redactSecrets — provider tokens", () => {
  it("redacts an OpenAI sk- key", () => {
    // Arrange
    const text = "export OPENAI_API_KEY=sk-abcdEFGH1234567890abcdEFGH1234567890abcdEFGH";

    // Act
    const out = redactSecrets(text);

    // Assert
    expect(out).toContain(PLACEHOLDER);
    expect(out).not.toContain("sk-abcdEFGH1234567890");
  });

  it("redacts an OpenAI project-scoped sk-proj- key", () => {
    const text = "key is sk-proj-AbCdEf0123456789AbCdEf0123456789AbCdEf01 done";
    const out = redactSecrets(text);
    expect(out).not.toContain("sk-proj-AbCdEf0123456789");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a GitHub ghp_ personal access token", () => {
    // Built from parts so no contiguous token literal lives in source (push-protection safe).
    const token = "ghp" + "_1234567890abcdefghijklmnopqrstuvwxyz";
    const text = "git remote set-url origin https://" + token + "@github.com/u/r.git";
    const out = redactSecrets(text);
    expect(out).not.toContain(token);
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a GitHub fine-grained github_pat_ token", () => {
    const text = "token=github_pat_11ABCDEFG0aBcDeFgHiJkL_mNoPqRsTuVwXyZ0123456789abcd";
    const out = redactSecrets(text);
    expect(out).not.toContain("github_pat_11ABCDEFG0aBcDeFgHiJkL");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts an AWS access key id (AKIA…)", () => {
    const text = "AWS_ACCESS_KEY_ID AKIAIOSFODNN7EXAMPLE in config";
    const out = redactSecrets(text);
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a Slack token (xoxb-…)", () => {
    // Built from parts so no contiguous token literal lives in source (push-protection safe).
    const token = "xoxb" + "-123456789012-1234567890123-" + "aBcDeFgHiJkLmNoPqRsTuVwX";
    const text = "SLACK=" + token;
    const out = redactSecrets(text);
    expect(out).not.toContain(token);
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a JWT (eyJ…)", () => {
    const text =
      "Authorization header eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U end";
    const out = redactSecrets(text);
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a Bearer token but keeps the word Bearer", () => {
    const text = "curl -H 'Authorization: Bearer aBcDeF0123456789ghIJklmnopqrstuvwxyz' api";
    const out = redactSecrets(text);
    expect(out).not.toContain("aBcDeF0123456789ghIJklmnopqrstuvwxyz");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a lowercase 'bearer' token (case-insensitive)", () => {
    const text = "curl -H 'authorization: bearer aBcDeF0123456789ghIJklmnop' api";
    const out = redactSecrets(text);
    expect(out).not.toContain("aBcDeF0123456789ghIJklmnop");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a Stripe live secret key (sk_live_…)", () => {
    // Built from parts so no contiguous token literal lives in source (push-protection safe).
    const key = "sk" + "_live_" + "4eC39HqLyjWDarjtT1zdp7dc1234567890";
    const text = "STRIPE=" + key;
    const out = redactSecrets(text);
    expect(out).not.toContain(key);
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts Stripe sk_test_, rk_live_, pk_live_ keys", () => {
    expect(redactSecrets("sk_test_" + "a".repeat(24))).toContain(PLACEHOLDER);
    expect(redactSecrets("rk_live_" + "b".repeat(24))).toContain(PLACEHOLDER);
    expect(redactSecrets("pk_live_" + "c".repeat(24))).toContain(PLACEHOLDER);
  });

  it("redacts a Google API key (AIza…)", () => {
    const key = "AIza" + "a".repeat(35);
    const out = redactSecrets(`GOOGLE_API_KEY=${key}`);
    expect(out).not.toContain(key);
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a GitLab personal access token (glpat-…)", () => {
    const tok = "glpat-" + "x".repeat(20);
    const out = redactSecrets(`token is ${tok} ok`);
    expect(out).not.toContain(tok);
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts HTTPS basic-auth credentials embedded in a URL", () => {
    const out = redactSecrets("clone https://alice:s3cr3tPassw0rd@example.com/repo.git");
    expect(out).not.toContain("alice:s3cr3tPassw0rd");
    expect(out).not.toContain("s3cr3tPassw0rd");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts HTTP basic-auth credentials embedded in a URL", () => {
    const out = redactSecrets("curl http://user:hunter2hunter@internal.host/api");
    expect(out).not.toContain("user:hunter2hunter");
    expect(out).toContain(PLACEHOLDER);
  });
});

describe("redactSecrets — extended key=value names", () => {
  it("redacts DB_PASS=…", () => {
    const out = redactSecrets("DB_PASS=plaintextpassvalue");
    expect(out).not.toContain("plaintextpassvalue");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts ACCESS_KEY=…", () => {
    const out = redactSecrets("ACCESS_KEY=akiavalue1234567");
    expect(out).not.toContain("akiavalue1234567");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts PRIVATE_KEY=…", () => {
    const out = redactSecrets("PRIVATE_KEY=mahprivatekeyvalue");
    expect(out).not.toContain("mahprivatekeyvalue");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts CLIENT_SECRET=…", () => {
    const out = redactSecrets("CLIENT_SECRET=oauthclientsecretvalue");
    expect(out).not.toContain("oauthclientsecretvalue");
    expect(out).toContain(PLACEHOLDER);
  });
});

describe("redactSecrets — key=value style", () => {
  it("redacts password=… keeping the key", () => {
    const out = redactSecrets("DB_PASSWORD=Sup3rSecretValue!");
    expect(out).not.toContain("Sup3rSecretValue!");
    expect(out).toContain(PLACEHOLDER);
    expect(out.toLowerCase()).toContain("password");
  });

  it("redacts token: value with a colon separator", () => {
    const out = redactSecrets("token: abc123XYZsecretvalue");
    expect(out).not.toContain("abc123XYZsecretvalue");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts api_key and api-key variants (case-insensitive)", () => {
    expect(redactSecrets("API_KEY=zzz12345secret")).not.toContain("zzz12345secret");
    expect(redactSecrets("Api-Key = qqq98765secret")).not.toContain("qqq98765secret");
  });

  it("redacts secret=… and pwd=…", () => {
    expect(redactSecrets("secret=hunter2hunter2")).toContain(PLACEHOLDER);
    expect(redactSecrets("pwd=letmein123456")).toContain(PLACEHOLDER);
  });
});

describe("redactSecrets — connection strings", () => {
  it("redacts a postgres connection string", () => {
    const out = redactSecrets("DATABASE_URL=postgres://user:pass@db.example.com:5432/app");
    expect(out).not.toContain("user:pass@db.example.com");
    expect(out).toContain(PLACEHOLDER);
  });

  it("redacts a postgresql:// connection string", () => {
    const out = redactSecrets("postgresql://admin:secretpw@localhost/mydb");
    expect(out).not.toContain("admin:secretpw");
  });

  it("redacts a mysql:// connection string", () => {
    const out = redactSecrets("mysql://root:toor@127.0.0.1:3306/db");
    expect(out).not.toContain("root:toor");
  });

  it("redacts a mongodb+srv:// connection string", () => {
    const out = redactSecrets("mongodb+srv://u:p@cluster0.abcde.mongodb.net/test");
    expect(out).not.toContain("cluster0.abcde.mongodb.net");
    expect(out).toContain(PLACEHOLDER);
  });
});

describe("redactSecrets — long base64-ish blobs", () => {
  it("redacts a 50-char high-entropy token", () => {
    const blob = "Q2xhdWRlT3B1czRBbnRocm9waWNTZWNyZXRUb2tlblZhbHVlMDEyMzQ1";
    const out = redactSecrets(`leaked ${blob} here`);
    expect(out).not.toContain(blob);
    expect(out).toContain(PLACEHOLDER);
  });
});

describe("redactSecrets — negative cases (do NOT over-redact)", () => {
  it("leaves a plain git commit command untouched", () => {
    const text = "git commit -m 'add feature'";
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves npm test untouched", () => {
    expect(redactSecrets("npm test")).toBe("npm test");
  });

  it("leaves ordinary prose untouched", () => {
    const text = "The password manager helped me reset my account yesterday.";
    // 'password' appears but not in key=value form, so nothing should change
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves a normal file path untouched", () => {
    const text = "/usr/local/lib/node_modules/typescript/bin/tsc";
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves a short word that starts with sk- untouched", () => {
    const text = "sk-8 is not a key";
    expect(redactSecrets(text)).toBe(text);
  });

  it("returns an empty string unchanged", () => {
    expect(redactSecrets("")).toBe("");
  });

  it("leaves a double-quoted git commit message untouched", () => {
    const text = 'git commit -m "fix"';
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves a unix-style cd path untouched", () => {
    const text = "cd /c/Users/me/project";
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves echo hello untouched", () => {
    expect(redactSecrets("echo hello")).toBe("echo hello");
  });

  it("leaves a normal Windows path untouched", () => {
    const text = "C:\\Users\\me\\Documents";
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves a plain credential-free https URL untouched", () => {
    const text = "curl https://api.example.com/v1/users";
    expect(redactSecrets(text)).toBe(text);
  });

  it("leaves a host:port URL untouched", () => {
    const text = "open http://localhost:3000/dashboard";
    expect(redactSecrets(text)).toBe(text);
  });
});
