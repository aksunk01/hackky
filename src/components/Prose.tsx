import { renderInlineCode } from "@/lib/format";

/** Problem prose with `inline code` styled, without pulling in a markdown parser. */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {renderInlineCode(text).map((part, i) =>
        part.code ? (
          <code
            key={i}
            className="rounded border border-line bg-raised px-1 py-px font-mono text-[0.85em] text-sky-300"
          >
            {part.text}
          </code>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}
