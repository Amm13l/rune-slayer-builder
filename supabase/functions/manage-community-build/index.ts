// Nachtraegliches Bearbeiten und Loeschen eines Community-Builds per
// Build-Key — das Gegenstueck zu upload-community-build.
//
// Warum das ueber eine Edge Function laeuft und nicht als RPC direkt aus dem
// Browser: verify_build_key und set_build_key sind fuer anon gesperrt
// (SECURITY DEFINER, sie umgehen RLS). Waeren sie oeffentlich aufrufbar,
// haette man ein frei nutzbares Orakel zum Durchprobieren von Keys — und bei
// set_build_key sogar die Moeglichkeit, fremde Builds zu uebernehmen. Hier
// sehen wir dagegen die IP und koennen Fehlversuche begrenzen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS = 3;
const MIN_KEY_LENGTH = 8;

// Fehlversuche pro IP, bevor zugemacht wird. Zusammen mit bcrypt (Cost 10,
// ~100ms pro Pruefung) ist Durchprobieren damit praktisch aussichtslos.
const ATTEMPT_WINDOW_MINUTES = 10;
const MAX_FAILED_ATTEMPTS = 10;

// Muss mit AVAILABLE_TAGS in js/community.js und ALLOWED_TAGS in
// upload-community-build uebereinstimmen.
const ALLOWED_TAGS = [
  "PvP",
  "PvE",
  "Boss Killer",
  "Grinding",
  "Endgame",
  "Low Level",
  "Budget",
  "Tank",
  "High Damage",
  "Support",
  "Mobility",
  "Fun",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Gleiche Kriterien wie die DB-Constraint community_builds_not_empty.
function isBuildEmpty(buildData: any): boolean {
  const items = buildData?.items || {};
  const hasItem = Object.values(items).some(Boolean);
  const classes = buildData?.classes || {};
  const hasClassLevel = Object.values(classes).some(
    (lvl) => (parseInt(String(lvl), 10) || 0) > 0
  );
  return !hasItem && !hasClassLevel;
}

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

  const { action, build_id: buildId, key } = payload || {};

  if (action !== "verify" && action !== "update" && action !== "delete") {
    return json({ error: "Unknown action" }, 400);
  }
  if (typeof buildId !== "string" || !UUID_RE.test(buildId)) {
    return json({ error: "Invalid build id" }, 400);
  }
  if (typeof key !== "string" || key.length < MIN_KEY_LENGTH) {
    return json({ error: "Invalid build key" }, 403);
  }

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ipHash = await sha256(clientIp);
  const windowStart = new Date(
    Date.now() - ATTEMPT_WINDOW_MINUTES * 60_000
  ).toISOString();

  // 1) Zu viele Fehlversuche von diesem Anschluss?
  const { count, error: countError } = await supabase
    .from("community_key_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);

  if (countError) {
    console.error("attempt check failed", countError);
    return json({ error: "Internal error" }, 500);
  }
  if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
    return json(
      { error: "Too many wrong keys from this connection, please wait a bit" },
      429
    );
  }

  // 2) Key pruefen (bcrypt passiert in Postgres, siehe verify_build_key)
  const { data: valid, error: verifyError } = await supabase.rpc(
    "verify_build_key",
    { p_build_id: buildId, p_key: key }
  );

  if (verifyError) {
    console.error("verify failed", verifyError);
    return json({ error: "Internal error" }, 500);
  }
  if (valid !== true) {
    await supabase.from("community_key_attempts").insert([{ ip_hash: ipHash }]);
    return json({ error: "Wrong build key" }, 403);
  }

  if (action === "verify") {
    // Der Client holt sich Name/Description/Tags ohnehin aus der Liste —
    // hier nur das Go, damit er das Edit-Menue oeffnen darf.
    return json({ ok: true }, 200);
  }

  if (action === "delete") {
    const { error } = await supabase
      .from("community_builds")
      .delete()
      .eq("id", buildId);

    if (error) {
      console.error("delete failed", error);
      return json({ error: "Failed to delete build" }, 500);
    }
    // Likes und der Key-Hash haengen per ON DELETE CASCADE dran.
    return json({ ok: true, deleted: true }, 200);
  }

  // action === "update"
  const { name, description, tags, build_data: buildData } = payload;

  if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
    return json({ error: "Invalid build name" }, 400);
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

  const patch: Record<string, unknown> = {
    name: name.trim(),
    description: cleanDescription || null,
    tags: cleanTags(tags),
  };

  // build_data ist optional: nur wenn der Uploader ausdruecklich das
  // aktuelle Build uebernehmen will, wird die Ausruestung ersetzt.
  if (buildData !== undefined && buildData !== null) {
    if (typeof buildData !== "object") {
      return json({ error: "Invalid build data" }, 400);
    }
    if (isBuildEmpty(buildData)) {
      return json({ error: "Build is empty" }, 400);
    }
    patch.build_data = buildData;
  }

  const { error: updateError } = await supabase
    .from("community_builds")
    .update(patch)
    .eq("id", buildId);

  if (updateError) {
    console.error("update failed", updateError);
    return json({ error: "Failed to save changes" }, 500);
  }

  return json({ ok: true, updated: true }, 200);
});
