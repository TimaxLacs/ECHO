import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function expandHome(input: string, home?: string): string {
  const echoHomePath = home ?? path.join(os.homedir(), ".echo");
  if (input === "~/.echo") return echoHomePath;
  if (input.startsWith("~/.echo/")) return path.join(echoHomePath, input.slice("~/.echo/".length));
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function echoHome(explicit?: string): string {
  if (explicit?.trim()) return path.resolve(expandHome(explicit.trim()));
  if (process.env.ECHO_HOME?.trim()) return path.resolve(expandHome(process.env.ECHO_HOME.trim()));
  const local = path.resolve(".echo-home");
  const user = path.join(os.homedir(), ".echo");
  if (fs.existsSync(path.join(local, "echo.config.json"))) return local;
  if (fs.existsSync(path.join(user, "echo.config.json"))) return user;
  return local;
}

export function configPath(home: string): string {
  return path.join(home, "echo.config.json");
}

export function memoryDir(home: string): string {
  return path.join(home, "memory");
}
