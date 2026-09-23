---
name: github-branch-resume
description: "Resumir una rama de Git a partir de sus commits, archivos modificados y diferencias reales respecto de una base. Usar cuando se solicite revisar una rama, entender qué contiene una rama de GitHub, preparar un resumen de cambios o comparar una rama con main, master, develop o su upstream."
argument-hint: "Escribí el nombre de la rama y, opcionalmente, la rama base; si no indicás base, se usará el upstream o se propondrá una base local."
user-invocable: true
disable-model-invocation: false
---

# Resumen de rama de GitHub

## Objetivo

Entregar un resumen técnico y funcional de una rama basándose únicamente en el historial y los cambios reales disponibles en el repositorio local. El resultado debe dejar claro qué cambió, cuánto cambió, qué impacto puede tener y qué conviene revisar.

## Flujo obligatorio

### Fase 1: localizar el repositorio

1. Confirmar que el workspace contiene un repositorio Git.
2. Ejecutar `git rev-parse --show-toplevel` para identificar la raíz.
3. Si el comando falla, informar que no se encontró un repositorio Git y detenerse.
4. No asumir el nombre del repositorio remoto ni inventar una URL de GitHub.

### Fase 2: resolver la rama objetivo

1. Si el usuario indicó una rama, verificarla sin cambiar de rama con:

   ```bash
   git show-ref --verify --quiet refs/heads/<rama>
   git show-ref --verify --quiet refs/remotes/<remoto>/<rama>
   ```

2. Si la rama no existe localmente pero existe una referencia remota local, usar esa referencia para el análisis e indicarlo.
3. Si el usuario no indicó una rama, ejecutar:

   ```bash
   git branch --all --no-color
   ```

   Mostrar una lista numerada de ramas locales y remotas disponibles y pedir que seleccione una. No resumir una rama arbitraria.
4. Nunca ejecutar `git checkout`, `git switch`, `git pull`, `git fetch`, `git reset`, `git merge` ni `git rebase`.
5. Si la rama tiene un nombre ambiguo, pedir la referencia completa o el número de selección.

### Fase 3: determinar la rama base

1. Si el usuario indicó una base, verificar que exista como referencia local.
2. Si la rama objetivo tiene upstream configurado, consultar la base con:

   ```bash
   git rev-parse --abbrev-ref <rama>@{upstream}
   ```

3. Si no hay upstream, buscar en este orden una referencia local disponible: `main`, `master`, `develop`.
4. Si hay más de una base razonable o no se puede determinar una base, pedir al usuario que la elija antes de resumir.
5. Informar siempre qué rama objetivo y qué base se usaron.

### Fase 4: obtener la evidencia

Para una rama objetivo `<rama>` y una base `<base>`, ejecutar únicamente operaciones de lectura:

```bash
git merge-base <base> <rama>
git log --no-merges --date=short --pretty=format:"%h|%H|%ad|%an|%s" <base>..<rama>
git diff --no-ext-diff --stat --find-renames <base>...<rama>
git diff --no-ext-diff --find-renames <base>...<rama> --
```

Además, consultar cuando sea necesario:

```bash
git status --short --branch
git log -1 --format=fuller <rama>
git diff --name-status --find-renames <base>...<rama>
```

1. Leer solo la información necesaria para el resumen.
2. No mostrar el diff completo salvo que el usuario lo solicite.
3. Si la rama no tiene commits o diferencias respecto de la base, indicarlo explícitamente.
4. Si la referencia solo existe en el remoto configurado pero no está disponible localmente, consultar `git remote -v` y explicar que hace falta actualizar referencias. No ejecutar `fetch` sin autorización explícita.
5. Si hay cambios sin commit en el workspace, separarlos del resumen de la rama y aclarar que no forman parte de la comparación confirmada.

## Formato de salida

Entregar el resumen en español con esta estructura:

```markdown
## Resumen de la rama `<rama>`

**Base comparada:** `<base>`
**Estado:** ...
**Commits propios:** ...
**Archivos modificados:** ...

### Qué se implementó
- ...

### Evolución de la rama
- `<hash corto>` — `<fecha>` — `<título>`

### Archivos y áreas afectadas
- `ruta/al/archivo`: ...

### Impacto funcional
...

### Riesgos o puntos a revisar
- ...

### Pruebas recomendadas
- ...

### Limitaciones del análisis
- ...
```

Omitir `Limitaciones del análisis` si no hay ninguna. No inventar datos para completar una sección.

## Reglas de análisis

- Basar cada afirmación en el historial, la lista de archivos, el diff o el estado de Git observado.
- Separar hechos observados de inferencias; usar expresiones como "el diff sugiere" cuando corresponda.
- No afirmar que una funcionalidad está completa si la evidencia no lo demuestra.
- Identificar archivos agregados, modificados, renombrados y eliminados.
- Señalar cambios de configuración, dependencias, migraciones, contratos de API y pruebas.
- Revisar especialmente si faltan pruebas para el comportamiento modificado.
- Mencionar archivos sensibles o posibles secretos si aparecen en el diff, sin reproducir sus valores.
- No confundir commits propios de la rama con commits compartidos con la base.
- No atribuir cambios a GitHub, un Pull Request, checks, CI/CD o un despliegue si no se observaron en el repositorio local.

## Restricciones

- Operación de solo lectura.
- No cambiar de rama ni modificar archivos.
- No crear commits, hacer push, pull, fetch, merge, rebase o reset.
- No instalar dependencias.
- No inventar el upstream, el estado del Pull Request, los checks, el despliegue ni la revisión de otros colaboradores.
- Si falta contexto para interpretar una modificación, declararlo como limitación.

## Criterio de finalización

La skill termina cuando muestra la lista de ramas solicitada para selección o cuando entrega un resumen de la rama elegida con su base, commits, archivos afectados, impacto, riesgos y pruebas recomendadas.
