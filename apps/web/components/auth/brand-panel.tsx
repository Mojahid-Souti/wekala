"use client";

import { useEffect, useState } from "react";

type Scene = {
  id: string;
  title: string;
  subtitle: string;
  render: () => React.ReactNode;
};

const SCENES: readonly Scene[] = [
  {
    id: "bazaar",
    title: "Discover Pre-vetted Agents",
    subtitle: "Browse a marketplace of secure, ready-to-hire AI agents for your team.",
    render: () => <SceneBazaar />,
  },
  {
    id: "command",
    title: "See Real-time Impact",
    subtitle: "Track invocations, latency, and hours saved across every workspace.",
    render: () => <SceneCommandCenter />,
  },
  {
    id: "detail",
    title: "Vet Before You Deploy",
    subtitle: "Every agent passes PII, prompt-injection, and policy checks before publish.",
    render: () => <SceneAgentDetail />,
  },
];

const SCENE_INTERVAL_MS = 7000;

export function BrandPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SCENES.length);
    }, SCENE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const scene = SCENES[active];

  return (
    <aside className="relative hidden flex-col overflow-hidden bg-neutral-950 text-neutral-100 lg:flex">
      <DiagonalPattern />

      <FakeBrowserChrome />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-8 pb-12 pt-2">
        <div className="relative w-full max-w-lg">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-neutral-800 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            {SCENES.map((s, i) => (
              <div
                key={s.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === active ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={i !== active}
              >
                {i === active ? s.render() : null}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-md space-y-3 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-50">{scene.title}</h2>
          <p className="text-sm leading-relaxed text-neutral-400">{scene.subtitle}</p>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Showcase scenes">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Show scene: ${s.title}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-neutral-50" : "w-1.5 bg-neutral-700 hover:bg-neutral-500"
              }`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function DiagonalPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, white 0, white 1px, transparent 1px, transparent 14px)",
      }}
    />
  );
}

function FakeBrowserChrome() {
  return (
    <div className="relative z-10 flex items-center gap-3 border-b border-neutral-800/60 px-6 py-3">
      <div className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-700" />
      </div>
      <div className="flex items-center gap-2 rounded-md bg-neutral-900/80 px-3 py-1 text-xs text-neutral-500">
        <span className="size-3 rounded-full border border-neutral-700" />
        wekala.local
      </div>
    </div>
  );
}

function SceneBazaar() {
  return (
    <div className="flex h-full bg-white">
      <div className="w-14 border-r border-neutral-200 bg-neutral-50 p-2">
        <div className="mb-3 h-1.5 rounded bg-neutral-300" />
        <div className="space-y-1.5">
          {["▤", "◇", "◎", "✦"].map((g, i) => (
            <div
              key={g}
              className={`grid h-7 place-items-center rounded text-xs ${
                i === 0 ? "bg-neutral-900 text-white" : "text-neutral-500"
              }`}
            >
              {g}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-700">Bazaar</div>
          <div className="h-4 w-16 rounded bg-neutral-200" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "support", title: "Support Agent", meta: "v3 · 1.2k uses" },
            { id: "sales", title: "Sales Assistant", meta: "v1 · 340 uses" },
            { id: "compliance", title: "Compliance Bot", meta: "v2 · 89 uses" },
            { id: "data", title: "Data Analyst", meta: "v4 · 2.1k uses" },
          ].map((card, i) => (
            <div
              key={card.id}
              className="rounded-lg border border-neutral-200 bg-white p-2 motion-safe:animate-mockup-card-pulse"
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              <div className="mb-1.5 size-5 rounded bg-neutral-900" />
              <div className="text-[9px] font-semibold text-neutral-900">{card.title}</div>
              <div className="text-[8px] text-neutral-500">{card.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SceneCommandCenter() {
  return (
    <div className="flex h-full flex-col bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-neutral-700">Command Center</div>
        <div className="rounded bg-neutral-100 px-1.5 py-0.5 text-[8px] font-medium text-neutral-600">
          Last 7d
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "Invocations", value: "1,284" },
          { label: "Hours saved", value: "42.7" },
          { label: "Active agents", value: "18" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-neutral-200 p-1.5">
            <div className="text-[8px] uppercase tracking-wide text-neutral-400">{k.label}</div>
            <div className="text-sm font-semibold text-neutral-900">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
        {[
          { h: 35, d: "mon" },
          { h: 55, d: "tue" },
          { h: 40, d: "wed" },
          { h: 78, d: "thu" },
          { h: 62, d: "fri" },
          { h: 88, d: "sat" },
          { h: 70, d: "sun" },
        ].map((bar, i) => (
          <div
            key={bar.d}
            className="flex-1 rounded-sm bg-neutral-900 motion-safe:animate-mockup-bar-grow"
            style={{
              height: `${bar.h}%`,
              transformOrigin: "bottom",
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SceneAgentDetail() {
  const tabs = ["Overview", "Versions", "Vetting", "Tools", "Test"];
  return (
    <div className="flex h-full flex-col bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="size-7 rounded-lg bg-neutral-900" />
        <div>
          <div className="text-xs font-semibold text-neutral-800">Support Agent v3</div>
          <div className="text-[8px] text-neutral-500">Owned by Mojahid · Updated 2h ago</div>
        </div>
        <div className="ml-auto rounded-md bg-neutral-900 px-2 py-0.5 text-[8px] font-semibold tracking-wide text-white">
          PUBLISHED
        </div>
      </div>
      <div className="mb-3 flex gap-3 border-b border-neutral-200">
        {tabs.map((t, i) => (
          <div
            key={t}
            className={`relative pb-1.5 text-[9px] ${
              i === 2 ? "font-semibold text-neutral-900" : "text-neutral-500"
            }`}
          >
            {t}
            {i === 2 && (
              <span className="absolute -bottom-px left-0 h-px w-full bg-neutral-900 motion-safe:animate-mockup-tab-highlight" />
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <div className="size-4 rounded-full bg-neutral-900" />
          <div className="flex-1">
            <div className="text-[9px] font-medium text-neutral-900">PII scan</div>
            <div className="text-[8px] text-neutral-500">No personal data found</div>
          </div>
          <div className="text-[8px] font-semibold text-neutral-900">PASS</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <div className="size-4 rounded-full bg-neutral-900" />
          <div className="flex-1">
            <div className="text-[9px] font-medium text-neutral-900">Prompt injection</div>
            <div className="text-[8px] text-neutral-500">20/20 red-team prompts blocked</div>
          </div>
          <div className="text-[8px] font-semibold text-neutral-900">PASS</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <div className="size-4 rounded-full bg-neutral-900" />
          <div className="flex-1">
            <div className="text-[9px] font-medium text-neutral-900">Tool whitelist</div>
            <div className="text-[8px] text-neutral-500">3 tools, all on allow-list</div>
          </div>
          <div className="text-[8px] font-semibold text-neutral-900">PASS</div>
        </div>
      </div>
    </div>
  );
}
