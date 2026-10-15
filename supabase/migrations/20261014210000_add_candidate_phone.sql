-- Agrega columna de teléfono a la tabla candidates para datos de contacto completos
alter table public.candidates
  add column if not exists phone text;
