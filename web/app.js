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

  // Ya en modo activo: solo cambiar de opción
  if (app.classList.contains("active")) {
    setCurrent(opt);
    return;
  }

  busy = true;
  const btn = buttons.find((b) => b.dataset.id === id);

  // 1) Se muestra solo la opción elegida
  btn.classList.add("picked");
  app.classList.add("picking");
  await wait(550);

  // 2) El resto se recoloca a la izquierda
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

/* ---------- Enlace con el script en C ----------
   Cuando exista el módulo C (p. ej. compilado a WebAssembly con Emscripten),
   expón: window.UniversalValidator = { validate(type, value) -> {valid, message} }
   Mientras tanto devuelve "pendiente".                                         */
async function runValidator(type, value) {
  if (window.UniversalValidator && typeof window.UniversalValidator.validate === "function") {
    return await window.UniversalValidator.validate(type, value);
  }
  return { pending: true };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!current) return;
  const value = input.value.trim();
  if (!value) { input.focus(); return; }

  const res = await runValidator(current.id, value);
  result.hidden = false;
  result.className = "result";

  if (res.pending) {
    result.classList.add("wait");
    result.textContent = "Script en C pendiente de conectar. Valor recibido: " + value;
  } else if (res.valid) {
    result.classList.add("ok");
    result.textContent = res.message || "Válido";
  } else {
    result.classList.add("bad");
    result.textContent = res.message || "No válido";
  }
});
