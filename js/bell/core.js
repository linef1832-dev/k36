// ============================================================
//  กระดิ่งเรียกพนักงาน — ตรรกะหน้าเว็บแอดมิน (js/bell/core.js)
//  ใช้ window.appDB (Supabase) + Realtime ตามแพตเทิร์นเดียวกับหน้าอื่นในระบบ
// ============================================================

window._bellRtSub = window._bellRtSub || null;
window._bellData = window._bellData || [];          // รายชื่อ presence ล่าสุด
window._bellSelected = window._bellSelected || new Set();
const BELL_ONLINE_WINDOW_MS = 60 * 1000;            // last_seen ภายใน 60 วิ = ออนไลน์

// ---------- ตัวช่วย ----------
function bell_now() {
    return (typeof window.serverNow === 'function') ? window.serverNow() : new Date();
}
function bell_uuid() {
    try { return crypto.randomUUID(); }
    catch (e) { return 'r' + Date.now() + '-' + Math.random().toString(16).slice(2); }
}
function bell_isOnline(row) {
    if (!row || !row.last_seen) return false;
    return (bell_now().getTime() - new Date(row.last_seen).getTime()) < BELL_ONLINE_WINDOW_MS;
}
function bell_setStatus(msg, kind) {
    const el = document.getElementById('bellStatus');
    if (!el) return;
    const colors = {
        ok:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        err:  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    };
    el.className = 'mx-4 mt-3 p-3 rounded-xl text-sm font-bold text-center ' + (colors[kind] || colors.ok);
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(window._bellStatusTimer);
    window._bellStatusTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---------- โหลดข้อมูล presence ----------
window.bell_load = async function () {
    if (!window.appDB) return;
    try {
        const { data, error } = await window.appDB
            .from('bell_presence')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        window._bellData = data || [];
        bell_render();
    } catch (e) {
        bell_setStatus('โหลดรายชื่อไม่สำเร็จ: ' + (e.message || e), 'err');
    }
};

// ---------- วาดรายการ ----------
const BELL_STATUS_BADGE = {
    online:    { t: 'ออนไลน์',    c: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    ringing:   { t: 'รอยืนยัน...', c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse' },
    confirmed: { t: 'ยืนยันแล้ว',  c: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
};

window.bell_render = function () {
    const list = document.getElementById('bellList');
    if (!list) return;

    const online = window._bellData.filter(bell_isOnline);
    // นับสถานะ
    const nOnline = online.length;
    const nWaiting = online.filter(r => r.status === 'ringing').length;
    const nConfirmed = online.filter(r => r.status === 'confirmed').length;
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('bellCountOnline', nOnline);
    setTxt('bellCountWaiting', nWaiting);
    setTxt('bellCountConfirmed', nConfirmed);

    if (online.length === 0) {
        list.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">ยังไม่มีพนักงานเปิดแอปอยู่</div>';
        return;
    }

    // ล้าง selected ที่ไม่ออนไลน์แล้ว
    const onlineIds = new Set(online.map(r => String(r.user_id)));
    window._bellSelected.forEach(id => { if (!onlineIds.has(id)) window._bellSelected.delete(id); });

    list.innerHTML = online.map(r => {
        const id = String(r.user_id);
        const badge = BELL_STATUS_BADGE[r.status] || BELL_STATUS_BADGE.online;
        const checked = window._bellSelected.has(id) ? 'checked' : '';
        const when = r.confirmed_at ? ('✅ ' + bell_timeTxt(r.confirmed_at)) : '';
        const ver = r.app_version || '';
        const outdated = ver && window._bellRelease && window._bellRelease.version
            && bell_verCmp(window._bellRelease.version, ver) > 0;
        const verBadge = ver ? `<span class="text-[10px] px-1.5 py-0.5 rounded ${outdated
            ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}"
            title="${outdated ? 'ยังไม่ได้อัปเดตเป็นเวอร์ชันล่าสุด' : 'เวอร์ชันแอป'}">v${bell_esc(ver)}${outdated ? ' ⚠️ ตกรุ่น' : ''}</span>` : '';
        const ringBtn = window._bellCanRing ? `
            <button onclick="bell_ringOne('${id}')" class="bg-amber-500 hover:bg-amber-400 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1">
                <span class="material-icons" style="font-size:14px">notifications_active</span> เรียก
            </button>` : '';
        return `
        <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
            <input type="checkbox" data-bell-id="${id}" ${checked} onchange="bell_toggleOne('${id}', this.checked)" class="accent-amber-500 w-4 h-4">
            <div class="flex-1 min-w-0">
                <div class="font-bold text-slate-700 dark:text-white truncate">${bell_esc(r.name || r.username || id)} ${verBadge}</div>
                <div class="text-xs text-slate-400">${bell_esc(r.team || '')} ${r.username ? '· ' + bell_esc(r.username) : ''}</div>
            </div>
            <div class="text-xs text-slate-400 hidden sm:block">${when}</div>
            <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badge.c}">${badge.t}</span>
            ${ringBtn}
        </div>`;
    }).join('');
};

function bell_esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function bell_timeTxt(ts) {
    try { return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (e) { return ''; }
}

// ---------- เลือก ----------
window.bell_toggleOne = function (id, on) {
    if (on) window._bellSelected.add(String(id)); else window._bellSelected.delete(String(id));
};
window.bell_toggleSelectAll = function (cb) {
    const online = window._bellData.filter(bell_isOnline);
    window._bellSelected = new Set(cb.checked ? online.map(r => String(r.user_id)) : []);
    bell_render();
};

// ---------- เรียกกระดิ่ง ----------
async function bell_ring(targets) {
    if (!window.appDB) return;
    if (!targets || targets.length === 0) {
        bell_setStatus('ยังไม่ได้เลือกพนักงาน', 'warn');
        return;
    }
    const nowIso = bell_now().toISOString();
    const rungBy = (window.currentUser && (window.currentUser.username || window.currentUser.name)) || 'admin';
    let ok = 0;
    for (const row of targets) {
        const token = bell_uuid();
        try {
            // 1) อัปเดตสถานะ presence ของคนนั้น → แอปฝั่งพนักงานจะรู้ทันทีผ่าน realtime
            const up = await window.appDB.from('bell_presence').update({
                status: 'ringing', ring_token: token, ring_at: nowIso, confirmed_at: null
            }).eq('user_id', row.user_id);
            if (up.error) throw up.error;
            // 2) บันทึกประวัติ 1 แถวต่อการเรียก
            const ins = await window.appDB.from('bell_history').insert([{
                user_id: row.user_id, username: row.username, name: row.name, team: row.team,
                ring_token: token, rung_by: rungBy, ring_at: nowIso, status: 'รอยืนยัน'
            }]);
            if (ins.error) throw ins.error;
            ok++;
        } catch (e) {
            console.error('ring error', row.user_id, e);
        }
    }
    bell_setStatus(`🔔 เรียกแล้ว ${ok}/${targets.length} คน`, ok ? 'ok' : 'err');
    bell_load();
}

window.bell_ringSelected = function () {
    const online = window._bellData.filter(bell_isOnline);
    const targets = online.filter(r => window._bellSelected.has(String(r.user_id)));
    bell_ring(targets);
};
window.bell_ringAll = function () {
    const online = window._bellData.filter(bell_isOnline);
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'เรียกทั้งหมด?', text: `จะเรียกพนักงานที่ออนไลน์ ${online.length} คน`,
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'เรียกเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#f59e0b'
        }).then(res => { if (res.isConfirmed) bell_ring(online); });
    } else {
        bell_ring(online);
    }
};
window.bell_ringOne = function (id) {
    const row = window._bellData.find(r => String(r.user_id) === String(id));
    if (row) bell_ring([row]);
};

// ---------- Realtime ----------
window.bell_subscribe = function () {
    if (!window.appDB) return;
    if (window._bellRtSub) { try { window.appDB.removeChannel(window._bellRtSub); } catch (e) {} }
    window._bellRtSub = window.appDB.channel('bell-presence-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bell_presence' }, function () {
            if (window._currentPageName !== 'bell') return;
            bell_load();
        })
        .subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window._bellRtSub);
};

// ---------- ประวัติ + CSV ----------
window.bell_showHistory = async function () {
    if (!window.appDB) return;
    let rows = [];
    try {
        const { data, error } = await window.appDB.from('bell_history')
            .select('*').order('ring_at', { ascending: false }).limit(500);
        if (error) throw error;
        rows = data || [];
    } catch (e) {
        if (typeof Swal !== 'undefined') Swal.fire('ผิดพลาด', 'โหลดประวัติไม่สำเร็จ: ' + (e.message || e), 'error');
        return;
    }
    window._bellHistoryCache = rows;

    const body = rows.length === 0
        ? '<div style="padding:24px;color:#94a3b8">ยังไม่มีประวัติ</div>'
        : `<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="position:sticky;top:0;background:#1e293b;color:#f5e3ae">
                <th style="padding:8px;text-align:left">ชื่อ</th><th style="padding:8px">ทีม</th>
                <th style="padding:8px">เวลาเรียก</th><th style="padding:8px">เวลายืนยัน</th>
                <th style="padding:8px">ใช้เวลา</th><th style="padding:8px">สถานะ</th></tr></thead>
            <tbody>${rows.map(r => `<tr style="border-bottom:1px solid #334155;color:#cbd5e1">
                <td style="padding:8px;text-align:left">${bell_esc(r.name || r.username || '')}</td>
                <td style="padding:8px;text-align:center">${bell_esc(r.team || '')}</td>
                <td style="padding:8px;text-align:center">${bell_esc(bell_full(r.ring_at))}</td>
                <td style="padding:8px;text-align:center">${bell_esc(bell_full(r.confirmed_at))}</td>
                <td style="padding:8px;text-align:center">${r.elapsed_sec != null ? bell_hms(r.elapsed_sec) : '-'}</td>
                <td style="padding:8px;text-align:center">${bell_esc(r.status || '')}</td></tr>`).join('')}
            </tbody></table></div>`;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '📜 ประวัติการเรียก', html: body, width: 860, background: '#0b1120',
            showCancelButton: true, confirmButtonText: '💾 ดาวน์โหลด CSV',
            cancelButtonText: 'ปิด', confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-3xl border border-slate-700/50' }
        }).then(res => { if (res.isConfirmed) bell_exportCSV(); });
    }
};

function bell_full(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString('th-TH'); } catch (e) { return ''; }
}
function bell_hms(sec) {
    sec = Math.round(Number(sec) || 0);
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m} นาที ${s} วิ` : `${s} วิ`;
}

window.bell_exportCSV = function () {
    const rows = window._bellHistoryCache || [];
    if (rows.length === 0) return;
    const header = ['ชื่อ', 'ทีม', 'username', 'เวลาเรียก', 'เวลายืนยัน', 'ใช้เวลา(วินาที)', 'สถานะ', 'เรียกโดย'];
    const lines = [header.join(',')];
    rows.forEach(r => {
        const cells = [r.name || '', r.team || '', r.username || '',
            bell_full(r.ring_at), bell_full(r.confirmed_at),
            (r.elapsed_sec != null ? r.elapsed_sec : ''), r.status || '', r.rung_by || ''];
        lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    // \uFEFF = BOM ให้ Excel อ่านภาษาไทยถูก
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ประวัติกระดิ่ง_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------- อัปเดตแอปพนักงาน (เก็บเวอร์ชันใน settings key 'bell_app_release', ไฟล์ใน storage bucket 'bell-app') ----------
const BELL_RELEASE_KEY = 'bell_app_release';
const BELL_BUCKET = 'bell-app';
const BELL_EXE_NAME = 'BellEmployee.exe';
window._bellRelease = window._bellRelease || null;

function bell_verCmp(a, b) {
    // คืน >0 ถ้า a ใหม่กว่า b, 0 เท่ากัน, <0 เก่ากว่า   (เทียบแบบ 1.2.10 > 1.2.9)
    const pa = String(a || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
    }
    return 0;
}

window.bell_loadRelease = async function () {
    if (!window.appDB) return;
    try {
        const { data } = await window.appDB.from('settings').select('value').eq('key', BELL_RELEASE_KEY).maybeSingle();
        window._bellRelease = (data && data.value) ? JSON.parse(data.value) : null;
    } catch (e) { window._bellRelease = null; }
    const el = document.getElementById('bellReleaseInfo');
    if (el) {
        const r = window._bellRelease;
        el.textContent = r && r.version
            ? `เวอร์ชันล่าสุดที่ปล่อย: v${r.version} (${bell_full(r.updated_at)})`
            : 'ยังไม่เคยปล่อยเวอร์ชันผ่านหน้านี้';
    }
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
    if (window._bellRelease && bell_verCmp(version, window._bellRelease.version) <= 0) {
        bell_setStatus(`เวอร์ชันต้องสูงกว่าตัวล่าสุด (v${window._bellRelease.version})`, 'warn'); return;
    }
    const btn = document.getElementById('bellBtnUpload');
    if (btn) btn.disabled = true;
    try {
        status('🔢 กำลังคำนวณ checksum...');
        const buf = await file.arrayBuffer();
        const sha256 = await bell_sha256(buf);
        status(`⬆️ กำลังอัปโหลด (${(file.size / 1048576).toFixed(1)} MB)...`);
        // เก็บแยกชื่อตามเวอร์ชัน กันไฟล์เก่าโดนทับระหว่างที่พนักงานกำลังโหลด
        const path = `v${version}/${BELL_EXE_NAME}`;
        const up = await window.appDB.storage.from(BELL_BUCKET).upload(path, file, {
            cacheControl: '60', upsert: true, contentType: 'application/octet-stream'
        });
        if (up.error) throw up.error;
        const { data: pub } = window.appDB.storage.from(BELL_BUCKET).getPublicUrl(path);
        const rel = {
            version, notes, sha256, size: file.size, url: pub.publicUrl,
            updated_at: bell_now().toISOString(),
            released_by: (window.currentUser && window.currentUser.username) || ''
        };
        status('📝 กำลังบันทึกเวอร์ชัน...');
        const sv = await window.appDB.from('settings').upsert([{ key: BELL_RELEASE_KEY, value: JSON.stringify(rel) }]);
        if (sv.error) throw sv.error;
        window._bellRelease = rel;
        status('');
        bell_setStatus(`✅ ปล่อยเวอร์ชัน v${version} แล้ว — แอปพนักงานจะเด้งถามให้อัปเดตเอง`, 'ok');
        document.getElementById('bellRelVersion').value = '';
        document.getElementById('bellRelNotes').value = '';
        if (fileEl) fileEl.value = '';
        await window.bell_loadRelease();
        bell_render();
    } catch (e) {
        status('');
        bell_setStatus('อัปโหลดไม่สำเร็จ: ' + (e.message || e), 'err');
    } finally {
        if (btn) btn.disabled = false;
    }
};

// ---------- init (เรียกตอนเปิดหน้า) ----------
window.initBell = async function () {
    window._bellSelected = new Set();
    const sa = document.getElementById('bellSelectAll');
    if (sa) sa.checked = false;

    // 🔐 สิทธิ์: ไม่มี 'bell_ring' = ซ่อนปุ่มเรียก, ไม่มี 'bell_history' = ซ่อนปุ่มประวัติ, ไม่มี 'bell_app_update' = ซ่อนการ์ดอัปเดต
    const can = (id) => (typeof window.hasUserPerm !== 'function') ? true : window.hasUserPerm(id);
    window._bellCanRing = can('bell_ring');
    const canHist = can('bell_history');
    const canUpd = can('bell_app_update');
    const hide = (elId, show) => { const el = document.getElementById(elId); if (el) el.style.display = show ? '' : 'none'; };
    hide('bellBtnRingAll', window._bellCanRing);
    hide('bellRingControls', window._bellCanRing);
    hide('bellBtnHistory', canHist);
    hide('bellUpdateCard', canUpd);

    await window.bell_loadRelease();
    await window.bell_load();
    window.bell_subscribe();
    // รีเฟรชทุก 5 วิ เพื่ออัปเดตสถานะ ออนไลน์/ออฟไลน์ ตาม last_seen
    if (typeof window.registerPageInterval === 'function') {
        const iv = setInterval(() => { if (window._currentPageName === 'bell') window.bell_render(); }, 5000);
        window.registerPageInterval(iv);
    }
};
