# Instrucciones de VS Code

Las reglas del proyecto están en [`AGENTS.md`](../AGENTS.md). Aplicarlas sin repetirlas aquí.

- Responder siempre en español.
- Antes de escribir código, explicar en una o dos líneas qué se va a hacer.
- Hacer un solo cambio por vez y esperar mi OK antes de continuar.
- Antes de crear cualquier work item en Azure DevOps, mostrar qué se va a crear y esperar confirmación.
- Con Playwright, tomar siempre un snapshot de la página antes de escribir un selector; nunca inventar selectores.

## Flujo de Trabajo Obligatorio con Git

1. **Aislamiento en Rama Local (Siempre requerido antes de editar):**
   - ANTES de aplicar o proponer cambios en el código, revisa la rama actual (`git branch --show-current`).
   - Si la rama actual es `main`, `master`, `develop` o una rama base protegida:
     - Detente y crea una nueva rama local basada en la tarea actual usando la convención `feature/<nombre-tarea>` o `fix/<nombre-tarea>`.
     - Ejecuta o sugiere el comando: `git checkout -b <nombre-de-rama>` (o `git switch -c <nombre-de-rama>`).
     - Todos los cambios posteriores deben realizarse únicamente dentro de esa rama.
   - Si ya estamos en una rama de feature/fix existente y corresponde a la tarea en curso, continúa trabajando en ella sin crear ramas adicionales innecesarias.

2. **Restricción Estricta de Publicación Remota:**
   - TIENES ESTRICTAMENTE PROHIBIDO ejecutar o sugerir comandos de publicación remota como `git push`, `gh pr create` o `git publish`.
   - La gestión de commits locales está permitida si se solicita explícitamente, pero el envío de cambios al repositorio remoto (`push`) queda 100% bajo control manual del usuario.