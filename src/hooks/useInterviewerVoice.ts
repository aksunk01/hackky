"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speaks the interviewer's lines. Prefers ElevenLabs through the server proxy,
 * and falls back to the browser's own speech synthesis when no key is set, so
 * the interview is voice-first with zero configuration.
 */
export function useInterviewerVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speakWithBrowser = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1;

      // Prefer a natural-sounding English voice when the platform offers one.
      const voices = synth.getVoices();
      const preferred =
        voices.find((v) => /Samantha|Daniel|Google US English|Microsoft Aria/i.test(v.name)) ??
        voices.find((v) => v.lang?.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      // Safety net: some platforms never fire onend for long utterances.
      setTimeout(finish, Math.max(4000, text.length * 90));

      synth.speak(utterance);
    });
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || !enabledRef.current) return;

      stop();
      setSpeaking(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: clean }),
        });

        if (response.ok && response.status !== 204) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            const finish = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
          });
        } else {
          await speakWithBrowser(clean);
        }
      } catch {
        await speakWithBrowser(clean);
      } finally {
        audioRef.current = null;
        setSpeaking(false);
      }
    },
    [speakWithBrowser, stop],
  );

  useEffect(() => stop, [stop]);

  return { speak, stop, speaking, enabled, setEnabled };
}
