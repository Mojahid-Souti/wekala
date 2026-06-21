import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Optional emphasis when the figure needs attention (e.g. open reports). */
  accent?: "default" | "warning";
};

export function StatCard({ label, value, hint, accent = "default" }: StatCardProps) {
  const valueClass =
    accent === "warning" && value !== 0 ? "text-amber-600" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-neutral-500 text-sm">{label}</p>
      <p className={`mt-2 font-semibold text-3xl tracking-tight ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-neutral-400 text-xs">{hint}</p>}
    </div>
  );
}
