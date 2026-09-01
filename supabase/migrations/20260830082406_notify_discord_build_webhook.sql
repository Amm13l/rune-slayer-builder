-- Ruft die notify-discord-build Edge Function bei jedem INSERT in
-- community_builds auf. WICHTIG: <WEBHOOK_SHARED_SECRET> unten ist ein
-- Platzhalter -- vor dem Ausfuehren durch den echten Wert ersetzen (siehe
-- `supabase secrets list` / die Supabase-Secrets dieses Projekts). Nie den
-- echten Wert in dieses (oeffentliche) Repo committen.
create extension if not exists pg_net;

create or replace function public.notify_discord_new_build()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://nzvkfczphpvkvfsquzmy.supabase.co/functions/v1/notify-discord-build',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SHARED_SECRET>'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'community_builds',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists community_builds_notify_discord on public.community_builds;
create trigger community_builds_notify_discord
  after insert on public.community_builds
  for each row execute function public.notify_discord_new_build();
