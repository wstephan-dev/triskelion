"use strict";

/* ===== Règles ===== */

const STORAGE_KEY = "triskelion.v1";
const MAX = 9;            // plafond normal du Triskelion
const DANGER_LIMIT = 30;  // garde-fou pour le Danger temporaire

// Disposition du cadran du jeu : Rage en haut à gauche, Fate en haut à droite, Danger en bas.
// Angle en degrés (0 = droite, sens horaire). Lettres grecques des icônes officielles.
const STATS = [
  // dir : sens de remplissage de la jauge (1 = horaire, -1 = anti-horaire), pour que + soit toujours à droite.
  { key: "rage", label: "Rage", greek: "Ω", angle: -150, dir: 1 },
  { key: "fate", label: "Fate", greek: "Ψ", angle: -30, dir: 1 },
  { key: "danger", label: "Danger", greek: "Λ", angle: 90, dir: -1 },
];
const ARGONAUT_COUNT = 4;

// Tableau du Danger massif (les effets se cumulent).
const MASSIVE_DANGER = [
  { at: 14, card: "You Died Horribly" },
  { at: 18, card: "Your Gruesome Death Becomes Legend" },
  { at: 21, card: "Your Death Transcends Reality" },
];

const OUTSIDE_BATTLE = "Hors combat : l'Argonaute meurt.";

/* ===== Données ===== */

const PALETTE = [
  "#d6a865", "#3fb39a", "#c8374a", "#4b93dc", "#8e6bd8",
  "#e07aa6", "#9bb24a", "#e5823a", "#e8dcc4", "#7d8aa3", "#5fc7d9",
];

const DEFAULT_STATE = {
  argonauts: [
    newArgonaut("Argonaute I", PALETTE[0]),
    newArgonaut("Argonaute II", PALETTE[1]),
    newArgonaut("Argonaute III", PALETTE[3]),
    newArgonaut("Argonaute IV", PALETTE[4]),
  ],
  wake: false,
};

function newArgonaut(name, color) {
  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
  return { id, name, color, portrait: null, danger: 0, fate: 0, rage: 0, dead: false };
}

const limitOf = (stat) => (stat === "danger" ? DANGER_LIMIT : MAX);
function clamp(v, stat) {
  const n = Number(v) | 0;
  return Math.max(0, Math.min(limitOf(stat), n));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const data = JSON.parse(raw);
    if (!Array.isArray(data.argonauts)) throw new Error("format");
    data.argonauts = data.argonauts.slice(0, ARGONAUT_COUNT).map((a) => ({
      ...newArgonaut("Argonaute", PALETTE[0]),
      ...a,
      danger: clamp(a.danger, "danger"), fate: clamp(a.fate, "fate"), rage: clamp(a.rage, "rage"),
    }));
    while (data.argonauts.length < ARGONAUT_COUNT) {
      const i = data.argonauts.length;
      data.argonauts.push(structuredClone(DEFAULT_STATE.argonauts[i]));
    }
    return data;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    toast("Mémoire pleine : impossible d'enregistrer. Utilisez des portraits plus légers.");
    return false;
  }
}

let state = load();

/* ===== Couleurs ===== */

// Texte foncé sur couleur claire, clair sur couleur foncée.
function onColor(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return "#1a1020";
  const lin = (c) => { c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
  return L > 0.22 ? "#1a1020" : "#fbf3e6";
}

/* ===== Géométrie SVG ===== */

const rad = (d) => (d * Math.PI) / 180;
const pt = (r, a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))];
const f = (n) => n.toFixed(2);

function sector(r1, r2, a0, a1) {
  const [x0, y0] = pt(r2, a0), [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r1, a1), [x3, y3] = pt(r1, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r2} ${r2} 0 ${large} 1 ${f(x1)} ${f(y1)}` +
         `L${f(x2)} ${f(y2)}A${r1} ${r1} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

const SPAN = 96, GAP = 2.2, R_IN = 76, R_OUT = 95, HUB = 34, R_NUM = 55, R_BADGE = 85.5, BADGE = 12.5;
const SEGMENTS = STATS.map((s) => {
  const start = s.angle - SPAN / 2;
  const step = SPAN / MAX;
  return Array.from({ length: MAX }, (_, i) =>
    sector(R_IN, R_OUT, start + i * step + GAP / 2, start + (i + 1) * step - GAP / 2));
});
// Chaque branche est coupée en deux zones tactiles : − côté début de jauge, + côté fin.
const HALF_CCW = STATS.map((s) => sector(HUB + 1, 101, s.angle - 60, s.angle));
const HALF_CW = STATS.map((s) => sector(HUB + 1, 101, s.angle, s.angle + 60));
const HIT_MINUS = STATS.map((s, i) => (s.dir > 0 ? HALF_CCW[i] : HALF_CW[i]));
const HIT_PLUS = STATS.map((s, i) => (s.dir > 0 ? HALF_CW[i] : HALF_CCW[i]));
const SIGN_GAP = 25; // distance des signes − / + de part et d'autre du chiffre

function lobesSVG(a) {
  return STATS.map((s, i) => {
    const v = a[s.key];
    const over = s.key === "danger" && v > MAX;
    const segs = SEGMENTS[i].map((d, k) => {
      const rank = s.dir > 0 ? k : MAX - 1 - k; // ordre de remplissage
      return `<path class="seg${rank < v ? "" : " off"}" d="${d}" fill="var(--${s.key})"/>`;
    }).join("");
    const [nx, ny] = pt(R_NUM, s.angle);
    // Médaillon de la lettre grecque, au départ de la jauge.
    const [gx, gy] = pt(R_BADGE, s.angle - 60);
    // Tangente au cercle dans le sens de remplissage : − avant le chiffre, + après.
    const tx = -Math.sin(rad(s.angle)) * s.dir, ty = Math.cos(rad(s.angle)) * s.dir;
    const gap = v >= 10 ? SIGN_GAP + 6 : SIGN_GAP;
    const [mx, my] = [nx - tx * gap, ny - ty * gap];
    const [px, py] = [nx + tx * gap, ny + ty * gap];
    const cls = ["lobe", s.key, v === MAX ? "max" : "", over ? "over" : ""].join(" ");
    return `
      <g class="${cls}" data-stat="${s.key}">
        <path class="hit" d="${HIT_MINUS[i]}" data-act="dec" data-stat="${s.key}" role="button" aria-label="${s.label} moins 1"/>
        <path class="hit" d="${HIT_PLUS[i]}" data-act="inc" data-stat="${s.key}" role="button" aria-label="${s.label} plus 1"/>
        ${segs}
        <text class="sign${v <= 0 ? " dim" : ""}" x="${f(mx)}" y="${f(my)}">−</text>
        <text class="sign plus" x="${f(px)}" y="${f(py)}">+</text>
        <circle class="badge" cx="${f(gx)}" cy="${f(gy)}" r="${BADGE}" fill="var(--${s.key})"/>
        <text class="greek" x="${f(gx)}" y="${f(gy + 0.8)}">${s.greek}</text>
        <text class="num" x="${f(nx)}" y="${f(ny)}">${v}</text>
      </g>`;
  }).join("") + settleSVG(a);
}

// Danger temporaire > 9 : le centre du cadran devient le bouton « Résolu → 9 ».
function settleSVG(a) {
  if (a.danger <= MAX) return "";
  return `
    <g class="settle" data-act="settle" role="button" aria-label="Danger ${a.danger} résolu, ramener à 9">
      <circle r="${HUB + 1}"/>
      <text class="settle-top" y="-9">Résolu</text>
      <text class="settle-num" y="9">→ 9</text>
    </g>`;
}

function hubSVG(a) {
  if (a.portrait) {
    return `
      <clipPath id="clip-${a.id}"><circle r="${HUB}"/></clipPath>
      <circle class="hub-bg" r="${HUB}"/>
      <image href="${a.portrait}" x="${-HUB}" y="${-HUB}" width="${HUB * 2}" height="${HUB * 2}"
             preserveAspectRatio="xMidYMin slice" clip-path="url(#clip-${a.id})"/>
      <circle class="hub-ring" r="${HUB}"/>`;
  }
  return `
    <circle class="hub-disk" r="${HUB}"/>
    <circle class="hub-dots" r="${HUB - 4}"/>
    <g class="spiral"><use href="#triskele" x="-27" y="-27" width="54" height="54" transform="rotate(30)"/></g>
    <path class="hub-tri" d="M-7 -4 L7 -4 L0 8 Z"/>
    <circle class="hub-ring" r="${HUB}"/>`;
}

/* ===== Rendu ===== */

const board = document.getElementById("board");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function cardHTML(a) {
  const style = `--c:${a.color};--on-c:${onColor(a.color)};${a.portrait ? `--portrait:url('${a.portrait}')` : ""}`;
  return `
    <article class="card${a.portrait ? " has-portrait" : ""}${a.dead ? " dead" : ""}" data-id="${a.id}" style="${style}">
      <div class="card-body">
      <div class="card-head">
        <button type="button" class="name-btn" data-act="edit" aria-label="Modifier ${esc(a.name)}">
          <span class="name">${esc(a.name)}</span>
          <svg class="pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3Zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7 1.9-1.7Z"/></svg>
        </button>
        <button type="button" class="icon-btn" data-act="reset" aria-label="Remettre ${esc(a.name)} à zéro">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1-7.7 10h2.1A6 6 0 1 0 8 7.5L10.5 10H4V3.5l2.6 2.6A8 8 0 0 1 12 4Z"/></svg>
        </button>
      </div>
      <div class="emblem-wrap">
        <svg class="emblem" viewBox="-101 -101 202 202" preserveAspectRatio="xMidYMid meet">
          <circle class="dial" r="${R_OUT + 4}"/>
          <circle class="rim" r="${R_OUT + 4}"/>
          <circle class="rim-in" r="${R_IN - 4}"/>
          <g class="hub" pointer-events="none">${hubSVG(a)}</g>
          <g class="lobes">${lobesSVG(a)}</g>
        </svg>
      </div>
      </div>
      ${a.dead ? `<div class="sash" aria-label="${esc(a.name)} est mort"><span>† Mort †</span></div>` : ""}
    </article>`;
}

function render() {
  board.innerHTML = state.argonauts.map(cardHTML).join("");
  wakeBtn.setAttribute("aria-pressed", String(!!state.wake));
}

// Mise à jour légère : seuls les chiffres et les boutons changent, le portrait n'est pas recréé.
function update(a, effect) {
  const card = board.querySelector(`.card[data-id="${a.id}"]`);
  if (!card) return render();
  card.querySelector(".lobes").innerHTML = lobesSVG(a);
  if (effect) card.querySelector(`.lobe[data-stat="${effect.stat}"]`)?.classList.add(effect.cls);
}

/* ===== Actions ===== */

const byId = (id) => state.argonauts.find((a) => a.id === id);

function change(a, stat, delta) {
  const cur = a[stat];
  const next = cur + delta;
  if (next < 0) return;

  if (delta > 0 && cur >= MAX) {
    if (stat === "fate") {
      alertOver("<b>Fate au-delà de 9</b> : en combat, piochez une carte Moiros (une 2<sup>e</sup> dans le même combat = mort). " + OUTSIDE_BATTLE);
      return update(a, { stat, cls: "shake" });
    }
    if (stat === "rage") {
      alertOver("<b>Rage au-delà de 9</b> : le Titan meurt à la fin de l'action en cours. " + OUTSIDE_BATTLE);
      return update(a, { stat, cls: "shake" });
    }
    if (next > DANGER_LIMIT) return update(a, { stat, cls: "shake" });
  }

  a[stat] = next;
  save();

  if (stat === "danger" && next > MAX && delta > 0) {
    const cards = MASSIVE_DANGER.filter((m) => next >= m.at).map((m) => `« ${m.card} »`);
    let msg = `<b>Danger ${next}</b> : pioche Trauma/Obole résolue comme Danger ${next}, puis Danger revient à 9.`;
    if (cards.length) msg += ` Ajoutez au deck Obole : ${cards.join(", ")}.`;
    if (cur <= MAX) msg += " " + OUTSIDE_BATTLE;
    alertOver(msg);
  } else {
    buzz(8);
  }
  update(a, { stat, cls: "bump" });
}

// Bref éclair sur la zone touchée (le cadran est redessiné à chaque appui).
function flash(card, stat, act) {
  const zone = card.querySelector(`.hit[data-stat="${stat}"][data-act="${act}"]`);
  if (!zone) return;
  zone.classList.add("pressed");
  setTimeout(() => zone.classList.remove("pressed"), 140);
}

function alertOver(html) {
  buzz([30, 40, 30]);
  toast(html, 5500);
}

board.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");

  const card = e.target.closest(".card");
  if (!card) return;
  const a = byId(card.dataset.id);
  if (!a) return;

  if (!btn) return;

  // Un Argonaute mort ne peut plus être modifié (sauf via sa fiche).
  if (a.dead && btn.dataset.act !== "edit") return;

  switch (btn.dataset.act) {
    case "inc":
    case "dec": {
      const act = btn.dataset.act, stat = btn.dataset.stat;
      change(a, stat, act === "inc" ? +1 : -1);
      flash(card, stat, act);
      return;
    }
    case "settle":
      a.danger = MAX;
      save();
      buzz(8);
      return update(a, { stat: "danger", cls: "bump" });
    case "edit": return openEditor(a);
    case "reset":
      return confirmAction(`Remettre le Triskelion de ${a.name} à zéro ?`, "Remettre à zéro", () => {
        a.danger = a.fate = a.rage = 0;
        save();
        update(a);
      });
  }
});

document.getElementById("resetAllBtn").addEventListener("click", () => {
  confirmAction("Fin du combat : remettre Danger, Fate et Rage de tous les Argonautes à 0 ?", "Tout remettre à 0", () => {
    state.argonauts.forEach((a) => { a.danger = a.fate = a.rage = 0; });
    save();
    render();
  });
});

/* ===== Édition ===== */

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const nameInput = document.getElementById("nameInput");
const swatches = document.getElementById("swatches");
const portraitPreview = document.getElementById("portraitPreview");
const portraitInput = document.getElementById("portraitInput");
const portraitClear = document.getElementById("portraitClear");
let editing = null, pickedColor = null, pickedPortrait = null;

function drawPreview() {
  portraitPreview.style.setProperty("--c", pickedColor);
  portraitPreview.style.backgroundImage = pickedPortrait ? `url('${pickedPortrait}')` : "";
  portraitPreview.innerHTML = pickedPortrait ? "" :
    `<svg viewBox="-50 -50 100 100"><use href="#triskele" x="-50" y="-50" width="100" height="100"/></svg>`;
  portraitClear.hidden = !pickedPortrait;
}

function drawSwatches() {
  const isCustom = !PALETTE.includes(pickedColor);
  swatches.innerHTML = PALETTE.map((c) => `
    <button type="button" class="swatch" role="radio" style="--sw:${c}" data-color="${c}"
      aria-checked="${c === pickedColor}" aria-label="Couleur ${c}"></button>`).join("") + `
    <label class="swatch custom" role="radio" aria-checked="${isCustom}" style="--sw:${pickedColor}" aria-label="Couleur personnalisée">
      <input type="color" value="${pickedColor}">
    </label>`;
}

swatches.addEventListener("click", (e) => {
  const sw = e.target.closest("button.swatch");
  if (!sw) return;
  pickedColor = sw.dataset.color;
  drawSwatches();
  drawPreview();
});
swatches.addEventListener("input", (e) => {
  if (e.target.type !== "color") return;
  pickedColor = e.target.value;
  swatches.querySelectorAll("button.swatch").forEach((b) => b.setAttribute("aria-checked", "false"));
  const custom = swatches.querySelector(".custom");
  custom.setAttribute("aria-checked", "true");
  custom.style.setProperty("--sw", pickedColor);
  drawPreview();
});

// Réduit l'image choisie (photo de la carte portrait, image enregistrée…) pour tenir dans le stockage local.
async function shrinkImage(file, maxSide = 420) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

portraitInput.addEventListener("change", async () => {
  const file = portraitInput.files && portraitInput.files[0];
  portraitInput.value = "";
  if (!file) return;
  try {
    pickedPortrait = await shrinkImage(file);
    drawPreview();
  } catch {
    toast("Cette image n'a pas pu être lue. Essayez un fichier JPEG ou PNG.");
  }
});
portraitClear.addEventListener("click", () => { pickedPortrait = null; drawPreview(); });

function openEditor(a) {
  editing = a;
  pickedColor = a.color;
  pickedPortrait = a.portrait;
  nameInput.value = a.name;
  drawSwatches();
  drawPreview();
  drawDeathBtn();
  editDialog.showModal();
}

editForm.addEventListener("submit", () => {
  const before = { name: editing.name, color: editing.color, portrait: editing.portrait };
  editing.name = nameInput.value.trim() || editing.name;
  editing.color = pickedColor;
  editing.portrait = pickedPortrait;
  // Annule si le stockage est plein.
  if (!save()) Object.assign(editing, before);
  render();
});

document.getElementById("cancelBtn").addEventListener("click", () => editDialog.close());

/* ===== Mort / retour à la vie ===== */

const deathBtn = document.getElementById("deathBtn");
function drawDeathBtn() {
  deathBtn.textContent = editing.dead ? "Ramener à la vie" : "† Déclarer mort";
  deathBtn.classList.toggle("revive", !!editing.dead);
}

deathBtn.addEventListener("click", () => {
  const a = editing;
  editDialog.close();
  if (a.dead) {
    confirmAction(`Ramener ${a.name} à la vie ? Son Triskelion est conservé.`, "Ramener à la vie", () => {
      a.dead = false;
      save();
      render();
    });
  } else {
    confirmAction(`Déclarer ${a.name} mort ? Son cadran sera verrouillé.`, "Déclarer mort", () => {
      a.dead = true;
      save();
      buzz([60, 60, 120]);
      render();
    });
  }
});

/* ===== Confirmation ===== */

const confirmDialog = document.getElementById("confirmDialog");
let onConfirm = null;
function confirmAction(text, okLabel, fn) {
  document.getElementById("confirmText").textContent = text;
  document.getElementById("confirmYes").textContent = okLabel;
  onConfirm = fn;
  confirmDialog.returnValue = "";
  confirmDialog.showModal();
}
confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue === "yes" && onConfirm) onConfirm();
  onConfirm = null;
});

// Fermer une fiche en touchant le fond.
for (const d of [editDialog, confirmDialog]) {
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
}

/* ===== Retours ===== */

const toastEl = document.getElementById("toast");
let toastTimer;
function toast(html, ms = 3000) {
  toastEl.innerHTML = html;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}
toastEl.addEventListener("click", () => toastEl.classList.remove("show"));
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch { /* ignoré */ } }

/* ===== Écran toujours allumé ===== */

const wakeBtn = document.getElementById("wakeBtn");
let wakeLock = null;

async function applyWake() {
  if (!("wakeLock" in navigator)) return;
  try {
    if (state.wake && document.visibilityState === "visible" && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!state.wake && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* refusé (batterie faible, etc.) */ }
}

wakeBtn.addEventListener("click", () => {
  if (!("wakeLock" in navigator)) {
    toast("Ce navigateur ne permet pas de garder l'écran allumé.");
    return;
  }
  state.wake = !state.wake;
  save();
  wakeBtn.setAttribute("aria-pressed", String(state.wake));
  toast(state.wake ? "L'écran restera allumé." : "Mise en veille normale.");
  applyWake();
});

/* ===== Persistance à la mise en veille / au retour ===== */

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
  else {
    // Si un autre onglet a modifié les valeurs entre-temps, on recharge.
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* ignoré */ }
    if (raw && raw !== JSON.stringify(state) && !editDialog.open) {
      state = load();
      render();
    }
    applyWake();
  }
});
window.addEventListener("pagehide", save);
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && !editDialog.open) { state = load(); render(); }
});

/* ===== Démarrage ===== */

render();
applyWake();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
