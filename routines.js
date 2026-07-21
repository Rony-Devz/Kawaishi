/* ============================================================================
   Kawaishi — TWO SLAPS feature (self-contained module).
   ----------------------------------------------------------------------------
   Model (per user, redesigned):
     - Two Slaps is ONE thing (the self-defense/"שתי סתירות" portion of the exam).
     - It is a PLAN = an ordered list of CATEGORIES, each holding EXERCISES
       (single techniques/drills, with steps).
     - There is a BANK (מאגר): a flat, searchable library of exercises you pick
       from. Seeded from the app data (self-defense + full technique catalog),
       the user can ADD custom exercises to it and REMOVE (hide) exercises.
     - All user data lives in localStorage and survives app updates.
       Hebrew-only UI.

   Depends on host globals via window.KEngine:
     { K, techById, illusFor, nameR, nameHe, openLightbox, closeModal, $ }
   (falls back to window.KAWAISHI where possible for headless testing).
   ========================================================================== */
(function () {
  "use strict";

  var LS = "kawaishi_twoslaps_v1";
  var DEFAULT_CATS = ["שבירות עורף", "אחיזות שוטר", "שבירות ידיים", "הפלות ושבירות"];

  function eng() { return window.KEngine || {}; }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function newGroupId() { return "c_" + Math.random().toString(36).slice(2, 8); }
  function newCustomId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ---------- persistence (localStorage, update-safe, cached) ---------- */
  var _state = null;
  function blankState() {
    return {
      version: 1,
      categories: DEFAULT_CATS.map(function (t) { return { id: newGroupId(), title: t, items: [] }; }),
      bankAdd: [],        // user custom exercises: { id, he, romaji, steps:[] }
      bankHidden: [],     // refs removed from the bank
      stepOverrides: {}   // ref -> [steps] override
    };
  }
  function normalize(s) {
    if (!s || typeof s !== "object" || !Array.isArray(s.categories)) return null;
    s.version = 1;
    if (!Array.isArray(s.bankAdd)) s.bankAdd = [];
    if (!Array.isArray(s.bankHidden)) s.bankHidden = [];
    if (!s.stepOverrides || typeof s.stepOverrides !== "object") s.stepOverrides = {};
    s.categories.forEach(function (c) {
      if (!c.id) c.id = newGroupId();
      if (typeof c.title !== "string") c.title = (c.title && c.title.he) || "";
      if (!Array.isArray(c.items)) c.items = [];
      c.items = c.items.filter(function (it) { return it && typeof it.ref === "string"; });
    });
    return s;
  }
  function load() {
    if (_state) return _state;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(LS)); } catch (e) { s = null; }
    s = normalize(s);
    if (!s) { s = blankState(); }
    _state = s; save(s);
    return s;
  }
  function save(s) { _state = s; try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

  /* ---------- exercise resolution ---------- */
  function customById(ref) {
    var id = ref.slice(7), s = load();
    for (var i = 0; i < s.bankAdd.length; i++) if (s.bankAdd[i].id === id) return s.bankAdd[i];
    return null;
  }
  function tsBank() { var b = window.KAWAISHI_TWOSLAPS; return (b && b.exercises) || []; }
  function tsById(ref) { var id = ref.slice(3), a = tsBank(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function sourceSteps(ref) {
    var E = eng(), K = E.K || window.KAWAISHI || {}, techById = E.techById || {};
    if (ref.indexOf("ts:") === 0) { var x = tsById(ref); return (x && x.steps) || []; }
    if (ref.indexOf("sd:") === 0) { var e = ((K.techniques && K.techniques.selfdef) || [])[+ref.slice(3)] || {}; return e.steps || []; }
    if (ref.indexOf("custom:") === 0) { var c = customById(ref); return (c && c.steps) || []; }
    var t = techById[ref] || {}; return t.steps || [];
  }
  function resolveRef(ref) {
    var E = eng(), K = E.K || window.KAWAISHI || {}, techById = E.techById || {};
    var s = load(), ov = s.stepOverrides[ref];
    var base;
    if (ref.indexOf("ts:") === 0) {
      var x = tsById(ref);
      base = { kind: "ts", ok: !!x, he: (x && x.he) || "", romaji: (x && x.romaji) || "", cat: (x && x.cat) || "" };
    } else if (ref.indexOf("sd:") === 0) {
      var e = ((K.techniques && K.techniques.selfdef) || [])[+ref.slice(3)] || {};
      base = { kind: "sd", ok: true, he: e.he || "", romaji: e.romaji || "", cat: (e.category && e.category.he) || "" };
    } else if (ref.indexOf("custom:") === 0) {
      var c = customById(ref);
      base = { kind: "custom", ok: !!c, he: (c && c.he) || "", romaji: (c && c.romaji) || "", cat: "" };
    } else {
      var t = techById[ref] || {};
      base = { kind: "tech", ok: !!techById[ref], he: t.he || "", romaji: t.r || t.romaji || "", cat: "" };
    }
    base.ref = ref;
    base.steps = (ov && ov.length) ? ov : sourceSteps(ref);
    return base;
  }

  /* ---------- the bank (flat, searchable) ---------- */
  function bankExercises() {
    var s = load(), hidden = {};
    s.bankHidden.forEach(function (r) { hidden[r] = 1; });
    var out = [];
    tsBank().forEach(function (ex) { var ref = "ts:" + ex.id; if (!hidden[ref]) out.push(resolveRef(ref)); });
    s.bankAdd.forEach(function (c) { var ref = "custom:" + c.id; if (!hidden[ref]) out.push(resolveRef(ref)); });
    return out;
  }
  function bankCount() { return bankExercises().length; }

  /* ---------- mutations ---------- */
  function mutate(fn) { var s = load(); fn(s); save(s); }
  function addToCategory(gi, ref) {
    var s = load(), c = s.categories[gi]; if (!c) return false;
    for (var i = 0; i < c.items.length; i++) if (c.items[i].ref === ref) return false; // no dup in same category
    c.items.push({ ref: ref }); save(s); return true;
  }
  function addCustomExercise(he, romaji, steps, gi) {
    var s = load();
    var ex = { id: newCustomId(), he: he, romaji: romaji || "", steps: steps || [] };
    s.bankAdd.push(ex);
    var ref = "custom:" + ex.id;
    if (typeof gi === "number" && gi >= 0 && s.categories[gi]) s.categories[gi].items.push({ ref: ref });
    save(s); return ref;
  }
  function removeFromBank(ref) {
    var s = load();
    if (ref.indexOf("custom:") === 0) {
      var id = ref.slice(7);
      s.bankAdd = s.bankAdd.filter(function (c) { return c.id !== id; });
    } else if (s.bankHidden.indexOf(ref) < 0) {
      s.bankHidden.push(ref);
    }
    s.categories.forEach(function (c) { c.items = c.items.filter(function (it) { return it.ref !== ref; }); });
    delete s.stepOverrides[ref];
    save(s);
  }

  /* ==========================================================================
     UI helpers
     ========================================================================== */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function host() { var E = eng(); return (E.$ ? E.$("#twoslapsView") : document.getElementById("twoslapsView")); }
  function q(sel) { var E = eng(); return (E.$ ? E.$(sel) : document.querySelector(sel)); }
  function closeSheet() { var E = eng(); if (E.closeModal) E.closeModal(); else { var m = q("#modal"); if (m) m.classList.remove("open"); } }
  function toast(msg) {
    var t = document.getElementById("ts-toast");
    if (!t) { t = document.createElement("div"); t.id = "ts-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "on";
    clearTimeout(t._t); t._t = setTimeout(function () { t.className = ""; }, 2200);
  }

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected || document.getElementById("ts-style")) { cssInjected = true; return; }
    var chevron = "url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%2393a1b2%27%20stroke-width%3D%273%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M6%209l6%206%206-6%27%2F%3E%3C%2Fsvg%3E\")";
    var css =
      "#twoslapsView{direction:rtl;text-align:right}" +
      ".ts-wrap{padding-bottom:26px;direction:rtl;text-align:right}" +
      ".ts-wrap input,.ts-wrap textarea,.ts-wrap select,#sheet input,#sheet textarea{direction:rtl;text-align:right}" +
      ".ts-intro{font-size:13px;color:var(--muted);line-height:1.6;margin:2px 0 12px}" +
      ".ts-note{background:rgba(224,169,85,.12);border:1px solid rgba(224,169,85,.4);color:var(--gold);border-radius:var(--r1);padding:9px 12px;font-size:12.5px;font-weight:700;line-height:1.5;margin:2px 0 14px}" +
      ".ts-topbtns{display:flex;gap:8px;margin-bottom:16px}" +
      ".ts-topbtns>button{flex:1}" +
      ".ts-cta{background:var(--accent);color:#0b0e13;border:none;border-radius:var(--r1);padding:12px;font-weight:800;font-family:var(--sans);font-size:14px;cursor:pointer}" +
      ".ts-cta.ts-ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}" +
      ".ts-btn{background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:7px 12px;font-size:12.5px;font-weight:700;font-family:var(--sans);cursor:pointer}" +
      ".ts-btn.ts-danger{color:var(--bad)}" +
      ".ts-empty{background:var(--card);border:1px dashed var(--line);border-radius:var(--r1);padding:16px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.6;margin:2px 0 4px}" +
      /* category (group) */
      ".ts-group{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);padding:12px;margin-bottom:12px}" +
      ".ts-group-head{display:flex;align-items:center;gap:6px;margin-bottom:12px}" +
      ".ts-input{width:100%;box-sizing:border-box;height:38px;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:0 12px;font-size:14px;font-family:var(--sans);font-weight:700}" +
      ".ts-group-head .ts-input{font-weight:800}" +
      ".ts-combo{position:relative;flex:1;min-width:0}" +
      ".ts-combo .ts-input{width:100%;padding-inline-end:34px}" +
      ".ts-combo-arrow{position:absolute;inset-inline-end:0;top:0;height:38px;width:34px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;padding:0}" +
      ".ts-combo-panel{position:absolute;z-index:60;top:calc(100% + 4px);inset-inline:0;background:var(--card2);border:1px solid var(--line2);border-radius:10px;padding:5px;max-height:210px;overflow-y:auto;box-shadow:0 12px 30px rgba(0,0,0,.5)}" +
      ".ts-combo-opt{padding:9px 11px;border-radius:8px;font-size:13.5px;font-weight:700;color:var(--txt);cursor:pointer;font-family:var(--sans)}" +
      ".ts-combo-opt:hover,.ts-combo-opt:active{background:var(--bg)}" +
      ".ts-combo-empty{padding:9px 11px;font-size:12px;color:var(--muted)}" +
      ".ts-iconbtn{background:var(--bg);border:1px solid var(--line);color:var(--muted);border-radius:9px;width:38px;height:38px;font-size:12px;cursor:pointer;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0}" +
      ".ts-iconbtn.ts-danger{color:var(--bad)}" +
      /* exercise item */
      ".ts-item{background:var(--card2);border:1px solid var(--line);border-radius:var(--r1);padding:11px 12px;margin-bottom:8px}" +
      ".ts-item-head{display:flex;align-items:center;gap:6px}" +
      ".ts-item-name{flex:1;min-width:0}" +
      ".ts-item-name b{font-size:14px;font-weight:800}" +
      ".ts-item-name span{display:block;font-size:11px;color:var(--muted);direction:ltr;text-align:right}" +
      ".ts-item-tools{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}" +
      ".ts-item-tools .ts-btn{padding:8px 14px}" +
      ".ts-steps-ta{width:100%;box-sizing:border-box;min-height:104px;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px;font-size:13px;line-height:1.7;font-family:var(--sans);margin-top:8px;resize:vertical}" +
      ".ts-cat-empty{font-size:12px;color:var(--muted);margin:2px 2px 10px}" +
      ".ts-additem{display:flex;gap:8px;margin-top:8px}" +
      ".ts-additem .ts-btn{flex:1}" +
      ".ts-saved{font-size:11px;color:var(--good);font-weight:700;height:14px;margin:0 2px 6px;text-align:left}" +
      /* sheet / bank */
      ".ts-sheet-title{font-size:20px;font-weight:800;margin:2px 0 4px}" +
      ".ts-sheet-sub{font-size:12px;color:var(--muted);margin-bottom:10px}" +
      ".ts-pick-list{margin-top:10px;max-height:60vh;overflow-y:auto}" +
      ".ts-bank-row{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px}" +
      ".ts-bank-name b{font-size:14px;font-weight:800}" +
      ".ts-bank-name span{display:block;font-size:11px;color:var(--muted);direction:ltr;text-align:right}" +
      ".ts-bank-acts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}" +
      ".ts-bank-acts .ts-btn{flex:1;min-width:88px}" +
      ".ts-bank-row.ts-added{opacity:.55}" +
      ".ts-bank-steps{margin-top:10px;border-top:1px solid var(--line);padding-top:9px}" +
      ".ts-bank-steps ol{margin:0;padding-inline-start:20px;font-size:13px;line-height:1.75;color:var(--txt);direction:rtl;text-align:right}" +
      ".ts-bank-steps li{margin-bottom:3px}" +
      ".ts-nosteps{color:var(--muted);font-size:12px}" +
      ".ts-bank-cats{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}" +
      ".ts-catchip{background:var(--bg);border:1px solid var(--line2);color:var(--txt);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:700;font-family:var(--sans);cursor:pointer}" +
      ".ts-catchip:hover,.ts-catchip:active{background:var(--card)}" +
      ".ts-catchip.ts-added{opacity:.5;pointer-events:none}" +
      ".ts-moveSel{appearance:none;-webkit-appearance:none;background:var(--bg) " + chevron + " no-repeat left 10px center;border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:8px 12px 8px 30px;font-size:12.5px;font-family:var(--sans)}" +
      /* toast */
      "#ts-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(10px);background:var(--card2);color:var(--txt);border:1px solid var(--line2);border-radius:999px;padding:10px 18px;font-size:13px;font-weight:700;font-family:var(--sans);box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:120}" +
      "#ts-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}";
    var st = document.createElement("style");
    st.id = "ts-style"; st.textContent = css;
    document.head.appendChild(st);
    cssInjected = true;
  }

  /* ==========================================================================
     Home = the plan (categories + exercises), editable inline.
     ========================================================================== */
  var saveTimer = null;

  function renderHome() {
    injectCSS();
    var h = host(); if (!h) return;
    var s = load();

    var html = '<div class="ts-wrap" dir="rtl">';
    html += '<div class="ts-intro">מארגנים טכניקות לקטגוריות ומתרגלים — הכול ברצף או טכניקה אחת בכל פעם. מוסיפים תרגילים מהמאגר או יוצרים חדשים.</div>';
    html += '<div class="ts-note">שים לב: כל ההסברים כתובים כברירת מחדל עבור מתאמן ימני (יד ימין).</div>';
    html += '<div class="ts-saved" id="tsSaved"></div>';
    html += '<div class="ts-topbtns">' +
      '<button class="ts-cta" data-act="addcat">+ קטגוריה</button>' +
      '<button class="ts-cta ts-ghost" data-act="openbank">מאגר (' + bankCount() + ')</button>' +
    '</div>';

    if (!s.categories.length) {
      html += '<div class="ts-empty">אין קטגוריות עדיין.<br>הוסף קטגוריה כדי להתחיל.</div>';
    }

    s.categories.forEach(function (c, gi) {
      html += '<div class="ts-group" data-gi="' + gi + '">';
      html += '<div class="ts-group-head">' +
        '<div class="ts-combo">' +
          '<input class="ts-input ts-combo-input" data-field="cattitle" autocomplete="off" value="' + esc(c.title || "") + '" placeholder="שם הקטגוריה">' +
          '<button type="button" class="ts-combo-arrow" data-act="comboToggle" tabindex="-1">▾</button>' +
          '<div class="ts-combo-panel" style="display:none"></div>' +
        '</div>' +
        '<button class="ts-iconbtn" data-act="catup" data-gi="' + gi + '" title="למעלה">▲</button>' +
        '<button class="ts-iconbtn" data-act="catdown" data-gi="' + gi + '" title="למטה">▼</button>' +
        '<button class="ts-iconbtn ts-danger" data-act="catdel" data-gi="' + gi + '" title="מחק קטגוריה">✕</button>' +
      '</div>';

      if (!c.items.length) {
        html += '<div class="ts-cat-empty">אין תרגילים בקטגוריה זו עדיין.</div>';
      }
      c.items.forEach(function (it, ii) {
        var r = resolveRef(it.ref);
        html += '<div class="ts-item" data-ii="' + ii + '">' +
          '<div class="ts-item-head">' +
            '<div class="ts-item-name"><b>' + esc(r.he || r.romaji || "—") + '</b>' + (r.romaji ? '<span>' + esc(r.romaji) + '</span>' : '') + '</div>' +
            '<button class="ts-iconbtn" data-act="itup" data-gi="' + gi + '" data-ii="' + ii + '" title="למעלה">▲</button>' +
            '<button class="ts-iconbtn" data-act="itdown" data-gi="' + gi + '" data-ii="' + ii + '" title="למטה">▼</button>' +
            '<button class="ts-iconbtn ts-danger" data-act="itdel" data-gi="' + gi + '" data-ii="' + ii + '" title="הסר מהקטגוריה">✕</button>' +
          '</div>' +
          '<div class="ts-item-tools"><button class="ts-btn" data-act="itsteps">שלבים ▾</button></div>' +
          '<div class="ts-steps-wrap" style="display:none"><textarea class="ts-steps-ta" data-field="steps" placeholder="שלב אחד בכל שורה">' + esc((r.steps || []).join("\n")) + '</textarea></div>' +
        '</div>';
      });

      html += '<div class="ts-additem">' +
        '<button class="ts-btn" data-act="addcustom" data-gi="' + gi + '">+ הוסף טכניקה</button>' +
        '<button class="ts-btn" data-act="addfrombank" data-gi="' + gi + '">בחר מהמאגר</button>' +
      '</div>';
      html += '</div>';
    });

    html += '</div>';
    h.innerHTML = html;
    h.onclick = onPlanClick;
    h.oninput = onPlanInput;
    h.onfocusin = function (e) { var c = e.target.closest(".ts-combo"); if (c && e.target.classList.contains("ts-combo-input")) openCombo(c); };
    if (!document._tsComboDoc) {
      document._tsComboDoc = true;
      document.addEventListener("click", function (e) { if (!e.target.closest(".ts-combo")) closeAllCombos(); });
    }
  }

  function flashSaved() {
    var s = document.getElementById("tsSaved"); if (!s) return;
    s.textContent = "נשמר ✓"; clearTimeout(s._t);
    s._t = setTimeout(function () { s.textContent = ""; }, 1200);
  }
  function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { collectFromDOM(); flashSaved(); }, 400); }

  function collectFromDOM() {
    var h = host(); if (!h) return; var s = load();
    h.querySelectorAll(".ts-group").forEach(function (gEl) {
      var gi = +gEl.getAttribute("data-gi"); var c = s.categories[gi]; if (!c) return;
      var t = gEl.querySelector('[data-field="cattitle"]'); if (t) c.title = t.value;
      gEl.querySelectorAll(".ts-item").forEach(function (iEl) {
        var ii = +iEl.getAttribute("data-ii"); var it = c.items[ii]; if (!it) return;
        var ta = iEl.querySelector('[data-field="steps"]'); if (!ta) return;
        var lines = ta.value.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
        var src = sourceSteps(it.ref);
        if (!lines.length || lines.join("\n") === src.join("\n")) delete s.stepOverrides[it.ref];
        else s.stepOverrides[it.ref] = lines;
      });
    });
    save(s);
  }

  function planMutate(fn) { collectFromDOM(); mutate(fn); renderHome(); }

  function onPlanInput(e) {
    var ci = e.target.closest(".ts-combo-input");
    if (ci) { var c = ci.closest(".ts-combo"), p = c.querySelector(".ts-combo-panel"); p.style.display = "block"; fillComboPanel(p, ci.value); }
    if (e.target.closest("[data-field]")) autosave();
  }

  function onPlanClick(e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act");
    var gi = b.hasAttribute("data-gi") ? +b.getAttribute("data-gi") : -1;
    var ii = b.hasAttribute("data-ii") ? +b.getAttribute("data-ii") : -1;

    if (act === "comboToggle") {
      var combo = b.closest(".ts-combo"), panel = combo.querySelector(".ts-combo-panel");
      if (panel.style.display === "block") panel.style.display = "none"; else openCombo(combo);
      return;
    }
    if (act === "comboPick") {
      var cmb = b.closest(".ts-combo"), input = cmb.querySelector(".ts-combo-input");
      input.value = b.textContent; cmb.querySelector(".ts-combo-panel").style.display = "none";
      collectFromDOM(); flashSaved(); return;
    }
    if (act === "addcat") { planMutate(function (s) { s.categories.push({ id: newGroupId(), title: "", items: [] }); }); return; }
    if (act === "openbank") { openBank(-1); return; }
    if (act === "catup") { planMutate(function (s) { if (gi > 0) { var t = s.categories[gi - 1]; s.categories[gi - 1] = s.categories[gi]; s.categories[gi] = t; } }); return; }
    if (act === "catdown") { planMutate(function (s) { if (gi < s.categories.length - 1) { var t = s.categories[gi + 1]; s.categories[gi + 1] = s.categories[gi]; s.categories[gi] = t; } }); return; }
    if (act === "catdel") {
      var cur = load(), has = cur.categories[gi] && cur.categories[gi].items.length;
      if (has && !window.confirm("למחוק את הקטגוריה וכל התרגילים שבה?")) return;
      planMutate(function (s) { s.categories.splice(gi, 1); });
      return;
    }
    if (act === "addfrombank") { collectFromDOM(); openBank(gi); return; }
    if (act === "addcustom") { collectFromDOM(); openCustomForm(gi); return; }
    if (act === "itsteps") { var w = b.closest(".ts-item").querySelector(".ts-steps-wrap"); if (w) w.style.display = (w.style.display === "none" ? "block" : "none"); return; }
    if (act === "itup") { planMutate(function (s) { var it = s.categories[gi].items; if (ii > 0) { var t = it[ii - 1]; it[ii - 1] = it[ii]; it[ii] = t; } }); return; }
    if (act === "itdown") { planMutate(function (s) { var it = s.categories[gi].items; if (ii < it.length - 1) { var t = it[ii + 1]; it[ii + 1] = it[ii]; it[ii] = t; } }); return; }
    if (act === "itdel") { planMutate(function (s) { s.categories[gi].items.splice(ii, 1); }); return; }
  }

  /* ---------- category-title combobox ---------- */
  function categoryNames() {
    var set = {}, out = [];
    function add(n) { n = (n || "").trim(); if (!n || set[n]) return; set[n] = 1; out.push(n); }
    DEFAULT_CATS.forEach(add);
    load().categories.forEach(function (c) { add(c.title); });
    return out;
  }
  function closeAllCombos(except) {
    var h = host(); if (!h) return;
    h.querySelectorAll(".ts-combo").forEach(function (c) {
      if (c === except) return;
      var p = c.querySelector(".ts-combo-panel"); if (p) p.style.display = "none";
    });
  }
  function fillComboPanel(panel, query) {
    var names = categoryNames(), qq = (query || "").trim().toLowerCase();
    if (qq) names = names.filter(function (n) { return n.toLowerCase().indexOf(qq) >= 0; });
    panel.innerHTML = names.length
      ? names.map(function (n) { return '<div class="ts-combo-opt" data-act="comboPick">' + esc(n) + '</div>'; }).join("")
      : '<div class="ts-combo-empty">אין קטגוריות תואמות — הקלד כדי ליצור חדשה</div>';
  }
  function openCombo(combo) {
    closeAllCombos(combo);
    var panel = combo.querySelector(".ts-combo-panel");
    fillComboPanel(panel, "");
    panel.style.display = "block";
  }

  /* ==========================================================================
     Bank (מאגר): flat searchable list. gi>=0 => "add into that category" mode.
     ========================================================================== */
  function openBank(gi) {
    var target = (typeof gi === "number" && gi >= 0) ? gi : -1;
    var s = load();
    var inCat = {};
    if (target >= 0 && s.categories[target]) s.categories[target].items.forEach(function (it) { inCat[it.ref] = 1; });

    function draw(qstr) {
      var qq = (qstr || "").trim().toLowerCase();
      var list = bankExercises();
      if (qq) list = list.filter(function (x) { return ((x.he || "") + " " + (x.romaji || "") + " " + (x.cat || "")).toLowerCase().indexOf(qq) >= 0; });
      list = list.slice(0, 80);
      if (!list.length) return '<div class="ts-empty">לא נמצאו תרגילים.</div>';
      return list.map(function (x) {
        var ref = esc(x.ref);
        var added = target >= 0 && inCat[x.ref];
        var acts = '';
        if (target >= 0) acts += '<button class="ts-btn" data-badd="' + ref + '">' + (added ? 'נוסף ✓' : 'הוסף') + '</button>';
        else acts += '<button class="ts-btn" data-baddcat="' + ref + '">+ הוסף לקטגוריה</button>';
        acts += '<button class="ts-btn ts-ghost" data-bsteps="' + ref + '">שלבים ▾</button>';
        acts += '<button class="ts-btn ts-danger" data-bdel="' + ref + '">מחק מהמאגר</button>';
        var stepsHtml = (x.steps && x.steps.length)
          ? '<ol>' + x.steps.map(function (sp) { return '<li>' + esc(sp) + '</li>'; }).join('') + '</ol>'
          : '<div class="ts-nosteps">אין שלבים לתרגיל זה.</div>';
        var catsHtml = '';
        if (target < 0) {
          var chips = s.categories.map(function (c, ci) {
            return '<button class="ts-catchip" data-addto="' + ci + '" data-ref="' + ref + '">' + esc(c.title || ('קטגוריה ' + (ci + 1))) + '</button>';
          }).join('');
          catsHtml = '<div class="ts-bank-cats" data-catsfor="' + ref + '" style="display:none">' +
            (chips || '<div class="ts-nosteps">אין קטגוריות — צור קטגוריה קודם.</div>') + '</div>';
        }
        return '<div class="ts-bank-row' + (added ? ' ts-added' : '') + '" data-row="' + ref + '">' +
          '<div class="ts-bank-name"><b>' + esc(x.he || x.romaji || x.ref) + '</b>' + (x.romaji ? '<span>' + esc(x.romaji) + '</span>' : '') + '</div>' +
          '<div class="ts-bank-acts">' + acts + '</div>' +
          catsHtml +
          '<div class="ts-bank-steps" data-stepsfor="' + ref + '" style="display:none">' + stepsHtml + '</div>' +
        '</div>';
      }).join("");
    }

    var sheet = q("#sheet"); if (!sheet) return;
    var title = target >= 0 ? "הוספה מהמאגר" : "מאגר התרגילים";
    var sub = target >= 0 ? ("מוסיפים לקטגוריה: " + esc((s.categories[target] && s.categories[target].title) || "—")) : (bankCount() + " תרגילים במאגר");
    sheet.innerHTML = '<button class="closex" data-close>×</button><div style="clear:both"></div>' +
      '<div class="ts-sheet-title">' + title + '</div>' +
      '<div class="ts-sheet-sub">' + sub + '</div>' +
      '<button class="ts-cta ts-ghost" id="tsBankNew" style="width:100%;margin-bottom:10px">+ תרגיל חדש למאגר</button>' +
      '<input class="ts-input" id="tsBankSearch" placeholder="חיפוש לפי שם או רומאג׳י…">' +
      '<div class="ts-pick-list" id="tsBankList">' + draw("") + '</div>';

    sheet.querySelector("#tsBankSearch").oninput = function (ev) { sheet.querySelector("#tsBankList").innerHTML = draw(ev.target.value); };
    sheet.querySelector("#tsBankNew").onclick = function () { openCustomForm(target); };
    sheet.querySelector("#tsBankList").onclick = function (ev) {
      var stb = ev.target.closest("[data-bsteps]");
      if (stb) {
        var sref = stb.getAttribute("data-bsteps");
        var box = sheet.querySelector('[data-stepsfor="' + cssq(sref) + '"]');
        if (box) { var open = box.style.display === "none"; box.style.display = open ? "block" : "none"; stb.textContent = open ? "שלבים ▴" : "שלבים ▾"; }
        return;
      }
      var acb = ev.target.closest("[data-baddcat]");
      if (acb) {
        var cref = acb.getAttribute("data-baddcat");
        var panel = sheet.querySelector('[data-catsfor="' + cssq(cref) + '"]');
        if (panel) panel.style.display = (panel.style.display === "none" ? "flex" : "none");
        return;
      }
      var chip = ev.target.closest("[data-addto]");
      if (chip) {
        var gi = parseInt(chip.getAttribute("data-addto"), 10);
        var pref = chip.getAttribute("data-ref");
        if (addToCategory(gi, pref)) { chip.classList.add("ts-added"); toast("נוסף לקטגוריה"); }
        else toast("כבר בקטגוריה");
        return;
      }
      var addb = ev.target.closest("[data-badd]");
      if (addb) {
        var ref = addb.getAttribute("data-badd");
        if (inCat[ref]) return;
        if (addToCategory(target, ref)) { inCat[ref] = 1; var row = sheet.querySelector('[data-row="' + cssq(ref) + '"]'); if (row) { row.classList.add("ts-added"); addb.textContent = "נוסף ✓"; } toast("נוסף לקטגוריה"); }
        return;
      }
      var delb = ev.target.closest("[data-bdel]");
      if (delb) {
        var dref = delb.getAttribute("data-bdel");
        if (!window.confirm("להסיר תרגיל זה מהמאגר?")) return;
        removeFromBank(dref);
        sheet.querySelector("#tsBankList").innerHTML = draw(sheet.querySelector("#tsBankSearch").value);
        toast("הוסר מהמאגר");
        return;
      }
    };
    sheet.querySelectorAll("[data-close]").forEach(function (bb) { bb.onclick = function () { closeSheet(); renderHome(); }; });
    q("#modal").classList.add("open");
  }
  function cssq(s) { return String(s).replace(/"/g, '\\"'); }

  function openCustomForm(gi) {
    var sheet = q("#sheet"); if (!sheet) return;
    var toCat = (typeof gi === "number" && gi >= 0);
    sheet.innerHTML = '<button class="closex" data-close>×</button><div style="clear:both"></div>' +
      '<div class="ts-sheet-title">תרגיל חדש</div>' +
      '<div class="ts-sheet-sub">' + (toCat ? "יתווסף למאגר וגם לקטגוריה" : "יתווסף למאגר") + '</div>' +
      '<label class="ts-lbl" style="display:block;font-size:11px;font-weight:800;color:var(--muted);margin:8px 2px 5px">שם (עברית)</label>' +
      '<input class="ts-input" id="tsCHe" placeholder="לדוגמה: שחרור מאחיזת יד">' +
      '<label class="ts-lbl" style="display:block;font-size:11px;font-weight:800;color:var(--muted);margin:8px 2px 5px">שם לועזי / רומאג׳י (רשות)</label>' +
      '<input class="ts-input" id="tsCRo" placeholder="Romaji (רשות)">' +
      '<label class="ts-lbl" style="display:block;font-size:11px;font-weight:800;color:var(--muted);margin:8px 2px 5px">שלבים (שורה לכל שלב, רשות)</label>' +
      '<textarea class="ts-steps-ta" id="tsCSteps" placeholder="שלב אחד בכל שורה"></textarea>' +
      '<div style="height:12px"></div><button class="ts-cta" id="tsCSave" style="width:100%">הוסף</button>';
    sheet.querySelectorAll("[data-close]").forEach(function (bb) { bb.onclick = function () { closeSheet(); renderHome(); }; });
    sheet.querySelector("#tsCSave").onclick = function () {
      var he = (sheet.querySelector("#tsCHe").value || "").trim();
      var ro = (sheet.querySelector("#tsCRo").value || "").trim();
      var steps = (sheet.querySelector("#tsCSteps").value || "").split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!he) { window.alert("יש להזין שם בעברית"); return; }
      addCustomExercise(he, ro, steps, toCat ? gi : undefined);
      closeSheet(); renderHome();
      toast(toCat ? "נוסף למאגר ולקטגוריה" : "נוסף למאגר");
    };
    q("#modal").classList.add("open");
  }

  /* ---------- public API ---------- */
  window.Routines = {
    renderHome: renderHome,
    openBank: openBank,
    LS_KEY: LS,
    load: load,
    save: save,
    resolveRef: resolveRef,
    bankExercises: bankExercises,
    bankCount: bankCount,
    addToCategory: addToCategory,
    addCustomExercise: addCustomExercise,
    removeFromBank: removeFromBank
  };
})();
