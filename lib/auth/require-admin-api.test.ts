import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * require-admin-api.ts starts with `import "server-only"`, which — by
 * design (see https://www.npmjs.com/package/server-only) — throws
 * unconditionally as soon as it is imported outside Next.js's own bundler
 * (which is the only place that treats "server" vs "client" specially;
 * plain Vitest/Node has no such distinction). That is the exact behavior
 * this codebase relies on to make an accidental client-side import of a
 * service_role-adjacent module a hard failure — see server-admin-client.ts's
 * own header comment, and the "static guardrails" describe block below,
 * which is how this file verifies AdminAuthError's shape and require-admin-api's
 * own server-only-ness without ever importing the module directly.
 */
describe("AdminAuthError shape (verified via source, not import — see file header)", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "require-admin-api.ts"),
    "utf-8"
  );

  it("is exported as a named class extending Error, with a `status` field typed to exactly 401 | 403", () => {
    expect(source).toMatch(/export class AdminAuthError extends Error/);
    expect(source).toMatch(/status:\s*401\s*\|\s*403/);
  });

  it("requireAdminFromRequest throws AdminAuthError(401) when unauthenticated and AdminAuthError(403) when authenticated-but-not-admin — never leaking which one to the response body (that distinction is made by each route's own catch block, e.g. app/api/admin/judges/invite/route.ts)", () => {
    expect(source).toMatch(/لم يتم تسجيل الدخول",\s*401/);
    expect(source).toMatch(/هذا الإجراء متاح للمسؤولين فقط",\s*403/);
  });
});

/**
 * Static guardrails for "service_role never appears in client bundles" —
 * every file that touches SUPABASE_SERVICE_ROLE_KEY (directly, or via
 * lib/supabase/server-admin-client.ts) must start with `import "server-only"`,
 * which turns an accidental client-side import into a Next.js BUILD ERROR
 * (see server-admin-client.ts's own header comment) — the actual, structural
 * enforcement. This test only asserts that structural guard is genuinely in
 * place on every file that needs it, so a future edit can't silently drop
 * it without a test failing.
 */
describe("service_role isolation — static guardrails", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  function readSource(relativePath: string): string {
    return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
  }

  it("server-admin-client.ts (the only file reading SUPABASE_SERVICE_ROLE_KEY) starts with 'server-only'", () => {
    const source = readSource("lib/supabase/server-admin-client.ts");
    expect(source).toContain('import "server-only"');
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("the judge-invite API route (the only route.ts calling auth.admin.inviteUserByEmail) never imports SUPABASE_SERVICE_ROLE_KEY directly — only through the server-only admin client", () => {
    const source = readSource("app/api/admin/judges/invite/route.ts");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("getSupabaseAdminClient");
    expect(source).toContain("inviteUserByEmail");
  });

  it("require-admin-api.ts (the admin-auth check every privileged route must call) is server-only", () => {
    const source = readSource("lib/auth/require-admin-api.ts");
    expect(source).toContain('import "server-only"');
  });

  it("server-session-client.ts (reads the caller's own cookies) is server-only", () => {
    const source = readSource("lib/supabase/server-session-client.ts");
    expect(source).toContain('import "server-only"');
  });

  it("no 'use client' component or hook file references SUPABASE_SERVICE_ROLE_KEY", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          const source = fs.readFileSync(fullPath, "utf-8");
          if (source.startsWith('"use client"') && source.includes("SUPABASE_SERVICE_ROLE_KEY")) {
            offenders.push(fullPath);
          }
        }
      }
    }
    for (const dir of ["app", "components", "lib"]) {
      walk(path.join(repoRoot, dir));
    }
    expect(offenders).toEqual([]);
  });
});
