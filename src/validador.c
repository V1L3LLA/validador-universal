#include <string.h>
#include <stdio.h>
#include <emscripten.h>

// Validador de EAN-13
int ean13_valido(const char *valor)
{
    int ean13[12], eandef = 0;
    
    for (int i = 0; i < 12; i++)
    {
        ean13[i] = valor[i] - '0'; 
    }
    for (int k = 0; k < 12; k++)
    {
        if (k%2 == 0)
        {
            eandef+=ean13[k]*1;
        }
        else
        {
            eandef+=ean13[k]*3;
        }
    }

    eandef=eandef%10;
    eandef=10 - eandef;

    return eandef == valor[12] - '0';
}
// Validador DNI
int dni_valido(const char *valor){
    int dni, resto;
    char letra;
    char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";

    sscanf(valor, "%8d%c", &dni, &letra);

    resto = dni % 23;
    if (letra == letras[resto] || letra == letras[resto] + 32) 
    {
        return 1;                            
    }
    else {
        return 0;                            
    }
}

EMSCRIPTEN_KEEPALIVE
int validar(const char *tipo, const char *valor)
{
    if (strcmp(tipo, "ean13") == 0) return ean13_valido(valor);

    return 0;   // los otros tipos todavía no
}