
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

int validar(const char *dni) {
    const char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";
    long numero = 0;

    if (strlen(dni) != 9) {
        return 0;
    }

    for (int i = 0; i < 8; i++) {
        if (!isdigit((unsigned char)dni[i])) {
            return 0;
        }

        numero = numero * 10 + (dni[i] - '0');
    }

    char letra = toupper((unsigned char)dni[8]);

    if (strchr(letras, letra) == NULL) {
        return 0;
    }

    return letra == letras[numero % 23];
}
