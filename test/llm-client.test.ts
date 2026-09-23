import assert from "node:assert/strict";
import test from "node:test";
import { OpenAiCompatLlm } from "../src/providers/llm/openai-compat.js";
import { EchoError } from "../src/kernel/types.js";

test("локальный пресет не отправляет ключ", async () => {
  let authorization: string | undefined;
  let userAgent = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    authorization = headers.get("authorization") ?? undefined;
    userAgent = headers.get("user-agent") ?? "";
    return new Response(JSON.stringify({ choices: [{ message: { content: "да" } }] }), { status: 200 });
  };
  const llm = new OpenAiCompatLlm(
    "local",
    { kind: "llm", preset: "local", baseUrl: "http://127.0.0.1:11434/v1", model: "tiny", apiKey: "gsk_unitfakekey1234567890" },
    fetchImpl,
  );
  const output = await llm.complete({ messages: [{ role: "user", content: "привет" }], tools: [] });
  assert.equal(output.text, "да");
  assert.equal(authorization, undefined);
  assert.equal(userAgent, "echo-agent/0.1");
});

test("groq зовёт свой URL и прячет ключ в ошибке", async () => {
  const fetchImpl: typeof fetch = async (url) => {
    assert.match(String(url), /api\.groq\.com/);
    return new Response("bad gsk_unitfakekey1234567890", { status: 401 });
  };
  const llm = new OpenAiCompatLlm(
    "groq",
    { kind: "llm", preset: "groq", model: "llama", apiKey: "gsk_unitfakekey1234567890" },
    fetchImpl,
    ["gsk_unitfakekey1234567890"],
  );
  await assert.rejects(() => llm.complete({ messages: [{ role: "user", content: "привет" }], tools: [] }), (error: unknown) => {
    assert.ok(error instanceof EchoError);
    assert.equal(error.message.includes("gsk_"), false);
    return true;
  });
});

test("отказ от tools повторяет запрос без них", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    if ("tools" in body) return new Response("tools are not supported", { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "текстом" } }] }), { status: 200 });
  };
  const llm = new OpenAiCompatLlm(
    "openrouter",
    { kind: "llm", preset: "openrouter", model: "meta", apiKey: "sk-or-v1-unitfakekey0123456789abcd" },
    fetchImpl,
  );
  const output = await llm.complete({
    messages: [{ role: "user", content: "привет" }],
    tools: [
      {
        name: "now",
        description: "время",
        risk: "read",
        parameters: { type: "object", properties: {} },
      },
    ],
  });
  assert.equal(output.text, "текстом");
  assert.equal("tools" in (bodies[0] ?? {}), true);
  assert.equal("tools" in (bodies[1] ?? {}), false);
});

test("404 про tools тоже повторяется без них", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if ("tools" in body) return new Response("No endpoints found that support tool use", { status: 404 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "без tools" } }] }), { status: 200 });
  };
  const llm = new OpenAiCompatLlm(
    "openrouter",
    { kind: "llm", preset: "openrouter", model: "meta", apiKey: "sk-or-v1-unitfakekey0123456789abcd" },
    fetchImpl,
  );
  const output = await llm.complete({
    messages: [{ role: "user", content: "привет" }],
    tools: [{ name: "now", description: "время", risk: "read", parameters: { type: "object", properties: {} } }],
  });
  assert.equal(output.text, "без tools");
  assert.equal(calls, 2);
});

test("openrouter ставит заголовок названия", async () => {
  let title = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    title = new Headers(init?.headers).get("x-title") ?? "";
    return new Response(JSON.stringify({ choices: [{ message: { content: "ок" } }] }), { status: 200 });
  };
  const llm = new OpenAiCompatLlm(
    "openrouter",
    { kind: "llm", preset: "openrouter", model: "meta", apiKey: "sk-or-v1-unitfakekey0123456789abcd" },
    fetchImpl,
  );
  await llm.complete({ messages: [{ role: "user", content: "привет" }], tools: [] });
  assert.equal(title, "Echo");
});
