import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AssembleInput {
  gesture_text: string | null;
  speech_text: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const input: AssembleInput = await req.json();

    // Build prompt depending on what inputs are available
    let prompt: string;

    if (input.gesture_text && input.speech_text) {
      prompt = `You are an ASL-to-English translation assistant. You receive two inputs:
1. ASL gesture interpretation: "${input.gesture_text}"
2. Speech transcription: "${input.speech_text}"

Merge both into a single grammatical English sentence that captures the full meaning.
Rules:
- Make the result sound natural in English, not like literal ASL gloss.
- If the gesture and speech overlap, avoid repetition.
- Output ONLY the sentence, no explanation or quotes.`;
    } else if (input.gesture_text) {
      prompt = `You are an ASL-to-English translation assistant. The ASL gesture interpretation is: "${input.gesture_text}"

Convert this into a natural grammatical English sentence.
Rules:
- Make it sound natural, not like literal ASL gloss.
- If it's already a short phrase like "hello" or "thank you", just repeat it as-is.
- Output ONLY the sentence, no explanation or quotes.`;
    } else if (input.speech_text) {
      prompt = `Clean up this speech transcription into proper English: "${input.speech_text}"

Rules:
- Fix any transcription errors, add punctuation.
- Output ONLY the cleaned sentence, no explanation.`;
    } else {
      return new Response(JSON.stringify({ sentence: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 60,
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini API error:", geminiResp.status, errText);
      return new Response(JSON.stringify({ error: "Gemini API error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResp.json();
    const sentence =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ sentence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("assemble error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});