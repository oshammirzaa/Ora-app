export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

// Static reads so Vercel/Nitro keeps these on the server runtime.
void process.env.ORA_OWNER_EMAIL;
void process.env.BETTER_AUTH_URL;
void process.env.DATABASE_URL;

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
