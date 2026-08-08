import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SPEECHMATICS_API_KEY = Deno.env.get("SPEECHMATICS_API_KEY");
if (!SPEECHMATICS_API_KEY) {
  throw new Error("SPEECHMATICS_API_KEY is not set");
}

const TTS_BASE_URL = "https://preview.tts.speechmatics.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TTSInput {
  text: string;
  voice?: string; // sarah, theo, megan, jack
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const input: TTSInput = await req.json();
    const voice = input.voice ?? "sarah";
    const text = input.text;

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Speechmatics TTS API
    const ttsResp = await fetch(
      `${TTS_BASE_URL}/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SPEECHMATICS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: [{ text }],
          audio_format: {
            type: "raw",
            sample_rate: 16000,
          },
        }),
      },
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      console.error("TTS API error:", ttsResp.status, errText);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert the audio response (ArrayBuffer) to a number array for JSON transport
    const audioBuffer = await ttsResp.arrayBuffer();
    const audioArray = Array.from(new Uint8Array(audioBuffer));

    return new Response(JSON.stringify({ audio: audioArray }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tts error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});