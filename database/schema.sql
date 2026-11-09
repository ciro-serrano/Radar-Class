-- Radar Class — esquema MySQL 8
CREATE DATABASE IF NOT EXISTS radar_class CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE radar_class;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('docente','alumno') NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  materia VARCHAR(120) NOT NULL,
  codigo_acceso VARCHAR(20) NOT NULL UNIQUE,
  docente_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curso_alumno (
  curso_id INT NOT NULL,
  alumno_id INT NOT NULL,
  unido_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (curso_id, alumno_id),
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  tema VARCHAR(160) NOT NULL,
  dificultad ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
  tiempo_limite_min INT NULL,
  estado ENUM('borrador','publicada','cerrada') NOT NULL DEFAULT 'borrador',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preguntas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluacion_id INT NOT NULL,
  orden INT NOT NULL,
  enunciado TEXT NOT NULL,
  tipo ENUM('opcion_multiple','verdadero_falso','desarrollo') NOT NULL,
  opciones JSON NULL,
  respuesta_correcta TEXT NULL,   -- texto de la opción correcta; en desarrollo: criterio/respuesta modelo
  tema VARCHAR(160) NULL,
  dificultad ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
  FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS banco_preguntas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  docente_id INT NOT NULL,
  materia VARCHAR(120) NULL,
  tema VARCHAR(160) NULL,
  dificultad ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
  tipo ENUM('opcion_multiple','verdadero_falso','desarrollo') NOT NULL,
  enunciado TEXT NOT NULL,
  opciones JSON NULL,
  respuesta_correcta TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluacion_id INT NOT NULL,
  alumno_id INT NOT NULL,
  estado ENUM('en_curso','enviado') NOT NULL DEFAULT 'en_curso',
  nota_parcial DECIMAL(4,2) NULL,  -- con lo corregido hasta ahora
  nota_final DECIMAL(4,2) NULL,    -- cuando el docente confirmó todo
  iniciado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_en DATETIME NULL,
  UNIQUE KEY uq_eval_alumno (evaluacion_id, alumno_id),
  FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS respuestas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intento_id INT NOT NULL,
  pregunta_id INT NOT NULL,
  respuesta TEXT NULL,
  es_correcta TINYINT(1) NULL,
  puntaje DECIMAL(4,3) NULL,        -- 0 a 1; NULL = pendiente de confirmar
  nota_sugerida_ia DECIMAL(4,2) NULL,
  feedback_ia TEXT NULL,
  confirmada TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_intento_pregunta (intento_id, pregunta_id),
  FOREIGN KEY (intento_id) REFERENCES intentos(id) ON DELETE CASCADE,
  FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE
);
