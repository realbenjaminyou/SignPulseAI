import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  PipelineState,
  PipelineStatus,
  HandData,
  FrameData,
  TranslationEntry,
} from '../lib/types';
import {
  getSpeechmaticsToken,
  interpretGesture,
  assembleSentence,
  generateSpeech,
  speakWithBrowserTTS,
  playPcmAudio,
} from '../lib/supabase';
import {
  LANDMARK_BUFFER_MS,
  INTERPRET_INTERVAL_MS,
  PAUSE_DETECTION_MS,
  NO_HANDS_TIMEOUT_MS,
  MOVEMENT_THRESHOLD,
  TARGET_FPS,
  MAX_FPS,
  SPEECHMATICS_STT_URL,
  SPEECHMATICS_LANGUAGE,
} from '../lib/config';

/* ── Unique ID generator ── */
let idCounter = 0;
function nextId(): string {
  return `t${Date.now()}-${++idCounter}`;
}

/* ── L2 distance between two landmarks ── */
function landmarkDelta(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/* ── Average movement across all landmarks ── */
function averageMovement(
  current: HandData[],
  previous: HandData[],
): number {
  if (current.length === 0 || previous.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (let h = 0; h < Math.min(current.length, previous.length); h++) {
    const cLm = current[h].landmarks;
    const pLm = previous[h].landmarks;
    for (let i = 0; i < Math.min(cLm.length, pLm.length); i++) {
      total += landmarkDelta(cLm[i], pLm[i]);
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

/* ── Initial state ── */

const INITIAL_STATE: PipelineState = {
  status: 'idle',
  currentSentence: '',
  transcript: [],
  fps: 0,
  latency: 0,
  error: null,
  handsDetected: 0,
  sttConnected: false,
  ttsEnabled: true,
};

/* ── Hook ── */

export function useTranslationPipeline() {
  const [state, setState] = useState<PipelineState>(INITIAL_STATE);

  // Refs (mutable, no re-render)
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const statusRef = useRef<PipelineStatus>('idle');
  const ttsEnabledRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  // Landmark buffer
  const landmarkBufferRef = useRef<FrameData[]>([]);
  const lastInterpretRef = useRef<number>(0);
  const lastHandSeenRef = useRef<number>(Date.now());
  const previousHandsRef = useRef<HandData[]>([]);
  const lastMovementRef = useRef<number>(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // STT
  const sttWsRef = useRef<WebSocket | null>(null);

  // FPS tracking
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(Date.now());

  // Speech queue
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  // ── Helpers ──

  const updateState = useCallback((patch: Partial<PipelineState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── MediaPipe hand landmark detection (browser-side) ──

  const handLandmarkerRef = useRef<any>(null);
  const mediapipeInitializedRef = useRef(false);

  const initMediaPipe = useCallback(async () => {
    if (mediapipeInitializedRef.current) return;

    try {
      // Dynamically import the task-vision module
      const { HandLandmarker, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker_lite/float16/1/hand_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        },
      );

      mediapipeInitializedRef.current = true;
    } catch (err) {
      console.error('Failed to initialize MediaPipe:', err);
      updateState({
        error: 'Failed to initialize hand detection. Please check your browser.',
        status: 'error',
      });
      throw err;
    }
  }, [updateState]);

  // ── STT WebSocket ──

  const connectStt = useCallback(async () => {
    try {
      const token = await getSpeechmaticsToken();
      const ws = new WebSocket(`${SPEECHMATICS_STT_URL}?jwt=${token}`);

      ws.onopen = () => {
        updateState({ sttConnected: true });

        // Send StartRecognition message
        ws.send(
          JSON.stringify({
            message: 'StartRecognition',
            audio_format: {
              type: 'raw',
              encoding: 'pcm_f32le',
              sample_rate: 16000,
            },
            transcription_config: {
              language: SPEECHMATICS_LANGUAGE,
              max_delay: 2,
              enable_partials: true,
            },
          }),
        );

        // Start sending mic audio
        startMicStream(ws);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (
          msg.message === 'AddPartialTranscript' ||
          msg.message === 'AddTranscript'
        ) {
          const text = msg.results?.map((r: any) => r.alternatives?.[0]?.content ?? '').join(' ').trim();
          if (text) {
            // Add speech transcript entry
            const entry: TranslationEntry = {
              id: nextId(),
              text,
              timestamp: Date.now(),
              confidence: msg.results?.[0]?.alternatives?.[0]?.confidence ?? 0.5,
              type: 'speech',
            };
            setState((prev) => ({
              ...prev,
              transcript: [...prev.transcript, entry],
            }));
          }
        } else if (msg.message === 'EndOfTranscript') {
          ws.close();
        }
      };

      ws.onerror = () => {
        updateState({
          sttConnected: false,
          error: 'Speech-to-text connection error',
        });
      };

      ws.onclose = () => {
        updateState({
          sttConnected: false,
        });
      };

      sttWsRef.current = ws;
    } catch (err) {
      console.error('STT connection failed:', err);
      updateState({
        sttConnected: false,
        error: 'Failed to connect speech-to-text',
      });
    }
  }, [updateState]);

  // ── Mic stream → STT ──

  let micStream: MediaStream | null = null;

  async function startMicStream(ws: WebSocket) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(micStream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const input = e.inputBuffer.getChannelData(0);
          // Send as ArrayBuffer
          ws.send(input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          ));
        }
      };
    } catch (err) {
      console.error('Mic access failed:', err);
      updateState({ error: 'Microphone access denied' });
    }
  }

  // ── Gesture interpretation ──

  const runInterpretation = useCallback(async () => {
    const buffer = landmarkBufferRef.current;
    if (buffer.length === 0) return;

    const now = Date.now();
    if (now - lastInterpretRef.current < INTERPRET_INTERVAL_MS) return;

    // Check movement threshold — skip if no meaningful movement
    if (lastMovementRef.current < MOVEMENT_THRESHOLD && buffer.length > 3) {
      return;
    }

    lastInterpretRef.current = now;

    try {
      const abortController = abortRef.current;
      if (!abortController) return;

      // Send the landmark frames for interpretation
      const result = await interpretGesture(
        buffer.map((f) => f.hands),
        abortController.signal,
      );

      if (result.success && result.data) {
        const { gesture, confidence } = result.data;

        if (gesture && confidence >= 0.6) {
          const entry: TranslationEntry = {
            id: nextId(),
            text: gesture,
            timestamp: now,
            confidence,
            type: 'gesture',
          };

          setState((prev) => ({
            ...prev,
            transcript: [...prev.transcript, entry],
          }));
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Interpretation failed:', err);
    }
  }, []);

  // ── Sentence assembly ──

  const runAssembly = useCallback(
    async (gestureText: string, speechText: string | null) => {
      try {
        const abortController = abortRef.current;
        if (!abortController) return;

        const sentence = await assembleSentence(
          gestureText || null,
          speechText || null,
          abortController.signal,
        );

        if (sentence) {
          const entry: TranslationEntry = {
            id: nextId(),
            text: sentence,
            timestamp: Date.now(),
            confidence: 1.0,
            type: 'assembled',
          };

          setState((prev) => ({
            ...prev,
            currentSentence: sentence,
            transcript: [...prev.transcript, entry],
          }));

          // Queue TTS
          if (ttsEnabledRef.current) {
            speechQueueRef.current.push(sentence);
            processSpeechQueue();
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Assembly failed:', err);
      }
    },
    [],
  );

  // ── Speech queue processing ──

  async function processSpeechQueue() {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
    isSpeakingRef.current = true;

    const text = speechQueueRef.current.shift()!;

    try {
      // Try edge function TTS first, fall back to browser TTS
      const audio = await generateSpeech(text);
      if (audio && audio.length > 0) {
        await playPcmAudio(audio);
      } else {
        throw new Error('Empty audio response');
      }
    } catch {
      // Fallback to browser TTS
      try {
        await speakWithBrowserTTS(text);
      } catch (ttsErr) {
        console.error('TTS fallback also failed:', ttsErr);
      }
    } finally {
      isSpeakingRef.current = false;
      // Process next in queue
      if (speechQueueRef.current.length > 0) {
        processSpeechQueue();
      }
    }
  }

  // ── Pause detection → trigger assembly ──

  const detectPause = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    pauseTimerRef.current = setTimeout(() => {
      // Collect recent gesture text entries
      const recentGestures = landmarkBufferRef.current;
      if (recentGestures.length < 3) return;

      // Get transcript entries since last assembly
      setState((prev) => {
        const lastAssembledIdx = prev.transcript
          .map((t, i) => (t.type === 'assembled' ? i : -1))
          .filter((i) => i >= 0)
          .pop() ?? -1;

        const recentEntries = prev.transcript.slice(lastAssembledIdx + 1);
        const gestureTexts = recentEntries
          .filter((e) => e.type === 'gesture')
          .map((e) => e.text);
        const speechTexts = recentEntries
          .filter((e) => e.type === 'speech')
          .map((e) => e.text);

        if (gestureTexts.length > 0 || speechTexts.length > 0) {
          const gestureStr = gestureTexts.join(' ');
          const speechStr = speechTexts.length > 0 ? speechTexts.join(' ') : null;

          // Trigger assembly (async, outside setState)
          setTimeout(() => runAssembly(gestureStr, speechStr), 0);
        }

        return prev;
      });
    }, PAUSE_DETECTION_MS);
  }, [runAssembly]);

  // ── Main capture loop ──

  const captureLoop = useCallback(async () => {
    if (statusRef.current !== 'running') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !handLandmarkerRef.current) {
      animFrameRef.current = requestAnimationFrame(captureLoop);
      return;
    }

    // FPS tracking
    frameCountRef.current++;
    const elapsed = Date.now() - fpsTimerRef.current;
    if (elapsed >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      updateState({ fps: Math.min(fps, MAX_FPS) });
      frameCountRef.current = 0;
      fpsTimerRef.current = Date.now();
    }

    const now = Date.now();

    // Run MediaPipe hand detection
    try {
      const result = handLandmarkerRef.current.detectForVideo(video, now);

      const hands: HandData[] = [];

      if (result.landmarks && result.landmarks.length > 0) {
        for (let h = 0; h < result.landmarks.length; h++) {
          const lm = result.landmarks[h];
          const handedness = result.handedness?.[h]?.[0]?.categoryName ?? 'Right';
          const confidence = result.handedness?.[h]?.[0]?.score ?? 0.5;

          hands.push({
            landmarks: lm.map((p: any) => ({
              x: p.x,
              y: p.y,
              z: p.z,
              visibility: 1,
            })),
            handedness: handedness as 'Left' | 'Right',
            confidence,
          });
        }
      }

      const frameData: FrameData = {
        hands,
        timestamp: now,
      };

      // Calculate movement
      if (hands.length > 0) {
        lastHandSeenRef.current = now;
        const movement = averageMovement(hands, previousHandsRef.current);
        lastMovementRef.current = movement;
        previousHandsRef.current = hands;

        // Add to buffer
        landmarkBufferRef.current.push(frameData);

        // Keep buffer length limited
        const maxBufferSize = Math.ceil(LANDMARK_BUFFER_MS / (1000 / TARGET_FPS));
        if (landmarkBufferRef.current.length > maxBufferSize) {
          landmarkBufferRef.current = landmarkBufferRef.current.slice(-maxBufferSize);
        }

        // Reset pause timer
        detectPause();

        // Run interpretation
        runInterpretation();
      } else {
        // No hands detected
        lastMovementRef.current = 0;
      }

      // Update state: hands detected
      const handsCount = hands.filter((h) => h.confidence >= 0.5).length;
      updateState({ handsDetected: handsCount });

      // No hands warning
      if (handsCount === 0 && now - lastHandSeenRef.current > NO_HANDS_TIMEOUT_MS) {
        if (!state.error) {
          updateState({ error: 'No hands detected. Please position your hands in frame.' });
        }
      } else if (handsCount > 0 && state.error === 'No hands detected. Please position your hands in frame.') {
        updateState({ error: null });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'InvalidStateError') {
        // Expected when stopping
      } else {
        console.error('Capture loop error:', err);
      }
    }

    if (statusRef.current === 'running') {
      const nextDelay = 1000 / TARGET_FPS;
      setTimeout(() => {
        animFrameRef.current = requestAnimationFrame(captureLoop);
      }, nextDelay);
    }
  }, [updateState, runInterpretation, detectPause, state.error]);

  // ── Start session ──

  const startSession = useCallback(async () => {
    if (statusRef.current === 'running') return;

    try {
      statusRef.current = 'initializing';
      updateState({
        status: 'initializing',
        error: null,
        currentSentence: '',
        transcript: [],
        fps: 0,
        latency: 0,
        handsDetected: 0,
      });

      abortRef.current = new AbortController();

      // Init MediaPipe
      await initMediaPipe();

      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: TARGET_FPS },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Create hidden video element for processing
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      await video.play();
      videoRef.current = video;

      // Create hidden canvas for frame extraction
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;

      // Reset tracking
      landmarkBufferRef.current = [];
      lastInterpretRef.current = Date.now();
      lastHandSeenRef.current = Date.now();
      previousHandsRef.current = [];
      lastMovementRef.current = 0;
      frameCountRef.current = 0;
      fpsTimerRef.current = Date.now();
      speechQueueRef.current = [];
      isSpeakingRef.current = false;

      // Start capture loop
      statusRef.current = 'running';
      updateState({ status: 'running' });
      animFrameRef.current = requestAnimationFrame(captureLoop);

      // Connect STT
      connectStt();
    } catch (err: any) {
      console.error('Failed to start session:', err);
      statusRef.current = 'error';
      updateState({
        status: 'error',
        error: err?.message ?? 'Failed to start camera or hand detection',
      });
    }
  }, [initMediaPipe, captureLoop, connectStt, updateState]);

  // ── End session ──

  const endSession = useCallback(() => {
    statusRef.current = 'ended';
    updateState({ status: 'ended' });

    // Abort pending requests
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Stop capture loop
    cancelAnimationFrame(animFrameRef.current);

    // Close STT
    if (sttWsRef.current) {
      sttWsRef.current.close();
      sttWsRef.current = null;
    }

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Clean up video/canvas
    videoRef.current = null;
    canvasRef.current = null;

    // Clean up mic
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }

    // Clear timers
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    // Clear buffers
    landmarkBufferRef.current = [];
    speechQueueRef.current = [];
    isSpeakingRef.current = false;

    updateState({
      fps: 0,
      latency: 0,
      handsDetected: 0,
      sttConnected: false,
    });
  }, [updateState]);

  // ── Toggle TTS ──

  const toggleTts = useCallback(() => {
    ttsEnabledRef.current = !ttsEnabledRef.current;
    updateState({ ttsEnabled: ttsEnabledRef.current });
  }, [updateState]);

  // ── Toggle session ──

  const toggleSession = useCallback(() => {
    if (statusRef.current === 'running') {
      endSession();
    } else {
      startSession();
    }
  }, [startSession, endSession]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (sttWsRef.current) {
        sttWsRef.current.close();
      }
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    stream: streamRef.current,
    toggleSession,
    toggleTts,
    startSession,
    endSession,
  };
}