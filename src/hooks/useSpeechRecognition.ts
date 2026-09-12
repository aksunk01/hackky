"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is still vendor-prefixed in Chromium and absent in Firefox,
// so it is typed here rather than relying on lib.dom.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Options {
  /** Called once a complete utterance has been recognised. */
  onFinal: (text: string) => void;
  /** While true the microphone is held closed, so the TTS voice is never transcribed. */
  muted: boolean;
}

export function useSpeechRecognition({ onFinal, muted }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const mutedRef = useRef(muted);
  const onFinalRef = useRef(onFinal);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      setInterim(interimText);

      const trimmed = finalText.trim();
      // Anything the interviewer is saying out loud must not be attributed to
      // the candidate, so drop whatever lands while muted.
      if (trimmed && !mutedRef.current) {
        setInterim("");
        onFinalRef.current(trimmed);
      }
    };

    recognition.onerror = (event) => {
      const code = (event as Event & { error?: string }).error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone permission was denied. You can still type to the interviewer.");
        wantListeningRef.current = false;
        setListening(false);
      } else if (code === "no-speech" || code === "aborted") {
        // Routine in continuous mode; the onend handler restarts it.
      } else if (code) {
        setError(`Speech recognition error: ${code}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Chrome ends the session on its own after a pause; restart if still wanted.
      if (wantListeningRef.current) {
        restartTimerRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Already starting — harmless.
          }
        }, 250);
      }
    };

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognitionRef.current = recognition;

    return () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        // Nothing to abort.
      }
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    wantListeningRef.current = true;
    try {
      recognition.start();
    } catch {
      // start() throws if it is already running.
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    wantListeningRef.current = false;
    setInterim("");
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
  }, []);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
