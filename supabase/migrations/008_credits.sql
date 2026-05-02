-- Add credits column to profiles.
-- 1 credit = 1 bonus scan on top of the user's plan quota.
-- Credits are awarded manually by admins (via service role) after reviewing
-- contact form submissions. Users can check their balance in the app.

alter table public.profiles
  add column if not exists credits integer not null default 0;

-- Ensure credits never go negative
alter table public.profiles
  add constraint credits_non_negative check (credits >= 0);

-- RPC: safely decrement credits atomically (returns false if insufficient)
create or replace function public.use_credit()
returns boolean
language plpgsql
security definer
as $$
declare
  current_credits integer;
begin
  select credits into current_credits
  from public.profiles
  where id = auth.uid()
  for update;

  if current_credits is null or current_credits < 1 then
    return false;
  end if;

  update public.profiles
  set credits = credits - 1
  where id = auth.uid();

  return true;
end;
$$;
