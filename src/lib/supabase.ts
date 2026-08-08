import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "./config";

export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
);

/** Generic edge function caller with retry logic and logging */
export async function callEdgeFunction<TOutput>(
  functionName: string,
  input?: Record<string, unknown>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    signal?: AbortSignal;
  },
): Promise<TOutput> {
  const maxRetries = options?.maxRetries ?? CONFIG.MAX_RETRIES;
  const baseDelay = options?.baseDelayMs ?? CONFIG.RETRY_BASE_DELAY_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: input,
        signal: options?.signal,
      });

      if (error) {
        throw new Error(
          `Edge function ${functionName} returned error: ${error.message}`,
        );
      }

      return data as TOutput;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort
      if (err instanceof DOMException && err.name === "AbortError") {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[Pipeline] ${functionName} attempt ${attempt + 1} failed, ` +
            `retrying in ${delay}ms...`,
          lastError.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`Unknown error calling ${functionName}`);
}

/** Gesture interpretation */
export interface InterpretGestureInput {
  frames: Array<{
    landmarks: number[][];
    handedness: string[];
  }>;
}

export interface InterpretGestureOutput {
  gesture: string;
  confidence: number;
}

export async function interpretGesture(
  frames: InterpretGestureInput["frames"],
  signal?: AbortSignal,
): Promise<InterpretGestureOutput> {
  return callEdgeFunction<InterpretGestureOutput>(
    "interpret-gesture",
    { frames },
    { signal },
  );
}

/** Assemble sentence from gesture + speech */
export async function assembleSentence(
  gestureText: string | null,
  speechText: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const result = await callEdgeFunction<{ sentence: string }>(
    "assemble",
    { gesture_text: gestureText, speech_text: speechText },
    { signal },
  );
  return result.sentence;
}

/** Text-to-speech */
export async function generateTTS(
  text: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const result = await callEdgeFunction<{ audio: number[] }>(
    "tts",
    { text, voice: "sarah" },
    { signal },
  );

  // Convert number array back to ArrayBuffer
  const uint8 = new Uint8Array(result.audio);
  return uint8.buffer;
}

/** Get Speechmatics STT JWT token */
export async function getSTTToken(
  signal?: AbortSignal,
): Promise<string> {
  const result = await callEdgeFunction<{ token: string }>(
    "speechmatics-token",
    undefined,
    { signal },
  );
  return result.token;
}

/** Audio context singleton for TTS playback */
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Play TTS audio from ArrayBuffer */
export async function playTTSAudio(
  audioData: ArrayBuffer,
): Promise<void> {
  try {
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    const buffer = await ctx.decodeAudioData(audioData);
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  } catch (err) {
    console.error("[TTS] Failed to play audio:", err);
  }
}