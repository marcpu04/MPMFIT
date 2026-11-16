-- PROPUESTA PARA REVISIÓN — no ejecutar hasta autorizar el cambio en Supabase.
-- Sincroniza los datos de nutrición y progreso por cuenta.
-- Las fotos de progreso permanecen en IndexedDB local en esta fase.

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nutrition jsonb not null default '{"goal":"maintenance","targets":{"kcal":0,"protein":0,"carbs":0,"fat":0},"entries":[],"favorites":[],"savedMeals":[],"recipes":[],"mealPlans":[],"quantityMemory":{} }'::jsonb,
  bodyweight jsonb not null default '[]'::jsonb,
  bodymeasure jsonb not null default '[]'::jsonb,
  bodyweight_goal numeric(6,2),
  preferences jsonb not null default '{"language":"es","mass":"kg","length":"cm","distance":"km"}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_app_state_nutrition_object check (jsonb_typeof(nutrition) = 'object'),
  constraint user_app_state_bodyweight_array check (jsonb_typeof(bodyweight) = 'array'),
  constraint user_app_state_bodymeasure_array check (jsonb_typeof(bodymeasure) = 'array'),
  constraint user_app_state_preferences_object check (jsonb_typeof(preferences) = 'object')
);

alter table public.user_app_state enable row level security;

drop policy if exists "Users manage their own app state" on public.user_app_state;
create policy "Users manage their own app state"
  on public.user_app_state
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_app_state to authenticated;

-- Explicit Data API privileges for authenticated users; RLS limits each row to its owner.
grant select, insert, update, delete on public.user_app_state to authenticated;
