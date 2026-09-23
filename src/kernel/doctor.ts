import type { EchoConfig } from "../config/schema.js";
import type { Registry } from "./registry.js";
import type { SlotHealth } from "./types.js";

export async function inspectSlots(config: EchoConfig, registry: Registry): Promise<SlotHealth[]> {
  const rows: SlotHealth[] = [];
  for (const id of config.slots.llm) {
    const provider = registry.llm.get(id);
    if (!provider) {
      rows.push({ id, kind: "llm", ok: false, detail: "не зарегистрирован" });
      continue;
    }
    const ok = await provider.probe().catch(() => false);
    rows.push({ id, kind: "llm", ok, detail: ok ? provider.describe() : "не отвечает" });
  }
  for (const id of config.slots.memory) {
    const provider = registry.memory.get(id);
    const ok = provider ? await provider.probe().catch(() => false) : false;
    rows.push({ id, kind: "memory", ok, detail: ok ? "файлы" : "нет" });
  }
  for (const id of config.slots.tts) {
    const provider = registry.tts.get(id);
    const ok = provider ? await provider.probe().catch(() => false) : false;
    rows.push({ id, kind: "tts", ok, detail: ok ? "доступен" : "молчит" });
  }
  for (const id of config.slots.stt) {
    const provider = registry.stt.get(id);
    const ok = provider ? await provider.probe().catch(() => false) : false;
    rows.push({ id, kind: "stt", ok, detail: ok ? "настроен" : "молчит" });
  }
  return rows;
}
