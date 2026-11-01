import { ApiClientError } from "./client";

/** Retry only public GET reads; mutations keep their explicit recovery rules. */
export async function readWithStartupRetry<T>(read: () => Promise<T>, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      const temporary = error instanceof ApiClientError && (error.kind === "network" || error.kind === "http" && [500, 502, 503, 504].includes(error.status));
      if (!temporary || attempt >= 2 || signal.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); signal.removeEventListener("abort", cancel); reject(new ApiClientError(0, "REQUEST_ABORTED", "Permintaan dibatalkan.", "aborted")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 1000 * (attempt + 1));
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      });
    }
  }
}
