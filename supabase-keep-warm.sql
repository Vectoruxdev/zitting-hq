-- Keep-warm ping (applied to prod 2026-09-09 via the Supabase MCP).
-- Vercel Hobby crons run once a day, so the database schedules the ping:
-- every 4 minutes pg_net fetches the public sign-in page, which keeps the
-- pages function and its connection pool warm between the family's visits
-- (a cold start costs ~0.4–0.7 s). ~360 requests/day; the page renders in
-- ~300 ms and touches one cached read.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('zhq-keep-warm') where exists (select 1 from cron.job where jobname = 'zhq-keep-warm');
select cron.schedule(
  'zhq-keep-warm',
  '*/4 * * * *',
  $$select net.http_get('https://zittinghq.com/login', headers := '{"user-agent":"zhq-keep-warm"}'::jsonb, timeout_milliseconds := 8000)$$
);

-- To pause: select cron.unschedule('zhq-keep-warm');
-- To inspect: select * from cron.job_run_details order by start_time desc limit 10;
