// Dolaby advisor: the only place that talks to the Anthropic API.
// The browser never sees the key: it is read here with the service role.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGINS = ["https://ahmedsalah608.github.io", "http://localhost:8080", "http://127.0.0.1:8080"];

// Prices in USD per million tokens (checked on platform.claude.com, 22 Nov 2026).
const MODELS = {
  smart: "claude-sonnet-5-5",
  cheap: "claude-haiku-5-5",
};
function priceOf(model: string, inTok: number) {
  if (model.startsWith("claude-sonnet")) return { in: 2, out: 10, cr: 0.1, cw: 2.5 };
  if (model.startsWith("claude-haiku")) return inTok > 100_000 ? { in: 0.5, out: 2.5, cr: 0.05, cw: 0.625 } : { in: 0.1, out: 0.5, cr: 0.01, cw: 0.125 };
  return { in: 4, out: 20, cr: 0.4, cw: 5 };
}
const SEARCH_USD = 0.01; // $10 per 1,000 searches
const TIME_BUDGET_MS = 105_000; // free-plan functions stop at 150 s; leave room to save

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

// ---------- helpers ----------
const cairoNow = () => new Date().toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "full", timeStyle: "short" });
function monthStartCairoISO() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value, m = parts.find((p) => p.type === "month")!.value;
  // Cairo is UTC+2 (no DST assumptions needed for a monthly cap boundary within a couple of hours)
  return new Date(`${y}-${m}-01T00:00:00+02:00`).toISOString();
}
function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function parseJsonLoose(t: string) {
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e < s) throw new AppError("invalid_json", "الرد ماكانش بالشكل المطلوب. جرّب تاني.");
  return JSON.parse(t.slice(s, e + 1));
}

type Ctx = {
  req: Request; uid: string; db: any; key: string;
  started: number; usage: { model: string; in: number; out: number; cr: number; cw: number; searches: number; cost: number };
  monthSpent: number; cap: number; searched: boolean; searchErrors: string[]; sources: { url: string; title: string }[];
  actions: { tool: string; input: unknown }[];
  emit?: (ev: Record<string, unknown>) => void;
  live?: (ev: Record<string, unknown>) => void; // raw stream events (reply text as it is written)
  after: (() => Promise<void>)[]; // background work that runs after the answer is sent
};
const TOOL_LABEL: Record<string, string> = { get_profile: "بيقرا ملفك", update_profile: "بيحدّث ملفك", get_measurements: "بيبص على مقاساتك", add_measurement: "بيسجّل مقاس", list_items: "بيبص على دولابك", update_item: "بيعدّل قطعة", set_verdict: "بيحفظ حكم على قطعة", save_lesson: "بيسجّل درس اتعلمه منك", update_about: "بيحدّث اللي يعرفه عنك", set_goals: "بيحدّث أهدافك" };

// ---------- Anthropic call with all the guards ----------
// read Anthropic's SSE stream, rebuild the same message object the non-stream API returns
async function readSSE(r: Response, onText?: (t: string) => void) {
  const rd = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
  const content: any[] = []; const partial: Record<number, string> = {};
  let stop_reason = ""; let usage: any = {};
  const handle = (ev: any) => {
    switch (ev.type) {
      case "message_start": usage = { ...(ev.message?.usage || {}) }; break;
      case "content_block_start": content[ev.index] = { ...ev.content_block }; if (ev.content_block?.type === "tool_use" || ev.content_block?.type === "server_tool_use") partial[ev.index] = ""; break;
      case "content_block_delta": {
        const b = content[ev.index]; const d = ev.delta || {}; if (!b) break;
        if (d.type === "text_delta") { b.text = (b.text || "") + d.text; onText?.(d.text); }
        else if (d.type === "thinking_delta") b.thinking = (b.thinking || "") + d.thinking;
        else if (d.type === "signature_delta") b.signature = d.signature;
        else if (d.type === "input_json_delta") partial[ev.index] = (partial[ev.index] || "") + d.partial_json;
        else if (d.type === "citations_delta") (b.citations ||= []).push(d.citation);
        break;
      }
      case "content_block_stop": if (ev.index in partial) { const b = content[ev.index]; try { b.input = partial[ev.index] ? JSON.parse(partial[ev.index]) : {}; } catch { b.input = {}; b._broken = true; } delete partial[ev.index]; } break;
      case "message_delta": if (ev.delta?.stop_reason) stop_reason = ev.delta.stop_reason; usage = { ...usage, ...(ev.usage || {}) }; break;
      case "error": throw new AppError(ev.error?.type === "overloaded_error" ? "rate" : "api", "خطأ من Claude: " + (ev.error?.message || "stream error"), 502);
    }
  };
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:")); if (!line) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; } handle(ev);
    }
  }
  // a block cut off mid-stream (no stop) still holds its partial JSON
  for (const k of Object.keys(partial)) { const b = content[Number(k)]; if (b) { b.input = {}; b._broken = true; } }
  if (!stop_reason) stop_reason = "max_tokens"; // connection ended early: treat like a cut
  return { content: content.filter(Boolean).map(({ _broken, ...b }) => b), stop_reason, usage, _cutTool: content.some((b) => b?._broken) };
}

async function callClaude(ctx: Ctx, body: Record<string, unknown>, onText?: (t: string) => void) {
  // one moving cache breakpoint on the newest block, so each step of a tool loop re-reads the earlier ones cheaply
  if (Array.isArray(body.messages) && body.messages.length) {
    const msgs = body.messages as any[]; const last = msgs[msgs.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: "text", text: String(last.content) }];
    const lb = blocks[blocks.length - 1];
    body = { ...body, messages: [...msgs.slice(0, -1), { ...last, content: [...blocks.slice(0, -1), { ...lb, cache_control: { type: "ephemeral" } }] }] };
  }
  const live = !!onText;
  const left = TIME_BUDGET_MS - (Date.now() - ctx.started);
  if (left < 8_000) throw new AppError("time", "out of time");
  if (ctx.monthSpent + ctx.usage.cost >= ctx.cap) throw new AppError("cap", `وصلت لحد الصرف الشهري (${ctx.cap} دولار). تقدر تزوده من الإعدادات.`, 402);
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ctx.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(live ? { ...body, stream: true } : body),
      signal: AbortSignal.timeout(left - 4_000),
    });
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new AppError("time", "out of time");
    throw new AppError("network", "مش قادر أوصل لـClaude دلوقتي: " + (e as Error).message, 502);
  }
  let data: any;
  if (!r.ok) {
    data = await r.json().catch(() => ({}));
    const msg = data?.error?.message || r.statusText;
    if (r.status === 401) throw new AppError("bad_key", "المفتاح مش شغال (401). حط مفتاح جديد من الإعدادات.", 401);
    if (r.status === 429) throw new AppError("rate", "Claude مشغول أو وصلت لحد الطلبات (429). جرّب بعد دقيقة.", 429);
    if (/credit|balance/i.test(msg)) throw new AppError("credit", "رصيدك في Anthropic Console خلص: " + msg, 402);
    throw new AppError("api", `خطأ من Claude (${r.status}): ${msg}`, 502);
  }
  try { data = live ? await readSSE(r, onText) : await r.json(); }
  catch (e) {
    if (e instanceof AppError) throw e;
    if ((e as Error).name === "TimeoutError") throw new AppError("time", "out of time");
    throw new AppError("network", "الاتصال بـClaude اتقطع: " + (e as Error).message, 502);
  }
  const u = data.usage || {};
  const model = String(body.model);
  const pr = priceOf(model, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0));
  const searches = u.server_tool_use?.web_search_requests || 0;
  const cost = ((u.input_tokens || 0) * pr.in + (u.output_tokens || 0) * pr.out + (u.cache_read_input_tokens || 0) * pr.cr + (u.cache_creation_input_tokens || 0) * pr.cw) / 1e6 + searches * SEARCH_USD;
  Object.assign(ctx.usage, {
    model, in: ctx.usage.in + (u.input_tokens || 0), out: ctx.usage.out + (u.output_tokens || 0),
    cr: ctx.usage.cr + (u.cache_read_input_tokens || 0), cw: ctx.usage.cw + (u.cache_creation_input_tokens || 0),
    searches: ctx.usage.searches + searches, cost: ctx.usage.cost + cost,
  });
  // search bookkeeping: report failures exactly, collect sources
  for (const b of data.content || []) {
    if (b.type === "server_tool_use" && b.name === "web_search") { ctx.searched = true; ctx.emit?.({ kind: "search", label: "بدوّر على النت", detail: String(b.input?.query || "") }); }
    if (b.type === "web_search_tool_result" && b.content && !Array.isArray(b.content) && b.content.type === "web_search_tool_result_error") {
      ctx.searchErrors.push(b.content.error_code);
    }
    if (b.type === "text" && Array.isArray(b.citations)) {
      for (const c of b.citations) if (c.url && !ctx.sources.find((s) => s.url === c.url)) ctx.sources.push({ url: c.url, title: c.title || c.url });
    }
  }
  return data;
}

const webSearchTool = (maxUses = 4) => ({
  type: "web_search_20250305", name: "web_search", max_uses: maxUses,
  allowed_callers: ["direct"],
  // no country here on purpose: country "EG" is rejected
  user_location: { type: "approximate", city: "Alexandria", timezone: "Africa/Cairo" },
});

// Agent loop: runs tools, survives max_tokens/pause_turn, returns only the final answer.
// system can be a string or [stable part, changing part]; both get cache breakpoints (tools are cached with them)
type Sys = string | string[];
const sysBlocks = (s: Sys) => (Array.isArray(s) ? s : [s]).filter(Boolean).map((text) => ({ type: "text", text, cache_control: { type: "ephemeral" } }));
async function runLoop(ctx: Ctx, opts: { model: string; system: Sys; messages: any[]; tools: any[]; maxTokens: number; think?: "low" | "medium" | "high"; live?: boolean }) {
  const msgs = opts.messages;
  let extra: Record<string, unknown> = opts.think ? { thinking: { type: "adaptive" }, output_config: { effort: opts.think } } : {};
  const onText = opts.live && ctx.live ? (t: string) => ctx.live!({ type: "text", t }) : undefined;
  const pushUser = (blocks: any[]) => {
    const last = msgs[msgs.length - 1];
    if (last?.role === "user") { last.content = [...(Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]), ...blocks]; }
    else msgs.push({ role: "user", content: blocks });
  };
  let finalText = ""; let cutCount = 0;
  for (let step = 0; step < 12; step++) {
    let data;
    try {
      data = await callClaude(ctx, { model: opts.model, max_tokens: opts.maxTokens, system: sysBlocks(opts.system), messages: msgs, ...(opts.tools.length ? { tools: opts.tools } : {}), ...extra }, onText);
    } catch (e) {
      if (e instanceof AppError && e.code === "time") return { text: finalText, stopped: true };
      // safety net: if the API ever rejects the thinking settings, answer without them instead of failing
      if (e instanceof AppError && e.code === "api" && Object.keys(extra).length && /thinking|effort|output_config/i.test(e.message)) { console.error("thinking rejected:", e.message); extra = {}; step--; continue; }
      throw e;
    }
    let content: any[] = data.content || [];
    const texts = () => content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (data.stop_reason === "max_tokens") {
      cutCount++;
      const last = content[content.length - 1];
      const cutInTool = !!data._cutTool || (last && (last.type === "tool_use" || last.type === "server_tool_use"));
      // drop unfinished blocks: a tool call cut mid-way, or thinking that never got its signature
      while (content.length) { const b = content[content.length - 1]; if (b.type === "tool_use" || b.type === "server_tool_use" || (b.type === "thinking" && !b.signature)) content = content.slice(0, -1); else break; }
      if (content.length) msgs.push({ role: "assistant", content });
      if (!cutInTool) finalText += texts();
      if (cutCount > 3) return { text: finalText, stopped: true };
      if (cutInTool && onText) ctx.live!({ type: "reset" });
      pushUser([{ type: "text", text: cutInTool
        ? "ردك اتقطع وإنت بتنادي أداة. كمّل الشغل بدفعات أصغر: أداة واحدة بمدخلات قصيرة في المرة."
        : "ردك اتقطع. كمّل من نفس المكان بالظبط من غير ما تكرر." }]);
      continue;
    }
    if (data.stop_reason === "pause_turn") { msgs.push({ role: "assistant", content }); continue; }
    if (data.stop_reason === "refusal") throw new AppError("refused", "الطلب ده اترفض من Claude. جرّب تصيغه بشكل تاني.");
    const toolUses = content.filter((b) => b.type === "tool_use");
    if (data.stop_reason === "tool_use" && toolUses.length) {
      msgs.push({ role: "assistant", content });
      const results = [];
      for (const tu of toolUses) {
        ctx.emit?.({ kind: "tool", label: TOOL_LABEL[tu.name] || tu.name });
        let out: unknown; let isErr = false;
        try { out = await runTool(ctx, tu.name, tu.input || {}); }
        catch (e) { out = "خطأ: " + (e as Error).message; isErr = true; }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: typeof out === "string" ? out : JSON.stringify(out), ...(isErr ? { is_error: true } : {}) });
      }
      pushUser(results);
      finalText = ""; // only the answer after the last tool round is shown
      if (onText) ctx.live!({ type: "reset" });
      continue;
    }
    finalText += texts();
    return { text: finalText, stopped: false };
  }
  return { text: finalText, stopped: true };
}

// ---------- data access (service role, always filtered by owner) ----------
async function loadAll(ctx: Ctx) {
  const db = ctx.db, uid = ctx.uid;
  const [p, m, it, adv, les, sn] = await Promise.all([
    db.from("profiles").select("*").eq("owner_id", uid).maybeSingle(),
    db.from("measurements").select("*").eq("owner_id", uid).order("taken_at", { ascending: false }).limit(3),
    db.from("items").select("id,category,name,data,analysis,last_worn,photos").eq("owner_id", uid).order("created_at", { ascending: false }),
    db.from("advisor").select("*").eq("owner_id", uid).maybeSingle(),
    db.from("lessons").select("id,rule").eq("owner_id", uid).order("id"),
    db.from("style_notes").select("day,topic,insight").eq("owner_id", uid).order("id", { ascending: false }).limit(8),
  ]);
  return { profile: p.data, meas: m.data || [], items: it.data || [], advisor: adv.data || { about: {}, goals: [] }, lessons: les.data || [], notes: (sn.data || []) as any[] };
}
const CAT: Record<string, string> = { top: "قميص/تيشيرت", bottom: "بنطلون", outer: "جاكيت/بدلة", shoes: "جزمة", acc: "إكسسوار", perfume: "عطر" };
const VERD: Record<string, string> = { keep: "تفضل", tailor: "للخياط", remove: "تخرج" };
function itemLine(i: any) {
  const d = i.data || {}; const a = i.analysis;
  const bits = [`[${i.id}] ${CAT[i.category] || i.category}: ${i.name}`];
  if (i.category === "perfume") bits.push([d.house, d.ptype, d.role === "daily" ? "يومي" : "مناسبات", d.season, d.pstatus === "planned" ? "ناوي يشتريه " + (d.when || "") : d.pstatus === "retired" ? "بطّله" : "عنده", d.notes ? String(d.notes).slice(0, 60) : ""].filter(Boolean).join(" · "));
  else bits.push([d.color, d.brand, d.size, d.fabric, (d.occasions || []).join("، "), a ? "الحكم: " + (VERD[a.verdict] || a.verdict) + (a.fit?.overall ? " · المقاس " + a.fit.overall : "") : "لسه ماتحكمش عليها", a?.description ? String(a.description).slice(0, 80) : ""].filter(Boolean).join(" · "));
  if (i.last_worn) bits.push("آخر لبسة " + String(i.last_worn).slice(0, 10));
  return bits.join(" — ");
}
function contextText(all: Awaited<ReturnType<typeof loadAll>>) {
  const p = all.profile || {}; const d = p.data || {};
  const m = all.meas.map((x: any) => `${String(x.taken_at).slice(0, 10)}: ${Object.entries(x.data || {}).filter(([, v]) => v !== 0 && v != null).map(([k, v]) => k + " " + v).join("، ")}`).join("\n") || "(مفيش)";
  const about = all.advisor.about || {};
  const goals = (all.advisor.goals || []).filter((g: any) => g.status !== "done").map((g: any) => `- [${g.id}] ${g.title} (${g.area}) ${g.status === "paused" ? "متأجل" : "شغال"}: ${(g.steps || []).map((s: any) => (s.done ? "✓ " : "") + s.t).join("، ")}`).join("\n") || "(لسه مفيش)";
  return `النهارده: ${cairoNow()} (بتوقيت مصر). بيعيش في إسكندرية.
ملف أحمد: الاسم ${p.name || "-"} · الطول ${p.height_cm ?? "؟"} سم · بيلبس نضارة: ${p.glasses === false ? "لأ" : "أيوه (متخدشة ومش عارف ينضفها صح)"}
بيانات تانية قالها: ${Object.entries(d).map(([k, v]) => k + ": " + String(v).replace(/\s+/g, " ").slice(0, 220)).join(" | ")}
صور جسمه محفوظة: ${Object.keys(p.body_photos || {}).join("، ") || "مفيش"}
المقاسات (الأحدث الأول، سم/كجم):
${m}
اللي اتعرف عنه من المحادثات (ملخص):
${Object.keys(about).length ? Object.entries(about).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "(لسه فاضي — بيتبني مع الوقت)"}
التقييم: ${all.advisor.assessment?.summary || "لسه ما اتعملش"}
الأهداف:
${goals}
خطة الأسبوع: ${all.advisor.week && !all.advisor.week.done ? all.advisor.week.goal + " · التحدي: " + all.advisor.week.challenge : "مفيش"}
ملاحظات الموضة من بحثك اليومي (الأحدث الأول):
${all.notes.map((n: any) => `- ${n.day}: ${n.topic} — ${String(n.insight).slice(0, 220)}`).join("\n") || "(لسه مفيش)"}
الدولاب (${all.items.length} قطعة):
${all.items.map(itemLine).join("\n") || "(فاضي)"}`;
}
function lessonsText(lessons: any[]) {
  return lessons.length ? "دروس اتعلمتها من أحمد (التزم بيها دايماً):\n" + lessons.map((l) => `- ${l.rule}`).join("\n") : "دروس اتعلمتها: (لسه مفيش)";
}

const RULES = `إنت "لورينزو": خيّاط ومستشار مظهر إيطالي شيك، خبرة سنين في ستايلات العالم كله، وبتتكلم عامية مصرية بسيطة مع أحمد (بتناديه "يا أحمد"). خبرتك: الهدوم والمقاسات والخياطة، النضارات، الحلاقة والشعر والدقن والعناية الشخصية، الإتيكيت، الشخصية والثقة، الجسم والوقفة، المشي، وطريقة الكلام.
طريقة كلامك:
- اتكلم زي خيّاط شاطر بيكلم زبون يعرفه كويس: طبيعي ومباشر ودافي، مش زي تقرير.
- جاوب على السؤال في أول جملة (أيوه / لأ / الأحسن كذا)، وبعدين السبب في جملة أو اتنين. لو السؤال بسيط، الرد يبقى قصير.
- الرد العادي من 2 لـ5 جمل. لو فيه أكتر من فكرة، تقدر تفصل بينهم بسطر فيه --- لوحده، بس مش لازم.
- ما تكررش كلام قلته قبل كده في المحادثة، وما تعيدش وصف حاجة وصفتها، وما تفتحش كل رد بنفس الطريقة، وما تقولش "يا أحمد" في كل رد.
- علامات **مؤكد:** و**رأيي:** استخدمها بس لما تخلط معلومة بتخمين في نفس الرد والفرق مهم. مش في كل رد.
- سؤال واحد بالكتير في الرد، وبس لو محتاجه فعلاً عشان تجاوب. لو أحمد جاوب على حاجة قبل كده أو قال إنه مش عارف، ما تسألوش تاني.
- لما يقول تفضيل جديد مهم من غير سبب، اسأله "ليه" مرة واحدة. مش في كل رد.
- كارت الترشيح بس لما ترشح طقم أو كذا قطعة، بالشكل ده (JSON في سطر واحد):
\`\`\`card
{"title":"عنوان قصير","tag":"كلمتين","rows":[{"item_id":"id القطعة لو من الدولاب أو فاضي","title":"اسم","sub":"سبب في جملة"}],"footer":"ناقصك: ... (اختياري)","action":"زرار اختياري"}
\`\`\`
- ردود جاهزة [[ردود: ... | ...]] اختيارية: حطها بس لما يكون فيه اختيارات واضحة أحمد ممكن يدوس عليها، ومكتوبة بلسانه هو.
- الفيديو [[يوتيوب: جملة البحث]] بس لما يكون فيه مهارة يتعلمها بإيده (ربطة كرافتة، تنضيف، وقفة، حلاقة). مش في كل رد. ما تخترعش لينكات.
- الصور: أي صورة ظاهرة قدامك في المحادثة إنت شايفها فعلاً، علّق عليها بثقة. الصور القديمة اللي مش قدامك دلوقتي إنت شفتها قبل كده: اعتمد على اللي قلته عنها، وما تنكرش إنك شفتها.
طريقتك:
- صريح ومن غير مجاملة، وأقل إنجليزي ممكن.
- ما تفترضش حاجة ما قالهاش ومش باينة.
- شغلك خطوة خطوة: تقييم، بعدين أهداف، بعدين تحسين تدريجي، واربط كلامك بالأهداف لما ينفع.
- الستايل والشغل والمناسبات بيتبنوا من كلامه: أول ما تعرف حاجة ثابتة عنه سجلها بأداة update_about.
- لما يصححك أو يقول تفضيل: سجّل قاعدة عامة قصيرة بأداة save_lesson.
- الأسعار والمحلات والإحصائيات: ممنوع تخترعها. أي سعر أو محل أو رقم لازم يكون من بحث web_search في نفس الرد ده مع اللينك. غير كده اكتب قبلها "**اقتراح (من غير بحث):**".
- ملاحظات الموضة اليومية اللي تحت هي بحثك إنت في الأيام اللي فاتت: استخدمها كخلفية، وما تقدمهاش على إنها أسعار النهارده.
- ماتربطش الكلام بميزانية أو تحويش.
- الصحة والوزن والأدوية: كلام عام بس، من غير أرقام أكل أو سعرات، وارجعه لدكتوره. النضارة الطبية قرارها عند دكتور العيون.
- علّق على اللي باين في الصورة بس، من غير تخمين حاجات مش ظاهرة.
- لما تغيّر بيانات بأداة، قول في جملة قصيرة إيه اللي اتغير.
ميزتك على أي مساعد عام إنك عارف أحمد ودولابه:
- قبل ما ترشح حاجة، بص في دولابه ورشّح من القطع اللي عنده بالاسم الأول، وقول الناقص بس لو فعلاً ناقص.
- لو بعت صورة لقطعة، قارنها باللي عنده (بتتلبس مع إيه، مكررة ولا لأ).
- خلّي النصيحة مخصوصة ليه: مقاساته، طوله، شغله، مناسباته، أهدافه، والدروس اللي اتعلمتها منه. نصيحة تنفع أي حد = نصيحة ضعيفة.
- لو مش متأكد، قول إنك مش متأكد واقترح إزاي نتأكد، بدل ما تخمّن بثقة.
- لو السؤال محتاج معلومة حديثة (منتج، ترند، سعر)، ابحث.`;

// ---------- tools the advisor may call ----------
const TOOLS = [
  { name: "get_profile", description: "يقرا ملف أحمد كامل.", input_schema: { type: "object", properties: {} } },
  { name: "update_profile", description: "يحدّث ملف أحمد. fields: name, height_cm, glasses (true/false) أو أي معلومة تانية تتحط في data (زي job, events, style, perfumePrefs).", input_schema: { type: "object", properties: { fields: { type: "object" } }, required: ["fields"] } },
  { name: "get_measurements", description: "يجيب آخر المقاسات.", input_schema: { type: "object", properties: { limit: { type: "integer" } } } },
  { name: "add_measurement", description: "يسجل قياس جديد قاله أحمد بنفسه (سم/كجم). keys: chest, waist, shoulder, hips, neck, sleeve, inseam, weightKg, shoe.", input_schema: { type: "object", properties: { data: { type: "object" } }, required: ["data"] } },
  { name: "list_items", description: "يجيب قطع الدولاب كلها أو نوع واحد.", input_schema: { type: "object", properties: { category: { type: "string", enum: ["top", "bottom", "outer", "shoes", "acc", "perfume"] } } } },
  { name: "update_item", description: "يعدّل بيانات قطعة (name أو حقول data زي color, notes, season, occasions, pstatus, when).", input_schema: { type: "object", properties: { item_id: { type: "string" }, name: { type: "string" }, data: { type: "object" } }, required: ["item_id"] } },
  { name: "set_verdict", description: "يحفظ حكم على قطعة هدوم: keep أو tailor أو remove، مع السبب والتعديلات المطلوبة.", input_schema: { type: "object", properties: { item_id: { type: "string" }, verdict: { type: "string", enum: ["keep", "tailor", "remove"] }, reason: { type: "string" }, tailoring: { type: "array", items: { type: "object", properties: { what: { type: "string" }, why: { type: "string" }, reversible: { type: "boolean" } } } } }, required: ["item_id", "verdict", "reason"] } },
  { name: "save_lesson", description: "يحفظ قاعدة عامة قصيرة اتعلمتها من تصحيح أو تفضيل أحمد. استخدمها كل ما يصححك أو يقول تفضيل.", input_schema: { type: "object", properties: { rule: { type: "string" } }, required: ["rule"] } },
  { name: "update_about", description: "يحدّث ملخص 'اللي أعرفه عن أحمد'. sections: style, job, events, goals, progress, body, grooming, glasses, other. اكتب الملخص الكامل الجديد للقسم.", input_schema: { type: "object", properties: { section: { type: "string" }, text: { type: "string" } }, required: ["section", "text"] } },
  { name: "set_goals", description: "يستبدل قائمة الأهداف. كل هدف: id (لو موجود), area, title, why, status (active|paused|done), steps [{t, done}].", input_schema: { type: "object", properties: { goals: { type: "array", items: { type: "object" } } }, required: ["goals"] } },
];

async function logAction(ctx: Ctx, tool: string, input: unknown) {
  ctx.actions.push({ tool, input });
  await ctx.db.from("activity").insert({ owner_id: ctx.uid, actor: "advisor", kind: tool, detail: input as any });
}
async function runTool(ctx: Ctx, name: string, input: any) {
  const db = ctx.db, uid = ctx.uid;
  switch (name) {
    case "get_profile": { const { data } = await db.from("profiles").select("name,height_cm,glasses,data,body_photos").eq("owner_id", uid).maybeSingle(); return data || {}; }
    case "update_profile": {
      const { data: cur } = await db.from("profiles").select("*").eq("owner_id", uid).maybeSingle();
      const f = input.fields || {}; const top: any = {}; const extra: any = {};
      for (const [k, v] of Object.entries(f)) { if (["name", "height_cm", "glasses"].includes(k)) top[k] = v; else extra[k] = v; }
      const row = { owner_id: uid, ...top, data: { ...(cur?.data || {}), ...extra }, updated_at: new Date().toISOString() };
      const { error } = await db.from("profiles").upsert(row); if (error) throw error;
      await logAction(ctx, name, f); return "اتحفظ";
    }
    case "get_measurements": { const { data } = await db.from("measurements").select("taken_at,data").eq("owner_id", uid).order("taken_at", { ascending: false }).limit(Math.min(12, input.limit || 3)); return data; }
    case "add_measurement": { const { error } = await db.from("measurements").insert({ owner_id: uid, data: input.data || {} }); if (error) throw error; await logAction(ctx, name, input.data); return "اتسجل"; }
    case "list_items": { let q = db.from("items").select("id,category,name,data,analysis,last_worn").eq("owner_id", uid); if (input.category) q = q.eq("category", input.category); const { data } = await q; return (data || []).map(itemLine).join("\n") || "(مفيش)"; }
    case "update_item": {
      const { data: cur } = await db.from("items").select("*").eq("owner_id", uid).eq("id", input.item_id).maybeSingle();
      if (!cur) throw new Error("القطعة مش موجودة");
      const patch: any = { updated_at: new Date().toISOString(), data: { ...(cur.data || {}), ...(input.data || {}) } };
      if (input.name) patch.name = input.name;
      const { error } = await db.from("items").update(patch).eq("owner_id", uid).eq("id", input.item_id); if (error) throw error;
      await logAction(ctx, name, input); return "اتعدلت";
    }
    case "set_verdict": {
      const { data: cur } = await db.from("items").select("analysis").eq("owner_id", uid).eq("id", input.item_id).maybeSingle();
      if (!cur) throw new Error("القطعة مش موجودة");
      const analysis = { ...(cur.analysis || {}), verdict: input.verdict, verdictReason: input.reason, tailoring: input.tailoring || [], at: Date.now(), by: "chat" };
      const { error } = await db.from("items").update({ analysis, analysis_stale: false }).eq("owner_id", uid).eq("id", input.item_id); if (error) throw error;
      await logAction(ctx, name, input); return "الحكم اتحفظ";
    }
    case "save_lesson": {
      const rule = String(input.rule || "").trim().slice(0, 300); if (!rule) throw new Error("القاعدة فاضية");
      const { error } = await db.from("lessons").insert({ owner_id: uid, rule, source: "chat" }); if (error) throw error;
      await logAction(ctx, name, { rule }); return "الدرس اتحفظ";
    }
    case "update_about": {
      const { data: cur } = await db.from("advisor").select("about").eq("owner_id", uid).maybeSingle();
      const about = { ...(cur?.about || {}), [String(input.section)]: String(input.text).slice(0, 1200) };
      const { error } = await db.from("advisor").upsert({ owner_id: uid, about, updated_at: new Date().toISOString() }); if (error) throw error;
      await logAction(ctx, name, input); return "الملخص اتحدث";
    }
    case "set_goals": {
      const goals = (input.goals || []).slice(0, 8).map((g: any, i: number) => ({ id: g.id || "g" + Date.now() + i, area: String(g.area || ""), title: String(g.title || ""), why: String(g.why || ""), status: ["active", "paused", "done"].includes(g.status) ? g.status : "active", steps: (g.steps || []).slice(0, 8).map((s: any) => typeof s === "string" ? { t: s, done: false } : { t: String(s.t || ""), done: !!s.done }) }));
      const { error } = await db.from("advisor").upsert({ owner_id: uid, goals, updated_at: new Date().toISOString() }); if (error) throw error;
      await logAction(ctx, name, { count: goals.length }); return "الأهداف اتحدثت";
    }
  }
  throw new Error("أداة مش معروفة: " + name);
}

// ---------- images ----------
async function imageBlock(ctx: Ctx, path: string) {
  if (!path.startsWith(ctx.uid + "/")) throw new AppError("forbidden", "صورة مش بتاعتك", 403);
  const { data, error } = await ctx.db.storage.from("photos").download(path);
  if (error || !data) throw new AppError("image", "مش لاقي الصورة: " + path);
  if (data.size > 3_500_000) throw new AppError("image", "الصورة كبيرة قوي. صغّرها وارفعها تاني.");
  const mt = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mt, data: toB64(await data.arrayBuffer()) } };
}

// ---------- modes ----------
const HISTORY = 30; // messages sent in full; older ones live in a rolling summary
async function chatExtras(ctx: Ctx) {
  const [{ data: sum }, { data: fb }] = await Promise.all([
    ctx.db.from("app_state").select("value").eq("owner_id", ctx.uid).eq("key", "chat_summary").maybeSingle(),
    ctx.db.from("chat_messages").select("content,feedback").eq("owner_id", ctx.uid).eq("role", "assistant").not("feedback", "is", null).order("id", { ascending: false }).limit(12),
  ]);
  const FB: Record<string, string> = { repeat: "مكرر", long: "طويل", wrong: "غلط", lost: "مش فاهمني", generic: "عام ومش ليا" };
  const fbLines = (fb || []).map((m: any) => {
    const f = m.feedback || {}; const why = [FB[f.why] || "", f.note ? String(f.note).slice(0, 120) : ""].filter(Boolean).join(": ");
    return `- ${f.v === "up" ? "👍 عجبه" : "👎 ماعجبهوش"}${why ? " (" + why + ")" : ""} — ردك كان: «${String(m.content || "").replace(/\s+/g, " ").slice(0, 140)}»`;
  }).join("\n");
  return {
    summary: String(sum?.value?.text || ""), summaryUpto: Number(sum?.value?.upto_id || 0),
    text: `ملخص المحادثات الأقدم (اللي مش ظاهرة تحت):\n${sum?.value?.text || "(مفيش لسه)"}\n\nتقييم أحمد لردودك الأخيرة (اتعلّم منه: كرر اللي عجبه وابعد عن اللي ماعجبهوش):\n${fbLines || "(لسه ماقيّمش)"}`,
  };
}
// fold messages that fell out of the window into a short running summary (cheap model, after the reply is sent)
async function updateSummary(ctx: Ctx, oldestShownId: number, prev: string, upto: number) {
  const { data: rows } = await ctx.db.from("chat_messages").select("id,role,content,image_path").eq("owner_id", ctx.uid).gt("id", upto).lt("id", oldestShownId).order("id").limit(60);
  if (!rows || rows.length < 10) return;
  const convo = rows.map((m: any) => (m.role === "user" ? "أحمد: " : "لورينزو: ") + (m.image_path ? "[صورة] " : "") + String(m.content || "").replace(/\s+/g, " ").slice(0, 500)).join("\n");
  const before = ctx.usage.cost;
  const r = await callClaude(ctx, { model: MODELS.cheap, max_tokens: 900, system: "بتلخّص محادثة بين أحمد ومستشار الستايل بتاعه عشان المستشار يفتكرها. اكتب ملخص واحد محدّث بالعامية المصرية، نقط قصيرة: اللي أحمد قاله عن نفسه وتفضيلاته، القرارات، النصايح اللي اتقالت ورد فعله عليها، والحاجات اللي لسه مفتوحة. ما تضيفش حاجة ماتقالتش. ما تكتبش أي حاجة عن الصحة أو الأدوية. أقل من 1200 حرف.", messages: [{ role: "user", content: `الملخص القديم:\n${prev || "(مفيش)"}\n\nرسايل جديدة:\n${convo}` }] });
  const text = (r.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim().slice(0, 1500);
  if (!text) return;
  await ctx.db.from("app_state").upsert({ owner_id: ctx.uid, key: "chat_summary", value: { text, upto_id: rows[rows.length - 1].id, at: Date.now() }, updated_at: new Date().toISOString() });
  await ctx.db.from("usage_log").insert({ owner_id: ctx.uid, kind: "summary", model: MODELS.cheap, cost_usd: ctx.usage.cost - before, ok: true });
}

async function modeChat(ctx: Ctx, body: any) {
  const text = String(body.text || "").trim().slice(0, 4000);
  const imagePath = body.image_path ? String(body.image_path) : null;
  if (!text && !imagePath) throw new AppError("empty", "اكتب رسالة أو ابعت صورة.");
  ctx.emit?.({ kind: "read", label: "بيبص على دولابك وملفك" });
  const [all, ex] = await Promise.all([loadAll(ctx), chatExtras(ctx)]);
  const { data: hist } = await ctx.db.from("chat_messages").select("id,role,content,image_path,created_at").eq("owner_id", ctx.uid).order("id", { ascending: false }).limit(HISTORY);
  // one reply at a time: if the last message is still waiting for its reply, don't start a second one
  const lastMsg = (hist || [])[0];
  if (lastMsg?.role === "user" && Date.now() - Date.parse(lastMsg.created_at) < 100_000) throw new AppError("busy", "لسه بيرد على رسالتك اللي فاتت. استنى ثواني وهيظهر الرد.", 409);
  await ctx.db.from("chat_messages").insert({ owner_id: ctx.uid, role: "user", content: text, image_path: imagePath });
  const past = (hist || []).reverse();
  // the last 3 photos go back in as real images, so he never "forgets" what he saw
  const recentImgs = new Set(past.filter((m: any) => m.image_path).slice(-3).map((m: any) => m.image_path));
  const clean = (t: string) => String(t || "").replace(/\[\[ردود:[^\]]*\]\]/g, "").replace(/```card\s*([\s\S]*?)```/g, (_m, j) => { try { return "(كارت: " + JSON.parse(j).title + ")"; } catch { return ""; } }).trim();
  const messages: any[] = [];
  for (const m of past) {
    const blocks: any[] = [];
    if (m.role === "user" && m.image_path) {
      if (recentImgs.has(m.image_path)) { try { blocks.push(await imageBlock(ctx, m.image_path)); } catch { blocks.push({ type: "text", text: "(صورة مابقتش موجودة)" }); } }
      else blocks.push({ type: "text", text: "(صورة قديمة شفتها قبل كده)" });
    }
    const t = m.role === "assistant" ? clean(m.content) : String(m.content || "");
    if (t) blocks.push({ type: "text", text: t });
    if (!blocks.length) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content.push(...blocks); else messages.push({ role: m.role, content: blocks });
  }
  if (messages[0]?.role === "assistant") messages.shift();
  const cur: any[] = [];
  if (imagePath) cur.push(await imageBlock(ctx, imagePath));
  cur.push({ type: "text", text: text || "(بعتلك صورة)" });
  const lastM = messages[messages.length - 1];
  if (lastM?.role === "user") lastM.content.push(...cur); else messages.push({ role: "user", content: cur });
  if ((hist || []).length >= HISTORY) { const oldest = Number(hist![hist!.length - 1].id); if (oldest - ex.summaryUpto > 12) ctx.after.push(() => updateSummary(ctx, oldest, ex.summary, ex.summaryUpto)); }
  const system = [`${RULES}\n\n${lessonsText(all.lessons)}`, `${contextText(all)}\n\n${ex.text}`];
  ctx.emit?.({ kind: "think", label: "بيفكر في الرد" });
  const r = await runLoop(ctx, { model: MODELS.smart, system, messages, tools: [...TOOLS, webSearchTool(4)], maxTokens: 10000, think: "medium", live: true });
  ctx.emit?.({ kind: "write", label: "بيكتبلك الرد" });
  let reply = r.text.trim();
  if (r.stopped) reply = (reply ? reply + "\n\n" : "") + "وقفت قبل ما أخلص عشان الوقت. اكتب «كمل» وأنا هكمّل.";
  if (ctx.searchErrors.length) reply += `\n\n⚠ البحث فشل: ${[...new Set(ctx.searchErrors)].join("، ")}`;
  if (!reply) reply = "ماوصلنيش رد. جرّب تاني.";
  const meta = { searched: ctx.searched, searchErrors: ctx.searchErrors, sources: ctx.sources.slice(0, 8), actions: ctx.actions.map((a) => a.tool), stopped: r.stopped };
  const { data: saved } = await ctx.db.from("chat_messages").insert({ owner_id: ctx.uid, role: "assistant", content: reply, model: ctx.usage.model, cost_usd: ctx.usage.cost, meta }).select("id,created_at").single();
  return { reply, id: saved?.id, model: ctx.usage.model, cost_usd: ctx.usage.cost, ...meta };
}

async function jsonJob(ctx: Ctx, model: string, prompt: string, images: any[] = [], withSearch = false, maxTokens = 3000) {
  const all = await loadAll(ctx);
  const system = [`${RULES}\n\n${lessonsText(all.lessons)}`, `${contextText(all)}\n\nرد بـJSON بس، من غير أي كلام قبله أو بعده.`];
  const smart = model === MODELS.smart;
  const r = await runLoop(ctx, { model, system, messages: [{ role: "user", content: [...images, { type: "text", text: prompt }] }], tools: withSearch ? [webSearchTool(5)] : [], maxTokens: smart ? maxTokens + 6000 : maxTokens, think: smart ? "medium" : undefined });
  if (r.stopped && !r.text) throw new AppError("time", "الشغل طوّل ووقفت. دوس تاني وقول «كمل».", 408);
  return { all, out: parseJsonLoose(r.text) };
}

async function modeVerdict(ctx: Ctx, body: any) {
  const { data: it } = await ctx.db.from("items").select("*").eq("owner_id", ctx.uid).eq("id", String(body.item_id)).maybeSingle();
  if (!it) throw new AppError("missing", "القطعة مش موجودة");
  const order = ["wornFront", "wornBack", "flatFront", "flatBack", "tag"].filter((k) => it.photos?.[k]).slice(0, 4);
  if (!order.length) throw new AppError("no_photos", "ضيف صور للقطعة الأول.");
  const imgs = []; for (const k of order) imgs.push(await imageBlock(ctx, it.photos[k]));
  const prompt = `حلّل القطعة دي [${it.id}] وقرر: keep أو tailor أو remove. الصور بالترتيب: ${order.join("، ")}.
قواعد: احكم على المقاس من صور اللبس أساساً (خياطة الكتف، الكم، الصدر والوسط، طول البنطلون). لو مفيش صور لبس قول إن الحكم محدود وخلّي الثقة "قليلة". لو المقاسات بتتغير فضّل التعديلات اللي ترجع. ما تخترعش حاجة مش باينة.
{"description":"","fit":{"overall":"مظبوط | واسع شوية | واسع | ضيق شوية | ضيق | مش واضح","notes":[""]},"verdict":"keep|tailor|remove","verdictReason":"","tailoring":[{"what":"","why":"","reversible":true}],"condition":"","styleNotes":"","pairsWith":[""],"photoTips":"","confidence":"عالية | متوسطة | قليلة"}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt, imgs);
  const A = (x: any) => Array.isArray(x) ? x : [];
  const analysis = { description: String(out.description || ""), fit: { overall: String(out.fit?.overall || ""), notes: A(out.fit?.notes).map(String).slice(0, 8) }, verdict: ["keep", "tailor", "remove"].includes(out.verdict) ? out.verdict : "keep", verdictReason: String(out.verdictReason || ""), tailoring: A(out.tailoring).slice(0, 8).map((t: any) => ({ what: String(t?.what || ""), why: String(t?.why || ""), reversible: !!t?.reversible })), condition: String(out.condition || ""), styleNotes: String(out.styleNotes || ""), pairsWith: A(out.pairsWith).map(String).slice(0, 10), photoTips: String(out.photoTips || ""), confidence: String(out.confidence || ""), at: Date.now(), photosUsed: order };
  await ctx.db.from("items").update({ analysis, analysis_stale: false }).eq("owner_id", ctx.uid).eq("id", it.id);
  await logAction(ctx, "verdict", { item_id: it.id, verdict: analysis.verdict });
  return { analysis };
}

async function modeReport(ctx: Ctx) {
  const prompt = `راجع الدولاب كله (هدوم وعطور). المطلوب: ملخص صريح في سطرين، نقط القوة، الناقص مرتب بالأولوية (1 ضروري، 2 مهم، 3 لو ينفع) ولكل واحد ليه وهيعمل كام طقم جديد تقريباً، المكرر، وملاحظة عن الألوان. ما تخترعش قطع مش موجودة. ما تربطش بميزانية.
{"summary":"","strengths":[""],"gaps":[{"item":"","why":"","priority":1,"newOutfits":0}],"duplicates":[""],"colors":""}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt);
  const A = (x: any) => Array.isArray(x) ? x : [];
  const value = { summary: String(out.summary || ""), strengths: A(out.strengths).map(String).slice(0, 8), gaps: A(out.gaps).slice(0, 12).map((g: any) => ({ item: String(g?.item || ""), why: String(g?.why || ""), priority: [1, 2, 3].includes(Number(g?.priority)) ? Number(g.priority) : 3, newOutfits: Number(g?.newOutfits) || 0 })), duplicates: A(out.duplicates).map(String).slice(0, 8), colors: String(out.colors || ""), at: Date.now() };
  await ctx.db.from("app_state").upsert({ owner_id: ctx.uid, key: "closet_report", value, updated_at: new Date().toISOString() });
  return { report: value };
}

async function modeShop(ctx: Ctx, body: any) {
  const ask = String(body.ask || "").slice(0, 500);
  const { data: rep } = await ctx.db.from("app_state").select("value").eq("owner_id", ctx.uid).eq("key", "closet_report").maybeSingle();
  const gaps = (rep?.value?.gaps || []).map((g: any) => `- [${g.priority}] ${g.item}: ${g.why}`).join("\n") || "(لسه ما اتعملش تحليل للدولاب)";
  const prompt = `رشّح لأحمد يشتري إيه بعد كده عشان يكمّل دولابه، ومنين في إسكندرية أو أونلاين في مصر. ${ask ? "طلبه: " + ask : ""}
الناقص من آخر تحليل:
${gaps}
ابحث بـweb_search عن أسعار ولينكات حقيقية حالية. كل سعر أو محل لازم يكون من بحث النهارده ومعاه اللينك، وfromSearch=true. أي حاجة مش من بحث خلّي fromSearch=false وما تكتبش سعر. 3 لـ6 ترشيحات بالأولوية.
{"picks":[{"item":"","why":"","priority":1,"store":"","price":"","link":"","fromSearch":true}],"note":""}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt, [], true, 4000);
  const A = (x: any) => Array.isArray(x) ? x : [];
  const okUrl = (u: string) => /^https?:\/\//.test(u) && ctx.sources.some((s) => s.url === u || u.startsWith(new URL(s.url).origin));
  const picks = A(out.picks).slice(0, 8).map((p: any) => {
    const link = String(p?.link || ""); const fromSearch = !!p?.fromSearch && ctx.searched && (!link || okUrl(link));
    return { item: String(p?.item || ""), why: String(p?.why || ""), priority: Number(p?.priority) || 3, store: String(p?.store || ""), price: fromSearch ? String(p?.price || "") : "", link: fromSearch ? link : "", fromSearch };
  });
  const value = { picks, note: String(out.note || ""), sources: ctx.sources.slice(0, 10), searched: ctx.searched, searchErrors: ctx.searchErrors, at: Date.now() };
  await ctx.db.from("app_state").upsert({ owner_id: ctx.uid, key: "shop", value, updated_at: new Date().toISOString() });
  return { shop: value };
}

async function modeOutfit(ctx: Ctx, body: any) {
  const prompt = `رشّح طقم النهارده من دولابه بس، ومعاه عطر من عطوره اللي عنده (مش اللي ناوي يشتريه). رايح: ${String(body.occasion || "مشوار")} · الجو: ${String(body.weather || "معتدل")} في إسكندرية${body.note ? " · طلبه: " + String(body.note).slice(0, 200) : ""}.
قواعد: استخدم الـid اللي بين [] بالظبط. لو نوع ناقص اكتبه في missing. ما تخترعش قطع. لو مفيش هدوم رجّع pieces فاضية ورشّح العطر بس. للشغل والمشاوير البسيطة استخدم عطر يومي.
{"pieces":[{"id":"","why":""}],"perfume":{"id":"","why":""},"tip":"","missing":""}`;
  const { all, out } = await jsonJob(ctx, MODELS.cheap, prompt, [], false, 1200);
  const ids = new Set(all.items.map((i: any) => i.id));
  const pieces = (Array.isArray(out.pieces) ? out.pieces : []).filter((p: any) => ids.has(String(p?.id))).map((p: any) => ({ id: String(p.id), why: String(p.why || "") })).slice(0, 6);
  const perfume = out.perfume && ids.has(String(out.perfume.id)) ? { id: String(out.perfume.id), why: String(out.perfume.why || "") } : null;
  const value = { day: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }), occasion: body.occasion || "", weather: body.weather || "", pieces, perfume, tip: String(out.tip || ""), missing: String(out.missing || ""), worn: false, fb: null, at: Date.now() };
  await ctx.db.from("app_state").upsert({ owner_id: ctx.uid, key: "today", value, updated_at: new Date().toISOString() });
  return { today: value };
}

async function modeAssess(ctx: Ctx) {
  const { data: p } = await ctx.db.from("profiles").select("body_photos").eq("owner_id", ctx.uid).maybeSingle();
  const bp = p?.body_photos || {}; const keys = ["bodyFront", "bodySide", "bodyBack"].filter((k) => bp[k]);
  const imgs = []; for (const k of keys) imgs.push(await imageBlock(ctx, bp[k]));
  const { data: adv } = await ctx.db.from("advisor").select("*").eq("owner_id", ctx.uid).maybeSingle();
  const prev = adv?.assessment;
  const prompt = `${imgs.length ? "الصور المرفقة: صور جسمه (" + keys.join("، ") + ")." : "مفيش صور جسم."}
اعمل تقييم صريح ومحترم في المجالات دي: الهدوم والمقاس، الجسم والوقفة، الشعر والدقن والحلاقة، العناية الشخصية، النضارة، الكلام ولغة الجسد والمشي، الإتيكيت والشخصية.
لكل مجال: score من 10 أو null لو مش قادر تحكم، now، why، gaps (اللي محتاج تعرفه). بعدين 3 لـ5 أهداف بالأهم والأسهل تأثير، لكل هدف 3 لـ5 خطوات صغيرة. ما تحكمش على حاجة مش باينة، ولا أرقام أكل أو سعرات.${prev ? "\nقارن بالتقييم اللي فات: " + prev.summary : ""}
{"summary":"","areas":[{"key":"clothes|body|grooming|skin|glasses|speech|etiquette","name":"","score":6,"now":"","why":"","gaps":[""]}],"goals":[{"area":"","title":"","why":"","steps":[""]}],"firstFocus":""}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt, imgs, false, 4000);
  const A = (x: any) => Array.isArray(x) ? x : [];
  const assessment = { at: Date.now(), summary: String(out.summary || ""), firstFocus: String(out.firstFocus || ""), areas: A(out.areas).slice(0, 8).map((a: any) => ({ key: String(a?.key || ""), name: String(a?.name || ""), score: a?.score == null || a?.score === "" ? null : Math.max(0, Math.min(10, Number(a.score) || 0)), now: String(a?.now || ""), why: String(a?.why || ""), gaps: A(a?.gaps).map(String).slice(0, 4) })) };
  const newGoals = A(out.goals).slice(0, 5).map((g: any, i: number) => ({ id: "g" + Date.now() + i, area: String(g?.area || ""), title: String(g?.title || ""), why: String(g?.why || ""), status: "active", steps: A(g?.steps).slice(0, 6).map((t: any) => ({ t: String(t), done: false })) }));
  const hasGoals = (adv?.goals || []).length > 0;
  const history = [...(adv?.history || [])]; if (prev) history.push({ kind: "assessment", at: prev.at, scores: Object.fromEntries((prev.areas || []).map((x: any) => [x.key, x.score])) });
  await ctx.db.from("advisor").upsert({ owner_id: ctx.uid, assessment: { ...assessment, suggestedGoals: hasGoals ? newGoals : [] }, goals: hasGoals ? adv.goals : newGoals, history: history.slice(-40), updated_at: new Date().toISOString() });
  await logAction(ctx, "assessment", { areas: assessment.areas.length });
  return { assessment };
}

async function modeWeek(ctx: Ctx) {
  const { data: adv } = await ctx.db.from("advisor").select("*").eq("owner_id", ctx.uid).maybeSingle();
  const hist = (adv?.history || []).filter((h: any) => h.kind === "week").slice(-6).map((h: any) => `- ${h.goal}: ${h.result}${h.note ? " (" + h.note + ")" : ""}`).join("\n") || "(أول أسبوع)";
  const prompt = `الأسابيع اللي فاتت:\n${hist}\nجهّز خطة الأسبوع: هدف واحد من الأهداف الشغالة (لو أسبوع فات ما خلصش كمّل بخطوة أسهل)، درس عملي من 4 لـ6 جمل، تحدي واحد ينفع يتقاس، من 3 لـ5 حاجات صغيرة يعلّم عليها، ومن 2 لـ3 جمل بحث يوتيوب.
{"goal":"","lesson":"","challenge":"","checklist":[""],"videos":[""],"tip":""}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt, [], false, 2000);
  const A = (x: any) => Array.isArray(x) ? x : [];
  const week = { start: Date.now(), goal: String(out.goal || ""), lesson: String(out.lesson || ""), challenge: String(out.challenge || ""), checklist: A(out.checklist).slice(0, 6).map((t: any) => ({ t: String(t), done: false })), videos: A(out.videos).map(String).slice(0, 3), tip: String(out.tip || ""), done: false };
  await ctx.db.from("advisor").upsert({ owner_id: ctx.uid, week, updated_at: new Date().toISOString() });
  return { week };
}

async function modeReview(ctx: Ctx, body: any) {
  const since = String(body.since || new Date(Date.now() - 7 * 864e5).toISOString());
  const [msgs, acts, les] = await Promise.all([
    ctx.db.from("chat_messages").select("role,content,created_at,feedback").eq("owner_id", ctx.uid).gte("created_at", since).order("id").limit(120),
    ctx.db.from("activity").select("actor,kind,detail,created_at").eq("owner_id", ctx.uid).gte("created_at", since).order("id").limit(200),
    ctx.db.from("lessons").select("rule,created_at").eq("owner_id", ctx.uid).gte("created_at", since),
  ]);
  const convo = (msgs.data || []).map((m: any) => (m.role === "user" ? "أحمد: " : "المستشار: ") + String(m.content).slice(0, 600) + (m.feedback ? ` [تقييم أحمد: ${m.feedback.v === "up" ? "👍" : "👎"} ${m.feedback.why || ""} ${m.feedback.note || ""}]` : "")).join("\n").slice(0, 30000);
  const prompt = `ده كل اللي حصل من ${since} لحد دلوقتي. لخّص الأسبوع لمراجعة يوم الأحد:
المحادثات:\n${convo || "(مفيش)"}
الأفعال:\n${JSON.stringify(acts.data || []).slice(0, 12000)}
دروس جديدة:\n${(les.data || []).map((l: any) => "- " + l.rule).join("\n") || "(مفيش)"}
افصل بين اللي المستشار نصح بيه، واللي أحمد عمله فعلاً (من الأفعال بس، ما تفترضش)، واللي اتعلمه المستشار، وإيه اللي محتاج يتصلح في المستشار نفسه.
{"advised":[""],"did":[""],"learned":[""],"fixAdvisor":[""],"nextWeek":[""],"summary":""}`;
  const { out } = await jsonJob(ctx, MODELS.smart, prompt, [], false, 2500);
  const value = { since, at: Date.now(), ...out };
  await ctx.db.from("app_state").upsert({ owner_id: ctx.uid, key: "review", value, updated_at: new Date().toISOString() });
  return { review: value };
}

// cheap pass: catch preferences/corrections the advisor didn't save as lessons
async function modeLearn(ctx: Ctx) {
  const { data: msgs } = await ctx.db.from("chat_messages").select("role,content").eq("owner_id", ctx.uid).order("id", { ascending: false }).limit(8);
  const { data: les } = await ctx.db.from("lessons").select("rule").eq("owner_id", ctx.uid);
  const convo = (msgs || []).reverse().map((m: any) => (m.role === "user" ? "أحمد: " : "المستشار: ") + String(m.content).slice(0, 800)).join("\n");
  const sys = "دي محادثة بين أحمد ومستشار ستايل وهدوم. مهمتك بسيطة: لو أحمد قال تفضيل في اللبس أو الستايل، أو صحح المستشار في حاجة، اكتبها قاعدة قصيرة للمستشار. ما تكتبش أي حاجة عن الصحة أو الوزن أو الأدوية. لو مفيش، رجّع قايمة فاضية. رد بـJSON بس: {\"lessons\":[]}";
  const r = await runLoop(ctx, { model: MODELS.cheap, system: sys, messages: [{ role: "user", content: `الدروس الموجودة:\n${(les || []).map((l: any) => "- " + l.rule).join("\n") || "(مفيش)"}\n\nالمحادثة:\n${convo}\n\n{"lessons":[""]}` }], tools: [], maxTokens: 500 });
  const out = parseJsonLoose(r.text || "{}");
  const add = (Array.isArray(out.lessons) ? out.lessons : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 3);
  for (const rule of add) await ctx.db.from("lessons").insert({ owner_id: ctx.uid, rule: rule.slice(0, 300), source: "auto" });
  return { added: add };
}

// look at a photo of a new piece and fill its details (reads labels; never guesses a brand it can't see)
async function modeIdentify(ctx: Ctx, body: any) {
  const img = await imageBlock(ctx, String(body.image_path || ""));
  const hint = body.category ? `أحمد قال إنها: ${String(body.category)}.` : "";
  const sys = "إنت خبير موضة وعطور. بتتعرف على القطعة اللي في الصورة بدقة. اقرا المكتوب على التيكت أو الزجاجة حرف بحرف. أي حاجة مش باينة أو مش متأكد منها سيبها فاضية، ما تخمنش ماركة أو اسم. رد بـJSON بس.";
  const prompt = `${hint}
{"category":"top|bottom|outer|shoes|acc|perfume","name":"اسم قصير بالعربي أو اسم المنتج زي ما هو مكتوب","brand":"الماركة أو البيت لو مكتوبة بس","color":"اللون بالعربي","ptype":"أصلي|تركيبة|محلي أو فاضي","ml":0,"season":"كل المواسم|صيفي|شتوي","occasions":["شغل|سايت|خروج|رسمي|بيت|رياضة"],"notes":"وصف قصير للي باين (للعطر: نوع الريحة لو مكتوب)","read_text":"الكلام المكتوب في الصورة زي ما هو","confidence":"عالية|متوسطة|قليلة"}`;
  const r = await runLoop(ctx, { model: MODELS.smart, system: sys, messages: [{ role: "user", content: [img, { type: "text", text: prompt }] }], tools: [], maxTokens: 700 });
  const o = parseJsonLoose(r.text);
  const cats = ["top", "bottom", "outer", "shoes", "acc", "perfume"];
  return { item: { category: cats.includes(o.category) ? o.category : (body.category || "top"), name: String(o.name || "").slice(0, 80), brand: String(o.brand || "").slice(0, 60), color: String(o.color || "").slice(0, 40), ptype: String(o.ptype || ""), ml: Number(o.ml) || null, season: ["كل المواسم", "صيفي", "شتوي"].includes(o.season) ? o.season : "كل المواسم", occasions: (Array.isArray(o.occasions) ? o.occasions : []).map(String).filter((x: string) => ["شغل", "سايت", "خروج", "رسمي", "بيت", "رياضة"].includes(x)), notes: String(o.notes || "").slice(0, 200), read_text: String(o.read_text || "").slice(0, 200), confidence: String(o.confidence || "") } };
}

async function modePing(ctx: Ctx) {
  const r = await callClaude(ctx, { model: MODELS.cheap, max_tokens: 10, messages: [{ role: "user", content: "قول: تمام" }] });
  return { ok: true, text: (r.content || []).map((b: any) => b.text || "").join("") };
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const started = Date.now();
  let ctx: Ctx | null = null; let mode = "";
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u?.user) throw new AppError("auth", "سجّل دخول تاني.", 401);
    const uid = u.user.id;
    const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    mode = String(body.mode || "chat");
    const [{ data: sec }, { data: st }, { data: spent }] = await Promise.all([
      db.from("secrets").select("anthropic_key").eq("owner_id", uid).maybeSingle(),
      db.from("settings").select("monthly_cap_usd").eq("owner_id", uid).maybeSingle(),
      db.from("usage_log").select("cost_usd").eq("owner_id", uid).gte("created_at", monthStartCairoISO()),
    ]);
    if (!sec?.anthropic_key) throw new AppError("no_key", "لسه ماحطيتش مفتاح Anthropic. روح ملفي ← الإعدادات.");
    const monthSpent = (spent || []).reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);
    const c: Ctx = { req, uid, db, key: sec.anthropic_key, started, usage: { model: "", in: 0, out: 0, cr: 0, cw: 0, searches: 0, cost: 0 }, monthSpent, cap: Number(st?.monthly_cap_usd ?? 5), searched: false, searchErrors: [], sources: [], actions: [], after: [] };
    ctx = c;
    if (monthSpent >= c.cap) throw new AppError("cap", `وصلت لحد الصرف الشهري (${ctx.cap} دولار). تقدر تزوده من الإعدادات.`, 402);
    const handlers: Record<string, (c: Ctx, b: any) => Promise<unknown>> = { chat: modeChat, verdict: modeVerdict, report: modeReport, shop: modeShop, outfit: modeOutfit, assess: modeAssess, week: modeWeek, review: modeReview, learn: modeLearn, ping: modePing, identify: modeIdentify };
    const h = handlers[mode]; if (!h) throw new AppError("mode", "طلب مش معروف: " + mode);
    const logUsage = (ok: boolean, error?: string) => db.from("usage_log").insert({ owner_id: uid, kind: mode, model: c.usage.model, input_tokens: c.usage.in, output_tokens: c.usage.out, cache_read_tokens: c.usage.cr, searches: c.usage.searches, cost_usd: c.usage.cost, ok, error: error ? error.slice(0, 500) : null });
    if (body.stream) {
      // live steps as NDJSON; the work keeps going (and is saved) even if the phone closes the app
      const enc = new TextEncoder(); let closed = false; let ctrl!: ReadableStreamDefaultController;
      const stream = new ReadableStream({ start(cc) { ctrl = cc; }, cancel() { closed = true; } });
      const send = (o: unknown) => { if (closed) return; try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { closed = true; } };
      c.emit = (ev) => send({ type: "step", at: Date.now() - started, ...ev });
      c.live = (ev) => send(ev);
      const work = (async () => {
        try {
          const result: any = await h(c, body);
          await logUsage(true);
          send({ type: "done", ok: true, model: c.usage.model, cost_usd: c.usage.cost, month_spent_usd: monthSpent + c.usage.cost, cap_usd: c.cap, ...result });
          if (!closed) { try { ctrl.close(); } catch { /* closed */ } closed = true; }
          c.started = Date.now();
          for (const f of c.after) { try { await f(); } catch (e) { console.error("after", (e as Error).message); } }
        } catch (e) {
          const err = e instanceof AppError ? e : new AppError("server", "حصلت مشكلة: " + (e as Error).message, 500);
          if (c.usage.cost > 0) await logUsage(false, err.message);
          console.error(mode, err.code, err.message);
          send({ type: "error", ok: false, error: err.code, message: err.message, cost_usd: c.usage.cost });
        } finally { if (!closed) { try { ctrl.close(); } catch { /* closed */ } } }
      })();
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(work);
      return new Response(stream, { headers: { ...cors(req), "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
    }
    const result: any = await h(c, body);
    await logUsage(true);
    c.started = Date.now(); for (const f of c.after) { try { await f(); } catch (e) { console.error("after", (e as Error).message); } }
    return json(req, { ok: true, model: c.usage.model, cost_usd: c.usage.cost, month_spent_usd: monthSpent + c.usage.cost, cap_usd: c.cap, ...result });
  } catch (e) {
    const cx = ctx as Ctx | null;
    const err = e instanceof AppError ? e : new AppError("server", "حصلت مشكلة: " + (e as Error).message, 500);
    if (cx && cx.usage.cost > 0) await cx.db.from("usage_log").insert({ owner_id: cx.uid, kind: mode, model: cx.usage.model, input_tokens: cx.usage.in, output_tokens: cx.usage.out, searches: cx.usage.searches, cost_usd: cx.usage.cost, ok: false, error: err.message.slice(0, 500) });
    console.error(mode, err.code, err.message);
    return json(req, { ok: false, error: err.code, message: err.message, model: cx?.usage.model, cost_usd: cx?.usage.cost || 0 }, err.status);
  }
});
