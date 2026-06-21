import { useEffect, useState } from "react";
import { type ActionStep, ActionTrail } from "@/components/ActionTrail";
import { TypewriterCaption } from "@/components/TypewriterCaption";

const STEP_LABELS = [
  "Understanding your request",
  "Searching the knowledge base",
  "Drafting the agent",
  "Validating configuration",
];

const STEP_INTERVAL_MS = 950;

const FINAL_RESPONSE =
  "Done — I've drafted an HR Policy agent grounded in your handbook. It's saved as a draft and still needs to pass vetting before it can be published.";

/**
 * SILA components demo (S3): runs a mocked concierge turn so the typewriter
 * caption and the action trail can be seen working together. `activeIndex`
 * walks the trail (one step per tick); once every step is done the caption
 * types out the final response. Front-end only — no real concierge.
 */
export function SilaPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= STEP_LABELS.length) return; // all steps done
    const timer = setTimeout(() => setActiveIndex((i) => i + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const allDone = activeIndex >= STEP_LABELS.length;

  const steps: ActionStep[] = STEP_LABELS.map((label, index) => ({
    id: String(index),
    label,
    status:
      index < activeIndex ? "done" : index === activeIndex ? "running" : "pending",
  }));

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-neutral-900 text-xl tracking-tight">SILA</h1>
          <p className="text-neutral-400 text-xs">Concierge components — prototype</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveIndex(0)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
        >
          Replay
        </button>
      </div>

      {/* Concierge caption */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="mb-2 text-neutral-400 text-xs uppercase tracking-wide">SILA says</p>
        <TypewriterCaption
          // Empty until the trail finishes, then it types the response.
          text={allDone ? FINAL_RESPONSE : ""}
          className="min-h-[3rem] text-neutral-800 text-sm leading-relaxed"
        />
        {!allDone && <p className="text-neutral-400 text-sm">Working on it…</p>}
      </div>

      {/* Behind-the-scenes action trail */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="mb-3 text-neutral-400 text-xs uppercase tracking-wide">Behind the scenes</p>
        <ActionTrail steps={steps} />
      </div>
    </section>
  );
}
