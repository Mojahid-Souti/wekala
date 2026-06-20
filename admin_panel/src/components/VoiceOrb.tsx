import type { VoiceState } from "@/hooks/useVoiceSession";

type OrbStyle = {
  core: string; // gradient + animation
  glow: string; // blurred backdrop colour
  ring: string | null; // expanding ping ring colour, or null when quiet
};

// Full class strings per state (kept literal so Tailwind's scanner picks them up).
const ORB_STYLES: Record<VoiceState, OrbStyle> = {
  idle: {
    core: "bg-gradient-to-br from-neutral-300 to-neutral-400 animate-breathe",
    glow: "bg-neutral-300",
    ring: null,
  },
  listening: {
    core: "bg-gradient-to-br from-rose-400 to-red-500 animate-pulse",
    glow: "bg-rose-400",
    ring: "bg-rose-400",
  },
  thinking: {
    core: "bg-gradient-to-br from-amber-300 to-orange-500 animate-spin-slow",
    glow: "bg-amber-400",
    ring: null,
  },
  speaking: {
    core: "bg-gradient-to-br from-emerald-400 to-teal-500 animate-pulse",
    glow: "bg-emerald-400",
    ring: "bg-emerald-400",
  },
};

export function VoiceOrb({ state }: { state: VoiceState }) {
  const style = ORB_STYLES[state];
  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      <div className={`absolute h-40 w-40 rounded-full opacity-40 blur-2xl ${style.glow}`} />
      {style.ring && (
        <span
          className={`absolute h-44 w-44 animate-ping rounded-full opacity-30 ${style.ring}`}
        />
      )}
      <div className={`relative h-36 w-36 rounded-full shadow-xl ${style.core}`}>
        {/* glossy highlight */}
        <div className="absolute top-5 left-6 h-10 w-10 rounded-full bg-white/30 blur-md" />
      </div>
    </div>
  );
}
