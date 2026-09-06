import React from "react";
import { Mic, Target, MapPin, Lock, Sparkles } from "lucide-react";

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isLoading,
  error,
}) => {
  return (
    <div
      id="landing-page"
      className="flex-1 flex flex-col justify-between items-center text-slate-800 relative w-full"
    >
      {/* Centered Hero Section */}
      <div className="flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center w-full z-10">

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 font-serif max-w-3xl leading-tight">
          Unwind Your Thoughts &amp; Achieve Big Goals
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
          A personal haven for your mind. Reflect via voice or text, break down ambitious goals into scheduled Google Calendar milestones, and explore your reflections through semantic memory.
        </p>

        {/* Error Banner */}
        {error && (
          <div
            id="auth-error-banner"
            className="mt-6 p-4 rounded-2xl bg-rose-100 border border-rose-300 backdrop-blur-xl text-rose-800 text-sm max-w-md text-left flex items-start gap-3 shadow-sm mx-auto"
          >
            <div className="p-1 bg-rose-200 text-rose-900 rounded-lg font-bold text-xs">!</div>
            <div>
              <p className="font-semibold">Authentication Notice</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Google Sign In CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
          <button
            id="btn-google-signin"
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-60 text-white font-semibold text-base shadow-lg shadow-cyan-700/25 border border-cyan-600 transition-all cursor-pointer transform active:scale-98"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#FFFFFF"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#FFFFFF"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FFFFFF"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#FFFFFF"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoading ? "Signing In..." : "Sign in with Google"}</span>
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 text-left w-full">
          <div className="p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white hover:border-cyan-300 shadow-sm transition-all">
            <div className="w-11 h-11 rounded-2xl bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800 mb-4 shadow-xs">
              <Mic className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900 text-base font-serif">Voice Dictation &amp; Audio</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Dictate hands-free and listen to your reflections with clear, natural synthesized voices.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white hover:border-cyan-300 shadow-sm transition-all">
            <div className="w-11 h-11 rounded-2xl bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800 mb-4 shadow-xs">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900 text-base font-serif">Goal Milestones</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Automatically break down goals into structured steps synced directly to Google Calendar.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white hover:border-cyan-300 shadow-sm transition-all">
            <div className="w-11 h-11 rounded-2xl bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800 mb-4 shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900 text-base font-serif">Location &amp; Semantic Search</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Tag favorite reflection places and rediscover past entries conceptually using vector search.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-sky-200/70 py-4 text-center text-xs text-slate-500 bg-white/40 backdrop-blur-md shrink-0">
        <p>Unfold &bull; Last updated Aug 2026</p>
      </footer>
    </div>
  );
};