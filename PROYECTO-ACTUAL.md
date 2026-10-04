# Talentiq — proyecto actual

**Actualizado:** 4 de octubre de 2026  
**Estado general:** MVP funcional en desarrollo; todavía no alcanza el alcance acordado para la entrega final.

Este documento separa las capacidades conectadas en la aplicación de las que solo tienen esquema, prototipos o planificación. La existencia de una tabla o una historia no significa que la función esté disponible para el usuario.

## Resumen

Hoy se puede iniciar sesión con Google, gestionar puestos guardados en Supabase y analizar un CV PDF individual contra los requisitos de un puesto. La evaluación y la importación de ofertas llaman a un backend que valida la sesión de Supabase antes de usar Azure OpenAI. La aplicación también ofrece tema claro/oscuro.

Después de un análisis exitoso, la app sube el PDF individual al bucket privado y guarda candidato, metadatos y texto extraído en Supabase. El usuario confirmó que un PDF de prueba se subió correctamente a la base de datos desde la aplicación. No se persisten aún los resultados de evaluación ni las solicitudes. Las credenciales Azure se leen solo como variables server-side `AZURE_OPENAI_*`; según la aclaración del usuario, se usaron en local, por lo que no hace falta rotarlas salvo que se hayan compartido o publicado.

## Implementado y conectado

| Área | Estado actual |
|---|---|
| Acceso | Inicio y cierre de sesión con Google mediante Supabase Auth. La app bloquea el espacio privado si no hay sesión. La suite prueba el flujo con Supabase simulado; el contexto del proyecto registra que el usuario también confirmó el OAuth real. |
| Puestos | Listado, creación, detalle y edición. Se guardan y consultan en Supabase, aislados por `recruiter_id`; `save_position` persiste puesto y habilidades en una operación transaccional. El contexto registra que el usuario confirmó la aplicación de las migraciones y un guardado real correcto. |
| Requisitos | Nombre/rol, seniority y peso del seniority, habilidades y peso individual de 1 a 10. |
| Estado del puesto | Se muestra el estado (`Nueva`, `Abierta`, `Cubierta` o `Cancelada`) recibido de Supabase. La interfaz crea puestos como `Nueva`, pero no ofrece acciones para cambiar ese estado. |
| CV individual | Selección o arrastre de un PDF de hasta 5 MB; PDF.js extrae el texto en el navegador. Tras un análisis exitoso, se almacena el archivo en el bucket privado y se guardan metadatos y texto extraído vinculados a un candidato. El usuario confirmó una carga real exitosa contra su instancia de Supabase. |
| Evaluación | El cliente envía requisitos, texto del CV y token de sesión al backend; este valida la sesión con Supabase y llama a Azure OpenAI usando credenciales server-side. Devuelve puntaje, veredicto, fortalezas y brechas. Si falta configuración o falla el servicio, informa un error; no genera una evaluación local de respaldo. El umbral actual de aprobación es 70 %. |
| Presentación | Rutas de puestos, diseño adaptable y tema claro/oscuro; la preferencia del tema se conserva en `sessionStorage`. |
| Importación de ofertas | Hay componente, servicio cliente y endpoint Node autenticado para extraer requisitos desde ofertas públicas de LinkedIn o Computrabajo. El flujo no está conectado a la pantalla de creación de puestos y no tiene pruebas E2E propias. |

## Existe en la base de datos y se está conectando a la aplicación

La migración inicial define tablas para perfiles, candidatos, documentos, solicitudes, ejecuciones de evaluación y preguntas de entrevista, además de políticas RLS y un bucket privado `candidate-cvs`. También existen migraciones para guardar puestos y sus habilidades, y para persistir atómicamente el perfil y el documento de un CV.

La clave `SUPABASE_SERVICE_ROLE_KEY` ya está configurada en el `.env` local (se verificó su presencia sin leer ni mostrar el valor). El usuario confirmó que aplicó la migración nueva de persistencia de CV y que un PDF quedó guardado correctamente desde la aplicación. La conexión de base de datos disponible en este entorno no permite verificar directamente el esquema remoto. Las tablas de solicitudes, evaluaciones y preguntas todavía no están conectadas; tampoco hay un listado del banco de candidatos.

## Pendiente para completar el alcance acordado

### Prioridad alta: seguridad y flujo persistente

- Rotar la clave de Azure solo si se compartió o publicó fuera del entorno local; el usuario indicó que el uso fue local.
- Al incorporar persistencia, validar en el backend la propiedad de posición, candidato, documento y solicitud para el reclutador autenticado.
- Agregar una pantalla/listado del banco privado de candidatos y resolver la detección de duplicados.
- Implementar eliminación autorizada de candidatos y documentos desde la aplicación.
- Implementar la carga de varios CVs con progreso y errores independientes por archivo.
- Crear solicitudes por pareja candidato–posición y permitir reutilizar el candidato en distintas posiciones abiertas.
- Guardar y consultar ejecuciones de evaluación como historial; mantener la etapa (`Evaluado`, `En entrevista` o `Descartado`) por solicitud.
- Agregar acciones en la interfaz para gestionar los estados de las posiciones.

### Funcionalidades adicionales del alcance

- Generar y persistir preguntas de entrevista usando los requisitos y el resultado de la solicitud seleccionada.
- Conectar la importación de requisitos de ofertas al formulario de puestos y probar errores y respuestas inválidas.
- Completar pruebas de integración para persistencia real o entorno de prueba, autorización y aislamiento entre reclutadores, carga masiva, solicitudes, historial, etapas y preguntas.
- Desplegar la aplicación y verificar de punta a punta un flujo funcional con servicios configurados de forma segura.

### Decisiones que todavía requieren definición

- Hosting y estrategia de despliegue.
- Detección y tratamiento de candidatos duplicados.
- Límites y formatos de los archivos.
- Consentimiento, retención y eliminación de datos personales y CVs.

No se considera OCR de CVs escaneados como una capacidad implementada: el flujo actual extrae texto con PDF.js y no se encontró integración de OCR.

## Validación ejecutada el 4 de octubre de 2026

| Comando | Resultado |
|---|---|
| `npm run lint` | Finalizó correctamente. Oxlint informó una advertencia `react(set-state-in-effect)` en `src/App.tsx`. |
| `npm run build` | Finalizó correctamente. Vite informó chunks mayores a 500 kB: bundle principal de aproximadamente 899 kB y worker PDF de aproximadamente 1.265 kB. |
| `npm run test:server` | 7 pruebas backend aprobadas; verifican autenticación Supabase simulada antes de invocar Azure o guardar datos del candidato. |
| `npx playwright test --reporter=line` | 15 de 15 pruebas E2E aprobadas en Chromium tras el cambio. |

Las pruebas automatizadas de autenticación y puestos usan respuestas simuladas de Supabase; las pruebas backend simulan Supabase y Azure OpenAI, y las de evaluación/persistencia en Playwright simulan API y Storage. Por lo tanto, no verifican conectividad real contra servicios remotos. Aparte de esas pruebas, el usuario confirmó que aplicó la migración nueva y realizó una carga real exitosa de un PDF desde la aplicación.

## Cómo mantener este documento actualizado

Actualizar el resumen, la tabla de estado, los pendientes y la fecha en la misma tarea que cambie una capacidad visible o su integración con servicios. Si un cambio solo es interno y no modifica comportamiento, alcance, seguridad ni estado de despliegue, no hace falta cambiar este documento.

La actualización es deliberada y se hace junto con cada cambio; no se genera automáticamente a partir del código porque la diferencia entre “implementado”, “conectado” y “verificado en un servicio real” requiere contexto que una extracción automática no puede determinar de forma fiable. La instrucción para futuras tareas de desarrollo está en `AGENTS.md`.
