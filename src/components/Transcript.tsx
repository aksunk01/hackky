"use client";

import { useEffect, useRef } from "react";
import type { TranscriptTurn } from "@/lib/types";
import { formatClock } from "@/lib/format";

interface Props {
  turns: TranscriptTurn[];
  interim: string;
  thinking: boolean;
}

export function Transcript({ turns, interim, thinking }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, interim, thinking]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
      {turns.length === 0 && !thinking ? (
        <p className="py-8 text-center text-[12.5px] leading-relaxed text-faint">
          Your interviewer will open the conversation.
          <br />
          Turn on your microphone to reply out loud.
        </p>
      ) : null}

      {turns.map((turn) => {
        if (turn.speaker === "system") {
          return (
            <div key={turn.id} className="flex justify-center">
              <span className="rounded-full border border-line-soft bg-surface px-2.5 py-0.5 text-[10.5px] text-faint">
                {turn.text}
              </span>
            </div>
          );
        }

        const isInterviewer = turn.speaker === "interviewer";
        return (
          <div key={turn.id} className="fade-rise">
            <div className="mb-1 flex items-baseline gap-2">
              <span
                className={`text-[10.5px] font-semibold uppercase tracking-wider ${
                  isInterviewer ? "text-info" : "text-accent"
                }`}
              >
                {isInterviewer ? "Interviewer" : "You"}
              </span>
              <span className="font-mono text-[10px] text-faint">
                {formatClock(turn.elapsed)}
              </span>
            </div>
            <p
              className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${
                isInterviewer
                  ? "border-info/20 bg-info/5 text-body"
                  : "border-line-soft bg-surface/70 text-body/85"
              }`}
            >
              {turn.text}
            </p>
          </div>
        );
      })}

      {interim ? (
        <div className="fade-rise">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-accent/60">
            You
          </div>
          <p className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-2 text-[13px] leading-relaxed text-muted italic">
            {interim}
          </p>
        </div>
      ) : null}

      {thinking ? (
        <div className="flex items-center gap-2 px-1 text-[12px] text-faint">
          <span className="flex gap-[3px]">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:240ms]" />
          </span>
          Interviewer is thinking
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
