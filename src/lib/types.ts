/* ── Hand Landmark types ── */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandData {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
  confidence: number;
}

export interface FrameData {
  hands: HandData[];
  timestamp: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkData {
  handedness: 'Left' | 'Right';
  landmarks: HandLandmark[];
}

export interface HandLandmarkPayload {
  timestamp: number;
  hands_detected: number;
  hands: HandLandmarkData[];
}

/* ── Gesture Interpretation ── */

export interface GestureResult {
  gesture: string;
  confidence: number;
  raw?: string;
}

export interface InterpretResponse {
  success: boolean;
  data?: GestureResult;
  error?: string;
}

/* ── Sentence Assembly ── */

export interface AssembleRequest {
  gesture_text: string | null;
  speech_text: string | null;
}

export interface AssembleResponse {
  success: boolean;
  data?: {
    sentence: string;
  };
  error?: string;
}

/* ── TTS ── */

export interface TtsRequest {
  text: string;
  voice?: string;
}

export interface TtsResponse {
  success: boolean;
  data?: {
    audio: number[];  // PCM float32 samples
  };
  error?: string;
}

/* ── Speechmatics Token ── */

export interface SpeechmaticsTokenResponse {
  success: boolean;
  data?: {
    token: string;
  };
  error?: string;
}

/* ── Pipeline State ── */

export type PipelineStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'error'
  | 'ended';

export interface TranslationEntry {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
  type: 'gesture' | 'speech' | 'assembled';
}

export interface PipelineState {
  status: PipelineStatus;
  currentSentence: string;
  transcript: TranslationEntry[];
  fps: number;
  latency: number;
  error: string | null;
  handsDetected: number;
  sttConnected: boolean;
  ttsEnabled: boolean;
}

/* ── Supabase Edge Function names ── */

export type EdgeFunctionName =
  | 'speechmatics-token'
  | 'interpret-gesture'
  | 'assemble'
  | 'tts';

/* ── Confidence levels ── */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-red-400';
  }
}

export function getConfidenceBg(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'bg-green-500/10 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/10 border-yellow-500/30';
    case 'low':
      return 'bg-red-500/10 border-red-500/30';
  }
}