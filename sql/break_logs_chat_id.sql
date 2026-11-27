-- เพิ่มคอลัมน์ chat_id ใน break_logs: กลุ่ม Telegram ที่พนักงานกดพักมา (botlink เป็นคนบันทึก)
-- หน้าเว็บใช้เทียบกับ telegram_groups.chat_id เพื่อหาเวลาจำกัดของกิจกรรม "ตามกลุ่มนั้น"
-- แถวเก่าที่ไม่มีค่า → หน้าเว็บจะไล่หาชื่อกิจกรรมจากทุกกลุ่มเช็คอินแทน
alter table public.break_logs
  add column if not exists chat_id text;

create index if not exists break_logs_chat_id_idx on public.break_logs (chat_id);
