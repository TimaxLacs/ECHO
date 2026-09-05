import type { ChannelAdapter, Reply, Turn } from "../kernel/types.js";

type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
};

export class TelegramChannel implements ChannelAdapter {
  readonly id = "telegram";
  readonly kind = "channel" as const;
  private offset = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly token?: string) {}

  async start(handle: (turn: Turn) => Promise<Reply>): Promise<void> {
    if (!this.token) return;
    const tick = async () => {
      try {
        await this.poll(handle);
      } catch (error) {
        console.error("telegram", error instanceof Error ? error.message : error);
      }
    };
    this.timer = setInterval(() => void tick(), 2000);
    await tick();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(handle: (turn: Turn) => Promise<Reply>): Promise<void> {
    const updates = await this.api<TelegramUpdate[]>("getUpdates", { offset: this.offset, timeout: 0 });
    for (const update of updates) {
      this.offset = update.update_id + 1;
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat.id;
      if (!text || chatId == null) continue;
      const reply = await handle({ channel: this.id, speaker: String(chatId), text });
      await this.api("sendMessage", { chat_id: chatId, text: reply.text.slice(0, 3900) });
    }
  }

  private async api<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { ok: boolean; result: T; description?: string };
    if (!body.ok) throw new Error(body.description ?? method);
    return body.result;
  }
}
