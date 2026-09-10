import { createServerFn } from "@tanstack/react-start";
import { GROK_SYSTEM } from "./bot";

type ChatTurn = { role: "user" | "assistant"; content: string };

export const askEmber = createServerFn({ method: "POST" })
  .validator((input: { messages: ChatTurn[]; currency: "USD" | "PKR" }) => ({
    messages: input.messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 400),
    })),
    currency: input.currency,
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "unavailable" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 180,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `${GROK_SYSTEM}\nShow prices in ${data.currency}.`,
          },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) return { ok: false as const, error: `xAI ${res.status}` };

    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = body.choices[0]?.message.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "empty" };
    return { ok: true as const, text };
  });
