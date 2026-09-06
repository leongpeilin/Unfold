import { VoicePersona } from "../types";

const FEMALE_NAMES = [
  "Samantha",
  "Victoria",
  "Karen",
  "Google US English",
  "Microsoft Jenny Online",
  "Microsoft Zira",
  "Moira",
  "Tessa",
  "Fiona",
];

const MALE_NAMES = [
  "Alex",
  "Daniel",
  "Oliver",
  "Fred",
  "Microsoft Guy Online",
  "Microsoft David",
  "Google UK English Male",
];

export function resolveBestVoice(
  persona: VoicePersona,
  availableVoices: SpeechSynthesisVoice[]
): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } {
  const enVoices = availableVoices.filter((v) => v.lang.startsWith("en"));
  const pool = enVoices.length > 0 ? enVoices : availableVoices;

  if (pool.length === 0) {
    return {
      voice: null,
      pitch: persona === "Female" ? 1.05 : 0.85,
      rate: persona === "Female" ? 0.98 : 0.92,
    };
  }

  if (persona === "Female") {
    // 1. Preferred female voice names
    const match = pool.find((v) =>
      FEMALE_NAMES.some((name) => v.name.toLowerCase().includes(name.toLowerCase()))
    );
    if (match) return { voice: match, pitch: 1.02, rate: 0.98 };

    // 2. Gender heuristic fallback
    const heuristicMatch = pool.find(
      (v) =>
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("woman") ||
        (!v.name.toLowerCase().includes("male") && !v.name.toLowerCase().includes("david") && !v.name.toLowerCase().includes("alex"))
    );
    return {
      voice: heuristicMatch || pool[0],
      pitch: 1.05,
      rate: 0.98,
    };
  }

  // Male Persona
  const maleMatch = pool.find((v) =>
    MALE_NAMES.some((name) => v.name.toLowerCase().includes(name.toLowerCase()))
  );
  if (maleMatch) return { voice: maleMatch, pitch: 0.85, rate: 0.92 };

  const heuristicMale = pool.find(
    (v) =>
      v.name.toLowerCase().includes("male") ||
      v.name.toLowerCase().includes("man") ||
      v.name.toLowerCase().includes("david") ||
      v.name.toLowerCase().includes("alex")
  );
  return {
    voice: heuristicMale || pool[0],
    pitch: 0.82,
    rate: 0.92,
  };
}