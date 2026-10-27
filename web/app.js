"use strict";

const OPTIONS = [
  { id: "dni",    label: "DNI/NIE",       color: "#0a7cff", tag: "ID",  hint: "8 dígitos + letra (DNI) o X/Y/Z + 7 dígitos + letra (NIE).", placeholder: "12345678Z" },
  { id: "isbn10", label: "ISBN-10",       color: "#9b59d0", tag: "10",  hint: "10 caracteres; el último puede ser X.",                      placeholder: "0306406152" },
  { id: "isbn13", label: "ISBN-13",       color: "#ff9500", tag: "13",  hint: "13 dígitos, empieza por 978 o 979.",                          placeholder: "9780306406157" },
  { id: "ean13",  label: "EAN-13",        color: "#22b573", tag: "EAN", hint: "13 dígitos de código de barras.",                             placeholder: "4006381333931" },
  { id: "iban",   label: "IBAN español",  color: "#e5484d", tag: "ES",  hint: "ES + 22 dígitos. Se admiten espacios.",                       placeholder: "ES91 2100 0418 4502 0005 1332" },
  { id: "luhn",   label: "Tarjeta (Luhn)", color: "#f5c400", tag: "💳", hint: "Número de tarjeta, 12 a 19 dígitos.",                         placeholder: "4539 1488 0343 6467" },
];

const $ = (id) => document.getElementById(id);
const app = $("app"), menu = $("menu"), ws = $("workspace");
const form = $("form"), input = $("value"), result = $("result");

let current = null;
let busy = false;
let wasmReadyResolve;
const wasmReady = new Promise((resolve) => { wasmReadyResolve = resolve; });

function notifyWasmReady() {
  if (window.Module && typeof window.Module.cwrap === "function") wasmReadyResolve(true);
}
window.addEventListener("validador-ready", notifyWasmReady);
// Cubre caso en que el módulo haya terminado de inicializarse antes de registrar listener.
notifyWasmReady();

/* ---------- Construir menú ---------- */
const buttons = OPTIONS.map((o) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "opt";
  b.dataset.id = o.id;

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = o.color;
  dot.textContent = o.tag;

  const txt = document.createElement("span");
  txt.textContent = o.label;

  b.append(dot, txt);
  b.addEventListener("click", () => select(o.id));
  menu.append(b);
  return b;
});

/* ---------- FLIP: mover elementos con transición fluida ---------- */
function flip(els, change, duration = 650) {
  const first = els.map((e) => e.getBoundingClientRect());
  change();
  els.forEach((e, i) => {
    const last = e.getBoundingClientRect();
    const dx = first[i].left - last.left;
    const dy = first[i].top - last.top;
    if (!dx && !dy) return;
    e.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Selección ---------- */
async function select(id) {
  if (busy) return;
  const opt = OPTIONS.find((o) => o.id === id);

  if (app.classList.contains("active")) {
    setCurrent(opt);
    return;
  }

  busy = true;
  const btn = buttons.find((b) => b.dataset.id === id);
  btn.classList.add("picked");
  app.classList.add("picking");
  await wait(550);

  flip([$("title"), ...buttons], () => {
    app.classList.remove("intro", "picking");
    app.classList.add("active");
    btn.classList.remove("picked");
  });

  setCurrent(opt, true);
  busy = false;
}

function setCurrent(opt, animate = false) {
  current = opt;
  buttons.forEach((b) => b.classList.toggle("current", b.dataset.id === opt.id));

  $("ws-title").textContent = opt.label;
  $("ws-hint").textContent = opt.hint;
  const icon = $("ws-icon");
  icon.style.background = opt.color;
  icon.textContent = opt.tag;
  input.placeholder = opt.placeholder;
  input.value = "";
  result.hidden = true;

  ws.hidden = false;
  if (animate) {
    ws.classList.remove("enter");
    void ws.offsetWidth;
    ws.classList.add("enter");
  }
  input.focus({ preventScroll: true });
}

/*
 * Interfaz C esperada:
 *   int validar(const char *tipo, const char *valor)
 * Devuelve 1 si válido y 0 si no válido.
 * El workflow debe exportar _validar y cwrap.
 */
let cValidate = null;
async function runValidator(type, value) {
  const ready = await Promise.race([
    wasmReady.then(() => true),
    wait(10000).then(() => false),
  ]);

  if (!ready || !window.Module || typeof window.Module.cwrap !== "function") {
    return { valid: false, message: "No se pudo cargar validador.wasm. Comprueba publicación y compilación." };
  }

  try {
    if (!cValidate) cValidate = window.Module.cwrap("validar", "number", ["string", "string"]);
    const valid = Number(cValidate(type, value)) === 1;
    return { valid, message: valid ? "Válido" : "No válido" };
  } catch (error) {
    console.error("Error al llamar a validador C:", error);
    return { valid: false, message: "Error al conectar con la función validar() de C. Comprueba su nombre y firma." };
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!current) return;
  const value = input.value.trim();
  if (!value) { input.focus(); return; }

  result.hidden = false;
  result.className = "result wait";
  result.textContent = "Validando…";

  const res = await runValidator(current.id, value);
  result.className = "result";
  result.classList.add(res.valid ? "ok" : "bad");
  result.textContent = res.message || (res.valid ? "Válido" : "No válido");
});
