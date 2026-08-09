import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './config';
import type {
  EdgeFunctionName,
  InterpretResponse,
  AssembleRequest,
  AssembleResponse,
  TtsRequest,
  TtsResponse,
  SpeechmaticsTokenResponse,
  HandLandmarkPayload,
} from './types';

/* ── Lazy Supabase client ── */

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase is not configured. Please connect a Supabase project to enable cloud features.',
      );
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

/* ── Generic edge function caller with retry + exponential backoff ── */

async function callEdgeFunction<T>(
  name: EdgeFunctionName,
  body: object | undefined,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await getSupabase().functions.invoke(name, {
        body: body as Record<string, unknown> | undefined,
        signal,
      });

      if (error) throw new Error(error.message);

      return data as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES && !signal?.aborted) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`Failed to call ${name}`);
}

/* ── Speechmatics token ── */

export async function getSpeechmaticsToken(
  signal?: AbortSignal,
): Promise<string> {
  const res = await callEdgeFunction<SpeechmaticsTokenResponse>(
    'speechmatics-token',
    {},
    signal,
  );

  if (!res.success || !res.data?.token) {
    throw new Error(res.error ?? 'Failed to get Speechmatics token');
  }

  return res.data.token;
}

/* ── Gesture interpretation ── */

export async function interpretGesture(
  frames: HandLandmarkPayload[] | unknown[],
  signal?: AbortSignal,
): Promise<InterpretResponse> {
  return callEdgeFunction<InterpretResponse>(
    'interpret-gesture',
    { frames },
    signal,
  );
}

/* ── Sentence assembly ── */

export async function assembleSentence(
  gestureText: string | null,
  speechText: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const body: AssembleRequest = {
    gesture_text: gestureText,
    speech_text: speechText,
  };

  const res = await callEdgeFunction<AssembleResponse>(
    'assemble',
    body,
    signal,
  );

  if (!res.success || !res.data?.sentence) {
    throw new Error(res.error ?? 'Failed to assemble sentence');
  }

  return res.data.sentence;
}

/* ── Text-to-Speech ── */

export async function generateSpeech(
  text: string,
  voice?: string,
  signal?: AbortSignal,
): Promise<Float32Array> {
  const body: TtsRequest = { text, voice };

  const res = await callEdgeFunction<TtsResponse>('tts', body, signal);

  if (!res.success || !res.data?.audio) {
    throw new Error(res.error ?? 'Failed to generate speech');
  }

  return new Float32Array(res.data.audio) as Float32Array;
}

/* ── Browser TTS fallback ── */

export function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Browser TTS not available'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(e.error));
    window.speechSynthesis.speak(utterance);
  });
}

/* ── Web Audio playback (for PCM audio from edge function) ── */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export async function playPcmAudio(samples: Float32Array): Promise<void> {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  return new Promise((resolve) => {
    source.onended = () => resolve();
    source.start();
  });
}