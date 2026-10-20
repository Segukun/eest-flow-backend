# EEST Flow Backend

Repositorio del backend y la base de datos de EEST Flow.

EEST Flow es una aplicación web privada destinada a la organización interna de la EEST N.º 1.

## Función de este repositorio

Este repositorio contiene:

- API del sistema.
- Rutas.
- Controladores.
- Modelos.
- Validaciones del servidor.
- Autenticación.
- Permisos.
- Conexión con MongoDB.
- Operaciones de persistencia.

El diseño de las pantallas y los componentes visuales se encuentra en el repositorio frontend.

## Tecnologías seleccionadas

- Node.js.
- Express.js.
- MongoDB.
- Mongoose.

## Dependencias documentadas

- Zod.
- cors.
- dotenv.

En la documentación del Sprint 1 también se propusieron:

- bcryptjs para las contraseñas.
- jsonwebtoken para la autenticación mediante tokens.

Estas dependencias deberán incorporarse al proyecto de acuerdo con el mecanismo de autenticación implementado.

## Usuarios

El sistema será utilizado por:

- Preceptores.
- Profesores.
- Directores.
- Secretarios.

El modelo preliminar de usuario contiene:

- Nombre.
- Contraseña.
- Correo.
- Tipo de cuenta.
- Sector.

## Tipos de cuenta

- Administrativo.
- Colaborador.

El tipo de cuenta determina las funciones y permisos disponibles.

## Sectores

- Preceptoría.
- Secretaría.
- Dirección.
- Profesores.

## Tareas

El modelo preliminar de tarea contiene:

- Título.
- Descripción.
- Persona asignada opcional.
- Fecha de entrega opcional.
- Prioridad.
- Categoría opcional.
- Estado.

### Prioridades permitidas

- Baja.
- Media.
- Alta.

### Estados permitidos

- Pendiente.
- En curso.
- Revisión.
- Terminado.

## Operaciones principales

El backend deberá permitir:

- Comprobar las credenciales de acceso.
- Consultar las tareas del tablero.
- Crear tareas.
- Consultar una tarea.
- Editar tareas.
- Asignar una persona opcionalmente.
- Establecer una fecha opcional.
- Seleccionar una prioridad.
- Registrar una categoría opcional.
- Cambiar el estado.
- Crear cuentas desde usuarios autorizados.

No existe registro público de usuarios.

## Recuperación de contraseña

Flujo de tres pasos para que un usuario restablezca su contraseña mediante un código enviado por email. Todos los endpoints son públicos (no requieren sesión) y devuelven JSON.

- `POST /api/auth/forgot-password` — body `{ email }` — responde `{ existe: true }` si el email existe (y le envía un código) o `{ existe: false }` si no.
- `POST /api/auth/resend-code` — body `{ email }` — genera y envía un código nuevo, invalidando el anterior; responde `{ ok: true }` o `{ ok: false }` si el email no existe.
- `POST /api/auth/verify-code` — body `{ email, code }` — responde `{ valido: true, resetToken }` si el código es correcto y no venció, o `{ valido: false }` en caso contrario.
- `POST /api/auth/reset-password` — body `{ email, resetToken, newPassword }` — responde `{ ok: true }` y guarda la nueva contraseña (hasheada con bcrypt).

El código tiene 6 dígitos y vence a los 10 minutos. El `resetToken` también vence a los 10 minutos y es de un solo uso: al usarlo o al pedir un código nuevo se invalida el anterior.

## Instalación

Cuando el proyecto esté configurado, las dependencias se instalarán con:

```bash
npm install
```

## Ejecución local

El comando definitivo para ejecutar el backend se documentará cuando se configuren los scripts del archivo `package.json`.

## Variables de entorno

El proyecto utilizará variables de entorno mediante dotenv.

Cuando se configure el backend deberá agregarse un archivo `.env.example` que muestre las variables necesarias sin incluir información privada.

Además de las variables de base de datos y autenticación, la recuperación de contraseña requiere configurar el envío de emails por SMTP:

- `SMTP_HOST`: servidor SMTP (ej. `smtp.gmail.com`).
- `SMTP_PORT`: puerto (`587` para TLS, `465` para SSL).
- `SMTP_SECURE`: `true`/`false`; si se omite se deduce del puerto.
- `SMTP_USER`: cuenta desde la que se envían los correos.
- `SMTP_PASS`: contraseña de aplicación o clave SMTP.
- `SMTP_FROM`: remitente visible (si se omite usa `SMTP_USER`).

No se deben subir al repositorio:

- Contraseñas.
- Tokens.
- Claves privadas.
- Direcciones privadas de conexión.
- Archivos `.env` con valores reales.

## Base de datos

La base de datos seleccionada es MongoDB y se utilizará Mongoose para definir los modelos y administrar las operaciones.

También se contempla MongoDB Atlas como servicio administrado.

## Endpoints

Los endpoints se documentarán a medida que sean creados durante el Sprint 2.

Cada endpoint deberá indicar:

- Método.
- Ruta.
- Función.
- Datos recibidos.
- Respuesta esperada.
- Posibles errores.

No se incluyen rutas inventadas en este README.

## Sprint 2

Durante el Sprint 2 se realizará:

- Creación del proyecto backend.
- Instalación de dependencias.
- Organización de la estructura.
- Definición inicial de rutas y controladores.
- Creación de los primeros endpoints.
- Configuración de MongoDB.
- Creación de los modelos iniciales.
- Configuración del entorno local.
- Verificación de la ejecución.
- Registro de avances, dificultades y decisiones.

## Resultado esperado

Al finalizar el Sprint 2, este repositorio debe contener:

- Proyecto backend ejecutable localmente.
- Dependencias configuradas.
- Estructura inicial organizada.
- Conexión con MongoDB.
- Modelos iniciales de usuarios y tareas.
- Primeras rutas y controladores.
- Primeros endpoints.
- Instrucciones actualizadas de instalación y ejecución.

## Trabajo en el repositorio

Antes de solicitar una revisión se debe comprobar que:

- El servidor se inicia sin errores.
- La conexión con MongoDB funciona.
- No se publicaron datos sensibles.
- Los modelos respetan el diseño del Sprint 1.
- Los cambios están subidos a la rama acordada.
- Los endpoints creados están documentados.
- Se adjuntaron capturas y evidencias en Trello.

## Estado

Proyecto en desarrollo.

Actualmente se está configurando la estructura inicial del backend y la base de datos correspondiente al Sprint 2.