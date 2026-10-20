/** A missing variable fails with its own name, not as `undefined` three calls later. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new Error(`${name} is not set. See .env.example.`);
  return value;
}
