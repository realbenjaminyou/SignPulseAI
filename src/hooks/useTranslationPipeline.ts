import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  PipelineState,
  PipelineStatus,
  HandData,
  FrameData,
  TranslationEntry,
  HandLandmarkPayload,
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
  SPEECHMATICS_STT_URL,
  SPEECHMATICS_LANGUAGE,
} from '../lib/config';

/* ── Unique ID generator ── */
let idCounter = 0;
function nextId(): string {
  return `t${Date.now()}-${++idCounter}`;
}

/* ── Fallback local gesture recognizer ── */
function recognizeHandGesture(
  landmarks: Array<{ x: number; y: number; z: number }>,
): { gesture: string; confidence: number } | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexMcp = landmarks[5];
  const middleTip = landmarks[12];
  const middleMcp = landmarks[9];
  const ringTip = landmarks[16];
  const ringMcp = landmarks[13];
  const pinkyTip = landmarks[20];
  const pinkyMcp = landmarks[17];

  const isThumbUp =
    thumbTip.y < wrist.y && indexTip.y > indexMcp.y && middleTip.y > middleMcp.y;
  const isIndexExt = indexTip.y < indexMcp.y;
  const isMiddleExt = middleTip.y < middleMcp.y;
  const isRingExt = ringTip.y < ringMcp.y;
  const isPinkyExt = pinkyTip.y < pinkyMcp.y;

  const dxIndexThumb = Math.hypot(
    indexTip.x - thumbTip.x,
    indexTip.y - thumbTip.y,
  );

  if (dxIndexThumb < 0.08 && isMiddleExt && isRingExt && isPinkyExt) {
    return { gesture: 'OK', confidence: 0.95 };
  }

  if (isThumbUp && !isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return { gesture: 'YES', confidence: 0.9 };
  }

  if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
    return { gesture: 'PEACE', confidence: 0.92 };
  }

  if (isIndexExt && isPinkyExt && !isMiddleExt && !isRingExt) {
    return { gesture: 'I-LOVE-YOU', confidence: 0.95 };
  }

  if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return { gesture: 'POINTING', confidence: 0.88 };
  }

  if (isIndexExt && isMiddleExt && isRingExt && isPinkyExt) {
    return { gesture: 'HELLO', confidence: 0.9 };
  }

  if (!isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return { gesture: 'NO', confidence: 0.85 };
  }

  return { gesture: 'SIGN', confidence: 0.75 };
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
  const statusRef = useRef<PipelineStatus>('idle');
  const ttsEnabledRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  // Landmark buffers & payload stream
  const landmarkBufferRef = useRef<FrameData[]>([]);
  const payloadBufferRef = useRef<HandLandmarkPayload[]>([]);
  const lastInterpretRef = useRef<number>(0);
  const lastHandSeenRef = useRef<number>(Date.now());
  const previousHandsRef = useRef<HandData[]>([]);
  const lastMovementRef = useRef<number>(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInterpretingRef = useRef<boolean>(false);

  // STT
  const sttWsRef = useRef<WebSocket | null>(null);

  // Speech queue
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  // ── Helpers ──
  const updateState = useCallback((patch: Partial<PipelineState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

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
          const text = msg.results
            ?.map((r: any) => r.alternatives?.[0]?.content ?? '')
            .join(' ')
            .trim();
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
          ws.send(
            input.buffer.slice(
              input.byteOffset,
              input.byteOffset + input.byteLength,
            ),
          );
        }
      };
    } catch (err) {
      console.error('Mic access failed:', err);
      updateState({ error: 'Microphone access denied' });
    }
  }

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

  // ── Pause detection → trigger assembly ──
  const detectPause = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    pauseTimerRef.current = setTimeout(() => {
      setState((prev) => {
        const lastAssembledIdx =
          prev.transcript
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
          const speechStr =
            speechTexts.length > 0 ? speechTexts.join(' ') : null;

          setTimeout(() => runAssembly(gestureStr, speechStr), 0);
        }

        return prev;
      });
    }, PAUSE_DETECTION_MS);
  }, [runAssembly]);

  // ── Process incoming HandLandmarkPayload from CameraPreview ──
  const processLandmarkPayload = useCallback(
    async (payload: HandLandmarkPayload) => {
      if (statusRef.current !== 'running') return;
      if (!payload || payload.hands_detected === 0) return;

      const now = Date.now();
      lastHandSeenRef.current = now;

      // Log outgoing payload stream in developer tools for debugging
      console.log(
        '[SignPulseAI Pipeline] Streaming hand landmark payload:',
        payload,
      );

      // Update hands count in state
      updateState({
        handsDetected: payload.hands_detected,
        error:
          state.error === 'No hands detected. Please position your hands in frame.'
            ? null
            : state.error,
      });

      // Reset pause timer on new landmark detection
      detectPause();

      // Buffer payload
      payloadBufferRef.current.push(payload);
      const maxBufferSize = Math.ceil(LANDMARK_BUFFER_MS / 100); // 100ms interval (10 FPS)
      if (payloadBufferRef.current.length > maxBufferSize) {
        payloadBufferRef.current = payloadBufferRef.current.slice(
          -maxBufferSize,
        );
      }

      // Check throttle interval for interpretation call
      if (now - lastInterpretRef.current < INTERPRET_INTERVAL_MS) return;
      if (isInterpretingRef.current) return;

      lastInterpretRef.current = now;
      isInterpretingRef.current = true;

      const startTime = performance.now();

      try {
        const signal = abortRef.current?.signal;
        const framesToSend = [...payloadBufferRef.current];

        // Pass landmark JSON payloads directly to Supabase Edge Function endpoint `interpret-gesture`
        let gesture: string | null = null;
        let confidence = 0.5;

        try {
          const result = await interpretGesture(framesToSend, signal);
          if (result?.success && result?.data?.gesture) {
            gesture = result.data.gesture;
            confidence = result.data.confidence ?? 0.8;
          }
        } catch {
          // Cloud Edge function fallback: local landmark gesture recognition
          const latestHand = payload.hands[0];
          if (latestHand?.landmarks) {
            const fallback = recognizeHandGesture(latestHand.landmarks);
            if (fallback) {
              gesture = fallback.gesture;
              confidence = fallback.confidence;
            }
          }
        }

        const latency = Math.round(performance.now() - startTime);
        updateState({ latency });

        if (gesture && gesture !== 'UNKNOWN' && confidence >= 0.5) {
          const entry: TranslationEntry = {
            id: nextId(),
            text: gesture,
            timestamp: now,
            confidence,
            type: 'gesture',
          };
          setState((prev) => {
            // Avoid duplicate back-to-back entries of the exact same gesture within 1 second
            const lastEntry = prev.transcript[prev.transcript.length - 1];
            if (lastEntry && lastEntry.text === gesture && now - lastEntry.timestamp < 1000) {
              return prev;
            }
            return {
              ...prev,
              currentSentence: gesture,
              transcript: [...prev.transcript, entry],
            };
          });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[SignPulseAI Pipeline] Interpretation error:', err);
      } finally {
        isInterpretingRef.current = false;
      }
    },
    [updateState, state.error, detectPause],
  );

  // ── Speech queue processing ──
  async function processSpeechQueue() {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
    isSpeakingRef.current = true;

    const text = speechQueueRef.current.shift()!;

    try {
      const audio = await generateSpeech(text);
      if (audio && audio.length > 0) {
        await playPcmAudio(audio);
      } else {
        throw new Error('Empty audio response');
      }
    } catch {
      try {
        await speakWithBrowserTTS(text);
      } catch (ttsErr) {
        console.error('TTS fallback failed:', ttsErr);
      }
    } finally {
      isSpeakingRef.current = false;
      if (speechQueueRef.current.length > 0) {
        processSpeechQueue();
      }
    }
  }

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

      // Reset buffers
      landmarkBufferRef.current = [];
      payloadBufferRef.current = [];
      lastInterpretRef.current = Date.now();
      lastHandSeenRef.current = Date.now();
      previousHandsRef.current = [];
      lastMovementRef.current = 0;
      speechQueueRef.current = [];
      isSpeakingRef.current = false;

      statusRef.current = 'running';
      updateState({ status: 'running' });

      // Connect STT
      connectStt();
    } catch (err: any) {
      console.error('Failed to start session:', err);
      statusRef.current = 'error';
      updateState({
        status: 'error',
        error: err?.message ?? 'Failed to start translation session',
      });
    }
  }, [connectStt, updateState]);

  // ── End session ──
  const endSession = useCallback(() => {
    statusRef.current = 'ended';
    updateState({ status: 'ended' });

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (sttWsRef.current) {
      sttWsRef.current.close();
      sttWsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    landmarkBufferRef.current = [];
    payloadBufferRef.current = [];
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
    processLandmarkPayload,
  };
}