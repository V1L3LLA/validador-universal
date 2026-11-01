#include <string.h>
#include <emscripten.h>

int ean13_valido(const char *valor)
{
    int ean13[12], eandef = 0;
    
    for (int i = 0; i < 12; i++)
    {
        ean13[i] = valor[i] - '0';   // CAMBIADO: antes era printf + scanf
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

    return eandef == valor[12] - '0';   // CAMBIADO: antes era printf
}

EMSCRIPTEN_KEEPALIVE
int validar(const char *tipo, const char *valor)
{
    if (strcmp(tipo, "ean13") == 0) return ean13_valido(valor);

    return 0;   // los otros tipos todavía no
}