import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import {
  UserInteraction,
  InteractionMessage,
  ReflectionMode,
  VoicePersona,
  SaveStatus,
  AgenticGoalPlan,
} from "../types";
import {
  generateReflection,
  generateSessionSummary,
  generateTextEmbedding,
  generateEmojiStory,
} from "../lib/geminiApi";
import { searchLocations } from "../lib/integrations";
import { resolveBestVoice } from "../lib/voiceResolver";
import { StructuredSummaryView } from "./StructuredSummaryView";
import { GoalPlannerView } from "./GoalPlannerView";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Bot,
  User as UserIcon,
  X,
  Search,
  Smile,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react";

interface JournalEditorProps {
  interaction: UserInteraction;
  onUpdateInteraction: (updated: UserInteraction) => void;
  onSaveToFirestore: (interaction: UserInteraction) => Promise<void>;
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  onRetrySave: () => void;
  voicePersona: VoicePersona;
  autoPlayVoice: boolean;
}

const STARTER_PROMPTS = [
  {
    title: "Daily Moments & Gratitude",
    prompt: "Here is what happened today, how I am feeling, and a few things I'm grateful for:",
    mode: "reflect" as ReflectionMode,
  },
  {
    title: "Break Down a Big Goal",
    prompt: "I have an ambitious goal I want to achieve. Help me structure it into scheduled milestones:",
    mode: "goal_agent" as ReflectionMode,
  },
  {
    title: "Reflection Reset",
    prompt: "I want to unwind, declutter my headspace, and reflect on what has been draining my energy lately:",
    mode: "reflect" as ReflectionMode,
  },
  {
    title: "Deep Mindset Inquiry",
    prompt: "Help me challenge my underlying assumptions and audit my blind spots regarding:",
    mode: "deep_dive" as ReflectionMode,
  },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  interaction,
  onUpdateInteraction,
  onSaveToFirestore,
  saveStatus,
  saveErrorMessage,
  onRetrySave,
  voicePersona,
  autoPlayVoice,
}) => {
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Audio / Speech States
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Emoji Story Feature States
  const [isGeneratingEmoji, setIsGeneratingEmoji] = useState(false);
  const [showDecodedStory, setShowDecodedStory] = useState(false);

  // Location Search States with Persistent Default Country
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    return localStorage.getItem("unfold_default_country") || "SG";
  });
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    Array<{ name: string; lat: number; lng: number }>
  >([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(interaction.messages.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRecognitionRef = useRef<any>(null);
  const goalPlanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (interaction.messages.length > messageCountRef.current || isGenerating) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    messageCountRef.current = interaction.messages.length;
  }, [interaction.messages.length, isGenerating]);

  useEffect(() => {
    return () => {
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleTitleChange = (newTitle: string) => {
    const updated: UserInteraction = {
      ...interaction,
      title: newTitle,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    onSaveToFirestore(updated).catch(() => {});
  };

  const handleModeChange = (newMode: ReflectionMode) => {
    const updated: UserInteraction = {
      ...interaction,
      mode: newMode,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    onSaveToFirestore(updated).catch(() => {});
  };

  // Simple Desktop Web Speech API Dictation
  const toggleRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    activeRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleSpeakText = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking && speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[#*_`~>-]/g, " ").replace(/\s+/g, " ").trim();
    const spokenSnippet =
      cleanText.length > 250
        ? cleanText.slice(0, cleanText.lastIndexOf(".", 250) + 1) || cleanText.slice(0, 250)
        : cleanText;

    const utterance = new SpeechSynthesisUtterance(spokenSnippet);
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const resolved = resolveBestVoice(voicePersona, voices);
    if (resolved.voice) utterance.voice = resolved.voice;
    utterance.pitch = resolved.pitch;
    utterance.rate = resolved.rate;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(msgId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleCreateEmojiSummary = async () => {
    if (interaction.messages.length === 0 || isGeneratingEmoji) return;
    setIsGeneratingEmoji(true);
    setShowDecodedStory(false);
    try {
      const messagesPayload = interaction.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await generateEmojiStory({ messages: messagesPayload });
      const updated: UserInteraction = {
        ...interaction,
        emojiSequence: res.emojiSequence,
        emojiVibe: res.vibeTitle,
        decodedStory: res.decodedStory,
        updatedAt: Date.now(),
      };
      onUpdateInteraction(updated);
      await onSaveToFirestore(updated);
    } catch (err: any) {
      console.error("Emoji summary generation failed:", err);
    } finally {
      setIsGeneratingEmoji(false);
    }
  };

  const triggerLocationSearch = (queryText: string, country: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (queryText.trim().length >= 2) {
      setIsSearchingLocation(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const results = await searchLocations(queryText, country);
          setLocationResults(results);
        } catch (err) {
          console.error("Location query error:", err);
        } finally {
          setIsSearchingLocation(false);
        }
      }, 300);
    } else {
      setLocationResults([]);
      setIsSearchingLocation(false);
    }
  };

  const handleSearchLocationInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocationQuery(val);
    triggerLocationSearch(val, selectedCountry);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    localStorage.setItem("unfold_default_country", newCountry);
    if (locationQuery.trim().length >= 2) {
      triggerLocationSearch(locationQuery, newCountry);
    }
  };

  const handleSelectLocation = async (loc: { name: string; lat: number; lng: number }) => {
    const updated: UserInteraction = {
      ...interaction,
      location: loc,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    await onSaveToFirestore(updated);
    setIsLocationModalOpen(false);
    setLocationQuery("");
    setLocationResults([]);
  };

  const handleRemoveLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const updated: UserInteraction = {
      ...interaction,
      location: undefined,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    await onSaveToFirestore(updated);
  };

  const handleSendMessage = async (customPrompt?: string, targetMode?: ReflectionMode) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend || isGenerating) return;

    if (isRecording && activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    }

    const currentMode = targetMode || interaction.mode;
    setGenerationError(null);

    const userMsg: InteractionMessage = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      role: "user",
      content: promptToSend,
      timestamp: Date.now(),
      mode: currentMode,
    };

    const newMessages = [...interaction.messages, userMsg];
    let updatedInteraction: UserInteraction = {
      ...interaction,
      messages: newMessages,
      mode: currentMode,
      title:
        interaction.title === "New Reflection" || !interaction.title
          ? promptToSend.slice(0, 35) + (promptToSend.length > 35 ? "..." : "")
          : interaction.title,
      updatedAt: Date.now(),
    };

    onUpdateInteraction(updatedInteraction);

    if (!customPrompt) {
      setInputText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }

    setIsGenerating(true);

    try {
      const historyPayload = interaction.messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        content: m.content,
      }));

      const res = await generateReflection({
        prompt: promptToSend,
        history: historyPayload,
        mode: currentMode,
        topic: updatedInteraction.topic || updatedInteraction.title,
      });

      const assistantMsg: InteractionMessage = {
        id: "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        role: "assistant",
        content: res.reply,
        timestamp: Date.now(),
        mode: currentMode,
        modelUsed: res.modelUsed,
      };

      updatedInteraction = {
        ...updatedInteraction,
        messages: [...newMessages, assistantMsg],
        goalPlan: res.goalPlan || updatedInteraction.goalPlan,
        updatedAt: Date.now(),
      };

      onUpdateInteraction(updatedInteraction);
      await onSaveToFirestore(updatedInteraction);

      if (autoPlayVoice) {
        handleSpeakText(assistantMsg.id, assistantMsg.content);
      }

      generateTextEmbedding(`${updatedInteraction.title} ${promptToSend} ${res.reply}`)
        .then((embeddingVec) => {
          if (embeddingVec && embeddingVec.length > 0) {
            const withEmbedding = { ...updatedInteraction, embedding: embeddingVec };
            onUpdateInteraction(withEmbedding);
            onSaveToFirestore(withEmbedding).catch(() => {});
          }
        })
        .catch((err) => console.warn("Background embedding error:", err));
    } catch (err: any) {
      console.error("Reflection failed:", err);
      setGenerationError(err.message || "Failed to generate reflection. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (interaction.messages.length === 0 || isSummarizing) return;
    setIsSummarizing(true);
    setGenerationError(null);

    try {
      const messagesPayload = interaction.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const summaryRes = await generateSessionSummary({
        messages: messagesPayload,
        title: interaction.title,
      });

      const updated: UserInteraction = {
        ...interaction,
        title:
          interaction.title === "New Reflection" || !interaction.title
            ? summaryRes.title
            : interaction.title,
        summary: summaryRes.summary,
        moodTag: summaryRes.moodTag,
        keyInsights: summaryRes.keyInsights,
        actionItems: summaryRes.actionItems.map((itemText) => ({
          text: itemText,
          done: false,
        })),
        updatedAt: Date.now(),
      };

      onUpdateInteraction(updated);
      await onSaveToFirestore(updated);
    } catch (err: any) {
      console.error("Summary generation failed:", err);
      setGenerationError(err.message || "Failed to generate structured summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleToggleActionItem = (index: number) => {
    if (!interaction.actionItems) return;
    const updatedActions = [...interaction.actionItems];
    updatedActions[index] = {
      ...updatedActions[index],
      done: !updatedActions[index].done,
    };
    const updated: UserInteraction = {
      ...interaction,
      actionItems: updatedActions,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    onSaveToFirestore(updated).catch(() => {});
  };

  const handleUpdateGoalPlan = (updatedPlan: AgenticGoalPlan) => {
    const updated: UserInteraction = {
      ...interaction,
      goalPlan: updatedPlan,
      updatedAt: Date.now(),
    };
    onUpdateInteraction(updated);
    onSaveToFirestore(updated).catch(() => {});
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <div
      id="journal-editor-container"
      className="flex-1 flex flex-col h-full min-h-0 bg-transparent overflow-hidden"
    >
      {/* Canvas Top Bar */}
      <div className="h-[77px] px-3 sm:px-6 border-b border-sky-200/70 bg-white/50 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <input
            id="input-entry-title"
            type="text"
            value={interaction.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Name your reflection..."
            className="w-full text-base sm:text-lg font-bold font-serif bg-transparent text-slate-900 border-none focus:outline-none focus:ring-1 focus:ring-cyan-600 rounded-lg px-1 -ml-1 placeholder-slate-400 truncate"
          />
          <div className="flex items-center gap-2 mt-0.5 px-0.5 text-[11px] text-slate-600">
            <span>
              {new Date(interaction.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {interaction.location ? (
              <div className="flex items-center gap-1 bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium shadow-xs">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${interaction.location.lat},${interaction.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:underline truncate max-w-[110px] sm:max-w-[160px]"
                >
                  <MapPin className="w-3 h-3 text-cyan-700 shrink-0" />
                  <span className="truncate">{interaction.location.name}</span>
                </a>
                <button
                  type="button"
                  onClick={handleRemoveLocation}
                  className="hover:text-rose-700 ml-0.5 cursor-pointer"
                  title="Remove location"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-1 text-slate-600 hover:text-cyan-800 bg-white/60 px-2 py-0.5 rounded-full border border-slate-200 hover:border-cyan-300 transition-all cursor-pointer font-medium text-[10px] sm:text-[11px]"
              >
                <MapPin className="w-3 h-3 text-cyan-700" />
                <span>Tag Location</span>
              </button>
            )}
          </div>
        </div>

        {/* Emoji Summary Trigger & Save State */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {interaction.messages.length > 0 && (
            <button
              type="button"
              onClick={handleCreateEmojiSummary}
              disabled={isGeneratingEmoji}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Generate Emoji Summary"
            >
              <Smile className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden xs:inline">{isGeneratingEmoji ? "Summarizing..." : "Emoji Summary"}</span>
            </button>
          )}

          {saveStatus === "saving" && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-100 text-cyan-800 text-xs border border-cyan-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Saving</span>
            </div>
          )}

          {saveStatus === "saved" && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span className="hidden sm:inline">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Scrollable Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Full Emoji Journey Card */}
        {interaction.emojiSequence && (
          <div className="p-3.5 sm:p-5 rounded-3xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm space-y-2 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">✨</span>
                <span className="text-xs font-bold text-amber-900 font-serif">
                  {interaction.emojiVibe ? interaction.emojiVibe : "Glow Up Blueprint"}
                </span>
              </div>
              {interaction.decodedStory && (
                <button
                  type="button"
                  onClick={() => setShowDecodedStory(!showDecodedStory)}
                  className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-white/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-amber-300 shadow-2xs cursor-pointer transition-all"
                >
                  {showDecodedStory ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showDecodedStory ? "Hide" : "Decode"}</span>
                </button>
              )}
            </div>
            <div className="text-center py-1 sm:py-2 text-2xl sm:text-4xl tracking-widest select-all">
              {interaction.emojiSequence}
            </div>
            {showDecodedStory && interaction.decodedStory && (
              <p className="text-xs text-amber-900/90 italic text-center bg-white/60 p-2 sm:p-2.5 rounded-2xl border border-amber-200 leading-relaxed font-normal">
                &ldquo;{interaction.decodedStory}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Milestones Card */}
        {interaction.goalPlan && (
          <div ref={goalPlanRef} className="scroll-mt-4">
            <GoalPlannerView
              goalPlan={interaction.goalPlan}
              onUpdateGoalPlan={handleUpdateGoalPlan}
            />
          </div>
        )}

        {/* Structured Insights & Actions Summary */}
        {(interaction.summary ||
          (interaction.keyInsights && interaction.keyInsights.length > 0) ||
          (interaction.actionItems && interaction.actionItems.length > 0)) && (
          <StructuredSummaryView
            summary={interaction.summary}
            moodTag={interaction.moodTag}
            keyInsights={interaction.keyInsights}
            actionItems={interaction.actionItems}
            onToggleActionItem={handleToggleActionItem}
            onRefreshSummary={handleGenerateSummary}
            isSummarizing={isSummarizing}
            reflectionTitle={interaction.title}
          />
        )}

        {/* Starter Prompts or Message Thread */}
        {interaction.messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-6 sm:py-8 text-center space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-xl sm:text-3xl font-bold text-slate-900 font-serif tracking-tight">
                It&apos;s okay to take a break.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-md mx-auto leading-relaxed">
                Reflect by voice or text in your private haven. Let your thoughts unfold naturally.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-1">
              {STARTER_PROMPTS.map((starter, idx) => (
                <div
                  key={idx}
                  id={`starter-card-${idx}`}
                  onClick={() => {
                    setInputText(starter.prompt + " ");
                    handleModeChange(starter.mode);
                    textareaRef.current?.focus();
                  }}
                  className="p-3.5 rounded-2xl sm:rounded-3xl bg-white/70 backdrop-blur-xl border border-white hover:border-cyan-400 hover:bg-white/95 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-cyan-800 transition-colors">
                      {starter.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed font-normal">
                    {starter.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-2">
            {interaction.messages.map((msg) => {
              const isUser = msg.role === "user";
              const isCopied = copiedMessageId === msg.id;
              const isCurrentlyPlaying = isSpeaking && speakingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  id={`msg-card-${msg.id}`}
                  className={`flex items-start gap-2.5 sm:gap-4 w-full ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-2xl bg-cyan-100 border border-cyan-300 text-cyan-800 flex items-center justify-center shrink-0 shadow-xs mt-1">
                      <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] sm:max-w-[75%] rounded-3xl p-3.5 sm:p-5 text-xs sm:text-sm leading-relaxed relative group shadow-sm ${
                      isUser
                        ? "bg-cyan-700 text-white rounded-tr-none shadow-md shadow-cyan-700/20"
                        : "bg-white/85 border border-sky-200/80 text-slate-800 rounded-tl-none backdrop-blur-md"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 opacity-80 text-[10px]">
                      <span className="font-semibold">{isUser ? "You" : "Unfold"}</span>
                      <div className="flex items-center gap-1.5">
                        {msg.modelUsed && !isUser && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200">
                            {msg.modelUsed}
                          </span>
                        )}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-xs max-w-none text-slate-800">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}

                    {/* Quick Jump to Proposed Plan */}
                    {!isUser && interaction.goalPlan && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            goalPlanRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-900 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-cyan-700" />
                          <span>View Proposed Plan</span>
                        </button>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center gap-2">
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleSpeakText(msg.id, msg.content)}
                          className={`flex items-center gap-1 text-[10px] sm:text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-medium ${
                            isCurrentlyPlaying
                              ? "bg-amber-100 border-amber-300 text-amber-900"
                              : "bg-white border-slate-200 text-slate-700 hover:text-cyan-800 hover:border-cyan-300"
                          }`}
                          title={isCurrentlyPlaying ? "Stop Audio Playback" : "Listen to response"}
                        >
                          {isCurrentlyPlaying ? (
                            <VolumeX className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span>{isCurrentlyPlaying ? "Stop Audio" : "Play Voice"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className={`p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer ${
                          isCopied
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
                        }`}
                        title="Copy text"
                      >
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-2xl bg-cyan-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                      <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isGenerating && (
              <div className="flex items-start gap-2.5 sm:gap-4 justify-start w-full">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-2xl bg-cyan-100 border border-cyan-300 text-cyan-800 flex items-center justify-center shrink-0 animate-pulse shadow-xs mt-1">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="bg-white/85 border border-sky-200/80 backdrop-blur-xl rounded-3xl rounded-tl-none p-3.5 text-xs text-slate-600 space-y-1.5 max-w-[75%] shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-cyan-600 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-cyan-600 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-cyan-600 animate-bounce [animation-delay:0.4s]" />
                    <span className="text-[11px] text-cyan-800 font-medium ml-1">
                      Unfold reflecting...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {generationError && (
        <div
          id="generation-error-toast"
          className="mx-3 mb-1.5 p-2.5 rounded-2xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center justify-between gap-2 shrink-0 shadow-sm"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate">{generationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGenerationError(null)}
            className="text-rose-700 hover:text-rose-900 font-semibold text-xs cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Prototype Notice Strip */}
      <div className="px-3 py-1 text-center bg-white/40 border-t border-sky-100 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] text-slate-500 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span className="truncate">
          <strong>Prototype:</strong> Max 20 turns/session to protect quota.
        </span>
      </div>

      {/* Pinned Bottom Input Bar */}
      <div className="p-2.5 sm:p-4 bg-white/80 backdrop-blur-2xl border-t border-sky-200/80 shrink-0 shadow-lg z-20">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          {/* Desktop Web Speech API Dictation */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`hidden sm:inline-flex items-center justify-center p-2.5 sm:p-3.5 rounded-2xl border transition-all cursor-pointer shrink-0 ${
              isRecording
                ? "bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-500/20"
                : "bg-white border-sky-200 text-cyan-800 hover:bg-cyan-50"
            }`}
            title={isRecording ? "Stop dictation" : "Dictate reflection by voice"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <div className="flex-1 bg-white/95 backdrop-blur-xl border border-sky-200 focus-within:border-cyan-600 focus-within:ring-1 focus-within:ring-cyan-500/30 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all shadow-xs flex flex-col">
            <textarea
              ref={textareaRef}
              id="input-reflection-message"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              placeholder={
                isRecording
                  ? "Listening to your voice..."
                  : "Type reflection... Press Enter"
              }
              className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none resize-none max-h-28 sm:max-h-36"
            />
          </div>

          <button
            id="btn-send-message"
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isGenerating}
            className="p-2.5 sm:p-3.5 rounded-2xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-medium shadow-md shadow-cyan-700/20 border border-cyan-600 transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed transform active:scale-95"
            title="Send reflection"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Location Search Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 rounded-3xl border border-sky-200 shadow-2xl p-4 sm:p-5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-serif">
                <MapPin className="w-4 h-4 text-cyan-700" />
                <span>Tag Location</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(false);
                  setLocationQuery("");
                  setLocationResults([]);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs">
                <span className="text-slate-500 font-medium shrink-0">Country:</span>
                <select
                  value={selectedCountry}
                  onChange={handleCountryChange}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-none w-full cursor-pointer"
                >
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="MY">🇲🇾 Malaysia</option>
                  <option value="ID">🇮🇩 Indonesia</option>
                  <option value="TH">🇹🇭 Thailand</option>
                  <option value="VN">🇻🇳 Vietnam</option>
                  <option value="PH">🇵🇭 Philippines</option>
                  <option value="JP">🇯🇵 Japan</option>
                  <option value="KR">🇰🇷 South Korea</option>
                  <option value="TW">🇹🇼 Taiwan</option>
                  <option value="HK">🇭🇰 Hong Kong</option>
                  <option value="IN">🇮🇳 India</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="NZ">🇳🇿 New Zealand</option>
                  <option value="ALL">🌐 All Countries (Worldwide)</option>
                </select>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={handleSearchLocationInput}
                  placeholder="e.g. Marina Bay, Shibuya..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:border-cyan-600"
                />
              </div>

              <p className="text-[10px] text-slate-500 italic px-1">
                🌏 <strong>APAC Edition:</strong> Preset for Asia-Pacific countries and venues.
              </p>
            </div>

            <div className="mt-3 max-h-52 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
              {isSearchingLocation ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                  <div className="w-3 h-3 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                  <span>Searching places...</span>
                </div>
              ) : locationResults.length > 0 ? (
                locationResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectLocation(item)}
                    className="w-full text-left py-2 px-2.5 text-xs text-slate-700 hover:bg-cyan-50 hover:text-cyan-900 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="truncate font-medium">{item.name}</span>
                  </button>
                ))
              ) : locationQuery.length >= 2 ? (
                <p className="text-xs text-center py-4 text-slate-400">No places found</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};