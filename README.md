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

La aplicación valida DNI/NIE, ISBN-10, ISBN-13, EAN-13, IBAN español y números de tarjeta con Luhn. También permite calcular sus dígitos de control y explica los pasos del cálculo.

Incluye una sección «¿Cómo funciona?» y un modo experimento que genera códigos sintéticos, altera dígitos o intercambia posiciones contiguas y muestra qué porcentaje de esos errores detecta cada validador. Los porcentajes dependen de los errores simulados y no representan todos los casos posibles.

## Tecnologías

- HTML y CSS para la interfaz.
- JavaScript para la interacción y la comunicación con el validador.
- C compilado a WebAssembly con Emscripten.

## Estructura

- `web/index.html`: estructura de la página.
- `web/style.css`: estilos y diseño adaptable.
- `web/app.js`: menú, interacción, explicaciones y modo experimento.
- `src/validador.c`: validadores y cálculos de dígitos de control, expuestos a JavaScript mediante WebAssembly.

La página espera que `web/validador.js` y el archivo WebAssembly generado estén disponibles para cargar el módulo.
