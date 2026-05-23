import { VerifyForm } from "@/components/auth/verify-form";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-neutral-100" />}>
      <VerifyForm />
    </Suspense>
  );
}
