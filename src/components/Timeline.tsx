"use client";

import type { TimelineEvent } from "@/lib/types";
import { EVENT_STYLE, formatClock } from "@/lib/format";

export function Timeline({ events, compact = false }: { events: TimelineEvent[]; compact?: boolean }) {
  if (!events.length) {
    return (
      <p className="px-4 py-6 text-center text-[12px] text-faint">
        Notable moments will appear here as the interview progresses.
      </p>
    );
  }

  return (
    <ol className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {events.map((event) => {
        const style = EVENT_STYLE[event.kind];
        return (
          <li key={event.id} className="flex items-start gap-2.5">
            <span className="mt-[3px] font-mono text-[10.5px] tabular-nums text-faint">
              {formatClock(event.elapsed)}
            </span>
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
            <span className={`text-[12.5px] leading-relaxed ${style.text}`}>{event.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
