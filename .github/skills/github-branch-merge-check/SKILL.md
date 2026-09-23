---
name: github-branch-merge-check
description: "Comparar dos ramas de Git y evaluar si su integración puede producir conflictos. Usar cuando se solicite revisar un merge, anticipar conflictos entre ramas, comparar dos ramas específicas o preparar una integración. El análisis es de solo lectura y se basa en las referencias Git disponibles localmente."
argument-hint: "Escribí las dos ramas que querés comparar, por ejemplo: feature/login y main."
user-invocable: true
disable-model-invocation: false
---

# Verificación de merge entre ramas

## Objetivo

Comparar dos ramas seleccionadas por el usuario y determinar, con la evidencia disponible localmente, si su integración puede producir conflictos. Las ramas se tratan como pares equivalentes; el orden solo se conserva para reproducir la simulación técnica. La skill debe distinguir entre conflictos confirmados por una simulación de merge, zonas de riesgo y cambios que no se superponen.

## Flujo obligatorio

### Fase 1: localizar el repositorio

1. Confirmar que el workspace contiene un repositorio Git.
2. Ejecutar `git rev-parse --show-toplevel` para identificar la raíz.
3. Si el comando falla, informar que no se encontró un repositorio Git y detenerse.
4. No asumir el nombre del repositorio remoto ni inventar una URL de GitHub.

### Fase 2: resolver las ramas

1. Pedir o identificar dos referencias inequívocas:
   - **Rama A:** primera rama seleccionada por el usuario.
   - **Rama B:** segunda rama seleccionada por el usuario.
   No asumir que una rama es origen o destino ni elegir una de las dos como principal desde el punto de vista funcional.
2. Si falta una de las dos ramas, listar referencias disponibles con:

   ```bash
   git branch --all --no-color
   ```

   Mostrar una lista numerada y pedir la selección. No elegir ramas arbitrariamente.
3. Verificar cada referencia sin cambiar de rama con:

   ```bash
   git rev-parse --verify <rama>^{commit}
   ```

4. Resolver primero ramas locales. Si solo existe una referencia remota local, usarla e indicarlo.
5. No ejecutar `git checkout`, `git switch`, `git pull`, `git fetch`, `git reset`, `git merge` ni `git rebase`.
6. Si el usuario menciona GitHub pero la referencia no existe localmente, consultar `git remote -v` y explicar que hace falta actualizar referencias. No ejecutar `fetch` sin autorización explícita.

### Fase 3: obtener la evidencia de divergencia

Para `<rama-a>` y `<rama-b>`, ejecutar operaciones de lectura:

```bash
git merge-base <rama-a> <rama-b>
git log --oneline --decorate --no-merges <rama-a>..<rama-b>
git log --oneline --decorate --no-merges <rama-b>..<rama-a>
git diff --no-ext-diff --stat --find-renames <rama-a>...<rama-b>
git diff --no-ext-diff --name-status --find-renames <rama-a>...<rama-b>
```

Interpretar la evidencia así:

- `<rama-a>..<rama-b>` muestra commits que solo están en la rama B.
- `<rama-b>..<rama-a>` muestra commits que solo están en la rama A.
- `<rama-a>...<rama-b>` compara ambas ramas desde su merge-base común.
- Un archivo compartido por ambas ramas no implica conflicto: requiere analizar las líneas y operaciones realizadas.
- Renombres, eliminaciones y cambios simultáneos en el mismo archivo son señales de riesgo y deben destacarse.

### Fase 4: simular el merge sin modificar el repositorio

1. Usar `git merge-tree` para simular la integración de ambas ramas sin hacer checkout ni crear un merge. El orden A/B es técnico y no implica que una rama sea funcionalmente origen o destino:

   ```bash
   git merge-tree --write-tree <rama-a> <rama-b>
   ```

2. Interpretar el resultado y el código de salida según la versión instalada de Git:
   - Si la simulación no informa conflictos, indicar que no se observaron conflictos textuales en esta simulación.
   - Si informa conflictos, enumerar los archivos y tipos de conflicto observados.
   - Si `--write-tree` no está disponible, usar como alternativa:

     ```bash
   git merge-tree $(git merge-base <rama-a> <rama-b>) <rama-a> <rama-b>
     ```

     y declarar que se utilizó el formato alternativo.
3. Complementar la simulación con:

   ```bash
   git diff --check <rama-a>...<rama-b>
   git status --short --branch
   ```

4. Si el workspace tiene cambios sin commit, aclarar que no forman parte de la simulación basada en las referencias y que podrían interferir con un merge real.
5. No usar `git merge --no-commit`, `git stash`, worktrees temporales ni comandos que modifiquen el índice o el working tree.

## Clasificación del resultado

Usar exactamente una conclusión principal:

- **Sin conflictos observados:** la simulación no detectó conflictos con las referencias analizadas.
- **Conflictos probables o confirmados:** la simulación detectó conflictos o hay operaciones incompatibles claramente identificadas.
- **Riesgo no concluyente:** no fue posible simular correctamente el merge o falta una referencia/base confiable.

No afirmar que un merge es imposible de romper por conflictos futuros. El resultado solo describe las referencias y el estado local analizados.

## Formato de salida

Entregar el resultado en español con esta estructura:

```markdown
## Verificación de merge

**Rama A:** `<rama A>`
**Rama B:** `<rama B>`
**Merge-base:** `<hash corto>`
**Conclusión:** Sin conflictos observados | Conflictos probables o confirmados | Riesgo no concluyente

### Resumen de divergencia
- Commits exclusivos de rama A: ...
- Commits exclusivos de rama B: ...
- Archivos modificados desde el merge-base: ...

### Conflictos detectados
- `ruta/al/archivo`: tipo de conflicto y evidencia.

### Zonas de riesgo
- `ruta/al/archivo`: ambas ramas modifican el área o la operación puede requerir resolución manual.

### Cambios sin superposición relevante
- ...

### Recomendación
...

### Limitaciones del análisis
- ...
```

Omitir secciones que no tengan elementos, excepto `Recomendación`. Omitir `Limitaciones del análisis` si no existe ninguna.

## Reglas de análisis

- Basar cada afirmación en comandos y referencias observadas.
- Distinguir claramente conflictos confirmados por `git merge-tree` de riesgos inferidos por archivos compartidos, renombres o eliminaciones.
- No confundir archivos modificados en ambas ramas con conflictos automáticos.
- Revisar cambios de configuración, dependencias, migraciones, contratos de API y pruebas.
- Señalar cuando una resolución manual podría cambiar comportamiento, incluso si el conflicto es textual.
- Mencionar archivos sensibles o posibles secretos si aparecen en los cambios, sin reproducir sus valores.
- No afirmar que se ejecutaron pruebas de la aplicación si solo se inspeccionó Git.
- No atribuir el resultado a GitHub, un Pull Request, checks, CI/CD o un despliegue si no se observaron esos datos localmente.

## Restricciones

- Operación de solo lectura.
- No cambiar de rama ni modificar archivos, índice, stash o working tree.
- No crear commits, hacer push, pull, fetch, merge, rebase o reset.
- No instalar dependencias.
- No resolver conflictos automáticamente.
- Si falta contexto o una referencia no está disponible, declararlo como limitación.

## Criterio de finalización

La skill termina cuando entrega una conclusión de merge basada en las dos ramas seleccionadas, el merge-base, la simulación disponible, los archivos en riesgo y las limitaciones conocidas; o cuando muestra las ramas disponibles para que el usuario elija las referencias faltantes.
