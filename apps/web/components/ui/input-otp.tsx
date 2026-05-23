"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";

import { cn } from "@/lib/utils";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("flex items-center", containerClassName)}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const ctx = React.useContext(OTPInputContext);
  const slot = ctx?.slots[index] ?? { char: null, hasFakeCaret: false, isActive: false };

  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot.isActive}
      className={cn(
        "relative grid h-14 w-12 place-items-center rounded-xl border bg-white text-xl font-semibold text-neutral-950 transition-all",
        slot.isActive
          ? "border-neutral-950 ring-2 ring-neutral-200"
          : "border-neutral-200 hover:border-neutral-300",
        className
      )}
      {...props}
    >
      {slot.char}
      {slot.hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-otp-caret-blink bg-neutral-900" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
