# Talentiq — reglas del MVP

## Objetivo
Construir un analizador inteligente de CVs para reclutadores, orientado a una demo de clase.

## Stack y límites
- Vite + React 18 + TypeScript en modo `strict`.
- Estado únicamente en memoria con `useState`.
- CSS utilitario o CSS plano.
- IA simulada o conectada mediante un endpoint serverless/API básica.
- Pruebas E2E con Playwright en TypeScript.
- Alcance cerrado: solo estas features:
  1. Carga y definición de vacante.
  2. Análisis y visualización de compatibilidad.
- Implementar exactamente 4 user stories relacionadas con esas features.
- No agregar autenticación, bases de datos persistentes ni procesamiento masivo por lotes.

## Reglas de implementación
- Nunca usar `any`.
- Un componente por archivo, siempre con export nombrado.
- Usar elementos HTML nativos (`button`, `input`, `label`, `textarea`); nunca un `div` con `onClick`.
- Agregar `data-testid` en kebab-case a todo elemento que una prueba necesite.
- No instalar dependencias sin preguntar primero.
- Mantener los cambios dentro del alcance del MVP; evitar funcionalidades no solicitadas.
