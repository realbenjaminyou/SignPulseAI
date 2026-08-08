/* ── Sentence Assembly Edge Function ──
 *
 * Takes raw gesture tokens and optional speech transcript,
 * uses Gemini 2.0 Flash to merge them into a coherent,
 * grammatically correct English sentence.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface AssembleRequest {
  gesture_text: string | null;
  speech_text: string | null;
}

interface AssembleResponse {
  success: boolean;
  data?: { sentence: string };
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

    const { gesture_text, speech_text }: AssembleRequest = await req.json();

    if (!gesture_text && !speech_text) {
      const body: AssembleResponse = {
        success: false,
        error: 'No gesture or speech text provided',
      };
      return new Response(JSON.stringify(body), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Build the prompt
    const gesturePart = gesture_text ? `ASL Sign: "${gesture_text}"` : '';
    const speechPart = speech_text ? `Spoken words: "${speech_text}"` : '';
    const inputParts = [gesturePart, speechPart].filter(Boolean).join('\n');

    const prompt = `You are an ASL-to-English sentence assembler. 
Your task is to merge ASL gesture interpretations with optional speech transcription into a single, fluent English sentence.

Input:
${inputParts || "(no input)"}

Rules:
1. ASL signs are in uppercase (e.g., HELLO, THANK-YOU, I-LOVE-YOU). Translate them to natural English words.
2. Merge both gesture and speech inputs into ONE coherent sentence (do not output two separate sentences).
3. If only gesture is provided, produce a fluent English sentence from the signs.
4. If only speech is provided, clean it up into a proper sentence.
5. Keep the sentence concise (under 20 words).
6. Do not add explanations, just output the sentence.

Output ONLY the final sentence, nothing else.`;

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
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 150,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    let sentence: string =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Clean up the sentence
    sentence = sentence.trim().replace(/^["']|["']$/g, '');

    if (!sentence) {
      sentence = gesture_text || speech_text || '';
    }

    const body: AssembleResponse = {
      success: true,
      data: { sentence },
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: AssembleResponse = {
      success: false,
      error: message,
    };

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});