import type { EchoConfig } from "../config/schema.js";
import type { Registry } from "../kernel/registry.js";
import type { SlotHealth } from "../kernel/types.js";
import { CliChannel } from "./cli.js";
import { HttpChannel } from "./http.js";
import { TelegramChannel } from "./telegram.js";

export function registerChannels(
  registry: Registry,
  config: EchoConfig,
  doctor: () => Promise<SlotHealth[]>,
): void {
  const enabled = new Set(config.channels.enabled);
  if (enabled.has("cli")) registry.registerChannel(new CliChannel());
  if (enabled.has("http")) registry.registerChannel(new HttpChannel(config, doctor));
  if (enabled.has("telegram") && config.channels.telegram?.token) {
    registry.registerChannel(new TelegramChannel(config.channels.telegram.token));
  }
}
