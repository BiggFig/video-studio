"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./studio-context";

export function usePollingResource<T>(path: string, interval: number | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<T>(path, { signal: controller.signal });
      if (mounted.current && !controller.signal.aborted) { setData(result); setError(null); }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setError(error instanceof Error ? error.message : "We couldn’t connect. Please try again.");
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
      if (request.current === controller) request.current = null;
    }
  }, [path]);
  useEffect(() => {
    mounted.current = true;
    setData(null); setError(null); setLoading(true);
    void refresh();
    return () => { mounted.current = false; request.current?.abort(); request.current = null; };
  }, [refresh]);
  useEffect(() => {
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = interval ? setInterval(visibleRefresh, interval) : null;
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("online", visibleRefresh);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", visibleRefresh); window.removeEventListener("online", visibleRefresh); };
  }, [refresh, interval]);
  return { data, loading, error, refresh };
}
