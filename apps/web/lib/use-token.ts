"use client";

import { useEffect, useState } from "react";
import { getToken } from "./auth-storage";

export function useToken(): string {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(getToken());
  }, []);
  return token;
}
