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
    picked: null,         // (คงไว้ให้โค้ดเก่า) = คนแรกที่เลือก
    pickedList: [],       // 👥 พนักงานที่เลือก (ลงหลายคนพร้อมกันได้)
    kind: 'offense',      // 🏷️ ประเภทที่จะลง: offense = ทำผิด / note = บันทึกเรื่องราว
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
const _srTime = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.'; };
const _srDateTimeShort = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return `${d.getDate()} ${_srTH_M[d.getMonth()]} ${_srTime(iso)}`; };
// หัวข้อแยกตามแผนก: AM / OD (แผนกที่ขึ้นต้นด้วย OD = OD, อื่นๆ = AM) · หัวข้อเก่าที่ยังไม่ระบุ = ใช้ได้ทั้งสองฝั่ง
const _srGroupOf = dept => String(dept || 'AM').toUpperCase().startsWith('OD') ? 'OD' : 'AM';
const _srTopicIn = (t, g) => !t.group || t.group === 'ALL' || t.group === g;
const _srTopicLimit = name => { const t = SR.topics.find(x => x.name === name); const n = t ? Number(t.limit) : 0; return n > 0 ? n : 0; };
// นับว่าเดือนของวันที่ที่ระบุ คนนี้ผิดเรื่องนี้ไปแล้วกี่ครั้ง (ใช้ข้อมูลเดือนที่เปิดอยู่)
const _srCountOf = (name, topic) => SR.rows.filter(r => !_srIsNote(r) && String(r.user_name).toLowerCase() === String(name).toLowerCase() && r.topic === topic).length;
// แยก "ใบปรับ" (ลงอัตโนมัติจากหน้าใบปรับ) กับ "ประวัติ" (ลงเองในหน้านี้)
const _srIsFine = r => !!r._fine || String(r.topic || '').startsWith('ใบปรับ');   // _fine = รายการที่มีใบปรับเรื่องเดียวกันผูกอยู่
// แสดงผล: ใบปรับทุกข้อรวมเป็นคำว่า "ใบปรับ" คำเดียว (ไม่โชว์ข้อกฎยาวๆ) · หมายเหตุไม่โชว์ยอดเงิน (ยังเก็บไว้คิดยอดรวม)
const _srLabel = t => String(t || '').startsWith('ใบปรับ') ? 'ใบปรับ' : String(t || '');
const _srNoteShow = r => String(r.note || '').replace(/^\[บันทึก\]\s*/, '').replace(/\s*·?\s*(ค่าปรับ ฿[\d,]+|ไม่ได้ค่าแรง)\s*/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '').trim();
const _srFineAmount = r => { if (r._fine) return _srFineAmount(r._fine); const m = String(r.note || '').match(/ค่าปรับ ฿([\d,]+)/); return m ? Number(m[1].replace(/,/g, '')) : 0; };
// 🏷️ ประเภทรายการ: ทำผิด (นับ) / บันทึกเรื่องราว (ไม่นับ) — ถ้ายังไม่ได้เพิ่มคอลัมน์ kind จะใช้คำนำหน้า [บันทึก] ในหมายเหตุแทน
const SR_NOTE_TAG = '[บันทึก] ';
const _srIsNote = r => r.kind === 'note' || String(r.note || '').startsWith(SR_NOTE_TAG.trim());
const _srNoteText = r => String(r.note || '').replace(/^\[บันทึก\]\s*/, '');
const _srOff = items => items.filter(r => !_srIsNote(r));   // เฉพาะรายการที่นับเป็นการทำผิด
const _srSplit = items => {
    const notes = items.filter(_srIsNote).length;
    items = _srOff(items);
    const fines = items.filter(_srIsFine);
    return { notes, hist: items.length - fines.length, fine: fines.length, amount: fines.reduce((a, r) => a + _srFineAmount(r), 0), nowage: fines.filter(r => String((r._fine || r).note || '').includes('ไม่ได้ค่าแรง')).length };
};
const _srNorm = t => String(t || '').replace(/^\[บันทึก\]\s*/, '').replace(/\s*·?\s*(ค่าปรับ ฿[\d,]+|ไม่ได้ค่าแรง)\s*/g, ' ').replace(/[\s·.,()\-]+/g, '').toLowerCase();
const _srSameStory = (a, b) => {
    const x = _srNorm(a), y = _srNorm(b);
    if (!x || !y) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    // คำซ้ำกันเกินครึ่ง = เรื่องเดียวกัน
    const sa = new Set(String(a).split(/[\s·]+/).filter(w => w.length > 1)), sb = String(b).split(/[\s·]+/).filter(w => w.length > 1);
    if (!sa.size || !sb.length) return false;
    const hit = sb.filter(w => sa.has(w)).length;
    return hit / Math.max(sa.size, sb.length) >= 0.6;
};
function _srMerged(rows) {
    const fines = rows.filter(r => String(r.topic || '').startsWith('ใบปรับ') && !_srIsNote(r));
    const used = new Set(), out = [];
    const manual = rows.filter(r => !String(r.topic || '').startsWith('ใบปรับ'));
    const pairOf = new Map();
    fines.forEach(f => {
        const m = manual.find(r => !pairOf.has(r) && !_srIsNote(r)
            && String(r.user_name).toLowerCase() === String(f.user_name).toLowerCase()
            && String(r.record_date) === String(f.record_date)
            && _srSameStory(r.note, f.note));
        if (m) { pairOf.set(m, f); used.add(f); }
    });
    // หัวข้อที่มีในระบบ เรียงชื่อยาวก่อน (กันจับคำสั้นผิด)
    const names = SR.topics.map(t => t.name).filter(Boolean).sort((a, b) => b.length - a.length);
    const guess = note => { const n = String(note || ''); return names.find(t => n.includes(t)) || null; };
    rows.forEach(r => {
        if (used.has(r)) return;   // ใบปรับที่ถูกรวมเข้ากับประวัติแล้ว ไม่แสดงซ้ำ
        if (pairOf.has(r)) { out.push(Object.assign(Object.create(Object.getPrototypeOf(r)), r, { _fine: pairOf.get(r) })); return; }
        if (String(r.topic || '').startsWith('ใบปรับ')) {
            const g = guess(r.note);
            if (g) { out.push(Object.assign(Object.create(Object.getPrototypeOf(r)), r, { topic: g, _fine: r })); return; }
        }
        out.push(r);
    });
    return out;
}
const _srTopicColor = name => (SR.topics.find(t => t.name === name) || {}).color || (String(name).startsWith('ใบปรับ') ? '#ef4444' : '#64748b');   // รายการจากใบปรับ = สีแดง
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
    const tl = document.getElementById('srTopicManageLink'); if (tl) tl.style.display = _srPerm('staff_record_topics') ? 'flex' : 'none';

    // ปุ่มสลับมุมมอง: อันดับ = ต้องดูของทุกคนได้ · ประวัติการใช้งาน = สิทธิ์ดูประวัติ · ไม่มีปุ่มเสริมเลย → ซ่อนทั้งชุด
    const canRank = _srPerm('staff_record_view_all'), canLog = _srPerm('staff_record_log');
    const rb = document.getElementById('srViewRankBtn'); if (rb) rb.style.display = canRank ? '' : 'none';
    const lb = document.getElementById('srViewLogBtn'); if (lb) lb.style.display = canLog ? '' : 'none';
    const vw = document.getElementById('srViews'); if (vw) vw.style.display = (canRank || canLog) ? '' : 'none';
    if ((SR.view === 'log' && !canLog) || (SR.view === 'rank' && !canRank)) SR.view = 'sum';
    if (!SR.topicGroup) SR.topicGroup = (typeof currentUser !== 'undefined' && currentUser) ? _srGroupOf(currentUser.department) : 'AM';
    if (_srUsers().length === 0 && typeof fetchUsers === 'function') { try { await fetchUsers(); } catch (e) {} }
    await srLoadTopics();
    srFillFilters();
    srRenderTopics();
    srRenderRecent();
    srRenderRecentPeople();
    await srLoad();
    srSetView(SR.view || 'sum');
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
    const hist = _srPickedMonthCounts();
    const canEdit = _srPerm('staff_record_topics');
    box.classList.toggle('can-edit', canEdit);
    box.classList.toggle('edit-mode', canEdit && !!SR.topicEdit);
    const g = SR.topicGroup || 'AM';
    document.querySelectorAll('#srApp .sr-gtabs button').forEach(b => {
        b.classList.toggle('on', b.dataset.g === g);
        const nIn = SR.pickedList.filter(u => _srGroupOf(u.department) === b.dataset.g).length;
        b.innerHTML = `หัวข้อ ${b.dataset.g}${nIn ? `<span class="auto">· เลือก ${nIn} คน</span>` : ''}`;
    });
    box.innerHTML = SR.topics.map((t, i) => {
        if (!_srTopicIn(t, g)) return '';
        const n = hist[t.name] || 0;
        const nm = _srEsc(t.name).replace(/'/g, "\\'");
        return `<span class="sr-topic-wrap"><button type="button" class="sr-topic ${SR.selTopics.has(t.name) ? 'on' : ''}" style="--c:${t.color}" onclick="srToggleTopic(this, '${nm}')" title="${_srEsc(t.name)}${n ? ` · เดือนนี้ผิดเรื่องนี้แล้ว ${n} ครั้ง` : ''}"><i></i><span class="sr-tn">${_srEsc(t.name)}</span>${n ? `<span class="sr-tc">${n}</span>` : ''}<span class="sr-tk">✓</span></button>`
             + (canEdit ? `<button type="button" class="sr-tdel" title="ลบหัวข้อ ${_srEsc(t.name)}" onclick="srDeleteTopic(${i})">✕</button>` : '') + `</span>`;
    }).join('') + (canEdit ? `<button type="button" class="sr-topic add" onclick="srAddTopic()"><span class="material-icons" style="font-size:16px">add</span>เพิ่มหัวข้อ</button>` : '');
    const eb = document.getElementById('srTopicEditBtn'); if (eb) { eb.classList.toggle('on', !!SR.topicEdit); const tt = eb.querySelector('.t'); if (tt) tt.textContent = SR.topicEdit ? 'เสร็จ' : 'ลบ'; }
    srSyncForm();
};
window.srToggleTopic = function(btn, name) {
    if (SR.selTopics.has(name)) SR.selTopics.delete(name); else SR.selTopics.add(name);
    btn.classList.toggle('on', SR.selTopics.has(name));
    srSyncForm();
};

// ── ✨ ตัวช่วยให้ลงเร็วขึ้น ──
// ประวัติเดือนนี้ของคนที่เลือก (จากข้อมูลเดือนที่เปิดอยู่ — ถ้าวันที่ที่จะลงเป็นเดือนเดียวกัน)
function _srPickedMonthCounts() {
    const out = {};
    if (SR.pickedList.length !== 1) return out;
    const d = document.getElementById('srDate'); const ym = (d && d.value ? d.value : _srToday()).slice(0, 7);
    if (ym !== SR.month) return out;
    const k = String(SR.picked.username).toLowerCase();
    SR.rows.forEach(r => { if (!_srIsNote(r) && String(r.user_name).toLowerCase() === k) out[r.topic] = (out[r.topic] || 0) + 1; });
    return out;
}
const _srDateLabel = iso => { if (!iso) return '-'; const [y, m, d] = iso.split('-').map(Number); return `${d} ${_srTH_M[m - 1]} ${y + 543}`; };
const _srAddDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
window.srSetDate = function(n) {
    const d = document.getElementById('srDate'); if (!d) return;
    d.value = _srAddDays(_srToday(), n);
    d.dispatchEvent(new Event('change', { bubbles: true }));
    srRenderTopics();
};
// คนที่ลงล่าสุด (จำในเครื่อง) — กดเลือกซ้ำได้ทันที
const _srRecentPeopleKey = 'sr_recent_people';
const _srGetRecentPeople = () => { try { return JSON.parse(localStorage.getItem(_srRecentPeopleKey) || '[]'); } catch (e) { return []; } };
const _srPushRecentPeople = name => { const a = _srGetRecentPeople().filter(x => x !== name); a.unshift(name); try { localStorage.setItem(_srRecentPeopleKey, JSON.stringify(a.slice(0, 6))); } catch (e) {} };
window.srRenderRecentPeople = function() {};   // (ปุ่มชื่อล่าสุดใต้ช่องพนักงานเอาออกแล้ว — เกะกะ)
// อัปเดต: ประวัติของคนที่เลือก, ตัวนับเรื่อง, ปุ่มวันลัด, สรุปก่อนบันทึก, ปุ่มบันทึก
window.srSyncForm = function() {
    const dEl = document.getElementById('srDate');
    const date = dEl ? dEl.value : '';
    const today = _srToday();
    document.querySelectorAll('#srApp .sr-qbtn[data-d]').forEach(b => b.classList.toggle('on', date === _srAddDays(today, Number(b.dataset.d))));

    const n = SR.selTopics.size;
    const sc = document.getElementById('srSelCount'); if (sc) sc.textContent = n ? `· เลือกแล้ว ${n} เรื่อง` : '';

    const P = SR.pickedList; const np = P.length;
    const ready = np > 0 && !!date && n > 0;
    const sum = document.getElementById('srSum');
    if (sum) {
        sum.classList.toggle('on', ready);
        if (ready) {
            // เตือนล่วงหน้าในกล่องสรุป: ใครจะถึง/เกินเกณฑ์ถ้าบันทึกรอบนี้
            const sameMonth = date.slice(0, 7) === SR.month;
            const hits = [];
            if (sameMonth && SR.kind !== 'note') P.forEach(u => [...SR.selTopics].forEach(t => { const lim = _srTopicLimit(t); if (lim && _srCountOf(u.username, t) + 1 >= lim) hits.push(`${_srEsc(u.username)} · ${_srEsc(t)} ครั้งที่ ${_srCountOf(u.username, t) + 1}/${lim}`); }));
            sum.innerHTML = `จะบันทึกให้ <b>${np === 1 ? _srEsc(P[0].username) : np + ' คน'}</b> วันที่ <b>${_srDateLabel(date)}</b> รวม <b>${np * n} รายการ</b><br>`
                + [...SR.selTopics].map(t => `<span class="sr-chip" style="--c:${_srTopicColor(t)};margin:3px 3px 0 0">${_srEsc(t)}</span>`).join('')
                + (hits.length ? `<div class="sr-sum-warn"><span class="material-icons">warning</span><div><b>ถึงเกณฑ์</b><br>${hits.join('<br>')}</div></div>` : '');
        }
    }
    const btn = document.getElementById('srSaveBtn'), lab = document.getElementById('srSaveLabel');
    if (btn) btn.disabled = !ready;
    const _kw = SR.kind === 'note' ? 'บันทึกเรื่องราว' : 'บันทึก';
    if (lab) lab.textContent = !np ? 'เลือกพนักงานก่อน'
        : (!n ? 'เลือกเรื่องที่ผิดก่อน'
        : (np === 1 ? `${_kw} ${n} เรื่อง ให้ ${P[0].username}` : `${_kw} ${n} เรื่อง ให้ ${np} คน (${np * n} รายการ)`));
};
// ── ลบ / เพิ่มหัวข้อตรงในขั้นที่ 3 ──
async function _srSaveTopics(list) {
    const { error } = await appDB.from('settings').upsert([{ key: 'staff_record_topics', value: JSON.stringify(list) }]);
    if (error) { Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error'); return false; }
    SR.topics = list;
    [...SR.selTopics].forEach(n => { if (!SR.topics.find(t => t.name === n)) SR.selTopics.delete(n); });
    srRenderTopics(); srFillFilters(); srRender();
    return true;
}
window.srSetKind = function(k) {
    SR.kind = k;
    document.querySelectorAll('#srApp .sr-kindsel button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const h = document.getElementById('srKindHint');
    if (h) h.textContent = k === 'note' ? 'เก็บไว้อ่านประกอบ ไม่นับเป็นการทำผิด ไม่ขึ้นอันดับ/เกณฑ์' : 'นับเป็นครั้งที่ผิด ใช้ในเกณฑ์และอันดับ';
    srSyncForm();
};
window.srSetTopicGroup = function(g) {
    SR.topicGroup = g;
    // เรื่องที่เลือกไว้แต่ไม่อยู่ในกลุ่มใหม่ → เอาออก กันบันทึกเรื่องข้ามแผนกโดยไม่ตั้งใจ
    [...SR.selTopics].forEach(n => { const t = SR.topics.find(x => x.name === n); if (t && !_srTopicIn(t, g)) SR.selTopics.delete(n); });
    srRenderTopics();
};
window.srToggleTopicEdit = function() { SR.topicEdit = !SR.topicEdit; srRenderTopics(); };
window.srDeleteTopic = async function(i) {
    if (!_srPerm('staff_record_topics')) return;
    const t = SR.topics[i]; if (!t) return;
    if (SR.topics.length <= 1) return Swal.fire('ลบไม่ได้', 'ต้องมีหัวข้ออย่างน้อย 1 หัวข้อ', 'warning');
    const g = SR.topicGroup || 'AM';
    const shared = !t.group || t.group === 'ALL';
    const used = SR.rows.filter(r => r.topic === t.name).length;
    const ok = await Swal.fire({ title: shared ? `ลบ "${_srEsc(t.name)}" ออกจากหัวข้อ ${g}?` : `ลบหัวข้อ "${_srEsc(t.name)}"?`, html: used ? `เดือนนี้มีประวัติเรื่องนี้ ${used} รายการ<br><small>ประวัติเดิมยังอยู่ครบ แค่ลงเรื่องนี้เพิ่มไม่ได้แล้ว</small>` : 'ประวัติเดิมที่ใช้หัวข้อนี้ยังอยู่ครบ', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ลบหัวข้อ', cancelButtonText: 'ยกเลิก' });
    if (!ok.isConfirmed) return;
    // หัวข้อใช้ร่วม 2 ฝั่ง → เหลือไว้ให้อีกฝั่ง / หัวข้อของฝั่งนี้ → ลบทิ้ง
    const next = shared ? SR.topics.map((x, k) => k === i ? { ...x, group: g === 'AM' ? 'OD' : 'AM' } : x) : SR.topics.filter((_, k) => k !== i);
    if (await _srSaveTopics(next)) {
        _srLog({ action: 'topics', detail: `ลบหัวข้อ "${t.name}" ออกจาก ${shared ? 'หัวข้อ ' + g : 'หัวข้อ ' + (t.group || g)}` });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `ลบหัวข้อ "${t.name}" แล้ว`, showConfirmButton: false, timer: 1400 });
    }
};
window.srAddTopic = async function() {
    if (!_srPerm('staff_record_topics')) return;
    const g = SR.topicGroup || 'AM';
    const res = await Swal.fire({ title: `เพิ่มหัวข้อใหม่ (${g})`, input: 'text', inputPlaceholder: 'เช่น ทำแนะนำเพื่อนผิด', showCancelButton: true, confirmButtonText: 'เพิ่ม', cancelButtonText: 'ยกเลิก',
        inputValidator: v => { v = (v || '').trim(); if (!v) return 'พิมพ์ชื่อหัวข้อก่อน'; if (SR.topics.some(t => t.name === v)) return 'มีหัวข้อนี้อยู่แล้ว'; } });
    if (!res.isConfirmed || !res.value) return;
    const name = String(res.value).trim();
    const used = new Set(SR.topics.map(t => t.color));
    const color = SR_PALETTE.find(c => !used.has(c)) || SR_PALETTE[SR.topics.length % SR_PALETTE.length];
    if (await _srSaveTopics([...SR.topics, { name, color, group: g }])) {
        _srLog({ action: 'topics', detail: `เพิ่มหัวข้อ "${name}" ใน หัวข้อ ${g}` });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `เพิ่มหัวข้อ "${name}" แล้ว`, showConfirmButton: false, timer: 1400 });
    }
};
// ── ⚙ แก้หัวข้อทั้งหมด (หน้าต่างแบบใหม่: แถวละหัวข้อ · สี · ชื่อ · ใช้กับ AM/OD · เกณฑ์ − n + · ลบ) ──
const SR_MT_CSS = `
.srmt-pop.swal2-popup{padding:0 !important;width:min(720px,96vw) !important;border-radius:18px !important;overflow:hidden;background:var(--k-panel) !important;border:1px solid var(--k-line) !important}
.srmt-pop .swal2-title{display:none !important}
.srmt-pop .swal2-html-container{margin:0 !important;padding:0 !important;text-align:left !important;overflow:visible !important}
.srmt-pop .swal2-actions{margin:0 !important;padding:14px 20px 18px !important;width:100%;justify-content:flex-end !important;gap:8px;border-top:1px solid var(--k-line);background:var(--k-panel2)}
.srmt-pop .swal2-confirm{background:#E8C15A !important;color:#1b1406 !important;font-weight:900 !important;border-radius:11px !important;height:42px;padding:0 20px !important;box-shadow:0 6px 16px rgba(232,193,90,.25) !important;margin:0 !important}
.srmt-pop .swal2-cancel{background:var(--k-btn) !important;color:var(--k-tx2) !important;border:1px solid var(--k-line3) !important;font-weight:800 !important;border-radius:11px !important;height:42px;padding:0 16px !important;margin:0 !important}
.srmt-pop .swal2-validation-message{margin:0 20px 10px !important;border-radius:10px}
.srmt-h{display:flex;align-items:center;gap:12px;padding:18px 20px 12px}
.srmt-h .ic{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#E8C15A;color:#1b1406;flex:none}
.srmt-h b{display:block;font-size:17px;font-weight:900;color:var(--k-tx-strong)}
.srmt-h small{display:block;font-size:12px;font-weight:600;color:var(--k-mute)}
.srmt-cols{display:grid;grid-template-columns:36px minmax(0,1fr) 168px 116px 34px;gap:8px;padding:0 20px 6px;font-size:11px;font-weight:800;color:var(--k-mute)}
.srmt-list{max-height:52vh;overflow-y:auto;padding:2px 20px 4px;display:flex;flex-direction:column;gap:6px}
.srmt-row{display:grid;grid-template-columns:36px minmax(0,1fr) 168px 116px 34px;gap:8px;align-items:center;padding:6px;border-radius:12px;background:var(--k-card);border:1px solid var(--k-line)}
.srmt-row:focus-within{border-color:#E8C15A}
.srmt-sw{position:relative;width:32px;height:32px;border-radius:9px;cursor:pointer;box-shadow:inset 0 0 0 2px rgba(255,255,255,.25)}
.srmt-sw input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.srmt-name{height:36px;width:100%;padding:0 10px;border-radius:9px;background:var(--k-field);border:1px solid var(--k-line2);color:var(--k-tx);font-size:13.5px;font-weight:800;outline:none}
.srmt-name:focus{border-color:#E8C15A}
.srmt-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:3px;border-radius:9px;background:var(--k-sunk);border:1px solid var(--k-line)}
.srmt-seg button{height:28px;border-radius:7px;border:0;background:transparent;color:var(--k-mute);font-size:11.5px;font-weight:900;cursor:pointer}
.srmt-seg button.on[data-g="AM"]{background:#2563eb;color:#fff}
.srmt-seg button.on[data-g="OD"]{background:#db2777;color:#fff}
.srmt-seg button.on[data-g="ALL"]{background:var(--k-tx2);color:var(--k-panel)}
.srmt-lim{display:flex;align-items:center;height:36px;border-radius:9px;background:var(--k-field);border:1px solid var(--k-line2);overflow:hidden}
.srmt-lim button{width:30px;height:100%;border:0;background:transparent;color:var(--k-tx3);font-size:16px;font-weight:900;cursor:pointer}
.srmt-lim button:hover{background:var(--k-btn-h);color:var(--k-tx-strong)}
.srmt-lim span{flex:1;text-align:center;font-size:12.5px;font-weight:900;color:var(--k-tx-strong);white-space:nowrap}
.srmt-lim span.off{font-size:11px;font-weight:700;color:var(--k-mute3)}
.srmt-del{width:34px;height:34px;border-radius:9px;border:1px solid transparent;background:transparent;color:var(--k-mute);cursor:pointer;font-size:15px;font-weight:900}
.srmt-del:hover{background:var(--k-red-bg);border-color:var(--k-red-line);color:var(--k-red-tx)}
.srmt-add{margin:8px 20px 4px;width:calc(100% - 40px);height:40px;border-radius:11px;border:1.5px dashed var(--k-line3);background:transparent;color:var(--k-tx3);font-size:13px;font-weight:800;cursor:pointer}
.srmt-add:hover{border-color:#E8C15A;color:var(--k-gold-tx)}
.srmt-foot{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 20px 14px;font-size:11.5px;color:var(--k-mute)}
.srmt-foot b{color:var(--k-tx2)}
@media (max-width:640px){ .srmt-cols{display:none} .srmt-row{grid-template-columns:36px minmax(0,1fr) 34px} .srmt-seg,.srmt-lim{grid-column:1/-1} }
`;
window.srManageTopics = async function() {
    if (!_srPerm('staff_record_topics')) return;
    if (!document.getElementById('srmt-css')) { const st = document.createElement('style'); st.id = 'srmt-css'; st.textContent = SR_MT_CSS; document.head.appendChild(st); }
    const rowHtml = (t, i) => {
        const g = t.group || 'ALL'; const lim = Number(t.limit) || 0;
        return `<div class="srmt-row" data-lim="${lim}" data-g="${g}">
            <label class="srmt-sw" style="background:${t.color}" title="กดเพื่อเปลี่ยนสี"><input type="color" value="${t.color}" oninput="this.parentElement.style.background=this.value"></label>
            <input class="srmt-name" type="text" value="${_srEsc(t.name)}" placeholder="ชื่อหัวข้อ">
            <div class="srmt-seg">${['AM', 'OD', 'ALL'].map(x => `<button type="button" data-g="${x}" class="${g === x ? 'on' : ''}">${x === 'ALL' ? 'ทั้งคู่' : x}</button>`).join('')}</div>
            <div class="srmt-lim" title="ผิดเรื่องนี้กี่ครั้ง/เดือน ถึงจะเตือน"><button type="button" data-d="-1">−</button><span class="${lim ? '' : 'off'}">${lim ? lim + ' ครั้ง' : 'ไม่เตือน'}</span><button type="button" data-d="1">+</button></div>
            <button type="button" class="srmt-del" title="ลบหัวข้อนี้">✕</button>
        </div>`;
    };
    const res = await Swal.fire({
        title: 'แก้หัวข้อ',
        html: `<div class="srmt-h"><span class="ic"><span class="material-icons">tune</span></span><div><b>แก้หัวข้อเรื่องที่ผิด</b><small>เปลี่ยนชื่อ สี ฝั่งที่ใช้ และเกณฑ์เตือนได้ในที่เดียว</small></div></div>
               <div class="srmt-cols"><span>สี</span><span>ชื่อหัวข้อ</span><span>ใช้กับแผนก</span><span>เกณฑ์ / เดือน</span><span></span></div>
               <div id="srMtBox" class="srmt-list custom-scrollbar">${SR.topics.map(rowHtml).join('')}</div>
               <button type="button" id="srMtAdd" class="srmt-add">+ เพิ่มหัวข้อ</button>
               <div class="srmt-foot"><span><b>ทั้งคู่</b> = ขึ้นทั้งแท็บ AM และ OD</span><span><b>เกณฑ์</b> = ถึงกี่ครั้งต่อเดือนจะเตือน + ขึ้นป้ายแดง</span><span>ลบหัวข้อแล้ว ประวัติเดิมยังอยู่ครบ</span></div>`,
        customClass: { popup: 'srmt-pop' },
        showCancelButton: true, confirmButtonText: 'บันทึกหัวข้อ', cancelButtonText: 'ยกเลิก', reverseButtons: true,
        didOpen: () => {
            const box = document.getElementById('srMtBox');
            box.addEventListener('click', e => {
                const row = e.target.closest('.srmt-row'); if (!row) return;
                if (e.target.closest('.srmt-del')) { row.remove(); return; }
                const seg = e.target.closest('.srmt-seg button');
                if (seg) { row.dataset.g = seg.dataset.g; row.querySelectorAll('.srmt-seg button').forEach(b => b.classList.toggle('on', b === seg)); return; }
                const st = e.target.closest('.srmt-lim button');
                if (st) {
                    const v = Math.max(0, Math.min(99, (Number(row.dataset.lim) || 0) + Number(st.dataset.d)));
                    row.dataset.lim = v; const sp = row.querySelector('.srmt-lim span');
                    sp.textContent = v ? v + ' ครั้ง' : 'ไม่เตือน'; sp.classList.toggle('off', !v);
                }
            });
            document.getElementById('srMtAdd').onclick = () => {
                const used = new Set([...box.querySelectorAll('.srmt-sw input')].map(i => i.value.toLowerCase()));
                const color = SR_PALETTE.find(c => !used.has(c)) || SR_PALETTE[box.children.length % SR_PALETTE.length];
                box.insertAdjacentHTML('beforeend', rowHtml({ name: '', color, group: SR.topicGroup || 'ALL', limit: 0 }));
                const last = box.lastElementChild; last.scrollIntoView({ block: 'nearest' }); last.querySelector('.srmt-name').focus();
            };
        },
        preConfirm: () => {
            const out = []; const seen = new Set();
            document.querySelectorAll('#srMtBox .srmt-row').forEach(r => {
                const n = r.querySelector('.srmt-name').value.trim(); const c = r.querySelector('.srmt-sw input').value;
                const lim = Number(r.dataset.lim) || 0;
                if (n && !seen.has(n)) { seen.add(n); const o = { name: n, color: c, group: r.dataset.g || 'ALL' }; if (lim > 0) o.limit = lim; out.push(o); }
            });
            if (!out.length) { Swal.showValidationMessage('ต้องมีอย่างน้อย 1 หัวข้อ'); return false; }
            return out;
        }
    });
    if (!res.isConfirmed || !res.value) return;
    const { error } = await appDB.from('settings').upsert([{ key: 'staff_record_topics', value: JSON.stringify(res.value) }]);
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    SR.topics = res.value;
    _srLog({ action: 'topics', detail: `แก้หัวข้อทั้งหมด (${res.value.length} หัวข้อ)` });
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
    // 📅 เลือกวัน: วันนี้ + วันที่มีรายการในเดือนนี้ (พร้อมจำนวน)
    const dSel = document.getElementById('srFilterDay');
    if (dSel) {
        const cur = dSel.value || 'all';
        const cnt = {}; SR.rows.forEach(r => cnt[r.record_date] = (cnt[r.record_date] || 0) + 1);
        const today = _srToday();
        const days = Object.keys(cnt).sort().reverse();
        const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        const lab = d => { const [y, m, dd] = d.split('-').map(Number); return `${DOW[new Date(y, m - 1, dd).getDay()]} ${dd} ${_srTH_M[m - 1]}`; };
        let opts = '<option value="all">📅 ทั้งเดือน</option>';
        if (today.slice(0, 7) === SR.month) opts += `<option value="${today}">⭐ วันนี้ (${lab(today)}) · ${cnt[today] || 0} รายการ</option>`;
        opts += days.filter(d => d !== today).map(d => `<option value="${d}">${lab(d)} · ${cnt[d]} รายการ</option>`).join('');
        dSel.innerHTML = opts;
        dSel.value = [...dSel.options].some(o => o.value === cur) ? cur : 'all';
    }
    const t = document.getElementById('srFilterTopic');
    if (t) {
        const cur = t.value || 'all';
        const names = [...new Set([...SR.topics.map(x => x.name), ...SR.rows.map(r => _srLabel(r.topic))])];
        t.innerHTML = '<option value="all">ทุกเรื่อง</option>' + names.map(x => `<option value="${_srEsc(x)}">${_srEsc(x)}</option>`).join('');
        t.value = names.includes(cur) ? cur : 'all';
    }
};

// ── เลือกพนักงานในฟอร์ม ──
window.srEmpFilter = function() {
    const inp = document.getElementById('srEmpSearch'), list = document.getElementById('srEmpList');
    if (!inp || !list) return;
    const q = inp.value.trim().toLowerCase();
    const chosen = new Set(SR.pickedList.map(u => u.username));
    const users = _srUsers().filter(u => u.username && !chosen.has(u.username) && (!q || u.username.toLowerCase().includes(q)))
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
    if (!SR.pickedList.some(x => x.username === u.username)) SR.pickedList.push(u);
    SR.picked = SR.pickedList[0] || null;
    const inp = document.getElementById('srEmpSearch'); inp.value = '';
    document.getElementById('srEmpList').classList.remove('on');
    srRenderPicked();
    // แท็บหัวข้อตามแผนกของคนแรก
    SR.topicGroup = _srGroupOf(SR.pickedList[0].department);
    [...SR.selTopics].forEach(n => { const t = SR.topics.find(x => x.name === n); if (t && !_srTopicIn(t, SR.topicGroup)) SR.selTopics.delete(n); });
    srRenderTopics(); srRenderRecentPeople();
    inp.focus();
};
window.srEmpRemove = function(name) {
    SR.pickedList = SR.pickedList.filter(x => x.username !== name);
    SR.picked = SR.pickedList[0] || null;
    srRenderPicked(); srRenderTopics();
};
window.srEmpClear = function() {
    SR.pickedList = []; SR.picked = null;
    const inp = document.getElementById('srEmpSearch'); inp.value = ''; inp.focus();
    srRenderPicked(); srRenderTopics(); srRenderRecentPeople();
};
// 👥 ชิปรายชื่อที่เลือก (กด ✕ เอาออกทีละคน)
window.srRenderPicked = function() {
    const box = document.getElementById('srEmpChips'); if (!box) return;
    const P = SR.pickedList;
    const groups = new Set(P.map(u => _srGroupOf(u.department)));
    box.innerHTML = P.length ? P.map(u => `<span class="sr-pchip"><b>${_srEsc(u.username)}</b><small>${_srEsc(u.department || 'AM')}${u.allowed_shift ? ' · ' + _srEsc(String(u.allowed_shift).replace('กะ', '')) : ''}</small><button type="button" title="เอาออก" onclick="srEmpRemove('${_srEsc(u.username).replace(/'/g, "\\'")}')">✕</button></span>`).join('')
        + (P.length > 1 ? `<button type="button" class="sr-pclear" onclick="srEmpClear()">ล้างทั้งหมด (${P.length})</button>` : '')
        + (groups.size > 1 ? `<div class="sr-pmix"><span class="material-icons">info</span>เลือกทั้ง AM และ OD — หัวข้อที่เลือกจะลงให้ทุกคนเหมือนกัน</div>` : '')
        : '';
    const inp = document.getElementById('srEmpSearch');
    if (inp) inp.placeholder = P.length ? 'พิมพ์ชื่อเพื่อเพิ่มอีกคน' : 'พิมพ์ชื่อพนักงาน (เลือกได้หลายคน)';
};
if (!window.__srDocBound) {
    window.__srDocBound = true;
    document.addEventListener('click', e => {
        const list = document.getElementById('srEmpList');
        if (list && !e.target.closest('.sr-emp')) list.classList.remove('on');
    });
}

// ── 📜 ประวัติการใช้งาน (ใคร ลง/แก้/ลบ อะไร เมื่อไหร่) ──
async function _srLog(entry) {
    try {
        const actor = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : '';
        const rows = (Array.isArray(entry) ? entry : [entry]).map(e => ({ actor, ...e }));
        const { error } = await appDB.from('staff_record_logs').insert(rows);
        if (error && !SR._logWarned) { SR._logWarned = true; console.warn('[staff_record] บันทึกประวัติการใช้งานไม่ได้ — ยังไม่ได้รัน staff_record_logs.sql ?', error.message); }
    } catch (e) {}
}
window.srSetView = function(v) {
    SR.view = v;
    document.getElementById('srSumView').style.display = v === 'sum' ? '' : 'none';
    document.getElementById('srLogView').style.display = v === 'log' ? '' : 'none';
    document.getElementById('srRankView').style.display = v === 'rank' ? '' : 'none';
    document.getElementById('srViewSumBtn').classList.toggle('on', v === 'sum');
    document.getElementById('srViewLogBtn').classList.toggle('on', v === 'log');
    document.getElementById('srViewRankBtn').classList.toggle('on', v === 'rank');
    if (v === 'log') srLoadLog();
    if (v === 'rank') srRenderRank();
};
window.srLoadLog = async function() {
    const box = document.getElementById('srLogList'); if (!box) return;
    const [a, b] = _srMonthRange(SR.month);
    const end = new Date(b + 'T23:59:59'); const start = new Date(a + 'T00:00:00');
    const { data, error } = await appDB.from('staff_record_logs').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(3000);
    if (error) {
        box.innerHTML = `<div class="sr-empty"><span class="material-icons">error_outline</span>โหลดประวัติไม่ได้: ${_srEsc(error.message)}${String(error.message).includes('staff_record_logs') ? '<br>ยังไม่ได้สร้างตาราง — รันไฟล์ <b>staff_record_logs.sql</b> ใน Supabase ก่อน' : ''}</div>`;
        return;
    }
    SR.logs = data || [];
    srRenderLog();
};
window.srRenderLog = function() {
    const box = document.getElementById('srLogList'); if (!box) return;
    const q = (document.getElementById('srLogSearch')?.value || '').trim().toLowerCase();
    const fa = document.getElementById('srLogAction')?.value || 'all';
    const list = (SR.logs || []).filter(l => (fa === 'all' || l.action === fa) && (!q || [l.user_name, l.actor, l.topic, l.note, l.detail].some(x => String(x || '').toLowerCase().includes(q))));
    if (!list.length) { box.innerHTML = `<div class="sr-empty"><span class="material-icons">history</span>${(SR.logs || []).length ? 'ไม่พบตามตัวกรอง' : 'เดือนนี้ยังไม่มีประวัติการใช้งาน'}</div>`; return; }
    const ACT = { add: 'ลงประวัติ', edit: 'แก้ไข', delete: 'ลบ', topics: 'แก้หัวข้อ' };
    let html = '', lastDay = '';
    list.forEach(l => {
        const d = new Date(l.created_at);
        const day = `${['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][d.getDay()]} ${d.getDate()} ${_srTH_M[d.getMonth()]} ${d.getFullYear() + 543}`;
        if (day !== lastDay) { html += `<div class="sr-log-day">${day}</div>`; lastDay = day; }
        const who = `<b>${_srEsc(l.actor || '-')}</b>`;
        let body = '';
        if (l.action === 'topics') body = `${who} ${_srEsc(l.detail || 'แก้หัวข้อ')}`;
        else {
            const tag = l.topic ? `<span class="sr-chip" style="--c:${_srTopicColor(l.topic)}" title="${_srEsc(l.topic)}">${_srEsc(_srLabel(l.topic))}</span>` : '';
            const verb = l.action === 'add' ? 'ลงประวัติให้' : (l.action === 'edit' ? 'แก้ไขประวัติของ' : 'ลบประวัติของ');
            body = `${who} ${verb} <b>${_srEsc(l.user_name || '-')}</b> ${tag}`
                 + `<small>วันที่เกิดเรื่อง ${_srDateLabel(l.record_date)}${_srNoteShow(l) ? ' · หมายเหตุ: ' + _srEsc(_srNoteShow(l)) : ''}</small>`
                 + (l.detail ? `<span class="chg">${l.detail}</span>` : '');
        }
        html += `<div class="sr-log-i"><div class="sr-log-time">${_srTime(l.created_at)}</div><div><span class="sr-act ${_srEsc(l.action)}">${ACT[l.action] || _srEsc(l.action)}</span></div><div class="sr-log-b">${body}</div></div>`;
    });
    box.innerHTML = html;
};

// ── 🏆 อันดับ: ใครโดนเยอะสุด (ข้อมูลเดือนที่เลือก) ──
window.srRankType = function(t) {
    SR.rankType = t;
    document.querySelectorAll('#srApp .sr-rk-type button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    srRenderRank();
};
window.srRenderRank = function() {
    const box = document.getElementById('srRankBody'); if (!box) return;
    // ตัวกรองแผนก/เรื่อง เติมตามข้อมูลล่าสุด
    const dSel = document.getElementById('srRankDept'), tSel = document.getElementById('srRankTopic');
    if (dSel) { const cur = dSel.value || 'all'; const ds = [...new Set(_srUsers().map(u => u.department || 'AM'))].sort(); dSel.innerHTML = '<option value="all">ทุกแผนก</option>' + ds.map(x => `<option value="${_srEsc(x)}">${_srEsc(x)}</option>`).join(''); dSel.value = ds.includes(cur) ? cur : 'all'; }
    if (tSel) { const cur = tSel.value || 'all'; const ts = [...new Set(SR.rows.map(r => _srLabel(r.topic)))].sort(); tSel.innerHTML = '<option value="all">ทุกเรื่อง</option>' + ts.map(x => `<option value="${_srEsc(x)}">${_srEsc(x)}</option>`).join(''); tSel.value = ts.includes(cur) ? cur : 'all'; }
    const type = SR.rankType || 'all', fD = dSel ? dSel.value : 'all', fS = document.getElementById('srRankShift')?.value || 'all', fT = tSel ? tSel.value : 'all';

    const rows = _srMerged(SR.rows).filter(r => {
        if (_srIsNote(r)) return false;   // บันทึกเรื่องราวไม่นับในอันดับ
        if (type === 'hist' && _srIsFine(r)) return false;
        if (type === 'fine' && !_srIsFine(r)) return false;
        if (fT !== 'all' && _srLabel(r.topic) !== fT) return false;
        if (fD !== 'all' || fS !== 'all') { const u = _srUserOf(r.user_name); if (!u) return false; if (fD !== 'all' && (u.department || 'AM') !== fD) return false; if (fS !== 'all' && u.allowed_shift !== fS) return false; }
        return true;
    });
    const g = {};
    rows.forEach(r => { const k = String(r.user_name).toLowerCase(); (g[k] = g[k] || { name: r.user_name, items: [] }).items.push(r); });
    const list = Object.values(g).map(x => ({ ...x, n: x.items.length, sp: _srSplit(x.items) }))
        .sort((a, b) => b.n - a.n || b.sp.fine - a.sp.fine || b.sp.amount - a.sp.amount || a.name.localeCompare(b.name));
    if (!list.length) { box.innerHTML = `<div class="sr-empty"><span class="material-icons">emoji_events</span>${SR.rows.length ? 'ไม่พบตามตัวกรอง' : 'เดือนนี้ยังไม่มีข้อมูล'}</div>`; return; }

    // อันดับร่วม: จำนวนเท่ากัน = อันดับเท่ากัน
    let rank = 0, prev = null;
    list.forEach((x, i) => { if (x.n !== prev) { rank = i + 1; prev = x.n; } x.rank = rank; });
    const max = list[0].n;
    const meta = x => { const u = _srUserOf(x.name); return u ? `${_srEsc(u.department || 'AM')}${u.allowed_shift ? ' · ' + _srEsc(String(u.allowed_shift).replace('กะ', '')) : ''}` : 'ไม่อยู่ในระบบ'; };
    const splitTags = x => `${x.sp.hist ? `<span class="h">ประวัติ ${x.sp.hist}</span>` : ''}${x.sp.fine ? `<span class="f">ใบปรับ ${x.sp.fine}${x.sp.amount ? ' · ฿' + x.sp.amount.toLocaleString('en-US') : ''}</span>` : ''}`;
    const topTopics = x => { const c = {}; x.items.forEach(r => { const k = _srLabel(r.topic); c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `<span style="--c:${_srTopicColor(t)}">${_srEsc(t.replace(/^ใบปรับ:\s*/, 'ใบปรับ · '))} ×${n}</span>`).join(''); };
    const go = name => `srRankOpen('${_srEsc(name).replace(/'/g, "\\'")}')`;

    // โพเดียม 3 อันดับแรก (เรียง 2-1-3)
    const top = list.slice(0, 3);
    const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
    const pod = `<div class="sr-pod" style="${top.length < 3 ? 'grid-template-columns:repeat(' + top.length + ',1fr)' : ''}">` + order.map(x => `
        <div class="sr-pod-i r${Math.min(x.rank, 3)}" onclick="${go(x.name)}" title="ดูรายละเอียด">
            <div class="sr-medal">${x.rank}</div>
            <div class="sr-pod-n">${_srEsc(x.name)}</div>
            <div class="sr-pod-m">${meta(x)}</div>
            <div class="sr-pod-c">${x.n}<small>ครั้ง</small></div>
            <div class="sr-pod-s">${splitTags(x)}</div>
        </div>`).join('') + `</div>`;

    const rest = list.slice(3).map(x => `
        <div class="sr-rk-row" onclick="${go(x.name)}" title="ดูรายละเอียด">
            <div class="sr-rk-no">${x.rank}</div>
            <div class="sr-rk-nm"><b>${_srEsc(x.name)}</b><small>${meta(x)}</small></div>
            <div class="sr-rk-bar">
                <div class="sr-rk-track"><i class="h" style="width:${x.sp.hist / max * 100}%"></i><i class="f" style="width:${x.sp.fine / max * 100}%"></i></div>
                <div class="sr-rk-tp">${topTopics(x)}</div>
            </div>
            <div class="sr-rk-c"><b>${x.n}</b><small>ครั้ง</small>${x.sp.amount ? `<em>฿${x.sp.amount.toLocaleString('en-US')}</em>` : ''}</div>
        </div>`).join('');
    box.innerHTML = pod + (rest ? `<div class="sr-rk-legend"><span><i style="background:#E8C15A"></i>ประวัติ</span><span><i style="background:#ef4444"></i>ใบปรับ</span><span>· ทั้งหมด ${list.length} คน</span></div>` + rest : '');
};
// กดชื่อในอันดับ → ไปหน้ารายชื่อ เปิดการ์ดคนนั้น
window.srRankOpen = function(name) {
    const inp = document.getElementById('srFilterName'); if (inp) inp.value = name;
    SR.open.add(String(name).toLowerCase()); SR.page = 1;
    srSetView('sum'); srRender();
};

// ── บันทึก ──
window.srSave = async function() {
    if (!_srPerm('staff_record_add')) return Swal.fire('ไม่มีสิทธิ์', 'บัญชีนี้ลงประวัติไม่ได้', 'warning');
    const date = document.getElementById('srDate').value;
    const note = document.getElementById('srNote').value.trim();
    if (!SR.pickedList.length) return Swal.fire('ยังไม่ได้เลือกพนักงาน', 'พิมพ์ชื่อแล้วเลือกจากรายการ', 'warning');
    if (!date) return Swal.fire('ยังไม่ได้เลือกวันที่', '', 'warning');
    if (!SR.selTopics.size) return Swal.fire('ยังไม่ได้เลือกเรื่องที่ผิด', 'กดเลือกได้มากกว่า 1 เรื่อง', 'warning');

    const isNote = SR.kind === 'note';
    // ⚠️ เด้งเตือนก่อนบันทึก ถ้ามีคนถึง/เกินเกณฑ์ของเรื่องนั้นในเดือนนี้ (บันทึกเรื่องราวไม่นับ)
    if (!isNote && date.slice(0, 7) === SR.month) {
        const hits = [];
        SR.pickedList.forEach(u => [...SR.selTopics].forEach(t => {
            const lim = _srTopicLimit(t); if (!lim) return;
            const nth = _srCountOf(u.username, t) + 1;
            if (nth >= lim) hits.push(`<tr><td style="text-align:left;padding:4px 8px"><b>${_srEsc(u.username)}</b></td><td style="text-align:left;padding:4px 8px">${_srEsc(t)}</td><td style="padding:4px 8px;font-weight:900;color:#dc2626">ครั้งที่ ${nth}/${lim}</td></tr>`);
        }));
        if (hits.length) {
            const go = await Swal.fire({ icon: 'warning', title: 'มีคนถึงเกณฑ์', html: `<div style="font-size:13px;margin-bottom:8px">บันทึกรอบนี้แล้วจะถึง/เกินเกณฑ์ที่ตั้งไว้ของเดือนนี้</div><table style="width:100%;font-size:13px">${hits.join('')}</table>`, showCancelButton: true, confirmButtonText: 'บันทึกต่อ', cancelButtonText: 'กลับไปแก้', confirmButtonColor: '#dc2626' });
            if (!go.isConfirmed) return;
        }
    }
    const by = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : '';
    const payload = [];
    SR.pickedList.forEach(u => [...SR.selTopics].forEach(topic => payload.push({ user_id: String(u.id ?? ''), user_name: u.username, record_date: date, topic, note: note || null, created_by: by, kind: isNote ? 'note' : 'offense' })));
    const btn = document.getElementById('srSaveBtn'); btn.disabled = true;
    let { data, error } = await appDB.from('staff_records').insert(payload).select();
    if (error && String(error.message || '').includes('kind')) {
        // ยังไม่ได้รัน staff_records_kind.sql → เก็บประเภทเป็นคำนำหน้าในหมายเหตุแทน
        payload.forEach(r => { delete r.kind; if (isNote) r.note = SR_NOTE_TAG + (r.note || ''); });
        ({ data, error } = await appDB.from('staff_records').insert(payload).select());
    }
    btn.disabled = false;
    if (error) return Swal.fire('บันทึกไม่สำเร็จ', (error.message || '') + (String(error.message || '').includes('staff_records') ? '<br><small>ยังไม่ได้สร้างตาราง — รันไฟล์ sql/staff_records.sql ใน Supabase ก่อน</small>' : ''), 'error');

    _srLog((data || payload).map(r => ({ action: 'add', record_id: r.id || null, user_name: r.user_name, record_date: r.record_date, topic: r.topic, note: r.note || null })));
    SR.pickedList.forEach(u => _srPushRecentPeople(u.username));
    SR.recent = [...(data || payload), ...SR.recent].slice(0, 6);
    srRenderRecent();
    // ล้างฟอร์มให้พร้อมลงคนถัดไป (คนที่เพิ่งลงไปอยู่ในปุ่ม "ล่าสุด" กดกลับมาได้ทันที)
    const savedName = SR.pickedList.length === 1 ? SR.pickedList[0].username : SR.pickedList.length + ' คน';
    SR.selTopics.clear();
    document.getElementById('srNote').value = '';
    srSetKind('offense');
    document.getElementById('srDate').value = _srToday();
    SR.pickedList = []; SR.picked = null;
    const _inp = document.getElementById('srEmpSearch'); _inp.value = '';
    srRenderPicked();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `บันทึก ${payload.length} รายการ ให้ ${savedName} แล้ว`, showConfirmButton: false, timer: 1600 });
    if (date.slice(0, 7) === SR.month) await srLoad();
    srRenderTopics(); srRenderRecentPeople();
};
window.srRenderRecent = function() {};   // (ส่วน "ที่ลงล่าสุด" เอาออกแล้ว — เกะกะ)

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
    srRenderTopics();
    if (SR.view === 'rank') srRenderRank();
};
window.srShiftMonth = function(n) {
    if (n === 0) SR.month = _srToday().slice(0, 7);
    else { const [y, m] = SR.month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); SR.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    SR.open.clear(); SR.page = 1;
    const _d = document.getElementById('srFilterDay'); if (_d) _d.value = 'all';
    srLoad();
    if (SR.view === 'log') srLoadLog();
};

// ── วาดสรุป ──
window.srRender = function() {
    const list = document.getElementById('srList'); if (!list) return;
    const qName = (document.getElementById('srFilterName')?.value || '').trim().toLowerCase();
    const fDept = document.getElementById('srFilterDept')?.value || 'all';
    const fTopic = document.getElementById('srFilterTopic')?.value || 'all';
    const fShift = document.getElementById('srFilterShift')?.value || 'all';
    const fDay = document.getElementById('srFilterDay')?.value || 'all';
    const hint = document.getElementById('srDayHint');
    if (hint) {
        if (fDay === 'all') hint.style.display = 'none';
        else { hint.style.display = ''; hint.innerHTML = `<span class="material-icons" style="font-size:17px;color:var(--k-gold-tx)">event</span>กำลังดูเฉพาะวันที่ <b>${_srDateLabel(fDay)}</b><button type="button" onclick="document.getElementById('srFilterDay').value='all';SR.page=1;srRender()">ดูทั้งเดือน</button>`; }
    }

    const rows = _srMerged(SR.rows).filter(r => {
        if (qName && !String(r.user_name).toLowerCase().includes(qName)) return false;
        if (fTopic !== 'all' && _srLabel(r.topic) !== fTopic) return false;
        if (fDay !== 'all' && r.record_date !== fDay) return false;
        if (fDept !== 'all' || fShift !== 'all') {
            const u = _srUserOf(r.user_name); if (!u) return false;
            if (fDept !== 'all' && (u.department || 'AM') !== fDept) return false;
            if (fShift !== 'all' && u.allowed_shift !== fShift) return false;
        }
        return true;
    });

    // KPI
    const people = new Set(rows.map(r => String(r.user_name).toLowerCase()));
    const _sp = _srSplit(rows);
    const _kl = document.querySelector('#srApp .sr-kpi .l'); if (_kl) _kl.textContent = fDay === 'all' ? 'รวมทั้งเดือน' : `รวมวันที่ ${_srDateLabel(fDay)}`;
    document.getElementById('srKpiTotal').innerHTML = `${_srOff(rows).length}<small>ครั้ง</small><span class="sr-kpi-split"><span class="h">ประวัติ ${_sp.hist}</span><span class="f">ใบปรับ ${_sp.fine}${_sp.amount ? ` · ฿${_sp.amount.toLocaleString('en-US')}` : ''}</span>${_sp.notes ? `<span class="n">📝 บันทึก ${_sp.notes}</span>` : ''}</span>`;
    document.getElementById('srKpiPeople').innerHTML = `${people.size}<small>คน</small>`;


    if (!rows.length) {
        list.innerHTML = `<div class="sr-empty"><span class="material-icons">sentiment_satisfied</span>${SR.rows.length ? 'ไม่พบตามตัวกรอง' : 'เดือนนี้ยังไม่มีประวัติ'}</div>`;
        return;
    }

    // จัดกลุ่มตามคน
    const groups = {};
    rows.forEach(r => { const k = String(r.user_name).toLowerCase(); (groups[k] = groups[k] || { name: r.user_name, items: [] }).items.push(r); });
    const canDel = _srPerm('staff_record_delete');
    const canEdit = _srPerm('staff_record_edit') || _srPerm('staff_record_add');   // ลงได้ = แก้ได้
    const sorted = Object.values(groups).sort((a, b) => _srOff(b.items).length - _srOff(a.items).length || b.items.length - a.items.length || a.name.localeCompare(b.name));

    // 📄 แบ่งหน้า หน้าละ 10 คน
    const PER = 10;
    const pages = Math.max(1, Math.ceil(sorted.length / PER));
    SR.page = Math.min(Math.max(1, SR.page || 1), pages);
    const pageItems = sorted.slice((SR.page - 1) * PER, SR.page * PER);

    list.innerHTML = pageItems.map(g => {
        const key = g.name.toLowerCase();
        const u = _srUserOf(g.name);
        const cnt = {}, days = {}, ncnt = {};
        g.items.forEach(r => {
            const k = _srLabel(r.topic);
            if (_srIsNote(r)) { ncnt[k] = (ncnt[k] || 0) + 1; return; }   // บันทึกเรื่องราว ไม่นับ
            cnt[k] = (cnt[k] || 0) + 1;
            (days[k] = days[k] || new Set()).add(String(r.record_date));
        });
        // วันที่ของแต่ละเรื่อง เช่น "11, 14 ต.ค." (เรียงจากวันแรก)
        const _dayList = set => {
            const ds = [...set].sort();
            const byM = {}; ds.forEach(d => { const [, m, dd] = d.split('-').map(Number); (byM[m] = byM[m] || []).push(dd); });
            return Object.entries(byM).map(([m, arr]) => `${arr.join(', ')} ${_srTH_M[m - 1]}`).join(' · ');
        };
        // แต่ละเรื่อง = 1 แถบขนาดเท่ากัน เรียงเป็นตาราง: สี | ชื่อเรื่อง | วันที่ | จำนวนครั้ง
        let hitAny = false;
        const chips = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => {
            const lim = _srTopicLimit(t); const hit = lim && n >= lim; if (hit) hitAny = true;
            return `<div class="sr-sum-i ${hit ? 'hit' : ''}" style="--c:${_srTopicColor(t)}" title="${_srEsc(t)} ${n} ครั้ง${lim ? ` (เกณฑ์ ${lim} ครั้ง/เดือน)` : ''}"><span class="sr-sum-t">${_srEsc(t)}</span>${hit ? '<span class="sr-hit">ถึงเกณฑ์</span>' : ''}${ncnt[t] ? `<span class="sr-ncnt" title="บันทึกเรื่องราว ${ncnt[t]} รายการ (ไม่นับ)">📝${ncnt[t]}</span>` : ''}<span class="sr-sum-d">${_dayList(days[t])}</span><b class="sr-sum-n">${n}${lim ? `<small>/${lim}</small>` : ''}</b></div>`;
        }).join('') + Object.entries(ncnt).filter(([t]) => !cnt[t]).map(([t, n]) => `<div class="sr-sum-i note" style="--c:${_srTopicColor(t)}" title="มีแต่บันทึกเรื่องราว (ไม่นับเป็นการทำผิด)"><span class="sr-sum-t">${_srEsc(t)}</span><span class="sr-ncnt">📝 บันทึก ${n}</span></div>`).join('');
        const meta = u ? `<span class="sr-tag">${_srEsc(u.department || 'AM')}</span>${u.allowed_shift ? `<span class="sr-tag">${_srEsc(String(u.allowed_shift).replace('กะ', ''))}</span>` : ''}` : '<span class="sr-tag">ไม่อยู่ในระบบ</span>';
        g.items.sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
        const tl = g.items.map(r => {
            const [yy, mm, dd] = String(r.record_date).split('-').map(Number);
            const isN = _srIsNote(r); const nt = _srNoteShow(r);
            return `<div class="sr-tl-i ${isN ? 'is-note' : ''}">
                <div class="sr-tl-d">${dd} ${_srTH_M[mm - 1]} ${yy + 543}<small>บันทึก ${_srTime(r.created_at) || '-'}</small></div>
                <div class="sr-tl-t"><span class="sr-chip" style="--c:${_srTopicColor(r.topic)}" title="${_srEsc(r.topic)}">${_srEsc(_srLabel(r.topic))}</span><span class="sr-kind ${isN ? 'n' : 'o'}">${isN ? '📝 บันทึก' : '⚠ ทำผิด'}</span>${r._fine ? `<span class="sr-kind f" title="${_srEsc(r._fine.topic)}">+ ใบปรับ</span>` : ''}</div>
                <div class="sr-tl-n">${nt ? _srEsc(nt) : '<span style="color:var(--k-mute3)">—</span>'}<small>ลงโดย ${_srEsc(r.created_by || '-')} · ${_srDateTimeShort(r.created_at)}${r._fine && r._fine.id !== r.id ? ` · ออกใบปรับโดย ${_srEsc(r._fine.created_by || '-')}` : ''}</small></div>
                <div class="sr-acts">
                    ${canEdit ? `<button type="button" class="sr-edit" title="แก้ไขรายการนี้" onclick="srEdit(${Number(r.id)})"><span class="material-icons">edit</span></button>` : ''}
                    ${canDel ? `<button type="button" class="sr-del" title="ลบรายการนี้" onclick="srDelete(${Number(r.id)})"><span class="material-icons">delete_outline</span></button>` : ''}
                </div>
            </div>`;
        }).join('');
        const n = g.items.length;
        const sp = _srSplit(g.items);
        return `<div class="sr-emp-card ${SR.open.has(key) ? 'open' : ''} ${hitAny ? 'hit' : ''}" data-k="${_srEsc(key)}">
            <div class="sr-emp-row" onclick="srToggleEmp(this)">
                <div class="sr-emp-top">
                    <div style="min-width:0;flex:1"><div class="sr-nm">${_srEsc(g.name)}${hitAny ? ' <span class="sr-hit">ถึงเกณฑ์</span>' : ''}</div><div class="sr-meta">${meta}<span class="sr-tag">${Object.keys(cnt).length} เรื่อง</span>${sp.notes ? `<span class="sr-tag note">📝 บันทึก ${sp.notes}</span>` : ''}</div></div>
                    <div class="sr-split">
                        <div class="sr-sp h" title="ลงประวัติในหน้านี้"><small>ประวัติ</small><b>${sp.hist}</b></div>
                        <div class="sr-sp f ${sp.fine ? 'on' : ''}" title="มาจากการออกใบปรับ"><small>ใบปรับ</small><b>${sp.fine}</b>${sp.amount ? `<em>฿${sp.amount.toLocaleString('en-US')}</em>` : (sp.nowage ? '<em>ไม่ได้ค่าแรง</em>' : '')}</div>
                    </div>
                    <span class="sr-caret-w"><span class="material-icons sr-caret">expand_more</span><small>${SR.open.has(key) ? 'ซ่อน' : 'ดูรายละเอียด'}</small></span>
                </div>
                <div class="sr-sum-grid">${chips}</div>
            </div>
            <div class="sr-tl">${tl}</div>
        </div>`;
    }).join('') + _srPager(SR.page, pages, sorted.length, PER);
};
function _srPager(page, pages, total, per) {
    if (pages <= 1) return '';
    const nums = [];
    for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); }
    const from = (page - 1) * per + 1, to = Math.min(page * per, total);
    return `<div class="sr-pager">
        <button type="button" ${page <= 1 ? 'disabled' : ''} onclick="srGoPage(${page - 1})" title="หน้าก่อน">‹</button>
        ${nums.map(n => n === '…' ? '<span class="gap">…</span>' : `<button type="button" class="${n === page ? 'on' : ''}" onclick="srGoPage(${n})">${n}</button>`).join('')}
        <button type="button" ${page >= pages ? 'disabled' : ''} onclick="srGoPage(${page + 1})" title="หน้าถัดไป">›</button>
        <small>แสดง ${from}–${to} จาก ${total} คน</small>
    </div>`;
}
window.srGoPage = function(n) {
    SR.page = n; srRender();
    const top = document.querySelector('#srSumView .sr-card'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
window.srToggleEmp = function(row) {
    const card = row.closest('.sr-emp-card'); const k = card.dataset.k;
    card.classList.toggle('open');
    if (card.classList.contains('open')) SR.open.add(k); else SR.open.delete(k);
    const lab = card.querySelector('.sr-caret-w small'); if (lab) lab.textContent = card.classList.contains('open') ? 'ซ่อน' : 'ดูรายละเอียด';
};

// ── แก้ไข ──
window.srEdit = async function(id) {
    if (!_srPerm('staff_record_edit') && !_srPerm('staff_record_add')) return;
    const r = SR.rows.find(x => Number(x.id) === Number(id)); if (!r) return;
    const before0 = { ...r };   // เก็บค่าเดิมไว้เทียบตอนบันทึกประวัติการแก้
    const topics = [...new Set([...SR.topics.map(t => t.name), r.topic])];
    const opt = topics.map(t => `<option value="${_srEsc(t)}" ${t === r.topic ? 'selected' : ''}>${_srEsc(t)}</option>`).join('');
    const users = _srUsers().map(u => u.username).sort((a, b) => a.localeCompare(b));
    if (!users.includes(r.user_name)) users.unshift(r.user_name);
    const uopt = users.map(n => `<option value="${_srEsc(n)}" ${n === r.user_name ? 'selected' : ''}>${_srEsc(n)}</option>`).join('');
    const css = 'width:100%;height:40px;margin:0 0 12px;padding:0 10px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;font-weight:700;background:var(--k-field);color:var(--k-tx)';
    const res = await Swal.fire({
        title: 'แก้ไขประวัติ',
        html: `<div style="text-align:left">
            <label style="font-size:12px;font-weight:800">พนักงาน</label><select id="srEdUser" style="${css}">${uopt}</select>
            <label style="font-size:12px;font-weight:800">วันที่เกิดเรื่อง</label><input id="srEdDate" type="date" value="${_srEsc(r.record_date)}" style="${css}">
            <label style="font-size:12px;font-weight:800">เรื่องที่ผิด</label><select id="srEdTopic" style="${css}">${opt}</select>
            <label style="font-size:12px;font-weight:800">ประเภท</label><select id="srEdKind" style="${css}"><option value="offense" ${_srIsNote(r) ? '' : 'selected'}>⚠ ทำผิด (นับครั้ง)</option><option value="note" ${_srIsNote(r) ? 'selected' : ''}>📝 บันทึกเรื่องราว (ไม่นับ)</option></select>
            <label style="font-size:12px;font-weight:800">รายละเอียดเพิ่ม</label><textarea id="srEdNote" rows="3" style="${css};height:auto;padding:8px 10px">${_srEsc(_srNoteText(r))}</textarea>
            <div style="font-size:11.5px;color:#94a3b8">บันทึกเมื่อ ${_srDateTimeShort(r.created_at)} โดย ${_srEsc(r.created_by || '-')}</div>
        </div>`,
        showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ยกเลิก', width: 460,
        preConfirm: () => {
            const v = { user_name: document.getElementById('srEdUser').value, record_date: document.getElementById('srEdDate').value, topic: document.getElementById('srEdTopic').value, note: document.getElementById('srEdNote').value.trim() || null, kind: document.getElementById('srEdKind').value };
            if (!v.record_date) { Swal.showValidationMessage('เลือกวันที่ก่อน'); return false; }
            const u = _srUserOf(v.user_name); v.user_id = u ? String(u.id ?? '') : r.user_id;
            return v;
        }
    });
    if (!res.isConfirmed || !res.value) return;
    let { error } = await appDB.from('staff_records').update(res.value).eq('id', id);
    if (error && String(error.message || '').includes('kind')) {   // ยังไม่มีคอลัมน์ kind → ใช้คำนำหน้าในหมายเหตุ
        const isN = res.value.kind === 'note'; delete res.value.kind;
        res.value.note = isN ? SR_NOTE_TAG + (res.value.note || '') : res.value.note;
        ({ error } = await appDB.from('staff_records').update(res.value).eq('id', id));
    }
    if (error) return Swal.fire('แก้ไขไม่สำเร็จ', error.message, 'error');
    const _chg = [];
    const _lab = { user_name: 'พนักงาน', record_date: 'วันที่', topic: 'เรื่อง', note: 'หมายเหตุ', kind: 'ประเภท' };
    if (before0.kind === undefined) before0.kind = _srIsNote(before0) ? 'note' : 'offense';
    Object.keys(_lab).forEach(k => {
        const before = before0[k] ?? '', after = res.value[k] ?? '';
        if (String(before) !== String(after)) _chg.push(`${_lab[k]}: <s>${_srEsc(k === 'record_date' ? _srDateLabel(before) : (before || '—'))}</s> → ${_srEsc(k === 'record_date' ? _srDateLabel(after) : (after || '—'))}`);
    });
    _srLog({ action: 'edit', record_id: id, user_name: res.value.user_name, record_date: res.value.record_date, topic: res.value.topic, note: res.value.note, detail: _chg.length ? _chg.join(' · ') : 'ไม่มีการเปลี่ยนแปลง' });
    Object.assign(r, res.value);
    if (String(r.record_date).slice(0, 7) !== SR.month) SR.rows = SR.rows.filter(x => x !== r);   // ย้ายไปเดือนอื่น → ออกจากหน้านี้
    srRender(); srRenderTopics();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'แก้ไขแล้ว', showConfirmButton: false, timer: 1300 });
};

// ── ลบ ──
window.srDelete = async function(id) {
    if (!_srPerm('staff_record_delete')) return;
    const r = SR.rows.find(x => Number(x.id) === Number(id));
    const ok = await Swal.fire({ title: 'ลบรายการนี้?', html: r ? `<b>${_srEsc(r.user_name)}</b> · ${_srEsc(r.topic)} · ${_srEsc(r.record_date)}` : '', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
    if (!ok.isConfirmed) return;
    const { error } = await appDB.from('staff_records').delete().eq('id', id);
    if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
    if (r) _srLog({ action: 'delete', record_id: id, user_name: r.user_name, record_date: r.record_date, topic: r.topic, note: r.note || null, detail: `ลงไว้โดย ${_srEsc(r.created_by || '-')} เมื่อ ${_srDateTimeShort(r.created_at)}` });
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_record_logs' }, () => {
            if (SR.view === 'log') { clearTimeout(SR._lt); SR._lt = setTimeout(srLoadLog, 500); }
        })
        .subscribe();
};
