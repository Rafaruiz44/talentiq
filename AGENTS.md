# Talentiq — reglas del proyecto

## Objetivo y alcance

Talentiq es una aplicación de apoyo a reclutadores. El alcance acordado para la entrega final incluye:

- Registro e inicio de sesión de reclutadores mediante Google.
- Un espacio privado por reclutador autenticado; no se comparten posiciones ni CVs entre cuentas en esta etapa.
- Posiciones persistentes con estado propio: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Perfiles de candidatos y archivos CV persistidos; los archivos se almacenan en un bucket privado.
- Carga masiva con progreso y errores independientes por CV.
- Solicitudes persistentes por relación candidato–posición y reutilización del candidato en distintas posiciones abiertas.
- Historial de ejecuciones de evaluación por solicitud.
- Etapas por cada solicitud candidato–posición: `Evaluado`, `En entrevista` o `Descartado`.
- Generación de preguntas de entrevista a partir de los requisitos y el análisis del cruce.
- Llamadas principales a Azure OpenAI desde el backend, sin exponer secretos en el frontend.
- Despliegue accesible y verificación de un flujo funcional como objetivo de entrega.

Este es el alcance acordado, no una afirmación de que esas capacidades estén implementadas. El estado actual y las decisiones pendientes se describen en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) y [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md). Las historias propuestas están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## Reglas de implementación

- Stack actual: Vite, React 19 y TypeScript en modo estricto. Actualizar esta descripción cuando cambie el proyecto.
- Para crear o modificar UI, seguir el agente [Diseñador UI](.github/agents/disenador-ui.agent.md) y las instrucciones [.github/instructions/estilo-ui.instructions.md](.github/instructions/estilo-ui.instructions.md), aplicadas automáticamente a archivos de `src/`.
- Nunca usar `any`.
- Un componente por archivo, con export nombrado, siguiendo los patrones existentes.
- Usar elementos HTML nativos (`button`, `input`, `label`, `textarea`); no usar un `div` con `onClick`.
- Agregar `data-testid` en kebab-case a los elementos que necesiten las pruebas.
- Validar autenticación y propiedad en el backend para cada operación sobre los datos y archivos privados de un reclutador.
- No usar controles de la interfaz como sustituto del aislamiento entre cuentas en el servidor.
- Mantener las claves de Azure OpenAI y otras credenciales exclusivamente en el backend; no incluir secretos en variables `VITE_*` ni en el bundle cliente.
- Informar explícitamente errores de autenticación, autorización, base de datos, almacenamiento y servicios de IA. No responder con éxito simulado ante fallos.
- Incrementar `evaluatorVersion` en `server/server.mjs` cuando cambien el prompt, las reglas de evaluación o la normalización que afecte los resultados, para invalidar la reutilización de evaluaciones antiguas.
- Para ejecutar una evaluación, consultar primero el historial persistido por candidato, CV, puesto, requisitos y versión del evaluador. No invocar Azure si existe un resultado válido; fallar explícitamente si no se puede consultar la base de datos.
- Ampliar las pruebas para cubrir persistencia, aislamiento entre cuentas, carga masiva, errores parciales, solicitudes, historial de evaluaciones y etapas independientes, así como flujos de autenticación.
- No instalar dependencias sin preguntar primero.

## Modelo de dominio a preservar

- El estado de una posición no es el estado de un candidato.
- La etapa de un candidato se guarda en su relación con una posición.
- Cada solicitud corresponde a una pareja candidato–posición y pertenece a un reclutador.
- Cada análisis con CV, puesto o requisitos distintos (o nueva versión del evaluador) agrega una evaluación histórica a la solicitud; si los datos y la versión no cambiaron, se reutiliza el resultado existente sin agregar otra ejecución.
- Los datos y documentos de CV pertenecen al banco privado de un reclutador y no se comparten con otras cuentas.
- Las preguntas generadas deben usar el contexto del cruce candidato–posición seleccionado.

Supabase está seleccionado para autenticación, base de datos y almacenamiento privado. Google OAuth y las políticas RLS de las tablas de posiciones ya fueron confirmadas; el bucket tiene las políticas esperadas, aunque falta inspeccionar sus predicados completos. El hosting aún requiere decisión. No fijar políticas de privacidad no acordadas.

## Contexto obligatorio para tareas de desarrollo

- Consultar primero [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) para distinguir alcance objetivo e implementación presente.
- Consultar [PROYECTO-ACTUAL.md](PROYECTO-ACTUAL.md) y actualizarlo en la misma tarea cuando un cambio modifique una capacidad visible, su integración con servicios, su estado de seguridad o el alcance pendiente. Actualizar también la fecha; no marcar como verificado contra servicios reales algo que solo se probó con mocks.
- Revisar `App.tsx` y los archivos involucrados solo después de identificar el área afectada.
- No asumir que una funcionalidad del alcance ya está implementada porque figure en las historias.
- Antes de crear cualquier work item en Azure DevOps, mostrar qué se va a crear y esperar confirmación.
- Con Playwright, tomar un snapshot de la página antes de escribir un selector; nunca inventar selectores.
