import { MicButton } from "@/components/MicButton";
import { VoiceOrb } from "@/components/VoiceOrb";
import { type VoiceState, useVoiceSession } from "@/hooks/useVoiceSession";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

const MIC_HINT: Record<VoiceState, string> = {
  idle: "Tap the mic to start",
  listening: "Tap again to send",
  thinking: "Processing your request",
  speaking: "Responding…",
};

export function VoicePage() {
  const { state, transcript, response, isBusy, onMicTap } = useVoiceSession();

  return (
    <section className="mx-auto flex max-w-md flex-col items-center">
      <div className="mb-2 text-center">
        <h1 className="font-semibold text-neutral-900 text-xl tracking-tight">Voice agent</h1>
        <p className="text-neutral-400 text-xs">Prototype — audio is mocked, no live pipeline.</p>
      </div>

      <VoiceOrb state={state} />

      <p className="mt-2 font-medium text-lg text-neutral-800">{STATE_LABEL[state]}</p>

      {/* Conversation area — fixed min-height so the layout doesn't jump. */}
      <div className="mt-6 min-h-[112px] w-full space-y-3">
        {transcript && (
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-900 px-4 py-2 text-sm text-white">
            {transcript}
          </div>
        )}
        {response && (
          <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2 text-neutral-800 text-sm shadow-sm ring-1 ring-neutral-100">
            {response}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <MicButton state={state} disabled={isBusy} onTap={onMicTap} />
        <p className="text-neutral-400 text-xs">{MIC_HINT[state]}</p>
      </div>
    </section>
  );
}
