/* ── Edge Function URLs ── */

const SUPABASE_PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_REF ?? 'project-ref';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const EDGE_FUNCTIONS = {
  speechmaticsToken: `${SUPABASE_PROJECT_REF}/functions/v1/speechmatics-token`,
  interpretGesture: `${SUPABASE_PROJECT_REF}/functions/v1/interpret-gesture`,
  assemble: `${SUPABASE_PROJECT_REF}/functions/v1/assemble`,
  tts: `${SUPABASE_PROJECT_REF}/functions/v1/tts`,
} as const;

export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

/* ── Pipeline timing ── */

/** How long (ms) to buffer hand landmarks before interpretation */
export const LANDMARK_BUFFER_MS = 2500;

/** Minimum interval (ms) between gesture interpretation calls */
export const INTERPRET_INTERVAL_MS = 1500;

/** How long (ms) to wait for a pause in gesture stream before assembling */
export const PAUSE_DETECTION_MS = 1200;

/** Max retries for failed edge function calls */
export const MAX_RETRIES = 2;

/** Exponential backoff base delay (ms) */
export const RETRY_BASE_DELAY_MS = 2000;

/** Time (ms) before showing "no hands" warning */
export const NO_HANDS_TIMEOUT_MS = 5000;

/** Minimum landmark movement (L2 norm) to trigger re-interpretation */
export const MOVEMENT_THRESHOLD = 0.015;

/** Target FPS for camera frame capture */
export const TARGET_FPS = 15;

/** Max FPS for camera */
export const MAX_FPS = 30;

/* ── Camera config ── */

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
    frameRate: { ideal: TARGET_FPS },
  },
  audio: false,
};

/* ── MediaPipe config ── */

export const MEDIAPIPE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker_lite/float16/1/hand_landmarker_lite.task';

export const MAX_HANDS = 2;

export const MIN_HAND_DETECTION_CONFIDENCE = 0.5;

/* ── Speechmatics ── */

export const SPEECHMATICS_STT_URL = 'wss://eu.rt.speechmatics.com/v2';

export const SPEECHMATICS_LANGUAGE = 'en';

/* ── TTS ── */

export const DEFAULT_TTS_VOICE = 'en-US-Wavenet-D';

/* ── Supabase anon key (public, safe for client) ── */

export { SUPABASE_ANON_KEY };