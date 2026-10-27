#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

int main(void) {
    int validar(const char tipo, const charvalor);
    char dni[20];
    const char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";
    long numero = 0;
    int longitud;

    printf("Introduce DNI (8 numeros y letra): ");

    if (scanf("%19s", dni) != 1) {
        printf("DNI incorrecto\n");
        return 1;
    }

    longitud = strlen(dni);

    if (longitud != 9) {
        printf("DNI incorrecto\n");
        return 0;
    }

    for (int i = 0; i < 8; i++) {
        if (!isdigit((unsigned char)dni[i])) {
            printf("DNI incorrecto\n");
            return 0;
        }

        numero = numero * 10 + (dni[i] - '0');
    }

    char letra = toupper((unsigned char)dni[8]);

    if (strchr(letras, letra) == NULL) {
        printf("DNI incorrecto\n");
        return 0;
    }

    int resto = numero % 23;

    if (letra == letras[resto]) {
        printf("DNI correcto\n");
    } else {
        printf("DNI incorrecto\n");
    }

    return 0;
}
