"use client";

import { usePathname } from "next/navigation";

export function AnimatedFormPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ perspective: "1200px" }} className="w-full">
      <div
        key={pathname}
        className="origin-center will-change-transform motion-safe:animate-auth-flip-in motion-reduce:animate-auth-fade-in"
      >
        {children}
      </div>
    </div>
  );
}
