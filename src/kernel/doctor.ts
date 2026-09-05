import type { EchoConfig } from "../config/schema.js";
import { probeId, type ChainAttempt } from "./chain.js";
import type { Registry } from "./registry.js";
import type { SlotHealth } from "./types.js";

export async function inspectSlots(config: EchoConfig, registry: Registry): Promise<SlotHealth[]> {
  const health: SlotHealth[] = [];
  health.push(...(await probeSlot("llm", config.slots.llm, registry.llm)));
  health.push(...(await probeSlot("stt", config.slots.stt, registry.stt)));
  health.push(...(await probeSlot("tts", config.slots.tts, registry.tts)));
  health.push(...(await probeSlot("memory", config.slots.memory, registry.memory)));
  for (const name of config.tools.enabled) {
    health.push({
      id: name,
      kind: "tool",
      ok: registry.tools.has(name),
      detail: registry.tools.has(name) ? "зарегистрирован" : "выключен или не собран",
    });
  }
  for (const name of config.channels.enabled) {
    health.push({
      id: name,
      kind: "channel",
      ok: registry.channels.has(name),
      detail: registry.channels.has(name) ? "зарегистрирован" : "нет адаптера",
    });
  }
  return health;
}

async function probeSlot(
  kind: SlotHealth["kind"],
  ids: string[],
  map: Map<string, { probe: () => Promise<boolean> }>,
): Promise<SlotHealth[]> {
  const rows: SlotHealth[] = [];
  for (const id of ids) {
    const provider = map.get(id);
    if (!provider) {
      rows.push({ id, kind, ok: false, detail: "не зарегистрирован" });
      continue;
    }
    const attempt: ChainAttempt<boolean> = await probeId(id, () => provider.probe());
    rows.push({ id, kind, ok: attempt.ok, detail: attempt.detail });
  }
  return rows;
}
