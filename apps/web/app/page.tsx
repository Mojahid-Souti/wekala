import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

// Root redirect — middleware will handle auth state; this is a fallback.
export default function Home() {
  redirect(ROUTES.login);
}
