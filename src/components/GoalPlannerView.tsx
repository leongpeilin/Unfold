import React, { useState } from "react";
import { AgenticGoalPlan } from "../types";
import { createGoalMilestoneCalendarUrl } from "../lib/integrations";
import {
  Target,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface GoalPlannerViewProps {
  goalPlan: AgenticGoalPlan;
  onUpdateGoalPlan: (updatedPlan: AgenticGoalPlan) => void;
}

export const GoalPlannerView: React.FC<GoalPlannerViewProps> = ({
  goalPlan,
  onUpdateGoalPlan,
}) => {
  const [isNoteExpanded, setIsNoteExpanded] = useState(true);

  if (!goalPlan || !goalPlan.milestones || goalPlan.milestones.length === 0) {
    return null;
  }

  const handleToggleMilestone = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    const updatedMilestones = [...goalPlan.milestones];
    updatedMilestones[index] = {
      ...updatedMilestones[index],
      done: !updatedMilestones[index].done,
    };
    onUpdateGoalPlan({
      ...goalPlan,
      milestones: updatedMilestones,
    });
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white/80 backdrop-blur-2xl border border-sky-200 shadow-sm space-y-4 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-100 border border-cyan-300 text-cyan-800 shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 font-serif">
              Scheduled Milestones
            </h4>
            <p className="text-[11px] text-slate-500">
              Auto-detected from conversation &bull; Ready for Google Calendar
            </p>
          </div>
        </div>

        {goalPlan.targetTimeline && (
          <div className="flex items-center gap-1.5 text-xs text-cyan-900 bg-cyan-50 px-2.5 py-1 rounded-xl border border-cyan-200 font-medium shadow-xs self-start sm:self-center">
            <Clock className="w-3.5 h-3.5 text-cyan-700" />
            <span>{goalPlan.targetTimeline}</span>
          </div>
        )}
      </div>

      {/* Horizontal Prototype Notice Banner */}
      <div className="w-full bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Prototype Note: 1-Click Calendar Links</span>
          </div>
          <button
            type="button"
            onClick={() => setIsNoteExpanded(!isNoteExpanded)}
            className="text-amber-800 hover:text-amber-950 p-0.5 rounded-lg transition-colors cursor-pointer"
            title={isNoteExpanded ? "Collapse note" : "Expand note"}
          >
            {isNoteExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {isNoteExpanded && (
          <p className="text-[11px] text-amber-900/85 mt-1.5 leading-relaxed font-normal">
            This prototype opens pre-filled Google Calendar tabs via deep links. Full background auto-sync without opening tabs will be enabled once Unfold completes official Google OAuth App Verification.
          </p>
        )}
      </div>

      {/* Goal Title & Milestones */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="text-cyan-900 font-serif font-bold text-sm">
            Goal: {goalPlan.goalTitle}
          </span>
          <span className="text-[11px] text-slate-500">
            {goalPlan.milestones.filter((m) => m.done).length}/{goalPlan.milestones.length} Completed
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {goalPlan.milestones.map((milestone, idx) => (
            <div
              key={milestone.id || idx}
              className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                milestone.done
                  ? "bg-slate-100 border-slate-200 text-slate-400"
                  : "bg-white border-sky-200/80 text-slate-800 hover:border-cyan-300"
              }`}
            >
              {/* Checkbox and Step Title */}
              <div
                onClick={(e) => handleToggleMilestone(e, idx)}
                className="flex items-start gap-3 cursor-pointer flex-1"
              >
                <button
                  type="button"
                  onClick={(e) => handleToggleMilestone(e, idx)}
                  className="mt-0.5 text-cyan-700 hover:text-cyan-800 cursor-pointer"
                >
                  {milestone.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-cyan-600/60" />
                  )}
                </button>
                <div>
                  <h5
                    className={`text-xs font-semibold ${
                      milestone.done ? "line-through text-slate-400" : "text-slate-900"
                    }`}
                  >
                    {milestone.stepTitle}
                  </h5>
                  {milestone.details && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {milestone.details}
                    </p>
                  )}
                </div>
              </div>

              {/* Target Date & Deep Link Button */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {milestone.suggestedDate && (
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800">
                    {milestone.suggestedDate}
                  </span>
                )}
                <a
                  href={createGoalMilestoneCalendarUrl(
                    milestone.stepTitle,
                    milestone.suggestedDate,
                    milestone.details,
                    goalPlan.goalTitle
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-900 text-xs font-medium transition-all shadow-xs"
                  title="Add to Google Calendar"
                >
                  <Calendar className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Add to G-Cal</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};