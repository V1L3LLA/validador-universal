#include <string.h>
#include <stdio.h>
#include <ctype.h>
#include <emscripten.h>

// Elimina espacios y guiones, y convierte las letras a mayúsculas.
static int normalizar(const char *valor, char *limpia, int capacidad)
{
    int longitud = 0;

    for (int i = 0; valor[i] != '\0'; i++)
    {
        unsigned char caracter = (unsigned char) valor[i];
        if (isspace(caracter) || caracter == '-') continue;
        if (longitud >= capacidad - 1) return -1;
        limpia[longitud++] = (char) toupper(caracter);
    }

    limpia[longitud] = '\0';
    return longitud;
}

// Validador de EAN-13
int ean13_valido(const char *valor)
{
    int ean13[12], eandef = 0;

    if (strlen(valor) != 13) return 0;
    
    for (int i = 0; i < 12; i++)
    {
        if (!isdigit((unsigned char) valor[i])) return 0;
        ean13[i] = valor[i] - '0'; 
    }
    if (!isdigit((unsigned char) valor[12])) return 0;
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

    eandef=(10 - (eandef % 10)) % 10;

    return eandef == valor[12] - '0';
}

// Validador de ISBN-13 (prefijos 978 o 979).
int isbn13_valido(const char *valor)
{
    int digitos[12], suma = 0;

    if (strlen(valor) != 13) return 0;
    if (strncmp(valor, "978", 3) != 0 && strncmp(valor, "979", 3) != 0)
        return 0;

    for (int i = 0; i < 13; i++)
    {
        if (!isdigit((unsigned char) valor[i])) return 0;
    }

    for (int i = 0; i < 12; i++)
    {
        digitos[i] = valor[i] - '0';
        suma += digitos[i] * (i % 2 == 0 ? 1 : 3);
    }

    int digito_control = (10 - (suma % 10)) % 10;
    return digito_control == valor[12] - '0';
}

// Validador de ISBN-10 (el dígito de control también puede ser X).
int isbn10_valido(const char *valor)
{
    char limpio[100];
    int longitud = normalizar(valor, limpio, sizeof(limpio));
    if (longitud != 10) return 0;

    int suma = 0;
    for (int i = 0; i < 9; i++)
    {
        if (!isdigit((unsigned char) limpio[i])) return 0;
        suma += (limpio[i] - '0') * (10 - i);
    }

    int control;
    if (limpio[9] == 'X')
        control = 10;
    else if (isdigit((unsigned char) limpio[9]))
        control = limpio[9] - '0';
    else
        return 0;

    suma += control;
    return suma % 11 == 0;
}

// Validador DNI
int dni_valido(const char *valor){
    int dni, resto;
    char letra;
    char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";

    if (strlen(valor) != 9 || sscanf(valor, "%8d%c", &dni, &letra) != 2)
        return 0;
    for (int i = 0; i < 8; i++)
    {
        if (!isdigit((unsigned char) valor[i])) return 0;
    }

    resto = dni % 23;
    if (letra == letras[resto] || letra == letras[resto] + 32) 
    {
        return 1;                            
    }
    else {
        return 0;                            
    }
}

// Validador NIE: X/Y/Z + 7 dígitos + letra de control.
int nie_valido(const char *valor)
{
    const char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";
    if (strlen(valor) != 9) return 0;

    char prefijo = (char) toupper((unsigned char) valor[0]);
    if (prefijo < 'X' || prefijo > 'Z') return 0;

    int numero = prefijo - 'X';
    for (int i = 1; i <= 7; i++)
    {
        if (!isdigit((unsigned char) valor[i])) return 0;
        numero = numero * 10 + (valor[i] - '0');
    }

    char letra = (char) toupper((unsigned char) valor[8]);
    if (!isalpha((unsigned char) letra)) return 0;
    return letra == letras[numero % 23];
}

// Calcula la letra de un DNI (8 dígitos) o NIE (X/Y/Z + 7 dígitos).
EMSCRIPTEN_KEEPALIVE
const char *calcular_control(const char *valor)
{
    static char resultado[2];
    const char letras[] = "TRWAGMYFPDXBNJZSQVHLCKE";
    int numero = 0;
    size_t longitud = strlen(valor);

    if (longitud == 8 && isdigit((unsigned char) valor[0]))
    {
        for (int i = 0; i < 8; i++)
        {
            if (!isdigit((unsigned char) valor[i])) return "";
            numero = numero * 10 + (valor[i] - '0');
        }
    }
    else if (longitud == 8 && toupper((unsigned char) valor[0]) >= 'X'
             && toupper((unsigned char) valor[0]) <= 'Z')
    {
        // NIE: prefijo X/Y/Z y siete dígitos.
        numero = toupper((unsigned char) valor[0]) - 'X';
        for (int i = 1; i < 8; i++)
        {
            if (!isdigit((unsigned char) valor[i])) return "";
            numero = numero * 10 + (valor[i] - '0');
        }
    }
    else
    {
        return "";
    }

    resultado[0] = letras[numero % 23];
    resultado[1] = '\0';
    return resultado;
}

// Validador de IBAN español mediante el algoritmo módulo 97.
int iban_valido(const char *valor)
{
    char limpio[100];
    int longitud = normalizar(valor, limpio, sizeof(limpio));
    if (longitud != 24 || limpio[0] != 'E' || limpio[1] != 'S') return 0;

    for (int i = 2; i < 24; i++)
    {
        if (!isdigit((unsigned char) limpio[i])) return 0;
    }

    int resto = 0;
    for (int i = 4; i < 24; i++)
        resto = (resto * 10 + (limpio[i] - '0')) % 97;

    for (int i = 0; i < 4; i++)
    {
        int valor_letra = limpio[i] - 'A' + 10;
        resto = (resto * 10 + valor_letra / 10) % 97;
        resto = (resto * 10 + valor_letra % 10) % 97;
    }

    return resto == 1;
}

// Validador de tarjetas mediante el algoritmo de Luhn.
int luhn_valido(const char *valor)
{
    char limpio[100];
    int longitud = normalizar(valor, limpio, sizeof(limpio));
    if (longitud < 12 || longitud > 19) return 0;

    int suma = 0;
    int duplicar = 0;
    for (int i = longitud - 1; i >= 0; i--)
    {
        if (!isdigit((unsigned char) limpio[i])) return 0;

        int digito = limpio[i] - '0';
        if (duplicar)
        {
            digito *= 2;
            if (digito > 9) digito -= 9;
        }
        suma += digito;
        duplicar = !duplicar;
    }

    return suma % 10 == 0;
}

EMSCRIPTEN_KEEPALIVE
int validar(const char *tipo, const char *valor)
{
    if (strcmp(tipo, "ean13") == 0) return ean13_valido(valor);
    if (strcmp(tipo, "isbn10") == 0) return isbn10_valido(valor);
    if (strcmp(tipo, "isbn13") == 0) return isbn13_valido(valor);
    if (strcmp(tipo, "dni") == 0)
        return dni_valido(valor) || nie_valido(valor);
    if (strcmp(tipo, "nie") == 0) return nie_valido(valor);
    if (strcmp(tipo, "iban") == 0) return iban_valido(valor);
    if (strcmp(tipo, "luhn") == 0) return luhn_valido(valor);
    return 0;   
}
