// Daumen hoch/runter fuer Community-Builds aus dem Web-Hub. Heisst aus
// historischen Gruenden noch "like": vor den Dislikes gab es nur ein Herz,
// und alte Clients schicken weiterhin nur { build_id } — das zaehlt als Like.
//
// Die eigentliche Abstimm-Logik (setzen / zuruecknehmen / umschwenken) liegt
// in der Postgres-Function cast_build_vote, die sich Web und Discord teilen.
// Hier kommen nur IP-Hash und Rate-Limit dazu.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_TOGGLES = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VOTE_VALUES: Record<string, number> = { like: 1, dislike: -1 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function voteName(value: number | null): "like" | "dislike" | null {
  if (value === 1) return "like";
  if (value === -1) return "dislike";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { build_id: buildId, vote = "like" } = payload || {};
  if (typeof buildId !== "string" || !UUID_RE.test(buildId)) {
    return json({ error: "Invalid build_id" }, 400);
  }
  // hasOwn statt `in`: "toString" & Co. stehen sonst ueber den Prototyp drin.
  if (typeof vote !== "string" || !Object.hasOwn(VOTE_VALUES, vote)) {
    return json({ error: "vote must be 'like' or 'dislike'" }, 400);
  }
  const direction = VOTE_VALUES[vote];

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ipHash = await sha256(clientIp);

  // Build has to exist before we touch the rate limit / votes tables.
  const { data: build, error: buildError } = await supabase
    .from("community_builds")
    .select("id")
    .eq("id", buildId)
    .maybeSingle();

  if (buildError) {
    console.error("build lookup failed", buildError);
    return json({ error: "Internal error" }, 500);
  }
  if (!build) {
    return json({ error: "Build not found" }, 404);
  }

  const { data: existing, error: existingError } = await supabase
    .from("community_build_likes")
    .select("vote")
    .eq("build_id", buildId)
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (existingError) {
    console.error("vote lookup failed", existingError);
    return json({ error: "Internal error" }, 500);
  }

  // Nur eine ganz neue Stimme zaehlt gegen das Limit. Zuruecknehmen und
  // Umschwenken aendern die Gesamtzahl der Stimmen nicht und sind frei.
  const isNewVote = !existing;
  if (isNewVote) {
    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000
    ).toISOString();

    const { count, error: countError } = await supabase
      .from("community_like_rate_limit")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("rate limit check failed", countError);
      return json({ error: "Internal error" }, 500);
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX_TOGGLES) {
      return json(
        { error: "Too many votes from this connection, please wait a bit" },
        429
      );
    }
  }

  const { data: result, error: voteError } = await supabase
    .rpc("cast_build_vote", {
      p_build_id: buildId,
      p_voter_hash: ipHash,
      p_vote: direction,
    })
    .single();

  if (voteError || !result) {
    console.error("cast_build_vote failed", voteError);
    return json({ error: "Failed to update vote" }, 500);
  }

  if (isNewVote) {
    await supabase.from("community_like_rate_limit").insert([{ ip_hash: ipHash }]);
  }

  const newVote = voteName(result.vote);
  return json({
    vote: newVote,
    likes_count: result.likes_count,
    dislikes_count: result.dislikes_count,
    // Fuer Clients von vor den Dislikes, die nur "liked" auswerten.
    liked: newVote === "like",
  }, 200);
});
