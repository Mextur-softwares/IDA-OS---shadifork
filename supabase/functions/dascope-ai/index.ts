// DaScope AI Edge Function
// Configure OPENROUTER_API_KEY in Supabase Edge Function secrets.
// Never put the OpenRouter key in client-side code.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "DaScope is not configured yet: missing OPENROUTER_API_KEY secret." }, {
        status: 500,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const history = Array.isArray(body.history)
      ? body.history.slice(-3).flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as { role?: unknown; content?: unknown };
          if ((entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string") return [];
          const content = entry.content.trim().slice(0, 12000);
          return content ? [{ role: entry.role, content }] : [];
        })
      : [];
    if (!query) {
      return Response.json({ error: "Please enter a question." }, {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (query.length > 12000) {
      return Response.json({ error: "Your question is too long. Please shorten it and try again." }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mextur-softwares.github.io/IDA-OS---shadifork/",
        "X-Title": "IDA OS DaScope",
      },
      body: JSON.stringify({
        model: "stealth/space-bunny-alpha",
        messages: [
          {
            role: "system",
            content: "You are DaScope, the helpful AI assistant inside IDA OS. Answer clearly and accurately. If you are unsure, say so. Do not claim to have browsed the web or verified sources unless source data was actually provided. Use the recent conversation messages to understand follow-up questions and maintain context.",
          },
          ...history,
          { role: "user", content: query },
        ],
      }),
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = result?.error?.message || `OpenRouter request failed (HTTP ${upstream.status}).`;
      return Response.json({ error: message }, {
        status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
        headers: corsHeaders,
      });
    }

    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return Response.json({ error: "The selected model returned an empty answer." }, {
        status: 502,
        headers: corsHeaders,
      });
    }

    return Response.json({ answer, sources: [], images: [] }, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "DaScope encountered an unexpected error.",
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
