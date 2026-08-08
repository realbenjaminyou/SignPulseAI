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

interface InterpretGestureInput {
  frames: Array<{
    landmarks: number[][]; // flattened 21 landmarks × 3 = 63 values per hand
    handedness: string[];
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const input: InterpretGestureInput = await req.json();

    // Build a prompt from landmark data
    const handsSummary = input.frames
      .map(
        (f, i) =>
          `Frame ${i}: ${f.handedness.join(", ")} hands detected. ` +
          `Landmarks: ${JSON.stringify(f.landmarks)}`,
      )
      .join("\n");

    const prompt = `You are an ASL (American Sign Language) interpreter. Given a sequence of hand landmark coordinates (normalized 0-1, [x,y,z] per landmark, 21 landmarks per hand), interpret what the user is signing.

The data represents a ${input.frames.length}-frame sequence of hand positions.

Rules:
- Output ONLY the ASL meaning as a short phrase (e.g. "hello", "my name is", "thank you", "I need help").
- If the gesture is unclear or no clear sign is detected, output "UNCLEAR".
- Be concise — respond with a single phrase, no explanation.

Landmark data:
${handsSummary}`;

    // Call Gemini
    const geminiResp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 30,
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
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "UNCLEAR";
    const gesture = text.trim().toLowerCase() === "unclear" ? "" : text.trim();

    return new Response(
      JSON.stringify({ gesture, confidence: gesture ? 0.8 : 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("interpret-gesture error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});