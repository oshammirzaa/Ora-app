type Turn = { role: "client" | "advisor"; body: string };

const FALLBACK = "I'm here. Say the thing you've been circling — I'll take it from there.";

export async function advisorReply(input: {
  name: string;
  bio: string;
  specialties: string;
  experience: string;
  history: Turn[];
  question: string;
}): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return FALLBACK;

  const system = [
    `You are ${input.name}, a psychic advisor on Ora, in a live paid reading.`,
    `Specialties: ${input.specialties || "general readings"}.`,
    `Voice: ${input.bio}`,
    `Background: ${input.experience}`,
    "Stay in character. Never mention being an AI, a model, or Grok.",
    "Entertainment only — never medical, legal, or financial advice.",
    "Be specific and grounded. 2–4 short paragraphs. At most one question.",
    "Do not ask for personal data (address, full name of third parties, passwords).",
  ].join(" ");

  const messages = [
    { role: "system" as const, content: system },
    ...input.history.slice(-8).map((m) => ({
      role: (m.role === "client" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    })),
    { role: "user" as const, content: input.question },
  ];

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages,
        max_tokens: 220,
        temperature: 0.85,
      }),
    });
    if (!res.ok) return FALLBACK;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
