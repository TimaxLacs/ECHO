export function register(api) {
  api.registerTool({
    spec: {
      name: "ping",
      description: "Проверка, что плагин из репозитория подхватился",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      risk: "read",
    },
    async execute() {
      return { ok: true, content: "pong" };
    },
  });
}
