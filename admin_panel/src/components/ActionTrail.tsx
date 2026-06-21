export type ActionStatus = "pending" | "running" | "done" | "error";

export type ActionStep = {
  id: string;
  label: string;
  status: ActionStatus;
};

function StatusIcon({ status }: { status: ActionStatus }) {
  if (status === "running") {
    return (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
        aria-hidden="true"
      />
    );
  }
  if (status === "done") {
    return (
      <svg
        className="h-3.5 w-3.5 text-green-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg
        className="h-3.5 w-3.5 text-red-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.7 7.3a1 1 0 0 0-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 1 0 1.4 1.4L10 11.4l1.3 1.3a1 1 0 0 0 1.4-1.4L11.4 10l1.3-1.3a1 1 0 0 0-1.4-1.4L10 8.6 8.7 7.3z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  // pending
  return (
    <span className="h-3.5 w-3.5 rounded-full border-2 border-neutral-200" aria-hidden="true" />
  );
}

const LABEL_CLASS: Record<ActionStatus, string> = {
  pending: "text-neutral-400",
  running: "font-medium text-neutral-900",
  done: "text-neutral-500",
  error: "font-medium text-red-700",
};

/**
 * "Action trail" — a compact, ordered view of the steps the concierge is taking
 * behind the scenes. Purely presentational; the caller owns step state.
 */
export function ActionTrail({ steps }: { steps: ActionStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-2.5">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-2.5 text-sm">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            <StatusIcon status={step.status} />
          </span>
          <span className={LABEL_CLASS[step.status]}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
