import React from "react";
import { Sparkles, CheckSquare, Lightbulb, Tag, Calendar, RefreshCw } from "lucide-react";
import { createGoogleCalendarUrl } from "../lib/integrations";

interface StructuredSummaryViewProps {
  summary?: string;
  moodTag?: string;
  keyInsights?: string[];
  actionItems?: Array<{ text: string; done: boolean }>;
  onToggleActionItem: (index: number) => void;
  onRefreshSummary: () => void;
  isSummarizing: boolean;
  reflectionTitle?: string;
}

export const StructuredSummaryView: React.FC<StructuredSummaryViewProps> = ({
  summary,
  moodTag,
  keyInsights,
  actionItems,
  onToggleActionItem,
  onRefreshSummary,
  isSummarizing,
  reflectionTitle = "Reflection",
}) => {
  return (
    <div
      id="structured-summary-card"
      className="p-5 sm:p-6 rounded-3xl bg-white/80 backdrop-blur-2xl border border-sky-200 shadow-sm space-y-4 text-slate-800"
    >
      <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-100 border border-cyan-300 text-cyan-800 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 font-serif">
              Reflection Insights &amp; Takeaways
            </h4>
            <p className="text-[11px] text-slate-500">
              Extracted via Gemini Structured Synthesis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {moodTag && (
            <span
              id="summary-mood-badge"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 text-xs font-medium shadow-xs"
            >
              <Tag className="w-3 h-3 text-cyan-700" />
              <span>{moodTag}</span>
            </span>
          )}
          <button
            id="btn-refresh-summary"
            type="button"
            onClick={onRefreshSummary}
            disabled={isSummarizing}
            className="flex items-center gap-1 text-xs text-cyan-800 hover:text-cyan-950 font-medium px-2.5 py-1 rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-50 cursor-pointer"
            title="Re-analyze reflection transcript"
          >
            {isSummarizing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <span>Regenerate</span>
            )}
          </button>
        </div>
      </div>

      {/* Summary Paragraph */}
      {summary && (
        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-cyan-50/60 p-4 rounded-2xl border border-cyan-100">
          <p>{summary}</p>
        </div>
      )}

      {/* Grid: Key Insights & Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Key Insights */}
        {keyInsights && keyInsights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
              <span>Core Insights</span>
            </div>
            <ul className="space-y-1.5">
              {keyInsights.map((insight, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-700 flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span className="leading-snug">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items with Google Calendar Sync */}
        {actionItems && actionItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-700" />
                <span>Action Checklist</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {actionItems.filter((a) => a.done).length}/{actionItems.length} completed
              </span>
            </div>
            <div className="space-y-1.5">
              {actionItems.map((item, idx) => (
                <div
                  key={idx}
                  id={`action-item-${idx}`}
                  className={`text-xs flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all shadow-xs ${
                    item.done
                      ? "bg-slate-100 border-slate-200 text-slate-400"
                      : "bg-white border-sky-200/80 text-slate-800 hover:border-cyan-300"
                  }`}
                >
                  <div
                    onClick={() => onToggleActionItem(idx)}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-cyan-700 bg-white border-slate-300 focus:ring-cyan-600 pointer-events-none shrink-0"
                    />
                    <span className={`leading-snug truncate ${item.done ? "line-through text-slate-400" : ""}`}>
                      {item.text}
                    </span>
                  </div>
                  {/* Google Calendar Link */}
                  <a
                    href={createGoogleCalendarUrl(item.text, reflectionTitle)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-900 text-[10px] font-medium transition-all shadow-xs"
                    title="Add this action item to Google Calendar"
                  >
                    <Calendar className="w-3 h-3 text-cyan-700" />
                    <span>Add to G-Cal</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};