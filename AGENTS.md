# Talentiq — reglas del proyecto

## Objetivo y alcance

Talentiq es una aplicación de apoyo a reclutadores. El alcance acordado para la entrega final incluye:

- Registro e inicio de sesión de reclutadores mediante Google.
- Creación de empresas e invitación de compañeros.
- Un banco privado de CVs compartido entre los miembros de cada empresa y aislado de otras empresas.
- Posiciones persistentes con estado propio: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Perfiles de candidatos y archivos CV persistidos; los archivos se almacenan en un bucket privado.
- Carga masiva con progreso y errores independientes por CV.
- Evaluaciones persistentes por relación candidato–posición y reutilización del candidato en distintas posiciones abiertas.
- Etapas por cada cruce candidato–posición: `Evaluado`, `En entrevista` o `Descartado`.
- Generación de preguntas de entrevista a partir de los requisitos y el análisis del cruce.
- Llamadas principales a Azure OpenAI desde el backend, sin exponer secretos en el frontend.
- Despliegue accesible y verificación de un flujo funcional como objetivo de entrega.

Este es el alcance acordado, no una afirmación de que esas capacidades estén implementadas. El estado actual y las decisiones pendientes se describen en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) y [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md). Las historias propuestas están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## Reglas de implementación

- Stack actual: Vite, React 19 y TypeScript en modo estricto. Actualizar esta descripción cuando cambie el proyecto.
- Nunca usar `any`.
- Un componente por archivo, con export nombrado, siguiendo los patrones existentes.
- Usar elementos HTML nativos (`button`, `input`, `label`, `textarea`); no usar un `div` con `onClick`.
- Agregar `data-testid` en kebab-case a los elementos que necesiten las pruebas.
- Validar autenticación, membresía y autorización en el backend para cada operación sobre los datos y archivos de una empresa.
- No usar controles de la interfaz como sustituto del aislamiento de datos en el servidor.
- Mantener las claves de Azure OpenAI y otras credenciales exclusivamente en el backend; no incluir secretos en variables `VITE_*` ni en el bundle cliente.
- Informar explícitamente errores de autenticación, autorización, base de datos, almacenamiento y servicios de IA. No responder con éxito simulado ante fallos.
- Ampliar las pruebas para cubrir persistencia, aislamiento entre empresas, carga masiva, errores parciales, cruces y etapas independientes, así como flujos de autenticación.
- No instalar dependencias sin preguntar primero.

## Modelo de dominio a preservar

- El estado de una posición no es el estado de un candidato.
- La etapa de un candidato se guarda en su relación con una posición.
- Una evaluación corresponde a una relación candidato–posición y no debe reemplazar el resultado de otro cruce.
- Los datos y documentos de CV pertenecen al banco de una empresa y no se comparten con otras empresas.
- Las preguntas generadas deben usar el contexto del cruce candidato–posición seleccionado.

Los proveedores de autenticación, base de datos, almacenamiento privado y hosting aún requieren decisión. No fijar una tecnología o política de privacidad no acordada.

## Contexto obligatorio para tareas de desarrollo

- Consultar primero [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) para distinguir alcance objetivo e implementación presente.
- Revisar `App.tsx` y los archivos involucrados solo después de identificar el área afectada.
- No asumir que una funcionalidad del alcance ya está implementada porque figure en las historias.
- Antes de crear cualquier work item en Azure DevOps, mostrar qué se va a crear y esperar confirmación.
- Con Playwright, tomar un snapshot de la página antes de escribir un selector; nunca inventar selectores.
