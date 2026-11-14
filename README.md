# Validador universal

Aplicación web para comprobar si un valor es válido según distintos formatos de identificación y códigos.

## Estado actual

La interfaz ofrece estas opciones:

- DNI/NIE
- ISBN-10
- ISBN-13
- EAN-13
- IBAN español
- Número de tarjeta (algoritmo de Luhn)

Actualmente, la lógica implementada en C valida **DNI** y **EAN-13**. Las demás opciones aparecen en la interfaz, pero todavía no cuentan con validación implementada. Aunque el menú indica DNI/NIE, por ahora solo se valida el DNI.

## Tecnologías

- HTML y CSS para la interfaz.
- JavaScript para la interacción y la comunicación con el validador.
- C compilado a WebAssembly con Emscripten.

## Estructura

- `web/index.html`: estructura de la página.
- `web/style.css`: estilos y diseño adaptable.
- `web/app.js`: menú, interacción y llamada al módulo WebAssembly.
- `src/validador.c`: validadores implementados y función de entrada `validar()`.

La página espera que `web/validador.js` y el archivo WebAssembly generado estén disponibles para cargar el módulo.
