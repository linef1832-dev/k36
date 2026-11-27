-- ตาราง "แชทนิ่ง" สำหรับหน้า นับแชท LINE OA (แท็บ แชทนิ่ง)
-- รันครั้งเดียวใน Supabase → SQL Editor
-- เขียนโดยส่วนเสริม Chrome "นับแชท" ≥3.4.18 · อ่านโดยเว็บ K36
-- 1 แถว = พนักงาน 1 คน เปิดแชท 1 ห้องค้างไว้ ไม่ขยับเมาส์/เลื่อน/คลิก/พิมพ์ เกิน 5 นาที (ขณะแท็บ LINE โฟกัสอยู่)

create table if not exists public.oa_idle (
  id            bigserial primary key,
  work_date     date        not null,               -- วันทำงาน (ตัด 08:00) ของเวลาเริ่มนิ่ง
  user_id       text,
  username      text        not null,               -- พนักงานที่เปิดแชทค้าง
  oa_id         text        not null,
  oa_name       text        default '',
  chat_id       text        not null,
  chat_name     text        default '',
  idle_since    timestamptz not null,               -- เวลาที่ขยับครั้งสุดท้าย = เริ่มนิ่ง
  reported_at   timestamptz not null default now(), -- เวลาที่ส่วนเสริมตรวจพบ (ครบ 5 นาที)
  ended_at      timestamptz,                        -- กลับมาขยับ / เปลี่ยนแชท / สลับโปรแกรม (null = ยังนิ่งอยู่)
  created_at    timestamptz not null default now()
);

create index if not exists oa_idle_open_idx  on public.oa_idle (username, oa_id, chat_id) where ended_at is null;
create index if not exists oa_idle_date_idx  on public.oa_idle (work_date);
create index if not exists oa_idle_since_idx on public.oa_idle (idle_since desc);

alter table public.oa_idle enable row level security;
drop policy if exists "oa_idle_anon_all" on public.oa_idle;
create policy "oa_idle_anon_all" on public.oa_idle
  for all to anon using (true) with check (true);

-- realtime ให้เว็บอัปเดตทันที
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'oa_idle'
  ) then
    alter publication supabase_realtime add table public.oa_idle;
  end if;
end $$;
