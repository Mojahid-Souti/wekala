"use client";

import { useEffect, useState } from "react";

export function useToken(): string {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(sessionStorage.getItem("access_token") ?? "");
  }, []);
  return token;
}
