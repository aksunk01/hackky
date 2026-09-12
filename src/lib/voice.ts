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
/** How often an in-progress utterance is re-transcribed for a live preview. */
const PARTIAL_INTERVAL_MS = 1_200;
/** Keep the mic closed briefly after playback, to let room echo die out. */
const ECHO_TAIL_MS = 700;
/**
 * Longest reply, once URL-encoded, that rides in the streaming endpoint's
 * query string. Above this a reply falls back to fetching the whole clip
 * before playback rather than risking a truncated request line.
 */
const MAX_STREAM_URL_TEXT_LENGTH = 1800;

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
 * Statuses that mean the backend will never transcribe for us — an unconfigured
 * key (503), a missing `speech_to_text` key permission, or an unpaid plan.
 * Retrying is pointless, so these are what trigger the browser fallback;
 * anything else (a 500, a dropped connection) is treated as transient.
 */
function isUnrecoverable(error: unknown): boolean {
  return (
    error instanceof TranscriptionError &&
    [401, 402, 403, 404, 503].includes(error.status)
  );
}

/** Uploads recorded audio to our Scribe-backed endpoint and returns the transcript. */
async function transcribe(blob: Blob, contentType: string): Promise<string> {
  const res = await fetch("/api/transcribe-audio", {
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

/**
 * The currently playing utterance, so a new one can supersede it. `url` is
 * only set for the buffered fallback path — the streamed `<audio src>` path
 * has no blob to revoke.
 */
let current: { audio: HTMLAudioElement; url: string | null } | null = null;
/** Lets stopSpeaking() cancel a request whose audio hasn't arrived yet. */
let inFlight: AbortController | null = null;
/** True while the interviewer's voice is actually coming out of the speakers. */
let audible = false;
/**
 * True from the moment we've committed to a reply (asked the model, about to
 * synthesize and speak it) until it's actually done — covers the model call
 * and TTS request/generation, both of which can take seconds and would
 * otherwise leave the mic open for the candidate to talk over the reply
 * before `audible` ever flips.
 */
let interviewerBusy = false;
/** Echo grace period after playback stops. */
let echoTailUntil = 0;
let echoTailTimer: ReturnType<typeof setTimeout> | null = null;

/** Notified when the mic should close (true) or may reopen (false). */
const speakingListeners = new Set<(speaking: boolean) => void>();

/**
 * Whether the mic should be held closed right now: playback is audible, a
 * reply is being composed/synthesized, or we're still in the post-playback
 * echo tail. The always-on listener uses this to avoid transcribing the AI's
 * own voice (or talking over a reply that hasn't started playing yet) back
 * into the conversation.
 */
function isSpeaking(): boolean {
  return audible || interviewerBusy || Date.now() < echoTailUntil;
}

/**
 * Marks whether the interviewer is composing a reply — call this the moment
 * a model request starts, and clear it once the reply has either been spoken
 * or (if voice is off) just landed as text. The mic stays closed for the
 * whole span so the candidate can never start talking into a gap before the
 * reply's TTS audio is ready to play.
 */
export function setInterviewerBusy(busy: boolean) {
  if (busy === interviewerBusy) return;
  interviewerBusy = busy;
  // Reflect the combined state, not just this flag: if playback or the echo
  // tail is still holding the mic shut, a listener must not see "false" here.
  const speaking = isSpeaking();
  speakingListeners.forEach((listener) => listener(speaking));
}

/**
 * Subscribes to the interviewer's playback state. Listening engines use this to
 * close the mic for the duration rather than filtering afterwards: by the time
 * a transcript arrives the playback that produced it has usually already
 * finished, so a check at that point can't tell our own voice from the user's.
 *
 * Fires `false` only once the echo tail has elapsed, so it is safe to reopen
 * the mic the moment a listener sees it.
 */
export function subscribeSpeaking(listener: (speaking: boolean) => void): () => void {
  speakingListeners.add(listener);
  return () => {
    speakingListeners.delete(listener);
  };
}

/** True while the mic is held closed for playback — the UI says so. */
export function isInterviewerSpeaking(): boolean {
  return isSpeaking();
}

/** Flips the shared playback state and tells the listening engines about it. */
function setAudible(next: boolean) {
  if (next === audible) return;
  audible = next;

  if (echoTailTimer !== null) {
    clearTimeout(echoTailTimer);
    echoTailTimer = null;
  }

  if (next) {
    echoTailUntil = 0;
    speakingListeners.forEach((listener) => listener(true));
    return;
  }

  // Hold the mic closed a moment longer, so the room's echo of the last
  // syllable isn't the first thing it hears.
  echoTailUntil = Date.now() + ECHO_TAIL_MS;
  echoTailTimer = setTimeout(() => {
    echoTailTimer = null;
    // Re-check the combined state rather than assuming "false": a new reply
    // may have started composing (interviewerBusy) during the tail.
    if (!audible) speakingListeners.forEach((listener) => listener(isSpeaking()));
  }, ECHO_TAIL_MS);
}

function releaseCurrent() {
  if (!current) return;
  current.audio.pause();
  // Freeing the blob matters here: replies are synthesized continuously, so
  // leaked object URLs would accumulate for the life of the interview.
  if (current.url) URL.revokeObjectURL(current.url);
  // Dropping the src (not just pausing) cancels the in-progress network
  // request for the streamed path — pausing alone leaves the browser still
  // downloading a reply nobody is going to hear.
  current.audio.removeAttribute("src");
  current.audio.load();
  current = null;
  setAudible(false);
}

/** Releases `audio` once it finishes, provided a newer attempt hasn't already. */
function releaseWhenEnded(audio: HTMLAudioElement) {
  audio.addEventListener("ended", () => {
    if (current?.audio === audio) releaseCurrent();
  });
}

/**
 * Alex is told never to use LaTeX, but the model slips occasionally
 * ("$O(n^2)$"), and ElevenLabs reads that literally — "dollar sign, O, open
 * paren, n, caret, two". This is a last line of defense before synthesis, not
 * a general LaTeX renderer: it only handles the handful of things that show up
 * in complexity talk. The chat bubble still shows the model's raw text; only
 * what gets spoken is cleaned up.
 */
function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\$+/g, "")
    .replace(/\\times/gi, " times")
    .replace(/\\cdot/gi, " times")
    .replace(/\\log/gi, "log")
    .replace(/\\sqrt/gi, "square root of")
    .replace(/\^\{([^}]+)\}/g, " to the $1")
    .replace(/\^2\b/g, " squared")
    .replace(/\^3\b/g, " cubed")
    .replace(/\^(-?\d+)/g, " to the power of $1")
    .replace(/\^([a-zA-Z])\b/g, " to the $1")
    .replace(/\\/g, "")
    // Whatever braces are left are LaTeX grouping (e.g. \sqrt{n} above became
    // "square root of{n}") rather than meaningful punctuation, so unwrap them.
    .replace(/\{([^{}]*)\}/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Human-readable reason an `<audio>` element failed, for logging. */
function describeAudioError(audio: HTMLAudioElement): string {
  const names: Record<number, string> = {
    1: "aborted",
    2: "network error",
    3: "decode error",
    4: "source not supported",
  };
  const code = audio.error?.code;
  return code ? (names[code] ?? `error code ${code}`) : "unknown error";
}

/**
 * Synthesizes `text` with our ElevenLabs backend and plays it. Any utterance
 * already playing (or still being fetched) is cancelled first.
 *
 * Short replies point the `<audio>` element straight at the streaming
 * endpoint (GET, text in the query string) so the browser can start playback
 * as soon as the first bytes of the reply arrive. Buffering the whole reply
 * first — fetch, await the full blob, then play — was adding the entire
 * synthesis + download time to the gap between the candidate finishing and
 * the interviewer starting to talk. Replies too long to fit a URL comfortably
 * fall back to that buffered path.
 */
export async function speak(text: string) {
  if (typeof window === "undefined" || !text.trim()) return;
  const spoken = sanitizeForSpeech(text);
  if (!spoken) return;

  stopSpeaking();

  const controller = new AbortController();
  inFlight = controller;
  let element: HTMLAudioElement | null = null;

  // Close the mic *before* the request goes out, not after it resolves: the
  // fetch + TTS synthesis can take seconds, and that whole window is otherwise
  // an open mic the candidate can talk over the about-to-arrive reply into.
  setAudible(true);

  try {
    const encodedText = encodeURIComponent(spoken);

    if (encodedText.length <= MAX_STREAM_URL_TEXT_LENGTH) {
      const audio = new Audio();
      current = { audio, url: null };
      releaseWhenEnded(audio);

      // HTTP/decode failures on the underlying request surface as "error" on
      // the element rather than a play() rejection, and can also arrive after
      // playback has already started (a network drop mid-stream) — handle
      // cleanup here rather than relying on play() alone.
      audio.addEventListener("error", () => {
        if (current?.audio !== audio) return;
        console.error(`[speak] playback failed: ${describeAudioError(audio)}`);
        releaseCurrent();
      });

      audio.src = `/api/stream-speech?text=${encodedText}`;
      try {
        await audio.play();
      } catch (error) {
        // Already cleaned up by the "error" listener above if that's what
        // caused this rejection; only act if this is a distinct failure
        // (e.g. an autoplay-policy rejection with no element-level error).
        if (current?.audio === audio) {
          console.error("[speak] playback failed to start:", error);
          releaseCurrent();
        }
      }
      return;
    }

    const res = await fetch("/api/stream-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: spoken }),
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
    element = audio;
    current = { audio, url };
    releaseWhenEnded(audio);

    // Already closed above, well before the first syllable.
    await audio.play();
  } catch (error) {
    // Either explicitly cancelled (stopSpeaking aborts this controller
    // regardless of which path was taken) or superseded by a newer attempt
    // that has already taken over `current` — either way, that path already
    // owns the mic state, so leave it alone.
    if (controller.signal.aborted) return;
    if (inFlight === controller) inFlight = null;
    // A failed synthesis must not leave the mic closed forever. Only clean up
    // if a later utterance hasn't already superseded ours.
    if (element && current?.audio === element) releaseCurrent();
    // The mic was closed before the request even started, but there's no
    // `current` for releaseCurrent() to tear down if synthesis failed before
    // playback began — reopen explicitly in that case.
    else if (inFlight === null) setAudible(false);
    console.error("[speak] text-to-speech failed:", error);
  }
}

export function stopSpeaking() {
  inFlight?.abort();
  inFlight = null;
  releaseCurrent();
  // releaseCurrent() only flips audible false if `current` exists; stopSpeaking()
  // can also be called while a request is still in flight (mic already closed
  // by speak(), before any audio element existed), so reopen unconditionally.
  setAudible(false);
}

/* --------------------------------------------------------------- listening -- */

type Segment = {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  /** Accumulated voiced time, used to tell speech from a stray noise. */
  loudMs: number;
  lastLoudAt: number;
  /** When the segment was last flushed out for a live-preview transcription. */
  lastPartialAt: number;
  /** Guards against overlapping partial requests for the same segment. */
  partialInFlight: boolean;
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
  onPartial: (transcript: string) => void,
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
  let unsubscribeSpeaking: (() => void) | null = null;
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

  /** The container MediaRecorder actually used, plus the bytes captured so far. */
  function segmentBlob(active: Segment): { blob: Blob; type: string } {
    // The browser may have fallen back to a different container than we asked
    // for, so trust the recorder over our preference list.
    const type = active.recorder.mimeType || mimeType || "audio/webm";
    return { blob: new Blob(active.chunks, { type }), type };
  }

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
      lastPartialAt: 0,
      partialInFlight: false,
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

  /**
   * Re-transcribes the utterance so far, so the candidate sees words appear
   * while they're still talking instead of a beat after they stop.
   * `requestData()` flushes the recorder's internal buffer through the same
   * `dataavailable` handler `endSegment` uses, without stopping the recording;
   * the chunks captured since the segment began already form a valid,
   * independently-decodable container.
   */
  function maybeRequestPartial(active: Segment, now: number) {
    if (active.partialInFlight) return;
    if (active.loudMs < MIN_SPEECH_MS) return;
    if (now - active.lastPartialAt < PARTIAL_INTERVAL_MS) return;

    active.lastPartialAt = now;
    active.partialInFlight = true;
    active.recorder.requestData();

    // dataavailable is delivered as a separate task, so give it a tick before
    // reading the chunks it appends.
    setTimeout(() => {
      active.partialInFlight = false;
      if (stopped || segment !== active) return;

      const { blob, type } = segmentBlob(active);
      if (blob.size === 0) return;

      void (async () => {
        try {
          const text = await transcribe(blob, type);
          // The segment may have ended (or been superseded) while this was in
          // flight; a final result is already on its way in that case.
          if (!stopped && segment === active && text) onPartial(text);
        } catch (error) {
          // Silent: this is a best-effort preview, and the same segment's
          // final transcription (or the unavailable/error handling there)
          // will surface anything that actually matters.
          console.warn("[startListening] partial transcription failed:", error);
        }
      })();
    }, 0);
  }

  /** Closes the current segment, transcribing it only if it held real speech. */
  function endSegment(upload: boolean) {
    const active = segment;
    segment = null;
    if (!active) return;

    // The live preview is superseded by either the final transcript (about to
    // be requested below) or nothing at all — either way, stop showing it.
    onPartial("");

    const worthSending = upload && active.loudMs >= MIN_SPEECH_MS;

    active.recorder.addEventListener("stop", () => {
      if (!worthSending) return;

      const { blob, type } = segmentBlob(active);
      if (blob.size === 0) return;

      void (async () => {
        try {
          const text = await transcribe(blob, type);
          if (!stopped && text) onResult(text);
        } catch (error) {
          // A bad key or unpaid plan won't recover on the next utterance, so
          // hand off instead of failing silently on every turn. That path is
          // handled, so it's a warning — only surprises are errors.
          if (isUnrecoverable(error)) {
            console.warn("[startListening] transcription unavailable:", error);
            if (!stopped) onUnavailable();
          } else {
            console.error("[startListening] transcription failed:", error);
          }
        }
      })();
    });

    if (active.recorder.state !== "inactive") active.recorder.stop();
  }

  /** Mutes or unmutes the capture device for the interviewer's playback. */
  function setMicMuted(muted: boolean) {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  function onTick(rms: number) {
    const now = Date.now();

    // Belt and braces: the track is muted for playback, but the VAD still runs,
    // so drop any segment straddling the transition instead of uploading a
    // half-second of our own voice.
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

    if (hasSpeech) maybeRequestPartial(segment, now);

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

    // The mic may have been granted mid-sentence, so sync before subscribing.
    setMicMuted(isSpeaking());
    unsubscribeSpeaking = subscribeSpeaking((speaking) => {
      if (stopped) return;
      setMicMuted(speaking);
      if (speaking) {
        endSegment(false);
      } else if (!segment) {
        beginSegment();
      }
    });

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
    unsubscribeSpeaking?.();
    unsubscribeSpeaking = null;

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
  /** Index of the first result this event revises; earlier ones are settled. */
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & {
      /** False while the engine is still revising this phrase. */
      isFinal: boolean;
    }
  >;
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
  /** Ends the session and discards audio already captured, unlike stop(). */
  abort: () => void;
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
  onPartial: (transcript: string) => void,
  onEnd: () => void
): (() => void) | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  let stopped = false;
  /** Whether a recognition session is currently open. start() throws if one is. */
  let running = false;
  /** Closed for the interviewer's playback; resumes when it finishes. */
  let suppressed = false;

  const recognition = new Ctor();
  recognition.continuous = true;
  // Revised guesses as the words come out, so the transcript appears while the
  // candidate is still talking instead of a beat after they stop.
  recognition.interimResults = true;
  recognition.lang = "en-US";

  /** Opens a session, reporting whether it took. */
  function begin(): boolean {
    if (stopped || suppressed || running) return true;
    try {
      recognition.start();
      running = true;
      return true;
    } catch (error) {
      console.error("[startListening] browser recognition failed to start:", error);
      return false;
    }
  }

  recognition.onresult = (event) => {
    // Last line of defence. Results describe audio captured some time ago, so
    // one that *arrives* now may have been *spoken* during playback — the
    // session is aborted for playback precisely because this check can't tell.
    if (stopped || suppressed || isSpeaking()) return;

    // Everything before resultIndex is settled and already reported.
    let pending = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result?.[0]?.transcript?.trim();
      if (!transcript) continue;

      if (result!.isFinal) onResult(transcript);
      else pending = pending ? `${pending} ${transcript}` : transcript;
    }

    // Empty once the phrase settles, which clears the live line.
    onPartial(pending);
  };

  recognition.onerror = () => {
    // Errors here are usually a transient no-speech timeout; onend follows and
    // restarts us, so there's nothing to do.
  };

  recognition.onend = () => {
    running = false;
    if (stopped) {
      onEnd();
      return;
    }
    // Aborted for playback; the subscription below reopens it afterwards.
    if (suppressed) return;
    // Chrome ends a session on its own every so often; restart to stay on.
    if (!begin()) onEnd();
  };

  const unsubscribeSpeaking = subscribeSpeaking((speaking) => {
    if (stopped) return;
    suppressed = speaking;
    if (speaking) {
      // abort(), not stop(): stop() finalizes the phrase in progress and
      // delivers it, which is exactly the interviewer's own voice we're trying
      // to throw away.
      if (running) recognition.abort();
      // Whatever was mid-phrase is being discarded, so stop showing it.
      onPartial("");
    } else {
      begin();
    }
  });

  // Starting mid-playback would capture the tail of the current sentence.
  if (isSpeaking()) {
    suppressed = true;
  } else if (!begin()) {
    unsubscribeSpeaking();
    return null;
  }

  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribeSpeaking();
    onPartial("");
    if (running) recognition.stop();
    else onEnd();
  };
}

/* ------------------------------------------------------------ orchestrator -- */

const STT_UNAVAILABLE_KEY = "interviewai:backend-stt-unavailable";

/**
 * Set once the backend has proven it can't transcribe, so later sessions skip
 * straight to the fallback instead of re-failing on every utterance.
 *
 * Cached in sessionStorage because discovering it costs a whole utterance: the
 * words spoken during the failed attempt are gone, and with them the live
 * transcript for the candidate's first sentence after every reload. It's
 * per-tab and cleared when the tab closes, so a repaired key is picked up by a
 * new tab rather than needing a cache-busting story.
 */
let backendSttUnavailable: boolean | null = null;

function isBackendSttUnavailable(): boolean {
  if (backendSttUnavailable === null) {
    try {
      backendSttUnavailable =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(STT_UNAVAILABLE_KEY) === "1";
    } catch {
      // Storage can be blocked outright; falling back to "try it" is fine.
      backendSttUnavailable = false;
    }
  }
  return backendSttUnavailable;
}

function markBackendSttUnavailable() {
  backendSttUnavailable = true;
  try {
    sessionStorage?.setItem(STT_UNAVAILABLE_KEY, "1");
  } catch {
    // Not worth failing the interview over a storage quota.
  }
}

export type ListeningCallbacks = {
  /** A finished utterance, ready to act on. */
  onResult: (transcript: string) => void;
  /**
   * The utterance still in progress, revised as more words arrive, and `""`
   * once nothing is pending. Both engines produce these: the browser engine
   * revises its guess continuously, while the Scribe engine periodically
   * re-transcribes the recording so far.
   */
  onPartial?: (transcript: string) => void;
  onEnd: () => void;
};

/**
 * Holds the microphone open and reports each utterance as the speaker finishes
 * it, so the caller never has to press anything.
 *
 * Prefers our ElevenLabs backend and silently switches to the browser's own
 * recognition if the backend can't transcribe (missing key permission, unpaid
 * plan). `onResult` may fire many times; `onEnd` fires once, when listening
 * stops for good. Returns null if no engine is available at all.
 */
export function startListening({
  onResult,
  onPartial = () => {},
  onEnd,
}: ListeningCallbacks): (() => void) | null {
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
    active = startBrowserListening(onResult, onPartial, innerEnd);
    if (!active) {
      console.error("[startListening] no transcription engine available");
      finish();
    }
  };

  if (isBackendSttUnavailable()) {
    startFallback();
  } else {
    active = startBackendListening(onResult, onPartial, innerEnd, () => {
      if (stopped || isBackendSttUnavailable()) return;
      markBackendSttUnavailable();
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
    // Each engine clears its own pending partial on the way out, including
    // during an engine swap, where this teardown doesn't run.
    active = null;
    current?.();
    finish();
  };
}
