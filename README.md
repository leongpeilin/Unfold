# Unfold — AI Reflection, Personal Growth & Mindful Planning

**Unfold** is a personal growth and cognitive journaling web application powered by **Google Gemini API** and **Google Cloud Firestore**. It provides a safe space for voice or text reflection, transforms sessions into interactive **Emoji Summary** visual narratives, tracks scheduled milestones linked directly to Google Calendar, and uncovers past reflections using semantic vector search.

* **Live Cloud Run App:** `https://reflectai-journal-reflection-assistant-449515877581.asia-southeast1.run.app`
* **AI Studio Custom Domain:** `https://unfold.ai.studio`
* **Target Region:** APAC (`asia-southeast1`)
* **Cloud Run Challenge Label:** `dev-tutorial=cloud-run-ai-challenge`

Recommended Browser: Google Chrome or Chromium-based browsers on desktop for optimal Web Speech dictation and native Google Auth popup performance.

## 🌟 Key Features Beyond the Baseline

* **✨ Emoji Summary Visual Journey**: Transforms multi-turn reflection transcripts into an emoji narrative capturing emotional progression, with a one-click toggle to decode psychological meaning.
* **🌏 APAC-Focused Location Tagging**: Integrated place picker with country-level presets customized for Asia-Pacific regions (Singapore, Malaysia, Indonesia, Thailand, Japan, South Korea, etc.) alongside global fallback search.
* **🎙️ Voice Dictation & Neural Speech**: Real-time microphone dictation via the Web Speech API tailored for desktop browsers, paired with cross-platform neural speech playback (Coastal Breeze / Ocean Horizon) and auto-voice synthesis. (Note: Dictation input is progressively hidden on mobile viewports to prevent iOS WebKit speech-engine audio-session collisions, while neural audio playback remains fully active across all mobile and desktop devices).
* **🎯 Actionable Milestones & Google Calendar Sync**: Automatically identifies commitments from reflection conversations, generating milestones with 1-click Google Calendar deep links.
* **🔍 Semantic Vector Concept Search**: Uses Gemini embeddings (`text-embedding-004`) to compute cosine similarities across past entries, enabling conceptual discovery beyond keyword matching.

---

## 🛡️ Security Architecture & Threat Model

| Threat Zone | Identified Risk | Countermeasure & Implementation |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection payloads, oversized requests, runaway API costs. | Express top-level payload deserialization capped at 10MB; 20-turn session limits to prevent quota exhaustion. |
| **Planning & Reasoning** | Prompt hijacking, conversational transcript leakage. | Explicit system instruction boundaries treating history as raw data; strict JSON schema enforcement for structured synthesis and emoji extraction. |
| **Server / Key Security** | Gemini API key exposure in client network requests. | Zero client-side API key exposure. All AI requests proxy server-side via `server.ts` with credentials retrieved from environment variables or Google Cloud Secret Manager. |
| **Memory & State (Firestore)** | Unauthorized cross-user data access, runtime write crashes. | Owner-bound Firestore security rules (`request.auth.uid == userId`) enforcing tenant boundary isolation; payload sanitizer stripping `undefined` fields before mutations. |
| **Authentication** | Credential theft, phishing, password database compromise. | Google Federated OAuth via Firebase Authentication; zero password storage or handling in application codebase. |

---

## 🔒 Firestore Security Rules

To enforce user tenant isolation, the following security rules are configured in Cloud Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{allPaths=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}