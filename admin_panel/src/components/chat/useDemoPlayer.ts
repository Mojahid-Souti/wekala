import { DEMO_SCENARIOS, type DemoScenario } from "@/mock/demoScenarios";
import type { ChatMessage } from "@/types/api";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type DemoStatus = "idle" | "playing" | "paused" | "done";

type Params = {
  initialMessages: ChatMessage[];
  setIsTyping: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export type DemoPlayerApi = {
  pause: () => void;
  play: () => void;
  reset: () => void;
  selectScenario: (id: string) => void;
  selectedScenario: DemoScenario | null;
  status: DemoStatus;
  stepIndex: number;
};

function makeDemoMsgId(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useDemoPlayer({
  initialMessages,
  setIsTyping,
  setMessages,
}: Params): DemoPlayerApi {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);

  // Refs hold the synchronous "current" view of playback state so timer callbacks
  // never read stale snapshots from a render-time closure.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<DemoStatus>("idle");
  const stepIdxRef = useRef(0);
  const scenarioRef = useRef<DemoScenario | null>(null);

  // A ref to the scheduling function so recursive timer callbacks always invoke the
  // latest version even after re-renders (avoids the stale-closure trap in chains).
  const scheduleRef = useRef<(idx: number) => void>((_idx: number) => {});

  // Updated every render — safe because the body only reads refs and stable dispatchers.
  scheduleRef.current = (idx: number): void => {
    if (statusRef.current !== "playing") return;
    const scenario = scenarioRef.current;
    if (scenario === null) return;

    const step = scenario.steps[idx];
    if (step === undefined) {
      statusRef.current = "done";
      setStatus("done");
      setIsTyping(false);
      return;
    }

    // Show the typing indicator while the assistant "composes" its reply.
    if (step.role === "assistant") setIsTyping(true);

    timerRef.current = setTimeout(() => {
      if (statusRef.current !== "playing") return;

      setIsTyping(false);
      const msg: ChatMessage = {
        id: makeDemoMsgId(),
        role: step.role,
        content: step.content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);

      const next = idx + 1;
      stepIdxRef.current = next;
      setStepIndex(next);

      scheduleRef.current(next);
    }, step.delay);
  };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    statusRef.current = "idle";
    stepIdxRef.current = 0;
    setStatus("idle");
    setStepIndex(0);
    setIsTyping(false);
    setMessages(initialMessages);
    // Keep the selected scenario so the user can press Play again immediately.
  }, [clearTimer, initialMessages, setIsTyping, setMessages]);

  const play = useCallback(() => {
    if (statusRef.current === "playing" || statusRef.current === "done") return;
    if (scenarioRef.current === null) return;
    statusRef.current = "playing";
    setStatus("playing");
    scheduleRef.current(stepIdxRef.current);
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    clearTimer();
    statusRef.current = "paused";
    setIsTyping(false);
    setStatus("paused");
  }, [clearTimer, setIsTyping]);

  const selectScenario = useCallback(
    (id: string) => {
      if (statusRef.current === "playing") return;
      clearTimer();
      const scenario = DEMO_SCENARIOS.find((s) => s.id === id) ?? null;
      scenarioRef.current = scenario;
      statusRef.current = "idle";
      stepIdxRef.current = 0;
      setIsTyping(false);
      setMessages(initialMessages);
      setStepIndex(0);
      setStatus("idle");
      setSelectedId(id);
    },
    [clearTimer, initialMessages, setIsTyping, setMessages]
  );

  // Cancel any pending timer if the component unmounts mid-playback.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const selectedScenario = DEMO_SCENARIOS.find((s) => s.id === selectedId) ?? null;

  return { pause, play, reset, selectScenario, selectedScenario, status, stepIndex };
}
