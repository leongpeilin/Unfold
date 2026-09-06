import React from "react";
import { X, ShieldCheck, Lock, Key, Database, CheckCircle2 } from "lucide-react";

interface SecurityNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const SecurityNoticeModal: React.FC<SecurityNoticeModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="security-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="security-modal-content"
        className="bg-slate-950/85 backdrop-blur-2xl border border-white/15 rounded-3xl max-w-2xl w-full p-6 text-slate-200 space-y-5 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="btn-close-security-modal"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md flex items-center justify-center text-emerald-400 shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white drop-shadow-sm">
              Security Architecture &amp; User Isolation
            </h3>
            <p className="text-xs text-slate-400">
              OWASP-aligned Firestore &amp; AI API Security Enforcement
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* User isolation block */}
          <div className="p-4 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Database className="w-4 h-4" />
              <span>Owner-Bound Firestore Rules Path</span>
            </div>
            <p className="text-slate-300">
              All journal entries are strictly partitioned under your authenticated Firebase UID:
            </p>
            <div className="bg-black/40 p-2.5 rounded-xl font-mono text-[11px] text-emerald-300 break-all border border-white/10">
              /databases/(default)/documents/users/{userId}/interactions/*
            </div>
          </div>

          {/* Rules definition */}
          <div className="p-4 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <Lock className="w-4 h-4" />
              <span>Active Deployed Rules (firestore.rules)</span>
            </div>
            <pre className="bg-black/40 p-3 rounded-xl font-mono text-[10px] text-slate-300 overflow-x-auto border border-white/10">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}`}
            </pre>
          </div>

          {/* Zero Password Storage & API Security */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-1 shadow-md">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Password Handling</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Google Federated OAuth provider handles credentials. No cleartext or hashed passwords touch our servers.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-1 shadow-md">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Key className="w-3.5 h-3.5 text-indigo-300" />
                <span>Server-Side Gemini API Proxy</span>
              </div>
              <p className="text-[11px] text-slate-400">
                AI keys are kept in server environment/Secret Manager, never exposed to browser client runtime.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            id="btn-dismiss-security-modal"
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 backdrop-blur-md transition-all cursor-pointer"
          >
            Close Security Summary
          </button>
        </div>
      </div>
    </div>
  );
};
