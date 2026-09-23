import type { EchoConfig } from "../config/schema.js";
import { registerBuiltinProviders } from "../providers/create.js";
import { registerBuiltinTools } from "../tools/register.js";
import { inspectSlots } from "./doctor.js";
import { AgentLoop } from "./loop.js";
import { Registry } from "./registry.js";
import type { Reply, SlotHealth, Turn } from "./types.js";

export class EchoRuntime {
  registry = new Registry();
  private loop: AgentLoop | null = null;

  constructor(
    public config: EchoConfig,
    readonly home: string,
    public secrets: string[],
  ) {}

  boot(): void {
    this.registry = new Registry();
    registerBuiltinProviders(this.registry, this.config, this.home, this.secrets);
    registerBuiltinTools(this.registry, this.config, this.home);
    this.loop = new AgentLoop(this.config, this.registry, this.home, this.secrets);
  }

  handle(turn: Turn): Promise<Reply> {
    if (!this.loop) throw new Error("Runtime не запущен");
    return this.loop.handle(turn);
  }

  doctor(): Promise<SlotHealth[]> {
    return inspectSlots(this.config, this.registry);
  }

  replace(config: EchoConfig, secrets: string[]): void {
    this.config = config;
    this.secrets = secrets;
    this.boot();
  }
}
