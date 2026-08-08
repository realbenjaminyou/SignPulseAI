/** A single normalized hand landmark from MediaPipe */
export interface HandLandmark {
  x: number; // 0–1 normalized
  y: number;
  z: number;
}

/** Snapshot of all hand landmarks at one point in time */
export interface LandmarkFrame {
  timestamp: number;
  hands: HandLandmark[][]; // one array per detected hand, 21 landmarks each
  handedness: string[];    // "Left" or "Right" for each hand
}

/** Result from the interpret-gesture edge function */
export interface GestureInterpretation {
  gesture: string;   // e.g. "hello", "my name is"
  confidence: number; // 0–1
}

/** Result from Speechmatics STT */
export interface SpeechTranscription {
  text: string;
  is_final: boolean;
}

/** Input to the assemble edge function */
export interface AssembleInput {
  gesture_text: string | null;
  speech_text: string | null;
}

/** Output from the assemble edge function */
export interface AssembleOutput {
  sentence: string;
}

/** A single entry in the rolling transcript */
export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  isNew?: boolean;
}

/** Overall session state */
export type SessionState = "idle" | "starting" | "active" | "stopping";

/** Status messages shown to the user */
export type StatusMessage =
  | { type: "info"; text: string }
  | { type: "warning"; text: string }
  | { type: "error"; text: string }
  | { type: "success"; text: string };

/** Pipeline events for logging */
export interface PipelineLog {
  id: string;
  timestamp: number;
  event: string;
  details?: Record<string, unknown>;
  error?: string;
}