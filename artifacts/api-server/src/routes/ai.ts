import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/ai/chat", async (req, res) => {
  const apiKey = process.env["GROQ_API_KEY"];

  if (!apiKey) {
    res.status(503).json({
      error: "GROQ_API_KEY is not configured. Add it to Replit Secrets.",
    });
    return;
  }

  const { model = "llama-3.3-70b-versatile", messages } = req.body as {
    model?: string;
    messages: { role: string; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages }),
      },
    );

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      res.status(groqRes.status).json({
        error: (err as { error?: { message?: string } }).error?.message ?? "Groq error",
      });
      return;
    }

    const data = (await groqRes.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    res.json({ content });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

export default router;
