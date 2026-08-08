/* ── Text-to-Speech Edge Function ──
 *
 * Converts text to speech using Speechmatics TTS API.
 * Returns PCM float32 audio samples for client-side playback.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface TtsRequest {
  text: string;
  voice?: string;
}

interface TtsResponse {
  success: boolean;
  data?: { audio: number[] };
  error?: string;
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  try {
    const apiKey = Deno.env.get('SPEECHMATICS_API_KEY');
    if (!apiKey) {
      throw new Error('SPEECHMATICS_API_KEY not configured');
    }

    const { text, voice }: TtsRequest = await req.json();

    if (!text || text.trim().length === 0) {
      const body: TtsResponse = {
        success: false,
        error: 'No text provided',
      };
      return new Response(JSON.stringify(body), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Call Speechmatics TTS API
    // Using the batch synthesis endpoint
    const response = await fetch(
      'https://asr.api.speechmatics.com/v2/tts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: voice ?? 'en-US-Wavenet-D',
          audio_format: {
            type: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 24000,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speechmatics TTS error: ${response.status} — ${errorText}`);
    }

    // Parse the response — Speechmatics returns JSON with audio data
    const result = await response.json();

    let audioSamples: number[];

    if (result.audio && result.audio.data) {
      // Base64 encoded PCM data
      const binaryStr = atob(result.audio.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      // Convert bytes to float32 samples
      const float32 = new Float32Array(bytes.buffer);
      audioSamples = Array.from(float32);
    } else if (result.data?.audio) {
      audioSamples = result.data.audio;
    } else if (Array.isArray(result.audio)) {
      audioSamples = result.audio;
    } else {
      throw new Error('Unexpected TTS response format');
    }

    const body: TtsResponse = {
      success: true,
      data: { audio: audioSamples },
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: TtsResponse = {
      success: false,
      error: message,
    };

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});