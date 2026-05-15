"use client";
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // eslint-disable-next-line no-console
      console.warn("[pwa] sw register failed:", e);
    });
  }, []);
  return null;
}
