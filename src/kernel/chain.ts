import { EchoError } from "./types.js";

export type ChainAttempt<T> = {
  id: string;
  ok: boolean;
  detail: string;
  value?: T;
};

export async function firstWorking<T>(
  ids: string[],
  run: (id: string) => Promise<T>,
): Promise<{ id: string; value: T; attempts: ChainAttempt<T>[] }> {
  const attempts: ChainAttempt<T>[] = [];
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const value = await run(id);
      attempts.push({ id, ok: true, detail: "ok", value });
      return { id, value, attempts };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      attempts.push({ id, ok: false, detail });
      errors.push(`${id}: ${detail}`);
    }
  }

  throw new EchoError("chain_exhausted", `Ни один провайдер не сработал: ${errors.join("; ")}`);
}

export async function probeId(
  id: string,
  probe: () => Promise<boolean>,
): Promise<ChainAttempt<boolean>> {
  try {
    const ok = await probe();
    return { id, ok, detail: ok ? "доступен" : "не отвечает", value: ok };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { id, ok: false, detail };
  }
}
