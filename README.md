# SignPulseAI — ASL to English Translator

A real-time American Sign Language (ASL) → English translation web app. Sign in front of your webcam, optionally speak, and get a fluent English sentence displayed on screen and spoken aloud — all in under 3 seconds.

![Dark mode UI with webcam preview, session controls, and translation output](public/nativelyai.svg)

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Webcam      │────▶│  MediaPipe   │────▶│  Gemini (Edge   │────▶│  Assembled   │
│  (your sign) │     │  Hand       │     │  Function)      │     │  Sentence    │
│              │     │  Landmarks   │     │  interprets     │     │              │
└──────────────┘     └──────────────┘     │  the sign       │     └──────────────┘
                                          └─────────────────┘            │
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐            ▼
│  Microphone  │────▶│  Speechmatics│────▶│  Gemini (Edge   │    ┌──────────────┐
│  (speech)    │     │  STT (real-  │     │  Function)      │    │  Display +   │
│              │     │  time WS)    │     │  merges inputs  │    │  TTS aloud   │
└──────────────┘     └──────────────┘     └─────────────────┘    └──────────────┘
```

1. **Camera capture** — Your webcam feed streams at ~15–30 fps
2. **Landmark extraction** — MediaPipe detects hand landmarks in-browser (no server round-trip)
3. **Gesture interpretation** — Landmarks are buffered (~2.5s window) and sent to an edge function powered by **Gemini 2.0 Flash**, which interprets the ASL sign
4. **Speech transcription** (optional) — Your mic audio streams via WebSocket to **Speechmatics** for real-time captions
5. **Sentence assembly** — A second Gemini agent fuses the sign interpretation and speech transcript into natural English
6. **Output** — The sentence appears on screen and is spoken aloud via Speechmatics TTS

## Features

- **Real-time ASL interpretation** — Hand landmarks processed entirely client-side for low latency
- **Dual-input fusion** — Signs + speech merged into one coherent sentence
- **Auto-play TTS** — Each translated sentence spoken aloud (toggle on/off)
- **Rolling transcript** — Full history of all translations, auto-scrolling
- **Error-resilient** — Exponential backoff retry, graceful no-hands detection, fallback on STT failure
- **Accessible** — High-contrast dark mode, ARIA live regions, keyboard navigable
- **Dark mode UI** — High-contrast, camera-friendly dark theme with clear focus states

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS v4 |
| **Build** | Vite 7 |
| **Icons** | Lucide React |
| **Gesture Detection** | MediaPipe Tasks Vision (browser-side) |
| **LLM** | Google Gemini 2.0 Flash (via Supabase Edge Functions) |
| **Speech-to-Text** | Speechmatics real-time WebSocket API |
| **Text-to-Speech** | Speechmatics TTS API |
| **Backend** | Supabase Edge Functions (Deno) |
| **Infrastructure** | Supabase (project hosting, edge functions, secrets) |

## Prerequisites

- **Supabase project** (linked and active)
- **Google Gemini API key** — stored as `GEMINI_API_KEY` in Supabase Secret Manager
- **Speechmatics API key** — stored as `SPEECHMATICS_API_KEY` in Supabase Secret Manager
- **Modern browser** — Chrome, Firefox, or Edge (desktop with webcam)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set secrets in Supabase

These keys are stored securely in Supabase Secret Manager and never reach the browser:

- `GEMINI_API_KEY` — your Google Gemini API key
- `SPEECHMATICS_API_KEY` — your Speechmatics API key

### 3. Deploy Edge Functions

```bash
supabase functions deploy speechmatics-token --no-verify-jwt
supabase functions deploy interpret-gesture --no-verify-jwt
supabase functions deploy assemble --no-verify-jwt
supabase functions deploy tts --no-verify-jwt
```

> `--no-verify-jwt` is used because these functions handle authentication themselves via the API keys in their request bodies, not via Supabase Auth.

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:5173` and click **Start Session** to begin.

## Project Structure

```
├── index.html                          # Entry HTML
├── src/
│   ├── main.tsx                        # React root mount
│   ├── index.css                       # Tailwind + design tokens
│   ├── App.tsx                         # Main layout & component composition
│   ├── components/
│   │   ├── Header.tsx                  # App branding ("SignPulseAI")
│   │   ├── CameraPreview.tsx           # Mirrored webcam feed
│   │   ├── SessionControls.tsx         # Start/End + TTS toggle
│   │   ├── TranslationOutput.tsx       # Current sentence + transcript history
│   │   └── StatusBar.tsx               # Info/warning/error/success messages
│   ├── hooks/
│   │   └── useTranslationPipeline.ts   # Core pipeline hook (landmarks → interpret → assemble → TTS)
│   └── lib/
│       ├── config.ts                   # Public config (URLs, thresholds, timing)
│       ├── types.ts                    # Shared TypeScript types
│       └── supabase.ts                 # Supabase client + edge function callers + TTS audio
├── supabase/functions/
│   ├── speechmatics-token/index.ts     # Mints short-lived JWT for STT WebSocket
│   ├── interpret-gesture/index.ts      # Gemini → ASL sign interpretation
│   ├── assemble/index.ts               # Gemini → merges sign + speech into English
│   └── tts/index.ts                   # Speechmatics TTS audio generation
├── docs/
│   ├── prd/asl-translator.md           # Product Requirements Document
│   └── design-system/MASTER.md         # Design tokens, palette, patterns
└── package.json
```

## Edge Functions

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `speechmatics-token` | — | `{ token: string }` | Generates a 60-second JWT for Speechmatics WebSocket auth |
| `interpret-gesture` | `{ frames }` | `{ gesture, confidence }` | Sends landmark sequences to Gemini 2.0 Flash for ASL interpretation |
| `assemble` | `{ gesture_text, speech_text }` | `{ sentence }` | Merges sign and/or speech into grammatical English via Gemini |
| `tts` | `{ text, voice }` | `{ audio: number[] }` | Generates speech audio via Speechmatics TTS API |

All functions include CORS headers for browser access and exponential retry handling on the client side.

## Configuration

Key tunables in `src/lib/config.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `LANDMARK_BUFFER_MS` | 2500 | How long to buffer hand landmarks before interpretation |
| `INTERPRET_INTERVAL_MS` | 1500 | Min interval between gesture interpretation calls |
| `MAX_RETRIES` | 2 | Retry attempts for failed edge function calls |
| `RETRY_BASE_DELAY_MS` | 2000 | Exponential backoff base delay |
| `NO_HANDS_TIMEOUT_MS` | 5000 | Time before showing "no hands" warning |
| `MOVEMENT_THRESHOLD` | 0.015 | Min landmark movement to trigger re-interpretation |

## Accessibility

- High-contrast color palette (4.5:1 minimum contrast ratio)
- `aria-live="polite"` regions for dynamic content updates
- Visible focus rings on all interactive elements
- Keyboard-navigable controls
- `role="log"` on transcript history for screen readers
- Human-readable error and empty-state messages
- `prefers-reduced-motion` respected

## License

MIT