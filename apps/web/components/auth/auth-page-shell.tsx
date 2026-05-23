export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[88vh] flex-col">{children}</div>;
}

export function AuthBrandMark() {
  return (
    <div className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_20px_-6px_rgba(0,0,0,0.3)]">
      <span className="text-xl font-bold">W</span>
    </div>
  );
}

export function AuthFooter() {
  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-neutral-100 pt-5 text-xs text-neutral-500 sm:flex-row">
      <p>&copy; {new Date().getFullYear()} Wekala. All rights reserved.</p>
      <div className="flex items-center gap-3">
        <a href="/legal/privacy" className="hover:text-neutral-700 hover:underline">
          Privacy Policy
        </a>
        <span aria-hidden>·</span>
        <a href="/legal/terms" className="hover:text-neutral-700 hover:underline">
          Terms &amp; Conditions
        </a>
      </div>
    </div>
  );
}
