/* ── Gesture Interpretation Edge Function ──
 *
 * Receives hand landmark frame sequences from the client,
 * sends them to Gemini 2.0 Flash for ASL sign interpretation,
 * and returns a gesture token + confidence score.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface InterpretRequest {
  frames: unknown[];
}

interface GestureResult {
  gesture: string;
  confidence: number;
  raw?: string;
}

interface InterpretResponse {
  success: boolean;
  data?: GestureResult;
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
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const { frames }: InterpretRequest = await req.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      const body: InterpretResponse = {
        success: false,
        error: 'No frames provided',
      };
      return new Response(JSON.stringify(body), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Build prompt with the landmark data
    const landmarkSummary = JSON.stringify(frames.slice(-5)); // last 5 frames

    const prompt = `You are an ASL (American Sign Language) gesture interpreter. 
Given the following hand landmark sequences (each containing hand positions x,y,z for 21 landmarks per hand), 
identify the most likely ASL sign or gesture being performed.

Hand landmark data (last 5 frames): ${landmarkSummary}

Respond with a JSON object containing:
- "gesture": the recognized sign or gesture in uppercase English (e.g., "HELLO", "THANK-YOU", "YES", "NO", "PLEASE", "I-LOVE-YOU", "MORE", "FINISH", "HELP", "SORRY", or "UNKNOWN" if unclear)
- "confidence": a number between 0 and 1 indicating your confidence
- "raw": optional additional context

Return ONLY valid JSON, no markdown formatting.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 100,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse the JSON response from Gemini
    let parsed: GestureResult;
    try {
      // Strip any markdown code fences
      const cleaned = text.replace(/```(?:json)?\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, return the raw text
      parsed = {
        gesture: 'UNKNOWN',
        confidence: 0,
        raw: text,
      };
    }

    const body: InterpretResponse = {
      success: true,
      data: {
        gesture: parsed.gesture ?? 'UNKNOWN',
        confidence: parsed.confidence ?? 0,
        raw: parsed.raw,
      },
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: InterpretResponse = {
      success: false,
      error: message,
    };

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});