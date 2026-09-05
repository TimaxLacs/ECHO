import type { EchoConfig } from "../config/schema.js";
import type { SlotHealth } from "../kernel/types.js";

export function dashboardHtml(config: EchoConfig, slots: SlotHealth[]): string {
  const rows = slots
    .map((slot) => {
      const mark = slot.ok ? "жив" : "молчит";
      return `<tr><td>${escape(slot.kind)}</td><td>${escape(slot.id)}</td><td>${mark}</td><td>${escape(slot.detail)}</td></tr>`;
    })
    .join("");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Эхо — слоты</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #111; color: #eee; }
    main { max-width: 880px; margin: 0 auto; padding: 24px 16px 64px; }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    p { color: #bbb; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #333; font-size: 0.95rem; }
    form { display: flex; gap: 8px; flex-wrap: wrap; }
    input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #444; background: #1c1c1c; color: inherit; }
    input { flex: 1 1 240px; }
    button { background: #e8e8e8; color: #111; border: 0; cursor: pointer; }
    pre { white-space: pre-wrap; background: #1a1a1a; padding: 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>${escape(config.identity.name)}</h1>
    <p>Универсальный runtime. Ниже — живые слоты. Можно спросить текстом: ответ пойдёт через цепочку мозга и инструментов.</p>
    <table>
      <thead><tr><th>Слот</th><th>Реализация</th><th>Статус</th><th>Деталь</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <form id="ask">
      <input name="text" placeholder="Спроси Эхо" required />
      <button type="submit">Спросить</button>
    </form>
    <pre id="out"></pre>
  </main>
  <script>
    const out = document.getElementById("out");
    document.getElementById("ask").addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = new FormData(event.target).get("text");
      out.textContent = "думаю…";
      const response = await fetch("/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      out.textContent = await response.text();
    });
  </script>
</body>
</html>`;
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
