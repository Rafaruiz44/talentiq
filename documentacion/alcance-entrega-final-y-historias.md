# Talentiq: alcance propuesto para la entrega final

Este documento registra la ampliación del alcance acordada para la entrega final. Reemplaza, para la planificación de esta entrega, las restricciones del MVP que excluían autenticación, persistencia y procesamiento masivo. No implica que estas capacidades ya estén implementadas.

## Objetivo

Ofrecer a empresas un espacio privado de reclutamiento en el que sus reclutadores puedan administrar posiciones, mantener un banco reutilizable de CVs, evaluar candidatos frente a una o más posiciones abiertas, seguir sus etapas y preparar entrevistas.

La evaluación de IA es una herramienta de apoyo. La decisión de selección corresponde al equipo reclutador.

## Decisiones acordadas

- Cada reclutador debe tener una cuenta y podrá registrarse/iniciar sesión con Google, si la integración elegida lo permite.
- El primer reclutador crea la empresa y puede invitar a sus compañeros.
- Cada empresa tiene un banco privado compartido por los reclutadores que sean miembros de esa empresa.
- Los bancos de distintas empresas deben estar aislados.
- Las posiciones tienen estado propio: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- La etapa del candidato se mantiene por cada relación candidato–posición: `Evaluado`, `En entrevista` o `Descartado`.
- Los CVs se almacenan en un bucket privado. La base de datos conserva sus metadatos, el texto extraído y la referencia al archivo.
- Los CVs pueden cruzarse con varias posiciones abiertas; cada resultado pertenece a su relación candidato–posición.
- Las llamadas a Azure OpenAI para evaluación y generación de preguntas deben realizarse desde el backend. Las credenciales no deben incluirse en el frontend.
- El despliegue accesible forma parte del objetivo de entrega y debe probarse con un flujo funcional.

## Alcance funcional

1. Registro e inicio de sesión de reclutadores mediante Google.
2. Creación de empresa, invitación de compañeros y acceso privado compartido a los datos de la empresa.
3. Alta, consulta y gestión de posiciones persistentes.
4. Banco de candidatos con CVs y texto extraído persistidos.
5. Carga de varios CVs con progreso y errores independientes por archivo.
6. Evaluaciones persistentes entre candidatos y posiciones abiertas, incluida la reutilización en varias posiciones.
7. Gestión independiente de la etapa de cada candidato en cada posición.
8. Generación de preguntas de entrevista a partir de requisitos, fortalezas y brechas del cruce.
9. Publicación y verificación de una instancia accesible de la aplicación.

## Modelo funcional inicial

| Entidad | Responsabilidad y relaciones |
|---|---|
| Empresa | Define el espacio de datos aislado al que pertenecen posiciones y candidatos. |
| Reclutador | Identidad autenticada mediante Google; puede pertenecer a una o más empresas según se defina el flujo de invitaciones. |
| Membresía | Relaciona un reclutador con una empresa y representa su acceso al espacio privado. |
| Posición | Pertenece a una empresa; conserva requisitos, ponderaciones y su propio estado. |
| Candidato | Pertenece al banco de una empresa; conserva los datos del perfil, metadatos del CV, texto extraído y referencia al archivo privado. |
| Evaluación candidato–posición | Relaciona un candidato con una posición de la misma empresa; conserva resultado, puntaje, fortalezas, brechas y etapa de esa relación. |
| Preguntas de entrevista | Se asocian al cruce candidato–posición que aportó los requisitos, fortalezas y brechas. |

La pertenencia del candidato a una empresa evita compartir CVs entre bancos privados. La evaluación y su etapa no deben modelarse como atributos globales del candidato: una persona puede tener resultados y etapas diferentes en distintas posiciones.

## Historias de usuario propuestas

### Feature: Acceso y espacio privado de empresa

#### HU-01 — Registrarse e iniciar sesión con Google

**Como** reclutador, **quiero** registrarme e iniciar sesión con mi cuenta de Google, **para** acceder de forma segura a Talentiq sin administrar una contraseña adicional.

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
  - **Entonces** deja de acceder a las pantallas y datos privados de la empresa.

#### HU-02 — Crear una empresa y su espacio privado

**Como** primer reclutador de una empresa, **quiero** crear el espacio de mi empresa, **para** organizar allí posiciones y candidatos de forma privada.

**Criterios de aceptación**

- **Escenario: Crear empresa**
  - **Dado** que inicié sesión y todavía no pertenezco a una empresa
  - **Cuando** ingreso los datos obligatorios y confirmo la creación
  - **Entonces** se crea la empresa y quedo asociado a su espacio.
- **Escenario: Validación de datos**
  - **Dado** que intento crear una empresa
  - **Cuando** falta un dato obligatorio o el nombre no es válido
  - **Entonces** se informa el error y no se crea un espacio incompleto.
- **Escenario: Datos aislados por empresa**
  - **Dado** que existen empresas distintas
  - **Cuando** un reclutador consulta el espacio de su empresa
  - **Entonces** solo puede acceder a datos pertenecientes a empresas de las que es miembro.

#### HU-03 — Invitar reclutadores al espacio de empresa

**Como** reclutador de una empresa, **quiero** invitar a compañeros, **para** colaborar en el banco privado de la organización.

**Criterios de aceptación**

- **Escenario: Enviar invitación**
  - **Dado** que estoy autenticado y tengo acceso al espacio de la empresa
  - **Cuando** invito una dirección de correo válida
  - **Entonces** se registra o envía una invitación vinculada a esa empresa.
- **Escenario: Aceptar invitación**
  - **Dado** que una persona autenticada con Google tiene una invitación vigente
  - **Cuando** la acepta
  - **Entonces** queda asociada a la empresa y puede acceder a su banco privado.
- **Escenario: Invitación inválida o ya utilizada**
  - **Dado** que el enlace de invitación no existe, venció o ya fue utilizado
  - **Cuando** la persona intenta aceptarlo
  - **Entonces** no obtiene acceso y se informa cómo solicitar una nueva invitación.

### Feature: Gestión de posiciones

#### HU-04 — Crear y consultar posiciones persistentes

**Como** reclutador de una empresa, **quiero** registrar y consultar posiciones con sus requisitos, **para** reutilizarlas en el proceso de selección.

**Criterios de aceptación**

- **Escenario: Crear posición**
  - **Dado** que pertenezco a una empresa y completo los datos y requisitos obligatorios
  - **Cuando** guardo la posición
  - **Entonces** queda persistida en el espacio de esa empresa con estado `Nueva`.
- **Escenario: Reabrir la aplicación**
  - **Dado** que guardé una posición
  - **Cuando** vuelvo a iniciar sesión y consulto las posiciones de mi empresa
  - **Entonces** la posición y sus requisitos siguen disponibles.
- **Escenario: Aislamiento entre empresas**
  - **Dado** que una posición pertenece a otra empresa
  - **Cuando** consulto las posiciones de mi empresa
  - **Entonces** esa posición no aparece ni puede consultarse desde mi espacio.

#### HU-05 — Cambiar el estado de una posición

**Como** reclutador de una empresa, **quiero** cambiar el estado de una posición, **para** reflejar su situación sin alterar las etapas de sus candidatos.

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

#### HU-06 — Incorporar un candidato y guardar su CV

**Como** reclutador de una empresa, **quiero** incorporar un CV al banco privado, **para** reutilizar el perfil en distintas posiciones.

**Criterios de aceptación**

- **Escenario: Carga correcta**
  - **Dado** que selecciono un archivo admitido
  - **Cuando** se procesa y guarda correctamente
  - **Entonces** el perfil y el texto extraído quedan persistidos y el archivo queda en almacenamiento privado.
- **Escenario: Volver a consultar el candidato**
  - **Dado** que un candidato se guardó correctamente
  - **Cuando** un reclutador autorizado lo busca en el banco de su empresa
  - **Entonces** puede consultar sus datos y el texto extraído, y acceder al archivo mediante un mecanismo autorizado.
- **Escenario: Archivo no procesable**
  - **Dado** que el archivo está dañado, vacío o no es admitido
  - **Cuando** intento cargarlo
  - **Entonces** se informa el error y no se registra como CV procesado correctamente.
- **Escenario: Privacidad entre empresas**
  - **Dado** que el CV pertenece al banco de otra empresa
  - **Cuando** un reclutador sin membresía intenta consultarlo
  - **Entonces** no puede obtener el perfil ni descargar el archivo.

#### HU-07 — Cargar varios CVs con progreso y errores independientes

**Como** reclutador de una empresa, **quiero** cargar varios CVs y ver el resultado de cada procesamiento, **para** incorporar candidatos en menos tiempo y detectar los casos fallidos.

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

#### HU-08 — Evaluar y guardar un candidato frente a una posición abierta

**Como** reclutador de una empresa, **quiero** evaluar un candidato frente a una posición abierta, **para** conservar un resultado consultable y trazable.

**Criterios de aceptación**

- **Escenario: Evaluación correcta**
  - **Dado** que el candidato y la posición pertenecen a mi empresa y la posición está `Abierta`
  - **Cuando** solicito el análisis
  - **Entonces** se guarda un resultado asociado a ese candidato y a esa posición, con puntaje, veredicto, fortalezas, brechas y fecha.
- **Escenario: Inicializar etapa**
  - **Dado** que se guarda la primera evaluación de un candidato para una posición
  - **Entonces** el estado del cruce queda en `Evaluado`.
- **Escenario: Posición no abierta**
  - **Dado** que la posición no está `Abierta`
  - **Cuando** intento iniciar una evaluación nueva
  - **Entonces** el análisis no se inicia y se informa que la posición no admite nuevos cruces.
- **Escenario: Error de análisis**
  - **Dado** que el servicio de análisis falla
  - **Cuando** recibo el error
  - **Entonces** se informa el fallo y no se muestra ni persiste una evaluación como exitosa.

#### HU-09 — Reutilizar un candidato en varias posiciones

**Como** reclutador de una empresa, **quiero** evaluar un candidato contra varias posiciones abiertas, **para** conservar resultados separados para cada búsqueda.

**Criterios de aceptación**

- **Escenario: Evaluar en más de una posición**
  - **Dado** que un candidato pertenece a mi empresa y hay varias posiciones abiertas
  - **Cuando** lo evalúo frente a cada posición
  - **Entonces** queda un resultado candidato–posición por cada cruce.
- **Escenario: Consultar resultados**
  - **Dado** que un candidato tiene evaluaciones para distintas posiciones
  - **Cuando** consulto su historial de cruces
  - **Entonces** cada resultado muestra la posición correspondiente y no se reemplaza por el de otra posición.
- **Escenario: Banco de otra empresa**
  - **Dado** que el candidato pertenece a otra empresa
  - **Cuando** intento reutilizarlo
  - **Entonces** no puedo acceder a su CV ni crear un cruce con él.

#### HU-10 — Actualizar la etapa por cada cruce candidato–posición

**Como** reclutador de una empresa, **quiero** actualizar la etapa de un candidato para una posición, **para** registrar el avance de ese proceso sin afectar otros.

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

#### HU-11 — Generar preguntas de entrevista contextualizadas

**Como** reclutador de una empresa, **quiero** generar preguntas para un candidato y una posición, **para** profundizar en requisitos relevantes y validar fortalezas o brechas.

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

#### HU-12 — Acceder a una versión desplegada y funcional

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

- La autorización se valida en el backend para cada operación sobre empresas, posiciones, candidatos, evaluaciones y archivos.
- Los datos y archivos de una empresa no son visibles ni accesibles para miembros de otras empresas.
- La identidad Google del reclutador y el perfil de candidato son conceptos diferentes.
- El estado de una posición y la etapa de un candidato en una posición son independientes.
- Una evaluación pertenece a una única relación candidato–posición y no debe sobrescribir resultados de otros cruces.
- La carga masiva debe reportar errores por archivo y permitir que los demás archivos del lote continúen.
- Los errores de almacenamiento o IA deben mostrarse explícitamente; no deben transformarse en resultados de éxito de respaldo sin indicarlo.
- Las credenciales de Azure OpenAI permanecen en el backend y los archivos de CV se almacenan en un bucket privado.

## Decisiones pendientes antes de implementar

- Proveedor de autenticación Google, base de datos, bucket privado y hosting.
- Si una cuenta puede pertenecer a varias empresas y cómo cambia entre espacios.
- Permisos de los miembros: si todos pueden administrar invitaciones, posiciones y candidatos o si habrá roles.
- Regla para detectar candidatos duplicados dentro de una empresa.
- Comportamiento al volver a analizar el mismo candidato para la misma posición: reemplazar el resultado o conservar versiones históricas.
- Tipos y tamaños máximos de archivo, tratamiento de CVs escaneados y conducta ante documentos sin texto extraíble.
- Consentimiento, retención, descarga y eliminación de CVs y datos personales.
- Caducidad y revocación de invitaciones.
- Requisitos de acceso a la demo desplegada y configuración de sus datos de prueba.

## Notas de trazabilidad con el estado actual

El repositorio implementa hoy una interfaz React/Vite que conserva en memoria los requisitos de una posición, un CV PDF y su resultado de análisis. `server/server.mjs` contiene una API auxiliar para importar requisitos desde ofertas, pero no implementa persistencia, autenticación, almacenamiento de CVs ni evaluación backend del flujo principal. La evaluación principal de Azure OpenAI se inicia desde el frontend y utiliza variables `VITE_*`; debe trasladarse al backend antes de desplegar el nuevo alcance.

Las pruebas E2E actuales cubren la definición de requisitos, carga de un PDF, análisis de un CV y cambio de tema. No cubren las historias propuestas en este documento. El despliegue se considera objetivo pendiente, no capacidad ya entregada.
