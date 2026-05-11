export function readApiKey(): string | undefined {
  const raw = process.env.TRUSTADD_API_KEY;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
