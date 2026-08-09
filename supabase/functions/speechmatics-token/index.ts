/* ── Speechmatics Token Edge Function ──
 *
 * Reads SPEECHMATICS_API_KEY from env, mints a short-lived JWT
 * for real-time WebSocket STT sessions.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

interface TokenResponse {
  success: boolean;
  data?: { token: string };
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

    const response = await fetch(
      'https://mp.speechmatics.com/v1/api_keys?type=rt',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 60 }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speechmatics token API error: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    const token: string = result.key_value ?? result.token ?? result.jwt;

    if (!token) {
      throw new Error('No token in Speechmatics response');
    }

    const body: TokenResponse = {
      success: true,
      data: { token },
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: TokenResponse = {
      success: false,
      error: message,
    };

    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});