export type TimerMode = "countup" | "strict";

export const STRICT_DURATION_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_STRICT_MINUTES = 30;
/** Lets a real countdown be exercised in seconds rather than sitting through a full session. */
export const DEV_STRICT_MINUTES = 1;

export type TimerConfig = {
  mode: TimerMode;
  /** Only meaningful when mode is "strict". */
  minutes: number;
};

/** Builds the query string a problem link carries into the interview page. */
export function timerConfigToQuery(config: TimerConfig): string {
  if (config.mode === "strict") {
    return `?timer=strict&minutes=${config.minutes}`;
  }
  return "";
}

/** Reads the timer config a problem link was opened with, defaulting to a free count-up timer. */
export function timerConfigFromSearch(search: string): TimerConfig {
  const params = new URLSearchParams(search);
  const minutesParam = Number(params.get("minutes"));
  const minutes =
    Number.isFinite(minutesParam) && minutesParam > 0 ? minutesParam : DEFAULT_STRICT_MINUTES;
  if (params.get("timer") === "strict") {
    return { mode: "strict", minutes };
  }
  return { mode: "countup", minutes };
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
