// ════════════════════════════════════════════════════════════════════
// 📊 breaktable/core.js — หน้า "ลงเวลากินข้าว" แบบการ์ดตามช่วงเวลา
//   - การ์ดละ 1 ช่วงเวลา: เวลา / จองแล้วกี่คน / รูปย่อ / ปุ่ม 👁 ดูรายชื่อ
//   - กด 👁 → popup: สรุปตามแผนก/เว็บ (กดกรองได้) + รายชื่อ + เวลาที่ลง + กดขยายรายละเอียด
//   - ตัวกรอง แผนก/เว็บ/กะ/ชื่อ · เลื่อนวัน ‹ › · realtime อัปเดตเอง
//   - ข้อมูลจากตาราง schedules (ของเดิม) ช่วงเวลาจากตั้งค่าเดิม (SHIFT_GROUPS_ALL) ลบด้วย delSch เดิม
// ════════════════════════════════════════════════════════════════════
(function () {
    const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const TH_DAY = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    const esc = v => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fmtDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); if (!m) return s; const d = new Date(+m[1], +m[2] - 1, +m[3]); return `${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MON[d.getMonth()]} ${d.getFullYear() + 543}`; };
    const fmtTime = ts => { if (!ts) return '-'; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtFull = ts => { if (!ts) return '-'; const d = new Date(ts); return `${d.getDate()} ${TH_MON[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
    const SHIFT_ICON = { 'กะเช้า': '☀️', 'กะกลาง': '🌤️', 'กะดึก': '🌙' };
    const SHIFT_CODE = { 'กะเช้า': 'D', 'กะกลาง': 'M', 'กะดึก': 'N' };
    const AV_COLORS = ['#2563eb','#db2777','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#4f46e5','#b45309','#0d9488'];
    const avColor = name => AV_COLORS[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
    const initials = name => esc(String(name || '?').replace(/[^A-Za-z0-9ก-๙]/g, '').substring(0, 2).toUpperCase() || '?');
    const avatar = (name, size) => `<span class="bt-av" style="width:${size}px;height:${size}px;background:${avColor(name)};font-size:${Math.round(size / 3)}px" title="${esc(name)}">${initials(name)}</span>`;

    let _rows = [];          // ข้อมูลวันนี้ทั้งหมด (ก่อนกรอง)
    let _lastDate = null;
    let _sub = null;

    const $ = id => document.getElementById(id);
    const dateVal = () => ($('wDate') && $('wDate').value) || iso(new Date());

    // ── รายการช่วงเวลาที่ควรแสดง (จากตั้งค่า + ที่มีคนลงจริง) ──
    function slotList(shiftFilter, deptFilter) {
        const set = new Map();   // slot -> Set(shift)
        const all = window.SHIFT_GROUPS_ALL || {};
        const depts = deptFilter === 'all' ? Object.keys(all) : [deptFilter];
        depts.forEach(d => Object.entries(all[d] || {}).forEach(([shift, periods]) => {
            if (shiftFilter !== 'all' && shift !== shiftFilter) return;
            Object.values(periods || {}).forEach(arr => (arr || []).forEach(sl => { if (!set.has(sl)) set.set(sl, new Set()); set.get(sl).add(shift); }));
        }));
        _rows.forEach(r => { if (!r.time_slot) return; if (!set.has(r.time_slot)) set.set(r.time_slot, new Set()); set.get(r.time_slot).add(r.shift_name); });
        const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s); return m ? (+m[1]) * 60 + (+m[2]) : 9999; };
        return [...set.entries()].sort((a, b) => toMin(a[0]) - toMin(b[0]));
    }

    function filtered() {
        const dept = $('btDept').value, team = $('btTeam').value, shift = $('btShift').value, q = ($('btSearch').value || '').trim().toLowerCase();
        return _rows.filter(r =>
            (dept === 'all' || (r.department || 'AM') === dept) &&
            (team === 'all' || r.team === team) &&
            (shift === 'all' || r.shift_name === shift) &&
            (!q || String(r.staff_name || '').toLowerCase().includes(q)));
    }

    async function load(force) {
        const d = dateVal();
        if (!force && _lastDate === d && _rows.length) return;
        const { data, error } = await appDB.from('schedules').select('id, work_date, staff_name, team, shift_name, time_slot, department, created_at').eq('work_date', d);
        if (error) { console.error(error); _rows = []; } else _rows = data || [];
        _lastDate = d;
        const u = $('btUpdatedAt'); if (u) { const n = new Date(); u.textContent = `อัปเดต ${pad(n.getHours())}:${pad(n.getMinutes())}`; }
    }

    // ── วาดการ์ด ──
    window.btRender = async function (force) {
        if (!$('btGrid')) return;
        await load(force);
        const d = dateVal();
        const rows = filtered();
        $('btDateTitle').textContent = fmtDate(d);
        $('btTotal').innerHTML = `จองแล้ว <b style="color:#fff">${rows.length}</b> คน`;

        const bySlot = {};
        rows.forEach(r => (bySlot[r.time_slot] = bySlot[r.time_slot] || []).push(r));
        const slots = slotList($('btShift').value, $('btDept').value);
        if (!slots.length) { $('btGrid').innerHTML = `<div class="text-center text-gray-500 py-10 text-sm">ไม่มีช่วงเวลา</div>`; return; }

        // จัดกลุ่มตามกะ (ถ้าเลือกทุกกะ) เพื่อให้อ่านง่าย
        const groups = {};
        slots.forEach(([slot, shifts]) => { const key = $('btShift').value !== 'all' ? $('btShift').value : ([...shifts][0] || 'อื่นๆ'); (groups[key] = groups[key] || []).push(slot); });
        const order = ['กะเช้า', 'กะกลาง', 'กะดึก'];
        const html = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)).map(shift => {
            const cnt = groups[shift].reduce((a, sl) => a + (bySlot[sl] || []).length, 0);
            const cards = groups[shift].map(sl => {
                const list = bySlot[sl] || [];
                const avs = list.slice(0, 3).map(r => avatar(r.staff_name, 28)).join('') + (list.length > 3 ? `<span class="bt-av bt-more" style="width:28px;height:28px;font-size:9px">+${list.length - 3}</span>` : '');
                return `<div class="bt-card ${list.length ? '' : 'bt-empty'}" onclick="btOpenSlot('${esc(sl)}')">
                    <div><div class="bt-time">${esc(sl.replace('-', ' – '))}</div><div class="bt-sub">${list.length ? `จองแล้ว <b style="color:#e2e8f0">${list.length}</b> คน` : 'ยังไม่มีคนลง'}</div></div>
                    <div style="display:flex;align-items:center;gap:8px"><div style="display:flex;align-items:center">${avs}</div><span class="bt-eye" title="ดูรายชื่อ"><span class="material-icons" style="font-size:17px">visibility</span></span></div>
                </div>`;
            }).join('');
            return `<div class="bt-shift-h"><div style="font-weight:800;color:#e2e8f0;font-size:14px">${SHIFT_ICON[shift] || ''} ${esc(shift)}</div><span class="bt-tag">รวม ${cnt} คน</span></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">${cards}</div>`;
        }).join('');
        $('btGrid').innerHTML = html;
    };

    // ── popup รายละเอียดช่วงเวลา ──
    window.btOpenSlot = function (slot) {
        const isBoss = ['manager', 'admin'].includes((window.currentUser || {}).role);
        const me = (window.currentUser || {}).username;
        let chipKey = 'all';
        const keyOf = r => `${r.department || 'AM'} / ${r.team || '-'}`;
        window._btCurrentSlot = slot;
        const render = () => {
            // คำนวณรายชื่อใหม่ทุกครั้ง → realtime อัปเดตใน popup ได้
            const all = filtered().filter(r => r.time_slot === slot).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
            const t = document.querySelector('.swal2-title #btSlotCount'); if (t) t.textContent = all.length;
            const counts = {}; all.forEach(r => counts[keyOf(r)] = (counts[keyOf(r)] || 0) + 1);
            const list = chipKey === 'all' ? all : all.filter(r => keyOf(r) === chipKey);
            const chips = `<span class="bt-chip ${chipKey === 'all' ? 'on' : ''}" data-k="all">ทั้งหมด <b>${all.length}</b></span>` +
                Object.keys(counts).sort().map(k => `<span class="bt-chip ${chipKey === k ? 'on' : ''}" data-k="${esc(k)}">${esc(k)} <b>${counts[k]}</b></span>`).join('');
            const rows = list.map(r => {
                const canDel = isBoss || r.staff_name === me;
                return `<div class="bt-row" data-id="${r.id}">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(r.staff_name, 32)}<b style="color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.staff_name)}</b></div>
                    <div><span class="bt-tag">${esc(r.department || 'AM')}</span></div>
                    <div><span class="bt-tag">${esc(r.team || '-')}</span></div>
                    <div style="color:#cbd5e1;font-size:12px"><b style="background:#334155;padding:1px 6px;border-radius:5px;margin-right:4px">${SHIFT_CODE[r.shift_name] || '-'}</b>${esc(r.shift_name || '-')}</div>
                    <div style="text-align:right"><div style="color:#e2e8f0;font-weight:700;font-family:monospace;display:flex;align-items:center;justify-content:flex-end;gap:4px"><span class="material-icons" style="font-size:14px;color:#94a3b8">schedule</span>${fmtTime(r.created_at)}</div><div class="bt-toggle" style="font-size:11px;color:#94a3b8;cursor:pointer;user-select:none">▸ รายละเอียดรายการ</div></div>
                    <div style="text-align:center">${canDel ? `<button onclick="event.stopPropagation();btDel(${r.id},'${esc(r.shift_name)}')" title="ลบรายการนี้" style="border:none;background:rgba(239,68,68,.12);color:#f87171;width:30px;height:30px;border-radius:8px;cursor:pointer"><span class="material-icons" style="font-size:16px">delete</span></button>` : ''}</div>
                    <div class="bt-det">ลงเมื่อ <b style="color:#e2e8f0">${fmtFull(r.created_at)}</b> · ลงโดย <b style="color:#e2e8f0">${esc(r.staff_name)}</b> · วันทำงาน ${esc(r.work_date)} · รหัสรายการ #${r.id}</div>
                </div>`;
            }).join('') || `<div style="padding:30px;text-align:center;color:#64748b;font-size:13px">ไม่มีรายชื่อ</div>`;
            const box = document.getElementById('btSlotBox'); if (!box) return;
            box.innerHTML = `
                <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#0b1220;border:1px solid #1e293b;border-radius:12px;margin-bottom:10px;align-items:center">
                    <div style="font-size:11px;color:#94a3b8;margin-right:6px;line-height:1.5"><b style="color:#cbd5e1">สรุปตามแผนก / เว็บ</b><br>แสดง ${list.length} จาก ${all.length} คน</div>${chips}
                </div>
                <div class="bt-row" style="font-size:11px;color:#94a3b8;font-weight:800;border-bottom:1px solid #334155"><div>ชื่อ</div><div>แผนก</div><div>เว็บ</div><div>กะ</div><div style="text-align:right">เวลาที่ลง</div><div></div></div>
                <div style="max-height:52vh;overflow-y:auto">${rows}</div>`;
            box.querySelectorAll('.bt-chip').forEach(c => c.onclick = () => { chipKey = c.dataset.k; render(); });
            box.querySelectorAll('.bt-toggle').forEach(t => t.onclick = e => { const row = e.target.closest('.bt-row'); row.classList.toggle('open'); e.target.textContent = row.classList.contains('open') ? '▾ รายละเอียดรายการ' : '▸ รายละเอียดรายการ'; });
        };
        Swal.fire({
            title: `<div style="text-align:left"><div style="font-size:20px;font-weight:900;color:#fff;font-family:monospace">${esc(slot.replace('-', ' – '))}</div><div style="font-size:12px;color:#94a3b8;font-weight:500">${fmtDate(dateVal())} · จองแล้ว <span id="btSlotCount">0</span> คน</div></div>`,
            html: `<div id="btSlotBox" style="text-align:left"></div>`,
            width: 'min(960px, 96vw)', background: '#0f172a', color: '#e2e8f0',
            showConfirmButton: false, showCloseButton: true,
            customClass: { popup: 'rounded-2xl border border-slate-700', htmlContainer: 'm-0 p-0' },
            didOpen: render,
            willClose: () => { window._btRerenderSlot = null; window._btCurrentSlot = null; }
        });
        window._btRerenderSlot = render;
    };

    window.btDel = async function (id, shift) {
        if (typeof delSch === 'function') { await delSch(id, shift); }
        else { const ok = await Swal.fire({ icon: 'warning', title: 'ลบรายการนี้?', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' }); if (!ok.isConfirmed) return; await appDB.from('schedules').delete().eq('id', id); }
        await btRender(true);
    };

    window.btShiftDate = function (n) {
        const d = new Date(dateVal() + 'T00:00:00'); d.setDate(d.getDate() + n);
        $('wDate').value = iso(d); btRender(true);
    };

    // ── เข้าหน้า ──
    window.initBreakTable = async function () {
        if (!$('btGrid')) return;
        // วันเริ่มต้น = วันนี้ (00:00-07:59 ถือเป็นเมื่อวาน — กะดึกคร่อมวัน)
        const t = new Date(); if (t.getHours() < 8) t.setDate(t.getDate() - 1);
        if (!$('wDate').value) $('wDate').value = iso(t);
        // รายชื่อเว็บ
        const ts = $('btTeam'); if (ts && ts.options.length <= 1 && typeof TEAM_LIST !== 'undefined') [...TEAM_LIST].sort().forEach(x => { const o = document.createElement('option'); o.value = x; o.textContent = x; ts.appendChild(o); });
        // ช่วงเวลาจากตั้งค่า
        if (typeof window.applyCustomTimeSlots === 'function' && (!window.SHIFT_GROUPS_ALL || !Object.keys(window.SHIFT_GROUPS_ALL.AM || {}).length)) { try { await window.applyCustomTimeSlots(); } catch (e) {} }
        // สิทธิ์: ถ้าเห็นได้แค่กะตัวเอง → ล็อกตัวกรองกะ
        const me = window.currentUser || {};
        const canAll = ['manager', 'admin'].includes(me.role) || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('dashboard_view_all_shifts'));
        if (!canAll && ['กะเช้า', 'กะกลาง', 'กะดึก'].includes(me.allowed_shift)) { $('btShift').value = me.allowed_shift; $('btShift').disabled = true; }
        await btRender(true);
        // 📡 realtime: มีคนลง/ลบพัก → วาดใหม่ (และอัปเดต popup ถ้าเปิดอยู่)
        if (_sub) { try { appDB.removeChannel(_sub); } catch (e) {} }
        let timer = null;
        _sub = appDB.channel('breaktable-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                clearTimeout(timer); timer = setTimeout(async () => { await load(true); await btRender(true); if (Swal.isVisible() && window._btRerenderSlot) window._btRerenderSlot(); }, 300);
            }).subscribe();
        if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(_sub);
    };
})();
