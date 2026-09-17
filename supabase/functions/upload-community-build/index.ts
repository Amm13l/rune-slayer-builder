// Nimmt Community-Uploads an: prueft den Turnstile-Token bei Cloudflare,
// rate-limitet pro IP-Hash und schreibt erst danach mit dem Service-Role-Key
// (RLS erlaubt anon keine direkten Inserts in community_builds).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Turnstile-Secret ist server-seitig fix hinterlegt, genau wie der
// Admin-Code in den Postgres-Functions — der Client kennt ihn nie.
const TURNSTILE_SECRET_KEY = "0x4AAAAAAEdxNFr0TjIMBA0xUbNFXHDWaM0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_UPLOADS = 5;
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS = 3;

// Optionaler Build-Key: damit kann der Uploader sein Build spaeter noch
// bearbeiten oder loeschen (siehe manage-community-build). Gehasht wird in
// Postgres (bcrypt, set_build_key) — der Klartext verlaesst diese Function nie.
const MIN_KEY_LENGTH = 8;

// Autoritative Tag-Liste. Muss mit AVAILABLE_TAGS in js/community.js
// uebereinstimmen; die DB prueft nur Anzahl und leere Strings, damit ein
// neuer Tag keine Migration braucht.
const ALLOWED_TAGS = [
  "PvP",
  "PvE",
  "Crit",
  "Minmaxxed",
  "Tank",
  "Meta",
  "Off-Meta",
];

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

// Gleiche Kriterien wie die DB-Constraint community_builds_not_empty und
// die Client-Pruefung in community.js.
function isBuildEmpty(buildData: any): boolean {
  const items = buildData?.items || {};
  const hasItem = Object.values(items).some(Boolean);
  const classes = buildData?.classes || {};
  const hasClassLevel = Object.values(classes).some(
    (lvl) => (parseInt(String(lvl), 10) || 0) > 0
  );
  return !hasItem && !hasClassLevel;
}

// Nur Tags aus ALLOWED_TAGS, dedupliziert, in der Reihenfolge der Liste.
// Unbekannte Werte werden verworfen statt den Upload abzulehnen: die koennen
// nur von einem veralteten Client kommen, der Build selbst ist in Ordnung.
function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(
    raw.filter((t): t is string => typeof t === "string").map((t) => t.trim())
  );
  return ALLOWED_TAGS.filter((t) => wanted.has(t)).slice(0, MAX_TAGS);
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const {
    name,
    build_data: buildData,
    description,
    tags,
    buildKey,
    turnstileToken,
  } = payload || {};

  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) {
    return json({ error: "Invalid build name" }, 400);
  }
  if (!buildData || typeof buildData !== "object") {
    return json({ error: "Invalid build data" }, 400);
  }
  if (description != null && typeof description !== "string") {
    return json({ error: "Invalid description" }, 400);
  }
  const cleanDescription = typeof description === "string" ? description.trim() : "";
  if (cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    return json(
      { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` },
      400
    );
  }
  if (buildKey != null && typeof buildKey !== "string") {
    return json({ error: "Invalid build key" }, 400);
  }
  // Getrimmt, weil ein versehentliches Leerzeichen am Ende sonst dauerhaft
  // zum Key gehoert und niemand mehr an sein Build kommt.
  const cleanKey = typeof buildKey === "string" ? buildKey.trim() : "";
  if (cleanKey && cleanKey.length < MIN_KEY_LENGTH) {
    return json(
      { error: `Build key must be at least ${MIN_KEY_LENGTH} characters` },
      400
    );
  }
  if (typeof turnstileToken !== "string" || !turnstileToken) {
    return json({ error: "Missing captcha token" }, 400);
  }
  if (isBuildEmpty(buildData)) {
    return json({ error: "Build is empty" }, 400);
  }

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  // 1) Turnstile-Token bei Cloudflare verifizieren
  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: clientIp,
      }),
    }
  );
  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return json({ error: "Captcha verification failed" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ipHash = await sha256(clientIp);

  // 2) Rate-Limit pruefen (max N Uploads pro IP in den letzten X Minuten)
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000
  ).toISOString();

  const { count, error: countError } = await supabase
    .from("upload_rate_limit")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);

  if (countError) {
    console.error("rate limit check failed", countError);
    return json({ error: "Internal error" }, 500);
  }
  if ((count ?? 0) >= RATE_LIMIT_MAX_UPLOADS) {
    return json(
      { error: "Too many uploads from this connection, please wait a bit" },
      429
    );
  }

  // 3) Build einfuegen (Service Role umgeht RLS — das ist hier gewollt,
  //    da die Pruefungen oben schon erfolgt sind)
  const { data: inserted, error: insertError } = await supabase
    .from("community_builds")
    .insert([{
      name: name.trim(),
      build_data: buildData,
      description: cleanDescription || null,
      tags: cleanTags(tags),
    }])
    .select("id")
    .single();

  if (insertError) {
    console.error("insert failed", insertError);
    return json({ error: "Failed to save build" }, 500);
  }

  // 4) Diesen Versuch fuers Rate-Limit vormerken
  await supabase.from("upload_rate_limit").insert([{ ip_hash: ipHash }]);

  // 5) Key hinterlegen. set_build_key setzt Hash und has_key in einer
  //    Transaktion — es gibt also nie einen Stift ohne Key. Schlaegt es
  //    fehl, steht das Build trotzdem schon drin: dann ehrlich melden
  //    statt "success" zu behaupten, sonst notiert sich jemand einen Key,
  //    der nirgends hinterlegt ist.
  if (cleanKey) {
    const { error: keyError } = await supabase.rpc("set_build_key", {
      p_build_id: inserted.id,
      p_key: cleanKey,
    });

    if (keyError) {
      console.error("set_build_key failed", keyError);
      return json(
        {
          error:
            "Build was uploaded, but the build key could not be saved — it has no key",
        },
        500
      );
    }
  }

  return json({ success: true, id: inserted.id, has_key: Boolean(cleanKey) }, 200);
});
