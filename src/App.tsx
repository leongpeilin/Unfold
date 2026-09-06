/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  auth,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  User,
  subscribeUserInteractions,
  saveUserInteraction,
  deleteUserInteraction,
} from "./lib/firebase";
import { UserInteraction, SaveStatus, VoicePersona } from "./types";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { SidebarHistory } from "./components/SidebarHistory";
import { JournalEditor } from "./components/JournalEditor";
import { SecurityNoticeModal } from "./components/SecurityNoticeModal";
import { Sparkles, Loader2, BookOpen, ArrowLeft } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [activeInteraction, setActiveInteraction] = useState<UserInteraction | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);

  // Mobile View Toggle ('list' | 'editor')
  const [mobileView, setMobileView] = useState<"list" | "editor">("editor");

  // Global Voice Settings
  const [voicePersona, setVoicePersona] = useState<VoicePersona>("Female");
  const [autoPlayVoice, setAutoPlayVoice] = useState<boolean>(() => {
    return localStorage.getItem("unfold_autoplay_voice") === "true";
  });

  const handleToggleAutoPlayVoice = () => {
    const nextVal = !autoPlayVoice;
    setAutoPlayVoice(nextVal);
    localStorage.setItem("unfold_autoplay_voice", String(nextVal));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setInteractions([]);
        setActiveInteraction(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const createNewInteraction = useCallback(
    (userId: string): UserInteraction => {
      return {
        id: "entry-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        userId,
        title: "New Reflection",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        mode: "reflect",
        actionItems: [],
        keyInsights: [],
      };
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeUserInteractions(
      user.uid,
      (list) => {
        setInteractions(list);
        setActiveInteraction((prev) => {
          if (prev) {
            const found = list.find((item) => item.id === prev.id);
            if (found) return found;
          }
          if (list.length > 0) return list[0];
          return createNewInteraction(user.uid);
        });
      },
      (err) => {
        console.error("Firestore sync subscription error:", err);
      }
    );
    return () => unsubscribe();
  }, [user, createNewInteraction]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setAuthError(err?.message || "Failed to sign in with Google.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleNewEntry = () => {
    if (!user) return;
    const newEntry = createNewInteraction(user.uid);
    setActiveInteraction(newEntry);
    setMobileView("editor");
  };

  const handleSelectEntry = (item: UserInteraction) => {
    setActiveInteraction(item);
    setMobileView("editor");
  };

  const handleSaveToFirestore = async (interactionToSave: UserInteraction) => {
    if (!user) return;
    setSaveStatus("saving");
    setSaveErrorMessage(null);
    try {
      await saveUserInteraction(user.uid, interactionToSave);
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 3000);
    } catch (err: any) {
      console.error("Failed to save interaction to Firestore:", err);
      setSaveStatus("error");
      setSaveErrorMessage(err.message || "Failed to save to Firestore.");
      throw err;
    }
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!user) return;
    try {
      await deleteUserInteraction(user.uid, id);
      if (activeInteraction?.id === id) {
        const remaining = interactions.filter((item) => item.id !== id);
        if (remaining.length > 0) {
          setActiveInteraction(remaining[0]);
        } else {
          setActiveInteraction(createNewInteraction(user.uid));
        }
      }
    } catch (err) {
      console.error("Failed to delete interaction:", err);
    }
  };

  if (authLoading) {
    return (
      <div
        id="app-loading-screen"
        className="h-[100dvh] w-full bg-transparent flex flex-col items-center justify-center text-slate-800 p-4"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/20 flex items-center justify-center mb-5 shadow-2xl shadow-indigo-500/20 text-indigo-300 relative z-10">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2.5 text-xs font-medium text-slate-300 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md relative z-10 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Verifying secure authentication...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] w-full bg-transparent flex flex-col relative overflow-x-hidden text-slate-900">
        <Header
          user={null}
          onSignOut={() => {}}
          onNewEntry={() => {}}
          onOpenSecurityModal={() => {}}
          entriesCount={0}
          voicePersona={voicePersona}
          onVoicePersonaChange={setVoicePersona}
          autoPlayVoice={autoPlayVoice}
          onToggleAutoPlayVoice={handleToggleAutoPlayVoice}
          onToggleMobileView={() => {}}
          mobileView="editor"
        />
        <LandingPage onSignIn={handleSignIn} isLoading={signingIn} error={authError} />
      </div>
    );
  }

  return (
    <div id="app-dashboard" className="h-[100dvh] w-full flex flex-col overflow-hidden relative text-slate-900">
      <Header
        user={user}
        onSignOut={handleSignOut}
        onNewEntry={handleNewEntry}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        entriesCount={interactions.length}
        voicePersona={voicePersona}
        onVoicePersonaChange={setVoicePersona}
        autoPlayVoice={autoPlayVoice}
        onToggleAutoPlayVoice={handleToggleAutoPlayVoice}
        onToggleMobileView={() => setMobileView(mobileView === "editor" ? "list" : "editor")}
        mobileView={mobileView}
      />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left: History Sidebar */}
        <div className={`h-full ${mobileView === "list" ? "block w-full" : "hidden md:block"}`}>
          <SidebarHistory
            interactions={interactions}
            selectedId={activeInteraction?.id || null}
            onSelect={handleSelectEntry}
            onDelete={handleDeleteInteraction}
            onNewEntry={handleNewEntry}
          />
        </div>

        {/* Right: Active Reflection Canvas */}
        <div className={`flex-1 h-full min-h-0 ${mobileView === "editor" ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
          {activeInteraction ? (
            <JournalEditor
              key={activeInteraction.id}
              interaction={activeInteraction}
              onUpdateInteraction={(updated) => setActiveInteraction(updated)}
              onSaveToFirestore={handleSaveToFirestore}
              saveStatus={saveStatus}
              saveErrorMessage={saveErrorMessage}
              onRetrySave={() => {
                if (activeInteraction) handleSaveToFirestore(activeInteraction);
              }}
              voicePersona={voicePersona}
              autoPlayVoice={autoPlayVoice}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-black/20 backdrop-blur-md">
              Select an entry or start a new reflection.
            </div>
          )}
        </div>
      </div>

      <SecurityNoticeModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        userId={user.uid}
      />
    </div>
  );
}