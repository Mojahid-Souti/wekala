"use client";

import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useRouter } from "next/navigation";

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  const { toast } = useToast();

  function handleClick() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    toast("Signed out.", "info");
    router.replace(ROUTES.login);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {label}
    </button>
  );
}
