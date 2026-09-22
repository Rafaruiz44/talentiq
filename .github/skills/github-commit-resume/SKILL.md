---
name: github-commit-resume
description: "Listar commits del repositorio del proyecto y resumir un commit seleccionado a partir de sus cambios reales. Usar cuando se solicite revisar commits, entender qué hace un commit, analizar cambios de GitHub o generar un resumen técnico y funcional de una modificación."
argument-hint: "Escribí el hash o el texto del commit que querés resumir; si no indicás uno, se mostrará la lista disponible."
user-invocable: true
disable-model-invocation: false
---

# Resumen de commits de GitHub

## Objetivo

Permitir que el usuario consulte los commits del repositorio del proyecto, seleccione uno y reciba un resumen basado únicamente en el mensaje, los archivos modificados y el diff real.

## Flujo obligatorio

### Fase 1: localizar el repositorio

1. Confirmar que el workspace contiene un repositorio Git.
2. Ejecutar `git rev-parse --show-toplevel` para identificar la raíz.
3. Si el comando falla, informar que no se encontró un repositorio Git y detenerse.
4. No asumir el nombre del repositorio remoto ni inventar una URL de GitHub.

### Fase 2: listar commits

1. Si el usuario no proporcionó un commit, ejecutar:

   ```bash
   git log -20 --date=short --pretty=format:"%h|%H|%ad|%an|%s"
   ```

2. Mostrar una lista numerada con:
   - número de selección;
   - hash corto;
   - fecha;
   - autor;
   - título del commit.
3. Indicar que el usuario puede responder con el número, el hash corto, el hash completo o el texto del commit.
4. No resumir ningún commit hasta que el usuario lo seleccione.
5. Si existen varios commits con el mismo texto, pedir el hash o el número exacto.

### Fase 3: obtener el cambio seleccionado

1. Resolver la selección a un hash inequívoco.
2. Verificar que el hash pertenece al repositorio con:

   ```bash
   git cat-file -t <commit>
   ```

3. Obtener los datos del commit con:

   ```bash
   git show --no-ext-diff --format=fuller --stat --find-renames <commit>
   git diff <commit>^ <commit> --
   ```

4. Leer solo la información necesaria para el resumen. No modificar archivos, crear commits, hacer push ni cambiar de rama.
5. Si el usuario pide información de GitHub y el commit no está disponible localmente, comprobar primero el remoto configurado con `git remote -v` y explicar si hace falta hacer fetch. No ejecutar `fetch`, `pull` ni operaciones remotas sin autorización explícita.

## Formato de salida

Entregar el resumen en español con esta estructura:

```markdown
## Resumen del commit `<hash corto>`

**Título:** ...
**Autor:** ...
**Fecha:** ...

### Qué se implementó
- ...

### Archivos modificados
- `ruta/al/archivo`: ...

### Impacto funcional
...

### Riesgos o puntos a revisar
- ...

### Pruebas recomendadas
- ...
```

## Reglas de análisis

- Basar cada afirmación en el diff o en los metadatos del commit.
- Separar claramente hechos observados de inferencias.
- No afirmar que una funcionalidad está completa si el diff no lo demuestra.
- Identificar archivos eliminados, cambios de configuración, migraciones, cambios de API y modificaciones de pruebas.
- Mencionar archivos sensibles o posibles secretos si aparecen en el diff, sin reproducir sus valores.
- Si el commit no contiene cambios sustantivos, indicarlo explícitamente.
- No mostrar el diff completo salvo que el usuario lo solicite.

## Restricciones

- Operación de solo lectura.
- No ejecutar `git commit`, `git push`, `git pull`, `git reset`, `git checkout` ni cambiar de rama.
- No instalar dependencias.
- No inventar el estado de GitHub, el Pull Request, los checks ni el despliegue.
- Si falta contexto para interpretar una modificación, declararlo como limitación.

## Criterio de finalización

La skill termina cuando muestra la lista de commits solicitada o cuando entrega el resumen del commit seleccionado con hechos observados, impacto, riesgos y pruebas recomendadas.