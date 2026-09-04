// ════════════════════════════════════════════════════════════════════
// 📦 od_config/history.js — ส่วนที่ 2/2 ของตั้งค่า OD Form Bot (แยกจาก od_config.js เดิม 1,015 บรรทัด)
// เนื้อหา: ประวัติข้อความ/กู้ข้อความที่ถูกลบ + แบ่งหน้า
// ⚠️ ลำดับโหลด: od_config/config → od_config/history (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 📜 ประวัติข้อความ / กู้ข้อความที่ถูกลบ (backup ที่ server) — รวมอยู่ในหน้านี้
// ══════════════════════════════════════════════════════════════════════════
let odCfgHistItems = [];
let odCfgHistPage = 1;                 // 📄 หน้าปัจจุบันของตารางประวัติ
const ODCFG_HIST_PER_PAGE = 10;        // แสดงหน้าละ 10 รายการ
function odCfgHist_esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function odCfgHist_fmt(ts) { try { return new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ts; } }
function odCfgHist_dstr(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d || new Date()); }
function odCfgHist_tag(st) {
    if (st === 'deleted') return '<span class="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 whitespace-nowrap">ลบแล้ว</span>';
    if (st === 'edited')  return '<span class="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 whitespace-nowrap">แก้ไขแล้ว</span>';
    return '<span class="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 whitespace-nowrap">ส่งแล้ว</span>';
}
function odCfgHist_initDates() {
    const f = document.getElementById('odCfgHistFrom'), t = document.getElementById('odCfgHistTo');
    const today = odCfgHist_dstr(new Date());
    if (f && !f.value) f.value = today;   // เริ่มต้น = วันนี้
    if (t && !t.value) t.value = today;
}
window.odCfgHist_load = async function() {
    const body = document.getElementById('odCfgHistBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400 text-sm">กำลังโหลด...</td></tr>';
    try {
        const from = document.getElementById('odCfgHistFrom').value;
        const to   = document.getElementById('odCfgHistTo').value;
        const q    = document.getElementById('odCfgHistSearch').value.trim();
        const status = document.getElementById('odCfgHistStatus').value;
        const form = (document.getElementById('odCfgHistForm') || {}).value || '';
        const p = new URLSearchParams();
        if (from) p.set('from', from);
        if (to) p.set('to', to);
        if (q) p.set('q', q);
        if (status) p.set('status', status);
        if (form) p.set('form', form);
        p.set('limit', '500');
        const data = await odCfg_adminFetch('/admin/history?' + p.toString());
        odCfgHistItems = data.items || [];
        odCfgHistPage = 1;   // ค้นหา/โหลดใหม่ → กลับไปหน้าแรกเสมอ
        const todayEl = document.getElementById('odCfgHistToday');
        if (todayEl) todayEl.textContent = `📤 วันนี้บอทส่งทั้งหมด ${data.today_count != null ? data.today_count : '-'} รายการ`;
        odCfgHist_render();
    } catch (e) {
        body.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-400 text-sm">${odCfgHist_esc(e.message)}</td></tr>`;
        const c = document.getElementById('odCfgHistCount'); if (c) c.textContent = '0 รายการ';
    }
};
// 🔢 เปลี่ยนหน้า (เรียกจากปุ่มเลขหน้า)
window.odCfgHist_goPage = function(pg) {
    const total = Math.max(1, Math.ceil(odCfgHistItems.length / ODCFG_HIST_PER_PAGE));
    odCfgHistPage = Math.min(total, Math.max(1, pg));
    odCfgHist_render();
    // เลื่อนกลับขึ้นหัวตารางให้เห็นรายการแรกของหน้าใหม่
    const tbl = document.getElementById('odCfgHistBody')?.closest('table');
    if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
// สร้าง/อัปเดตแถบปุ่มเลขหน้า (สร้าง container จาก JS — ไม่ต้องแก้ HTML)
function odCfgHist_renderPager() {
    const body = document.getElementById('odCfgHistBody');
    const tbl = body ? body.closest('table') : null;
    if (!tbl) return;
    let pager = document.getElementById('odCfgHistPager');
    if (!pager) {
        pager = document.createElement('div');
        pager.id = 'odCfgHistPager';
        pager.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:12px 8px';
        const host = tbl.closest('div') || tbl;   // กล่องครอบตาราง (พื้นที่ scroll) → วาง pager ต่อท้ายข้างนอก
        host.after(pager);
    }
    const total = Math.ceil(odCfgHistItems.length / ODCFG_HIST_PER_PAGE);
    if (total <= 1) { pager.innerHTML = ''; return; }
    const btn = (label, pg, active, disabled) =>
        `<button onclick="odCfgHist_goPage(${pg})" ${disabled ? 'disabled' : ''} style="min-width:34px;height:34px;padding:0 10px;border-radius:9px;font-weight:800;font-size:13px;border:1px solid ${active ? '#ec4899' : 'rgba(148,163,184,.35)'};background:${active ? '#ec4899' : 'rgba(30,41,59,.8)'};color:${active ? '#fff' : '#cbd5e1'};cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '.4' : '1'}">${label}</button>`;
    // เลขหน้าแบบย่อ: 1 … (รอบๆ หน้าปัจจุบัน) … หน้าสุดท้าย
    const pages = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - odCfgHistPage) <= 2) pages.push(i);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    pager.innerHTML =
        btn('‹', odCfgHistPage - 1, false, odCfgHistPage === 1) +
        pages.map(pv => pv === '…' ? '<span style="color:#64748b;padding:0 2px">…</span>' : btn(pv, pv, pv === odCfgHistPage, false)).join('') +
        btn('›', odCfgHistPage + 1, false, odCfgHistPage === total) +
        `<span style="font-size:11px;color:#64748b;margin-left:8px">หน้า ${odCfgHistPage}/${total}</span>`;
}
function odCfgHist_render() {
    const body = document.getElementById('odCfgHistBody');
    const c = document.getElementById('odCfgHistCount');
    if (!odCfgHistItems.length) { if (c) c.textContent = '0 รายการ'; body.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400 text-sm">ไม่พบข้อมูลในช่วงนี้</td></tr>'; odCfgHist_renderPager(); return; }
    // 📄 แสดงเฉพาะรายการของหน้าปัจจุบัน (หน้าละ 10)
    const total = Math.max(1, Math.ceil(odCfgHistItems.length / ODCFG_HIST_PER_PAGE));
    if (odCfgHistPage > total) odCfgHistPage = total;
    const s0 = (odCfgHistPage - 1) * ODCFG_HIST_PER_PAGE;
    const pageItems = odCfgHistItems.slice(s0, s0 + ODCFG_HIST_PER_PAGE);
    if (c) c.textContent = `${odCfgHistItems.length} รายการ (แสดง ${s0 + 1}-${s0 + pageItems.length})`;
    body.innerHTML = pageItems.map(it => {
        const preview = odCfgHist_esc((it.message || '').replace(/\n+/g, ' ↵ ')).slice(0, 130);
        const gone = it.status === 'deleted';
        return `<tr class="odCfgHist-row border-b border-gray-100 dark:border-slate-700 align-top">
            <td class="px-3 py-2 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">${odCfgHist_fmt(it.created_at)}</td>
            <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">${odCfgHist_esc(it.form || 'od')}</td>
            <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">${odCfgHist_esc(it.sender || '-')}</td>
            <td class="px-3 py-2">${odCfgHist_tag(it.status)}</td>
            <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-300" title="${odCfgHist_esc(it.message || '')}">${preview}</td>
            <td class="px-3 py-2 text-right">
              <div class="flex gap-1 justify-end flex-wrap">
                <button data-id="${it.id}" class="odCfgHist-edit bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap" ${gone ? 'disabled title="ลบไปแล้ว"' : ''} style="${gone ? 'opacity:.4;cursor:not-allowed' : ''}">✏️ แก้</button>
                <button data-id="${it.id}" class="odCfgHist-del bg-red-600 hover:bg-red-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap" ${gone ? 'disabled title="ลบไปแล้ว"' : ''} style="${gone ? 'opacity:.4;cursor:not-allowed' : ''}">🗑️ ลบ</button>
                <button data-id="${it.id}" class="odCfgHist-resend bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap">🔁 ส่งซ้ำ</button>
              </div>
            </td>
        </tr>`;
    }).join('');
    body.querySelectorAll('.odCfgHist-resend').forEach(b => b.addEventListener('click', () => odCfgHist_resend(b.dataset.id, b)));
    body.querySelectorAll('.odCfgHist-del').forEach(b => { if (!b.disabled) b.addEventListener('click', () => odCfgHist_delete(b.dataset.id, b)); });
    body.querySelectorAll('.odCfgHist-edit').forEach(b => { if (!b.disabled) b.addEventListener('click', () => odCfgHist_editOpen(b.dataset.id)); });
    odCfgHist_renderPager();
}
async function odCfgHist_resend(id, btn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังส่ง...';
    try {
        await odCfg_adminFetch('/admin/resend', 'POST', { id, by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'admin' });
        btn.textContent = '✅ ส่งแล้ว';
        btn.className = 'odCfgHist-resend bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold whitespace-nowrap';
    } catch (e) { btn.disabled = false; btn.textContent = old; odCfg_showStatus('ส่งซ้ำไม่สำเร็จ: ' + e.message, 'error'); }
}
window.odCfgHist_resendAll = async function() {
    if (!odCfgHistItems.length) { odCfg_showStatus('ยังไม่มีรายการ (กดค้นหาก่อน)', 'error'); return; }
    const c = await Swal.fire({
        title: `ส่งซ้ำที่แสดงอยู่ทั้งหมด ${odCfgHistItems.length} รายการ?`,
        html: 'ระบบจะส่งทีละอัน เรียงเก่า→ใหม่ ช้าๆ (~3 วิ/อัน) กัน Telegram บล็อก<br><span style="color:#f59e0b;font-size:12px">⚠️ อย่าปิดหน้านี้จนกว่าจะเสร็จ</span>',
        icon: 'question', showCancelButton: true, confirmButtonText: 'ส่งซ้ำทั้งหมด', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2481cc', reverseButtons: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
    });
    if (!c.isConfirmed) return;
    const btn = document.getElementById('odCfgHistResendAll'); btn.disabled = true;
    const items = odCfgHistItems.slice().reverse(); // เก่า→ใหม่
    let done = 0, fail = 0;
    for (const it of items) {
        btn.textContent = `🔁 กำลังส่ง ${done + fail + 1}/${items.length}...`;
        try { await odCfg_adminFetch('/admin/resend', 'POST', { id: it.id, by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'admin' }); done++; } catch (e) { fail++; }
        await new Promise(r => setTimeout(r, 3000));
    }
    btn.disabled = false; btn.textContent = '🔁 ส่งซ้ำที่แสดงทั้งหมด';
    odCfg_showStatus(`เสร็จแล้ว: ส่งซ้ำสำเร็จ ${done}${fail ? ` · ไม่สำเร็จ ${fail}` : ''}`, fail ? 'error' : 'success');
    odCfgHist_load();
}

function odCfgHist_by() { return (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'admin'; }

// ลบข้อความในกลุ่มจากประวัติ (ผ่าน server)
async function odCfgHist_delete(id, btn) {
    const r = await Swal.fire({
        title: 'ลบข้อความในกลุ่ม?',
        html: 'ข้อความนี้จะหายจากกลุ่ม Telegram <b>ทันที</b><br><span style="font-size:12px;opacity:.75">(ยังกู้/ส่งซ้ำจากประวัติได้ภายหลัง)</span>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🗑️ ลบเลย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
    });
    if (!r.isConfirmed) return;
    const old = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังลบ...';
    try {
        await odCfg_adminFetch('/admin/delete', 'POST', { id, by: odCfgHist_by() });
        Swal.fire({ icon: 'success', title: 'ลบข้อความในกลุ่มแล้ว', timer: 1200, showConfirmButton: false, customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' } });
        odCfgHist_load();
    } catch (e) {
        btn.disabled = false; btn.textContent = old;
        Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message, customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' } });
    }
}

// เปิดกล่องแก้ไขข้อความ
function odCfgHist_editOpen(id) {
    const it = odCfgHistItems.find(x => String(x.id) === String(id));
    if (!it) return;
    document.getElementById('odCfgEditId').value = it.id;
    document.getElementById('odCfgEditText').value = it.message || '';
    document.getElementById('odCfgEditModal').classList.remove('hidden');
    document.getElementById('odCfgEditModal').classList.add('flex');
}
window.odCfgHist_editClose = function() {
    document.getElementById('odCfgEditModal').classList.add('hidden');
    document.getElementById('odCfgEditModal').classList.remove('flex');
};
window.odCfgHist_editSave = async function() {
    const id = document.getElementById('odCfgEditId').value;
    const message = document.getElementById('odCfgEditText').value;
    if (!message.trim()) { odCfg_showStatus('ข้อความว่างไม่ได้', 'error'); return; }
    const btn = document.getElementById('odCfgEditSaveBtn'); const old = btn.textContent;
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
        await odCfg_adminFetch('/admin/edit', 'POST', { id, message, by: odCfgHist_by() });
        odCfgHist_editClose();
        odCfg_showStatus('✏️ แก้ไขข้อความในกลุ่มแล้ว', 'success');
        odCfgHist_load();
    } catch (e) { odCfg_showStatus('แก้ไขไม่สำเร็จ: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = old; }
};
