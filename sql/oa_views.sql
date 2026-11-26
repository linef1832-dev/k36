-- ตาราง "อ่านแล้วไม่ตอบ" สำหรับหน้า นับแชท LINE OA (แท็บ อ่านไม่ตอบ)
-- รันครั้งเดียวใน Supabase → SQL Editor
-- เขียนโดยส่วนเสริม Chrome "นับแชท" ≥3.4.0 (ใช้ anon key เดียวกับเว็บ K36) · อ่านโดยเว็บ K36

create table if not exists public.oa_views (
  id            bigserial primary key,
  work_date     date        not null,               -- วันทำงาน (ตัด 08:00) ของเวลาที่เปิดอ่าน
  user_id       text,                               -- users.id ของคนเปิดอ่าน (อาจว่างถ้าได้ชื่อมาจาก BIZ Checker)
  username      text        not null,               -- ชื่อพนักงานที่เปิดอ่าน
  oa_id         text        not null,               -- รหัส OA จาก URL chat.line.biz
  oa_name       text        default '',
  chat_id       text        not null,               -- รหัสแชท/ลูกค้า จาก URL
  chat_name     text        default '',
  opened_at     timestamptz not null default now(), -- เวลาเปิดอ่าน
  resolved_at   timestamptz,                        -- เวลาที่มีใครก็ได้ตอบแชทนี้ (null = ยังไม่มีใครตอบ)
  resolved_by   text,                               -- ใครตอบ (ถ้ารู้)
  created_at    timestamptz not null default now()
);

-- หาแถวค้างของแชทเร็วๆ (ใช้ทั้งตอน dedupe และตอน resolve)
create index if not exists oa_views_open_idx    on public.oa_views (oa_id, chat_id) where resolved_at is null;
create index if not exists oa_views_date_idx    on public.oa_views (work_date);
create index if not exists oa_views_opened_idx  on public.oa_views (opened_at desc);

alter table public.oa_views enable row level security;

-- เว็บ K36 และส่วนเสริมใช้ anon key → ต้องเปิดให้ anon อ่าน/เขียนได้ (เหมือนตาราง oa_replies / oa_actions)
drop policy if exists "oa_views_anon_all" on public.oa_views;
create policy "oa_views_anon_all" on public.oa_views
  for all to anon using (true) with check (true);

-- (ไม่บังคับ) ลบแถวที่ตอบแล้วเก่ากว่า 90 วัน — รันเองเป็นครั้งคราว หรือตั้ง pg_cron
-- delete from public.oa_views where resolved_at is not null and resolved_at < now() - interval '90 days';
