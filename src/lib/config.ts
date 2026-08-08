/** Public configuration — these values are safe to expose in client code */
export const CONFIG = {
  /** Supabase project URL (public) */
  SUPABASE_URL: "https://wllpkxmuxftzmpfuucdg.supabase.co",

  /** Supabase publishable (anon) key — safe for client-side use */
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHBreG11eGZ0em1wZnV1Y2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDE4NTcsImV4cCI6MjEwMTc3Nzg1N30.FmJUUydjsEhbxOJT_M2z9l8uHBl8E1t0kVozqdsIXzU",

  /** Edge Function base URL */
  EDGE_FUNCTION_BASE: "https://wllpkxmuxftzmpfuucdg.supabase.co/functions/v1",

  /** Speechmatics STT WebSocket URL (eu region) */
  SPEECHMATICS_STT_WS: "wss://eu2.rt.speechmatics.com/v2",

  /** Buffer duration for landmark collection (ms) */
  LANDMARK_BUFFER_MS: 2500,

  /** Interval between sending gesture interpretations (ms) */
  INTERPRET_INTERVAL_MS: 1500,

  /** Max retries for edge function calls */
  MAX_RETRIES: 2,

  /** Retry delay base (ms) — uses exponential backoff */
  RETRY_BASE_DELAY_MS: 2000,

  /** No-hands timeout before showing warning (ms) */
  NO_HANDS_TIMEOUT_MS: 5000,

  /** Minimum movement threshold to trigger re-interpretation */
  MOVEMENT_THRESHOLD: 0.015,

  /** TTS voice */
  TTS_VOICE: "sarah",

  /** MediaPipe model CDN path */
  MEDIAPIPE_WASM_CDN: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",

  /** MediaPipe hand landmarker model path */
  MEDIAPIPE_MODEL:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
} as const;