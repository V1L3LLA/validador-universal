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
const explanation = $("explanation");
const credits = $("credits");
const dniTools = $("dni-tools"), dniMode = $("dni-mode");

credits.addEventListener("animationend", () => credits.remove(), { once: true });

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
  dniTools.hidden = opt.id !== "dni";
  dniMode.value = "validate";
  const icon = $("ws-icon");
  icon.style.background = opt.color;
  icon.textContent = opt.tag;
  input.placeholder = opt.placeholder;
  input.value = "";
  result.hidden = true;
  explanation.hidden = true;

  ws.hidden = false;
  if (animate) {
    ws.classList.remove("enter");
    void ws.offsetWidth;
    ws.classList.add("enter");
  }
  input.focus({ preventScroll: true });
}

dniMode.addEventListener("change", () => {
  const calculating = dniMode.value === "calculate";
  input.placeholder = calculating ? "8 dígitos o X/Y/Z + 7 dígitos" : current.placeholder;
  $("ws-hint").textContent = calculating
    ? "Introduce solo los números del DNI o NIE, sin la letra."
    : current.hint;
});

/*
 * Interfaz C esperada:
 *   int validar(const char *tipo, const char *valor)
 * Devuelve 1 si válido y 0 si no válido.
 * El workflow debe exportar _validar y cwrap.
 */
let cValidate = null;
let cCalculate = null;
async function runValidator(type, value) {
  const ready = await Promise.race([
    wasmReady.then(() => true),
    wait(10000).then(() => false),
  ]);

  if (!ready || !window.Module || typeof window.Module.cwrap !== "function") {
    return { valid: false, message: "No se pudo cargar validador.wasm. Comprueba publicación y compilación." };
  }

  try {
    if (type === "dni" && dniMode.value === "calculate") {
      if (!cCalculate) cCalculate = window.Module.cwrap("calcular_control", "string", ["string"]);
      const letter = cCalculate(value);
      return letter
        ? { valid: true, message: `La letra de control es: ${letter}` }
        : { valid: false, message: "Introduce 8 dígitos (DNI) o el prefijo X/Y/Z y 7 dígitos (NIE)." };
    }

    if (!cValidate) cValidate = window.Module.cwrap("validar", "number", ["string", "string"]);
    const valid = Number(cValidate(type, value)) === 1;
    return { valid, message: valid ? "Válido" : "No válido" };
  } catch (error) {
    console.error("Error al llamar a validador C:", error);
    return { valid: false, message: "Error al conectar con la función validar() de C. Comprueba su nombre y firma." };
  }
}

function explainCalculation(type, value, valid, calculating = false) {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  const invalidFormat = (expected) =>
    `No se puede completar el cálculo: el formato debe cumplir ${expected}.`;

  if (type === "dni") {
    if (calculating) {
      let number;
      if (/^\d{8}$/.test(value)) {
        number = Number(value);
      } else if (/^[XYZ]\d{7}$/i.test(value)) {
        number = Number(({ X: "0", Y: "1", Z: "2" })[clean[0]] + clean.slice(1));
      } else {
        return invalidFormat("8 dígitos para DNI o X/Y/Z seguido de 7 dígitos para NIE");
      }
      const letter = "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23];
      return `Se divide ${number} entre 23. El resto es ${number % 23}, que corresponde a la letra ${letter}.`;
    }

    let number, entered;
    if (/^\d{8}[A-Z]$/i.test(value)) {
      number = Number(clean.slice(0, 8));
      entered = clean[8];
    } else if (/^[XYZ]\d{7}[A-Z]$/i.test(value)) {
      number = Number(({ X: "0", Y: "1", Z: "2" })[clean[0]] + clean.slice(1, 8));
      entered = clean[8];
    } else {
      return invalidFormat("8 dígitos y una letra para DNI, o X/Y/Z + 7 dígitos + una letra para NIE");
    }
    const expected = "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23];
    return `El resto de ${number} dividido entre 23 es ${number % 23}; la letra esperada es ${expected} y la introducida es ${entered}. ${valid ? "Coinciden." : "No coinciden."}`;
  }

  if (type === "ean13" || type === "isbn13") {
    if (!/^\d{13}$/.test(value)) return invalidFormat("13 dígitos, sin espacios ni guiones");
    if (type === "isbn13" && !/^(978|979)/.test(clean))
      return invalidFormat("13 dígitos y comenzar por 978 o 979");
    const sum = [...clean.slice(0, 12)].reduce((total, digit, i) =>
      total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
    const expected = (10 - (sum % 10)) % 10;
    return `Se suman los primeros 12 dígitos alternando pesos 1 y 3: ${sum}. El dígito de control esperado es ${expected}; el introducido es ${clean[12]}. ${valid ? "Coinciden." : "No coinciden."}`;
  }

  if (type === "isbn10") {
    if (!/^\d{9}[\dX]$/.test(clean)) return invalidFormat("9 dígitos y un dígito final o X");
    const values = [...clean.slice(0, 9)].map(Number);
    values.push(clean[9] === "X" ? 10 : Number(clean[9]));
    const sum = values.reduce((total, digit, i) => total + digit * (10 - i), 0);
    return `Se multiplican los dígitos por pesos del 10 al 1 y se suman: ${sum}. El ISBN-10 es válido si el total es divisible entre 11 (resto ${sum % 11}). ${valid ? "El resto es 0." : "El resto no es 0."}`;
  }

  if (type === "iban") {
    if (!/^ES\d{22}$/.test(clean)) return invalidFormat("ES seguido de 22 dígitos");
    const rearranged = clean.slice(4) + clean.slice(0, 4);
    const expanded = [...rearranged].map((char) =>
      /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char).join("");
    let remainder = 0;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
    return `Se reordenan los cuatro primeros caracteres al final y se calcula el módulo 97. El resto es ${remainder}; debe ser 1. ${valid ? "Por eso el IBAN es válido." : "Como el resto no es 1, el IBAN no es válido."}`;
  }

  if (type === "luhn") {
    if (!/^\d{12,19}$/.test(clean)) return invalidFormat("entre 12 y 19 dígitos");
    let sum = 0, double = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = Number(clean[i]);
      if (double) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      double = !double;
    }
    return `Se aplica Luhn: se duplican dígitos alternos desde la derecha y se suman los resultados. La suma es ${sum} (resto ${sum % 10} al dividir entre 10); debe ser múltiplo de 10. ${valid ? "Lo es." : "No lo es."}`;
  }

  return valid ? "El valor ha superado las comprobaciones del validador." : "El formato o el dígito de control no es válido.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!current) return;
  const value = input.value.trim();
  if (!value) { input.focus(); return; }

  result.hidden = false;
  result.className = "result wait";
  result.textContent = "Validando…";
  explanation.hidden = true;

  const res = await runValidator(current.id, value);
  result.className = "result";
  result.classList.add(res.valid ? "ok" : "bad");
  result.textContent = res.message || (res.valid ? "Válido" : "No válido");
  explanation.textContent = explainCalculation(
    current.id, value, res.valid, current.id === "dni" && dniMode.value === "calculate"
  );
  explanation.hidden = false;
});
