// =====================================================================
// 📒 ประวัติการทำงานพนักงาน (staff_record)
//   • ลงเรื่องที่พนักงานทำผิด: เลือกคน → กดเรื่อง (หลายเรื่องได้) → บันทึก  (1 เรื่อง = 1 แถว)
//   • สรุปรายเดือน: ใครผิดเรื่องไหนกี่ครั้ง กดชื่อเพื่อดูไทม์ไลน์
//   • ตาราง: staff_records (สร้างด้วย sql/staff_records.sql)
//   • หัวข้อเรื่อง: settings.staff_record_topics (แก้ได้ในหน้านี้)
//   • สิทธิ์: staff_record (เข้าหน้า) / staff_record_add / staff_record_delete / staff_record_view_all / staff_record_topics
// =====================================================================

window.SR = window.SR || {
    month: null,          // 'YYYY-MM'
    rows: [],             // ประวัติของเดือนที่เลือก
    topics: [],           // [{name,color}]
    picked: null,         // พนักงานที่เลือกในฟอร์ม
    selTopics: new Set(),
    open: new Set(),      // การ์ดพนักงานที่กางไทม์ไลน์อยู่
    recent: [],
    sub: null,
    empActive: -1
};

const SR_DEFAULT_TOPICS = [
    { name: 'มาสาย', color: '#f59e0b' },
    { name: 'ลืมเช็คชื่อ', color: '#3b82f6' },
    { name: 'ออกจากหน้างานไม่แจ้ง', color: '#ef4444' },
    { name: 'ตอบลูกค้าช้า', color: '#06b6d4' },
    { name: 'ทำงานผิดขั้นตอน', color: '#a855f7' },
    { name: 'ไม่รับสาย / ติดต่อไม่ได้', color: '#ec4899' },
    { name: 'พฤติกรรมไม่เหมาะสม', color: '#f97316' },
    { name: 'อื่นๆ', color: '#64748b' }
];
const SR_PALETTE = ['#f59e0b','#3b82f6','#ef4444','#06b6d4','#a855f7','#ec4899','#f97316','#10b981','#6366f1','#14b8a6','#84cc16','#64748b'];
const _srEsc = s => (window.escapeHtml ? window.escapeHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const _srPerm = id => {
    if (typeof window.hasUserPerm !== 'function') return false;
    return window.hasUserPerm(id);
};
const _srTH_M = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const _srToday = () => {
    const d = (typeof window.serverNow === 'function') ? window.serverNow() : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const _srMonthRange = ym => {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`];
};
const _srTopicColor = name => (SR.topics.find(t => t.name === name) || {}).color || '#64748b';
const _srUsers = () => (typeof GLOBAL_USER_LIST !== 'undefined' && Array.isArray(GLOBAL_USER_LIST)) ? GLOBAL_USER_LIST : [];
const _srUserOf = name => _srUsers().find(u => String(u.username).toLowerCase() === String(name).toLowerCase());

// ── เริ่มหน้า ──
window.initStaffRecord = async function() {
    if (!SR.month) SR.month = _srToday().slice(0, 7);
    const dateEl = document.getElementById('srDate'); if (dateEl && !dateEl.value) dateEl.value = _srToday();

    const canAdd = _srPerm('staff_record_add');
    const form = document.getElementById('srFormCard'); const wrap = document.getElementById('srWrap');
    if (form) form.style.display = canAdd ? '' : 'none';
    if (wrap) wrap.classList.toggle('no-form', !canAdd);
    const tl = document.getElementById('srTopicManageLink'); if (tl) tl.style.display = _srPerm('staff_record_topics') ? '' : 'none';

    if (_srUsers().length === 0 && typeof fetchUsers === 'function') { try { await fetchUsers(); } catch (e) {} }
    await srLoadTopics();
    srFillFilters();
    srRenderTopics();
    srRenderRecent();
    await srLoad();
    srSubscribe();
};

// ── หัวข้อเรื่อง ──
window.srLoadTopics = async function() {
    let list = null;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'staff_record_topics').maybeSingle();
        if (data && data.value) list = JSON.parse(data.value);
    } catch (e) {}
    SR.topics = (Array.isArray(list) && list.length) ? list : SR_DEFAULT_TOPICS.slice();
};
window.srRenderTopics = function() {
    const box = document.getElementById('srTopics'); if (!box) return;
    box.innerHTML = SR.topics.map(t => `<button type="button" class="sr-topic ${SR.selTopics.has(t.name) ? 'on' : ''}" style="--c:${t.color}" onclick="srToggleTopic(this, '${_srEsc(t.name).replace(/'/g, "\\'")}')"><i></i>${_srEsc(t.name)}</button>`).join('');
};
window.srToggleTopic = function(btn, name) {
    if (SR.selTopics.has(name)) SR.selTopics.delete(name); else SR.selTopics.add(name);
    btn.classList.toggle('on', SR.selTopics.has(name));
};
window.srManageTopics = async function() {
    if (!_srPerm('staff_record_topics')) return;
    const rows = SR.topics.map((t, i) => `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
            <input type="color" value="${t.color}" data-i="${i}" class="sr-mt-c" style="width:34px;height:34px;border:0;background:none;cursor:pointer">
            <input type="text" value="${_srEsc(t.name)}" data-i="${i}" class="sr-mt-n swal2-input" style="margin:0;height:36px;flex:1;font-size:14px">
            <button type="button" data-i="${i}" class="sr-mt-del" style="width:34px;height:34px;border-radius:8px;border:1px solid #ef444455;color:#ef4444;background:transparent;cursor:pointer">✕</button>
        </div>`).join('');
    const res = await Swal.fire({
        title: 'แก้หัวข้อเรื่องที่ผิด',
        html: `<div id="srMtBox" style="text-align:left;max-height:50vh;overflow:auto">${rows}</div>
               <button type="button" id="srMtAdd" style="margin-top:6px;height:36px;padding:0 14px;border-radius:10px;border:1px dashed #94a3b8;background:transparent;cursor:pointer;font-weight:800">+ เพิ่มหัวข้อ</button>
               <div style="margin-top:10px;font-size:12px;color:#94a3b8">ลบหัวข้อแล้ว ประวัติเก่าที่ใช้หัวข้อนั้นยังอยู่ครบ</div>`,
        showCancelButton: true, confirmButtonText: 'บันทึกหัวข้อ', cancelButtonText: 'ยกเลิก', width: 520,
        didOpen: () => {
            const box = document.getElementById('srMtBox');
            box.addEventListener('click', e => { const b = e.target.closest('.sr-mt-del'); if (b) b.parentElement.remove(); });
            document.getElementById('srMtAdd').onclick = () => {
                const i = box.children.length;
                box.insertAdjacentHTML('beforeend', `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="color" value="${SR_PALETTE[i % SR_PALETTE.length]}" class="sr-mt-c" style="width:34px;height:34px;border:0;background:none;cursor:pointer"><input type="text" placeholder="ชื่อหัวข้อ" class="sr-mt-n swal2-input" style="margin:0;height:36px;flex:1;font-size:14px"><button type="button" class="sr-mt-del" style="width:34px;height:34px;border-radius:8px;border:1px solid #ef444455;color:#ef4444;background:transparent;cursor:pointer">✕</button></div>`);
                box.lastElementChild.querySelector('.sr-mt-n').focus();
            };
        },
        preConfirm: () => {
            const out = []; const seen = new Set();
            document.querySelectorAll('#srMtBox > div').forEach(r => {
                const n = r.querySelector('.sr-mt-n').value.trim(); const c = r.querySelector('.sr-mt-c').value;
                if (n && !seen.has(n)) { seen.add(n); out.push({ name: n, color: c }); }
            });
            if (!out.length) { Swal.showValidationMessage('ต้องมีอย่างน้อย 1 หัวข้อ'); return false; }
            return out;
        }
    });
    if (!res.isConfirmed) return;
    const { error } = await appDB.from('settings').upsert([{ key: 'staff_record_topics', value: JSON.stringify(res.value) }]);
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    SR.topics = res.value;
    [...SR.selTopics].forEach(n => { if (!SR.topics.find(t => t.name === n)) SR.selTopics.delete(n); });
    srRenderTopics(); srFillFilters(); srRender();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกหัวข้อแล้ว', showConfirmButton: false, timer: 1400 });
};

// ── ตัวกรอง ──
window.srFillFilters = function() {
    const d = document.getElementById('srFilterDept');
    if (d) {
        const cur = d.value || 'all';
        const depts = [...new Set(_srUsers().map(u => u.department || 'AM'))].sort();
        d.innerHTML = '<option value="all">ทุกแผนก</option>' + depts.map(x => `<option value="${_srEsc(x)}">${_srEsc(x)}</option>`).join('');
        d.value = depts.includes(cur) ? cur : 'all';
    }
    const t = document.getElementById('srFilterTopic');
    if (t) {
        const cur = t.value || 'all';
        const names = [...new Set([...SR.topics.map(x => x.name), ...SR.rows.map(r => r.topic)])];
        t.innerHTML = '<option value="all">ทุกเรื่อง</option>' + names.map(x => `<option value="${_srEsc(x)}">${_srEsc(x)}</option>`).join('');
        t.value = names.includes(cur) ? cur : 'all';
    }
};

// ── เลือกพนักงานในฟอร์ม ──
window.srEmpFilter = function() {
    const inp = document.getElementById('srEmpSearch'), list = document.getElementById('srEmpList');
    if (!inp || !list) return;
    const q = inp.value.trim().toLowerCase();
    const users = _srUsers().filter(u => u.username && (!q || u.username.toLowerCase().includes(q)))
        .sort((a, b) => a.username.localeCompare(b.username)).slice(0, 60);
    SR.empActive = users.length ? 0 : -1;
    list.innerHTML = users.length ? users.map((u, i) => `<div class="sr-emp-opt ${i === 0 ? 'act' : ''}" data-n="${_srEsc(u.username)}" onmousedown="event.preventDefault(); srEmpPick('${_srEsc(u.username).replace(/'/g, "\\'")}')">${_srEsc(u.username)}<small>${_srEsc(u.department || 'AM')}${u.allowed_shift ? ' · ' + _srEsc(String(u.allowed_shift).replace('กะ', '')) : ''}</small></div>`).join('')
        : '<div class="sr-emp-opt" style="color:var(--k-mute);cursor:default">ไม่พบชื่อนี้</div>';
    list.classList.add('on');
};
window.srEmpKey = function(e) {
    const list = document.getElementById('srEmpList'); if (!list) return;
    const opts = [...list.querySelectorAll('.sr-emp-opt[data-n]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!opts.length) return;
        SR.empActive = (SR.empActive + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts.forEach((o, i) => o.classList.toggle('act', i === SR.empActive));
        opts[SR.empActive].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault(); if (opts[SR.empActive]) srEmpPick(opts[SR.empActive].dataset.n);
    } else if (e.key === 'Escape') { list.classList.remove('on'); }
};
window.srEmpPick = function(name) {
    const u = _srUserOf(name); if (!u) return;
    SR.picked = u;
    document.getElementById('srEmpList').classList.remove('on');
    document.getElementById('srEmpSearch').style.display = 'none';
    document.getElementById('srEmpPicked').classList.add('on');
    document.getElementById('srEmpPickedName').textContent = u.username;
    document.getElementById('srEmpPickedMeta').textContent = (u.department || 'AM') + (u.allowed_shift ? ' · ' + String(u.allowed_shift).replace('กะ', '') : '');
};
window.srEmpClear = function() {
    SR.picked = null;
    const inp = document.getElementById('srEmpSearch');
    document.getElementById('srEmpPicked').classList.remove('on');
    inp.style.display = ''; inp.value = ''; inp.focus();
};
if (!window.__srDocBound) {
    window.__srDocBound = true;
    document.addEventListener('click', e => {
        const list = document.getElementById('srEmpList');
        if (list && !e.target.closest('.sr-emp')) list.classList.remove('on');
    });
}

// ── บันทึก ──
window.srSave = async function() {
    if (!_srPerm('staff_record_add')) return Swal.fire('ไม่มีสิทธิ์', 'บัญชีนี้ลงประวัติไม่ได้', 'warning');
    const date = document.getElementById('srDate').value;
    const note = document.getElementById('srNote').value.trim();
    if (!SR.picked) return Swal.fire('ยังไม่ได้เลือกพนักงาน', 'พิมพ์ชื่อแล้วเลือกจากรายการ', 'warning');
    if (!date) return Swal.fire('ยังไม่ได้เลือกวันที่', '', 'warning');
    if (!SR.selTopics.size) return Swal.fire('ยังไม่ได้เลือกเรื่องที่ผิด', 'กดเลือกได้มากกว่า 1 เรื่อง', 'warning');

    const by = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : '';
    const payload = [...SR.selTopics].map(topic => ({ user_id: String(SR.picked.id ?? ''), user_name: SR.picked.username, record_date: date, topic, note: note || null, created_by: by }));
    const btn = document.getElementById('srSaveBtn'); btn.disabled = true;
    const { data, error } = await appDB.from('staff_records').insert(payload).select();
    btn.disabled = false;
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', (error.message || '') + (String(error.message || '').includes('staff_records') ? '<br><small>ยังไม่ได้สร้างตาราง — รันไฟล์ sql/staff_records.sql ใน Supabase ก่อน</small>' : ''), 'error');

    SR.recent = [...(data || payload), ...SR.recent].slice(0, 6);
    srRenderRecent();
    SR.selTopics.clear(); srRenderTopics();
    document.getElementById('srNote').value = '';
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `บันทึก ${payload.length} เรื่องให้ ${SR.picked.username} แล้ว`, showConfirmButton: false, timer: 1600 });
    if (date.slice(0, 7) === SR.month) await srLoad();
};
window.srRenderRecent = function() {
    const box = document.getElementById('srRecent'); if (!box) return;
    if (!SR.recent.length) { box.innerHTML = '<div class="sr-hint">ยังไม่มี</div>'; return; }
    box.innerHTML = SR.recent.map(r => `<div class="sr-recent-i"><span class="sr-chip" style="--c:${_srTopicColor(r.topic)}">${_srEsc(r.topic)}</span><b>${_srEsc(r.user_name)}</b><small>${_srEsc(r.record_date)}</small></div>`).join('');
};

// ── โหลดข้อมูลเดือน ──
window.srLoad = async function() {
    const [a, b] = _srMonthRange(SR.month);
    const [y, m] = SR.month.split('-').map(Number);
    const lab = document.getElementById('srMonthLabel'); if (lab) lab.textContent = `${_srTH_M[m - 1]} ${y + 543}`;
    let q = appDB.from('staff_records').select('*').gte('record_date', a).lte('record_date', b).order('record_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000);
    if (!_srPerm('staff_record_view_all') && typeof currentUser !== 'undefined' && currentUser) q = q.ilike('user_name', currentUser.username);
    const { data, error } = await q;
    if (error) {
        const list = document.getElementById('srList');
        if (list) list.innerHTML = `<div class="sr-empty"><span class="material-icons">error_outline</span>โหลดข้อมูลไม่ได้: ${_srEsc(error.message)}${String(error.message).includes('staff_records') ? '<br>ยังไม่ได้สร้างตาราง — รันไฟล์ <b>sql/staff_records.sql</b> ใน Supabase ก่อน' : ''}</div>`;
        return;
    }
    SR.rows = data || [];
    srFillFilters();
    srRender();
};
window.srShiftMonth = function(n) {
    if (n === 0) SR.month = _srToday().slice(0, 7);
    else { const [y, m] = SR.month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); SR.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    SR.open.clear();
    srLoad();
};

// ── วาดสรุป ──
window.srRender = function() {
    const list = document.getElementById('srList'); if (!list) return;
    const qName = (document.getElementById('srFilterName')?.value || '').trim().toLowerCase();
    const fDept = document.getElementById('srFilterDept')?.value || 'all';
    const fTopic = document.getElementById('srFilterTopic')?.value || 'all';

    const rows = SR.rows.filter(r => {
        if (qName && !String(r.user_name).toLowerCase().includes(qName)) return false;
        if (fTopic !== 'all' && r.topic !== fTopic) return false;
        if (fDept !== 'all') { const u = _srUserOf(r.user_name); if (!u || (u.department || 'AM') !== fDept) return false; }
        return true;
    });

    // KPI
    const byTopic = {}; rows.forEach(r => byTopic[r.topic] = (byTopic[r.topic] || 0) + 1);
    const top = Object.entries(byTopic).sort((a, b) => b[1] - a[1])[0];
    const people = new Set(rows.map(r => String(r.user_name).toLowerCase()));
    document.getElementById('srKpiTotal').innerHTML = `${rows.length}<small>ครั้ง</small>`;
    document.getElementById('srKpiPeople').innerHTML = `${people.size}<small>คน</small>`;
    document.getElementById('srKpiTop').innerHTML = top ? `${_srEsc(top[0])}<small>${top[1]} ครั้ง</small>` : '-';

    if (!rows.length) {
        list.innerHTML = `<div class="sr-empty"><span class="material-icons">sentiment_satisfied</span>${SR.rows.length ? 'ไม่พบตามตัวกรอง' : 'เดือนนี้ยังไม่มีประวัติ'}</div>`;
        return;
    }

    // จัดกลุ่มตามคน
    const groups = {};
    rows.forEach(r => { const k = String(r.user_name).toLowerCase(); (groups[k] = groups[k] || { name: r.user_name, items: [] }).items.push(r); });
    const canDel = _srPerm('staff_record_delete');
    const sorted = Object.values(groups).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));

    list.innerHTML = sorted.map(g => {
        const key = g.name.toLowerCase();
        const u = _srUserOf(g.name);
        const cnt = {}; g.items.forEach(r => cnt[r.topic] = (cnt[r.topic] || 0) + 1);
        const chips = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="sr-chip" style="--c:${_srTopicColor(t)}">${_srEsc(t)} <b>×${n}</b></span>`).join('');
        const meta = u ? `<span class="sr-tag">${_srEsc(u.department || 'AM')}</span>${u.allowed_shift ? `<span class="sr-tag">${_srEsc(String(u.allowed_shift).replace('กะ', ''))}</span>` : ''}` : '<span class="sr-tag">ไม่อยู่ในระบบ</span>';
        const tl = g.items.map(r => {
            const [yy, mm, dd] = String(r.record_date).split('-').map(Number);
            return `<div class="sr-tl-i">
                <div class="sr-tl-d">${dd} ${_srTH_M[mm - 1]}</div>
                <div class="sr-tl-t"><span class="sr-chip" style="--c:${_srTopicColor(r.topic)}">${_srEsc(r.topic)}</span></div>
                <div class="sr-tl-n">${r.note ? _srEsc(r.note) : '<span style="color:var(--k-mute3)">—</span>'}<small>ลงโดย ${_srEsc(r.created_by || '-')}</small></div>
                ${canDel ? `<button type="button" class="sr-del" title="ลบรายการนี้" onclick="srDelete(${Number(r.id)})"><span class="material-icons">delete_outline</span></button>` : '<span></span>'}
            </div>`;
        }).join('');
        const n = g.items.length;
        return `<div class="sr-emp-card ${SR.open.has(key) ? 'open' : ''}" data-k="${_srEsc(key)}">
            <div class="sr-emp-row" onclick="srToggleEmp(this)">
                <div class="sr-av">${_srEsc(g.name.slice(0, 2).toUpperCase())}</div>
                <div style="min-width:120px"><div class="sr-nm">${_srEsc(g.name)}</div><div class="sr-meta">${meta}</div></div>
                <div class="sr-chips">${chips}</div>
                <div class="sr-total ${n >= 5 ? 'hot' : ''}"><b>${n}</b><small>ครั้ง</small></div>
                <span class="material-icons sr-caret">expand_more</span>
            </div>
            <div class="sr-tl">${tl}</div>
        </div>`;
    }).join('');
};
window.srToggleEmp = function(row) {
    const card = row.closest('.sr-emp-card'); const k = card.dataset.k;
    card.classList.toggle('open');
    if (card.classList.contains('open')) SR.open.add(k); else SR.open.delete(k);
};

// ── ลบ ──
window.srDelete = async function(id) {
    if (!_srPerm('staff_record_delete')) return;
    const r = SR.rows.find(x => Number(x.id) === Number(id));
    const ok = await Swal.fire({ title: 'ลบรายการนี้?', html: r ? `<b>${_srEsc(r.user_name)}</b> · ${_srEsc(r.topic)} · ${_srEsc(r.record_date)}` : '', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!ok.isConfirmed) return;
    const { error } = await appDB.from('staff_records').delete().eq('id', id);
    if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
    SR.rows = SR.rows.filter(x => Number(x.id) !== Number(id));
    SR.recent = SR.recent.filter(x => Number(x.id) !== Number(id)); srRenderRecent();
    srRender();
};

// ── อัปเดตสด ──
window.srSubscribe = function() {
    if (SR.sub || !appDB.channel) return;
    let t = null;
    SR.sub = appDB.channel('staff-records-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_records' }, () => {
            clearTimeout(t);
            t = setTimeout(() => { if (document.getElementById('srList')) srLoad(); }, 400);   // รวมหลายเหตุการณ์ติดกันเป็นครั้งเดียว
        })
        .subscribe();
};
