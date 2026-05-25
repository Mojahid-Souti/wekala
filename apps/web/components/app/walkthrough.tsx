"use client";

import { ROUTES } from "@/lib/constants";
import { useIsMac } from "@/lib/use-platform";
import { BarChart3, BookOpen, Building2, Search, Sparkles, Store } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wekala_onboarding_complete";

type Placement = "right" | "bottom" | "bottom-end" | "top" | "auto";

type Step =
  | {
      kind: "modal";
      id: string;
      title: string;
      body: string;
      icon?: React.ReactNode;
    }
  | {
      kind: "spotlight";
      id: string;
      target: string;
      title: string;
      body: string;
      icon: React.ReactNode;
      placement: Placement;
    };

function buildSteps(isMac: boolean): Step[] {
  return [
    {
      kind: "modal",
      id: "welcome",
      title: "Welcome to Wekala",
      body: "Let's take 60 seconds to show you around. You can skip anytime.",
      icon: <Sparkles className="size-4" />,
    },
    {
      kind: "spotlight",
      id: "workspace",
      target: '[data-tour="workspace"]',
      title: "Workspaces",
      body: "A workspace is your team's container for agents, knowledge bases, tools, and members. We've already created one for you — switch between workspaces from here.",
      icon: <Building2 className="size-4" />,
      placement: "right",
    },
    {
      kind: "spotlight",
      id: "agents",
      target: '[data-tour="quick-agent"]',
      title: "Build your own agents",
      body: "Agents are the AI assistants your team builds and runs. Start from a template, import a YAML, or chat to build one — each lives inside a workspace and can use tools and knowledge bases.",
      icon: <Sparkles className="size-4" />,
      placement: "bottom",
    },
    {
      kind: "spotlight",
      id: "bazaar",
      target: '[data-tour="quick-bazaar"]',
      title: "Discover from the Bazaar",
      body: "Browse pre-vetted agents your team can hire in one click. Every agent on Wekala has passed PII and security checks before being published.",
      icon: <Store className="size-4" />,
      placement: "bottom",
    },
    {
      kind: "spotlight",
      id: "knowledge-base",
      target: '[data-tour="quick-kb"]',
      title: "Ground agents in your docs",
      body: "Upload PDFs, manuals, and FAQs to a knowledge base. Your agents cite them in answers, so responses stay grounded in your team's truth.",
      icon: <BookOpen className="size-4" />,
      placement: "bottom-end",
    },
    {
      kind: "spotlight",
      id: "dashboard",
      target: '[data-tour="dashboard"]',
      title: "See your impact",
      body: "The Dashboard shows your team's impact in real time: invocations, hours saved, success rate, and security anomalies — all per workspace.",
      icon: <BarChart3 className="size-4" />,
      placement: "right",
    },
    {
      kind: "spotlight",
      id: "search",
      target: '[data-tour="search"]',
      title: "Quick search",
      body: `Press ${isMac ? "⌘ K" : "Ctrl + K"} anywhere to search agents, workspaces, or jump to any page instantly.`,
      icon: <Search className="size-4" />,
      placement: "bottom-end",
    },
    {
      kind: "modal",
      id: "finish",
      title: "You're all set",
      body: "You can revisit this tour anytime from your account menu.",
      icon: <Sparkles className="size-4" />,
    },
  ];
}

type WalkthroughContextValue = {
  start: () => void;
};

const WalkthroughContext = createContext<WalkthroughContextValue>({ start: () => {} });

export function useWalkthrough(): WalkthroughContextValue {
  return useContext(WalkthroughContext);
}

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isMac = useIsMac();
  const steps = useMemo(() => buildSteps(isMac), [isMac]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY) === "1";
    if (done) return;
    const t = setTimeout(() => setStepIndex(0), 700);
    return () => clearTimeout(t);
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setStepIndex(null);
  }, []);

  const next = useCallback(() => {
    setStepIndex((s) => {
      if (s === null) return s;
      if (s >= steps.length - 1) {
        localStorage.setItem(STORAGE_KEY, "1");
        return null;
      }
      return s + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => {
    setStepIndex((s) => (s === null || s === 0 ? s : s - 1));
  }, []);

  const start = useCallback(() => {
    if (pathname !== ROUTES.dashboard) router.push(ROUTES.dashboard);
    setStepIndex(0);
  }, [pathname, router]);

  useEffect(() => {
    if (stepIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepIndex, next, back, finish]);

  const value = useMemo(() => ({ start }), [start]);
  const step = stepIndex !== null ? steps[stepIndex] : null;

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      {step && (
        <WalkthroughOverlay
          step={step}
          index={stepIndex ?? 0}
          total={steps.length}
          onNext={next}
          onBack={back}
          onSkip={finish}
          canBack={(stepIndex ?? 0) > 0}
          isLast={(stepIndex ?? 0) === steps.length - 1}
        />
      )}
    </WalkthroughContext.Provider>
  );
}

type OverlayProps = {
  step: Step;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  canBack: boolean;
  isLast: boolean;
};

function WalkthroughOverlay(props: OverlayProps) {
  if (props.step.kind === "modal") return <ModalStep {...props} step={props.step} />;
  return <SpotlightStep {...props} step={props.step} />;
}

function ModalStep({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  canBack,
  isLast,
}: OverlayProps & { step: Extract<Step, { kind: "modal" }> }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm">
      <TourCard
        icon={step.icon}
        title={step.title}
        body={step.body}
        index={index}
        total={total}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        canBack={canBack}
        isLast={isLast}
        className="w-[min(440px,100%)]"
      />
    </div>
  );
}

function SpotlightStep({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  canBack,
  isLast,
}: OverlayProps & { step: Extract<Step, { kind: "spotlight" }> }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    let attempts = 0;
    let unmounted = false;

    const update = (el: Element) => {
      if (unmounted) return;
      setRect(el.getBoundingClientRect());
    };

    const tryFind = () => {
      if (unmounted) return;
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        update(el);
        const ro = new ResizeObserver(() => update(el));
        ro.observe(document.body);
        const onScroll = () => update(el);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
          ro.disconnect();
          window.removeEventListener("scroll", onScroll, true);
          window.removeEventListener("resize", onScroll);
        };
      }
      attempts += 1;
      if (attempts > 10) {
        setMissing(true);
        return undefined;
      }
      setTimeout(tryFind, 120);
      return undefined;
    };

    const cleanup = tryFind();
    return () => {
      unmounted = true;
      cleanup?.();
    };
  }, [step.target]);

  if (missing) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm">
        <TourCard
          icon={step.icon}
          title={step.title}
          body={step.body}
          index={index}
          total={total}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          canBack={canBack}
          isLast={isLast}
          className="w-[min(440px,100%)]"
        />
      </div>
    );
  }

  if (!rect) return <div className="fixed inset-0 z-[60] bg-neutral-950/40" />;

  const PAD = 6;
  const CARD_W = 360;
  const GAP = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let cardTop = rect.top;
  let cardLeft = rect.right + GAP;

  if (step.placement === "bottom" || step.placement === "bottom-end") {
    cardTop = rect.bottom + GAP;
    if (step.placement === "bottom-end") {
      cardLeft = Math.max(GAP, rect.right - CARD_W);
    } else {
      cardLeft = rect.left;
    }
  } else if (step.placement === "top") {
    cardTop = rect.top - 320;
    cardLeft = rect.left;
  }

  cardLeft = Math.min(Math.max(GAP, cardLeft), vw - CARD_W - GAP);
  cardTop = Math.min(Math.max(GAP, cardTop), vh - 300 - GAP);

  const spotlightStyle = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: "12px",
  } as const;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close tour"
        onClick={onSkip}
        className="absolute inset-0 size-full cursor-default"
      />
      {/* Spotlight stage — wraps the dim cutout + ripples in one positioned container */}
      <div
        aria-hidden
        className="pointer-events-none fixed transition-all duration-200 ease-out"
        style={spotlightStyle}
      >
        {/* Dim cutout via this wrapper's massive shadow + static thick border */}
        <div
          className="absolute inset-0 rounded-[12px]"
          style={{
            boxShadow: "0 0 0 9999px rgba(10, 10, 10, 0.72)",
            border: "3px solid white",
          }}
        />
        {/* Ripple ring 1 */}
        <div
          className="absolute inset-0 rounded-[12px] animate-spotlight-ripple"
          style={{
            border: "3px solid white",
            transformOrigin: "center",
            zIndex: 2,
          }}
        />
        {/* Ripple ring 2 (delayed) */}
        <div
          className="absolute inset-0 rounded-[12px] animate-spotlight-ripple"
          style={{
            border: "3px solid white",
            transformOrigin: "center",
            animationDelay: "0.75s",
            zIndex: 2,
          }}
        />
        {/* Ripple ring 3 (more delayed) */}
        <div
          className="absolute inset-0 rounded-[12px] animate-spotlight-ripple"
          style={{
            border: "3px solid white",
            transformOrigin: "center",
            animationDelay: "1.5s",
            zIndex: 2,
          }}
        />
      </div>
      {/* Tour card — entrance fade-in */}
      <div
        className="fixed motion-safe:animate-auth-fade-in"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <TourCard
          icon={step.icon}
          title={step.title}
          body={step.body}
          index={index}
          total={total}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          canBack={canBack}
          isLast={isLast}
        />
      </div>
    </div>
  );
}

function TourCard({
  icon,
  title,
  body,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  canBack,
  isLast,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  canBack: boolean;
  isLast: boolean;
  className?: string;
}) {
  return (
    <div
      aria-labelledby="tour-title"
      aria-modal="true"
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl ${className ?? ""}`}
    >
      {icon && (
        <div className="mb-3 grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
          {icon}
        </div>
      )}
      <h3 id="tour-title" className="text-base font-semibold text-neutral-950">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={`dot-${["a", "b", "c", "d", "e", "f", "g", "h"][i]}`}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-4 bg-neutral-950" : "w-1 bg-neutral-300"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="h-9 rounded-lg px-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
          >
            Skip
          </button>
          {canBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="h-9 rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
