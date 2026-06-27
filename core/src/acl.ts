import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * On Windows, restrict `dir` to the current user: disable inheritance and grant
 * full control only to the account in USERNAME (with object+container inherit).
 * POSIX already gets 0o700 from the dir creators, so this is a no-op there.
 * Best-effort: returns true if an ACL was applied, false otherwise; never throws.
 */
export function secureDir(dir: string): boolean {
  if (!existsSync(dir)) return false;
  if (process.platform !== "win32") return false;
  const user = process.env.USERNAME;
  if (!user) return false;
  try {
    // execFileSync (not execSync) passes the path as an argv element, not
    // interpolated into a shell string — eliminates any shell-injection surface.
    execFileSync(
      "icacls",
      [dir, "/inheritance:r", "/grant:r", `${user}:(OI)(CI)F`],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false; // icacls missing / permission denied — leave inherited ACLs
  }
}
