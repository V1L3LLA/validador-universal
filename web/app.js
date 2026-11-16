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
const correctControlButton = $("correct-control");
const correctionResult = $("correction-result");
const credits = $("credits");
const controlTools = $("control-tools"), dniMode = $("dni-mode");
const validatorView = $("validator-view"), experimentView = $("experiment-view");
const experimentFormat = $("experiment-format"), experimentError = $("experiment-error");
const experimentFormatHint = $("experiment-format-hint");
const experimentButton = $("run-experiment");
const experimentCount = $("experiment-count");
const experimentStatus = $("experiment-status");
const experimentResult = $("experiment-result");
const howContent = $("how-content");

const HOW_INFO = {
  dni: "DNI/NIE — Se divide el número entre 23. El resto, entre 0 y 22, indica una posición en la secuencia TRWAGMYFPDXBNJZSQVHLCKE y determina la letra de control. Para el NIE, X, Y y Z se sustituyen por 0, 1 y 2 antes de dividir.",
  isbn10: "ISBN-10 — Se multiplica cada dígito por un peso descendente del 10 al 1 y se suman los productos. El código es válido si la suma es divisible entre 11. La X final representa el valor 10.",
  isbn13: "ISBN-13 — Se multiplican los primeros 12 dígitos alternando pesos 1 y 3. El control es el dígito que completa la suma hasta un múltiplo de 10. Un ISBN-13 empieza por 978 o 979.",
  ean13: "EAN-13 — Se multiplican los primeros 12 dígitos alternando pesos 1 y 3. El último dígito completa la suma hasta un múltiplo de 10.",
  iban: "IBAN español — Se mueven los cuatro primeros caracteres al final y se convierten las letras en números (A=10, B=11, …). El IBAN es válido si el número resultante deja resto 1 al dividir entre 97.",
  luhn: "Tarjeta (Luhn) — Desde la derecha se duplican dígitos alternos; si un resultado supera 9, se le resta 9. Se suman los valores y el número pasa Luhn si el total es múltiplo de 10."
};

credits.addEventListener("animationend", () => credits.remove(), { once: true });

let current = null;
let lastInvalidValue = null;
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

const experimentMenuButton = document.createElement("button");
experimentMenuButton.type = "button";
experimentMenuButton.className = "opt experiment-menu-option";
experimentMenuButton.dataset.id = "experiment";
const experimentMenuTag = document.createElement("span");
experimentMenuTag.className = "dot";
experimentMenuTag.textContent = "EXP";
const experimentMenuLabel = document.createElement("span");
experimentMenuLabel.textContent = "Modo experimento";
experimentMenuButton.append(experimentMenuTag, experimentMenuLabel);
experimentMenuButton.addEventListener("click", () => select("experiment"));
menu.append(experimentMenuButton);

OPTIONS.forEach((option) => {
  const item = document.createElement("option");
  item.value = option.id;
  item.textContent = option.label;
  experimentFormat.append(item);
});

function updateHowContent(type) {
  howContent.textContent = HOW_INFO[type] || "";
}

function selectExperimentFormat() {
  const option = OPTIONS.find((item) => item.id === experimentFormat.value);
  if (!option) return;
  experimentResult.hidden = true;
  experimentStatus.textContent = "";
  $("ws-title").textContent = `Experimento · ${option.label}`;
  $("ws-icon").style.background = option.color;
  $("ws-icon").textContent = option.tag;
  experimentFormatHint.textContent = `Se probará: ${option.label}. Se generarán ejemplos sintéticos y se comprobará si el algoritmo detecta el error seleccionado.`;
  updateHowContent(option.id);
}
experimentFormat.addEventListener("change", selectExperimentFormat);
experimentError.addEventListener("change", () => {
  experimentResult.hidden = true;
  experimentStatus.textContent = "";
});
experimentCount.addEventListener("input", () => {
  experimentResult.hidden = true;
  experimentStatus.textContent = "";
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
  const opt = id === "experiment" ? null : OPTIONS.find((o) => o.id === id);

  if (app.classList.contains("active")) {
    if (id === "experiment") setExperimentMode();
    else if (opt) setCurrent(opt);
    return;
  }

  busy = true;
  const btn = id === "experiment"
    ? experimentMenuButton
    : buttons.find((b) => b.dataset.id === id);
  btn.classList.add("picked");
  app.classList.add("picking");
  await wait(550);

  flip([$("title"), ...buttons, experimentMenuButton], () => {
    app.classList.remove("intro", "picking");
    app.classList.add("active");
    btn.classList.remove("picked");
  });

  if (id === "experiment") setExperimentMode(true);
  else setCurrent(opt, true);
  busy = false;
}

function setCurrent(opt, animate = false) {
  current = opt;
  lastInvalidValue = null;
  correctControlButton.hidden = true;
  correctionResult.hidden = true;
  buttons.forEach((b) => b.classList.toggle("current", b.dataset.id === opt.id));
  experimentMenuButton.classList.remove("current");
  validatorView.hidden = false;
  experimentView.hidden = true;

  $("ws-title").textContent = opt.label;
  $("ws-hint").textContent = opt.hint;
  $("ws-hint").hidden = false;
  dniMode.value = "validate";
  controlTools.hidden = false;
  const icon = $("ws-icon");
  icon.style.background = opt.color;
  icon.textContent = opt.tag;
  input.placeholder = opt.placeholder;
  $("form").querySelector("button[type=submit]").textContent = "Validar";
  input.value = "";
  result.hidden = true;
  explanation.hidden = true;
  updateHowContent(opt.id);

  ws.hidden = false;
  if (animate) {
    ws.classList.remove("enter");
    void ws.offsetWidth;
    ws.classList.add("enter");
  }
  input.focus({ preventScroll: true });
}

function setExperimentMode(animate = false) {
  current = null;
  lastInvalidValue = null;
  correctControlButton.hidden = true;
  correctionResult.hidden = true;
  buttons.forEach((b) => b.classList.remove("current"));
  experimentMenuButton.classList.add("current");
  validatorView.hidden = true;
  experimentView.hidden = false;
  $("ws-hint").hidden = true;
  dniMode.value = "validate";
  experimentResult.hidden = true;
  experimentStatus.textContent = "";
  experimentFormat.value = "dni";
  selectExperimentFormat();
  ws.hidden = false;
  if (animate) {
    ws.classList.remove("enter");
    void ws.offsetWidth;
    ws.classList.add("enter");
  }
}

dniMode.addEventListener("change", () => {
  lastInvalidValue = null;
  correctControlButton.hidden = true;
  correctionResult.hidden = true;
  const calculating = dniMode.value === "calculate";
  const calculateOptions = {
    dni: ["8 dígitos o X/Y/Z + 7 dígitos", "Introduce el número sin la letra final. Para NIE, incluye X, Y o Z."],
    isbn10: ["9 dígitos", "Introduce los primeros 9 dígitos del ISBN-10."],
    isbn13: ["12 dígitos (978 o 979…)", "Introduce los primeros 12 dígitos del ISBN-13."],
    ean13: ["12 dígitos", "Introduce los primeros 12 dígitos del EAN-13."],
    iban: ["ES + 20 dígitos", "Introduce ES seguido de los 20 dígitos de la cuenta, sin los dos dígitos de control."],
    luhn: ["11–18 dígitos", "Introduce el número de tarjeta sin su último dígito."]
  };
  input.placeholder = calculating ? calculateOptions[current.id][0] : current.placeholder;
  $("ws-hint").textContent = calculating ? calculateOptions[current.id][1] : current.hint;
  $("form").querySelector("button[type=submit]").textContent = calculating ? "Calcular" : "Validar";
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
    if (dniMode.value === "calculate") {
      if (!cCalculate) cCalculate = window.Module.cwrap("calcular_digito", "string", ["string", "string"]);
      const control = cCalculate(type, value);
      if (!control) return { valid: false, message: "El valor no tiene el formato necesario para calcular su control." };
      const message = type === "iban"
        ? `Dígitos de control: ${control}. IBAN resultante: ${value.replace(/[\s-]/g, "").slice(0, 2)}${control}${value.replace(/[\s-]/g, "").slice(2)}`
        : `Dígito de control calculado: ${control}.`;
      return { valid: true, message, control };
    }

    if (!cValidate) cValidate = window.Module.cwrap("validar", "number", ["string", "string"]);
    const valid = Number(cValidate(type, value)) === 1;
    return { valid, message: valid ? "Válido" : "No válido" };
  } catch (error) {
    console.error("Error al llamar a validador C:", error);
    return { valid: false, message: "Error al conectar con la función validar() de C. Comprueba su nombre y firma." };
  }
}

function hasCorrectableControlFormat(type, value) {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  switch (type) {
    case "dni": return /^\d{8}[A-Z]$/i.test(value) || /^[XYZ]\d{7}[A-Z]$/i.test(value);
    case "isbn10": return /^\d{9}[\dX]$/.test(clean);
    case "isbn13": return /^(978|979)\d{10}$/.test(value);
    case "ean13": return /^\d{13}$/.test(value);
    case "iban": return /^ES\d{22}$/.test(clean);
    case "luhn": return /^\d{12,19}$/.test(clean);
    default: return false;
  }
}

async function correctControlDigit() {
  if (!lastInvalidValue) return;
  correctionResult.hidden = false;
  correctionResult.textContent = "Recalculando el dígito de control…";

  try {
    if (!cCalculate)
      cCalculate = window.Module.cwrap("calcular_digito", "string", ["string", "string"]);

    const { type, value } = lastInvalidValue;
    const clean = value.replace(/[\s-]/g, "").toUpperCase();
    let payload, corrected, controlName;

    if (type === "dni") {
      payload = clean.slice(0, -1);
      controlName = "la letra de control";
    } else if (type === "isbn10") {
      payload = clean.slice(0, 9);
      controlName = "el carácter de control";
    } else if (type === "isbn13" || type === "ean13") {
      payload = clean.slice(0, 12);
      controlName = "el dígito de control";
    } else if (type === "iban") {
      payload = `ES${clean.slice(4)}`;
      controlName = "los dos dígitos de control";
    } else {
      payload = clean.slice(0, -1);
      controlName = "el dígito de control Luhn";
    }

    const control = cCalculate(type, payload);
    if (!control) throw new Error("No se pudo calcular el control para este formato.");
    corrected = type === "iban"
      ? `ES${control}${clean.slice(4)}`
      : `${payload}${control}`;
    if (!cValidate || Number(cValidate(type, corrected)) !== 1)
      throw new Error("El control recalculado no ha superado la validación.");

    input.value = corrected;
    result.className = "result ok";
    result.textContent = "Control recalculado; el valor resultante supera la comprobación matemática.";
    explanation.textContent += `\n\nSe ha sustituido únicamente el control por ${control}. El resto de los datos no se ha modificado.`;
    correctionResult.textContent = [
      `Valor con ${controlName} recalculado: ${corrected}.`,
      `Se ha sustituido únicamente ${controlName}; el resto del valor se ha mantenido tal como se introdujo.`,
      "Se asume que los demás dígitos son correctos. Si el error está en el número base, recalcular el control no lo corrige.",
      "El resultado solo supera la comprobación matemática; no confirma que el documento, ISBN, cuenta o tarjeta exista."
    ].join("\n");
    correctControlButton.hidden = true;
    lastInvalidValue = null;
  } catch (error) {
    correctionResult.textContent = error.message || "No se pudo recalcular el control.";
  }
}

correctControlButton.addEventListener("click", correctControlDigit);
input.addEventListener("input", () => {
  lastInvalidValue = null;
  correctControlButton.hidden = true;
  correctionResult.hidden = true;
});

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function makeSyntheticCode(type) {
  let payload;
  switch (type) {
    case "dni":
      payload = Math.random() < .5
        ? randomDigits(8)
        : `${["X", "Y", "Z"][Math.floor(Math.random() * 3)]}${randomDigits(7)}`;
      break;
    case "isbn10": payload = randomDigits(9); break;
    case "isbn13": payload = `978${randomDigits(9)}`; break;
    case "ean13": payload = randomDigits(12); break;
    case "iban": payload = `ES${randomDigits(20)}`; break;
    case "luhn": payload = randomDigits(15); break;
    default: throw new Error(`Formato de experimento desconocido: ${type}`);
  }

  const control = cCalculate(type, payload);
  if (!control) throw new Error(`No se pudo generar un ejemplo para ${type}.`);
  const code = type === "iban"
    ? `ES${control}${payload.slice(2)}`
    : `${payload}${control}`;
  if (Number(cValidate(type, code)) !== 1)
    throw new Error(`El validador no aceptó un ejemplo generado para ${type}.`);
  return code;
}

function corruptCode(code, type, errorType) {
  const digits = code.split("");
  const firstPayloadIndex = type === "iban" ? 4
    : type === "dni" && /^[XYZ]/.test(code) ? 1
    : 0;
  const lastPayloadIndex = type === "dni" ? 7
    : type === "isbn10" ? 8
    : type === "isbn13" || type === "ean13" ? 11
    : type === "iban" ? 23
    : code.length - 2;

  if (errorType === "substitution") {
    const index = firstPayloadIndex + Math.floor(Math.random() * (lastPayloadIndex - firstPayloadIndex + 1));
    const original = Number(digits[index]);
    let replacement = Math.floor(Math.random() * 9);
    if (replacement >= original) replacement++;
    digits[index] = String(replacement);
  } else {
    const pairs = [];
    for (let i = firstPayloadIndex; i < lastPayloadIndex; i++) {
      if (digits[i] !== digits[i + 1]) pairs.push(i);
    }
    if (!pairs.length) return null;
    const index = pairs[Math.floor(Math.random() * pairs.length)];
    [digits[index], digits[index + 1]] = [digits[index + 1], digits[index]];
  }

  return digits.join("");
}

async function runExperiment() {
  experimentButton.disabled = true;
  experimentResult.hidden = true;
  experimentStatus.textContent = "Cargando el validador…";

  try {
    const ready = await Promise.race([
      wasmReady.then(() => true),
      wait(10000).then(() => false)
    ]);
    if (!ready || !window.Module || typeof window.Module.cwrap !== "function")
      throw new Error("No se pudo cargar el módulo de validación.");

    if (!cValidate) cValidate = window.Module.cwrap("validar", "number", ["string", "string"]);
    if (!cCalculate) cCalculate = window.Module.cwrap("calcular_digito", "string", ["string", "string"]);

    const trials = Math.max(1, Math.min(1000, Math.floor(Number(experimentCount.value) || 100)));
    experimentCount.value = trials;
    const type = experimentFormat.value;
    const errorType = experimentError.value;
    const option = OPTIONS.find((item) => item.id === type);
    const errorLabel = errorType === "substitution"
      ? "cambio de un dígito"
      : "intercambio de dígitos contiguos";
    experimentStatus.textContent = `Probando ${option.label} con ${errorLabel}…`;

    let detected = 0, completed = 0;
    while (completed < trials) {
      const validCode = makeSyntheticCode(type);
      const corrupted = corruptCode(validCode, type, errorType);
      if (corrupted === null) continue;
      if (Number(cValidate(type, corrupted)) !== 1) detected++;
      completed++;
    }

    const missed = trials - detected;
    const percentage = (detected * 100 / trials).toFixed(1);
    experimentResult.textContent = [
      `Formato probado: ${option.label}.`,
      `Error introducido: ${errorLabel}.`,
      `Pruebas realizadas: ${trials}.`,
      `Errores detectados: ${detected} de ${trials} (${percentage} %).`,
      `Errores no detectados: ${missed} de ${trials}.`
    ].join("\n");
    experimentResult.hidden = false;
    experimentStatus.textContent = "Experimento terminado. Los porcentajes describen solo estas pruebas aleatorias.";
  } catch (error) {
    console.error("Error en el modo experimento:", error);
    experimentStatus.textContent = error.message || "No se pudo completar el experimento.";
  } finally {
    experimentButton.disabled = false;
  }
}

experimentButton.addEventListener("click", runExperiment);

function explainCalculation(type, value, valid, calculating = false, calculatedControl = "") {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  const invalidFormat = (expected) =>
    `No se puede completar el cálculo: el formato debe cumplir ${expected}.`;

  if (type === "dni") {
    if (calculating) {
      let number;
      if (/^\d{8}$/.test(clean)) {
        number = Number(clean);
      } else if (/^[XYZ]\d{7}$/.test(clean)) {
        number = Number(({ X: "0", Y: "1", Z: "2" })[clean[0]] + clean.slice(1));
      } else {
        return invalidFormat("8 dígitos para DNI o X/Y/Z seguido de 7 dígitos para NIE");
      }
      const letterTable = "TRWAGMYFPDXBNJZSQVHLCKE";
      const remainder = number % 23;
      const letter = letterTable[remainder];
      return [
        `1. Tomamos el número ${clean}. En un NIE, la inicial se convierte: X=0, Y=1, Z=2.`,
        `2. Dividimos ${number} entre 23: ${number} = ${Math.floor(number / 23)} × 23 + ${remainder}.`,
        `3. Usamos el resto (${remainder}) como posición, empezando en 0, en la secuencia ${letterTable}. La letra calculada es ${letter}.`,
        "Este cálculo obtiene la letra final; en un NIE, la X, Y o Z inicial se introduce porque forma parte del número."
      ].join("\n");
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
    const letterTable = "TRWAGMYFPDXBNJZSQVHLCKE";
    const remainder = number % 23;
    const expected = letterTable[remainder];
    return [
      `1. Número usado: ${number}${/^[XYZ]/.test(clean) ? ` (la inicial del NIE ${clean[0]} se convierte en ${clean[0] === "X" ? 0 : clean[0] === "Y" ? 1 : 2})` : ""}.`,
      `2. Dividimos entre 23: ${number} = ${Math.floor(number / 23)} × 23 + ${remainder}; el resto es ${remainder}.`,
      `3. El resto indica la posición (empezando en 0) en la secuencia ${letterTable}; corresponde a ${expected}. La letra introducida es ${entered}.`,
      valid ? "Como coinciden, el DNI/NIE supera la comprobación." : "Como no coinciden, el DNI/NIE no supera la comprobación."
    ].join("\n");
  }

  if (calculating) {
    if (type === "ean13" || type === "isbn13") {
      if (!/^\d{12}$/.test(clean)) return invalidFormat("12 dígitos, sin espacios ni guiones");
      if (type === "isbn13" && !/^(978|979)/.test(clean))
        return invalidFormat("12 dígitos y comenzar por 978 o 979");
      const products = [...clean].map((digit, i) => `${digit}×${i % 2 === 0 ? 1 : 3}`);
      const sum = [...clean].reduce((total, digit, i) =>
        total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
      return [
        `1. Multiplicamos los 12 dígitos alternando pesos 1 y 3: ${products.join(" + ")}.`,
        `2. Sumamos: ${sum}. El dígito de control es (10 − resto de ${sum} entre 10) módulo 10 = ${calculatedControl}.`,
        `3. Al añadirlo, el código queda ${clean}${calculatedControl}.`
      ].join("\n");
    }

    if (type === "isbn10") {
      if (!/^\d{9}$/.test(clean)) return invalidFormat("9 dígitos");
      const products = [...clean].map((digit, i) => `${digit}×${10 - i}`);
      const sum = [...clean].reduce((total, digit, i) =>
        total + Number(digit) * (10 - i), 0);
      return [
        `1. Multiplicamos los 9 dígitos por los pesos del 10 al 2: ${products.join(" + ")}.`,
        `2. La suma es ${sum}. Se elige el control para que la suma más el control sea divisible entre 11.`,
        `3. El control calculado es ${calculatedControl}${calculatedControl === "X" ? " (X representa 10)" : ""}; el ISBN-10 completo sería ${clean}${calculatedControl}.`
      ].join("\n");
    }

    if (type === "iban") {
      if (!/^ES\d{20}$/.test(clean)) return invalidFormat("ES seguido de los 20 dígitos de cuenta, sin los dos dígitos de control");
      const expanded = clean.slice(2) + "142800";
      let remainder = 0;
      for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
      return [
        `1. Para obtener los controles, usamos los 20 dígitos de cuenta y añadimos ES00 al final. ES se convierte en 1428: ${expanded}.`,
        `2. El resto de dividir ese número entre 97 es ${remainder}.`,
        `3. Restamos el resto a 98: 98 − ${remainder} = ${calculatedControl}. Esos son los dos controles; el IBAN resultante es ES${calculatedControl}${clean.slice(2)}.`
      ].join("\n");
    }

    if (type === "luhn") {
      if (!/^\d{11,18}$/.test(clean)) return invalidFormat("entre 11 y 18 dígitos, sin el dígito de control");
      let sum = 0, double = true;
      const operations = [];
      for (let i = clean.length - 1; i >= 0; i--) {
        const original = Number(clean[i]);
        let digit = original;
        if (double) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit;
        operations.unshift(double ? `${original}→${digit}` : `${digit}`);
        double = !double;
      }
      return [
        "1. Como falta el dígito final, empezamos duplicando desde el último dígito introducido; si el resultado supera 9, restamos 9.",
        `2. Resultados (a→b indica duplicación): ${operations.join(" + ")}. La suma es ${sum}.`,
        `3. El control que completa un múltiplo de 10 es (10 − resto de ${sum} entre 10) módulo 10 = ${calculatedControl}.`
      ].join("\n");
    }
  }

  if (type === "ean13" || type === "isbn13") {
    if (!/^\d{13}$/.test(value)) return invalidFormat("13 dígitos, sin espacios ni guiones");
    if (type === "isbn13" && !/^(978|979)/.test(clean))
      return invalidFormat("13 dígitos y comenzar por 978 o 979");
    const sum = [...clean.slice(0, 12)].reduce((total, digit, i) =>
      total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
    const expected = (10 - (sum % 10)) % 10;
    const products = [...clean.slice(0, 12)].map((digit, i) =>
      `${digit}×${i % 2 === 0 ? 1 : 3}`).join(" + ");
    return [
      `1. Multiplicamos los primeros 12 dígitos alternando los pesos 1 y 3: ${products}.`,
      `2. Sumamos los resultados: ${sum}. Para llegar al siguiente múltiplo de 10, el control debe ser (10 − ${sum % 10}) módulo 10 = ${expected}.`,
      `3. El control escrito es ${clean[12]}.`,
      valid ? "Coincide con el calculado; por eso es válido." : "No coincide con el calculado; por eso no es válido."
    ].join("\n");
  }

  if (type === "isbn10") {
    if (!/^\d{9}[\dX]$/.test(clean)) return invalidFormat("9 dígitos y un dígito final o X");
    const values = [...clean.slice(0, 9)].map(Number);
    values.push(clean[9] === "X" ? 10 : Number(clean[9]));
    const sum = values.reduce((total, digit, i) => total + digit * (10 - i), 0);
    const products = values.map((digit, i) => `${digit}×${10 - i}`).join(" + ");
    return [
      "1. Multiplicamos cada posición por su peso, del 10 al 1. La X final representa 10:",
      `   ${products}.`,
      `2. Sumamos: ${sum}. Dividimos entre 11; el resto es ${sum % 11}.`,
      valid ? "El resto es 0, así que la suma es divisible entre 11 y el ISBN-10 es válido."
        : "El resto debería ser 0. Al no serlo, el ISBN-10 no es válido."
    ].join("\n");
  }

  if (type === "iban") {
    if (!/^ES\d{22}$/.test(clean)) return invalidFormat("ES seguido de 22 dígitos");
    const rearranged = clean.slice(4) + clean.slice(0, 4);
    const expanded = [...rearranged].map((char) =>
      /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char).join("");
    let remainder = 0;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
    return [
      `1. Movemos los cuatro primeros caracteres al final: ${clean} → ${rearranged}.`,
      `2. Sustituimos las letras por números (A=10, B=11…; ES se convierte en 1428): ${expanded}.`,
      "3. Calculamos el resto de dividir ese número entre 97. Se hace cifra a cifra para manejarlo sin números enormes.",
      `   El resto obtenido es ${remainder}; para que el IBAN sea válido debe ser 1.`,
      valid ? "El resto es 1, así que el IBAN supera la comprobación." : "El resto no es 1, así que el IBAN no supera la comprobación."
    ].join("\n");
  }

  if (type === "luhn") {
    if (!/^\d{12,19}$/.test(clean)) return invalidFormat("entre 12 y 19 dígitos");
    let sum = 0, double = false;
    const operations = [];
    for (let i = clean.length - 1; i >= 0; i--) {
      const original = Number(clean[i]);
      let digit = original;
      if (double) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      operations.unshift(double ? `${original}→${digit}` : `${digit}`);
      double = !double;
    }
    return [
      "1. Desde la derecha, duplicamos uno sí y otro no (el dígito duplicado mayor que 9 se reduce restándole 9).",
      `2. Dígitos tras la operación, de izquierda a derecha (a→b indica duplicación): ${operations.join(" + ")}.`,
      `3. Sumamos: ${sum}. Al dividir entre 10, el resto es ${sum % 10}; debe ser 0.`,
      valid ? "El resto es 0, así que supera el algoritmo de Luhn." : "El resto no es 0, así que no supera el algoritmo de Luhn."
    ].join("\n");
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
  correctControlButton.hidden = true;
  correctionResult.hidden = true;
  lastInvalidValue = null;

  const res = await runValidator(current.id, value);
  result.className = "result";
  result.classList.add(res.valid ? "ok" : "bad");
  result.textContent = res.message || (res.valid ? "Válido" : "No válido");
  const calculationMode = dniMode.value === "calculate";
  const details = explainCalculation(current.id, value, res.valid, calculationMode, res.control || "");
  explanation.textContent = calculationMode && res.valid
    ? `${details}\n\nNota: un control correcto no demuestra que el documento, código, tarjeta o cuenta haya sido asignado.`
    : details;
  explanation.hidden = false;
  if (!calculationMode && !res.valid && res.message === "No válido" &&
      hasCorrectableControlFormat(current.id, value)) {
    lastInvalidValue = { type: current.id, value };
    correctControlButton.hidden = false;
  }
});
