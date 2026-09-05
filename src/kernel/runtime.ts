import path from "node:path";
import type { EchoConfig } from "../config/schema.js";
import { pluginsDir } from "../config/paths.js";
import { pluginApi } from "../plugins/api.js";
import { loadPlugins } from "../plugins/load.js";
import { registerChannels } from "../channels/register.js";
import { registerBuiltinProviders } from "../providers/create.js";
import { registerBuiltinTools } from "../tools/register.js";
import { inspectSlots } from "./doctor.js";
import { AgentLoop } from "./loop.js";
import { Registry } from "./registry.js";
import type { Reply, SlotHealth, Turn } from "./types.js";

export class EchoRuntime {
  readonly registry = new Registry();
  private loop: AgentLoop | null = null;
  plugins: string[] = [];

  constructor(
    readonly config: EchoConfig,
    readonly home: string,
  ) {}

  async boot(): Promise<void> {
    registerBuiltinProviders(this.registry, this.config, this.home);
    await registerBuiltinTools(this.registry, this.config);
    registerChannels(this.registry, this.config, () => this.doctor());
    this.plugins = await loadPlugins(
      [...this.config.plugins, pluginsDir(this.home), path.join(process.cwd(), "plugins")],
      pluginApi(this.registry),
    );
    this.loop = new AgentLoop(this.config, this.registry, this.home);
  }

  async handle(turn: Turn): Promise<Reply> {
    if (!this.loop) throw new Error("Runtime не запущен");
    return this.loop.handle(turn);
  }

  doctor(): Promise<SlotHealth[]> {
    return inspectSlots(this.config, this.registry);
  }
}
