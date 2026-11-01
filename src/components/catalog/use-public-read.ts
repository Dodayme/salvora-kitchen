"use client";
import { useEffect, useState } from "react";
import { apiRequest, ApiClientError, createLatestRead, type ApiResult } from "@/lib/http/client";
import { readWithStartupRetry } from "@/lib/http/startup-read";

type State<T> = { key: string; status: "ready"; result: ApiResult<T> } | { key: string; status: "error"; error: unknown };
export function usePublicRead<T>(path: string, decode: (data: unknown) => T, paging = false, summary = false) {
  const [reader] = useState(() => createLatestRead<ApiResult<T>>());
  const [revision, setRevision] = useState(0), [state, setState] = useState<State<T>>();
  const key = `${path}:${revision}`;
  useEffect(() => {
    let active = true;
    void reader.run(async signal => {
      const result = await readWithStartupRetry(() => apiRequest(path, { signal, decode }), signal);
      if (paging && !result.meta.pagination || summary && !result.meta.ratingSummary) throw new ApiClientError(200, "INVALID_RESPONSE", "Informasi daftar server belum lengkap. Silakan muat ulang.", "protocol", result.meta.requestId);
      return result;
    }).then(value => { if (active && value.status === "success") setState({ key, status: "ready", result: value.data }); }).catch(error => { if (active) setState({ key, status: "error", error }); });
    return () => { active = false; reader.cancel(); };
  }, [path, decode, paging, summary, key, reader]);
  return { state: state?.key === key ? state : { status: "loading" as const }, reload: () => setRevision(value => value + 1) };
}
