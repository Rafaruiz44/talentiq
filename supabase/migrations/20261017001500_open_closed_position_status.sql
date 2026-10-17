update public.positions
set status = case
  when status in ('Nueva', 'Abierta') then 'Abierta'
  else 'Cerrada'
end;

alter table public.positions
  alter column status set default 'Abierta';

alter table public.positions
  drop constraint if exists positions_status_check;

alter table public.positions
  add constraint positions_status_check
    check (status in ('Abierta', 'Cerrada'));
