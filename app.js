"use strict";
/* دولابي — standalone app. Data: Supabase (RLS). AI: Edge Function "advisor" (the key never reaches the browser). */
const CFG = window.DOLABY_CONFIG;
const sb = window.DOLABY_STUB || supabase.createClient(CFG.url, CFG.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
});

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = 864e5, LOC = "ar-EG-u-nu-latn", TZ = "Africa/Cairo";
const P = {
  shirt: "M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.6 1.5-2.1 2.5-4 2.5S8.6 4.5 8 3z",
  pants: "M6 3h12l1.2 18h-5L12 10l-2.2 11h-5z",
  jacket: "M8 3 4 6v15h7V8zM16 3l4 3v15h-7V8zM8 3l4 5 4-5",
  knit: "M9 3c.5 1.3 1.6 2 3 2s2.5-.7 3-2l5 3-1.5 5-2.5-1v11H8V10l-2.5 1L4 6zM8 18h8M10 18v3M14 18v3",
  shoe: "M3 17c0-3 1-7 3-9.5l3 3c2 1.2 5 1.3 8 2.2 2.2.6 4 2.1 4 4.3v1H3z",
  watch: "M9 3h6l1 4.2M9 3 8 7.2M8 16.8 9 21h6l1-4.2M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10zM12 10v2.2l1.5 1",
  bottle: "M10 2.5h4V6h-4zM8 8h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM7 13h10",
  hanger: "M12 6a2 2 0 1 1 2 2c-1 0-2 .6-2 1.6V10l9 6.5c.8.6.4 1.5-.5 1.5h-17c-.9 0-1.3-.9-.5-1.5L12 10",
  chart: "M4 20V10M10 20V4M16 20v-7M2 20h20",
  chat: "M4 5h16v11H9l-5 4z",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  back: "M9 6l6 6-6 6",
  cam: "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z",
  check: "M5 12.5l4.5 4.5L19 7",
  tape: "M3 7h18v10H3zM7 7v4M11 7v6M15 7v4M19 7v6",
  body: "M12 3a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 1 0 12 3zM7 9.5h10M12 9v6M9 21l3-6 3 6",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  cal: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  key: "M8 14a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 14z",
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
const CATS = { top: ["قميص / تيشيرت", "shirt"], knit: ["بلوفر / سويتر", "knit"], bottom: ["بنطلون", "pants"], outer: ["جاكيت / بدلة", "jacket"], shoes: ["جزمة", "shoe"], acc: ["إكسسوار / نضارة", "watch"], perfume: ["عطر", "bottle"] };
const SLOTS = [["flatFront", "مفرودة من الوش"], ["flatBack", "مفرودة من الضهر"], ["wornFront", "لابسها من الوش"], ["wornBack", "لابسها من الضهر"], ["tag", "التيكت"]];
const PSLOT = [["bottle", "صوّر الزجاجة"]];
const BODY = [["bodyFront", "من الوش"], ["bodySide", "من الجنب"], ["bodyBack", "من الضهر"]];
const REQ = [["chest", "الصدر", "حول أعرض حتة"], ["waist", "الوسط", "عند السُّرّة"], ["shoulder", "عرض الكتف", "من طرف للتاني من ورا"]];
const OPT = [["weightKg", "الوزن", "كجم"], ["hips", "الهانش", "سم"], ["neck", "الرقبة", "سم"], ["sleeve", "طول الدراع", "سم"], ["inseam", "طول الرجل من جوه", "سم"], ["shoe", "مقاس الجزمة", "أوروبي"]];
const ALLM = [...REQ.map(([k, l]) => [k, l, "سم"]), ...OPT];
const OCC = ["شغل", "سايت", "خروج", "رسمي", "بيت", "رياضة"];
const SEASONS = ["كل المواسم", "صيفي", "شتوي"];
const VERD = { keep: ["تفضل", "p-keep", "v-keep"], tailor: ["للخياط", "p-tailor", "v-tailor"], remove: ["تخرج", "p-remove", "v-remove"] };
const PST = { owned: ["عندي", "p-keep"], planned: ["هشتريه", "p-gold"], retired: ["بطّلته", "p-mute"] };
const YT = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const OCC_TODAY = ["شغل من البيت", "سايت", "خروج", "مناسبة رسمية", "مشوار"];

const S = {
  booted: false, session: null, recovery: false, loading: false, loaded: false, loadErr: null,
  authMode: "in", authD: {}, profile: null, meas: [], items: [], advisor: null, lessons: [], chat: [], settings: null,
  state: {}, usage: [], keyStatus: null, tab: "closet", shelf: "clothes", sheet: null, pending: {}, prev: {},
  busy: null, busyKey: null, ob: { step: 0, d: {} }, gate: { d: null },
  adv: { d: {}, early: false, steps: [], started: 0, ctl: null }, notes: [], reco: { seg: "today", d: { occasion: "شغل من البيت", weather: defaultWeather() }, shopAsk: "" },
  urls: new Map(), lastErr: {},
};
const uid = () => S.session?.user?.id;
const fmtD = (t) => t ? new Date(t).toLocaleDateString(LOC, { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "—";
const fmtDT = (t) => t ? new Date(t).toLocaleString(LOC, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }) : "—";
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(",", ".")); return isFinite(n) ? n : null; };
const item = (id) => S.items.find((x) => x.id === id);
const pill = ([t, c]) => `<span class="pill ${c}">${t}</span>`;
const cairoDay = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const plain = (t) => String(t || "").replace(/\*\*/g, "").replace(/\[\[يوتيوب:\s*([^\]]+)\]\]/g, "▶ $1").replace(/\s+/g, " ");
const usd = (n) => "$" + (Number(n) || 0).toFixed((Number(n) || 0) < 0.1 ? 4 : 2);
const modelName = (m) => !m ? "" : m.includes("sonnet") ? "Sonnet" : m.includes("haiku") ? "Haiku" : m.includes("opus") ? "Opus" : m;
function toast(t, ms = 3200) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms); }
function defaultWeather() { const m = new Date().getMonth(); return [11, 0, 1, 2].includes(m) ? "برد" : [5, 6, 7, 8].includes(m) ? "حر" : "معتدل"; }

/* ---------- data mapping ---------- */
function normProfile(r) { if (!r) return null; return { ...(r.data || {}), name: r.name, heightCm: r.height_cm, glasses: r.glasses === false ? "no" : "yes", bodyPhotos: r.body_photos || {}, onboarded: r.onboarded, _row: r }; }
function normItem(r) { return { ...(r.data || {}), id: r.id, category: r.category, name: r.name, photos: r.photos || {}, analysis: r.analysis, analysisStale: r.analysis_stale, lastWorn: r.last_worn ? Date.parse(r.last_worn) : null, createdAt: Date.parse(r.created_at) }; }
function normMeas(r) { return { id: r.id, date: Date.parse(r.taken_at), ...(r.data || {}) }; }
const ITEM_TOP = ["id", "category", "name", "photos", "analysis", "analysisStale", "lastWorn", "createdAt"];
function itemData(o) { const d = {}; for (const [k, v] of Object.entries(o)) if (!ITEM_TOP.includes(k) && v !== undefined) d[k] = v; return d; }

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
async function act(kind, detail = {}) { try { await sb.from("activity").insert({ actor: "me", kind, detail }); } catch {} }

/* ---------- boot + auth (no awaits inside onAuthStateChange) ---------- */
sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => onAuth(ev, session), 0); });
function onAuth(ev, session) {
  if (ev === "PASSWORD_RECOVERY") { S.recovery = true; S.session = session; render(true); return; }
  if (ev === "SIGNED_OUT") { Object.assign(S, { session: null, loaded: false, loading: false, profile: null, items: [], meas: [], chat: [] }); render(true); return; }
  S.session = session;
  if (session && !S.loaded && !S.loading && !S.recovery) loadAll(); else render();
}
async function boot() {
  if (/type=recovery/.test(location.hash)) S.recovery = true;
  try { const { data } = await sb.auth.getSession(); S.session = data.session; } catch {}
  S.booted = true;
  if (S.session && !S.recovery) loadAll(); else render(true);
}

async function loadAll() {
  if (S.loading) return; S.loading = true; S.loadErr = null; render(true);
  try {
    let prof = await q(sb.from("profiles").select("*").maybeSingle());
    if (!prof) { // first sign-in: bring the old artifact's data over (runs once, server side)
      const { data: mig, error } = await sb.rpc("claim_legacy");
      if (error) console.warn("claim_legacy", error);
      prof = await q(sb.from("profiles").select("*").maybeSingle());
      if (mig?.items) toast(`نقلت بياناتك من دولابي القديم: ${mig.items} قطعة و${mig.measurements} قياس`);
    }
    const [meas, items, adv, les, chat, st, state, usage, ks, notes] = await Promise.all([
      q(sb.from("measurements").select("*").order("taken_at", { ascending: false }).limit(36)),
      q(sb.from("items").select("*").order("created_at", { ascending: false })),
      q(sb.from("advisor").select("*").maybeSingle()),
      q(sb.from("lessons").select("*").order("id", { ascending: false })),
      q(sb.from("chat_messages").select("*").order("id", { ascending: false }).limit(80)),
      q(sb.from("settings").select("*").maybeSingle()),
      q(sb.from("app_state").select("key,value,updated_at")),
      q(sb.from("usage_log").select("*").gte("created_at", monthStartISO()).order("id", { ascending: false }).limit(300)),
      sb.rpc("anthropic_key_status"),
      q(sb.from("style_notes").select("*").order("id", { ascending: false }).limit(30)),
    ]);
    S.profile = normProfile(prof); S.meas = meas.map(normMeas); S.items = items.map(normItem);
    S.advisor = adv || { about: {}, goals: [], history: [] }; S.lessons = les; S.chat = chat.reverse();
    S.settings = st || { monthly_cap_usd: 5 }; S.state = Object.fromEntries(state.map((r) => [r.key, r.value]));
    S.usage = usage; S.keyStatus = ks.data || { set: false }; S.notes = notes;
    S.loaded = true;
    sb.from("profiles").update({ last_open_at: new Date().toISOString() }).eq("owner_id", uid()).then(() => {}, () => {});
    if (S.state.migration?.photos === "pending") importPhotos();
  } catch (e) { console.warn(e); S.loadErr = e?.message || String(e); }
  finally { S.loading = false; render(true); }
}
function monthStartISO() { const [y, m] = cairoDay().split("-"); return new Date(`${y}-${m}-01T00:00:00+02:00`).toISOString(); }
async function reloadPart(part) {
  try {
    if (part === "items") S.items = (await q(sb.from("items").select("*").order("created_at", { ascending: false }))).map(normItem);
    if (part === "advisor") S.advisor = (await q(sb.from("advisor").select("*").maybeSingle())) || S.advisor;
    if (part === "lessons") S.lessons = await q(sb.from("lessons").select("*").order("id", { ascending: false }));
    if (part === "profile") S.profile = normProfile(await q(sb.from("profiles").select("*").maybeSingle()));
    if (part === "meas") S.meas = (await q(sb.from("measurements").select("*").order("taken_at", { ascending: false }).limit(36))).map(normMeas);
    if (part === "usage") S.usage = await q(sb.from("usage_log").select("*").gte("created_at", monthStartISO()).order("id", { ascending: false }).limit(300));
    if (part === "notes") S.notes = await q(sb.from("style_notes").select("*").order("id", { ascending: false }).limit(30));
    if (part === "settings") S.settings = (await q(sb.from("settings").select("*").maybeSingle())) || S.settings;
    if (part === "state") S.state = Object.fromEntries((await q(sb.from("app_state").select("key,value"))).map((r) => [r.key, r.value]));
  } catch (e) { console.warn(part, e); }
}
async function importPhotos() {
  try {
    const { data, error } = await sb.functions.invoke("import-photos", { body: {} });
    if (error) throw error;
    if (data?.ok) { S.state.migration = { ...(S.state.migration || {}), photos: "done" }; S.urls.clear(); toast(`الصور اتنقلت: ${data.uploaded} من ${data.expected}`); render(true); }
  } catch (e) { console.warn("import-photos", e); }
}

/* ---------- photos: private bucket + signed URLs ---------- */
function img(path, alt = "", extra = "") { if (!path) return ""; const u = S.urls.get(path); return `<img ${u ? `src="${esc(u)}"` : ""} data-p="${esc(path)}" alt="${esc(alt)}" ${extra}>`; }
let hydrating = false;
async function hydrateImgs() {
  if (hydrating) return; const els = [...document.querySelectorAll("img[data-p]:not([src])")]; if (!els.length) return;
  const paths = [...new Set(els.map((e) => e.dataset.p))].filter((p) => !S.urls.has(p)); hydrating = true;
  try {
    if (paths.length) { const { data } = await sb.storage.from("photos").createSignedUrls(paths, 3600); for (const r of data || []) if (r.signedUrl) S.urls.set(r.path, r.signedUrl); }
    for (const e of document.querySelectorAll("img[data-p]:not([src])")) { const u = S.urls.get(e.dataset.p); if (u) e.src = u; }
  } catch (e) { console.warn(e); } finally { hydrating = false; }
}
function loadImg(f) { return new Promise((res, rej) => { const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => res({ im, u }); im.onerror = () => { URL.revokeObjectURL(u); rej(); }; im.src = u; }); }
async function shrink(f, max = 1280) { // downscale before upload: this is also what the AI sees (cheaper)
  const { im, u } = await loadImg(f); const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
  return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.84));
}
async function upload(blob, folder) {
  const path = `${uid()}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error; S.urls.set(path, URL.createObjectURL(blob)); return path;
}

/* ---------- AI (Edge Function) ---------- */
async function ai(mode, payload = {}) {
  const { data, error } = await sb.functions.invoke("advisor", { body: { mode, ...payload } });
  if (error) {
    let j = null; try { j = await error.context?.json(); } catch {}
    const e = new Error(j?.message || error.message || "حصلت مشكلة"); e.code = j?.error; e.cost = j?.cost_usd; throw e;
  }
  if (!data?.ok) { const e = new Error(data?.message || "حصلت مشكلة"); e.code = data?.error; throw e; }
  reloadPart("usage");
  return data;
}
async function aiJob(key, mode, payload, after) {
  if (S.busyKey) return; S.busyKey = key; S.lastErr[key] = null; render(); if (S.sheet) renderSheet();
  try { const r = await ai(mode, payload); await after?.(r); toast(`${modelName(r.model)} · ${usd(r.cost_usd)}`); }
  catch (e) { S.lastErr[key] = e.message; if (e.code === "no_key") toast("حط مفتاح Anthropic من ملفي ← الإعدادات"); }
  finally { S.busyKey = null; render(); if (S.sheet) renderSheet(); }
}
const errBox = (k) => S.lastErr[k] ? `<div class="err">${esc(S.lastErr[k])}</div>` : "";
const busyBox = (t) => `<div class="box" style="align-items:center;text-align:center;padding:24px"><span class="spin" style="width:28px;height:28px"></span><strong>${t}</strong><p class="sub sm">ده بياخد من نص دقيقة لدقيقتين.</p></div>`;

/* ---------- render ---------- */
function mode() {
  if (!S.booted) return "loading";
  if (S.recovery) return "recovery";
  if (!S.session) return "auth";
  if (S.loadErr) return "error";
  if (!S.loaded) { if (!S.loading) setTimeout(loadAll, 0); return "loading"; } // signed in but no data: load it
  if (!S.profile?.onboarded || !S.meas.length) return "onboard";
  if (Date.now() - (S.meas[0].date || 0) > 30 * DAY) return "gate"; // asked once, however many months were missed
  return "tab";
}
let lastMode = "";
function render(force) {
  const m = mode();
  if (!force && m === lastMode && ["onboard", "gate", "auth", "recovery"].includes(m)) return;
  lastMode = m;
  $("#main").innerHTML = m === "loading" ? `<p class="sub" style="padding-top:30vh;text-align:center"><span class="spin"></span> بنجهّز دولابك…</p>`
    : m === "auth" ? vAuth() : m === "recovery" ? vRecovery() : m === "error" ? vError()
    : m === "onboard" ? vOnboard() : m === "gate" ? vGate()
    : ({ closet: vCloset, reco: vReco, advisor: vAdvisor, profile: vProfile })[S.tab]();
  document.body.dataset.screen = m === "tab" ? S.tab : m;
  const nav = $("#nav"); nav.hidden = m !== "tab";
  if (m === "tab") nav.innerHTML = [["closet", "الدولاب", "hanger"], ["reco", "الترشيحات", "chart"], ["add", "", "plus"], ["advisor", "المستشار", "chat"], ["profile", "ملفي", "user"]].map(([k, l, i]) => k === "add" ? `<button class="plus" data-a="add" aria-label="ضيف قطعة">${ic(i)}</button>` : `<button data-tab="${k}" aria-current="${S.tab === k}">${ic(i)}${l}</button>`).join("");
  hydrateImgs();
}
const vError = () => `<div class="auth"><div class="err">مش قادر أحمّل بياناتك: ${esc(S.loadErr)}</div><button class="btn main wide" data-a="retryLoad">جرّب تاني</button><button class="btn text" data-a="signOut">اخرج</button></div>`;

/* ---------- auth screens ---------- */
const EMAIL = (scope, d) => `<label class="field"><span>الإيميل</span><input type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" data-scope="${scope}" data-b="email" value="${esc(d.email || "")}"></label>`;
const PASS = (scope, d, k = "password", label = "الباسورد", ac = "current-password") => `<label class="field"><span>${label}</span><input type="password" autocomplete="${ac}" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" data-scope="${scope}" data-b="${k}" value="${esc(d[k] || "")}"></label>`;
function vAuth() {
  const d = S.authD, m = S.authMode;
  const head = `<div class="logo">${ic("hanger")}</div><h1 style="text-align:center">دولابي</h1>`;
  if (m === "forgot") return `<div class="auth">${head}<p class="lead" style="text-align:center">اكتب إيميلك وهبعتلك لينك تعمل بيه باسورد جديد.</p>${EMAIL("auth", d)}<button class="btn main wide" data-a="authForgot" id="authBtn">ابعت اللينك</button><button class="btn text" data-a="authMode" data-m="in">رجوع لتسجيل الدخول</button>${d.msg ? `<div class="tip">${esc(d.msg)}</div>` : ""}</div>`;
  return `<div class="auth">${head}
    ${EMAIL("auth", d)}${PASS("auth", d, "password", "الباسورد", m === "up" ? "new-password" : "current-password")}
    <button class="btn main wide" data-a="${m === "up" ? "authUp" : "authIn"}" id="authBtn">${m === "up" ? "اعمل الحساب" : "ادخل"}</button>
    ${m === "in" ? `<button class="btn text" data-a="authMode" data-m="forgot">نسيت الباسورد؟</button><button class="btn text" data-a="authMode" data-m="up">أول مرة؟ اعمل الحساب</button>` : `<p class="sub xs" style="text-align:center">الأبلكيشن شخصي: حساب واحد بس يقدر يتعمل.</p><button class="btn text" data-a="authMode" data-m="in">عندي حساب</button>`}
    ${d.msg ? `<div class="tip">${esc(d.msg)}</div>` : ""}</div>`;
}
function vRecovery() { const d = S.authD; return `<div class="auth"><div class="logo">${ic("key")}</div><h1 style="text-align:center">باسورد جديد</h1>${PASS("auth", d, "newPass", "الباسورد الجديد", "new-password")}<button class="btn main wide" data-a="authNewPass" id="authBtn">احفظ وادخل</button>${d.msg ? `<div class="tip">${esc(d.msg)}</div>` : ""}</div>`; }
const authErr = (e) => { const m = String(e?.message || e); if (/Invalid login/i.test(m)) return "الإيميل أو الباسورد غلط."; if (/not confirmed/i.test(m)) return "لسه ماأكدتش الإيميل. افتح الإيميل اللي جالك ودوس اللينك."; if (/sign-ups are closed|Database error saving new user/i.test(m)) return "الأبلكيشن شخصي، وفيه حساب متعمل خلاص."; if (/rate limit/i.test(m)) return "طلبات كتير. استنى شوية وجرّب."; if (/Password should be/i.test(m)) return "الباسورد لازم 8 حروف على الأقل."; return m; };
async function authRun(fn) { const b = $("#authBtn"); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>'; } S.authD.msg = ""; try { await fn(); } catch (e) { S.authD.msg = authErr(e); } render(true); }

/* ---------- field helpers ---------- */
const val = (d, k) => esc(d?.[k] ?? "");
function F(scope, d, k, label, o = {}) {
  const t = o.area ? `<textarea data-scope="${scope}" data-b="${k}" id="${scope}_${k}" placeholder="${esc(o.ph || "")}">${val(d, k)}</textarea>`
    : `<input type="${o.num ? "text" : "text"}" ${o.num ? 'inputmode="decimal"' : ""} ${o.off ? 'autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr"' : ""} data-scope="${scope}" data-b="${k}" id="${scope}_${k}" value="${val(d, k)}" placeholder="${esc(o.ph || "")}">`;
  return `<label class="field"><span>${label}</span>${o.unit ? `<div class="unitbox">${t}<em>${o.unit}</em></div>` : t}${o.hint ? `<small>${o.hint}</small>` : ""}</label>`;
}
function Seg(scope, d, k, opts) { return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-scope="${scope}" data-seg="${k}" data-v="${v}" aria-pressed="${String(d?.[k]) === String(v)}">${l}</button>`).join("")}</div>`; }
function Multi(scope, d, k, opts) { const cur = d?.[k] || []; return `<div class="choices">${opts.map((o) => `<button type="button" class="choice" data-scope="${scope}" data-multi="${k}" data-v="${o}" aria-pressed="${cur.includes(o)}">${o}</button>`).join("")}</div>`; }
function One(scope, d, k, opts) { return `<div class="choices">${opts.map((o) => `<button type="button" class="choice" data-scope="${scope}" data-one="${k}" data-v="${o}" aria-pressed="${d?.[k] === o}">${o}</button>`).join("")}</div>`; }
function Shots(slots, prefix, existing = {}) {
  return `<div class="shots">${slots.map(([k, l]) => { const key = prefix + k; const pv = S.prev[key]; const ex = existing[k];
    const has = pv || ex; const im = pv ? `<img src="${pv}" alt="">` : ex ? img(ex) : "";
    return `<label class="shot ${has ? "done" : ""}">${has ? `${im}<span class="ok">${ic("check")}</span><span class="lbl">${l}</span>` : `${ic("cam")}<span>${l}</span>`}<input type="file" accept="image/*" data-slot="${key}" aria-label="${l}"></label>`; }).join("")}</div>`;
}
function scopeDraft(s) { return s === "ob" ? S.ob.d : s === "gate" ? S.gate.d : s === "reco" ? S.reco.d : s === "adv" ? S.adv.d : s === "auth" ? S.authD : S.sheet?.d; }
function measBlock(scope, d) {
  return `<div class="col">${REQ.map(([k, l, h]) => F(scope, d, "m_" + k, l, { num: 1, unit: "سم", hint: h })).join("")}
  <details class="more"><summary>مقاسات إضافية (اختياري)</summary><div><div class="pair">${OPT.map(([k, l, u]) => F(scope, d, "m_" + k, l, { num: 1, unit: u })).join("")}</div></div></details>
  <a class="sm" href="${YT("ازاي تقيس مقاسات جسمك للهدوم رجالي")}" target="_blank" rel="noopener">▶ مش عارف تقيس؟ شوف فيديوهات بتشرح</a></div>`;
}
function measFromDraft(d) { const o = {}; for (const [k] of ALLM) { const v = num(d["m_" + k]); if (v != null) o[k] = v; } return o; }
function measToDraft(m = {}) { const d = {}; for (const [k] of ALLM) if (m[k] != null && m[k] !== 0) d["m_" + k] = m[k]; return d; }
const tapeBar = (frac, label) => `<div class="tape" role="progressbar" aria-valuenow="${Math.round(frac * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(4, Math.min(1, frac) * 100)}%"></i><b>${label || ""}</b></div>`;

/* ---------- onboarding (only for a brand-new account) ---------- */
const OB_STEPS = 5;
function vOnboard() {
  const st = S.ob.step, d = S.ob.d; let body = "", next = "التالي", skip = false;
  if (st === 0) { body = `<div class="hero-empty" style="background:transparent;padding:30px 0 0">${ic("hanger")}<h1>أهلاً بيك في دولابي</h1><p class="lead">هنعمل ملفك في 4 خطوات قصيرة. هتحتاج شريط قياس وموبايلك.</p></div>`; next = "يلا نبدأ"; }
  if (st === 1) body = `<h1>عرّفنا بيك</h1>${F("ob", d, "name", "اسمك")}${F("ob", d, "heightCm", "طولك", { num: 1, unit: "سم" })}<div class="field"><span>بتلبس نضارة؟</span>${Seg("ob", d, "glasses", [["yes", "أيوه"], ["no", "لأ"]])}</div>`;
  if (st === 2) body = `<h1>مقاساتك</h1><p class="lead">التلاتة دول بس اللي لازمين.</p>${measBlock("ob", d)}`;
  if (st === 3) { body = `<h1>صور جسمك</h1><p class="lead">المستشار هيستخدمها في التقييم. خاصة بيك بس.</p>${Shots(BODY, "b_", S.profile?.bodyPhotos || {})}<div class="tip">حط الموبايل على ارتفاع وسطك واستخدم التايمر. هدوم فيتد، وحيطة سادة، وإضاءة نهار.</div>`; skip = true; }
  if (st === 4) { body = `<h1>خلاص كده</h1><p class="lead">ستايلك وشغلك ومناسباتك هيتعرفوا مع الوقت من كلامك مع المستشار.</p>`; next = "خلّصت"; }
  return `<div class="wiz">${st > 0 ? `<div class="row between"><button class="iconbtn" data-a="obBack" aria-label="رجوع">${ic("back")}</button><span class="sub sm">خطوة ${st} من ${OB_STEPS - 1}</span></div>${tapeBar(st / (OB_STEPS - 1))}` : ""}
    <div class="wiz-body">${body}</div>
    <div class="wiz-foot"><button class="btn main wide" data-a="obNext" id="obNext">${next}</button>${skip ? `<button class="btn text" data-a="obSkip">تخطّى دلوقتي</button>` : ""}</div></div>`;
}
async function obNext() {
  const st = S.ob.step, d = S.ob.d;
  if (st === 1 && (!String(d.name || "").trim() || !num(d.heightCm))) { toast("اكتب اسمك وطولك"); return; }
  if (st === 2 && REQ.some(([k]) => num(d["m_" + k]) == null)) { toast("الصدر والوسط وعرض الكتف لازمين"); return; }
  if (st < OB_STEPS - 1) { S.ob.step++; render(true); scrollTo(0, 0); return; }
  const btn = $("#obNext"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> بنحفظ…';
  try {
    const bp = { ...(S.profile?.bodyPhotos || {}) };
    for (const [k] of BODY) { const b = S.pending["b_" + k]; if (b) { bp[k] = await upload(b, "body"); delete S.pending["b_" + k]; } }
    await q(sb.from("profiles").upsert({ owner_id: uid(), name: String(d.name).trim(), height_cm: num(d.heightCm), glasses: d.glasses !== "no", body_photos: bp, onboarded: true, data: S.profile?._row?.data || {}, updated_at: new Date().toISOString() }));
    await q(sb.from("measurements").insert({ data: { heightCm: num(d.heightCm), ...measFromDraft(d) } }));
    await Promise.all([reloadPart("profile"), reloadPart("meas")]); act("onboarded"); toast("ملفك جاهز"); render(true);
  } catch (e) { console.warn(e); toast("ماتحفظش: " + (e.message || "")); btn.disabled = false; btn.textContent = "خلّصت"; }
}

/* ---------- monthly measurement gate ---------- */
function vGate() {
  if (!S.gate.d) S.gate.d = measToDraft(S.meas[0]);
  const months = Math.floor((Date.now() - S.meas[0].date) / (30 * DAY));
  return `<div class="wiz"><div class="wiz-body"><div class="col">${ic("tape")}<h1>وقت القياس الشهري</h1><p class="lead">آخر قياس كان ${fmtD(S.meas[0].date)}${months > 1 ? ` (من حوالي ${months} شهور)` : ""}. قيس مرة واحدة دلوقتي. لو مفيش تغيير، احفظ زي ما هي.</p></div>${measBlock("gate", S.gate.d)}</div>
  <div class="wiz-foot"><button class="btn main wide" data-a="gateSave" id="gateSave">احفظ المقاسات</button></div></div>`;
}
async function saveMeasFrom(d, btn) {
  if (REQ.some(([k]) => num(d["m_" + k]) == null)) { toast("الصدر والوسط وعرض الكتف لازمين"); return false; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  try { const m = measFromDraft(d); await q(sb.from("measurements").insert({ data: { heightCm: S.profile?.heightCm ?? null, ...m } })); await reloadPart("meas"); act("measurement", m); return true; }
  catch (e) { toast("ماتحفظش: " + e.message); return false; }
  finally { if (btn) { btn.disabled = false; btn.textContent = "احفظ المقاسات"; } }
}

/* ---------- closet ---------- */
function vCloset() {
  const p = S.profile || {}; const clothes = S.items.filter((i) => i.category !== "perfume"), perf = S.items.filter((i) => i.category === "perfume");
  const c = (v) => clothes.filter((i) => i.analysis?.verdict === v).length; const pending = clothes.filter((i) => !i.analysis?.verdict).length;
  const h = +new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: TZ }); const greet = h < 12 ? "صباح الخير" : "مساء الخير";
  const list = S.shelf === "clothes" ? clothes : [...perf].sort((a, b) => ["owned", "planned", "retired"].indexOf(a.pstatus) - ["owned", "planned", "retired"].indexOf(b.pstatus));
  return `<div class="col lg">
   <div class="hello"><div><h1>${greet}${p.name ? " يا " + esc(p.name.split(" ")[0]) : ""}</h1><p class="sub">${new Date().toLocaleDateString(LOC, { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}</p></div></div>
   ${clothes.length ? `<div class="stats"><div class="stat s-keep"><b>${c("keep")}</b><span>تفضل</span></div><div class="stat s-tailor"><b>${c("tailor")}</b><span>للخياط</span></div><div class="stat s-remove"><b>${c("remove")}</b><span>تخرج</span></div></div>${pending ? `<p class="sub sm">${pending} ${pending === 1 ? "قطعة لسه ماتحكمش عليها" : "قطع لسه ماتحكمش عليها"}</p>` : ""}` : ""}
   <div class="seg" role="group"><button data-shelf="clothes" aria-pressed="${S.shelf === "clothes"}">هدوم (${clothes.length})</button><button data-shelf="perfume" aria-pressed="${S.shelf === "perfume"}">عطور (${perf.length})</button></div>
   ${list.length ? (S.shelf === "perfume" ? `<div class="plist">${list.map(prow).join("")}</div>` : `<div class="grid">${list.map(card).join("")}</div>`) : S.shelf === "clothes" ? `<div class="hero-empty">${ic("hanger")}<h2>ضيف أول قطعة</h2><p class="sub">ابدأ بـ5 قطع بتلبسها كتير. كل قطعة هتاخد منك دقيقتين تصوير.</p><button class="btn main" data-a="add">ضيف قطعة</button></div>` : `<div class="hero-empty">${ic("bottle")}<h2>مفيش عطور لسه</h2><button class="btn main" data-a="addPerf">ضيف عطر</button></div>`}
  </div>`;
}
function card(i) {
  const ph = photoOf(i);
  const tag = i.analysis?.verdict ? pill(VERD[i.analysis.verdict] || ["محلّلة", "p-none"]) : pill(["لسه", "p-none"]);
  return `<button class="piece" data-open="${esc(i.id)}"><div class="ph">${ph ? img(ph, "", 'loading="lazy"') : ic((CATS[i.category] || CATS.top)[1])}<span class="tag">${tag}</span></div><div class="nm"><strong>${esc(i.name || "بدون اسم")}</strong><span>${esc((CATS[i.category] || [""])[0]) + (i.color ? " · " + esc(i.color) : "")}</span></div></button>`;
}
function mono(i, big) { const s = i.season === "صيفي" ? "m-sum" : i.season === "شتوي" ? "m-win" : "m-all"; const t = String(i.name || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(""); return `<span class="mono ${s} ${big ? "big" : ""}">${esc(t)}</span>`; }
function prow(i) { const ph = i.photos?.bottle; return `<button class="prow" data-open="${esc(i.id)}"><span class="pthumb">${ph ? img(ph, "", 'loading="lazy"') : mono(i)}</span><span class="pinfo"><strong>${esc(i.name || "بدون اسم")}</strong><small>${esc([i.role === "daily" ? "يومي" : "", i.house, i.ml ? i.ml + " مل" : "", i.season].filter(Boolean).join(" · "))}</small>${i.pstatus === "planned" && i.when ? `<small>${esc(i.when)}</small>` : ""}</span>${pill(PST[i.pstatus] || PST.owned)}</button>`; }
function thumbOf(i) { const ph = photoOf(i); return `<span class="pthumb">${ph ? img(ph) : i.category === "perfume" ? mono(i) : `<span class="mono m-all">${ic((CATS[i.category] || CATS.top)[1])}</span>`}</span>`; }

/* ---------- recommendations (no wallet, no budget) ---------- */
function vReco() {
  const seg = S.reco.seg;
  return `<div class="col lg"><h1>الترشيحات</h1>
  <div class="seg" role="group">${[["today", "النهارده"], ["closet", "دولابي"], ["shop", "أشتري إيه"]].map(([k, l]) => `<button data-rseg="${k}" aria-pressed="${seg === k}">${l}</button>`).join("")}</div>
  ${seg === "today" ? rToday() : seg === "closet" ? rCloset() : rShop()}</div>`;
}
function rToday() {
  const d = S.reco.d, t = S.state.today?.day === cairoDay() ? S.state.today : null;
  const form = `<div class="box"><div class="field"><span>رايح فين النهارده؟</span>${One("reco", d, "occasion", OCC_TODAY)}</div>
    <div class="field"><span>الجو</span>${Seg("reco", d, "weather", [["حر", "حر"], ["معتدل", "معتدل"], ["برد", "برد"]])}</div>
    ${F("reco", d, "note", "عايز حاجة معينة؟", { ph: "اختياري" })}
    <button class="btn main wide" data-a="outfit">${ic("spark")}${t ? "رشّحلي تاني" : "رشّحلي"}</button>${errBox("outfit")}</div>`;
  if (S.busyKey === "outfit") return busyBox("بيختارلك");
  if (!t) return form;
  const pieces = (t.pieces || []).map((p) => ({ p, i: item(p.id) })).filter((x) => x.i); const pf = t.perfume?.id ? item(t.perfume.id) : null;
  return `<div class="box"><div class="row between"><h3>طقم النهارده</h3><span class="pill p-mute">${esc(t.occasion || "")} · ${esc(t.weather || "")}</span></div>
    ${pieces.map(({ p, i }) => `<button class="prow" data-open="${esc(i.id)}" style="padding-inline:0">${thumbOf(i)}<span class="pinfo"><strong>${esc(i.name)}</strong><small>${esc(p.why)}</small></span></button>`).join("")}
    ${pf ? `<button class="prow" data-open="${esc(pf.id)}" style="padding-inline:0">${thumbOf(pf)}<span class="pinfo"><strong>${esc(pf.name)}</strong><small>${esc(t.perfume.why)}</small></span></button>` : ""}
    ${t.tip ? `<div class="tip">${esc(t.tip)}</div>` : ""}${t.missing ? `<p class="sub sm"><b>ناقصك:</b> ${esc(t.missing)}</p>` : ""}
    <div class="pair"><button class="btn ${t.worn ? "" : "main"}" data-a="wearIt" ${t.worn ? "disabled" : ""}>${t.worn ? "اتسجل" : "هلبسه"}</button><button class="btn" data-a="outfit">رشّح غيره</button></div>
    ${t.fb ? `<p class="sub xs">قولت إنه ${t.fb === "up" ? "عجبك" : "ماعجبكش"}. المستشار هيتعلم منه.</p>` : `<div class="col" style="gap:8px">${F("reco", d, "fbReason", "رأيك؟", { ph: "ليه عجبك أو ماعجبكش" })}<div class="pair"><button class="btn" data-a="fbUp">${ic("heart")}عجبني</button><button class="btn" data-a="fbDown">مش عاجبني</button></div></div>`}
  </div>${form}`;
}
async function saveState(key, value) { S.state[key] = value; await q(sb.from("app_state").upsert({ owner_id: uid(), key, value, updated_at: new Date().toISOString() })); }
async function wearIt() {
  const t = S.state.today; if (!t) return;
  try { const now = new Date().toISOString(); for (const id of [...(t.pieces || []).map((p) => p.id), t.perfume?.id].filter(Boolean)) await q(sb.from("items").update({ last_worn: now }).eq("id", id)); await saveState("today", { ...t, worn: true }); await reloadPart("items"); act("wore_outfit", { pieces: (t.pieces || []).map((p) => p.id), perfume: t.perfume?.id }); toast("اتسجل. يومك حلو!"); render(); }
  catch (e) { toast("ماتسجلش: " + e.message); }
}
async function feedback(up) {
  const t = S.state.today; if (!t) return; const why = String(S.reco.d.fbReason || "").trim();
  const names = (t.pieces || []).map((p) => item(p.id)?.name).concat(t.perfume ? [item(t.perfume.id)?.name] : []).filter(Boolean).join(" + ");
  try {
    await saveState("today", { ...t, fb: up ? "up" : "down" });
    if (why) { await q(sb.from("lessons").insert({ rule: `${up ? "عجبه" : "ماعجبوش"} طقم (${names}) في ${t.occasion || "مشوار"}: ${why}`, source: "outfit" })); reloadPart("lessons"); }
    act("outfit_feedback", { up, why }); S.reco.d.fbReason = ""; toast(why ? "اتسجل كدرس للمستشار" : "اتسجل"); render();
  } catch (e) { toast("ماتسجلش: " + e.message); }
}
function rCloset() {
  const clothes = S.items.filter((i) => i.category !== "perfume"); const analyzed = clothes.filter((i) => i.analysis?.verdict);
  const tailor = analyzed.filter((i) => i.analysis.verdict === "tailor"), remove = analyzed.filter((i) => i.analysis.verdict === "remove"); const rep = S.state.closet_report;
  return `${S.busyKey === "report" ? busyBox("بيحلل دولابك كله") : `<div class="box"><h3>نقط القوة والناقص</h3><p class="sm">إيه اللي قوي في دولابك، وإيه الناقص بالأولوية، وإيه المكرر.</p>
    ${S.items.length < 3 ? `<p class="sub sm">محتاج 3 قطع على الأقل.</p>` : `<button class="btn main wide" data-a="report">${ic("spark")}${rep ? "حلّل تاني" : "حلّل دولابي"}</button>`}${errBox("report")}${clothes.length === 0 ? `<p class="sub xs">لسه مفيش هدوم في الدولاب، فالتحليل هيبقى على العطور بس. ضيف هدومك من زرار +.</p>` : ""}</div>`}
  ${rep ? `<div class="box"><div class="row between"><h3>النتيجة</h3><span class="sub xs">${fmtD(rep.at)}</span></div><p class="sm">${esc(rep.summary)}</p>
    ${(rep.strengths || []).length ? `<strong class="sm">نقط القوة</strong><ul class="sm">${rep.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
    ${(rep.gaps || []).length ? `<div class="box"><h3>الناقص بالأولوية</h3>${[...rep.gaps].sort((a, b) => (a.priority || 3) - (b.priority || 3)).map((g) => `<div class="fix"><div class="row between"><strong>${esc(g.item)}</strong>${pill(g.priority == 1 ? ["ضروري", "p-remove"] : g.priority == 2 ? ["مهم", "p-tailor"] : ["لو ينفع", "p-mute"])}</div><span class="sub sm">${esc(g.why)}${g.newOutfits ? ` · حوالي ${esc(g.newOutfits)} طقم جديد` : ""}</span></div>`).join("")}</div>` : ""}
    ${(rep.duplicates || []).length ? `<div class="box"><h3>مكرر</h3><ul class="sm">${rep.duplicates.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${rep.colors ? `<div class="box"><h3>الألوان</h3><p class="sm">${esc(rep.colors)}</p></div>` : ""}` : ""}
  ${tailor.length ? `<div class="box"><h3>رايحين للخياط (${tailor.length})</h3>${tailor.map((i) => `<div class="fix"><button class="btn text" style="justify-content:flex-start;padding:0;min-height:0;color:var(--ink);font-weight:600" data-open="${esc(i.id)}">${esc(i.name)}</button>${(i.analysis.tailoring || []).map((f) => `<span class="sub sm">• ${esc(f.what)}${f.reversible ? "" : " (مايرجعش)"}</span>`).join("")}</div>`).join("")}</div>` : ""}
  ${remove.length ? `<div class="box"><h3>تخرج من الدولاب (${remove.length})</h3><div class="choices">${remove.map((i) => `<button class="choice" data-open="${esc(i.id)}">${esc(i.name)}</button>`).join("")}</div></div>` : ""}`;
}
function rShop() {
  const sh = S.state.shop, mk = S.state.market;
  return `${S.busyKey === "shop" ? busyBox("بيدوّر على أسعار حقيقية") : `<div class="box"><h3>أشتري إيه بعد كده؟</h3><p class="sm">بيبص على الناقص في دولابك ويدوّر على النت على أماكن وأسعار حقيقية في إسكندرية ومصر.</p>
    <label class="field"><span>عايز حاجة معينة؟</span><input type="text" data-scope="shop" data-b="ask" value="${esc(S.reco.shopAsk)}" placeholder="اختياري. مثلاً: جزمة جلد بني للشغل"></label>
    <button class="btn main wide" data-a="shop">${ic("spark")}${sh ? "دوّر تاني" : "رشّحلي"}</button>${errBox("shop")}</div>`}
  ${sh ? `<div class="box"><div class="row between"><h3>الترشيحات</h3><span class="sub xs">${fmtDT(sh.at)}</span></div>
    ${(sh.searchErrors || []).length ? `<div class="err">البحث فشل: ${esc(sh.searchErrors.join("، "))}</div>` : ""}
    ${!sh.searched ? `<div class="tip">ماحصلش بحث المرة دي، فكل اللي تحت اقتراحات من غير أسعار.</div>` : ""}
    ${(sh.picks || []).map((p) => `<div class="fix"><div class="row between"><strong>${esc(p.item)}</strong>${p.fromSearch ? pill(["من بحث", "p-keep"]) : pill(["اقتراح", "p-mute"])}</div><span class="sub sm">${esc(p.why)}</span>${p.store || p.price ? `<span class="sm">${esc([p.store, p.price].filter(Boolean).join(" · "))}</span>` : ""}${p.link ? `<a class="sm" href="${esc(p.link)}" target="_blank" rel="noopener">افتح اللينك</a>` : ""}</div>`).join("")}
    ${sh.note ? `<p class="sub sm">${esc(sh.note)}</p>` : ""}
    ${(sh.sources || []).length ? `<details class="more"><summary>المصادر (${sh.sources.length})</summary><div class="srcs">${sh.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</div></details>` : ""}
    <p class="sub xs">الأسعار بتتغير. اتأكد من السعر قبل ما تشتري.</p></div>` : ""}
  ${mk?.stores ? `<div class="col"><h3>أماكن الشرا</h3><div class="list">${mk.stores.map((s) => `<div class="li" style="cursor:default;align-items:flex-start"><div><div class="row between"><strong>${esc(s.name)}</strong>${pill([s.tier, "p-mute"])}</div><small>${esc(s.goodFor)}</small><small>${esc(s.prices)}</small><small>${esc(s.where)}</small>${s.link ? `<a class="xs" href="${esc(s.link)}" target="_blank" rel="noopener">افتح الموقع</a>` : ""}</div></div>`).join("")}</div><p class="sub xs">اتجمعت ببحث ${esc(mk.checked || "")}، فممكن تكون قديمة.</p></div>` : ""}`;
}

/* ---------- advisor: Lorenzo ---------- */
const PERSONA = { name: "لورينزو", role: "خيّاطك ومستشارك" };
const AREAS = { clothes: "الهدوم والمقاس", body: "الجسم والوقفة", grooming: "الشعر والدقن والحلاقة", skin: "العناية الشخصية", glasses: "النضارة", speech: "الكلام ولغة الجسد", etiquette: "الإتيكيت والشخصية" };
const TIE = (size = 26, sw = 1.6) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:var(--gold);stroke-width:${sw};stroke-linecap:round;stroke-linejoin:round"><path d="M12 12 4 8v8zM12 12l8-4v8zM10.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0"/></svg>`;
function md(t) {
  return esc(t).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u.length > 40 ? u.slice(0, 40) + "…" : u}</a>`)
    .replace(/\[\[يوتيوب:\s*([^\]]+)\]\]/g, (m, s) => `<a href="${YT(s.trim())}" target="_blank" rel="noopener">▶ ${s.trim()}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}
// reply format from the server: short messages split by ---, ```card {json}```, [[يوتيوب: ...]], [[ردود: a | b]]
function parseReply(t) {
  let chips = []; const videos = []; const parts = [];
  t = String(t || "").replace(/\[\[ردود:\s*([^\]]+)\]\]/g, (m, s) => { chips = s.split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3); return ""; })
    .replace(/\[\[يوتيوب:\s*([^\]]+)\]\]/g, (m, q) => { videos.push(q.trim()); return ""; });
  const pushText = (x) => x.split(/^\s*-{3,}\s*$/m).map((s) => s.trim()).filter(Boolean).forEach((s) => parts.push({ text: s }));
  const re = /```card\s*([\s\S]*?)```/g; let last = 0, m;
  while ((m = re.exec(t))) { pushText(t.slice(last, m.index)); try { parts.push({ card: JSON.parse(m[1].trim()) }); } catch { pushText(m[1]); } last = re.lastIndex; }
  pushText(t.slice(last));
  return { parts, chips, videos };
}
function photoOf(i) { if (!i) return null; return i.category === "perfume" ? (i.photos?.bottle || i.photos?.studio) : (i.photos?.studio || i.photos?.wornFront || i.photos?.flatFront || Object.values(i.photos || {})[0]); }
function cardHtml(c) {
  const rows = (Array.isArray(c.rows) ? c.rows : []).slice(0, 6).map((r) => { const it = r.item_id ? item(String(r.item_id)) : null; const ph = photoOf(it);
    return `<${it ? `button class="crow" data-open="${esc(it.id)}"` : `div class="crow"`}><span class="cthumb">${ph ? img(ph) : it ? (it.category === "perfume" ? mono(it) : ic((CATS[it.category] || CATS.top)[1])) : ""}</span><span class="ctext"><strong>${esc(r.title || it?.name || "")}</strong>${r.sub ? `<span>${esc(r.sub)}</span>` : ""}</span></${it ? "button" : "div"}>`; }).join("");
  return `<div class="lcard"><div class="lcard-h"><span>${esc(c.title || "")}</span>${c.tag ? `<span class="lcard-tag">${esc(c.tag)}</span>` : ""}</div>${rows}${c.footer || c.action ? `<div class="lcard-f"><span>${md(c.footer || "")}</span>${c.action ? `<button class="lcard-a" data-a="advAsk" data-q="${esc(c.action)}">${esc(c.action)} ←</button>` : ""}</div>` : ""}</div>`;
}
const videoHtml = (q) => `<a class="lvideo" href="${YT(q)}" target="_blank" rel="noopener"><span class="lvideo-i"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="fill:var(--gold)"><path d="M7 4l13 8-13 8z"/></svg></span><span><strong>اتعلم: ${esc(q)}</strong><small>بحث على يوتيوب</small></span></a>`;

function vAdvisor() {
  return `<div class="adv">
    <header class="adv-h"><button class="adv-who" data-a="atelier" aria-label="افتح ملف ${PERSONA.name}"><span class="adv-av">${TIE()}</span><span><strong>${PERSONA.name}</strong><small id="advStatus">${S.busyKey === "chat" ? esc(S.adv.steps.at(-1)?.label || "بيفكر…") + "…" : PERSONA.role + " · متاح"}</small></span></button><button class="adv-plan" data-a="atelier">خطتي</button></header>
    ${!S.keyStatus?.set ? `<div class="tip">لسه ماحطيتش مفتاح Anthropic. <button class="btn text" style="min-height:30px;padding:0" data-a="sheetSettings">روح للإعدادات</button></div>` : ""}
    ${aChat()}</div>`;
}
function aChat() {
  const turns = S.chat; const d = S.adv.d; const lastA = [...turns].reverse().find((t) => t.role === "assistant");
  const empty = !turns.length ? `<div class="lbub him">أهلاً يا أحمد. أنا ${PERSONA.name}، خيّاطك ومستشارك. نبدأ بإيه؟</div>
    <div class="chips">${["قيّمني وحطلي أهداف", "ساعدني أنضف نضارتي، هي متخدشة", "ألبس إيه بكرة؟", "إزاي أقف وأمشي بثقة؟"].map((x) => `<button class="chip" data-a="advAsk" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : "";
  let lastDay = "";
  const out = turns.slice(-40).map((t) => {
    const day = t.created_at ? cairoDay(Date.parse(t.created_at)) : cairoDay(); let sep = "";
    if (day !== lastDay) { lastDay = day; sep = `<span class="dsep">${day === cairoDay() ? "النهارده" : fmtD(Date.parse(day + "T12:00:00Z"))}</span>`; }
    if (t.role === "user") return `${sep}<div class="lbub me">${t.image_path ? img(t.image_path) : ""}${t.content ? `<div>${esc(t.content).replace(/\n/g, "<br>")}</div>` : ""}</div>`;
    const r = parseReply(t.content);
    const body = r.parts.map((p) => p.card ? cardHtml(p.card) : `<div class="lbub him">${md(p.text)}</div>`).join("") + r.videos.map(videoHtml).join("");
    const srcs = (t.meta?.sources || []).length ? `<details class="lsrc"><summary>المصادر (${t.meta.sources.length})</summary>${t.meta.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</details>` : "";
    const meta = `<div class="lfoot"><span class="lmeta">${t.model ? esc(modelName(t.model)) : ""}${t.cost_usd != null ? ` · ‎${usd(t.cost_usd)}` : ""} · ${t.meta?.searched ? "من بحث على النت" : "من غير بحث"}</span>${fbHtml(t)}</div>`;
    const chips = t === lastA && r.chips.length && S.busyKey !== "chat" && !S.adv.waiting ? `<div class="chips">${r.chips.map((x) => `<button class="chip" data-a="advAsk" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : "";
    return sep + body + srcs + meta + chips;
  }).join("");
  const busy = S.busyKey === "chat" ? (S.adv.live ? liveBlock() : thinkingCard()) : S.adv.waiting ? `<div class="lthink"><div class="tstep cur"><span class="tdot"></span><span>بيكمّل ردّه على رسالتك اللي فاتت…</span></div></div>` : "";
  const locked = S.busyKey === "chat" || S.adv.waiting;
  const pv = S.prev["adv_photo"];
  return `<div class="lchat" id="lchat">${empty}${out}${busy}${errBox("chat")}</div>
   <div class="composer lcomp">${pv ? `<div class="row" style="gap:8px"><img src="${pv}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px"><button class="btn text" data-a="advPhotoX">شيل الصورة</button></div>` : ""}
    <div class="row" style="flex-wrap:nowrap;align-items:flex-end;gap:8px"><label class="iconbtn lcam" style="position:relative;overflow:hidden" aria-label="ابعت صورة">${ic("cam")}<input type="file" accept="image/*" data-slot="adv_photo" style="position:absolute;inset:0;opacity:0" ${locked ? "disabled" : ""}></label>
    <textarea data-scope="adv" data-b="msg" id="adv_msg" rows="1" placeholder="${locked ? "استنى لما يخلّص…" : `اكتب لـ${PERSONA.name}…`}" ${locked ? "disabled" : ""} class="linput">${esc(d.msg || "")}</textarea>
    ${S.busyKey === "chat" ? `<button class="lstop" data-a="advStop">وقّف</button>` : S.adv.waiting ? "" : `<button class="iconbtn lsend" data-a="advSend" aria-label="ابعت"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="transform:scaleX(-1)"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button>`}</div></div>`;
}
// 👍/👎 on each reply; Lorenzo reads these in every chat and in the Sunday review
const FB_WHY = { repeat: "مكرر", long: "طويل", wrong: "غلط", lost: "مش فاهمني", generic: "عام ومش ليا" };
function fbHtml(t) {
  if (typeof t.id !== "number") return "";
  const f = t.feedback || {}; const open = S.adv.fbOpen === t.id;
  const btn = (v, label, icon) => `<button class="lfb ${f.v === v ? "on" : ""}" data-a="fbMsg" data-id="${t.id}" data-v="${v}" aria-label="${label}" aria-pressed="${f.v === v}">${icon}</button>`;
  const row = `${btn("up", "رد كويس", "👍")}${btn("down", "رد مش كويس", "👎")}${f.v === "down" && f.why && !open ? `<span class="lmeta">${esc(FB_WHY[f.why] || "")}</span>` : ""}`;
  const ask = open ? `<div class="lfb-ask"><span class="sub xs">إيه اللي ماعجبكش؟</span><div class="chips">${Object.entries(FB_WHY).map(([k, v]) => `<button class="chip ${f.why === k ? "on" : ""}" data-a="fbWhy" data-id="${t.id}" data-w="${k}">${v}</button>`).join("")}</div>
    <div class="row" style="flex-wrap:nowrap;gap:6px"><input data-scope="adv" data-b="fbnote" placeholder="كلمة كمان (اختياري)" value="${esc(S.adv.d.fbnote || f.note || "")}" style="flex:1"><button class="btn" style="min-height:36px;padding:0 14px" data-a="fbSave" data-id="${t.id}">تمام</button></div></div>` : "";
  return `<span class="lfbs">${row}</span>${ask}`;
}
async function setFeedback(id, patch) {
  const m = S.chat.find((x) => x.id === id); if (!m) return;
  const fb = patch === null ? null : { ...(m.feedback || {}), ...patch, at: Date.now() };
  const old = m.feedback; m.feedback = fb; render();
  try { await q(sb.from("chat_messages").update({ feedback: fb }).eq("id", id)); }
  catch (e) { m.feedback = old; render(); toast("التقييم ماتحفظش: " + e.message); }
}
// text that streams in while he writes: hide half-written cards/markers until they are complete
function liveHtml(t) {
  t = String(t || ""); const fences = t.split("```").length - 1; if (fences % 2) t = t.slice(0, t.lastIndexOf("```"));
  const open = t.lastIndexOf("[["); if (open >= 0 && t.indexOf("]]", open) < 0) t = t.slice(0, open);
  const r = parseReply(t);
  return r.parts.map((p) => p.card ? cardHtml(p.card) : `<div class="lbub him">${md(p.text)}</div>`).join("") || "";
}
function liveBlock() { return `<div id="advLive" class="llive">${liveHtml(S.adv.live)}</div><div class="lthink lmini" role="status"><div class="tstep cur"><span class="tdot"></span><span>بيكتب…</span></div></div>`; }
function thinkingCard() {
  const st = S.adv.steps; const secs = Math.round((Date.now() - S.adv.started) / 1000);
  const rows = st.map((s, i) => { const cur = i === st.length - 1;
    return `<div class="tstep ${cur ? "cur" : "done"}"><span class="tdot">${cur ? "" : `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`}</span><span><span>${esc(s.label)}</span>${s.detail ? `<small>«${esc(s.detail)}»</small>` : ""}</span></div>`; }).join("");
  return `<div class="lthink" role="status"><div class="tsteps">${rows || `<div class="tstep cur"><span class="tdot"></span><span>بيبدأ…</span></div>`}</div>
   <div class="tbar"><i></i></div><small class="ttime"><span id="advTimer">بقالي ${secs} ثانية</span>${st.some((s) => s.kind === "search") ? " · البحث بياخد لحد دقيقة" : ""}</small></div>`;
}
let advTimerId = null;
function startAdvTimer() { clearInterval(advTimerId); advTimerId = setInterval(() => { const el = $("#advTimer"); if (!el || S.busyKey !== "chat") { clearInterval(advTimerId); return; } el.textContent = `بقالي ${Math.round((Date.now() - S.adv.started) / 1000)} ثانية`; }, 1000); }

async function aiStream(mode, payload, onStep, signal, onLive) {
  const doFetch = window.DOLABY_STUB?.streamFetch || fetch;
  const { data } = await sb.auth.getSession(); const token = data.session?.access_token;
  const r = await doFetch(`${CFG.url}/functions/v1/advisor`, { method: "POST", signal, headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode, stream: true, ...payload }) });
  const fail = (j) => { const e = new Error(j?.message || "حصلت مشكلة"); e.code = j?.error; return e; };
  if (!(r.headers.get("content-type") || "").includes("ndjson")) { const j = await r.json().catch(() => null); if (!j?.ok) throw fail(j); return j; }
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = "", fin = null;
  for (;;) {
    const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; let ev; try { ev = JSON.parse(line); } catch { continue; } if (ev.type === "step") onStep(ev); else if (ev.type === "text" || ev.type === "reset") onLive?.(ev); else fin = ev; }
  }
  if (!fin) throw fail({ message: "الاتصال اتقطع قبل ما الرد يوصل. هيتحفظ لما يخلص، افتح الشات بعد شوية." });
  if (fin.type === "error") throw fail(fin);
  return fin;
}
// after "stop" (or a message sent while he is still answering): wait for that reply instead of starting a second one
async function waitForReply() {
  if (S.adv.waiting) return; S.adv.waiting = true; render();
  const until = Date.now() + 110000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 4000)); await reloadChat();
    if (S.chat.at(-1)?.role === "assistant") break;
  }
  S.adv.waiting = false; render(); scrollChat();
}
async function reloadChat() { try { S.chat = (await q(sb.from("chat_messages").select("*").order("id", { ascending: false }).limit(80))).reverse(); if (S.tab === "advisor") { render(); scrollChat(); } } catch {} }
async function advSend(qtext) {
  if (S.busyKey || S.adv.waiting) return; const d = S.adv.d; const text = String(qtext ?? d.msg ?? "").trim(); const blob = S.pending["adv_photo"];
  if (!text && !blob) return;
  S.busyKey = "chat"; S.lastErr.chat = null; S.adv.steps = []; S.adv.started = Date.now(); S.adv.live = "";
  let image_path = null;
  try { if (blob) image_path = await upload(blob, "chat"); } catch (e) { S.busyKey = null; toast("الصورة ماترفعتش: " + e.message); render(); return; }
  S.chat.push({ role: "user", content: text, image_path, id: "tmp", created_at: new Date().toISOString() }); d.msg = ""; delete S.pending["adv_photo"]; delete S.prev["adv_photo"];
  render(); scrollChat(); startAdvTimer();
  S.adv.ctl = new AbortController();
  try {
    const r = await aiStream("chat", { text, image_path }, (ev) => {
      if (S.adv.steps.at(-1)?.label === ev.label && !ev.detail) return;
      S.adv.steps.push(ev); const box = $(".lthink"); if (box && !S.adv.live) { box.outerHTML = thinkingCard(); scrollChat(); }
      const st = $("#advStatus"); if (st) st.textContent = ev.label + "…";
    }, S.adv.ctl.signal, (ev) => {
      const had = !!S.adv.live;
      S.adv.live = ev.type === "reset" ? "" : S.adv.live + ev.t;
      if (had !== !!S.adv.live) { render(); scrollChat(); return; } // switch between steps card and live text
      if (liveRaf) return; liveRaf = requestAnimationFrame(() => { liveRaf = 0; const el = $("#advLive"); if (el) { const near = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120; el.innerHTML = liveHtml(S.adv.live); if (near) scrollChat(); } });
      const stt = $("#advStatus"); if (stt) stt.textContent = "بيكتب…";
    });
    S.chat.push({ id: r.id, role: "assistant", content: r.reply, model: r.model, cost_usd: r.cost_usd, created_at: new Date().toISOString(), meta: { searched: r.searched, sources: r.sources, actions: r.actions, searchErrors: r.searchErrors } });
    reloadPart("usage");
    if ((r.actions || []).length) { reloadPart("items"); reloadPart("advisor"); reloadPart("lessons"); reloadPart("profile"); reloadPart("meas"); }
    const userN = S.chat.filter((m) => m.role === "user").length;
    if (userN % 4 === 0) ai("learn").then((x) => { if (x.added?.length) { reloadPart("lessons"); toast(`${PERSONA.name} اتعلم ${x.added.length} حاجة جديدة عنك`); } }).catch(() => {});
  } catch (e) {
    if (e.name === "AbortError" || e.code === "busy") { toast(e.code === "busy" ? e.message : "وقّفت المتابعة. الرد لسه بيتكتب وهيظهر هنا."); waitForReply(); }
    else S.lastErr.chat = e.message;
  } finally { S.busyKey = null; S.adv.ctl = null; S.adv.live = ""; clearInterval(advTimerId); render(); scrollChat(); }
}
let liveRaf = 0;
function scrollChat() { if (S.tab === "advisor") requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight)); }

/* ---- Lorenzo's file (atelier sheet): plan, evaluation, what he knows, lessons, fashion notes ---- */
function aEval() {
  const as = S.advisor?.assessment;
  if (!as) return `${S.busyKey === "assess" ? busyBox("بيعمل تقييمك") : `<div class="box"><h3>نبدأ بتقييم واضح</h3><p class="sm">هيبص على صور جسمك ومقاساتك ودولابك، ويقيّم: ${Object.values(AREAS).join("، ")}. اللي مش هيقدر يحكم عليه هيقولك محتاج يعرف إيه. بعدين يحطلك أهداف.</p><button class="btn main wide" data-a="assess">${ic("spark")}ابدأ التقييم</button>${errBox("assess")}</div>`}`;
  return `<div class="box"><div class="row between"><h3>الصورة العامة</h3><span class="sub xs">${fmtD(as.at)}</span></div><p class="sm">${md(as.summary)}</p>${as.firstFocus ? `<div class="tip"><b>نبدأ بـ:</b> ${md(as.firstFocus)}</div>` : ""}</div>
  ${(as.areas || []).map((x) => `<div class="box"><div class="row between"><h3>${esc(x.name || AREAS[x.key] || x.key)}</h3>${x.score == null ? pill(["محتاج أعرف أكتر", "p-mute"]) : `<strong>${x.score}/10</strong>`}</div>${x.score == null ? "" : tapeBar(x.score / 10, "")}<p class="sm">${md(x.now)}</p>${x.why ? `<p class="sub sm">${md(x.why)}</p>` : ""}${(x.gaps || []).length ? `<p class="sub xs"><b>محتاج أعرف:</b> ${x.gaps.map(esc).join("، ")}</p>` : ""}</div>`).join("")}
  ${S.busyKey === "assess" ? busyBox("بيعمل تقييمك") : `<button class="btn wide" data-a="assess">${ic("spark")}قيّمني تاني</button>${errBox("assess")}<p class="sub xs">الأحسن تعيده كل شهر مع القياس الشهري.</p>`}`;
}
function weekCard() {
  const w = S.advisor?.week; const days = w ? Math.floor((Date.now() - w.start) / DAY) : 0;
  if (S.busyKey === "week") return busyBox("بيجهزلك الأسبوع");
  if (!w || w.done) return `<div class="box" style="background:var(--gold-soft)"><h3>${w ? "الأسبوع اللي جاي" : "أول أسبوع"}</h3><p class="sm">هدف واحد، ودرس صغير، وتحدي، وفيديوهات تتعلم منها.</p><button class="btn main wide" data-a="week">${ic("spark")}جهّز خطة الأسبوع</button>${errBox("week")}</div>`;
  return `<div class="box"><div class="row between"><h3>مهمة الأسبوع</h3><span class="pill p-gold">${esc(w.goal)}</span></div>${tapeBar(Math.min(1, (days + 1) / 7), `يوم ${Math.min(7, days + 1)} من 7`)}
     <p class="sm">${md(w.lesson)}</p><div class="tip"><strong>التحدي</strong><p>${md(w.challenge)}</p></div>
     ${(w.checklist || []).map((c, i) => `<button class="li" style="padding-inline:0;min-height:48px" data-a="weekTick" data-i="${i}"><span class="pthumb" style="width:26px;height:26px;border-radius:8px;border:1.5px solid ${c.done ? "var(--gold)" : "var(--line)"};background:${c.done ? "var(--gold)" : "transparent"};color:#fff;display:grid;place-items:center">${c.done ? ic("check") : ""}</span><div><span class="sm" style="${c.done ? "text-decoration:line-through;color:var(--sub)" : ""}">${esc(c.t)}</span></div></button>`).join("")}
     ${(w.videos || []).map(videoHtml).join("")}
     ${days >= 6 || S.adv.early ? `<div class="col" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><strong>الأسبوع خلص. عملت التحدي؟</strong>${One("adv", S.adv.d, "result", ["عملته كله", "عملت جزء", "ماعملتوش"])}${F("adv", S.adv.d, "weekNote", "إيه اللي حصل؟", { area: 1, ph: "اللي نفع، واللي كان صعب" })}<button class="btn main" data-a="weekClose">قفّل الأسبوع</button></div>` : `<button class="btn text" style="align-self:flex-start" data-a="weekCloseEarly">خلّصت بدري؟ قفّل الأسبوع</button>`}</div>`;
}
function aGoals() {
  const goals = S.advisor?.goals || [];
  if (!goals.length) return `<div class="box"><h3>لسه مفيش أهداف</h3><p class="sm">الأهداف بتطلع من التقييم الأول.</p><button class="btn main wide" data-a="atelierGo" data-v="eval">روح للتقييم</button></div>`;
  const sug = S.advisor?.assessment?.suggestedGoals || [];
  return `${goals.map((g) => { const dn = (g.steps || []).filter((s) => s.done).length, n = (g.steps || []).length || 1; return `<div class="box"><div class="row between"><strong>${esc(g.title)}</strong>${pill(g.status === "done" ? ["خلص", "p-keep"] : g.status === "paused" ? ["متأجل", "p-mute"] : ["شغال", "p-gold"])}</div><span class="sub xs">${esc(g.area)}${g.why ? " · " + esc(g.why) : ""}</span>${tapeBar(dn / n, "")}
     ${(g.steps || []).map((s, i) => `<button class="li" style="padding-inline:0;min-height:44px" data-a="stepTick" data-g="${esc(g.id)}" data-i="${i}"><span class="pthumb" style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${s.done ? "var(--good)" : "var(--line)"};background:${s.done ? "var(--good)" : "transparent"};color:#fff;display:grid;place-items:center">${s.done ? ic("check") : ""}</span><div><span class="sm" style="${s.done ? "text-decoration:line-through;color:var(--sub)" : ""}">${esc(s.t)}</span></div></button>`).join("")}
     <div class="row"><button class="btn text" style="min-height:36px" data-a="goalStatus" data-g="${esc(g.id)}" data-s="${g.status === "paused" ? "active" : "paused"}">${g.status === "paused" ? "رجّعه" : "أجّله"}</button>${g.status !== "done" ? `<button class="btn text" style="min-height:36px" data-a="goalStatus" data-g="${esc(g.id)}" data-s="done">خلّصته</button>` : ""}</div></div>`; }).join("")}
   ${sug.length ? `<div class="box"><h3>أهداف جديدة من آخر تقييم</h3>${sug.map((g, i) => `<div class="fix"><strong class="sm">${esc(g.title)}</strong><span class="sub xs">${esc(g.why || "")}</span><button class="btn text" style="justify-content:flex-start;padding:0;min-height:32px" data-a="goalAdopt" data-i="${i}">${ic("plus")}ضيفه</button></div>`).join("")}</div>` : ""}`;
}
function aAbout() {
  const ab = S.advisor?.about || {}; const L = { style: "الستايل", job: "الشغل", events: "المناسبات", goals: "الأهداف", progress: "التقدم", body: "الجسم", grooming: "العناية والحلاقة", glasses: "النضارة", other: "حاجات تانية" };
  const keys = Object.keys(ab);
  return `<div class="box"><p class="sub sm">بيتبني من كلامكم مع بعض. لو حاجة غلط، قوله في الشات يصلحها.</p>
   ${keys.length ? keys.map((k) => `<div class="fix"><strong class="sm">${esc(L[k] || k)}</strong><p class="sm">${md(ab[k])}</p></div>`).join("") : `<p class="sub sm">لسه فاضي. هيتملا مع الوقت.</p>`}</div>`;
}
function aLessons() {
  return `<div class="box"><p class="sub sm">بتتحمّل في كل رد. امسح أي واحد غلط.</p>${S.lessons.map((l) => `<div class="lesson"><p>${esc(l.rule)}<br><span class="sub xs">${fmtD(l.created_at)}${l.source === "auto" ? " · اتعلمه لوحده" : l.source === "outfit" ? " · من رأيك في طقم" : ""}</span></p><button class="iconbtn" data-a="lessonDel" data-id="${l.id}" aria-label="امسح">${ic("trash")}</button></div>`).join("") || `<p class="sub sm">لسه مفيش.</p>`}</div>`;
}
function aNotes() {
  const st = S.settings || {};
  return `<div class="box"><p class="sm">كل يوم الساعة 7 الصبح بتوقيت مصر ${PERSONA.name} بيعمل بحث صغير عن الموضة الرجالي يناسبك، بحد أقصى ${usd(st.daily_learn_cap_usd ?? 0.1)} في اليوم. ${st.daily_learn === false ? "<b>متوقف دلوقتي.</b>" : ""}</p></div>
   ${(S.notes || []).map((n) => `<div class="box"><div class="row between"><strong>${esc(n.topic)}</strong><span class="sub xs">${fmtD(Date.parse(n.day + "T12:00:00Z"))}</span></div><p class="sm">${md(n.insight)}</p>${(n.tips || []).length ? `<ul class="sm">${n.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${(n.sources || []).length ? `<details class="lsrc"><summary>المصادر (${n.sources.length})</summary>${n.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</details>` : ""}<span class="sub xs">${n.searches || 0} بحث · ${usd(n.cost_usd)}</span></div>`).join("") || `<p class="sub sm">لسه ما اتعلمش حاجة. أول بحث هيكون بكرة الساعة 7 الصبح.</p>`}`;
}
function sheetAtelier(s) {
  const v = s.view || "home"; const a = S.advisor || {}; const w = a.week;
  const titles = { eval: "تقييمك", goals: "أهدافك", plan: "مهمة الأسبوع", about: "اللي يعرفه عنك", lessons: "الدروس اللي اتعلمها", notes: "بيتعلم إيه من الموضة" };
  if (v !== "home") return sheetFrame(titles[v], `<div class="col lg">${v === "eval" ? aEval() : v === "goals" ? aGoals() : v === "plan" ? weekCard() : v === "about" ? aAbout() : v === "lessons" ? aLessons() : aNotes()}</div>`, "", "atelierHome");
  const active = (a.goals || []).filter((g) => g.status === "active").length; const days = w && !w.done ? Math.min(7, Math.floor((Date.now() - w.start) / DAY) + 1) : null;
  const n0 = (S.notes || [])[0], l0 = S.lessons[0];
  return sheetFrame(PERSONA.name, `<div class="col lg">
    <div class="atel"><span class="adv-av big">${TIE(40, 1.5)}</span><strong>${PERSONA.name}</strong><small>خيّاطك ومستشارك في المظهر والإتيكيت</small>
     <div class="atel-stats"><span><b>${active}</b><small>أهداف شغالة</small></span><span><b>${S.lessons.length}</b><small>درس اتعلمه</small></span><span><b>${days ? "يوم " + days : "—"}</b><small>من الأسبوع</small></span></div></div>
    ${w && !w.done ? `<button class="box atel-task" data-a="atelierGo" data-v="plan"><div class="row between"><strong>مهمة الأسبوع</strong><span class="pill p-gold">${esc(w.goal)}</span></div><p class="sm" style="text-align:start">${esc(w.challenge)}</p>${tapeBar((w.checklist || []).filter((c) => c.done).length / Math.max(1, (w.checklist || []).length), "")}</button>` : `<button class="btn main wide" data-a="atelierGo" data-v="plan">${ic("spark")}${a.goals?.length ? "جهّز مهمة الأسبوع" : "شوف خطة الأسبوع"}</button>`}
    <div class="list">${[["eval", "تقييمك", a.assessment ? `${(a.assessment.areas || []).length} مجالات` : "لسه"], ["goals", "أهدافك", `${active} شغالة`], ["about", "اللي يعرفه عنك", `${Object.keys(a.about || {}).length} حاجات`], ["lessons", "الدروس اللي اتعلمها منك", String(S.lessons.length)], ["notes", "بيتعلم إيه من الموضة", (S.notes || []).length ? `آخر بحث ${fmtD(Date.parse(S.notes[0].day + "T12:00:00Z"))}` : "كل يوم 7 الصبح"]].map(([k, l, sub]) => `<button class="li" data-a="atelierGo" data-v="${k}"><div><strong>${l}</strong><small>${esc(sub)}</small></div><span class="chev">${ic("back")}</span></button>`).join("")}</div>
    ${n0 ? `<div class="box"><strong>آخر حاجة اتعلمها من الموضة</strong><p class="sm">${esc(n0.topic)}: ${esc(n0.insight)}</p></div>` : ""}
    ${l0 ? `<div class="box"><strong>آخر درس اتعلمه منك</strong><p class="sm">«${esc(l0.rule)}»</p><span class="sub xs">${fmtD(l0.created_at)}</span></div>` : ""}
  </div>`);
}
async function advWrite(fn, msg) {
  const a = JSON.parse(JSON.stringify(S.advisor || {})); fn(a);
  try { await q(sb.from("advisor").upsert({ owner_id: uid(), goals: a.goals || [], week: a.week || null, history: a.history || [], assessment: a.assessment || null, updated_at: new Date().toISOString() })); S.advisor = { ...S.advisor, ...a }; if (msg) toast(msg); if (S.sheet) renderSheet(); else render(); }
  catch (e) { toast("ماتحفظش: " + e.message); }
}
async function weekClose() {
  const d = S.adv.d; const w = S.advisor?.week; if (!w) return; const res = d.result || "عملت جزء"; const note = String(d.weekNote || "").trim(); const ticks = (w.checklist || []).filter((c) => c.done).length;
  await advWrite((x) => { x.week.done = true; x.history = (x.history || []).concat([{ kind: "week", start: w.start, end: Date.now(), goal: w.goal, challenge: w.challenge, result: res, ticks, of: (w.checklist || []).length, note }]).slice(-60); }, "الأسبوع اتقفل");
  act("week_closed", { goal: w.goal, result: res, ticks, note }); d.result = null; d.weekNote = ""; S.adv.early = false;
}

/* ---------- studio photos (background removed on the phone) ---------- */
let studioMod = null;
async function studio() { if (!studioMod) studioMod = await import("./studio.js"); return studioMod; }
async function fetchPhotoBlob(path) { if (!S.urls.has(path)) { const { data } = await sb.storage.from("photos").createSignedUrls([path], 600); for (const r of data || []) if (r.signedUrl) S.urls.set(r.path, r.signedUrl); } const r = await fetch(S.urls.get(path)); if (!r.ok) throw new Error("مش قادر أفتح الصورة"); return await r.blob(); }
const kindOf = (cat) => (cat === "perfume" || cat === "acc" ? "bottle" : "garment");
// quick add: one photo → studio shot + details filled by Claude, then you confirm
async function magicAdd(file) {
  const s = { type: "add", step: "magic", d: { occasions: [], season: "كل المواسم" }, magic: { steps: [{ label: "بنجهّز الصورة" }], err: null } };
  openSheet(s); const step = (label) => { s.magic.steps.push({ label }); if (S.sheet === s) renderSheet(); };
  try {
    const blob = await shrink(file, 1600); s.magic.prev = URL.createObjectURL(blob); renderSheet();
    const orig = await upload(blob, "items");
    step("بيشيل الخلفية على موبايلك (أول مرة بياخد وقت أطول)");
    const st = await studio(); const cutP = st.cutout(blob, (k, p) => { s.magic.progress = p; });
    step(`${PERSONA.name} بيتعرف على القطعة ويقرا التيكت`);
    const idP = ai("identify", { image_path: orig }).catch((e) => ({ err: e }));
    const [cut, idr] = await Promise.all([cutP, idP]);
    const it = idr.err ? null : idr.item; if (idr.err) s.magic.idErr = idr.err.message;
    const cat = it?.category || "top"; step("بيحطها على خلفية الاستوديو");
    const shot = await st.compose(cut, kindOf(cat)); const studioPath = await upload(shot, "items");
    s.photosPreset = cat === "perfume" ? { bottle: studioPath, bottleOriginal: orig } : { studio: studioPath, flatFront: orig };
    s.d = { ...s.d, category: cat, name: it?.name || "", color: it?.color || "", season: it?.season || "كل المواسم", occasions: it?.occasions || [], notes: it?.notes || "",
      ...(cat === "perfume" ? { house: it?.brand || "", ptype: ["أصلي", "تركيبة", "محلي"].includes(it?.ptype) ? it.ptype : "أصلي", ml: it?.ml || "", pstatus: "owned", role: "occasion" } : { brand: it?.brand || "" }) };
    s.magic.result = { shot: URL.createObjectURL(shot), confidence: it?.confidence, read: it?.read_text, cost: idr.cost_usd, model: idr.model };
    s.step = "details"; if (S.sheet === s) renderSheet();
    act("studio_photo", { category: cat });
  } catch (e) { s.magic.err = e.message || String(e); if (S.sheet === s) renderSheet(); }
}
function sheetMagic(s) {
  const m = s.magic;
  return sheetFrame("قطعة جديدة", `<div class="col lg">${m.prev ? `<img src="${m.prev}" alt="" style="width:100%;max-height:300px;object-fit:contain;border-radius:18px;background:var(--fill)">` : ""}
   <div class="lthink" style="width:100%">${m.steps.map((x, i) => `<div class="tstep ${i === m.steps.length - 1 && !m.err ? "cur" : "done"}"><span class="tdot">${i === m.steps.length - 1 && !m.err ? "" : `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`}</span><span>${esc(x.label)}</span></div>`).join("")}<div class="tbar"><i></i></div></div>
   ${m.err ? `<div class="err">${esc(m.err)}</div><button class="btn wide" data-a="toCat">رجوع</button>` : ""}</div>`);
}
async function restudio(id) {
  const it = item(id); if (!it || S.busy) return; S.busy = "studio:" + id; renderSheet();
  try {
    const src = it.category === "perfume" ? (it.photos.bottleOriginal || it.photos.bottle) : (it.photos.flatFront || it.photos.wornFront);
    if (!src) throw new Error("ضيف صورة للقطعة الأول");
    const st = await studio(); const shot = await st.studioShot(await fetchPhotoBlob(src), kindOf(it.category));
    const path = await upload(shot, "items");
    const photos = { ...it.photos, ...(it.category === "perfume" ? { bottle: path, bottleOriginal: it.photos.bottleOriginal || it.photos.bottle } : { studio: path }) };
    await q(sb.from("items").update({ photos, updated_at: new Date().toISOString() }).eq("id", id)); await reloadPart("items"); act("studio_photo", { id }); toast("الصورة الشيك جاهزة");
  } catch (e) { toast("ماقدرتش أعمل الصورة: " + (e.message || e)); }
  finally { S.busy = null; if (S.sheet?.type === "item") renderSheet(); }
}

/* ---------- profile, settings, weekly review ---------- */
function vProfile() {
  const p = S.profile || {}, m = S.meas[0] || {}; const left = m.date ? Math.max(0, Math.ceil((m.date + 30 * DAY - Date.now()) / DAY)) : 0;
  const bpN = Object.keys(p.bodyPhotos || {}).length; const spent = S.usage.reduce((s, r) => s + Number(r.cost_usd || 0), 0); const cap = Number(S.settings?.monthly_cap_usd ?? 5);
  return `<div class="col lg"><h1>${esc(p.name || "ملفي")}</h1>
  <div class="box"><div class="row between"><strong>القياس الجاي</strong><span class="sub sm">بعد ${left} يوم</span></div>${tapeBar(1 - left / 30, "")}<p class="sub xs">آخر قياس ${fmtD(m.date)}</p></div>
  <div class="list">
   <button class="li" data-a="sheetProfile">${ic("user")}<div><strong>بياناتي</strong><small>${p.heightCm ? p.heightCm + " سم" : ""}${p.glasses === "yes" ? " · بلبس نضارة" : ""}</small></div><span class="chev">${ic("back")}</span></button>
   <button class="li" data-a="sheetMeasure">${ic("tape")}<div><strong>المقاسات</strong><small>صدر ${m.chest ?? "—"} · وسط ${m.waist ?? "—"} · كتف ${m.shoulder ?? "—"}</small></div><span class="chev">${ic("back")}</span></button>
   <button class="li" data-a="sheetBody">${ic("body")}<div><strong>صور جسمك</strong><small>${bpN} من 3</small></div><span class="chev">${ic("back")}</span></button>
   <button class="li" data-a="sheetPerf">${ic("bottle")}<div><strong>ذوقك في العطور</strong><small>اللي بتحبه واللي مش بتحبه</small></div><span class="chev">${ic("back")}</span></button>
  </div>
  <div class="list">
   <button class="li" data-a="sheetReview">${ic("cal")}<div><strong>مراجعة الأسبوع</strong><small>كل أحد الساعة 2 الضهر بتوقيت مصر</small></div><span class="chev">${ic("back")}</span></button>
   <button class="li" data-a="sheetSettings">${ic("gear")}<div><strong>الإعدادات</strong><small>${S.keyStatus?.set ? "المفتاح متحط" : "المفتاح لسه مش متحط"} · صرفت ${usd(spent)} من ${usd(cap)} الشهر ده</small></div><span class="chev">${ic("back")}</span></button>
  </div>
  <button class="btn text red" data-a="signOut">${ic("out")}اخرج من الحساب</button>
  </div>`;
}
function sheetSettings(s) {
  const d = s.d; const spent = S.usage.reduce((a, r) => a + Number(r.cost_usd || 0), 0); const cap = Number(S.settings?.monthly_cap_usd ?? 5);
  return sheetFrame("الإعدادات", `<div class="col lg">
   <div class="box"><h3>مفتاح Anthropic</h3>
    <p class="sm">${S.keyStatus?.set ? `${pill(["متحط", "p-keep"])} من ${fmtDT(S.keyStatus.set_at)}. مش هيظهر هنا تاني أبداً.` : pill(["لسه مش متحط", "p-remove"])}</p>
    <label class="field"><span>${S.keyStatus?.set ? "حط مفتاح جديد بداله" : "حط المفتاح هنا"}</span><input type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" data-scope="sh" data-b="key" value="${esc(d.key || "")}" placeholder="sk-ant-…"><small>هتكتب أو تلزق المفتاح بنفسك. بيتنضف لوحده لو لزق معاه اسمه، ويتحفظ في مكان المتصفح مايقدرش يقراه.</small></label>
    <div class="pair"><button class="btn main" data-a="keySave" id="keySave">احفظ المفتاح</button><button class="btn" data-a="keyTest" id="keyTest" ${S.keyStatus?.set ? "" : "disabled"}>جرّبه</button></div>
    ${d.keyMsg ? `<div class="${d.keyOk ? "tip" : "err"}">${esc(d.keyMsg)}</div>` : ""}</div>
   <div class="box"><h3>حد الصرف الشهري</h3><p class="sm">السيرفر بيوقف أي طلب لو الصرف وصل للحد ده.</p>
    ${F("sh", d, "cap", "الحد", { num: 1, unit: "دولار" })}<button class="btn" data-a="capSave">احفظ الحد</button>
    <div class="kv"><span>صرفت الشهر ده</span><span>${usd(spent)}</span><span>الحد</span><span>${usd(cap)}</span><span>عدد الطلبات</span><span>${S.usage.length}</span></div>${tapeBar(cap ? spent / cap : 0, "")}</div>
   <div class="box"><h3>تعلّم الموضة اليومي</h3><p class="sm">كل يوم الساعة 7 الصبح بتوقيت مصر، بحث صغير على النت بـHaiku. التكلفة بتتحسب من حد الشهر.</p>
    <div class="field"><span>شغال؟</span>${Seg("sh", d, "dlearn", [["on", "أيوه"], ["off", "لأ"]])}</div>
    ${F("sh", d, "dcap", "أقصى صرف في اليوم", { num: 1, unit: "دولار" })}<button class="btn" data-a="learnSave">احفظ</button></div>
   <div class="box"><h3>سجل الاستخدام</h3>${S.usage.length ? `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>النوع</th><th>الموديل</th><th>التكلفة</th></tr></thead><tbody>${S.usage.slice(0, 60).map((r) => `<tr><td>${fmtDT(r.created_at)}</td><td>${esc(KIND[r.kind] || r.kind)}${r.ok ? "" : " ⚠"}${r.searches ? ` · ${r.searches} بحث` : ""}</td><td>${esc(modelName(r.model))}</td><td>${usd(r.cost_usd)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="sub sm">لسه مفيش.</p>`}</div>
   <div class="box"><h3>دروس المستشار (${S.lessons.length})</h3><p class="sub sm">بتتحمّل في كل طلب. امسح الغلط.</p>
    ${S.lessons.map((l) => `<div class="lesson"><p>${esc(l.rule)}<br><span class="sub xs">${fmtD(l.created_at)}${l.source === "auto" ? " · اتعلمه لوحده" : l.source === "outfit" ? " · من رأيك في طقم" : ""}</span></p><button class="iconbtn" data-a="lessonDel" data-id="${l.id}" aria-label="امسح">${ic("trash")}</button></div>`).join("") || `<p class="sub sm">لسه مفيش.</p>`}</div>
   <div class="box"><h3>نسخة الدولاب القديم</h3><p class="sm">الأبلكيشن القديم على Claude لسه موجود زي ما هو كنسخة احتياطي.</p>${S.state.migration ? `<p class="sub xs">النقل: ${S.state.migration.items ?? "?"} قطعة، ${S.state.migration.measurements ?? "?"} قياس، الصور: ${S.state.migration.photos === "done" ? "اتنقلت" : "لسه"}</p>` : ""}</div>
  </div>`);
}
const KIND = { chat: "شات", verdict: "حكم قطعة", report: "تحليل الدولاب", shop: "ترشيحات شرا", outfit: "طقم النهارده", assess: "تقييم", week: "خطة أسبوع", review: "مراجعة أسبوع", learn: "تعلّم", ping: "تجربة المفتاح", identify: "التعرف على قطعة", daily_learn: "تعلّم الموضة اليومي" };
function reviewWindow() {
  // the review is every Sunday 14:00 Cairo; the window is the 7 days before the latest one (or before now if it's later)
  const now = new Date(); const cairo = new Date(now.toLocaleString("en-US", { timeZone: TZ })); const offset = now - cairo;
  const lastSun = new Date(cairo); lastSun.setDate(cairo.getDate() - cairo.getDay()); lastSun.setHours(14, 0, 0, 0);
  if (lastSun > cairo) lastSun.setDate(lastSun.getDate() - 7);
  const nextSun = new Date(lastSun); nextSun.setDate(lastSun.getDate() + 7);
  const since = new Date(lastSun.getTime() - 7 * DAY + offset);
  return { since: since.toISOString(), last: new Date(lastSun.getTime() + offset), next: new Date(nextSun.getTime() + offset) };
}
async function openReview() {
  const w = reviewWindow(); openSheet({ type: "review", w, data: null });
  try {
    const [msgs, acts, les, use] = await Promise.all([
      q(sb.from("chat_messages").select("role,content,created_at,cost_usd,model").gte("created_at", w.since).order("id")),
      q(sb.from("activity").select("actor,kind,detail,created_at").gte("created_at", w.since).order("id")),
      q(sb.from("lessons").select("rule,created_at").gte("created_at", w.since)),
      q(sb.from("usage_log").select("kind,model,cost_usd,created_at").gte("created_at", w.since)),
    ]);
    if (S.sheet?.type === "review") { S.sheet.data = { msgs, acts, les, use }; renderSheet(); }
  } catch (e) { toast("ماقدرتش أجيب الأسبوع: " + e.message); }
}
const ACT = { verdict: "حكم على قطعة", set_verdict: "حكم على قطعة", save_lesson: "حفظ درس", update_about: "حدّث ملخصك", update_profile: "حدّث ملفك", add_measurement: "سجّل قياس", update_item: "عدّل قطعة", set_goals: "حدّث الأهداف", assessment: "عمل تقييم", item_added: "ضفت قطعة", item_edited: "عدّلت قطعة", item_deleted: "مسحت قطعة", worn: "لبست قطعة", wore_outfit: "لبست طقم مترشح", outfit_feedback: "قيّمت طقم", measurement: "سجّلت قياس", step: "علّمت على خطوة", week_closed: "قفلت أسبوع", goal_status: "غيّرت حالة هدف", migrated: "نقل البيانات", onboarded: "عملت ملفك", studio_photo: "صورة استوديو", update_about: "حدّث اللي يعرفه عنك" };
function reviewText(dt, w) {
  const adv = dt.msgs.filter((m) => m.role === "assistant"), me = dt.acts.filter((a) => a.actor === "me"), ad = dt.acts.filter((a) => a.actor === "advisor");
  const cost = dt.use.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const line = (a) => `- ${fmtDT(a.created_at)}: ${ACT[a.kind] || a.kind}${a.detail?.rule ? ` («${a.detail.rule}»)` : a.detail?.verdict ? ` (${(VERD[a.detail.verdict] || [a.detail.verdict])[0]})` : a.detail?.goal ? ` (${a.detail.goal}: ${a.detail.result || ""})` : ""}`;
  return `مراجعة أسبوع دولابي — من ${fmtDT(w.since)} لحد ${fmtDT(Date.now())} (بتوقيت مصر)
\nالمستشار نصح بإيه (${adv.length} رد):\n${adv.map((m) => `- ${fmtDT(m.created_at)}: ${plain(m.content).slice(0, 220)}`).join("\n") || "- مفيش"}
\nأنا عملت إيه:\n${me.map(line).join("\n") || "- مفيش"}
\nالمستشار عمل إيه بالأدوات:\n${ad.map(line).join("\n") || "- مفيش"}
\nاتعلم إيه (${dt.les.length} درس):\n${dt.les.map((l) => `- ${l.rule}`).join("\n") || "- مفيش"}
\nالتكلفة: ${usd(cost)} في ${dt.use.length} طلب`;
}
function sheetReview(s) {
  const w = s.w, dt = s.data; const rv = S.state.review && S.state.review.since === w.since ? S.state.review : null;
  if (!dt) return sheetFrame("مراجعة الأسبوع", `<p class="sub"><span class="spin"></span> بجمع الأسبوع…</p>`);
  const adv = dt.msgs.filter((m) => m.role === "assistant"), me = dt.acts.filter((a) => a.actor === "me"), ad = dt.acts.filter((a) => a.actor === "advisor");
  const cost = dt.use.reduce((a, r) => a + Number(r.cost_usd || 0), 0);
  const L = (arr) => arr.length ? `<ul class="review">${arr.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p class="sub sm">مفيش.</p>`;
  return sheetFrame("مراجعة الأسبوع", `<div class="col lg">
   <div class="box"><p class="sm">من <b>${fmtDT(w.since)}</b> لحد دلوقتي. ميعاد المراجعة مع Claude: <b>الأحد ${fmtD(w.next)} الساعة 2 الضهر</b> بتوقيت مصر.</p>
    <div class="kv"><span>ردود المستشار</span><span>${adv.length}</span><span>حاجات عملتها</span><span>${me.length}</span><span>حاجات عملها المستشار</span><span>${ad.length}</span><span>دروس جديدة</span><span>${dt.les.length}</span><span>التكلفة</span><span>${usd(cost)}</span></div></div>
   <div class="box"><h3>نصح بإيه</h3>${L(adv.slice(-12).map((m) => `<span class="sub xs">${fmtDT(m.created_at)}</span> ${esc(plain(m.content).slice(0, 160))}…`))}</div>
   <div class="box"><h3>إنت عملت إيه</h3>${L(me.map((a) => `${esc(ACT[a.kind] || a.kind)} <span class="sub xs">${fmtDT(a.created_at)}</span>`))}</div>
   <div class="box"><h3>المستشار عمل إيه</h3>${L(ad.map((a) => `${esc(ACT[a.kind] || a.kind)}${a.detail?.rule ? ": " + esc(a.detail.rule) : ""} <span class="sub xs">${fmtDT(a.created_at)}</span>`))}</div>
   <div class="box"><h3>اتعلم إيه</h3>${L(dt.les.map((l) => esc(l.rule)))}</div>
   ${S.busyKey === "review" ? busyBox("بيلخّص الأسبوع") : `<div class="box"><h3>ملخص بالذكاء</h3><p class="sub sm">بيفصل بين اللي نصح بيه واللي عملته فعلاً، وإيه اللي محتاج يتصلح في المستشار.</p><button class="btn main wide" data-a="reviewAi">${ic("spark")}${rv ? "لخّص تاني" : "لخّص الأسبوع"}</button>${errBox("review")}</div>`}
   ${rv ? `<div class="box"><h3>الملخص</h3><p class="sm">${esc(rv.summary || "")}</p>${[["advised", "نصح بإيه"], ["did", "عملت إيه"], ["learned", "اتعلم إيه"], ["fixAdvisor", "محتاج يتصلح في المستشار"], ["nextWeek", "الأسبوع الجاي"]].map(([k, l]) => (rv[k] || []).length ? `<strong class="sm">${l}</strong><ul class="review">${rv[k].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "").join("")}</div>` : ""}
  </div>`, `<button class="btn main wide" data-a="reviewCopy">انسخ المراجعة عشان تلزقها لـClaude</button>`);
}

/* ---------- sheets ---------- */
function openSheet(s) { S.sheet = s; S.pending = {}; S.prev = {}; renderSheet(); }
function closeSheet() { S.sheet = null; $("#sheet").innerHTML = ""; render(true); }
function sheetFrame(title, body, foot, back) {
  const keep = $("#sheet .sheet-body")?.scrollTop || 0;
  $("#sheet").innerHTML = `<div class="sheet-wrap" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
   <div class="sheet-top">${back ? `<button class="iconbtn" data-a="${back}" aria-label="رجوع">${ic("back")}</button>` : `<span style="width:44px"></span>`}<h2>${title}</h2><button class="iconbtn" data-a="close" aria-label="قفل">${ic("close")}</button></div>
   <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ""}</div></div>`;
  if (S.sheet?.keepScroll) $("#sheet .sheet-body").scrollTop = keep;
  hydrateImgs();
}
function renderSheet() {
  const s = S.sheet; if (!s) { $("#sheet").innerHTML = ""; return; }
  s.keepScroll = ["item", "settings", "review", "atelier"].includes(s.type);
  if (s.type === "add") return s.step === "magic" ? sheetMagic(s) : sheetAdd(s);
  if (s.type === "atelier") return sheetAtelier(s);
  if (s.type === "item") return sheetItem(s);
  if (s.type === "settings") return sheetSettings(s);
  if (s.type === "review") return sheetReview(s);
  if (s.type === "profile") return sheetFrame("بياناتي", `<div class="col">${F("sh", s.d, "name", "اسمك")}${F("sh", s.d, "heightCm", "طولك", { num: 1, unit: "سم" })}<div class="field"><span>بتلبس نضارة؟</span>${Seg("sh", s.d, "glasses", [["yes", "أيوه"], ["no", "لأ"]])}</div><p class="sub xs">ستايلك وشغلك ومناسباتك بيتعرفوا من الشات مع المستشار، وتلاقيهم في المستشار ← عني.</p></div>`, `<button class="btn main wide" data-a="saveProfile">احفظ</button>`);
  if (s.type === "measure") { const rows = S.meas.map((x) => `<tr><td>${fmtD(x.date)}</td>${ALLM.map(([k]) => `<td>${x[k] || "—"}</td>`).join("")}</tr>`).join("");
    return sheetFrame("المقاسات", `<div class="col lg">${measBlock("sh", s.d)}<div class="col"><h3>القياسات السابقة</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th>${ALLM.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div></div>`, `<button class="btn main wide" data-a="saveMeasure" id="saveMeasure">احفظ المقاسات</button>`); }
  if (s.type === "body") return sheetFrame("صور جسمك", `<div class="col"><p class="sub">اختار صورة وهتتحفظ على طول. خاصة بيك بس.</p>${Shots(BODY, "b_", S.profile?.bodyPhotos || {})}<div class="tip">حط الموبايل على ارتفاع وسطك واستخدم التايمر. هدوم فيتد، وحيطة سادة، وإضاءة نهار.</div></div>`);
  if (s.type === "perf") return sheetFrame("ذوقك في العطور", `<div class="col">${F("sh", s.d, "perfumePrefs", "اللي بتحبه واللي مش بتحبه", { area: 1 })}${F("sh", s.d, "perfumeRestock", "التركيبات اللي بتجددها", { area: 1 })}</div>`, `<button class="btn main wide" data-a="savePerf">احفظ</button>`);
}
function sheetAdd(s) {
  const d = s.d, isP = d.category === "perfume", old = s.id ? item(s.id) : null;
  if (s.step === "cat") return sheetFrame("قطعة جديدة", `<div class="col"><label class="magic">${ic("cam")}<span><strong>صوّرها وسيب الباقي على ${PERSONA.name}</strong><small>بيشيل الخلفية ويعمل صورة استوديو، ويتعرف على القطعة ويملى التفاصيل</small></span><input type="file" accept="image/*" data-magic="1" aria-label="صورة القطعة"></label><h3>أو اختار النوع بنفسك</h3><div class="tiles">${Object.entries(CATS).map(([k, [l, i]]) => `<button class="tile" data-pick="${k}">${ic(i)}${l}</button>`).join("")}</div></div>`);
  if (s.step === "photos") { const n = SLOTS.filter(([k]) => S.prev["p_" + k] || old?.photos?.[k]).length;
    return sheetFrame(s.id ? "تعديل الصور" : "الصور", `<div class="col"><h1>صوّر القطعة</h1><p class="lead">صور اللبس هي اللي بيتحكم منها على المقاس.</p>${Shots(SLOTS, "p_", old?.photos || {})}<div class="tip">إضاءة نهار، والموبايل على ارتفاع وسطك، ووقفة طبيعية قدام المراية أو بالتايمر.</div></div>`,
      `<button class="btn main wide" data-a="toDetails">${n ? `التالي (${n} من 5)` : "التالي"}</button>${n ? "" : `<button class="btn text" data-a="toDetails">من غير صور دلوقتي</button>`}`, s.id ? null : "toCat"); }
  const hasPh = !isP && SLOTS.some(([k]) => S.prev["p_" + k] || old?.photos?.[k]);
  const more = isP ? `${F("sh", d, "ml", "الحجم", { num: 1, unit: "مل" })}<div class="field"><span>النوع</span>${Seg("sh", d, "ptype", [["أصلي", "أصلي"], ["تركيبة", "تركيبة"], ["محلي", "محلي"]])}</div>${F("sh", d, "when", "إمتى ومن فين؟", { ph: "للعطور اللي هتشتريها" })}`
    : `<div class="pair">${F("sh", d, "brand", "الماركة")}${F("sh", d, "size", "المقاس المكتوب")}</div>${F("sh", d, "fabric", "الخامة", { ph: "من التيكت" })}`;
  const mr = s.magic?.result;
  return sheetFrame(s.id ? "تعديل" : "التفاصيل", `<div class="col lg">
    ${mr ? `<div class="col"><img src="${mr.shot}" alt="الصورة الشيك" style="width:100%;border-radius:18px"><div class="tip">${PERSONA.name} ملى التفاصيل${mr.confidence ? " (ثقته: " + esc(mr.confidence) + ")" : ""}. راجعها وعدّل أي حاجة غلط.${mr.read ? `<br><span class="xs">المكتوب في الصورة: «${esc(mr.read)}»</span>` : ""}</div>${s.magic.idErr ? `<div class="err">التعرف على القطعة ماشتغلش: ${esc(s.magic.idErr)}. اكتب التفاصيل بنفسك.</div>` : ""}<div class="field"><span>النوع</span><div class="choices">${Object.entries(CATS).map(([k, [l]]) => `<button type="button" class="choice" data-scope="sh" data-seg="category" data-v="${k}" aria-pressed="${d.category === k}">${l.split(" /")[0]}</button>`).join("")}</div></div></div>` : ""}
    ${isP && !mr ? `<div class="col">${Shots(PSLOT, "p_", old?.photos || {})}<p class="sub xs">صورة للزجاجة على خلفية سادة في إضاءة نهار.</p></div>` : ""}
    <div class="col">${F("sh", d, "name", "سمّيها", { ph: isP ? "اسم العطر" : "مثلاً: قميص أبيض أكسفورد" })}${isP ? F("sh", d, "house", "البيت / الماركة") : F("sh", d, "color", "اللون")}</div>
    ${isP ? `<div class="field"><span>حالته</span>${Seg("sh", d, "pstatus", [["owned", "عندي"], ["planned", "هشتريه"], ["retired", "بطّلته"]])}</div><div class="field"><span>استخدامه</span>${Seg("sh", d, "role", [["daily", "يومي"], ["occasion", "مناسبات وتعتيق"]])}</div>` : ""}
    <div class="field"><span>بتلبسها في</span>${Multi("sh", d, "occasions", OCC)}</div>
    <details class="more" ${s.id ? "open" : ""}><summary>تفاصيل أكتر (اختياري)</summary><div>${more}<div class="field"><span>الموسم</span>${Seg("sh", d, "season", SEASONS.map((x) => [x, x]))}</div>${F("sh", d, "notes", "ملاحظاتك", { area: 1, ph: "بتحبها ليه؟ في حاجة مضايقاك فيها؟" })}</div></details>
   </div>`,
   `${hasPh ? `<button class="btn main wide" data-a="saveItem" data-an="1" id="saveItem">احفظ وخلّي المستشار يحكم عليها</button><button class="btn wide" data-a="saveItem" id="saveItem2">احفظ بس</button>` : `<button class="btn main wide" data-a="saveItem" id="saveItem">احفظ</button>`}`,
   isP ? (s.id ? null : "toCat") : "toPhotos");
}
async function saveItem(analyzeAfter) {
  const s = S.sheet, d = s.d, old = s.id ? item(s.id) : null, isP = d.category === "perfume";
  const name = String(d.name || "").trim(); if (!name) { toast("سمّي القطعة الأول"); return; }
  const btns = [...document.querySelectorAll("[data-a=saveItem]")]; btns.forEach((b) => (b.disabled = true)); const b0 = $("#saveItem"); const t0 = b0.textContent; b0.innerHTML = '<span class="spin"></span> بنحفظ…';
  try {
    const pp = s.photosPreset; const preset = !pp ? {} : isP ? { bottle: pp.bottle || pp.studio, bottleOriginal: pp.bottleOriginal || pp.flatFront } : { studio: pp.studio || pp.bottle, flatFront: pp.flatFront || pp.bottleOriginal };
    const photos = { ...(old?.photos || {}), ...preset };
    for (const [k] of isP ? PSLOT : SLOTS) { const b = S.pending["p_" + k]; if (b) { photos[k] = await upload(b, "items"); delete S.pending["p_" + k]; } }
    const changed = JSON.stringify(photos) !== JSON.stringify(old?.photos || {});
    const base = { ...(old || {}), ...d }; for (const k of ITEM_TOP) delete base[k];
    const data = itemData({ ...base, season: d.season || "كل المواسم", occasions: d.occasions || [], notes: String(d.notes || "").trim(),
      ...(isP ? { house: String(d.house || "").trim(), ptype: d.ptype || "أصلي", ml: num(d.ml), pstatus: d.pstatus || "owned", role: d.role || "occasion", when: String(d.when || "").trim() }
        : { color: String(d.color || "").trim(), brand: String(d.brand || "").trim(), size: String(d.size || "").trim(), fabric: String(d.fabric || "").trim() }) });
    const row = { category: d.category, name, data, photos, updated_at: new Date().toISOString(), ...(changed && old?.analysis ? { analysis_stale: true } : {}) };
    const saved = s.id ? await q(sb.from("items").update(row).eq("id", s.id).select().single()) : await q(sb.from("items").insert(row).select().single());
    await reloadPart("items"); act(s.id ? "item_edited" : "item_added", { id: saved.id, name, category: d.category });
    S.sheet = { type: "item", id: saved.id }; renderSheet(); toast(s.id ? "اتعدلت" : "اتضافت");
    if (analyzeAfter) analyze(saved.id);
  } catch (e) { console.warn(e); toast("ماتحفظش: " + e.message); btns.forEach((b) => (b.disabled = false)); b0.textContent = t0; }
}
function sheetItem(s) {
  const it = item(s.id); if (!it) { closeSheet(); return; }
  const isP = it.category === "perfume"; const ph = [...(isP ? PSLOT : [["studio", "صورة الاستوديو"], ...SLOTS])].filter(([k]) => it.photos?.[k]);
  const canStudio = isP ? (it.photos?.bottleOriginal || it.photos?.bottle) : (it.photos?.flatFront || it.photos?.wornFront);
  const studioBtn = canStudio ? (S.busy === "studio:" + it.id ? `<div class="tip"><span class="spin"></span> بيشيل الخلفية ويعمل الصورة الشيك…</div>` : `<button class="btn wide" data-a="restudio">${ic("spark")}${isP && it.photos?.bottleOriginal || it.photos?.studio ? "اعمل الصورة الشيك تاني" : "اعمل صورة شيك"}</button>`) : "";
  const facts = (isP ? [["البيت", it.house], ["النوع", it.ptype], ["الاستخدام", it.role === "daily" ? "يومي (شغل ومشاوير)" : "مناسبات وتعتيق"], ["الحجم", it.ml ? it.ml + " مل" : ""], ["الحالة", (PST[it.pstatus] || PST.owned)[0]], ["إمتى ومن فين", it.when], ["الموسم", it.season], ["المناسبات", (it.occasions || []).join("، ")], ["ملاحظات", it.notes]]
    : [["النوع", (CATS[it.category] || [""])[0]], ["اللون", it.color], ["الماركة", it.brand], ["المقاس", it.size], ["الخامة", it.fabric], ["الموسم", it.season], ["المناسبات", (it.occasions || []).join("، ")], ["آخر مرة لبستها", it.lastWorn ? fmtD(it.lastWorn) : ""], ["ملاحظات", it.notes]]).filter((x) => x[1]);
  const del = s.confirmDel ? `<div class="box" id="delBox" style="border:1.5px solid var(--bad)"><strong>تمسح "${esc(it.name)}"؟</strong><p class="sub sm">مش هتقدر ترجعها.</p><div class="pair"><button class="btn red" data-a="delYes">امسحها</button><button class="btn" data-a="delNo">لأ</button></div></div>` : "";
  return sheetFrame(esc(it.name || "قطعة"), `<div class="col lg">
    ${ph.length ? `<div class="strip">${ph.map(([k, l]) => `<figure>${img(it.photos[k], l)}<figcaption>${l}</figcaption></figure>`).join("")}</div>` : isP ? `<div class="hero-empty">${mono(it, 1)}${pill(PST[it.pstatus] || PST.owned)}${it.pstatus !== "planned" ? `<button class="btn" data-a="edit">${ic("cam")}صوّر الزجاجة</button>` : ""}</div>` : ""}
    ${studioBtn}
    ${isP ? "" : analysis(it)}
    ${facts.length ? `<div class="box"><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>` : ""}
    ${del || `<div class="actions" style="grid-template-columns:repeat(${isP ? 2 : 3},1fr)">${isP ? "" : `<button class="btn" data-a="worn">${ic("check")}لبستها النهارده</button>`}<button class="btn" data-a="edit">${ic("edit")}تعديل</button><button class="btn red" data-a="del">${ic("trash")}مسح</button></div>`}</div>`);
}
function analysis(it) {
  const a = it.analysis; const nPh = Object.keys(it.photos || {}).length;
  if (S.busy === it.id) return busyBox("المستشار بيحكم على القطعة");
  if (!a?.verdict) return `<div class="box" style="background:var(--gold-soft)"><h3>لسه ماتحكمش عليها</h3><p class="sm">هتعرف المقاس مظبوط ولا لأ، وتفضل ولا تروح للخياط ولا تخرج، وتتلبس مع إيه.</p>${nPh ? `<button class="btn main wide" data-a="analyze">${ic("spark")}احكم عليها</button>` : `<p class="sub sm">ضيف صور من تعديل الأول.</p>`}${errBox("verdict")}</div>`;
  const v = VERD[a.verdict] ? a.verdict : "keep";
  return `<div class="verdict ${VERD[v][2]}"><span class="sm">الحكم</span><span class="big">${VERD[v][0]}</span><p>${esc(a.verdictReason)}</p></div>
   ${it.analysisStale ? `<div class="tip">الصور اتغيرت بعد الحكم ده. احكم تاني عشان يبقى على الجديدة.</div>` : ""}
   ${a.fit ? `<div class="box"><div class="row between"><h3>المقاس</h3><span class="pill p-mute">${esc(a.fit.overall || "")}</span></div>${(a.fit.notes || []).length ? `<ul>${a.fit.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>` : ""}
   ${(a.tailoring || []).length ? `<div class="box"><h3>المطلوب من الخياط</h3>${a.tailoring.map((t) => `<div class="fix"><div class="row between"><strong>${esc(t.what)}</strong>${pill(t.reversible ? ["يرجع", "p-keep"] : ["مايرجعش", "p-remove"])}</div><span class="sub sm">${esc(t.why)}</span></div>`).join("")}</div>` : ""}
   ${a.styleNotes || (a.pairsWith || []).length ? `<div class="box"><h3>تتلبس إزاي</h3>${a.styleNotes ? `<p class="sm">${esc(a.styleNotes)}</p>` : ""}${(a.pairsWith || []).length ? `<div class="choices">${a.pairsWith.map((x) => `<span class="pill p-mute">${esc(x)}</span>`).join("")}</div>` : ""}</div>` : ""}
   ${a.description ? `<details class="more"><summary>وصف القطعة وحالتها</summary><div><p class="sm">${esc(a.description)}</p>${a.condition ? `<p class="sm"><b>الحالة:</b> ${esc(a.condition)}</p>` : ""}${a.photoTips ? `<p class="sm"><b>عن الصور:</b> ${esc(a.photoTips)}</p>` : ""}</div></details>` : ""}
   <p class="sub xs">${a.confidence ? "ثقة الحكم " + esc(a.confidence) + " · " : ""}${fmtD(a.at)}. الحكم من الصور تقديري، والقرار النهائي عند الخياط.</p>
   ${nPh ? `<button class="btn wide" data-a="analyze">${ic("spark")}احكم تاني</button>` : ""}${errBox("verdict")}`;
}
async function analyze(id) {
  if (S.busy) return; S.busy = id; S.lastErr.verdict = null; if (S.sheet?.type === "item") renderSheet();
  try { const r = await ai("verdict", { item_id: id }); await reloadPart("items"); toast(`اتحكم عليها · ${modelName(r.model)} · ${usd(r.cost_usd)}`); }
  catch (e) { S.lastErr.verdict = e.message; }
  finally { S.busy = null; if (S.sheet?.type === "item") renderSheet(); }
}

/* ---------- events ---------- */
document.addEventListener("input", (e) => {
  const t = e.target; if (!t.dataset.b) return;
  if (t.dataset.scope === "shop") { S.reco.shopAsk = t.value; return; }
  const d = scopeDraft(t.dataset.scope === "sh" ? "sheet" : t.dataset.scope); if (d) d[t.dataset.b] = t.value;
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.matches("input[type=file][data-magic]")) { const f = t.files?.[0]; if (f) magicAdd(f); return; }
  if (!t.matches("input[type=file][data-slot]")) return;
  const f = t.files?.[0]; if (!f) return; const key = t.dataset.slot;
  try {
    const b = await shrink(f); S.pending[key] = b; S.prev[key] = URL.createObjectURL(b);
    if (key.startsWith("b_") && S.sheet?.type === "body") {
      try { const path = await upload(b, "body"); delete S.pending[key]; const bp = { ...(S.profile?.bodyPhotos || {}), [key.slice(2)]: path };
        await q(sb.from("profiles").update({ body_photos: bp, updated_at: new Date().toISOString() }).eq("owner_id", uid())); await reloadPart("profile"); act("body_photo", { slot: key.slice(2) }); toast("الصورة اتحفظت"); }
      catch (er) { toast("الصورة ماترفعتش: " + er.message); }
    }
    if (S.sheet) renderSheet(); else render(true);
  } catch { toast("الصورة دي مش بتفتح. جرّب صورة تانية."); }
});
document.addEventListener("click", async (e) => {
  const g = e.target.closest("[data-seg],[data-multi],[data-one]");
  if (g) { const sc = g.dataset.scope === "sh" ? "sheet" : g.dataset.scope; const d = scopeDraft(sc); if (!d) return;
    if (g.dataset.one) { d[g.dataset.one] = g.dataset.v; g.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === g))); return; }
    if (g.dataset.seg === "category" && S.sheet?.type === "add") { d.category = g.dataset.v; renderSheet(); return; }
    if (g.dataset.seg) d[g.dataset.seg] = g.dataset.v; else { const k = g.dataset.multi; const a = new Set(d[k] || []); a.has(g.dataset.v) ? a.delete(g.dataset.v) : a.add(g.dataset.v); d[k] = [...a]; }
    g.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", g.dataset.seg ? String(b === g) : String((d[g.dataset.multi] || []).includes(b.dataset.v)))); return; }
  const tab = e.target.closest("[data-tab]"); if (tab) { S.tab = tab.dataset.tab; render(); if (S.tab === "advisor") scrollChat(); else scrollTo(0, 0); return; }
  const rs = e.target.closest("[data-rseg]"); if (rs) { S.reco.seg = rs.dataset.rseg; render(); return; }
  const sh = e.target.closest("[data-shelf]"); if (sh) { S.shelf = sh.dataset.shelf; render(); return; }
  const op = e.target.closest("[data-open]"); if (op) { openSheet({ type: "item", id: op.dataset.open }); return; }
  const pk = e.target.closest("[data-pick]"); if (pk) { const s = S.sheet; s.d.category = pk.dataset.pick; if (pk.dataset.pick === "perfume") { s.d.pstatus ||= "owned"; s.d.role ||= "occasion"; s.d.ptype ||= "أصلي"; s.step = "details"; } else s.step = "photos"; renderSheet(); return; }
  const a = e.target.closest("[data-a]"); if (!a) return; const actn = a.dataset.a;
  if (actn === "scrim" && e.target !== a) return;
  const s = S.sheet;
  switch (actn) {
    case "authMode": S.authMode = a.dataset.m; S.authD.msg = ""; render(true); break;
    case "authIn": authRun(async () => { const { error } = await sb.auth.signInWithPassword({ email: String(S.authD.email || "").trim(), password: S.authD.password || "" }); if (error) throw error; S.authD = {}; }); break;
    case "authUp": authRun(async () => { const { data, error } = await sb.auth.signUp({ email: String(S.authD.email || "").trim(), password: S.authD.password || "", options: { emailRedirectTo: CFG.site } }); if (error) throw error; S.authD = { email: S.authD.email, msg: data.session ? "" : "اتعمل الحساب. افتح الإيميل اللي جالك ودوس اللينك عشان تأكده، وبعدين ادخل من هنا." }; S.authMode = "in"; }); break;
    case "authForgot": authRun(async () => { const em = String(S.authD.email || "").trim(); if (!em) throw new Error("اكتب الإيميل"); const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: CFG.site }); if (error) throw error; S.authD.msg = "لو الإيميل ده عليه حساب، هيوصلك لينك. افتحه من الموبايل ده."; }); break;
    case "authNewPass": authRun(async () => { const pw = S.authD.newPass || ""; if (pw.length < 8) throw new Error("Password should be at least 8"); const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; S.recovery = false; S.authD = {}; history.replaceState(null, "", location.pathname); toast("الباسورد اتغير"); const { data } = await sb.auth.getSession(); S.session = data.session; if (S.session) setTimeout(loadAll, 0); }); break;
    case "signOut": await sb.auth.signOut(); closeSheet(); break;
    case "retryLoad": S.loadErr = null; loadAll(); break;
    case "obNext": obNext(); break;
    case "obSkip": if (S.ob.step < OB_STEPS - 1) { S.ob.step++; render(true); scrollTo(0, 0); } else obNext(); break;
    case "obBack": S.ob.step = Math.max(0, S.ob.step - 1); render(true); break;
    case "gateSave": if (await saveMeasFrom(S.gate.d, $("#gateSave"))) { S.gate.d = null; toast("المقاسات اتحدثت"); render(true); } break;
    case "outfit": aiJob("outfit", "outfit", { occasion: S.reco.d.occasion, weather: S.reco.d.weather, note: S.reco.d.note }, async (r) => { S.state.today = r.today; }); break;
    case "wearIt": wearIt(); break;
    case "fbUp": feedback(true); break;
    case "fbDown": feedback(false); break;
    case "report": aiJob("report", "report", {}, async (r) => { S.state.closet_report = r.report; }); break;
    case "shop": aiJob("shop", "shop", { ask: S.reco.shopAsk }, async (r) => { S.state.shop = r.shop; }); break;
    case "assess": aiJob("assess", "assess", {}, async () => { await reloadPart("advisor"); }); break;
    case "atelier": openSheet({ type: "atelier", view: "home" }); reloadPart("notes").then(() => S.sheet?.type === "atelier" && renderSheet()); break;
    case "atelierGo": S.sheet.view = a.dataset.v; renderSheet(); $("#sheet .sheet-body") && ($("#sheet .sheet-body").scrollTop = 0); break;
    case "atelierHome": S.sheet.view = "home"; renderSheet(); break;
    case "advStop": S.adv.ctl?.abort(); break;
    case "fbMsg": { const id = +a.dataset.id; const v = a.dataset.v; const m = S.chat.find((x) => x.id === id); if (!m) break;
      if (m.feedback?.v === v) { S.adv.fbOpen = null; setFeedback(id, null); break; }
      S.adv.fbOpen = v === "down" ? id : null; S.adv.d.fbnote = ""; setFeedback(id, { v, why: v === "down" ? m.feedback?.why : undefined }); if (v === "up") toast(`${PERSONA.name} هياخد باله إن ده عجبك`); break; }
    case "fbWhy": setFeedback(+a.dataset.id, { why: a.dataset.w }); break;
    case "fbSave": { const id = +a.dataset.id; const note = String(S.adv.d.fbnote || "").trim().slice(0, 200); S.adv.fbOpen = null; S.adv.d.fbnote = ""; await setFeedback(id, note ? { note } : {}); toast("اتسجّل. هيتعلم منه في الرد الجاي"); break; }
    case "restudio": restudio(s.id); break;
    case "learnSave": { const v = num(s.d.dcap); if (v == null || v < 0 || v > 1) { toast("اكتب رقم من 0 لـ1 دولار"); break; }
      try { await q(sb.from("settings").update({ daily_learn: s.d.dlearn !== "off", daily_learn_cap_usd: v, updated_at: new Date().toISOString() }).eq("owner_id", uid())); await reloadPart("settings"); toast("اتحفظ"); renderSheet(); } catch (er) { toast("ماتحفظش: " + er.message); } break; }
    case "week": aiJob("week", "week", {}, async () => { await reloadPart("advisor"); }); break;
    case "weekTick": advWrite((x) => { const c = x.week?.checklist?.[+a.dataset.i]; if (c) c.done = !c.done; }); break;
    case "stepTick": advWrite((x) => { const gg = (x.goals || []).find((g) => g.id === a.dataset.g); const st = gg?.steps?.[+a.dataset.i]; if (st) { st.done = !st.done; act("step", { goal: gg.title, step: st.t, done: st.done }); } if (gg && gg.steps.every((z) => z.done)) gg.status = "done"; }); break;
    case "goalStatus": advWrite((x) => { const gg = (x.goals || []).find((g) => g.id === a.dataset.g); if (gg) { gg.status = a.dataset.s; act("goal_status", { goal: gg.title, status: gg.status }); } }); break;
    case "goalAdopt": advWrite((x) => { const sg = x.assessment?.suggestedGoals || []; const gg = sg[+a.dataset.i]; if (!gg) return; x.goals = (x.goals || []).concat([gg]); sg.splice(+a.dataset.i, 1); }, "اتضاف"); break;
    case "weekClose": weekClose(); break;
    case "weekCloseEarly": S.adv.early = true; render(); break;
    case "advAsk": advSend(a.dataset.q); break;
    case "advSend": advSend(); break;
    case "advPhotoX": delete S.pending["adv_photo"]; delete S.prev["adv_photo"]; render(); break;
    case "add": openSheet({ type: "add", step: "cat", d: { occasions: [], season: "كل المواسم" } }); break;
    case "addPerf": openSheet({ type: "add", step: "details", d: { category: "perfume", pstatus: "owned", ptype: "أصلي", role: "occasion", occasions: [], season: "كل المواسم" } }); break;
    case "toCat": s.step = "cat"; renderSheet(); break;
    case "toPhotos": s.step = "photos"; renderSheet(); break;
    case "toDetails": s.step = "details"; renderSheet(); break;
    case "saveItem": saveItem(a.dataset.an === "1"); break;
    case "close": case "scrim": closeSheet(); break;
    case "edit": { const it = item(s.id); if (!it) break; openSheet({ type: "add", id: it.id, step: it.category === "perfume" ? "details" : "photos", d: { ...it, occasions: [...(it.occasions || [])] } }); break; }
    case "analyze": analyze(s.id); break;
    case "worn": try { await q(sb.from("items").update({ last_worn: new Date().toISOString() }).eq("id", s.id)); await reloadPart("items"); act("worn", { id: s.id }); toast("اتسجلت"); renderSheet(); } catch (er) { toast("ماتسجلتش: " + er.message); } break;
    case "del": s.confirmDel = true; renderSheet(); $("#delBox")?.scrollIntoView({ block: "center" }); break;
    case "delNo": s.confirmDel = false; renderSheet(); break;
    case "delYes": try { const it = item(s.id); await q(sb.from("items").delete().eq("id", s.id)); await reloadPart("items"); act("item_deleted", { id: s.id, name: it?.name }); closeSheet(); toast("اتمسحت"); } catch (er) { toast("مااتمسحتش: " + er.message); } break;
    case "sheetProfile": { const p = S.profile || {}; openSheet({ type: "profile", d: { name: p.name || "", heightCm: p.heightCm ?? "", glasses: p.glasses || "yes" } }); break; }
    case "sheetMeasure": openSheet({ type: "measure", d: measToDraft(S.meas[0]) }); break;
    case "sheetBody": openSheet({ type: "body" }); break;
    case "sheetPerf": openSheet({ type: "perf", d: { perfumePrefs: S.profile?.perfumePrefs || "", perfumeRestock: S.profile?.perfumeRestock || "" } }); break;
    case "sheetSettings": openSheet({ type: "settings", d: { cap: String(S.settings?.monthly_cap_usd ?? 5), dlearn: S.settings?.daily_learn === false ? "off" : "on", dcap: String(S.settings?.daily_learn_cap_usd ?? 0.1) } }); reloadPart("usage").then(() => S.sheet?.type === "settings" && renderSheet()); break;
    case "sheetReview": openReview(); break;
    case "saveProfile": { const d = s.d; if (!String(d.name || "").trim() || !num(d.heightCm)) { toast("الاسم والطول لازمين"); break; }
      try { await q(sb.from("profiles").update({ name: String(d.name).trim(), height_cm: num(d.heightCm), glasses: d.glasses !== "no", updated_at: new Date().toISOString() }).eq("owner_id", uid())); await reloadPart("profile"); toast("اتحفظ"); closeSheet(); } catch (er) { toast("ماتحفظش: " + er.message); } break; }
    case "saveMeasure": if (await saveMeasFrom(s.d, $("#saveMeasure"))) { toast("المقاسات اتحفظت"); closeSheet(); } break;
    case "savePerf": try { const data = { ...(S.profile?._row?.data || {}), perfumePrefs: String(s.d.perfumePrefs || "").trim(), perfumeRestock: String(s.d.perfumeRestock || "").trim() }; await q(sb.from("profiles").update({ data, updated_at: new Date().toISOString() }).eq("owner_id", uid())); await reloadPart("profile"); toast("اتحفظ"); closeSheet(); } catch (er) { toast("ماتحفظش: " + er.message); } break;
    case "keySave": { const raw = String(s.d.key || ""); const m = raw.match(/sk-ant-[A-Za-z0-9_\-]+/); // keep only the key itself
      if (!m || m[0].length < 40) { s.d.keyMsg = "ده مش شكل مفتاح Anthropic. لازم يبدأ بـ sk-ant-"; s.d.keyOk = false; renderSheet(); break; }
      const b = $("#keySave"); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
      try { const { error } = await sb.rpc("set_anthropic_key", { k: m[0] }); if (error) throw error; s.d.key = ""; S.keyStatus = (await sb.rpc("anthropic_key_status")).data; s.d.keyMsg = "المفتاح اتحفظ. دوس «جرّبه» عشان تتأكد إنه شغال."; s.d.keyOk = true; }
      catch (er) { s.d.keyMsg = "ماتحفظش: " + er.message; s.d.keyOk = false; }
      renderSheet(); break; }
    case "keyTest": { const b = $("#keyTest"); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
      try { const r = await ai("ping"); s.d.keyMsg = `المفتاح شغال (${modelName(r.model)} · ${usd(r.cost_usd)})`; s.d.keyOk = true; } catch (er) { s.d.keyMsg = er.message; s.d.keyOk = false; }
      renderSheet(); break; }
    case "capSave": { const v = num(s.d.cap); if (v == null || v < 0 || v > 100) { toast("اكتب رقم من 0 لـ100"); break; }
      try { await q(sb.from("settings").upsert({ owner_id: uid(), monthly_cap_usd: v, updated_at: new Date().toISOString() })); S.settings = { ...(S.settings || {}), monthly_cap_usd: v }; toast("الحد اتحفظ"); renderSheet(); } catch (er) { toast("ماتحفظش: " + er.message); } break; }
    case "lessonDel": try { await q(sb.from("lessons").delete().eq("id", +a.dataset.id)); await reloadPart("lessons"); toast("الدرس اتمسح"); renderSheet(); } catch (er) { toast("مااتمسحش: " + er.message); } break;
    case "reviewAi": { const w = s.w; S.busyKey = "review"; S.lastErr.review = null; renderSheet();
      try { const r = await ai("review", { since: w.since }); S.state.review = r.review; toast(`${modelName(r.model)} · ${usd(r.cost_usd)}`); } catch (er) { S.lastErr.review = er.message; }
      finally { S.busyKey = null; if (S.sheet?.type === "review") renderSheet(); } break; }
    case "reviewCopy": { if (!s.data) break; let t = reviewText(s.data, s.w); const rv = S.state.review; if (rv && rv.since === s.w.since) t += `\n\nملخص المستشار:\n${rv.summary || ""}\nمحتاج يتصلح في المستشار:\n${(rv.fixAdvisor || []).map((x) => "- " + x).join("\n")}`;
      try { await navigator.clipboard.writeText(t); toast("اتنسخت. الزقها لـClaude في ميعاد المراجعة."); } catch { toast("النسخ ماشتغلش. جرّب تاني."); } break; }
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sheet) closeSheet(); });
boot();
