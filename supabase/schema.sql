-- RasterLab V2 schema

create table if not exists presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  settings jsonb not null,
  created_at timestamptz default now()
);

alter table presets enable row level security;

create policy "Users can manage their own presets"
  on presets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for exported images
insert into storage.buckets (id, name, public)
  values ('exports', 'exports', false)
  on conflict do nothing;

create policy "Users can upload to exports"
  on storage.objects for insert
  with check (bucket_id = 'exports' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their exports"
  on storage.objects for select
  using (bucket_id = 'exports' and auth.uid()::text = (storage.foldername(name))[1]);
