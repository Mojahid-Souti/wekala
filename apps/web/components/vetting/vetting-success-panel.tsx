"use client";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

export function VettingSuccessPanel({
  classification,
  onApprove,
  approving,
  alreadyApproved,
}: {
  classification: string;
  onApprove: () => void;
  approving: boolean;
  alreadyApproved: boolean;
}) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-8">
      <div className="flex flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-emerald-200 bg-white text-emerald-600">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-950">
          Looks good — ready to continue
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-neutral-600">
          The agent passed every gatekeeper check: no PII, no prompt-injection patterns, and the
          declared <strong className="font-medium text-neutral-900">{classification}</strong>{" "}
          classification policy is satisfied.
        </p>

        <ul className="mt-6 grid w-full max-w-md gap-2 text-left text-sm text-neutral-700">
          <Check label="PII scan clean" />
          <Check label="No prompt-injection patterns detected" />
          <Check label="Classification policy satisfied" />
          <Check label="No forbidden tools or sources requested" />
        </ul>

        {alreadyApproved ? (
          <div className="mt-7 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            Already approved — proceed to publish
          </div>
        ) : (
          <button
            type="button"
            onClick={onApprove}
            disabled={approving}
            className="mt-7 inline-flex h-10 min-w-[180px] items-center justify-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {approving && <Loader2 className="size-4 animate-spin" />}
            {approving ? "Approving…" : "Approve and continue"}
          </button>
        )}
      </div>
    </section>
  );
}

function Check({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="size-4 text-emerald-600" />
      <span>{label}</span>
    </li>
  );
}
