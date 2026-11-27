-- เพิ่มคอลัมน์เก็บกิจกรรม + เวลาจำกัด (นาที) ของแต่ละกลุ่มเช็คอิน
-- รูปแบบ: [{"name":"กินข้าว","limit":30},{"name":"ปวดหนัก","limit":20},{"name":"ปวดน้อย","limit":6}]
-- limit = 0 หมายถึงไม่จำกัดเวลา
alter table public.telegram_groups
  add column if not exists activities jsonb not null default '[]'::jsonb;

comment on column public.telegram_groups.activities is
  'รายการกิจกรรมพักของกลุ่ม [{name, limit(นาที)}] — ว่าง = ใช้ค่าเริ่มต้นของหน้าเว็บ';
