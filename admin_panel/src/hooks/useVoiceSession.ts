import { useCallback, useEffect, useState } from "react";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

// Mocked pipeline timings — stand-ins for STT + agent + TTS latency.
const THINKING_MS = 1400;
const SPEAKING_MS = 3200;

// Canned turn so the prototype feels real without a live audio pipeline.
const MOCK_TRANSCRIPT = "What can this voice agent do?";
const MOCK_RESPONSE =
  "I can listen, transcribe, and reply out loud. This is a UI prototype, so the audio pipeline is mocked for now.";

type VoiceSession = {
  state: VoiceState;
  transcript: string;
  response: string;
  isBusy: boolean;
  /** Tap-to-talk: idle → listening → thinking; ignored while busy. */
  onMicTap: () => void;
};

/**
 * Front-end-only voice session (V3). Drives the orb through
 * idle → listening → thinking → speaking → idle. The user controls the first
 * two transitions by tapping the mic; thinking/speaking auto-advance on timers
 * (cleared on unmount or state change). No real audio is processed.
 */
export function useVoiceSession(): VoiceSession {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (state === "thinking") {
      const timer = setTimeout(() => {
        setResponse(MOCK_RESPONSE);
        setState("speaking");
      }, THINKING_MS);
      return () => clearTimeout(timer);
    }
    if (state === "speaking") {
      const timer = setTimeout(() => setState("idle"), SPEAKING_MS);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const onMicTap = useCallback(() => {
    if (state === "idle") {
      setTranscript("");
      setResponse("");
      setState("listening");
    } else if (state === "listening") {
      setTranscript(MOCK_TRANSCRIPT);
      setState("thinking");
    }
    // thinking / speaking are busy — taps are a no-op
  }, [state]);

  const isBusy = state === "thinking" || state === "speaking";

  return { state, transcript, response, isBusy, onMicTap };
}
