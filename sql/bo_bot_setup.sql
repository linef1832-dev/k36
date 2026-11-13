-- ============================================================
-- บอทหลังบ้าน — ตารางเว็บ + บัญชีบอท
-- Supabase → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- ============================================================
create table if not exists public.bo_sites (
  id             text primary key,               -- รหัสเว็บ เช่น bt678
  name           text not null,                  -- ชื่อที่แสดง
  web_url        text,                           -- https://bo.xxxx.net
  api_base       text,                           -- https://boapi.xxxx.net/tf6prod-ims/api/v1
  enabled        boolean not null default true,
  note           text,

  -- บัญชีบอท (ล็อกด้วยกุญแจสาธารณะใน K36, ไขได้เฉพาะ Railway)
  cred_cipher    text,                           -- รหัสที่ถูกล็อกแล้ว (อ่านไม่ออก)
  cred_hint      text,                           -- ชื่อผู้ใช้แบบปิดบางส่วน เช่น am****78
  cipher_fp      text,                           -- ลายนิ้วมือของกุญแจที่ใช้ล็อก
  cred_set_at    timestamptz,
  cred_set_by    text,

  -- Railway รายงานกลับ
  status         text,                           -- pending / ok / login_failed / error
  last_login_at  timestamptz,
  last_seen      timestamptz,
  last_error     text,

  created_at     timestamptz not null default now()
);

alter table public.bo_sites enable row level security;
drop policy if exists bo_sites_all on public.bo_sites;
create policy bo_sites_all on public.bo_sites for all to anon, authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.bo_sites; exception when others then null; end;
end $$;
