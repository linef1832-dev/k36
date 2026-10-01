// ============================================================
//  กระดิ่งเรียกพนักงาน — ตรรกะหน้าเว็บแอดมิน (js/bell/core.js) v2
//  ใช้ window.appDB (Supabase) + Realtime ตามแพตเทิร์นเดียวกับหน้าอื่นในระบบ
//  settings keys: bell_app_release (เวอร์ชันแอป) | bell_sounds (รายการเสียง) | bell_sound (เสียงที่ใช้)
// ============================================================

window._bellRtSub = window._bellRtSub || null;
window._bellUsers = window._bellUsers || [];        // พนักงานทุกคน (ตาราง users)
window._bellPresence = window._bellPresence || {};  // user_id → แถว bell_presence
window._bellSelected = window._bellSelected || new Set();
window._bellSearch = '';
window._bellFilter = 'all';
window._bellRelease = window._bellRelease || null;
window._bellSounds = window._bellSounds || [];
window._bellSound = window._bellSound || null;
window._bellHistory = [];
window._bellHistPeriod = '7';

const BELL_ONLINE_WINDOW_MS = 60 * 1000;
const BELL_RELEASE_KEY = 'bell_app_release';
const BELL_SOUNDS_KEY = 'bell_sounds';
const BELL_SOUND_KEY = 'bell_sound';
const BELL_BUCKET = 'bell-app';
const BELL_EXE_NAME = 'BellEmployee.exe';
const BELL_DEFAULT_SOUND = { name: '🔔 เสียงมาตรฐานของ Windows', url: '' };

// ────────────────────────── ตัวช่วย ──────────────────────────
function bell_now() { return (typeof window.serverNow === 'function') ? window.serverNow() : new Date(); }
function bell_uuid() { try { return crypto.randomUUID(); } catch (e) { return 'r' + Date.now() + '-' + Math.random().toString(16).slice(2); } }
function bell_esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function bell_timeTxt(ts) { try { return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } }
function bell_full(ts) { if (!ts) return ''; try { return new Date(ts).toLocaleString('th-TH'); } catch (e) { return ''; } }
function bell_hms(sec) { sec = Math.round(Number(sec) || 0); const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m} นาที ${s} วิ` : `${s} วิ`; }
function bell_isOnline(p) { return !!(p && p.last_seen && (bell_now().getTime() - new Date(p.last_seen).getTime()) < BELL_ONLINE_WINDOW_MS); }
function bell_can(id) { return (typeof window.hasUserPerm !== 'function') ? true : window.hasUserPerm(id); }
function bell_verCmp(a, b) {
    const pa = String(a || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
}
function bell_setStatus(msg, kind) {
    const el = document.getElementById('bellStatus'); if (!el) return;
    const colors = {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        err: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    };
    el.className = 'mx-4 mt-3 p-3 rounded-xl text-sm font-bold text-center ' + (colors[kind] || colors.ok);
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(window._bellStatusTimer);
    window._bellStatusTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}
async function bell_getSetting(key) {
    const { data } = await window.appDB.from('settings').select('value').eq('key', key).maybeSingle();
    if (!data || !data.value) return null;
    try { return JSON.parse(data.value); } catch (e) { return null; }
}
async function bell_setSetting(key, obj) {
    const r = await window.appDB.from('settings').upsert([{ key, value: JSON.stringify(obj) }]);
    if (r.error) throw r.error;
}

// ────────────────────────── โหลดข้อมูล ──────────────────────────
window.bell_loadUsers = async function () {
    const { data, error } = await window.appDB.from('users').select('*').order('username', { ascending: true });
    if (error) throw error;
    window._bellUsers = data || [];
};
window.bell_loadPresence = async function () {
    const { data, error } = await window.appDB.from('bell_presence').select('*');
    if (error) throw error;
    const map = {};
    (data || []).forEach(p => { map[String(p.user_id)] = p; });
    window._bellPresence = map;
};
window.bell_load = async function () {
    if (!window.appDB) return;
    try {
        await Promise.all([window.bell_loadUsers(), window.bell_loadPresence()]);
        bell_render();
    } catch (e) { bell_setStatus('โหลดข้อมูลไม่สำเร็จ: ' + (e.message || e), 'err'); }
};
window.bell_refreshPresence = async function () {
    if (!window.appDB) return;
    try { await window.bell_loadPresence(); bell_render(); } catch (e) { }
};

// ────────────────────────── รวมข้อมูล + กรอง ──────────────────────────
function bell_rows() {
    // แถวละ 1 พนักงาน + สถานะจาก presence
    return window._bellUsers.map(u => {
        const id = String(u.id);
        const p = window._bellPresence[id];
        const online = bell_isOnline(p);
        let st = 'offline';
        if (online) st = (p.status === 'ringing') ? 'ringing' : (p.status === 'confirmed') ? 'confirmed' : 'online';
        return { id, username: u.username, team: u.team || '', department: u.department || '', role: u.role || '',
                 online, st, p: p || null };
    });
}
function bell_visibleRows() {
    const q = (window._bellSearch || '').trim().toLowerCase();
    return bell_rows().filter(r => {
        if (window._bellFilter === 'online' && !r.online) return false;
        if (window._bellFilter === 'offline' && r.online) return false;
        if (!q) return true;
        return (r.username || '').toLowerCase().includes(q) || (r.team || '').toLowerCase().includes(q)
            || (r.department || '').toLowerCase().includes(q);
    });
}
window.bell_onSearch = function (v) { window._bellSearch = v || ''; bell_render(); };
window.bell_setFilter = function (f) { window._bellFilter = f; bell_render(); };

// ────────────────────────── วาดรายชื่อ ──────────────────────────
const BELL_BADGE = {
    offline:   { t: '⚫ ยังไม่เปิดแอป', c: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
    online:    { t: '🟢 เปิดแอปอยู่',   c: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    ringing:   { t: '🔔 รอยืนยัน...',   c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse' },
    confirmed: { t: '✅ ยืนยันแล้ว',    c: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
};
window.bell_render = function () {
    const all = bell_rows();
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('bellCountAll', all.length);
    setTxt('bellCountOnline', all.filter(r => r.online).length);
    setTxt('bellCountOffline', all.filter(r => !r.online).length);
    setTxt('bellCountWaiting', all.filter(r => r.st === 'ringing').length);
    setTxt('bellCountConfirmed', all.filter(r => r.st === 'confirmed').length);

    // ปุ่มกรอง
    document.querySelectorAll('#bellFilterBar .bell-fbtn').forEach(b => b.classList.toggle('active', b.dataset.f === window._bellFilter));

    // ล้างที่เลือกถ้าออฟไลน์ไปแล้ว
    const onlineIds = new Set(all.filter(r => r.online).map(r => r.id));
    [...window._bellSelected].forEach(id => { if (!onlineIds.has(id)) window._bellSelected.delete(id); });
    setTxt('bellSelCount', window._bellSelected.size);

    const list = document.getElementById('bellList'); if (!list) return;
    const vis = bell_visibleRows();
    if (vis.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-400 py-8 text-sm">${window._bellUsers.length ? 'ไม่พบรายชื่อที่ตรงกับการค้นหา' : 'ยังไม่มีพนักงานในระบบ'}</div>`;
        return;
    }
    const relVer = window._bellRelease && window._bellRelease.version;
    list.innerHTML = vis.map(r => {
        const badge = BELL_BADGE[r.st];
        const checked = window._bellSelected.has(r.id) ? 'checked' : '';
        const ver = r.p && r.p.app_version;
        const outdated = ver && relVer && bell_verCmp(relVer, ver) > 0;
        const verBadge = (r.online && ver) ? `<span class="text-[10px] px-1.5 py-0.5 rounded ${outdated ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}">v${bell_esc(ver)}${outdated ? ' ⚠️ ตกรุ่น' : ''}</span>` : '';
        const when = (r.p && r.p.confirmed_at && r.st === 'confirmed') ? ('✅ ' + bell_timeTxt(r.p.confirmed_at)) : '';
        const ringBtn = (window._bellCanRing && r.online) ? `
            <button onclick="bell_ringOne('${r.id}')" class="bg-amber-500 hover:bg-amber-400 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1">
                <span class="material-icons" style="font-size:14px">notifications_active</span> เรียก
            </button>` : '';
        return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition ${r.online ? '' : 'opacity-60'}">
            <input type="checkbox" data-bell-id="${r.id}" ${checked} ${r.online ? '' : 'disabled title="ยังไม่เปิดแอป เรียกไม่ได้"'}
                   onchange="bell_toggleOne('${r.id}', this.checked)" class="accent-amber-500 w-4 h-4">
            <div class="flex-1 min-w-0">
                <div class="font-bold text-slate-700 dark:text-white truncate">${bell_esc(r.username)} ${verBadge}</div>
                <div class="text-xs text-slate-400">${bell_esc(r.team || '-')}${r.department ? ' · ' + bell_esc(r.department) : ''}</div>
            </div>
            <div class="text-xs text-slate-400 hidden sm:block">${when}</div>
            <span class="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${badge.c}">${badge.t}</span>
            ${ringBtn}
        </div>`;
    }).join('');
};

// ────────────────────────── เลือก ──────────────────────────
window.bell_toggleOne = function (id, on) {
    if (on) window._bellSelected.add(String(id)); else window._bellSelected.delete(String(id));
    const el = document.getElementById('bellSelCount'); if (el) el.textContent = window._bellSelected.size;
};
window.bell_toggleSelectAll = function (cb) {
    const vis = bell_visibleRows().filter(r => r.online);
    if (cb.checked) vis.forEach(r => window._bellSelected.add(r.id)); else vis.forEach(r => window._bellSelected.delete(r.id));
    bell_render();
};
window.bell_clearSelection = function () {
    window._bellSelected = new Set();
    const sa = document.getElementById('bellSelectAll'); if (sa) sa.checked = false;
    bell_render();
};

// ────────────────────────── เรียกกระดิ่ง ──────────────────────────
async function bell_ring(rows) {
    if (!window.appDB) return;
    rows = (rows || []).filter(r => r.online);
    if (rows.length === 0) { bell_setStatus('ยังไม่ได้เลือกพนักงานที่เปิดแอปอยู่', 'warn'); return; }
    const nowIso = bell_now().toISOString();
    const rungBy = (window.currentUser && window.currentUser.username) || 'admin';
    let ok = 0;
    for (const r of rows) {
        const token = bell_uuid();
        try {
            const up = await window.appDB.from('bell_presence').update({ status: 'ringing', ring_token: token, ring_at: nowIso, confirmed_at: null }).eq('user_id', r.id);
            if (up.error) throw up.error;
            const ins = await window.appDB.from('bell_history').insert([{ user_id: r.id, username: r.username, name: r.username, team: r.team, ring_token: token, rung_by: rungBy, ring_at: nowIso, status: 'รอยืนยัน' }]);
            if (ins.error) throw ins.error;
            ok++;
        } catch (e) { console.error('ring error', r.id, e); }
    }
    bell_setStatus(`🔔 เรียกแล้ว ${ok}/${rows.length} คน`, ok ? 'ok' : 'err');
    window._bellSelected = new Set();
    const sa = document.getElementById('bellSelectAll'); if (sa) sa.checked = false;
    window.bell_refreshPresence();
}
window.bell_ringSelected = function () {
    const rows = bell_rows().filter(r => window._bellSelected.has(r.id));
    if (rows.length === 0) { bell_setStatus('ติ๊กเลือกพนักงานก่อน แล้วค่อยกดเรียก', 'warn'); return; }
    bell_ring(rows);
};
window.bell_ringOne = function (id) { const r = bell_rows().find(x => x.id === String(id)); if (r) bell_ring([r]); };

// ────────────────────────── Realtime ──────────────────────────
window.bell_subscribe = function () {
    if (!window.appDB) return;
    if (window._bellRtSub) { try { window.appDB.removeChannel(window._bellRtSub); } catch (e) { } }
    window._bellRtSub = window.appDB.channel('bell-presence-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bell_presence' }, function () {
            if (window._currentPageName !== 'bell') return;
            window.bell_refreshPresence();
        })
        .subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window._bellRtSub);
};

// ────────────────────────── ประวัติ (หน้าแยก) ──────────────────────────
window.bell_openHistory = async function () {
    const m = document.getElementById('bellMainView'), h = document.getElementById('bellHistoryView');
    if (m) m.classList.add('hidden'); if (h) h.classList.remove('hidden');
    try { window.scrollTo(0, 0); } catch (e) { }
    await window.bell_loadHistory();
};
window.bell_closeHistory = function () {
    const m = document.getElementById('bellMainView'), h = document.getElementById('bellHistoryView');
    if (h) h.classList.add('hidden'); if (m) m.classList.remove('hidden');
};
window.bell_loadHistory = async function () {
    if (!window.appDB) return;
    try {
        const { data, error } = await window.appDB.from('bell_history').select('*').order('ring_at', { ascending: false }).limit(2000);
        if (error) throw error;
        window._bellHistory = data || [];
    } catch (e) { window._bellHistory = []; bell_setStatus('โหลดประวัติไม่สำเร็จ: ' + (e.message || e), 'err'); }
    bell_renderHistory();
};
window.bell_setHistPeriod = function (p) { window._bellHistPeriod = p; bell_renderHistory(); };
function bell_histFiltered() {
    const q = ((document.getElementById('bellHistSearch') || {}).value || '').trim().toLowerCase();
    const p = window._bellHistPeriod;
    let since = null;
    const now = bell_now();
    if (p === 'today') { since = new Date(now); since.setHours(0, 0, 0, 0); }
    else if (p === '7' || p === '30') { since = new Date(now.getTime() - parseInt(p, 10) * 86400000); }
    return window._bellHistory.filter(r => {
        if (since && new Date(r.ring_at) < since) return false;
        if (!q) return true;
        return (r.name || r.username || '').toLowerCase().includes(q) || (r.team || '').toLowerCase().includes(q) || (r.rung_by || '').toLowerCase().includes(q);
    });
}
window.bell_renderHistory = function () {
    document.querySelectorAll('#bellHistPeriod .bell-pbtn').forEach(b => b.classList.toggle('active', b.dataset.p === window._bellHistPeriod));
    const rows = bell_histFiltered();
    const cnt = document.getElementById('bellHistCount'); if (cnt) cnt.textContent = `${rows.length} รายการ`;
    const body = document.getElementById('bellHistBody'); if (!body) return;
    if (rows.length === 0) { body.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 py-8">ไม่มีประวัติในช่วงที่เลือก</td></tr>'; return; }
    body.innerHTML = rows.map(r => {
        const done = r.status === 'เข้างานแล้ว';
        return `<tr class="border-t border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
            <td class="px-3 py-2 font-bold">${bell_esc(r.name || r.username || '')}</td>
            <td class="px-3 py-2 text-center text-slate-500">${bell_esc(r.team || '-')}</td>
            <td class="px-3 py-2 text-center">${bell_esc(bell_full(r.ring_at))}</td>
            <td class="px-3 py-2 text-center">${bell_esc(bell_full(r.confirmed_at)) || '-'}</td>
            <td class="px-3 py-2 text-center">${r.elapsed_sec != null ? bell_hms(r.elapsed_sec) : '-'}</td>
            <td class="px-3 py-2 text-center"><span class="text-xs px-2 py-0.5 rounded-full font-bold ${done ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}">${bell_esc(r.status || '')}</span></td>
            <td class="px-3 py-2 text-center text-slate-500">${bell_esc(r.rung_by || '')}</td>
        </tr>`;
    }).join('');
};
window.bell_exportCSV = function () {
    const rows = bell_histFiltered();
    if (rows.length === 0) { bell_setStatus('ไม่มีข้อมูลให้ดาวน์โหลด', 'warn'); return; }
    const header = ['ชื่อ', 'ทีม', 'เวลาเรียก', 'เวลายืนยัน', 'ใช้เวลา(วินาที)', 'สถานะ', 'เรียกโดย'];
    const lines = [header.join(',')];
    rows.forEach(r => lines.push([r.name || r.username || '', r.team || '', bell_full(r.ring_at), bell_full(r.confirmed_at),
        (r.elapsed_sec != null ? r.elapsed_sec : ''), r.status || '', r.rung_by || ''].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });   // BOM ให้ Excel อ่านไทยถูก
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'ประวัติกระดิ่ง_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ────────────────────────── เสียงเตือน ──────────────────────────
window.bell_loadSounds = async function () {
    if (!window.appDB) return;
    try {
        window._bellSounds = (await bell_getSetting(BELL_SOUNDS_KEY)) || [];
        window._bellSound = (await bell_getSetting(BELL_SOUND_KEY)) || BELL_DEFAULT_SOUND;
    } catch (e) { window._bellSounds = []; window._bellSound = BELL_DEFAULT_SOUND; }
    bell_renderSounds();
};
window.bell_renderSounds = function () {
    const cur = window._bellSound || BELL_DEFAULT_SOUND;
    const curEl = document.getElementById('bellSoundCurrent'); if (curEl) curEl.textContent = 'ใช้อยู่: ' + (cur.name || '-');
    const list = document.getElementById('bellSoundList'); if (!list) return;
    const all = [BELL_DEFAULT_SOUND, ...window._bellSounds];
    list.innerHTML = all.map((s, i) => {
        const active = (s.url || '') === (cur.url || '');
        return `<div class="flex items-center gap-3 p-2 rounded-xl border ${active ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-gray-100 dark:border-slate-700'}">
            <input type="radio" name="bellSoundPick" ${active ? 'checked' : ''} onchange="bell_selectSound(${i})" class="accent-pink-500">
            <div class="flex-1 text-sm font-bold text-slate-700 dark:text-white truncate">${bell_esc(s.name)}</div>
            ${s.url ? `<button onclick="bell_previewSound('${bell_esc(s.url)}')" class="text-xs px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white">▶ ฟัง</button>
                       <button onclick="bell_removeSound(${i - 1})" class="text-xs px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30" title="ลบออกจากรายการ">✕</button>` : '<span class="text-xs text-slate-400">เสียงในเครื่อง</span>'}
        </div>`;
    }).join('');
};
window.bell_previewSound = function (url) {
    try { if (window._bellAudio) { window._bellAudio.pause(); } window._bellAudio = new Audio(url); window._bellAudio.play(); } catch (e) { }
};
window.bell_selectSound = async function (i) {
    const all = [BELL_DEFAULT_SOUND, ...window._bellSounds];
    const s = all[i]; if (!s) return;
    try {
        await bell_setSetting(BELL_SOUND_KEY, { name: s.name, url: s.url || '', updated_at: bell_now().toISOString() });
        window._bellSound = s; bell_renderSounds();
        bell_setStatus(`🔊 ตั้งเสียงเตือนเป็น "${s.name}" แล้ว`, 'ok');
    } catch (e) { bell_setStatus('บันทึกเสียงไม่สำเร็จ: ' + (e.message || e), 'err'); }
};
window.bell_removeSound = async function (idx) {
    if (idx < 0 || idx >= window._bellSounds.length) return;
    const removed = window._bellSounds[idx];
    window._bellSounds.splice(idx, 1);
    try {
        await bell_setSetting(BELL_SOUNDS_KEY, window._bellSounds);
        if (window._bellSound && window._bellSound.url === removed.url) await window.bell_selectSound(0);
        bell_renderSounds();
    } catch (e) { bell_setStatus('ลบไม่สำเร็จ: ' + (e.message || e), 'err'); }
};
window.bell_uploadSound = async function () {
    if (!window.appDB) return;
    const fileEl = document.getElementById('bellSoundFile');
    const file = fileEl && fileEl.files && fileEl.files[0];
    const status = (t) => { const s = document.getElementById('bellSoundStatus'); if (s) s.textContent = t; };
    if (!file) { bell_setStatus('กรุณาเลือกไฟล์เสียงก่อน', 'warn'); return; }
    if (file.size > 5 * 1024 * 1024) { bell_setStatus('ไฟล์เสียงต้องไม่เกิน 5 MB', 'warn'); return; }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) { bell_setStatus('รองรับเฉพาะ .mp3 หรือ .wav', 'warn'); return; }
    try {
        status('⬆️ กำลังอัปโหลด...');
        const safe = file.name.replace(/[^\w.\-ก-๙]+/g, '_');
        const path = `sounds/${Date.now()}_${safe}`;
        const up = await window.appDB.storage.from(BELL_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
        if (up.error) throw up.error;
        const { data: pub } = window.appDB.storage.from(BELL_BUCKET).getPublicUrl(path);
        const entry = { name: file.name, url: pub.publicUrl, ext, size: file.size, added_at: bell_now().toISOString() };
        window._bellSounds.push(entry);
        await bell_setSetting(BELL_SOUNDS_KEY, window._bellSounds);
        await window.bell_selectSound(window._bellSounds.length);   // index ใน [default, ...sounds]
        if (fileEl) fileEl.value = '';
        status('');
        bell_setStatus(`✅ อัปโหลด "${file.name}" และตั้งเป็นเสียงเตือนแล้ว`, 'ok');
    } catch (e) { status(''); bell_setStatus('อัปโหลดเสียงไม่สำเร็จ: ' + (e.message || e), 'err'); }
};

// ────────────────────────── ปล่อยเวอร์ชันแอป ──────────────────────────
window.bell_loadRelease = async function () {
    if (!window.appDB) return;
    try { window._bellRelease = await bell_getSetting(BELL_RELEASE_KEY); } catch (e) { window._bellRelease = null; }
    const el = document.getElementById('bellReleaseInfo');
    if (el) { const r = window._bellRelease; el.textContent = r && r.version ? `เวอร์ชันล่าสุดที่ปล่อย: v${r.version} (${bell_full(r.updated_at)})` : 'ยังไม่เคยปล่อยเวอร์ชันผ่านหน้านี้'; }
};
async function bell_sha256(buf) {
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
window.bell_uploadRelease = async function () {
    if (!window.appDB) return;
    const version = (document.getElementById('bellRelVersion').value || '').trim().replace(/^v/i, '');
    const notes = (document.getElementById('bellRelNotes').value || '').trim();
    const fileEl = document.getElementById('bellRelFile');
    const file = fileEl && fileEl.files && fileEl.files[0];
    const status = (t) => { const s = document.getElementById('bellUploadStatus'); if (s) s.textContent = t; };
    if (!/^\d+(\.\d+)*$/.test(version)) { bell_setStatus('เลขเวอร์ชันต้องเป็นตัวเลขคั่นจุด เช่น 1.0.1', 'warn'); return; }
    if (!file) { bell_setStatus('กรุณาเลือกไฟล์ BellEmployee.exe', 'warn'); return; }
    if (window._bellRelease && bell_verCmp(version, window._bellRelease.version) <= 0) { bell_setStatus(`เวอร์ชันต้องสูงกว่าตัวล่าสุด (v${window._bellRelease.version})`, 'warn'); return; }
    const btn = document.getElementById('bellBtnUpload'); if (btn) btn.disabled = true;
    try {
        status('🔢 กำลังคำนวณ checksum...');
        const sha256 = await bell_sha256(await file.arrayBuffer());
        status(`⬆️ กำลังอัปโหลด (${(file.size / 1048576).toFixed(1)} MB)...`);
        const path = `v${version}/${BELL_EXE_NAME}`;
        const up = await window.appDB.storage.from(BELL_BUCKET).upload(path, file, { cacheControl: '60', upsert: true, contentType: 'application/octet-stream' });
        if (up.error) throw up.error;
        const { data: pub } = window.appDB.storage.from(BELL_BUCKET).getPublicUrl(path);
        const rel = { version, notes, sha256, size: file.size, url: pub.publicUrl, updated_at: bell_now().toISOString(), released_by: (window.currentUser && window.currentUser.username) || '' };
        status('📝 กำลังบันทึกเวอร์ชัน...');
        await bell_setSetting(BELL_RELEASE_KEY, rel);
        window._bellRelease = rel; status('');
        bell_setStatus(`✅ ปล่อยเวอร์ชัน v${version} แล้ว — แอปพนักงานจะเด้งถามให้อัปเดตเอง`, 'ok');
        document.getElementById('bellRelVersion').value = ''; document.getElementById('bellRelNotes').value = ''; if (fileEl) fileEl.value = '';
        await window.bell_loadRelease(); bell_render();
    } catch (e) { status(''); bell_setStatus('อัปโหลดไม่สำเร็จ: ' + (e.message || e), 'err'); }
    finally { if (btn) btn.disabled = false; }
};

// ────────────────────────── init ──────────────────────────
window.initBell = async function () {
    window._bellSelected = new Set(); window._bellSearch = ''; window._bellFilter = 'all';
    const si = document.getElementById('bellSearch'); if (si) si.value = '';
    const sa = document.getElementById('bellSelectAll'); if (sa) sa.checked = false;
    window.bell_closeHistory();

    // 🔐 สิทธิ์
    window._bellCanRing = bell_can('bell_ring');
    const hide = (elId, show) => { const el = document.getElementById(elId); if (el) el.style.display = show ? '' : 'none'; };
    hide('bellBtnRingSel', window._bellCanRing);
    hide('bellRingControls', window._bellCanRing);
    hide('bellBtnHistory', bell_can('bell_history'));
    hide('bellSoundCard', bell_can('bell_sound'));
    hide('bellUpdateCard', bell_can('bell_app_update'));

    await window.bell_loadRelease();
    await window.bell_loadSounds();
    await window.bell_load();
    window.bell_subscribe();
    if (typeof window.registerPageInterval === 'function') {
        window.registerPageInterval(setInterval(() => { if (window._currentPageName === 'bell') window.bell_render(); }, 5000));
    }
};
