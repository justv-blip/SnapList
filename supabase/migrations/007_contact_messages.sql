-- Contact messages submitted via the in-app contact form.
-- Accessible only by service_role (admin reads via dashboard or future admin panel).

create table if not exists contact_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  topic        text not null,
  email        text not null,
  subject      text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);

-- Only the service role can read/write — users cannot see other users' messages.
alter table contact_messages enable row level security;

-- Users can insert their own messages.
create policy "Users can submit contact messages"
  on contact_messages for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users cannot read any messages (admin only via service role).
-- No SELECT policy = no access for authenticated users.
