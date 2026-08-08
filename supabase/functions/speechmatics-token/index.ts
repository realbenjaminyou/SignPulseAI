import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SPEECHMATICS_API_KEY = Deno.env.get("SPEECHMATICS_API_KEY");
if (!SPEECHMATICS_API_KEY) {
  throw new Error("SPEECHMATICS_API_KEY is not set");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Generate short-lived JWT (60s TTL)
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60;

    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        iss: "speechmatics",
        sub: SPEECHMATICS_API_KEY,
        iat,
        exp,
      }),
    );

    // Sign with HMAC-SHA256
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SPEECHMATICS_API_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const sigBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    const signature = base64url(new Uint8Array(sigBytes));

    const token = `${header}.${payload}.${signature}`;

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("speechmatics-token error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function base64url(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}