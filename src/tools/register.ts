import type { EchoConfig } from "../config/schema.js";
import type { Registry } from "../kernel/registry.js";
import { filesTool } from "./files.js";
import { harnessTool } from "./harness.js";
import { httpTool } from "./http.js";
import { loadMcpTools } from "./mcp.js";
import { memoryTool } from "./memory.js";
import { nowTool } from "./now.js";
import { shellTool } from "./shell.js";

export async function registerBuiltinTools(registry: Registry, config: EchoConfig): Promise<void> {
  const enabled = new Set(config.tools.enabled);
  const available = [
    nowTool(),
    memoryTool(),
    filesTool(config.tools.files.root),
    httpTool(config.tools.http.timeoutMs, config.tools.http.enabled),
    shellTool(config.tools.shell.allow, config.tools.shell.timeoutMs),
  ];
  if (config.tools.harness) {
    available.push(harnessTool(config.tools.harness.name, config.tools.harness.command, config.tools.harness.args));
  }
  for (const tool of available) {
    if (enabled.has(tool.spec.name)) registry.registerTool(tool);
  }
  if (!config.tools.mcp.length) return;
  for (const tool of await loadMcpTools(config.tools.mcp)) {
    registry.registerTool(tool);
  }
}
