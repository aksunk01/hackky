"use client";

import { useCallback, useRef } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import type { Language } from "@/lib/types";
import { MONACO_LANGUAGE } from "@/lib/format";

// Served from this app (see scripts/setup-monaco.mjs) rather than a CDN, so the
// editor loads even when the network does not.
loader.config({ paths: { vs: "/monaco/vs" } });

interface Props {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function CodeEditor({ language, value, onChange, readOnly = false }: Props) {
  const mountedRef = useRef(false);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    mountedRef.current = true;
    monaco.editor.defineTheme("interview-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6b82", fontStyle: "italic" },
        { token: "keyword", foreground: "c084fc" },
        { token: "string", foreground: "86efac" },
        { token: "number", foreground: "fbbf24" },
        { token: "type", foreground: "7dd3fc" },
      ],
      colors: {
        "editor.background": "#0d121c",
        "editor.lineHighlightBackground": "#141d2c",
        "editorLineNumber.foreground": "#3d4d66",
        "editorLineNumber.activeForeground": "#8a9ab3",
        "editorGutter.background": "#0d121c",
        "editorIndentGuide.background1": "#1a2435",
        "editor.selectionBackground": "#1e3a5f",
        "editorCursor.foreground": "#4ade80",
      },
    });
    monaco.editor.setTheme("interview-dark");
    editor.focus();
  }, []);

  return (
    <Editor
      language={MONACO_LANGUAGE[language]}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      onMount={handleMount}
      theme="vs-dark"
      loading={
        <div className="flex h-full items-center justify-center text-sm text-faint">
          Loading editor…
        </div>
      }
      options={{
        readOnly,
        fontSize: 13.5,
        fontFamily:
          'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: "line",
        lineNumbersMinChars: 3,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: "off",
        bracketPairColorization: { enabled: true },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        // An interview is about your thinking, not your autocomplete.
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        wordBasedSuggestions: "off",
      }}
    />
  );
}
