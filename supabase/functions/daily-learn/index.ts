// Daily style research for Lorenzo (the advisor). Runs once a day from pg_cron.
// Hard limits: one run per Cairo day, a daily spend cap (default 0.10 USD) and the monthly cap.
// Uses Claude Haiku + up to 3 web searches; saves one short note to style_notes.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "claude-haiku-5-5";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const cairoDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const dayStartISO = () => new Date(`${cairoDay()}T00:00:00+02:00`).toISOString();
const monthStartISO = () => new Date(`${cairoDay().slice(0, 7)}-01T00:00:00+02:00`).toISOString();
function cost(u: any) {
  const inTok = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const p = inTok > 100_000 ? { in: 0.5, out: 2.5, cr: 0.05, cw: 0.625 } : { in: 0.1, out: 0.5, cr: 0.01, cw: 0.125 };
  return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out + (u.cache_read_input_tokens || 0) * p.cr + (u.cache_creation_input_tokens || 0) * p.cw) / 1e6 + (u.server_tool_use?.web_search_requests || 0) * 0.01;
}

Deno.serve(async (req) => {
  const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
  // only pg_cron (or the owner testing with the same secret) may start a run
  const { data: sec } = await db.from("cron_secret").select("secret").eq("id", 1).maybeSingle();
  if (!sec?.secret || req.headers.get("x-cron-secret") !== sec.secret) return json({ ok: false, error: "forbidden" }, 403);
  const force = new URL(req.url).searchParams.get("force") === "1";

  const { data: prof } = await db.from("profiles").select("owner_id,name,data").limit(1).maybeSingle();
  if (!prof) return json({ ok: false, error: "no_user" });
  const uid = prof.owner_id;
  const [{ data: st }, { data: key }, { data: spentM }, { data: spentD }, { data: today }, { data: recent }, { data: adv }, { data: items }] = await Promise.all([
    db.from("settings").select("*").eq("owner_id", uid).maybeSingle(),
    db.from("secrets").select("anthropic_key").eq("owner_id", uid).maybeSingle(),
    db.from("usage_log").select("cost_usd").eq("owner_id", uid).gte("created_at", monthStartISO()),
    db.from("usage_log").select("cost_usd").eq("owner_id", uid).eq("kind", "daily_learn").gte("created_at", dayStartISO()),
    db.from("style_notes").select("id").eq("owner_id", uid).eq("day", cairoDay()).limit(1),
    db.from("style_notes").select("topic").eq("owner_id", uid).order("id", { ascending: false }).limit(20),
    db.from("advisor").select("about,goals,assessment").eq("owner_id", uid).maybeSingle(),
    db.from("items").select("category,name,data").eq("owner_id", uid).limit(60),
  ]);
  if (st && st.daily_learn === false) return json({ ok: true, skipped: "off" });
  if (!key?.anthropic_key) return json({ ok: false, error: "no_key" });
  if ((today || []).length && !force) return json({ ok: true, skipped: "done_today" });
  const dayCap = Number(st?.daily_learn_cap_usd ?? 0.1);
  const spentToday = (spentD || []).reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);
  const monthSpent = (spentM || []).reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);
  if (spentToday >= dayCap) return json({ ok: true, skipped: "day_cap" });
  if (monthSpent >= Number(st?.monthly_cap_usd ?? 5)) return json({ ok: true, skipped: "month_cap" });
  // searches cost 0.01 each: never allow more than the remaining daily budget can pay for (tokens are a few tenths of a cent on Haiku)
  const maxUses = Math.max(1, Math.min(2, Math.floor((dayCap - spentToday - 0.01) / 0.01)));

  const month = new Date().toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo", month: "long" });
  const goals = (adv?.goals || []).filter((g: any) => g.status !== "done").map((g: any) => g.title).join("، ") || "لسه مفيش";
  const wardrobe = (items || []).map((i: any) => `${i.category}: ${i.name}`).join("، ").slice(0, 1200);
  const sys = `إنت لورينزو، خيّاط ومستشار مظهر. كل يوم بتعمل بحث صغير على النت عشان تفضل متابع الموضة والستايل الرجالي، ومركّز على اللي يفيد أحمد: راجل مصري في إسكندرية، شغل مكتبي ومناسبات وأفراح، بيحب العطور، وبيلبس نضارة.
اختار موضوع واحد النهارده (مختلف عن اللي فات)، وابحث بـweb_search بحد أقصى ${maxUses} بحث، وطلّع منه ملاحظة عملية. ما تكتبش أي معلومة مش من البحث، ومن غير أسعار. رد بـJSON بس بالعربي المصري:
{"topic":"عنوان قصير","insight":"خلاصة في 2-3 جمل","tips":["نصيحة عملية قصيرة","..."],"sources":[{"title":"","url":""}]}
الـJSON يكون آخر حاجة في ردك، ومن غير أي كلام قبله ولا بعده.`;
  const userMsg = `النهارده ${cairoDay()} (${month}). أهدافه: ${goals}. اللي يعرفه المستشار عنه: ${JSON.stringify(adv?.about || {}).slice(0, 800)}. دولابه: ${wardrobe || "فاضي"}.
مواضيع اتعملت قبل كده (ماتكررهاش): ${(recent || []).map((r: any) => r.topic).join("، ") || "مفيش"}.`;

  let usage: any = {}; let total = 0; let note: any = null; let error = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": key.anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: sys, messages: [{ role: "user", content: userMsg }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses, allowed_callers: ["direct"], user_location: { type: "approximate", city: "Alexandria", timezone: "Africa/Cairo" } }] }),
      signal: AbortSignal.timeout(100_000),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`(${r.status}) ${data?.error?.message || r.statusText}`);
    usage = data.usage || {}; total = cost(usage);
    const errs = (data.content || []).filter((b: any) => b.type === "web_search_tool_result" && b.content?.type === "web_search_tool_result_error").map((b: any) => b.content.error_code);
    const cites: any[] = []; for (const b of data.content || []) if (b.type === "text") for (const c of b.citations || []) if (c.url && !cites.find((x) => x.url === c.url)) cites.push({ title: c.title || c.url, url: c.url });
    // pages the search actually returned (used when the reply itself carries no citations)
    for (const b of data.content || []) if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const x of b.content) if (x?.url && !cites.find((c) => c.url === x.url)) cites.push({ title: x.title || x.url, url: x.url });
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    if (data.stop_reason === "max_tokens") throw new Error("الرد اتقطع (max_tokens)" + (errs.length ? ` · البحث فشل: ${errs.join("، ")}` : ""));
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s < 0 || e < s) throw new Error(`الرد ماكانش JSON (stop: ${data.stop_reason})` + (errs.length ? ` · البحث فشل: ${errs.join("، ")}` : ""));
    const o = JSON.parse(text.slice(s, e + 1));
    const sources = (Array.isArray(o.sources) ? o.sources : []).filter((x: any) => x?.url && cites.some((c) => c.url === x.url)).concat(cites).slice(0, 5);
    note = { owner_id: uid, day: cairoDay(), topic: String(o.topic || "").slice(0, 120), insight: String(o.insight || "").slice(0, 700), tips: (Array.isArray(o.tips) ? o.tips : []).map(String).slice(0, 5), sources: sources.filter((x: any, i: number, a: any[]) => a.findIndex((y) => y.url === x.url) === i), searches: usage.server_tool_use?.web_search_requests || 0, search_errors: errs, cost_usd: total };
    if (!note.topic || !note.insight) throw new Error("الملاحظة طلعت فاضية");
    await db.from("style_notes").insert(note);
  } catch (e) { error = (e as Error).message; }
  await db.from("usage_log").insert({ owner_id: uid, kind: "daily_learn", model: MODEL, input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, searches: usage.server_tool_use?.web_search_requests || 0, cost_usd: total, ok: !error, error: error || null });
  return json({ ok: !error, error: error || undefined, cost_usd: total, topic: note?.topic });
});
