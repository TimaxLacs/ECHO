import { lookup } from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { EchoError } from "../kernel/types.js";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal"]);

export function resolveInside(root: string, request: string): string {
  const base = path.resolve(root);
  const target = path.resolve(base, request || ".");
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new EchoError("path_escape", "Путь вне песочницы");
  }
  return target;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EchoError("http_url", "Некорректный URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new EchoError("http_url", "Разрешены только http и https");
  }
  if (url.username || url.password) throw new EchoError("http_url", "URL с паролем запрещён");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
    throw new EchoError("http_blocked", "Адрес внутри сети запрещён");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new EchoError("http_blocked", "Адрес внутри сети запрещён");
    return url;
  }
  const records = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!records.length) throw new EchoError("http_dns", "Имя не резолвится");
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new EchoError("http_blocked", "Имя смотрит во внутреннюю сеть");
  }
  return url;
}

export function isPrivateIp(ip: string): boolean {
  const host = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const mapped = ipv4FromMapped(host);
  if (mapped) return isPrivateV4(mapped);
  const family = net.isIP(host);
  if (family === 4) return isPrivateV4(host);
  if (family === 6) return isPrivateV6(host);
  return true;
}

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateV6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  const first = parseInt((host.split(":").find((part) => part.length > 0) ?? "0"), 16);
  if (Number.isNaN(first)) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  return false;
}

function ipv4FromMapped(host: string): string | null {
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (hex?.[1] && hex[2]) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  return dotted?.[1] ?? null;
}
