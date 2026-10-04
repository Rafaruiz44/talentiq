# Talentiq: alcance propuesto para la entrega final

Este documento registra la ampliación del alcance acordada para la entrega final. Reemplaza, para la planificación de esta entrega, las restricciones del MVP que excluían autenticación, persistencia y procesamiento masivo. No implica que estas capacidades ya estén implementadas.

## Objetivo

Ofrecer a cada reclutador autenticado un espacio privado para administrar sus posiciones, mantener un banco reutilizable de CVs, registrar solicitudes candidato–posición, seguir cada proceso y preparar entrevistas.

La evaluación de IA es una herramienta de apoyo. La decisión de selección corresponde al equipo reclutador.

## Decisiones acordadas

- Cada reclutador debe tener una cuenta y podrá registrarse/iniciar sesión con Google, si la integración elegida lo permite.
- En esta etapa, cada reclutador es propietario de su espacio privado, sus posiciones y su banco de candidatos.
- No se incluyen empresas, invitaciones ni colaboración/compartición de datos entre reclutadores en esta entrega.
- Las posiciones tienen estado propio: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- La etapa del candidato se mantiene por cada relación candidato–posición: `Evaluado`, `En entrevista` o `Descartado`.
- Los CVs se almacenan en un bucket privado. La base de datos conserva sus metadatos, el texto extraído y la referencia al archivo.
- El reclutador puede asociar un candidato de su banco a varias posiciones abiertas; cada solicitud/postulación corresponde a una relación candidato–posición.
- Cada nueva evaluación se conserva como una ejecución histórica de esa solicitud y no reemplaza resultados previos.
- Las llamadas a Azure OpenAI para evaluación y generación de preguntas deben realizarse desde el backend. Las credenciales no deben incluirse en el frontend.
- El despliegue accesible forma parte del objetivo de entrega y debe probarse con un flujo funcional.

## Alcance funcional

1. Registro e inicio de sesión de reclutadores mediante Google.
2. Alta, consulta y gestión de posiciones persistentes propiedad del reclutador.
3. Banco privado de candidatos del reclutador con CVs y texto extraído persistidos.
4. Carga de varios CVs con progreso y errores independientes por archivo.
5. Solicitudes candidato–posición persistentes para posiciones abiertas, con reutilización de candidatos.
6. Historial de evaluaciones y gestión independiente de la etapa de cada solicitud.
7. Generación de preguntas de entrevista a partir de requisitos, fortalezas y brechas de la solicitud.
8. Publicación y verificación de una instancia accesible de la aplicación.

## Modelo funcional inicial

| Entidad | Responsabilidad y relaciones |
|---|---|
| Reclutador | Usuario autenticado mediante Google; propietario de su espacio privado de trabajo. |
| Posición | Pertenece a un reclutador y conserva requisitos, ponderaciones y su propio estado. |
| Candidato | Pertenece al banco privado de un reclutador; conserva datos del perfil y referencia a sus documentos. |
| Documento de candidato | Metadatos, texto extraído y referencia privada al archivo del CV. |
| Solicitud candidato–posición | Relaciona un candidato con una posición del mismo reclutador y conserva la etapa del proceso. |
| Ejecución de evaluación | Resultado histórico asociado a una solicitud; conserva puntaje, fortalezas, brechas y fecha. |
| Preguntas de entrevista | Se asocian a una ejecución concreta y usan sus requisitos, fortalezas y brechas. |

La relación candidato–posición no debe modelarse como un atributo global del candidato: una persona puede tener solicitudes, resultados y etapas diferentes en distintas posiciones. En esta primera etapa los datos pertenecen a un solo reclutador y no se comparten entre cuentas.

## Propuesta técnica inicial para validar

Como diseño inicial se propone Supabase para PostgreSQL, autenticación con Google y almacenamiento privado de CVs. Es una recomendación de arquitectura, no significa que el proyecto ya tenga un proyecto Supabase ni que se hayan configurado credenciales, políticas o recursos. El backend Node existente puede evolucionar para llamadas a Azure OpenAI y operaciones que requieran credenciales de servidor; no se propone acceder a Azure OpenAI con una clave desde el navegador.

### Tablas y relaciones propuestas

| Tabla | Campos principales propuestos | Relación y restricciones |
|---|---|---|
| `profiles` | `user_id`, nombre visible, correo | `user_id` referencia al usuario autenticado de Supabase. |
| `positions` | `id`, `recruiter_id`, título, seniority, puntos, estado, fechas | Pertenece al reclutador autenticado; estado limitado a `Nueva`, `Abierta`, `Cubierta` o `Cancelada`. |
| `position_skills` | `position_id`, nombre de habilidad, peso | Una habilidad por posición; peso entre 1 y 10. |
| `candidates` | `id`, `recruiter_id`, nombre, correo opcional, datos normalizados permitidos, fechas | Pertenece al banco privado de un reclutador. Los atributos exactos y la política de duplicados quedan pendientes. |
| `candidate_documents` | `id`, `recruiter_id`, `candidate_id`, nombre original, tipo MIME, tamaño, ruta privada, texto extraído, estado de procesamiento, fechas | El binario se guarda en Storage; la base guarda metadatos, texto y ruta. El estado permite informar carga/procesamiento individual. |
| `applications` | `id`, `recruiter_id`, `candidate_id`, `position_id`, etapa, fechas | Una solicitud por candidato y posición; candidato y posición deben pertenecer al mismo reclutador. La etapa vive aquí. |
| `evaluation_runs` | `id`, `recruiter_id`, `application_id`, documento analizado, puntaje obtenido/total, veredicto, fortalezas, brechas, fecha, estado | Cada ejecución se conserva como historial bajo una solicitud. La más reciente puede mostrarse como vigente sin borrar las anteriores. |
| `interview_questions` | `id`, `evaluation_run_id`, contenido, fecha de generación | Pertenece a una ejecución concreta y usa sus requisitos, fortalezas y brechas. |

Se recomienda usar claves foráneas compuestas que incluyan `recruiter_id` para impedir en la base que una solicitud vincule un candidato y una posición de propietarios distintos. La unicidad de `applications` será `(recruiter_id, candidate_id, position_id)`. Cada reanálisis inserta una nueva fila en `evaluation_runs`; la etapa pertenece a la solicitud y no a cada ejecución.

### Reglas de acceso propuestas

- Activar Row Level Security (RLS) en todas las tablas con datos privados; la política debe verificar que `recruiter_id` corresponda a `auth.uid()`.
- Las operaciones de alta y modificación deben derivar la propiedad de la sesión autenticada o validar explícitamente que coincida; no confiar en un `recruiter_id` arbitrario recibido desde la interfaz.
- Los clientes autenticados pueden crear documentos solo en estado pendiente y consultar su estado; el backend autorizado valida el archivo y escribe el texto extraído y su estado final.
- Los clientes autenticados pueden consultar el historial de evaluaciones y preguntas, pero su creación corresponde al backend después de validar y completar el análisis; las ejecuciones históricas no se actualizan desde el cliente.
- Usar el bucket de CVs como privado. La ruta debe incluir el identificador del reclutador y las políticas de Storage deben comprobar que el usuario autenticado sea propietario y que exista el registro correspondiente.
- Para descargar un CV, emitir un enlace firmado de corta duración solo después de autorizar la solicitud, o transmitir el archivo mediante backend autenticado.
- La clave administrativa `service_role`, si el backend la necesita, es solo server-side y nunca se entrega al navegador. La clave pública del cliente no reemplaza las políticas RLS.
- No persistir credenciales de Google. Proteger también el texto extraído del CV como dato personal sujeto a las mismas políticas que el archivo.

### Flujo vertical inicial recomendado

1. Un reclutador inicia sesión con Google mediante Supabase Auth.
2. La sesión obtiene un espacio privado propio sin crear una entidad empresa.
3. El reclutador crea una posición y la base la asocia a su identidad autenticada y aplica RLS.
4. El reclutador consulta solo sus posiciones y su banco de candidatos.
5. Se verifica desde una segunda cuenta que no puede leer ni alterar datos de la primera.

Este primer flujo valida autenticación y aislamiento por reclutador antes de cargar CVs sensibles. La carga de un CV debe añadirse solo cuando el bucket privado y sus políticas de acceso puedan verificarse.

## Historias de usuario propuestas

### Feature: Acceso privado del reclutador

#### HU-01 — Registrarse e iniciar sesión con Google

**Como** reclutador, **quiero** registrarme e iniciar sesión con mi cuenta de Google, **para** acceder de forma segura a mi espacio privado en Talentiq sin administrar una contraseña adicional.

**Criterios de aceptación**

- **Escenario: Registro con Google**
  - **Dado** que una persona aún no tiene una cuenta de Talentiq
  - **Cuando** completa el flujo de autenticación de Google
  - **Entonces** se crea o reconoce su cuenta y queda autenticada sin guardar su contraseña de Google en Talentiq.
- **Escenario: Cancelación o error de autenticación**
  - **Dado** que la persona inicia el acceso con Google
  - **Cuando** cancela el flujo o el proveedor devuelve un error
  - **Entonces** Talentiq no crea una sesión autenticada y muestra un mensaje que permite reintentar.
- **Escenario: Cierre de sesión**
  - **Dado** que el reclutador está autenticado
  - **Cuando** cierra sesión
  - **Entonces** deja de acceder a las pantallas y datos privados de su cuenta.

### Feature: Gestión de posiciones

#### HU-02 — Crear y consultar posiciones persistentes

**Como** reclutador, **quiero** registrar y consultar mis posiciones con sus requisitos, **para** reutilizarlas en el proceso de selección.

**Criterios de aceptación**

- **Escenario: Crear posición**
  - **Dado** que inicié sesión y completo los datos y requisitos obligatorios
  - **Cuando** guardo la posición
  - **Entonces** queda persistida en mi espacio privado con estado `Nueva`.
- **Escenario: Reabrir la aplicación**
  - **Dado** que guardé una posición
  - **Cuando** vuelvo a iniciar sesión y consulto mis posiciones
  - **Entonces** la posición y sus requisitos siguen disponibles en mi cuenta.
- **Escenario: Aislamiento entre reclutadores**
  - **Dado** que una posición pertenece a otra cuenta
  - **Cuando** consulto mis posiciones
  - **Entonces** esa posición no aparece ni puede consultarse desde mi cuenta.

#### HU-03 — Cambiar el estado de una posición

**Como** reclutador, **quiero** cambiar el estado de una posición propia, **para** reflejar su situación sin alterar las etapas de sus solicitudes.

**Criterios de aceptación**

- **Escenario: Actualizar estado**
  - **Dado** que tengo acceso a una posición
  - **Cuando** cambio su estado a `Abierta`, `Cubierta` o `Cancelada`
  - **Entonces** se guarda el nuevo estado de la posición.
- **Escenario: Mostrar estados permitidos**
  - **Dado** que consulto una posición
  - **Entonces** su estado se representa con uno de los valores `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- **Escenario: No modificar etapas de candidatos**
  - **Dado** que una posición tiene candidatos en distintas etapas
  - **Cuando** cambio el estado de la posición
  - **Entonces** las etapas de esos candidatos permanecen sin cambios.

### Feature: Banco de CVs y procesamiento

#### HU-04 — Incorporar un candidato y guardar su CV

**Como** reclutador, **quiero** incorporar un CV a mi banco privado, **para** reutilizar el perfil en distintas posiciones.

**Criterios de aceptación**

- **Escenario: Carga correcta**
  - **Dado** que selecciono un archivo admitido
  - **Cuando** se procesa y guarda correctamente
  - **Entonces** el perfil y el texto extraído quedan persistidos y el archivo queda en almacenamiento privado.
- **Escenario: Volver a consultar el candidato**
  - **Dado** que un candidato se guardó correctamente
  - **Cuando** vuelvo a buscarlo en mi banco
  - **Entonces** puede consultar sus datos y el texto extraído, y acceder al archivo mediante un mecanismo autorizado.
- **Escenario: Archivo no procesable**
  - **Dado** que el archivo está dañado, vacío o no es admitido
  - **Cuando** intento cargarlo
  - **Entonces** se informa el error y no se registra como CV procesado correctamente.
- **Escenario: Privacidad entre reclutadores**
  - **Dado** que el CV pertenece al banco de otro reclutador
  - **Cuando** intento consultarlo desde mi cuenta
  - **Entonces** no puedo obtener el perfil ni descargar el archivo.

#### HU-05 — Cargar varios CVs con progreso y errores independientes

**Como** reclutador, **quiero** cargar varios CVs a mi banco y ver el resultado de cada procesamiento, **para** incorporar candidatos en menos tiempo y detectar los casos fallidos.

**Criterios de aceptación**

- **Escenario: Procesamiento del lote**
  - **Dado** que seleccioné varios archivos válidos
  - **Cuando** inicio la carga masiva
  - **Entonces** cada archivo se procesa individualmente y la interfaz muestra progreso y estado por archivo.
- **Escenario: Error parcial**
  - **Dado** que un archivo del lote falla
  - **Cuando** continúa el procesamiento de los demás archivos
  - **Entonces** se conserva el resultado de cada archivo exitoso y se muestra el error asociado al fallido.
- **Escenario: Finalización**
  - **Dado** que todos los archivos terminaron de procesarse
  - **Entonces** puedo distinguir los procesados correctamente de los que requieren una nueva carga.

### Feature: Evaluación y seguimiento

#### HU-06 — Crear una solicitud y evaluar un candidato para una posición abierta

**Como** reclutador, **quiero** asociar un candidato de mi banco a una posición abierta y evaluarlo, **para** iniciar una solicitud de selección con un resultado consultable y trazable.

**Criterios de aceptación**

- **Escenario: Evaluación correcta**
  - **Dado** que el candidato y la posición pertenecen a mi cuenta y la posición está `Abierta`
  - **Cuando** solicito el análisis
  - **Entonces** se crea o actualiza la solicitud de ese candidato para esa posición y se guarda una ejecución con puntaje, veredicto, fortalezas, brechas y fecha.
- **Escenario: Inicializar etapa**
  - **Dado** que se guarda la primera evaluación de un candidato para una posición
  - **Entonces** la etapa de la solicitud queda en `Evaluado`.
- **Escenario: Posición no abierta**
  - **Dado** que la posición no está `Abierta`
  - **Cuando** intento iniciar una evaluación nueva
  - **Entonces** el análisis no se inicia y se informa que la posición no admite nuevos cruces.
- **Escenario: Error de análisis**
  - **Dado** que el servicio de análisis falla
  - **Cuando** recibo el error
  - **Entonces** se informa el fallo y no se muestra ni persiste una evaluación como exitosa.
- **Escenario: Reanalizar sin perder historial**
  - **Dado** que ya existe una solicitud con una o más evaluaciones para el candidato y la posición
  - **Cuando** solicito un nuevo análisis
  - **Entonces** se conserva el historial y se agrega una nueva ejecución a la solicitud existente sin duplicar la solicitud.

#### HU-07 — Reutilizar un candidato en varias posiciones

**Como** reclutador, **quiero** asociar un candidato de mi banco a varias posiciones abiertas, **para** conservar solicitudes y resultados separados para cada búsqueda.

**Criterios de aceptación**

- **Escenario: Evaluar en más de una posición**
  - **Dado** que un candidato pertenece a mi banco y hay varias posiciones abiertas
  - **Cuando** lo evalúo frente a cada posición
  - **Entonces** queda una solicitud candidato–posición por cada cruce, con su historial independiente.
- **Escenario: Consultar resultados**
  - **Dado** que un candidato tiene evaluaciones para distintas posiciones
  - **Cuando** consulto su historial de cruces
  - **Entonces** cada resultado muestra la posición correspondiente y no se reemplaza por el de otra posición.
- **Escenario: Banco de otro reclutador**
  - **Dado** que el candidato pertenece al banco de otro reclutador
  - **Cuando** intento reutilizarlo desde mi cuenta
  - **Entonces** no puedo acceder a su CV ni crear una solicitud con él.

#### HU-08 — Actualizar la etapa de una solicitud

**Como** reclutador, **quiero** actualizar la etapa de un candidato para una posición, **para** registrar el avance de esa solicitud sin afectar sus otras solicitudes.

**Criterios de aceptación**

- **Escenario: Avanzar a entrevista**
  - **Dado** que existe una evaluación candidato–posición
  - **Cuando** cambio su etapa a `En entrevista`
  - **Entonces** queda guardada en ese cruce.
- **Escenario: Descartar un cruce**
  - **Dado** que existe una evaluación candidato–posición
  - **Cuando** cambio su etapa a `Descartado`
  - **Entonces** esa etapa queda guardada sin descartar automáticamente al candidato en otras posiciones.
- **Escenario: Etapas independientes**
  - **Dado** que un candidato tiene cruces con más de una posición
  - **Cuando** modifico la etapa de uno de ellos
  - **Entonces** las etapas de los demás cruces no cambian.

### Feature: Preparación de entrevistas

#### HU-09 — Generar preguntas de entrevista contextualizadas

**Como** reclutador, **quiero** generar preguntas para un candidato y una posición, **para** profundizar en requisitos relevantes y validar fortalezas o brechas.

**Criterios de aceptación**

- **Escenario: Generación contextualizada**
  - **Dado** que existe una evaluación candidato–posición
  - **Cuando** solicito preguntas de entrevista
  - **Entonces** las preguntas consideran los requisitos de esa posición y las fortalezas o brechas del candidato en ese cruce.
- **Escenario: No mezclar cruces**
  - **Dado** que el candidato tiene evaluaciones en distintas posiciones
  - **Cuando** genero preguntas para una de ellas
  - **Entonces** las preguntas no utilizan requisitos ni resultados pertenecientes a las otras posiciones.
- **Escenario: Servicio no disponible**
  - **Dado** que el servicio de generación falla
  - **Cuando** solicito las preguntas
  - **Entonces** se informa el error sin presentar contenido como si se hubiera generado correctamente.

### Objetivo de entrega: Despliegue

#### HU-10 — Acceder a una versión desplegada y funcional

**Como** docente o integrante del equipo, **quiero** acceder a Talentiq desde una URL publicada, **para** verificar el flujo funcional de la entrega.

**Criterios de aceptación**

- **Escenario: Aplicación accesible**
  - **Dado** que se entrega la URL pública de Talentiq
  - **Cuando** la abro desde un navegador compatible
  - **Entonces** la aplicación carga sin depender del entorno local del equipo.
- **Escenario: Flujo integrado**
  - **Dado** que inicio sesión con una cuenta autorizada
  - **Cuando** creo o consulto una posición y accedo a un CV autorizado
  - **Entonces** frontend, backend, autenticación, base de datos y almacenamiento funcionan integrados.
- **Escenario: Secretos protegidos**
  - **Dado** que la aplicación está desplegada
  - **Cuando** inspecciono los recursos públicos del frontend
  - **Entonces** no se exponen claves de Azure OpenAI ni credenciales de servicios.

## Reglas de negocio transversales

- La autorización se valida en el backend para cada operación sobre posiciones, candidatos, solicitudes, evaluaciones y archivos.
- Los datos y archivos de un reclutador no son visibles ni accesibles desde otras cuentas.
- La identidad Google del reclutador y el perfil de candidato son conceptos diferentes.
- El estado de una posición y la etapa de un candidato en una posición son independientes.
- Una solicitud pertenece a una pareja candidato–posición; cada nueva evaluación crea una ejecución histórica dentro de esa solicitud.
- En el alcance actual, las solicitudes son registros internos creados por el reclutador al asociar un candidato del banco a una vacante. No se incluye un portal público para que candidatos presenten solicitudes por su cuenta.
- La carga masiva debe reportar errores por archivo y permitir que los demás archivos del lote continúen.
- Los errores de almacenamiento o IA deben mostrarse explícitamente; no deben transformarse en resultados de éxito de respaldo sin indicarlo.
- Las credenciales de Azure OpenAI permanecen en el backend y los archivos de CV se almacenan en un bucket privado.

## Decisiones pendientes antes de implementar

- Confirmar Supabase y el plan/proyecto; decidir dónde se alojará el backend Node y cómo se conectará de forma segura a Supabase.
- Regla para detectar candidatos duplicados dentro del banco de un reclutador.
- Tipos y tamaños máximos de archivo, tratamiento de CVs escaneados y conducta ante documentos sin texto extraíble.
- Consentimiento, retención, descarga y eliminación de CVs y datos personales.
- Requisitos de acceso a la demo desplegada y configuración de sus datos de prueba.
- Confirmar si en una etapa futura se necesitarán espacios compartidos por empresas y colaboración entre reclutadores.

## Notas de trazabilidad con el estado actual

El repositorio implementa hoy una interfaz React/Vite que conserva en memoria los requisitos de una posición, un CV PDF y su resultado de análisis. `server/server.mjs` valida sesiones Supabase antes de aceptar solicitudes de evaluación o importación, y llama a Azure OpenAI usando variables server-side `AZURE_OPENAI_*`. La integración real contra servicios remotos no queda verificada por las pruebas simuladas. Siguen pendientes la persistencia de candidatos, almacenamiento de CVs, solicitudes, evaluaciones, estados y preguntas.

Las pruebas E2E actuales cubren la definición de requisitos, carga de un PDF, análisis de un CV y cambio de tema. No cubren las historias propuestas en este documento. El despliegue se considera objetivo pendiente, no capacidad ya entregada.
