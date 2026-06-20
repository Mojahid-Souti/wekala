import type { VoiceState } from "@/hooks/useVoiceSession";

type MicButtonProps = {
  state: VoiceState;
  disabled: boolean;
  onTap: () => void;
};

function MicIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function MicButton({ state, disabled, onTap }: MicButtonProps) {
  const listening = state === "listening";
  const color = disabled
    ? "cursor-not-allowed bg-neutral-200 text-neutral-400"
    : listening
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-neutral-900 text-white hover:bg-neutral-800";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={listening ? "Stop listening" : "Tap to talk"}
      aria-pressed={listening}
      className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-colors ${color}`}
    >
      {listening ? <StopIcon /> : <MicIcon />}
    </button>
  );
}
