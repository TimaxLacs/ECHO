import { EchoError, type ChainAttempt } from "./types.js";

export async function firstWorking<T>(
  ids: string[],
  run: (id: string) => Promise<T>,
): Promise<{ id: string; value: T; attempts: ChainAttempt[] }> {
  const attempts: ChainAttempt[] = [];
  const errors: string[] = [];
  for (const id of ids) {
    try {
      const value = await run(id);
      attempts.push({ id, ok: true, detail: "ok" });
      return { id, value, attempts };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      attempts.push({ id, ok: false, detail });
      errors.push(`${id}: ${detail}`);
    }
  }
  throw new EchoError("chain_exhausted", errors.join("; ") || "цепочка пуста", attempts);
}
