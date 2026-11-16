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

Cuando el formato es correcto pero el control no coincide, permite recalcular únicamente el dígito o la letra de control. La corrección presupone que el resto de los datos es correcto; no verifica que el documento o la cuenta exista.

Incluye una sección «¿Cómo funciona?» específica para el formato seleccionado y un modo experimento. En este modo se elige el formato, el tipo de error (cambio de un dígito o intercambio de dígitos contiguos) y el número de pruebas. La aplicación genera códigos sintéticos y muestra cuántos errores detectó y qué porcentaje representan. Los resultados dependen de los errores simulados y no representan todos los casos posibles.

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
