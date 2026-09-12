/** Words that carry no interview content on their own. */
const FILLER_WORDS = new Set([
  "um", "uh", "erm", "hmm", "mhm", "huh", "ah", "oh", "eh",
  "ok", "okay", "yeah", "yep", "yes", "no", "nope", "nah", "sure", "right",
  "hi", "hello", "hey", "cool", "nice", "great", "thanks", "wait", "sorry",
  "alright", "anyway", "so", "well", "like", "test", "testing",
]);

/**
 * Catches a transcript that plainly isn't an answer — coughs, keyboard noise,
 * half-words, or pure filler picked up by an always-on mic. Shared by the
 * client (so noise never becomes a visible chat turn or a network call in the
 * first place) and the server (as a defense-in-depth backstop). Semantic
 * randomness — a fluent but off-topic sentence — can't be caught here; that's
 * left to the model, which is instructed to deflect the same way.
 */
export function looksRandom(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 3) return true;

  const words = trimmed.split(/[^a-z0-9'+\-*/=_<>[\]().]+/).filter(Boolean);
  if (words.length === 0) return true;
  if (words.length <= 3 && words.every((word) => FILLER_WORDS.has(word))) return true;

  // Room noise tends to transcribe as one long vowel-less run of letters.
  const [only] = words;
  if (words.length === 1 && only!.length > 10 && !/[aeiouy]/.test(only!)) return true;

  return false;
}
