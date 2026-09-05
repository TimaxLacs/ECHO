import os from "node:os";
import path from "node:path";

export function expandHome(value: string, home: string): string {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  if (value.startsWith("~")) return path.join(os.homedir(), value.slice(1));
  return value;
}

export function echoHome(override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.ECHO_HOME) return path.resolve(process.env.ECHO_HOME);
  return path.join(os.homedir(), ".echo");
}

export function memoryDir(home: string): string {
  return path.join(home, "memory");
}

export function voicesDir(home: string): string {
  return path.join(home, "voices");
}

export function pluginsDir(home: string): string {
  return path.join(home, "plugins");
}

export function configPath(home: string): string {
  return path.join(home, "echo.config.json");
}
