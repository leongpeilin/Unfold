import React, { useState, useMemo, useEffect } from "react";
import { UserInteraction } from "../types";
import { cosineSimilarity } from "../lib/integrations";
import { generateTextEmbedding } from "../lib/geminiApi";
import {
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Trash2,
  MessageSquare,
  Sparkle,
  MapPin,
  X,
} from "lucide-react";

interface SidebarHistoryProps {
  interactions: UserInteraction[];
  selectedId: string | null;
  onSelect: (interaction: UserInteraction) => void;
  onDelete: (id: string) => void;
  onNewEntry: () => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  interactions,
  selectedId,
  onSelect,
  onDelete,
  onNewEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const [isEmbedding, setIsEmbedding] = useState(false);

  // Fetch query vector when semantic search is active
  useEffect(() => {
    if (!useSemanticSearch || !searchTerm.trim() || searchTerm.trim().length < 2) {
      setQueryEmbedding(null);
      setIsEmbedding(false);
      return;
    }

    let isCancelled = false;
    setIsEmbedding(true);

    const timer = setTimeout(async () => {
      try {
        const vec = await generateTextEmbedding(searchTerm.trim());
        if (!isCancelled) {
          setQueryEmbedding(vec && vec.length > 0 ? vec : null);
        }
      } catch (err) {
        console.error("Semantic query embedding failed:", err);
        if (!isCancelled) setQueryEmbedding(null);
      } finally {
        if (!isCancelled) setIsEmbedding(false);
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, useSemanticSearch]);

 const filteredInteractions = useMemo(() => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return [...interactions].sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    );
  }

  // --- BRANCH A: SEMANTIC VECTOR SEARCH ---
  if (useSemanticSearch) {
    if (!queryEmbedding) return [];

    return interactions
      .map((item) => {
        const hasVec = Array.isArray(item.embedding) && item.embedding.length > 0;
        const score = hasVec ? cosineSimilarity(queryEmbedding, item.embedding!) : 0;
        return { item, score };
      })
      // 0.55 - 0.58 separates distinct emotional polarities in 768-dim embeddings
      .filter(({ score }) => score >= 0.55)
      .sort((a, b) => b.score - a.score)
      // Surface only the closest contextual matches
      .slice(0, 5)
      .map(({ item, score }) => ({
        ...item,
        _similarityScore: Math.round(score * 100),
      }));
  }

  // --- BRANCH B: KEYWORD SEARCH ---
  return interactions
    .filter((item) => {
      const titleMatch = (item.title || "").toLowerCase().includes(query);
      const summaryMatch = (item.summary || "").toLowerCase().includes(query);
      const moodMatch = (item.moodTag || "").toLowerCase().includes(query);
      const locationMatch = (item.location?.name || "").toLowerCase().includes(query);
      const goalMatch = (item.goalPlan?.goalTitle || "").toLowerCase().includes(query);
      const emojiMatch = (item.emojiSequence || "").includes(query);
      const insightsMatch =
        Array.isArray(item.keyInsights) &&
        item.keyInsights.some((ins) => ins.toLowerCase().includes(query));
      const messagesMatch =
        Array.isArray(item.messages) &&
        item.messages.some((m) => (m.content || "").toLowerCase().includes(query));

      return (
        titleMatch ||
        summaryMatch ||
        moodMatch ||
        locationMatch ||
        goalMatch ||
        emojiMatch ||
        insightsMatch ||
        messagesMatch
      );
    })
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}, [interactions, searchTerm, useSemanticSearch, queryEmbedding]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return `${date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })} • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <aside
      id="sidebar-history"
      className="w-full md:w-80 lg:w-96 flex flex-col bg-white/50 backdrop-blur-2xl border-r border-sky-200/70 shrink-0 h-[calc(100vh-61px)] shadow-xs overflow-hidden"
    >
      {/* Search Bar Header */}
      <div className="h-[77px] px-3.5 border-b border-sky-200/70 space-y-2 bg-white/40 flex flex-col justify-center shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-cyan-700 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-history-search"
            type="text"
            placeholder={
              useSemanticSearch
                ? "Search by concept (e.g. mental health, stamina)..."
                : "Search reflections & insights..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-2xl bg-white/80 border border-sky-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-500/20 shadow-xs transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isEmbedding && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] px-1">
          <button
            type="button"
            onClick={() => setUseSemanticSearch(!useSemanticSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl transition-all border cursor-pointer font-medium ${
              useSemanticSearch
                ? "bg-cyan-100 border-cyan-300 text-cyan-900 shadow-xs"
                : "bg-white/60 border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkle className="w-3 h-3 text-cyan-700" />
            <span>Semantic Search: {useSemanticSearch ? "ON" : "OFF"}</span>
          </button>
          <span className="text-[10px] text-slate-500">
            {filteredInteractions.length} {filteredInteractions.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredInteractions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <BookOpen className="w-8 h-8 text-cyan-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-semibold text-slate-700">
              {searchTerm ? "No matching reflections" : "No saved reflections yet"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {useSemanticSearch
                ? "No entries matched this concept. Try typing a new reflection first so embeddings are generated."
                : "Start writing in the canvas to begin your reflection."}
            </p>
            {!searchTerm && (
              <button
                id="btn-sidebar-new-first"
                type="button"
                onClick={onNewEntry}
                className="mt-3 px-3.5 py-1.5 text-xs rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-medium transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Begin First Reflection</span>
              </button>
            )}
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isSelected = item.id === selectedId;
            const isDeleting = deletingId === item.id;
            return (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                onClick={() => onSelect(item)}
                className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? "bg-white/95 border-cyan-500 shadow-md ring-1 ring-cyan-400"
                    : "bg-white/60 border-white/80 hover:bg-white/90 hover:border-cyan-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 truncate min-w-0 flex-1">
                    {item.title || "Untitled Reflection"}
                  </h3>
                  <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(item.updatedAt || item.createdAt)}
                  </span>
                </div>

                {item.emojiSequence && (
                  <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs shadow-2xs w-fit max-w-full">
                    <span className="truncate tracking-widest text-[13px]">{item.emojiSequence}</span>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[10px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-slate-500">
                      <MessageSquare className="w-3 h-3" />
                      {item.messages ? item.messages.length : 0}
                    </span>
                    {item.location && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-100 border border-cyan-200 text-cyan-800 text-[10px] truncate max-w-[100px]">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{item.location.name.split(" ")[0]}</span>
                      </span>
                    )}
                    {item.moodTag && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-200 text-amber-900 text-[10px] truncate max-w-[100px]">
                        {item.moodTag}
                      </span>
                    )}
                    {item.goalPlan && (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-100 border border-cyan-200 text-cyan-800 text-[10px]">
                        {item.goalPlan.milestones.filter((m) => m.done).length}/
                        {item.goalPlan.milestones.length} Goals
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    {isDeleting ? (
                      <div
                        className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-rose-300 text-[10px] shadow-sm z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        <span className="text-rose-700">Delete?</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDelete(item.id);
                            setDeletingId(null);
                          }}
                          className="text-rose-600 font-bold hover:underline px-1 cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeletingId(null);
                          }}
                          className="text-slate-500 hover:text-slate-800 px-1 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDeletingId(item.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Delete reflection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};