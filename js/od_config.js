// ==========================================
// ⚙️ OD Form Bot Config Manager
// เก็บ config ใน Supabase settings key: 'od_form_config'
// ส่วนขยาย Chrome ดึงผ่าน Railway endpoint /config
// ==========================================

const OD_CFG_KEY = 'od_form_config';

let odCfgData = {
    webs:    [],   // [{ name, color }]
    promos:  {},   // { webName: [promo1, promo2, ...] }
    reasons: [],   // [string]
    server_url: 'https://od-form-bot-production.up.railway.app',
    chat_id: '',
    odol: { notes: ['เก็งกำไร'], default_note: 'เก็งกำไร', chat_id: '' },
    big:  { chat_id: '' },
    bot:  { token: '', enabled: true },
    templates: { od: '', odol: '', big: '' },
};

// ── Template ข้อความ ───────────────────────────────────────────────
const OD_TPL_KEYS = ['od', 'odol', 'big'];
const OD_TPL_SUF  = { od: 'Od', odol: 'Odol', big: 'Big' };
const OD_TPL_DEFAULT = {
    od:   "❌ OD ตัดเครดิตผิดเงื่อนไข OD ❌\n\nเว็บ : {เว็บ}\n\nยูสเซอร์ : {ยูส}\n\nรหัสโปรโมชั่น : {โปร}\n\nสาเหตุ : {สาเหตุ}\n\nBY: {ผู้ส่ง}",
    odol: "เว็บ : {เว็บ}\n\nยูส :\n{รายการยูส}\n\nชื่อ : {ชื่อ}\n\nหมายเหตุ : {หมายเหตุ}\n\nBY: {ผู้ส่ง}",
    big:  "💰 ยอดถอนใหญ่ 💰\n\nเว็บ : {เว็บ}\n\nยูสเซอร์ : {ยูส}\n{จำนวนเงิน}\n\nBY: {ผู้ส่ง}",
};
const OD_TPL_VARS = {
    od:   ['{เว็บ}','{ยูส}','{โปร}','{สาเหตุ}','{ผู้ส่ง}','{วันที่}','{เวลา}'],
    odol: ['{เว็บ}','{รายการยูส}','{จำนวนยูส}','{ชื่อ}','{หมายเหตุ}','{ผู้ส่ง}','{วันที่}','{เวลา}'],
    big:  ['{เว็บ}','{ยูส}','{จำนวนเงิน}','{ผู้ส่ง}','{วันที่}','{เวลา}'],
};
const OD_TPL_SAMPLE = {
    od:   { '{เว็บ}':'Jun88', '{ยูส}':'kaewoon1990', '{โปร}':'KM68', '{สาเหตุ}':'ตรวจพบหลายยูสเซอร์รับโปรโมชั่น', '{ผู้ส่ง}':'BIRD', '{วันที่}':'21/08/2569', '{เวลา}':'14:32' },
    odol: { '{เว็บ}':'PG688', '{รายการยูส}':'1. 0993728365\n2. es181147\n3. es18112547', '{จำนวนยูส}':'3', '{ชื่อ}':'พีระพงศ์ ขวัญเกื้อ', '{หมายเหตุ}':'เก็งกำไร', '{ผู้ส่ง}':'BIRD', '{วันที่}':'21/08/2569', '{เวลา}':'14:32' },
    big:  { '{เว็บ}':'MK8', '{ยูส}':'test1', '{จำนวนเงิน}':'จำนวนเงิน : 50,000', '{ผู้ส่ง}':'BIRD', '{วันที่}':'21/08/2569', '{เวลา}':'14:32' },
};
function odCfg_renderTplVars() {
    OD_TPL_KEYS.forEach(k => {
        const box = document.getElementById('odCfgTplVars' + OD_TPL_SUF[k]);
        if (!box) return;
        box.innerHTML = OD_TPL_VARS[k].map(v =>
            `<button type="button" onclick="odCfg_insertVar('${k}','${v}')" class="text-xs px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300 border border-blue-700/40 hover:bg-blue-800/60">${v}</button>`).join('');
    });
}
window.odCfg_insertVar = function(k, v) {
    const ta = document.getElementById('odCfgTpl' + OD_TPL_SUF[k]);
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + v.length;
    ta.focus(); odCfg_tplPreview();
};
window.odCfg_resetTpl = function(k) {
    document.getElementById('odCfgTpl' + OD_TPL_SUF[k]).value = OD_TPL_DEFAULT[k];
    odCfg_tplPreview();
};
function odCfg_fillTpl(tpl, map) {
    let out = tpl || '';
    Object.entries(map).forEach(([k, v]) => { out = out.split(k).join(v); });
    return out;
}
// หาตัวแปรที่พิมพ์ผิด / ไม่มีอยู่
function odCfg_tplUnknown(k, tpl) {
    const found = (tpl.match(/\{[^{}\n]*\}/g) || []);
    return [...new Set(found.filter(v => !OD_TPL_VARS[k].includes(v)))];
}
function odCfg_tplWarn(k, list) {
    const id = 'odCfgTplWarn' + OD_TPL_SUF[k];
    let el = document.getElementById(id);
    const ta = document.getElementById('odCfgTpl' + OD_TPL_SUF[k]);
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'text-xs mt-1'; ta.insertAdjacentElement('afterend', el); }
    if (list.length) {
        el.innerHTML = `⚠️ <span class="text-red-400 font-bold">ไม่รู้จักตัวแปร: ${list.join(' ')}</span> <span class="text-gray-400">— ใช้ได้เฉพาะปุ่มด้านบน</span>`;
        ta.classList.add('border-red-500');
    } else { el.innerHTML = ''; ta.classList.remove('border-red-500'); }
}
window.odCfg_tplPreview = function() {
    OD_TPL_KEYS.forEach(k => {
        const suf = OD_TPL_SUF[k];
        const ta  = document.getElementById('odCfgTpl' + suf);
        if (!ta) return;
        const prev = document.getElementById('odCfgTplPrev' + suf);
        if (prev) prev.textContent = odCfg_fillTpl(ta.value || OD_TPL_DEFAULT[k], OD_TPL_SAMPLE[k]);
        odCfg_tplWarn(k, odCfg_tplUnknown(k, ta.value));
    });
};

// ── โหลด config จาก Supabase ──────────────────────────────────────
window.initOdConfig = async function() {
    // เช็คสิทธิ์
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');
    if (!isAdmin && !window.hasUserPerm('od_config')) {
        document.getElementById('odConfigApp').innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <span class="material-icons text-6xl mb-3 text-red-400">lock</span>
                <p class="font-bold text-lg text-white">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
                <p class="text-sm mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>`;
        return;
    }

    odCfg_showStatus('กำลังโหลดข้อมูล...', 'loading');

    try {
        const { data, error } = await appDB
            .from('settings')
            .select('value')
            .eq('key', OD_CFG_KEY)
            .maybeSingle();

        if (data && data.value) {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            odCfgData = { ...odCfgData, ...parsed };
            odCfgData.odol = { notes: ['เก็งกำไร'], default_note: 'เก็งกำไร', chat_id: '', ...(parsed.odol || {}) };
            odCfgData.big  = { chat_id: '', ...(parsed.big || {}) };
            odCfgData.bot  = { token: '', enabled: true, ...(parsed.bot || {}) };
            odCfgData.templates = { od: '', odol: '', big: '', ...(parsed.templates || {}) };
        } else {
            // ครั้งแรก — ใช้ค่า default
            odCfgData = {
                webs: [
                    { name: 'Jun88', color: '#2481cc' }, { name: 'MK8',   color: '#888888' },
                    { name: 'F168',  color: '#e67e22' }, { name: 'PG688', color: '#9b59b6' },
                    { name: 'JL69',  color: '#f1c40f' }, { name: 'BT678', color: '#aaaaaa' },
                    { name: 'K188',  color: '#c9a84c' }, { name: 'VV72',  color: '#f1c40f' },
                    { name: 'NM9',   color: '#e74c3c' }, { name: 'TH26',  color: '#e67e22' },
                ],
                promos: {
                    'Jun88': ['KM68','LA100','FAK200','USDT','BN'],
                    'MK8':   ['KM28','LA20','FAK200','USDT','BN'],
                    'F168':  ['KM68','LA100','FAK200','USDT','BN'],
                    'PG688': ['KM28','FAK188','FAK200','USDT','BN'],
                    'JL69':  ['KM26','FAK188','FAK200','USDT','BN'],
                    'NM9':   ['KM26','FAK188','FAK200','USDT','BN'],
                    'BT678': ['KM28','FAK188','FAK200','USDT','BN'],
                    'VV72':  ['KM28','FAK188','FAK200','USDT','BN'],
                    'K188':  ['FREE28','FAK188','FAK200','USDT','BN'],
                    'TH26':  ['FREE28','FAK188','FAK200','USDT','BN'],
                },
                reasons: ['ตรวจพบหลายยูสเซอร์รับโปรโมชั่น'],
                server_url: 'https://od-form-bot-production.up.railway.app',
                chat_id: '',
                odol: { notes: ['เก็งกำไร'], default_note: 'เก็งกำไร', chat_id: '' },
                big:  { chat_id: '' },
                bot:  { token: '', enabled: true },
                templates: { od: '', odol: '', big: '' },
            };
        }

        odCfg_renderAll();
        odCfg_showStatus('โหลดข้อมูลสำเร็จ', 'success');
        setTimeout(() => odCfg_hideStatus(), 2000);

    } catch(e) {
        odCfg_showStatus('โหลดไม่สำเร็จ: ' + e.message, 'error');
    }
};

// ── บันทึก config ลง Supabase ─────────────────────────────────────
window.odCfg_save = async function() {
    odCfg_showStatus('กำลังบันทึก...', 'loading');
    try {
        // เก็บค่าจาก input
        odCfgData.server_url = document.getElementById('odCfgServerUrl').value.trim();
        odCfgData.chat_id    = document.getElementById('odCfgChatId').value.trim();
        odCfgData.odol.chat_id = document.getElementById('odCfgOdolChatId').value.trim();
        odCfgData.big.chat_id  = document.getElementById('odCfgBigChatId').value.trim();
        odCfgData.bot.token    = document.getElementById('odCfgBotToken').value.trim();
        // template: ถ้าเหมือนค่าเดิม เก็บเป็นว่าง (ให้ extension ใช้ default)
        const tOd = document.getElementById('odCfgTplOd').value, tOdol = document.getElementById('odCfgTplOdol').value, tBig = document.getElementById('odCfgTplBig').value;
        const badOd = odCfg_tplUnknown('od', tOd), badOdol = odCfg_tplUnknown('odol', tOdol), badBig = odCfg_tplUnknown('big', tBig);
        if (badOd.length || badOdol.length || badBig.length) {
            odCfg_showStatus('❌ รูปแบบข้อความมีตัวแปรที่ไม่รู้จัก: ' + [...badOd, ...badOdol, ...badBig].join(' '), 'error');
            return;
        }
        odCfgData.templates = {
            od:   (tOd.trim()   && tOd   !== OD_TPL_DEFAULT.od)   ? tOd   : '',
            odol: (tOdol.trim() && tOdol !== OD_TPL_DEFAULT.odol) ? tOdol : '',
            big:  (tBig.trim()  && tBig  !== OD_TPL_DEFAULT.big)  ? tBig  : '',
        };
        if (odCfgData.odol.notes.length && !odCfgData.odol.notes.includes(odCfgData.odol.default_note)) {
            odCfgData.odol.default_note = odCfgData.odol.notes[0];
        }

        const { error } = await appDB.from('settings').upsert([{
            key: OD_CFG_KEY,
            value: JSON.stringify(odCfgData)
        }]);

        if (error) throw error;

        odCfg_showStatus('✅ บันทึกสำเร็จ! ส่วนขยายจะดึงค่าใหม่เมื่อเปิดครั้งถัดไป', 'success');
        odCfg_refreshPreview();
        odCfg_adminFetch('/admin/reload', 'POST').catch(() => {}); // ให้ server อ่านค่าใหม่ทันที (ถ้ามี admin key)
        setTimeout(() => odCfg_hideStatus(), 4000);

    } catch(e) {
        odCfg_showStatus('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
};

// ── Render ทั้งหมด ─────────────────────────────────────────────────
function odCfg_renderAll() {
    odCfg_renderWebs();
    odCfg_renderReasons();
    odCfg_renderPromoWebSel();
    odCfg_renderPromos();
    odCfg_refreshPreview();

    const su = document.getElementById('odCfgServerUrl');
    const ci = document.getElementById('odCfgChatId');
    if (su) su.value = odCfgData.server_url || '';
    if (ci) ci.value = odCfgData.chat_id || '';
    const oc = document.getElementById('odCfgOdolChatId');
    const bc = document.getElementById('odCfgBigChatId');
    const bt = document.getElementById('odCfgBotToken');
    const ak = document.getElementById('odCfgAdminKey');
    if (oc) oc.value = odCfgData.odol?.chat_id || '';
    if (bc) bc.value = odCfgData.big?.chat_id || '';
    if (bt) bt.value = odCfgData.bot?.token || '';
    if (ak) ak.value = localStorage.getItem('od_admin_key') || '';
    odCfg_renderNotes();
    odCfg_paintBotBadge(odCfgData.bot?.enabled !== false, null);
    const to = document.getElementById('odCfgTplOd'), tl = document.getElementById('odCfgTplOdol'), tb = document.getElementById('odCfgTplBig');
    if (to) to.value = odCfgData.templates?.od   || OD_TPL_DEFAULT.od;
    if (tl) tl.value = odCfgData.templates?.odol || OD_TPL_DEFAULT.odol;
    if (tb) tb.value = odCfgData.templates?.big  || OD_TPL_DEFAULT.big;
    odCfg_renderTplVars(); odCfg_tplPreview();
}

// ── หมายเหตุ (ฟอร์มหลายยูส) ──────────────────────────────────────
function odCfg_renderNotes() {
    const list = document.getElementById('odCfgNoteList');
    if (!list) return;
    const notes = odCfgData.odol.notes || [];
    if (!notes.length) { list.innerHTML = '<div class="text-gray-400 text-sm py-2">ยังไม่มีหมายเหตุ</div>'; return; }
    list.innerHTML = notes.map((n, i) => {
        const isDef = n === odCfgData.odol.default_note;
        return `
        <div class="flex items-center gap-1.5 ${isDef ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400' : 'bg-gray-50 dark:bg-slate-900 border-gray-300 dark:border-slate-600'} border rounded-xl px-3 py-1.5">
            <button onclick="odCfgData.odol.default_note='${n.replace(/'/g, "\\'")}'; odCfg_renderNotes(); odCfg_refreshPreview();" title="ตั้งเป็นค่าเริ่มต้น" class="${isDef ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'}">${isDef ? '★' : '☆'}</button>
            <span class="font-bold text-sm text-slate-800 dark:text-white">${n}</span>
            <button onclick="odCfg_editNote(${i})" class="text-xs text-sky-400 hover:text-sky-300 ml-1">✏️</button>
            <button onclick="odCfg_delNote(${i})" class="text-xs text-red-400 hover:text-red-300">🗑️</button>
        </div>`;
    }).join('');
}

window.odCfg_addNote = async function() {
    const { value } = await Swal.fire({
        title: 'เพิ่มหมายเหตุ', input: 'text', inputPlaceholder: 'เช่น เก็งกำไร',
        showCancelButton: true, confirmButtonText: 'เพิ่ม',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.odol.notes.push(value.trim());
    if (!odCfgData.odol.default_note) odCfgData.odol.default_note = value.trim();
    odCfg_renderNotes(); odCfg_refreshPreview();
};
window.odCfg_editNote = async function(i) {
    const { value } = await Swal.fire({
        title: 'แก้ไขหมายเหตุ', input: 'text', inputValue: odCfgData.odol.notes[i],
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    if (odCfgData.odol.default_note === odCfgData.odol.notes[i]) odCfgData.odol.default_note = value.trim();
    odCfgData.odol.notes[i] = value.trim();
    odCfg_renderNotes(); odCfg_refreshPreview();
};
window.odCfg_delNote = async function(i) {
    const { isConfirmed } = await Swal.fire({
        title: `ลบ "${odCfgData.odol.notes[i]}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.odol.notes.splice(i, 1);
    if (!odCfgData.odol.notes.includes(odCfgData.odol.default_note)) odCfgData.odol.default_note = odCfgData.odol.notes[0] || '';
    odCfg_renderNotes(); odCfg_refreshPreview();
};

// ── ควบคุม Telegram Bot (ผ่าน Railway /admin/*) ───────────────────
function odCfg_serverUrl() {
    return (document.getElementById('odCfgServerUrl')?.value.trim() || odCfgData.server_url || '').replace(/\/+$/, '');
}
async function odCfg_adminFetch(path, method = 'GET', body = null) {
    const key = (document.getElementById('odCfgAdminKey')?.value || localStorage.getItem('od_admin_key') || '').trim();
    if (!key) throw new Error('กรุณาใส่ Admin Key ก่อน');
    const res = await fetch(odCfg_serverUrl() + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}
function odCfg_paintBotBadge(enabled, live) {
    const b = document.getElementById('odCfgBotBadge');
    const t = document.getElementById('odCfgBtnToggle');
    if (b) {
        if (live === false)      { b.textContent = 'ติดต่อไม่ได้';  b.className = 'ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400'; }
        else if (!enabled)       { b.textContent = 'ปิดอยู่';       b.className = 'ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400'; }
        else if (live === true)  { b.textContent = 'ออนไลน์';      b.className = 'ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400'; }
        else                     { b.textContent = 'เปิดอยู่ (ยังไม่เช็ค)'; b.className = 'ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600'; }
    }
    if (t) {
        t.innerHTML = enabled
            ? '<span class="material-icons text-xs">stop_circle</span> หยุดบอท'
            : '<span class="material-icons text-xs">play_circle</span> เริ่มบอท';
        t.className = (enabled ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500') + ' text-white text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1';
    }
}
function odCfg_showBotInfo(obj) {
    const el = document.getElementById('odCfgBotInfo');
    if (!el) return;
    el.classList.remove('hidden');
    el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

window.odCfg_botStatus = async function() {
    odCfg_showStatus('กำลังเช็คสถานะบอท...', 'loading');
    try {
        const s = await odCfg_adminFetch('/admin/status');
        odCfg_paintBotBadge(s.enabled, !s.bot_error);
        odCfg_showBotInfo({
            บอท: s.bot ? `@${s.bot.username} (${s.bot.name})` : ('❌ ' + (s.bot_error || 'ไม่ทราบ')),
            สถานะ: s.enabled ? 'เปิด' : 'ปิด',
            token_มาจาก: s.token_source,
            ห้อง_OD: s.chat_id,
            ห้อง_ODOL: s.odol_chat_id,
            ห้อง_ยอดใหญ่: s.big_chat_id,
            webhook: s.webhook || '-',
        });
        odCfg_showStatus(s.bot ? `✅ บอท @${s.bot.username} พร้อมใช้งาน` : '⚠️ ' + s.bot_error, s.bot ? 'success' : 'error');
    } catch (e) {
        odCfg_paintBotBadge(odCfgData.bot?.enabled !== false, false);
        odCfg_showStatus('❌ ' + e.message, 'error');
        odCfg_showBotInfo('❌ ' + e.message);
    }
    setTimeout(() => odCfg_hideStatus(), 4000);
};

window.odCfg_botToggle = async function() {
    const next = !(odCfgData.bot?.enabled !== false);
    const { isConfirmed } = await Swal.fire({
        title: next ? 'เริ่มบอท?' : 'หยุดบอท?',
        text: next ? 'พนักงานจะส่งข้อความผ่านส่วนขยายได้ตามปกติ' : 'ส่วนขยายจะส่งข้อความไม่ได้จนกว่าจะเปิดใหม่',
        icon: 'question', showCancelButton: true, confirmButtonText: next ? 'เริ่ม' : 'หยุด',
        confirmButtonColor: next ? '#10b981' : '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.bot.enabled = next;
    await odCfg_save();           // บันทึกลง Supabase + สั่ง server reload
    odCfg_paintBotBadge(next, null);
    odCfg_refreshPreview();
};

window.odCfg_botTest = async function(form) {
    const defaultChat = form === 'odol'
        ? (document.getElementById('odCfgOdolChatId').value.trim() || document.getElementById('odCfgChatId').value.trim())
        : form === 'big'
        ? (document.getElementById('odCfgBigChatId').value.trim() || document.getElementById('odCfgChatId').value.trim())
        : document.getElementById('odCfgChatId').value.trim();
    const { value: chat, isConfirmed } = await Swal.fire({
        title: `ยิงทดสอบ (${form.toUpperCase()})`, input: 'text', inputValue: defaultChat,
        inputLabel: 'Chat ID ปลายทาง (แก้ได้ถ้าอยากยิงห้องอื่น)',
        showCancelButton: true, confirmButtonText: 'ยิง',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfg_showStatus('กำลังส่งข้อความทดสอบ...', 'loading');
    try {
        const r = await odCfg_adminFetch('/admin/test', 'POST', { chat_id: chat || undefined, form });
        odCfg_showStatus(`✅ ส่งแล้ว → ห้อง ${r.chat_id} (msg #${r.message_id})`, 'success');
    } catch (e) {
        odCfg_showStatus('❌ ส่งไม่สำเร็จ: ' + e.message, 'error');
    }
    setTimeout(() => odCfg_hideStatus(), 5000);
};

// ── เว็บ ───────────────────────────────────────────────────────────
function odCfg_renderWebs() {
    const list = document.getElementById('odCfgWebList');
    if (!list) return;
    if (odCfgData.webs.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-xs text-center py-4">ยังไม่มีเว็บ</p>';
        return;
    }
    list.innerHTML = odCfgData.webs.map((w, i) => `
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <span class="w-3 h-3 rounded-full shrink-0" style="background:${w.color}"></span>
            <span class="flex-1 font-bold text-sm text-slate-800 dark:text-white">${w.name}</span>
            <input type="color" value="${w.color}" title="เปลี่ยนสี"
                onchange="odCfgData.webs[${i}].color=this.value; odCfg_renderWebs(); odCfg_renderPromoWebSel();"
                class="w-7 h-7 rounded border-none cursor-pointer p-0">
            <button onclick="odCfg_editWeb(${i})" class="text-sky-400 hover:text-sky-300 text-xs px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-900/20 transition">✏️</button>
            <button onclick="odCfg_delWeb(${i})" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-500/30 hover:bg-red-900/20 transition">🗑️</button>
        </div>`).join('');
}

window.odCfg_addWeb = async function() {
    const { value: name } = await Swal.fire({
        title: 'เพิ่มเว็บใหม่', input: 'text', inputPlaceholder: 'ชื่อเว็บ เช่น KK789',
        showCancelButton: true, confirmButtonText: 'เพิ่ม', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!name) return;
    odCfgData.webs.push({ name: name.trim().toUpperCase(), color: '#2481cc' });
    if (!odCfgData.promos[name]) odCfgData.promos[name] = [];
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

window.odCfg_editWeb = async function(i) {
    const { value: name } = await Swal.fire({
        title: 'แก้ไขชื่อเว็บ', input: 'text', inputValue: odCfgData.webs[i].name,
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!name) return;
    const old = odCfgData.webs[i].name;
    odCfgData.webs[i].name = name.trim().toUpperCase();
    if (odCfgData.promos[old]) { odCfgData.promos[odCfgData.webs[i].name] = odCfgData.promos[old]; delete odCfgData.promos[old]; }
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

window.odCfg_delWeb = async function(i) {
    const { isConfirmed } = await Swal.fire({
        title: `ลบเว็บ "${odCfgData.webs[i].name}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    delete odCfgData.promos[odCfgData.webs[i].name];
    odCfgData.webs.splice(i, 1);
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

// ── โปรแยกตามเว็บ ─────────────────────────────────────────────────
function odCfg_renderPromoWebSel() {
    const sel = document.getElementById('odCfgPromoWebSel');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- เลือกเว็บ --</option>';
    odCfgData.webs.forEach(w => {
        sel.innerHTML += `<option value="${w.name}" ${w.name===cur?'selected':''}>${w.name}</option>`;
    });
    odCfg_renderPromos();
}

window.odCfg_renderPromos = function() {
    const web  = document.getElementById('odCfgPromoWebSel')?.value;
    const list = document.getElementById('odCfgPromoList');
    if (!list) return;
    if (!web) { list.innerHTML = '<div class="text-gray-400 text-sm m-auto py-4">เลือกเว็บเพื่อดูรหัสโปร</div>'; return; }
    const promos = odCfgData.promos[web] || [];
    if (promos.length === 0) { list.innerHTML = '<div class="text-gray-400 text-sm py-4">ยังไม่มีรหัสโปรสำหรับเว็บนี้</div>'; return; }
    list.innerHTML = promos.map((p, i) => `
        <div class="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700/50 rounded-xl px-3 py-1.5">
            <span class="text-yellow-600 dark:text-yellow-400 font-bold text-sm">⭐ ${p}</span>
            <button onclick="odCfg_editPromo('${web}',${i})" class="text-xs text-sky-400 hover:text-sky-300 ml-1">✏️</button>
            <button onclick="odCfg_delPromo('${web}',${i})" class="text-xs text-red-400 hover:text-red-300">🗑️</button>
        </div>`).join('');
};

window.odCfg_addPromo = async function() {
    const web = document.getElementById('odCfgPromoWebSel')?.value;
    if (!web) return Swal.fire('เตือน', 'กรุณาเลือกเว็บก่อนครับ', 'warning');
    const { value } = await Swal.fire({
        title: `เพิ่มรหัสโปรให้ ${web}`, input: 'text', inputPlaceholder: 'เช่น KM28',
        showCancelButton: true, confirmButtonText: 'เพิ่ม',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    if (!odCfgData.promos[web]) odCfgData.promos[web] = [];
    odCfgData.promos[web].push(value.trim().toUpperCase());
    odCfg_renderPromos(); odCfg_refreshPreview();
};

window.odCfg_editPromo = async function(web, i) {
    const { value } = await Swal.fire({
        title: 'แก้ไขรหัสโปร', input: 'text', inputValue: odCfgData.promos[web][i],
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.promos[web][i] = value.trim().toUpperCase();
    odCfg_renderPromos(); odCfg_refreshPreview();
};

window.odCfg_delPromo = async function(web, i) {
    const { isConfirmed } = await Swal.fire({
        title: `ลบรหัส "${odCfgData.promos[web][i]}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.promos[web].splice(i, 1);
    odCfg_renderPromos(); odCfg_refreshPreview();
};

// ── สาเหตุ ─────────────────────────────────────────────────────────
function odCfg_renderReasons() {
    const list = document.getElementById('odCfgReasonList');
    if (!list) return;
    if (odCfgData.reasons.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-xs text-center py-4">ยังไม่มีสาเหตุ</p>';
        return;
    }
    list.innerHTML = odCfgData.reasons.map((r, i) => `
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <span class="flex-1 text-sm text-slate-800 dark:text-white">${r}</span>
            <button onclick="odCfg_editReason(${i})" class="text-sky-400 text-xs px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-900/20 transition">✏️</button>
            <button onclick="odCfg_delReason(${i})" class="text-red-400 text-xs px-2 py-1 rounded border border-red-500/30 hover:bg-red-900/20 transition">🗑️</button>
        </div>`).join('');
}

window.odCfg_addReason = async function() {
    const { value } = await Swal.fire({
        title: 'เพิ่มสาเหตุใหม่', input: 'text', inputPlaceholder: 'พิมพ์สาเหตุ...',
        showCancelButton: true, confirmButtonText: 'เพิ่ม',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.reasons.push(value.trim());
    odCfg_renderReasons(); odCfg_refreshPreview();
};

window.odCfg_editReason = async function(i) {
    const { value } = await Swal.fire({
        title: 'แก้ไขสาเหตุ', input: 'text', inputValue: odCfgData.reasons[i],
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.reasons[i] = value.trim();
    odCfg_renderReasons(); odCfg_refreshPreview();
};

window.odCfg_delReason = async function(i) {
    const { isConfirmed } = await Swal.fire({
        title: 'ลบสาเหตุนี้?', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.reasons.splice(i, 1);
    odCfg_renderReasons(); odCfg_refreshPreview();
};

// ── Preview JSON ───────────────────────────────────────────────────
window.odCfg_refreshPreview = function() {
    const el = document.getElementById('odCfgPreview');
    if (!el) return;
    const preview = {
        webs:    odCfgData.webs,
        promos:  odCfgData.promos,
        reasons: odCfgData.reasons,
        chat_id: odCfgData.chat_id,
        odol:    odCfgData.odol,
        big:     odCfgData.big,
        templates: odCfgData.templates,
        bot_enabled: odCfgData.bot?.enabled !== false,
    };
    el.textContent = JSON.stringify(preview, null, 2);
};

// ── Status bar ─────────────────────────────────────────────────────
function odCfg_showStatus(msg, type) {
    const el = document.getElementById('odCfgStatus');
    if (!el) return;
    el.classList.remove('hidden');
    const colors = {
        loading: 'bg-blue-900/50 text-blue-300 border border-blue-700',
        success: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
        error:   'bg-red-900/50 text-red-300 border border-red-700',
    };
    el.className = `mx-4 mt-3 p-3 rounded-xl text-sm font-bold text-center ${colors[type] || ''}`;
    el.textContent = msg;
}
function odCfg_hideStatus() {
    const el = document.getElementById('odCfgStatus');
    if (el) el.classList.add('hidden');
}
