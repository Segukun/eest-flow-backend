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