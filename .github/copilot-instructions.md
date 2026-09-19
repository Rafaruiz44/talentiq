# Instrucciones de VS Code

Las reglas del proyecto están en [`AGENTS.md`](../AGENTS.md). Aplicarlas sin repetirlas aquí.

- Responder siempre en español.
- Antes de escribir código, explicar en una o dos líneas qué se va a hacer.
- Hacer un solo cambio por vez y esperar mi OK antes de continuar.
- Antes de crear cualquier work item en Azure DevOps, mostrar qué se va a crear y esperar confirmación.
- Con Playwright, tomar siempre un snapshot de la página antes de escribir un selector; nunca inventar selectores.

## Flujo de Trabajo con Git

1. **Antes de modificar código:**
   - Verifica el estado actual con `git status` y la rama activa con `git branch --show-current`.
   - Si la rama actual es `main`, `master` o `develop`, crea y pásate a una rama nueva descriptiva (`feature/<descripcion>` o `fix/<descripcion>`) antes de editar archivos.
   - Proponme el nombre de la rama y ejecuta el checkout en la terminal integrada tras mi aprobación.

2. **Durante los cambios:**
   - Realiza los cambios necesarios únicamente dentro de esa rama.

3. **Publicación y Push:**
   - NUNCA hagas `git push` de forma automática.
   - Solo cuando yo te dé la orden explícita (ej. "pusheá los cambios" o "subí la rama"):
     1. Muestra un resumen de `git status` y los archivos modificados.
     2. Haz commit con un mensaje convencional (`feat: ...`, `fix: ...`).
     3. Ejecuta `git push -u origin <nombre-de-rama>` tras confirmarlo.