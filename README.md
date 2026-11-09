# Radar Class

Plataforma web para docentes: genera evaluaciones con IA, las corrige y le "toma el pulso" a la clase
detectando qué temas fallaron antes de que sea tarde.

**Stack:** React (Vite) · Node.js + Express · MySQL · Gemini API

## Cómo correrlo

Necesitás: Node 18+ y MySQL 8 (por ejemplo XAMPP) andando.

### 1. Base de datos
Importá `database/schema.sql` en MySQL (desde phpMyAdmin → Importar, o `mysql -u root -p < database/schema.sql`).
Crea la base `radar_class` con todas las tablas.

### 2. Backend
```bash
cd backend
cp .env.example .env     # en Windows: copy .env.example .env
# editá .env: usuario/contraseña de MySQL, JWT_SECRET y GEMINI_API_KEY
npm install
npm run dev              # http://localhost:3000
```
Probá `http://localhost:3000/api/health`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```
Vite redirige `/api` al backend, no hace falta configurar nada más.

## Flujo de uso

1. Un **docente** se registra → crea un curso → el sistema genera un **código** (ej: `3B-X7K2`).
2. Los **alumnos** se registran, ingresan el código en "Unirme a un curso" y quedan en la comisión.
3. El docente genera una evaluación con IA (tema, dificultad, cantidad, tipos) → **revisa** → publica.
4. El alumno la rinde dentro de la plataforma (timer opcional). Cada alumno recibe orden de preguntas y
   de opciones distinto.
5. Opción múltiple y V/F se corrigen solas. En las de desarrollo la IA **sugiere** nota y feedback; el docente confirma.
6. Estadísticas: promedio, % de error por pregunta, alertas por tema y botón de recomendaciones de refuerzo con IA.

## Estructura

```
database/schema.sql          tablas
backend/src/routes/          auth, cursos, evaluaciones, intentos, correccion, estadisticas, banco
backend/src/services/        gemini.js (IA), notas.js (cálculo de notas y mezcla de preguntas)
frontend/src/pages/docente   Cursos, Curso, Generar, Evaluacion (corrección + stats), Banco
frontend/src/pages/alumno    MisCursos, Rendir, Resultado
docs/                        mockups HTML de la presentación (docente y alumno)
```

## Decisiones de diseño

- La API key de Gemini vive **solo en el backend**, nunca en el frontend.
- La IA **asiste, no decide**: el docente aprueba las preguntas antes de publicar y confirma las notas de desarrollo.
- Examen supervisado en el aula; mitigaciones anti-copia: versión distinta por alumno, timer, sin pegar texto en respuestas de desarrollo.
  No se promete evitar el uso de IA al 100%.
- Código de curso permanente, con botón para regenerarlo.

