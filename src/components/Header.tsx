import React from "react";
import { User } from "firebase/auth";
import { Plus, LogOut, User as UserIcon, Volume2, Radio, BookOpen, ArrowLeft } from "lucide-react";
import { VoicePersona } from "../types";

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
  onNewEntry: () => void;
  onOpenSecurityModal: () => void;
  entriesCount: number;
  voicePersona: VoicePersona;
  onVoicePersonaChange: (persona: VoicePersona) => void;
  autoPlayVoice: boolean;
  onToggleAutoPlayVoice: () => void;
  onToggleMobileView?: () => void;
  mobileView?: "list" | "editor";
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onSignOut,
  onNewEntry,
  entriesCount,
  voicePersona,
  onVoicePersonaChange,
  autoPlayVoice,
  onToggleAutoPlayVoice,
  onToggleMobileView,
  mobileView = "editor",
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-sky-200/70 text-slate-800 px-3 sm:px-6 py-2.5 shadow-xs w-full shrink-0"
    >
      <div className="w-full flex items-center justify-between gap-2">
        {/* Left: Brand + Mobile History Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          {user && onToggleMobileView && (
            <button
              type="button"
              onClick={onToggleMobileView}
              className="md:hidden flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 text-xs font-medium cursor-pointer shrink-0"
              title={mobileView === "editor" ? "View all reflections" : "Return to editor"}
            >
              {mobileView === "editor" ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-cyan-700" />
                  <span>History ({entriesCount})</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Editor</span>
                </>
              )}
            </button>
          )}

          <h1 className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 font-serif leading-tight truncate">
            Unfold
          </h1>
        </div>

        {/* Right: Audio Settings & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {user && (
            <>
              {/* Voice Persona Dropdown */}
              <div className="flex items-center gap-1 bg-white/80 border border-sky-200 px-2 py-1 rounded-xl text-xs shadow-xs">
                <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-700 shrink-0" />
                <select
                  value={voicePersona}
                  onChange={(e) => onVoicePersonaChange(e.target.value as VoicePersona)}
                  className="bg-transparent text-slate-800 focus:outline-none text-[10px] sm:text-xs cursor-pointer font-medium max-w-[85px] xs:max-w-[120px] sm:max-w-none truncate"
                  title="Select AI Voice"
                >
                  <option value="Female">Coastal (F)</option>
                  <option value="Male">Ocean (M)</option>
                </select>
              </div>

              {/* Auto Voice Toggle */}
              <button
                type="button"
                onClick={onToggleAutoPlayVoice}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] sm:text-xs font-medium transition-all cursor-pointer shrink-0 ${
                  autoPlayVoice
                    ? "bg-cyan-700 border-cyan-800 text-white shadow-xs"
                    : "bg-white/80 border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title={autoPlayVoice ? "Auto-play: ON" : "Auto-play: OFF"}
              >
                <Radio className={`w-3 h-3 ${autoPlayVoice ? "animate-pulse" : ""}`} />
                <span>{autoPlayVoice ? "ON" : "OFF"}</span>
              </button>

              {/* New Reflection Button */}
              <button
                id="btn-new-entry-header"
                type="button"
                onClick={onNewEntry}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs sm:text-sm font-medium shadow-md shadow-cyan-700/20 border border-cyan-600 transition-all cursor-pointer shrink-0"
                title="Create New Reflection"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New</span>
              </button>

              {/* User Avatar & Logout */}
              <div className="flex items-center gap-1 bg-white/70 border border-slate-200 backdrop-blur-md rounded-xl py-0.5 px-1 sm:px-2 shadow-xs shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full ring-1 ring-cyan-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-800 text-[10px] font-bold">
                    {user.displayName?.[0] || "U"}
                  </div>
                )}
                <button
                  id="btn-signout"
                  type="button"
                  onClick={onSignOut}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};