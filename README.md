# EEST Flow

EEST Flow es una aplicación web privada destinada a mejorar la organización interna de la EEST N.º 1.

El sistema está dirigido a preceptores, profesores, directores y secretarios. Su primera versión estará centrada en un tablero de tareas tipo Kanban.

## Objetivo

Centralizar las tareas institucionales en un mismo espacio para consultar responsables, prioridades, categorías, fechas de entrega y estados.

## Funcionalidades principales

- Inicio de sesión mediante una cuenta autorizada.
- Sin registro público de usuarios.
- Creación de cuentas desde usuarios con permisos administrativos.
- Visualización de tareas en un tablero Kanban.
- Creación, consulta y edición de tareas.
- Asignación opcional de una persona.
- Fecha de entrega opcional.
- Categoría opcional.
- Selección de prioridad.
- Cambio de estado de las tareas.

## Estados de las tareas

- Pendiente.
- En curso.
- Revisión.
- Terminado.

## Prioridades

- Baja.
- Media.
- Alta.

## Datos de una tarea

- Título.
- Descripción.
- Persona asignada opcional.
- Fecha de entrega opcional.
- Prioridad.
- Categoría opcional.
- Estado.

## Tecnologías

### Frontend

- React.
- JavaScript.
- CSS.
- Vite.
- React Router DOM.
- Axios.
- React Icons.

### Backend

- Node.js.
- Express.js.
- Mongoose.
- JSON Web Token.
- bcryptjs.
- Zod.
- dotenv.
- cors.

### Base de datos

- MongoDB.

## Identidad visual

La aplicación utiliza el escudo de la EEST N.º 1 como logotipo.

### Colores

- Naranja: `#FF880F`
- Verde: `#05903E`
- Terracota: `#DC9655`
- Grafito: `#1F151C`
- Blanco hueso: `#FFF9ED`

El diseño definitivo de las pantallas y componentes se encuentra en Figma.

## Sprint actual

Actualmente el proyecto se encuentra en el Sprint 2, correspondiente al período del 11/09 al 23/09.

Durante este sprint se realizará:

- Configuración inicial de los repositorios.
- Organización de las carpetas.
- Instalación de dependencias.
- Configuración del entorno de desarrollo.
- Implementación de las primeras pantallas.
- Creación de componentes reutilizables.
- Configuración inicial del backend.
- Creación de rutas, controladores y primeros endpoints.
- Conexión con la base de datos.
- Verificación de la ejecución local.

El resultado esperado es una primera versión ejecutable con la estructura inicial del frontend, backend y base de datos.

## Instalación del frontend

```bash
npm install
npm run dev
```

## Instalación del backend

```bash
npm install
npm run dev
```

El backend necesita un archivo `.env` con las variables requeridas por el proyecto.

Ejemplo:

```env
PORT=
MONGODB_URI=
JWT_SECRET=
```

No se deben subir contraseñas, claves o datos sensibles al repositorio.

## Organización del equipo

- Segundo: liderazgo, análisis y documentación general.
- Joaquín: full stack, diseño y wireframes.
- Aimé: frontend y análisis técnico.
- Benicio: UI UX y frontend.
- Raúl: backend, base de datos, arquitectura y testing.
- Sebastián: frontend, testing, diagramas y validaciones.

## Forma de trabajo

El equipo utiliza Trello para organizar las tareas durante todos los sprints.

Cada integrante debe:

- Trabajar en la tarea asignada.
- Subir sus cambios al repositorio.
- Compartir el enlace del commit, rama o solicitud de cambios.
- Adjuntar capturas y evidencias.
- Registrar dificultades y decisiones.
- Pasar la tarjeta a Revisión cuando la entrega esté completa.

## Estado del proyecto

Proyecto en desarrollo.

La integración completa de las funcionalidades se realizará progresivamente durante los próximos sprints.
