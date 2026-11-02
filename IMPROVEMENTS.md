# IMPROVEMENTS.md

**TinyEnginy — propuesta de evolución**

Resumen del estado actual, mejoras propuestas y un orden realista para implementarlas. Es una hoja de ruta para discutir alcance, no una especificación cerrada.

## 1. Estado actual

TinyEnginy es un MVP de gestión de leads con CRUD, importación de CSV, generación de mensajes con placeholders y enriquecimiento (verificación de email y búsqueda de teléfono) mediante Temporal. La base funciona, pero está pensada como demo: no se envía ningún mensaje, solo se genera texto y se guarda en `lead.message`.

Para convertirlo en producto faltan **seguridad**, **datos mejor modelados** y **un flujo real de envío**.

| Área | Problema principal |
|---|---|
| Auth | No existe; cualquiera puede leer o borrar todos los leads. |
| Base de datos | SQLite (`dev.db`, además subido al repo); poco margen para concurrencia e importaciones grandes. |
| CSV | Un solo archivo, en el navegador; no se pueden importar varios a la vez. |
| Segmentos | No existen; los leads son una lista plana. |
| Mensajería | Solo genera texto; sin plantillas, imágenes, footer, envío, rebotes ni bajas. |
| API | Contratos inconsistentes: `PUT` vs `PATCH`, `name` vs `firstName`. |
| Duplicados | Se detectan por nombre y apellido, no por email. |
| Operación | CORS abierto, secretos en código y worker Temporal en el mismo proceso que la API. |

## 2. Mejoras propuestas

### 2.1 Auth y workspaces

Es la mejora que más desbloquea al resto: sin auth no hay usuarios, permisos ni campañas aisladas.

- Login con email/contraseña o proveedor externo, con sesión o JWT.
- `User`, `Workspace` y `Membership` con roles `OWNER`, `ADMIN` y `MEMBER`.
- `workspaceId` en leads, plantillas, segmentos, campañas e importaciones; todas las queries filtran por él.
- Tests de aislamiento entre workspaces.

### 2.2 PostgreSQL en lugar de SQLite

SQLite sirve para desarrollar, pero no para producción: escrituras concurrentes limitadas, menos tipos y peor comportamiento con importaciones grandes.

- PostgreSQL local con Docker Compose y `DATABASE_URL` en `.env`.
- Cambiar el `provider` de Prisma a `postgresql` y generar una migración inicial limpia.
- Índices: email normalizado único por workspace, `workspaceId`, `countryCode`, `companyName`, `createdAt` y `emailVerified`.
- `Json` para filtros de segmentos y contenido de plantillas.
- Migrar datos con un script, verificar conteos y eliminar `dev.db` del repo.
- `prisma migrate deploy` en CI/staging; `migrate dev` solo en local.

Antes del índice único hay que normalizar (`lower(trim(email))`) y resolver los duplicados existentes.

### 2.3 Importación multi-CSV

Objetivo: arrastrar varios CSV, revisarlos juntos y confirmar una única importación.

- `<input type="file" multiple>` y drag & drop.
- Parseo en el navegador con Papa Parse y preview unificada con archivo y fila de origen.
- Detección de encoding (UTF-8, UTF-16, Windows-1252) y delimitador (`,` `;` tabulador).
- Mapeo de columnas con alias (`firstName`, `first_name`, `nombre`; `phone`, `phoneNumber`, `teléfono`).
- Deduplicación por email normalizado, entre archivos y contra la base de datos.
- Envío al backend en lotes de 500–1.000 leads y resumen con importados, duplicados, inválidos y CSV de errores.

Para más de 50.000 filas se puede mover el parseo al backend con un job asíncrono; para el MVP, el cliente es suficiente.

### 2.4 Segmentos de leads

Objetivo: agrupar leads por edad, país, empresa, puesto, antigüedad o etiquetas y reutilizar esos grupos en campañas.

- Añadir `birthDate` (o `age` + fecha de referencia), `tags` y `companyNameNormalized`.
- Segmentos dinámicos guardados como filtros JSON: país, rango de edad, empresa, puesto, antigüedad y etiquetas.
- Constructor de filtros sencillo (campo, operador y valor, con AND/OR) y preview con número de leads y muestra.
- Al lanzar una campaña, guardar una copia de los destinatarios para que la audiencia no cambie si los leads se editan después.

Mejor guardar `birthDate` y calcular la edad; si el CSV solo trae edad, se guarda como aproximada y se marca la calidad del dato.

### 2.5 Mensajería personalizable y envío real

Hay que separar **componer** el mensaje y **enviarlo**.

**Composición:** `MessageTemplate` con nombre, canal (`EMAIL`/`SMS`), asunto, contenido y estado. Contenido por bloques (texto, imagen, botón, separador y footer), plantillas predefinidas, imágenes en S3/R2 con texto alternativo, variables con fallback (`{{firstName | "there"}}`) y preview/test send. El footer incluye baja, preferencias y dirección física en emails comerciales.

**Envío:** proveedor de email (Resend, Postmark o SES) y SMS después (Twilio). `Campaign` y `CampaignRecipient` con estados (pendiente, enviado, entregado, rebotado, queja, baja, fallido), envío por lotes con rate limiting, webhooks, lista de supresión, unsubscribe de un click y `List-Unsubscribe`. Para el MVP, solo email; SMS tiene opt-in, longitud, STOP/HELP y sender ID. Arreglar también el generador actual: falla si falta un campo y `.replace()` corrompe valores con `$`.

### 2.6 Otras mejoras técnicas

- Validar endpoints con Zod, unificar errores y corregir `PUT`/`PATCH` y `name`/`firstName`.
- Paginar y filtrar `GET /leads`, e insertar en lote con transacción.
- Deduplicar por email normalizado, no por nombre.
- IDs de workflow deterministas, timeouts coherentes y worker Temporal separado de la API.
- Claves de proveedores a variables de entorno; `helmet`, CORS con allowlist, rate limiting y límite de request.
- Arreglar la tabla de leads: LinkedIn no tiene cabecera y las columnas están desplazadas.
- Tests de rutas y componentes, CI, logs con `requestId` y `/health`.

## 3. Plan de ejecución

| Fase | Trabajo | Estimación |
|---|---|---|
| 0 | Quick wins: contratos API, dedupe por email, batch insert, Temporal, tabla, secretos y CI | 2–3 días |
| 1 | Auth + workspaces + aislamiento | 2–3 días |
| 2 | PostgreSQL + índices + migración de datos | 2–3 días |
| 3 | Importación multi-CSV + dedupe + informe de errores | 3–4 días |
| 4 | Campos de segmentación + filtros + preview | 3–4 días |
| 5 | Plantillas + editor de bloques + imágenes + footer | 4–5 días |
| 6 | Campañas email + proveedor + webhooks + bajas | 4–5 días |
| 7 | SMS y analítica | 3–4 días |

**Total orientativo:** 3–4 semanas para una persona, sin contar revisión legal ni calentamiento del dominio de email. Es una estimación de producto, no del tiempo de la prueba técnica.

**Orden:** fase 0 → auth y PostgreSQL → importación multi-CSV → segmentos → mensajería email → SMS.

## 4. Riesgos

- **Alcance:** asumo envío real por email. Si solo se quiere generar copy, mensajería baja a la mitad.
- **Entregabilidad:** sin SPF, DKIM y DMARC los emails acabarán en spam; hay que reservar tiempo para configurar el dominio.
- **Consentimiento:** email comercial y SMS necesitan base legal y mecanismo de baja; es un riesgo de producto/legal.
- **Migración:** si hay datos reales, backup, ventana de mantenimiento y verificación; si no, empezar de cero con PostgreSQL.

## 5. Resumen

La aplicación tiene una base válida, pero hoy es una demo: no tiene auth, no envía mensajes reales, no segmenta y la importación es de un solo CSV. Las mejoras con más impacto son, en orden: **auth + workspaces**, **PostgreSQL**, **importación multi-CSV**, **segmentos** y **mensajería con plantillas y envío email**. Después vendrían SMS y analítica. El objetivo no es construir un Mailchimp completo, sino un flujo fiable: **importar leads → segmentarlos → enviar una campaña → medir qué ha pasado**.
