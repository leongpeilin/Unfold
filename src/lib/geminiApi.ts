import { AgenticGoalPlan, ReflectionMode } from "../types";

export interface ReflectResponse {
  reply: string;
  goalPlan?: AgenticGoalPlan | null;
  mode: ReflectionMode;
  modelUsed: string;
}

export interface SummarizeResponse {
  title: string;
  summary: string;
  moodTag: string;
  keyInsights: string[];
  actionItems: string[];
  modelUsed: string;
}

export interface GoalPlanResponse {
  goalPlan: AgenticGoalPlan;
  modelUsed: string;
}

// 1. Generate multi-turn AI reflection response
export async function generateReflection(params: {
  prompt: string;
  history: Array<{ role: string; content: string }>;
  mode: ReflectionMode;
  topic?: string;
}): Promise<ReflectResponse> {
  const response = await fetch("/api/gemini/reflect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Reflection failed with status ${response.status}`);
  }

  return response.json();
}

// 2. Generate executive synthesis and action checklist
export async function generateSessionSummary(params: {
  messages: Array<{ role: string; content: string }>;
  title?: string;
}): Promise<SummarizeResponse> {
  const response = await fetch("/api/gemini/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Summarization failed with status ${response.status}`);
  }

  return response.json();
}

// 3. Generate Agentic Goal Milestone Breakdown
export async function generateGoalPlan(params: {
  goalText: string;
  context?: string;
}): Promise<GoalPlanResponse> {
  const response = await fetch("/api/gemini/goal-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Goal planning failed with status ${response.status}`);
  }

  return response.json();
}

// 4. Generate Semantic Vector Embedding
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const response = await fetch("/api/gemini/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Embedding failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.embedding || [];
}

export interface EmojiStoryResponse {
  emojiSequence: string;
  vibeTitle: string;
  decodedStory: string;
}

export async function generateEmojiStory(params: {
  messages: Array<{ role: string; content: string }>;
}): Promise<EmojiStoryResponse> {
  const response = await fetch("/api/gemini/emoji-story", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed with status ${response.status}`);
  }

  return response.json();
}

export async function synthesizeGeminiSpeech(params: {
  text: string;
  voice: string;
}): Promise<{ audioData: string; mimeType: string }> {
  const response = await fetch("/api/gemini/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `TTS synthesis failed with status ${response.status}`);
  }

  return response.json();
}