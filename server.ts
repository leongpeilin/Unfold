import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// 1. Top-Level Request Deserialization
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Lazy initialize GoogleGenAI client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is missing or using placeholder.");
  }
  return new GoogleGenAI({ apiKey });
}

// Active Production Model Ladder with Gemini 3.6 Flash
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

async function generateContentWithFallback(params: {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.7,
        },
      });

      const text = response.text || "";
      if (text) {
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      console.error(`[Gemini Error] Model ${model} failed:`, err?.status || err?.message || err);
      lastError = err;
    }
  }

  throw new Error(
    `Gemini API Error: ${lastError?.message || JSON.stringify(lastError) || "Unknown API error"}`
  );
}

// 2. Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  const key = process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: Boolean(key && key !== "MY_GEMINI_API_KEY"),
  });
});

// 3. Multi-turn reflection & agentic planning endpoint
app.post("/api/gemini/reflect", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const prompt: string = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const history: Array<{ role: string; content: string }> = Array.isArray(body.history)
      ? body.history
      : [];
    const mode: string = typeof body.mode === "string" ? body.mode : "reflect";

    if (!prompt && history.length === 0) {
      res.status(400).json({ error: "A prompt or message history is required." });
      return;
    }

    if (history.length >= 20) {
      res.status(429).json({
        error: "Prototype reflection limit reached (20 turns per session). Please start a New Reflection.",
      });
      return;
    }

    const todayIso = new Date().toISOString().split("T")[0];
    const systemInstruction = `You are Unfold, an empathetic personal growth partner. 

Analyze the conversation. If the user discusses, commits to, or requests an action plan, routine, schedule, or milestone, break it down into structured milestones with realistic dates starting after today (${todayIso}). Respond ONLY with valid JSON matching this schema:
{
  "reply": "Warm, encouraging, conversational response strictly 2-3 sentences (under 60 words).",
  "goalPlan": {
    "goalTitle": "Concise title for the goal/routine (e.g. 'Gym & Fitness Routine')",
    "targetTimeline": "e.g. 'Upcoming Week' or '4 Weeks'",
    "milestones": [
      {
        "id": "m1",
        "stepTitle": "Specific scheduled session or action",
        "suggestedDate": "YYYY-MM-DD",
        "details": "Short note for the calendar event",
        "done": false
      }
    ]
  }
}
If no tangible goals or schedules are mentioned, set "goalPlan" to null. Output ONLY raw JSON with no Markdown backticks or wrapping.`;

    const contents: any[] = [];
    const trimmedHistory = history.slice(-10);

    for (const msg of trimmedHistory) {
      if (!msg || typeof msg.content !== "string") continue;
      const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }

    if (prompt) {
      contents.push({
        role: "user",
        parts: [{ text: prompt }],
      });
    }

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
      temperature: 0.7,
    });

    let parsedReply = {
      reply: result.text,
      goalPlan: null as any,
    };

    try {
      const cleanJson = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.reply) {
        parsedReply = parsed;
      }
    } catch {
      parsedReply = {
        reply: result.text.replace(/\{[\s\S]*\}/, "").trim() || result.text,
        goalPlan: null,
      };
    }

    res.json({
      reply: parsedReply.reply,
      goalPlan: parsedReply.goalPlan || null,
      mode,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("[Reflect Endpoint Error]:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate reflection response.",
    });
  }
});

// 4. Session analysis & structured summary endpoint
app.post("/api/gemini/summarize", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const messages: Array<{ role: string; content: string }> = Array.isArray(body.messages)
      ? body.messages
      : [];
    const currentTitle: string = typeof body.title === "string" ? body.title : "";

    if (messages.length === 0) {
      res.status(400).json({ error: "Conversation messages are required for summarization." });
      return;
    }

    const conversationTranscript = messages
      .map((m) => `${m.role === "user" ? "User" : "Unfold"}: ${m.content}`)
      .join("\n\n");

    const systemInstruction = `You are an expert cognitive psychologist and reflective growth coach analyzing an Unfold journal session. Analyze the transcript and produce a structured JSON summary matching this EXACT schema:
{
  "suggestedTitle": "A concise, evocative 3 to 6 word title capturing the essence",
  "summary": "A cohesive 2-3 sentence executive summary of what was explored",
  "moodTag": "One primary mood or mental state (e.g. 'Ocean Calm', 'Creative Clarity', 'Grounded Energy', 'Mindful Focus')",
  "sentimentScore": <Number between -1.0 (very negative/drained) to 1.0 (very positive/energized)>,
  "keyInsights": ["Array of 2 to 4 bulleted key growth insights uncovered"],
  "actionItems": ["Array of 2 to 4 concrete, realistic actionable next steps"]
}
Output ONLY valid raw JSON with no Markdown backticks or wrapping text.`;

    const promptText = `Analyze this journal transcript and generate the structured JSON summary:\n\n${conversationTranscript}\n\n${
      currentTitle ? `Current working title: ${currentTitle}` : ""
    }`;

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      systemInstruction,
      temperature: 0.4,
    });

    let parsedData = null;
    try {
      const cleanJson = result.text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch {
      parsedData = {
        suggestedTitle: currentTitle || "Coastal Reflection",
        summary: result.text.slice(0, 300),
        moodTag: "Ocean Calm",
        sentimentScore: 0.5,
        keyInsights: ["Gained clarity through written reflection"],
        actionItems: ["Review insights in upcoming days"],
      };
    }

    res.json({
      title: parsedData.suggestedTitle || currentTitle || "Untitled Reflection",
      summary: parsedData.summary || "",
      moodTag: parsedData.moodTag || "Reflective",
      sentimentScore: typeof parsedData.sentimentScore === "number" ? parsedData.sentimentScore : 0.5,
      keyInsights: Array.isArray(parsedData.keyInsights) ? parsedData.keyInsights : [],
      actionItems: Array.isArray(parsedData.actionItems) ? parsedData.actionItems : [],
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("[Summarize Endpoint Error]:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate structured summary.",
    });
  }
});

// 5. Agentic Goal Breakdown Endpoint
app.post("/api/gemini/goal-plan", async (req: Request, res: Response) => {
  try {
    const { goalText, context } = req.body || {};
    if (!goalText || typeof goalText !== "string") {
      res.status(400).json({ error: "Goal statement is required." });
      return;
    }

    const todayIso = new Date().toISOString().split("T")[0];
    const systemInstruction = `You are an agentic goal strategist. Given a user's goal statement and reflection context, break it into 3 to 5 clear, sequential milestones with realistic suggested target dates starting after today (${todayIso}). Output ONLY valid JSON matching this schema:
{
  "goalTitle": "Concise title for the goal",
  "targetTimeline": "e.g. 4 Weeks / 3 Months",
  "milestones": [
    {
      "id": "m1",
      "stepTitle": "Step 1 action title",
      "suggestedDate": "YYYY-MM-DD",
      "details": "Brief 1-sentence guidance on how to complete this milestone",
      "done": false
    }
  ]
}
Output ONLY raw JSON with no backticks.`;

    const promptText = `Break down this goal:\nGoal: "${goalText}"\n${context ? `Context: ${context}` : ""}`;

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      systemInstruction,
      temperature: 0.3,
    });

    let goalPlan = null;
    try {
      const cleanJson = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      goalPlan = JSON.parse(cleanJson);
    } catch {
      goalPlan = {
        goalTitle: goalText.slice(0, 40),
        targetTimeline: "1 Month",
        milestones: [
          {
            id: "m1",
            stepTitle: "Initial research and setup",
            suggestedDate: todayIso,
            details: "Clarify requirements and prepare resources.",
            done: false,
          },
        ],
      };
    }

    res.json({ goalPlan, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.error("[Goal Plan Endpoint Error]:", error);
    res.status(500).json({ error: error?.message || "Failed to generate goal plan." });
  }
});

// 6. Semantic Vector Embeddings Endpoint
app.post("/api/gemini/embed", async (req: Request, res: Response) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text string is required for embedding." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      res.status(500).json({ error: "GEMINI_API_KEY is missing or placeholder." });
      return;
    }

    const cleanText = text.trim();
    // Direct REST call to active gemini-embedding-001 with 768 dimensions
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

    const apiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: {
          parts: [{ text: cleanText }],
        },
        outputDimensionality: 768,
      }),
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      console.error("[Embed REST API Error]:", errData);
      throw new Error(errData.error?.message || `Status ${apiRes.status}`);
    }

    const data = await apiRes.json();
    const values = data.embedding?.values || [];

    res.json({
      embedding: values,
    });
  } catch (error: any) {
    console.error("[Embed Endpoint Error]:", error);
    res.status(500).json({ error: error?.message || "Failed to generate embedding." });
  }
});

// 7. Gemini Native Neural Text-to-Speech Endpoint
app.post("/api/gemini/tts", async (req: Request, res: Response) => {
  try {
    const { text, voice = "Aoede" } = req.body || {};
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text is required for TTS synthesis." });
      return;
    }

    const ai = getGeminiClient();
    const cleanText = text
      .replace(/[#*_`~>-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const spokenSnippet =
      cleanText.length > 250
        ? cleanText.slice(0, cleanText.lastIndexOf(".", 250) + 1) || cleanText.slice(0, 250)
        : cleanText;

    const response: any = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: spokenSnippet,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(
      (part: any) => part.inlineData && part.inlineData.mimeType?.startsWith("audio/")
    );

    if (!audioPart || !audioPart.inlineData?.data) {
      throw new Error("No audio payload returned from Gemini.");
    }

    res.json({
      audioData: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || "audio/pcm",
    });
  } catch (error: any) {
    console.error("[TTS Endpoint Error]:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate neural audio.",
    });
  }
});

// 8. Emoji-only reflection story synthesis endpoint
app.post("/api/gemini/emoji-story", async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const messages: Array<{ role: string; content: string }> = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      res.status(400).json({ error: "Messages are required to create an emoji story." });
      return;
    }

    const transcript = messages.map((m) => `${m.role === "user" ? "User" : "Unfold"}: ${m.content}`).join("\n");
    const systemInstruction = `You are a playful emoji storyteller. 

Analyze the user's reflection transcript and return ONLY valid JSON matching this schema:
{
  "emojiSequence": "A string of 6-10 sequential emojis representing the user's emotional and narrative journey today",
  "vibeTitle": "A fun 2-4 word vibe title (e.g. 'From Chaos to Zen')",
  "decodedStory": "A lighthearted, witty 1-2 sentence translation of the emoji journey."
}
Output ONLY raw JSON with no Markdown wrapping.`;

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      systemInstruction,
      temperature: 0.8,
    });

    let emojiData = {
      emojiSequence: "✨🌱🌊☀️🕊️",
      vibeTitle: "Mindful Moments",
      decodedStory: "Took on the day with focus, sipped some calmness, and found clarity.",
    };

    try {
      const cleanJson = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      emojiData = JSON.parse(cleanJson);
    } catch {}

    res.json(emojiData);
  } catch (error: any) {
    console.error("[Emoji Story Endpoint Error]:", error);
    res.status(500).json({ error: error?.message || "Failed to generate emoji story." });
  }
});

// 9. Start Server with clean Vite & Production routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // In dev mode, Vite handles index.html and frontend assets
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Unfold Server] listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();