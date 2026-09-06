export type ReflectionMode =
  | "reflect"
  | "brainstorm"
  | "summarize"
  | "action_plan"
  | "deep_dive"
  | "goal_agent";

export type VoicePersona = "Female" | "Male";

export interface LocationTag {
  name: string;
  lat?: number;
  lng?: number;
}

export interface GoalMilestone {
  id: string;
  stepTitle: string;
  suggestedDate: string; // YYYY-MM-DD
  details: string;
  done: boolean;
}

export interface AgenticGoalPlan {
  goalTitle: string;
  targetTimeline: string;
  milestones: GoalMilestone[];
}

export interface InteractionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  mode?: ReflectionMode;
  modelUsed?: string;
}

export interface UserInteraction {
  id: string;
  userId: string;
  title: string;
  topic?: string;
  createdAt: number;
  updatedAt: number;
  messages: InteractionMessage[];
  mode: ReflectionMode;
  moodTag?: string;
  sentimentScore?: number;
  summary?: string;
  keyInsights?: string[];
  actionItems?: Array<{ text: string; done: boolean }>;
  goalPlan?: AgenticGoalPlan;
  tags?: string[];
  location?: LocationTag;
  embedding?: number[];
  emojiSequence?: string;
  emojiVibe?: string;
  decodedStory?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";