import http from "node:http";

const port = Number(process.env.STUB_PORT || 11435);
const host = "127.0.0.1";

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    send(res, 200, { data: [{ id: "echo-stub" }] });
    return;
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const tool = [...messages].reverse().find((message) => message.role === "tool");
    const user = [...messages].reverse().find((message) => message.role === "user");
    const userText = typeof user?.content === "string" ? user.content : "";
    if (!tool && Array.isArray(body.tools) && /tool:now/i.test(userText)) {
      send(res, 200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_now",
                  type: "function",
                  function: { name: "now", arguments: "{}" },
                },
              ],
            },
          },
        ],
      });
      return;
    }
    const content = tool ? `Готово: ${tool.content}` : `локальный stub: ${userText}`;
    send(res, 200, { choices: [{ message: { role: "assistant", content } }] });
    return;
  }
  send(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  console.log(`openai stub http://${host}:${port}/v1`);
});

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
