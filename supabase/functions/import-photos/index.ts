// One-time import of the 11 photos from the old claude.ai artifact.
// The files sit in the repo ENCRYPTED (AES-256-GCM); the key exists only in a locked table (service role only).
// After the import succeeds the encrypted files are deleted from the repo and the key is destroyed.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SRC = "https://raw.githubusercontent.com/ahmedsalah608/dolaby/main/migration/";
// sha256 of every original file, from the old artifact's asset list
const EXPECTED: Record<string, string> = {
  "e0ecd7adc2c6156cde5aea4d5d00b436": "3147d4b6bf2beabf237fb8ec6f734ca267fb887e1176ae984473eb6ad937fb64",
  "fd83ab055d543a620d1abc5f20047731": "73592ff9bedc8c6689ead025852385a169d3639b1ab8513f87345c5728b9efe5",
  "6a31d0df8abfa35bab354066b7e53a51": "d492d74f47acbab8d86568317660f9950c0474518c2f85d60075e5a569c15775",
  "e4b980f8134bd9c2eaf399f516d72938": "518ac763ed1f0109401031a119f8eb63afa3d6a5386e8195dc035aa1f681c387",
  "68b5e2b490e5c40f409a5222e276a214": "fe128983786b342363a8f48a2e663ccc81cae4275250a13fcb001b0a4393abc8",
  "632e3f1d435c73f64e80a1b08b21edff": "77010b2f497d8d549b68ee6fb2bad848dd192150c7243aa6ed78a2202b4be21a",
  "d8629eb7f76a3dc0ea15ffb51736f08d": "89a4c9359a44f8a39c06463e7014aca918cbdbfac4c44e0f9c7d7f51bdca8ea8",
  "a8cb25ccaf98cf5e532abd968c90d89c": "aaec57935e10ebf46cd14dd228d6e414957e442593e4918f9f6a8c01c84fe4e0",
  "76b47f86b11df003bfc86541c9f9d494": "736157a10c82b008f5047081c5a3c80b20d632d2f6ec885f516fca23ef374eb8",
  "836b9c0590e80bbb7ed63e01bde95e81": "ee46f6e924cf4d7dc92a776409a0602f26916a84223ca676613159b5f7ebacb7",
  "a7ab25135e0f3f07e3d1ec183cdc5e36": "2eac23f7fad41d81b6d42a77ae8b3c7ae466f99b7db02e7f11567486fcd343a2",
};
const cors = { "Access-Control-Allow-Origin": "https://ahmedsalah608.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "auth" }, 401);
    const uid = u.user.id;
    const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
    const { data: k } = await db.from("import_key").select("key_b64").eq("id", 1).maybeSingle();
    const keyB64 = k?.key_b64;
    if (!keyB64 || keyB64.length < 40) return json({ ok: false, error: "closed", message: "النقل خلص والمفتاح اتمسح." }, 410);
    const { data: mig } = await db.from("app_state").select("value").eq("owner_id", uid).eq("key", "migration").maybeSingle();
    if (!mig) return json({ ok: false, error: "not_claimed" }, 409);
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]);
    const results: Record<string, string> = {};
    for (const [id, sha] of Object.entries(EXPECTED)) {
      try {
        const r = await fetch(SRC + id + ".bin"); if (!r.ok) { results[id] = "fetch " + r.status; continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12), additionalData: new TextEncoder().encode(id) }, key, buf.slice(12));
        if (hex(await crypto.subtle.digest("SHA-256", plain)) !== sha) { results[id] = "hash mismatch"; continue; }
        const { error } = await db.storage.from("photos").upload(`${uid}/legacy/${id}.jpg`, new Blob([plain], { type: "image/jpeg" }), { contentType: "image/jpeg", upsert: true });
        results[id] = error ? "upload " + error.message : "ok";
      } catch (e) { results[id] = "error " + (e as Error).message; }
    }
    const uploaded = Object.values(results).filter((v) => v === "ok").length;
    const done = uploaded === Object.keys(EXPECTED).length;
    await db.from("app_state").update({ value: { ...mig.value, photos: done ? "done" : "partial", photos_uploaded: uploaded, photos_expected: Object.keys(EXPECTED).length, photos_at: new Date().toISOString(), photo_results: results } }).eq("owner_id", uid).eq("key", "migration");
    return json({ ok: done, uploaded, expected: Object.keys(EXPECTED).length, results });
  } catch (e) { return json({ ok: false, error: "server", message: (e as Error).message }, 500); }
});
