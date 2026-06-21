import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

const router: IRouter = Router();

// Simple in-memory rate limiter: 20 requests per minute per IP
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const window = 60_000;
  const limit = 20;
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + window });
    next();
    return;
  }
  if (entry.count >= limit) {
    res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
    return;
  }
  entry.count++;
  next();
}

router.post("/ai/chat", rateLimiter, async (req, res) => {
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
