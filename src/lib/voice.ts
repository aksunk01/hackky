const SPEECH_API_BASE_URL =
  process.env.NEXT_PUBLIC_SPEECH_API_URL ?? "http://localhost:3000";

/** Preferred recording containers, best first. Safari supports none of the webm ones. */
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

/** How often the voice-activity detector samples the mic. */
const VAD_TICK_MS = 50;
/** RMS amplitude above which a tick counts as speech rather than room noise. */
const SPEECH_RMS_THRESHOLD = 0.02;
/** Quiet stretch that marks the end of a turn. */
const SILENCE_HANGOVER_MS = 900;
/** Ignore blips shorter than this — coughs, door clicks, keyboard taps. */
const MIN_SPEECH_MS = 300;
/** Safety valve for someone who never pauses. */
const MAX_UTTERANCE_MS = 30_000;
/** Rotate a silent recording rather than buffering quiet audio forever. */
const IDLE_ROTATE_MS = 10_000;
/** Keep ignoring the mic briefly after playback, to let room echo die out. */
const ECHO_TAIL_MS = 400;

export function isMicrophoneRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

/**
 * Statuses that mean the backend will never transcribe for us — a missing
 * `speech_to_text` key permission or an unpaid plan. Retrying is pointless, so
 * these are what trigger the browser fallback; anything else (a 500, a dropped
 * connection) is treated as transient.
 */
function isUnrecoverable(error: unknown): boolean {
  return (
    error instanceof TranscriptionError &&
    [401, 402, 403, 404].includes(error.status)
  );
}

/** Uploads recorded audio to our Scribe-backed endpoint and returns the transcript. */
async function transcribe(blob: Blob, contentType: string): Promise<string> {
  const res = await fetch(`${SPEECH_API_BASE_URL}/api/transcribe-audio`, {
    method: "POST",
    // The backend forwards this as the upload's content type, so it has to be
    // the container MediaRecorder actually produced.
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new TranscriptionError(
      `Transcription failed (${res.status}): ${detail}`,
      res.status
    );
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

/* ---------------------------------------------------------------- playback -- */

/** The currently playing utterance, so a new one can supersede it. */
let current: { audio: HTMLAudioElement; url: string } | null = null;
/** Lets stopSpeaking() cancel a request whose audio hasn't arrived yet. */
let inFlight: AbortController | null = null;
/** True while the interviewer's voice is actually coming out of the speakers. */
let playing = false;
/** Echo grace period after playback stops. */
let echoTailUntil = 0;

/**
 * Whether the interviewer is audible right now. The always-on listener uses
 * this to avoid transcribing the AI's own voice back into the conversation.
 */
function isSpeaking(): boolean {
  return playing || Date.now() < echoTailUntil;
}

function releaseCurrent() {
  if (!current) return;
  current.audio.pause();
  // Freeing the blob matters here: replies are synthesized continuously, so
  // leaked object URLs would accumulate for the life of the interview.
  URL.revokeObjectURL(current.url);
  current = null;
  playing = false;
  echoTailUntil = Date.now() + ECHO_TAIL_MS;
}

/**
 * Synthesizes `text` with our ElevenLabs backend and plays the MP3 it returns.
 * Any utterance already playing (or still being fetched) is cancelled first.
 */
export async function speak(text: string) {
  if (typeof window === "undefined" || !text.trim()) return;

  stopSpeaking();

  const controller = new AbortController();
  inFlight = controller;

  try {
    const res = await fetch(`${SPEECH_API_BASE_URL}/api/stream-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // The backend forwards ElevenLabs' status and message, so surface it
      // rather than failing silently on a quota or permission error.
      const detail = await res.text().catch(() => "");
      throw new Error(`Speech request failed (${res.status}): ${detail}`);
    }

    const blob = await res.blob();

    // A later speak()/stopSpeaking() won the race while we were awaiting.
    if (inFlight !== controller) return;
    inFlight = null;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    current = { audio, url };

    audio.addEventListener("ended", () => {
      if (current?.audio === audio) releaseCurrent();
    });

    await audio.play();
    // Only now is the mic at risk of hearing us, so gate on real playback
    // rather than on the request starting.
    if (current?.audio === audio) playing = true;
  } catch (error) {
    if (controller.signal.aborted) return;
    if (inFlight === controller) inFlight = null;
    // A failed synthesis must not leave the mic suppressed forever.
    playing = false;
    console.error("[speak] text-to-speech failed:", error);
  }
}

export function stopSpeaking() {
  inFlight?.abort();
  inFlight = null;
  releaseCurrent();
}

/* --------------------------------------------------------------- listening -- */

type Segment = {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  /** Accumulated voiced time, used to tell speech from a stray noise. */
  loudMs: number;
  lastLoudAt: number;
};

/**
 * Holds the microphone open and transcribes each utterance with our ElevenLabs
 * backend as the speaker finishes it.
 *
 * `onUnavailable` fires if the backend rejects a transcription in a way that
 * won't fix itself, so the caller can switch engines.
 */
function startBackendListening(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onUnavailable: () => void
): (() => void) | null {
  if (!isMicrophoneRecordingSupported()) return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;

  let stopped = false;
  let ended = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let detachResume: (() => void) | null = null;
  let mimeType: string | undefined;

  // One MediaRecorder per utterance: webm chunks after the first aren't
  // independently decodable, so a single long recording can't be sliced into
  // per-utterance blobs after the fact.
  let segment: Segment | null = null;

  // The caller clears its listening state here, so it must fire exactly once.
  const finish = () => {
    if (ended) return;
    ended = true;
    onEnd();
  };

  function beginSegment() {
    if (stopped || !stream) return;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      console.error("[startListening] MediaRecorder setup failed:", error);
      return;
    }

    const active: Segment = {
      recorder,
      chunks: [],
      startedAt: Date.now(),
      loudMs: 0,
      lastLoudAt: 0,
    };
    segment = active;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) active.chunks.push(event.data);
    });
    recorder.addEventListener("error", (event) => {
      console.error("[startListening] recording failed:", event);
    });

    // Recording runs from the start of the segment, ahead of any speech, so the
    // first syllable isn't clipped while the detector catches up.
    recorder.start();
  }

  /** Closes the current segment, transcribing it only if it held real speech. */
  function endSegment(upload: boolean) {
    const active = segment;
    segment = null;
    if (!active) return;

    const worthSending = upload && active.loudMs >= MIN_SPEECH_MS;

    active.recorder.addEventListener("stop", () => {
      if (!worthSending) return;

      // The browser may have fallen back to a different container than we asked
      // for, so trust the recorder over our preference list.
      const type = active.recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(active.chunks, { type });
      if (blob.size === 0) return;

      void (async () => {
        try {
          const text = await transcribe(blob, type);
          if (!stopped && text) onResult(text);
        } catch (error) {
          console.error("[startListening] transcription failed:", error);
          // A bad key or unpaid plan won't recover on the next utterance, so
          // hand off instead of failing silently on every turn.
          if (!stopped && isUnrecoverable(error)) onUnavailable();
        }
      })();
    });

    if (active.recorder.state !== "inactive") active.recorder.stop();
  }

  function onTick(rms: number) {
    const now = Date.now();

    // The interviewer's own playback bleeds into the mic; throw away anything
    // captured while it talks instead of replying to ourselves.
    if (isSpeaking()) {
      if (segment) endSegment(false);
      return;
    }

    if (!segment) {
      beginSegment();
      return;
    }

    if (rms >= SPEECH_RMS_THRESHOLD) {
      segment.loudMs += VAD_TICK_MS;
      segment.lastLoudAt = now;
    }

    const hasSpeech = segment.loudMs >= MIN_SPEECH_MS;

    // Spoke, then went quiet: that's a finished turn.
    if (hasSpeech && now - segment.lastLoudAt >= SILENCE_HANGOVER_MS) {
      endSegment(true);
      beginSegment();
      return;
    }

    if (now - segment.startedAt >= MAX_UTTERANCE_MS) {
      endSegment(hasSpeech);
      beginSegment();
      return;
    }

    // Nothing but silence for a while; start fresh so buffers stay small.
    if (!hasSpeech && now - segment.startedAt >= IDLE_ROTATE_MS) {
      endSegment(false);
      beginSegment();
    }
  }

  void (async () => {
    let localStream: MediaStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Materially reduces how much of our own playback returns to the mic.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      // Most often the user denied the permission prompt.
      console.error("[startListening] microphone unavailable:", error);
      finish();
      return;
    }

    // Mute may have been hit while the permission prompt was still open.
    if (stopped) {
      localStream.getTracks().forEach((track) => track.stop());
      finish();
      return;
    }

    stream = localStream;
    mimeType = RECORDING_MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    const audioContext = new AudioContextCtor();
    context = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    // Intentionally not connected to the destination — routing the mic to the
    // speakers would create real feedback.
    audioContext.createMediaStreamSource(localStream).connect(analyser);

    // Browsers start a context suspended without a user gesture, which would
    // leave the detector reading an all-zero signal and never hearing anything.
    void audioContext.resume().catch(() => {});
    const resume = () => void audioContext.resume().catch(() => {});
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    detachResume = () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };

    const samples = new Float32Array(analyser.fftSize);

    beginSegment();

    ticker = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      onTick(Math.sqrt(sum / samples.length));
    }, VAD_TICK_MS);
  })();

  return () => {
    if (stopped) return;
    stopped = true;

    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    detachResume?.();
    detachResume = null;

    // Muting means "stop listening", not "send what I was mid-way through".
    endSegment(false);

    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    void context?.close().catch(() => {});
    context = null;

    finish();
  };
}

/* ------------------------------------------------ browser fallback engine -- */

interface SpeechRecognitionResultLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognitionCtor(): (new () => MinimalSpeechRecognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalSpeechRecognition;
    webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Last-resort transcription using the browser's own engine, for when our
 * backend can't do it. Note this sends audio to the browser vendor's service
 * rather than to ElevenLabs, and only Chromium-family browsers implement it.
 */
function startBrowserListening(
  onResult: (transcript: string) => void,
  onEnd: () => void
): (() => void) | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  let stopped = false;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const latest = event.results[event.results.length - 1];
    const transcript = latest?.[0]?.transcript?.trim();
    // Drop anything picked up while the interviewer is talking, so it doesn't
    // transcribe its own voice — same guard the backend engine uses.
    if (!stopped && transcript && !isSpeaking()) onResult(transcript);
  };

  recognition.onerror = () => {
    // Errors here are usually a transient no-speech timeout; onend follows and
    // restarts us, so there's nothing to do.
  };

  recognition.onend = () => {
    if (stopped) {
      onEnd();
      return;
    }
    // Chrome ends a session on its own every so often; restart to stay on.
    try {
      recognition.start();
    } catch {
      onEnd();
    }
  };

  try {
    recognition.start();
  } catch (error) {
    console.error("[startListening] browser recognition failed to start:", error);
    return null;
  }

  return () => {
    if (stopped) return;
    stopped = true;
    recognition.stop();
  };
}

/* ------------------------------------------------------------ orchestrator -- */

/**
 * Set once the backend has proven it can't transcribe, so later sessions skip
 * straight to the fallback instead of re-failing on every utterance. Resets on
 * reload, which is what picks up a repaired API key.
 */
let backendSttUnavailable = false;

/** Which engine produced the most recent transcript. Useful for UI messaging. */
export function isUsingFallbackTranscription(): boolean {
  return backendSttUnavailable;
}

/**
 * Holds the microphone open and reports each utterance as the speaker finishes
 * it, so the caller never has to press anything.
 *
 * Prefers our ElevenLabs backend and silently switches to the browser's own
 * recognition if the backend can't transcribe (missing key permission, unpaid
 * plan). `onResult` may fire many times; `onEnd` fires once, when listening
 * stops for good. Returns null if no engine is available at all.
 */
export function startListening(
  onResult: (transcript: string) => void,
  onEnd: () => void
): (() => void) | null {
  let stopped = false;
  let ended = false;
  let swapping = false;
  let active: (() => void) | null = null;

  const finish = () => {
    if (ended) return;
    ended = true;
    onEnd();
  };

  // Suppressed mid-swap: tearing down the backend engine must not look like the
  // user ending the session.
  const innerEnd = () => {
    if (swapping) return;
    finish();
  };

  const startFallback = () => {
    if (stopped) return;
    active = startBrowserListening(onResult, innerEnd);
    if (!active) {
      console.error("[startListening] no transcription engine available");
      finish();
    }
  };

  if (backendSttUnavailable) {
    startFallback();
  } else {
    active = startBackendListening(onResult, innerEnd, () => {
      if (stopped || backendSttUnavailable) return;
      backendSttUnavailable = true;
      console.warn(
        "[startListening] backend transcription unavailable; " +
          "falling back to the browser's speech recognition"
      );

      const previous = active;
      active = null;
      swapping = true;
      previous?.();
      swapping = false;
      startFallback();
    });

    // Can't record at all, but the browser engine may still work.
    if (!active) startFallback();
  }

  if (!active) return null;

  return () => {
    if (stopped) return;
    stopped = true;
    const current = active;
    active = null;
    current?.();
    finish();
  };
}
