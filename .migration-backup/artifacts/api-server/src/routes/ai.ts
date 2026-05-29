import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";

router.post("/ai/chat", async (req, res) => {
  if (!GROQ_API_KEY) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  const { messages, model } = req.body as {
    messages: Array<{ role: string; content: string }>;
    model?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const allowedModels = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
  ];
  const selectedModel = allowedModels.includes(model ?? "")
    ? model
    : allowedModels[0];

  try {
    const upstream = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      res
        .status(upstream.status)
        .json({ error: (err as any)?.error?.message ?? "Groq error" });
      return;
    }

    const data = await upstream.json();
    const content =
      (data as any)?.choices?.[0]?.message?.content ?? "No response.";
    res.json({ content });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Internal error" });
  }
});

export default router;
