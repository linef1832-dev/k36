// ════════════════════════════════════════════════════════════════════
// 📦 kbiz/core.js — ส่วนที่ 1/2 ของระบบบอท K BIZ (แยกจาก kbiz.js เดิม 969 บรรทัด)
// เนื้อหา: จัดการบอทหลัก + OCR API Keys/โควต้า
// ⚠️ ลำดับโหลด: kbiz/core → kbiz/ops (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 🤖 ระบบจัดการบอท K BIZ (K BIZ APP)
// ==========================================
let globalKbizBots = [];
let globalOcrKeys = [];

function getKbizTpl(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return '';
    let html = tpl.innerHTML;
    for (const key in data) {
        const val = data[key] !== undefined && data[key] !== null ? data[key] : '';
        html = html.split(`{{${key}}}`).join(val);
    }
    return html;
}

async function fetchKbizData() {
    const grid = document.getElementById('kbizGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-20"><span class="material-icons animate-spin text-emerald-500 text-5xl mb-2">sync</span><br><span class="text-gray-400 font-bold">กำลังโหลดข้อมูลบอท...</span></div>';
    try {
        let rawData = await window.getSettingCached('kbiz_bots_data');
        // [FIX] fallback ดึงตรงจาก DB ถ้า cache ว่าง
        if (!rawData) {
            const { data } = await appDB.from('settings').select('value').eq('key', 'kbiz_bots_data').maybeSingle();
            rawData = data?.value ?? null;
        }
        // [FIX] getSettingCached คืนค่า value ตรงๆ ไม่ใช่ { key, value }
        if (rawData) {
            globalKbizBots = JSON.parse(rawData);
            let needSave = false;
            globalKbizBots = globalKbizBots.map(b => {
                if (!b.id) {
                    needSave = true;
                    return { ...b, id: 'bot_' + Math.random().toString(36).substr(2, 9) };
                }
                return b;
            });
            if (needSave) {
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
            }
        } else {
            globalKbizBots = [];
        }
        renderKbizGrid();
        fetchGoogleOcrStatus();
        fetchTelegramBotConfig();
        fetchChromeRefreshConfig();
        startVpsStatsPolling();
    } catch(e) { 
        globalKbizBots = []; 
        renderKbizGrid(); 
        fetchGoogleOcrStatus();
        fetchTelegramBotConfig();
        startVpsStatsPolling();
    }
}

window.renderKbizGrid = function() {
    const grid = document.getElementById('kbizGrid');
    if(!grid) return;
    const term = document.getElementById('kbizSearchInput') ? document.getElementById('kbizSearchInput').value.toLowerCase() : '';
    const filtered = globalKbizBots.filter(b => b.machine_id.toLowerCase().includes(term) || (b.display_name && b.display_name.toLowerCase().includes(term)));

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-24 text-gray-400"><span class="material-icons text-7xl mb-3 opacity-20">smart_toy</span><span class="font-bold text-lg">ไม่พบบัญชีบอท</span></div>`;
        return;
    }

    grid.innerHTML = filtered.map(b => {
        return getKbizTpl('tpl-kbiz-card', {
            id: b.id,
            machine_id: b.machine_id,
            statusColor: b.is_active ? 'bg-emerald-500' : 'bg-gray-500',
            statusText: b.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            display_name: b.display_name || '-',
            username: b.username,
            password: b.password
        });
    }).join('');
};

window.openKbizModal = function() {
    document.getElementById('kbizModal').classList.remove('hidden');
    ['kbizEditId','kbizMachineId','kbizDisplayName','kbizUser','kbizPass'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('kbizIsActive').checked = true;
    document.getElementById('kbizModalTitle').innerHTML = '<span class="material-icons">smart_toy</span> เพิ่มบอทตัวใหม่';
};

window.editKbizBot = function(id) {
    const b = globalKbizBots.find(x => String(x.id) === String(id));
    if(!b) return;
    document.getElementById('kbizEditId').value = b.id;
    document.getElementById('kbizMachineId').value = b.machine_id;
    document.getElementById('kbizDisplayName').value = b.display_name || '';
    document.getElementById('kbizUser').value = b.username;
    document.getElementById('kbizPass').value = b.password;
    document.getElementById('kbizIsActive').checked = b.is_active;
    document.getElementById('kbizModalTitle').innerHTML = '<span class="material-icons text-amber-400">edit</span> แก้ไขข้อมูลบอท';
    document.getElementById('kbizModal').classList.remove('hidden');
};

window.saveKbizBot = async function(e) {
    e.preventDefault();
    const id = document.getElementById('kbizEditId').value;
    const mId = document.getElementById('kbizMachineId').value.trim();
    const dName = document.getElementById('kbizDisplayName').value.trim();
    const user = document.getElementById('kbizUser').value.trim();
    const pass = document.getElementById('kbizPass').value.trim();
    const isActive = document.getElementById('kbizIsActive').checked;

    if (!id && globalKbizBots.some(b => b.machine_id.toLowerCase() === mId.toLowerCase())) {
        return Swal.fire('ข้อมูลซ้ำ', `ชื่อเครื่อง ${mId} มีในระบบแล้วครับ`, 'warning');
    }

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

    if (id && id.trim() !== '') {
        const index = globalKbizBots.findIndex(x => String(x.id) === String(id));
        if(index !== -1) {
            globalKbizBots[index] = { id, machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive };
        } else {
            globalKbizBots.push({ id, machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive });
        }
    } else {
        globalKbizBots.push({ id: 'bot_' + Date.now(), machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive });
    }

    try {
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
        document.getElementById('kbizModal').classList.add('hidden');
        renderKbizGrid();
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch (err) { 
        Swal.fire('Error', err.message, 'error'); 
    }
};

window.deleteKbizBot = async function(id) {
    Swal.fire({ title: 'ลบบัญชีบอทนี้?', text: "ลบแล้วจะไม่สามารถกู้คืนได้", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้งเลย' }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
            globalKbizBots = globalKbizBots.filter(b => String(b.id) !== String(id));
            window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
            renderKbizGrid();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false});
        }
    });
};


// ==========================================
// 🔑 ระบบจัดการ OCR API KEYS + โควต้า
// ==========================================

const OCR_DAILY_QUOTA = 500;

function getTodayKey() {
    const now = new Date();
    return now.getUTCFullYear() + '-' + 
           String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + 
           String(now.getUTCDate()).padStart(2, '0');
}

function maskOcrKey(key) {
    if (!key || key.length < 8) return key || '';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

window.updateOcrKeyStatusLabel = function() {
    const checkbox = document.getElementById('ocrKeyIsActive');
    const label = document.getElementById('ocrKeyStatusLabel');
    if (!checkbox || !label) return;
    if (checkbox.checked) {
        label.textContent = 'เปิดใช้';
        label.className = 'text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white';
    } else {
        label.textContent = 'ปิดอยู่';
        label.className = 'text-xs font-bold px-2 py-0.5 rounded-md bg-red-500 text-white';
    }
};

function autoResetIfNewDay(keys) {
    const today = getTodayKey();
    let needSave = false;
    keys.forEach(k => {
        if (k.last_used_date !== today) {
            k.used_count = 0;
            k.last_used_date = today;
            needSave = true;
        }
    });
    return needSave;
}

async function fetchOcrKeysData() {
    const grid = document.getElementById('ocrKeysGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10"><span class="material-icons animate-spin text-amber-500 text-4xl mb-2">sync</span><br><span class="text-gray-400 font-bold text-sm">กำลังโหลด API Keys...</span></div>';
    try {
        let _ocrRaw = await window.getSettingCached('ocr_api_keys_data');
        if (!_ocrRaw) {
            const { data: _dbOcr } = await appDB.from('settings').select('value').eq('key', 'ocr_api_keys_data').maybeSingle();
            _ocrRaw = _dbOcr?.value ?? null;
        }
        if (_ocrRaw) {
            globalOcrKeys = JSON.parse(_ocrRaw);
            const needSave = autoResetIfNewDay(globalOcrKeys);
            globalOcrKeys.forEach(k => {
                if (typeof k.used_count !== 'number') { k.used_count = 0; k.last_used_date = getTodayKey(); }
                if (!k.last_used_date) k.last_used_date = getTodayKey();
            });
            if (needSave) {
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
            }
        } else {
            globalOcrKeys = [];
        }
        renderOcrKeysGrid();
    } catch(e) { 
        globalOcrKeys = []; 
        renderOcrKeysGrid(); 
    }
}

window.renderOcrKeysGrid = function() {
    const grid = document.getElementById('ocrKeysGrid');
    if(!grid) return;

    const totalEl = document.getElementById('ocrTotalQuota');
    if (totalEl) {
        if (globalOcrKeys.length > 0) {
            const totalUsed = globalOcrKeys.reduce((s, k) => s + (k.used_count || 0), 0);
            const totalQuota = globalOcrKeys.length * OCR_DAILY_QUOTA;
            const totalRemaining = totalQuota - totalUsed;
            totalEl.classList.remove('hidden');
            totalEl.innerHTML = `📊 รวม: ${totalUsed}/${totalQuota} (เหลือ <b class="text-emerald-200">${totalRemaining}</b>)`;
        } else {
            totalEl.classList.add('hidden');
        }
    }

    if (globalOcrKeys.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <span class="material-icons text-5xl mb-2 opacity-30">vpn_key</span>
                <span class="font-bold">ยังไม่มี API Key</span>
                <span class="text-xs mt-1">กดปุ่ม "เพิ่ม Key" เพื่อเริ่มใช้งาน</span>
            </div>`;
        return;
    }

    grid.innerHTML = globalOcrKeys.map(k => {
        const used = k.used_count || 0;
        const remaining = Math.max(0, OCR_DAILY_QUOTA - used);
        const percentUsed = Math.min(100, Math.round((used / OCR_DAILY_QUOTA) * 100));
        
        let progressBarColor, quotaColor;
        if (percentUsed >= 90) {
            progressBarColor = 'bg-red-500';
            quotaColor = 'text-red-600 dark:text-red-400';
        } else if (percentUsed >= 70) {
            progressBarColor = 'bg-orange-500';
            quotaColor = 'text-orange-600 dark:text-orange-400';
        } else if (percentUsed >= 40) {
            progressBarColor = 'bg-amber-500';
            quotaColor = 'text-amber-600 dark:text-amber-400';
        } else {
            progressBarColor = 'bg-emerald-500';
            quotaColor = 'text-emerald-600 dark:text-emerald-400';
        }

        return getKbizTpl('tpl-ocr-key-card', {
            id: k.id,
            key_name: k.key_name,
            api_key: k.api_key,
            statusColor: k.is_active ? 'bg-emerald-500' : 'bg-gray-500',
            statusText: k.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            usedCount: used,
            remaining: remaining,
            percentUsed: percentUsed,
            progressBarColor: progressBarColor,
            quotaColor: quotaColor
        });
    }).join('');
};

window.openOcrKeyModal = function() {
    if (globalOcrKeys.length >= 5) {
        Swal.fire('ครบแล้ว', 'ใส่ key ได้สูงสุด 5 อันเท่านั้น — ลบของเก่าก่อนถ้าอยากเพิ่ม', 'info');
        return;
    }
    document.getElementById('ocrKeyModal').classList.remove('hidden');
    ['ocrKeyEditId','ocrKeyName','ocrKeyValue'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ocrKeyIsActive').checked = true;
    document.getElementById('ocrKeyModalTitle').innerHTML = '<span class="material-icons">vpn_key</span> เพิ่ม API Key';
    updateOcrKeyStatusLabel();
};

window.editOcrKey = function(id) {
    const k = globalOcrKeys.find(x => String(x.id) === String(id));
    if(!k) return;
    document.getElementById('ocrKeyEditId').value = k.id;
    document.getElementById('ocrKeyName').value = k.key_name;
    document.getElementById('ocrKeyValue').value = k.api_key;
    document.getElementById('ocrKeyIsActive').checked = k.is_active;
    document.getElementById('ocrKeyModalTitle').innerHTML = '<span class="material-icons text-amber-400">edit</span> แก้ไข API Key';
    document.getElementById('ocrKeyModal').classList.remove('hidden');
    updateOcrKeyStatusLabel();
};

window.saveOcrKey = async function(e) {
    e.preventDefault();
    const id = document.getElementById('ocrKeyEditId').value;
    const keyName = document.getElementById('ocrKeyName').value.trim();
    const keyValue = document.getElementById('ocrKeyValue').value.trim();
    const isActive = document.getElementById('ocrKeyIsActive').checked;

    if (!keyName) return Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณาตั้งชื่อ Key', 'warning');
    if (keyValue.length < 10) return Swal.fire('Key สั้นเกินไป', 'API key ดูสั้นผิดปกติ', 'warning');

    const isDuplicate = globalOcrKeys.some(k => k.api_key === keyValue && String(k.id) !== String(id));
    if (isDuplicate) return Swal.fire('Key ซ้ำ', 'API key นี้มีในระบบแล้วครับ', 'warning');

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

    if (id && id.trim() !== '') {
        const index = globalOcrKeys.findIndex(x => String(x.id) === String(id));
        if(index !== -1) {
            globalOcrKeys[index] = { 
                ...globalOcrKeys[index],
                key_name: keyName, 
                api_key: keyValue, 
                is_active: isActive 
            };
        }
    } else {
        if (globalOcrKeys.length >= 5) {
            Swal.close();
            return Swal.fire('ครบแล้ว', 'ใส่ key ได้สูงสุด 5 อัน', 'warning');
        }
        globalOcrKeys.push({ 
            id: 'key_' + Date.now(), 
            key_name: keyName, 
            api_key: keyValue, 
            is_active: isActive,
            used_count: 0,
            last_used_date: getTodayKey()
        });
    }

    try {
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
        document.getElementById('ocrKeyModal').classList.add('hidden');
        renderOcrKeysGrid();
        Swal.fire({icon: 'success', title: id ? 'แก้ไขสำเร็จ!' : 'เพิ่ม Key สำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch (err) { 
        Swal.fire('Error', err.message, 'error'); 
    }
};

window.deleteOcrKey = async function(id) {
    Swal.fire({ 
        title: 'ลบ API Key นี้?', 
        text: "พนักงานจะใช้ key นี้ไม่ได้อีก", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'ลบทิ้งเลย' 
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
            globalOcrKeys = globalOcrKeys.filter(k => String(k.id) !== String(id));
            window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
            renderOcrKeysGrid();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false});
        }
    });
};

window.resetOcrKeyUsage = async function(id) {
    Swal.fire({
        title: 'รีเซ็ตโควต้า Key นี้?',
        text: 'เริ่มนับใหม่จาก 0/500 ทันที',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3498db',
        confirmButtonText: 'รีเซ็ตเลย'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const k = globalOcrKeys.find(x => String(x.id) === String(id));
            if (!k) return;
            k.used_count = 0;
            k.last_used_date = getTodayKey();
            window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
            renderOcrKeysGrid();
            Swal.fire({icon: 'success', title: 'รีเซ็ตแล้ว!', timer: 1200, showConfirmButton: false});
        }
    });
};

const _kbizOcrTimer = setInterval(() => {
    if (document.getElementById('gvStatusBadge')) {
        fetchGoogleOcrStatus();
    }
}, 30000);
// [FIX] เดิมลงทะเบียนตัวจับเวลานี้กับ registerPageInterval — แต่มันถูกสร้างตอนโหลดไฟล์ครั้งเดียว
// พอออกจากหน้า cleanupPageIntervals() จะ clear ทิ้ง แล้วไม่มีใครสร้างใหม่
// = ระบบรีเฟรช OCR อัตโนมัติตายถาวรจนกว่าจะ F5 จึงไม่ลงทะเบียน
// (ข้างในเช็ค #ocrKeysGrid อยู่แล้ว ตอนไม่ได้อยู่หน้านี้จึงไม่ยิง DB)


// ==========================================
// 📡 [Realtime] ฟังการเปลี่ยน settings ที่เกี่ยวกับ KBIZ → รีเฟรชเองไม่ต้องรีหน้า
window._kbizRtSub = window._kbizRtSub || null;
window.subscribeKbizChanges = function() {
    if (typeof appDB === 'undefined' || !appDB) return;
    if (window._kbizRtSub) { try { appDB.removeChannel(window._kbizRtSub); } catch(e){} }
    var KEYS = ['kbiz_bots_data','ocr_api_keys_data','telegram_bot_config','vps_stats','chrome_refresh_config','chrome_refresh_history'];
    window._kbizRtSub = appDB.channel('kbiz-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, function(payload){
            if (window._currentPageName !== 'kbiz') return;
            var key = (payload.new && payload.new.key) || (payload.old && payload.old.key);
            if (KEYS.indexOf(key) === -1) return;
            if (typeof fetchKbizData === 'function') fetchKbizData();
        })
        .subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window._kbizRtSub);
};


// ==========================================
// 🔍 OCR Engine — ดึงสถานะจาก Railway + สลับเครื่องยนต์หลักผ่าน Supabase (คีย์ไม่ออกจากเซิร์ฟเวอร์)
// ==========================================
const KBIT_SERVER_URL = 'https://k-bit-production-374d.up.railway.app';
const OCR_ENGINE_LABEL = { vision: 'Google Vision', gemini: 'Gemini Flash-Lite', ocrspace: 'OCR.space' };

window.fetchGoogleOcrStatus = async function(manual) {
    const badge = document.getElementById('gvStatusBadge');
    if (!badge) return;
    if (manual) badge.innerHTML = '⏳ กำลังตรวจสอบ...';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(KBIT_SERVER_URL + '/api/ocr/health', { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(t);
        const d = await r.json();
        const s = d.stats || {};
        const eng = d.engine || 'ocrspace';
        badge.innerHTML = '🟢 กำลังใช้: ' + (OCR_ENGINE_LABEL[eng] || eng);
        badge.className = 'bg-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-300/50';
        // ปุ่มเลือกเครื่องยนต์
        document.querySelectorAll('.ocr-eng-btn').forEach(b => {
            const k = b.dataset.engine;
            const has = k === 'vision' ? d.google : k === 'gemini' ? d.gemini : true;
            const st = b.querySelector('.eng-state');
            b.classList.toggle('border-emerald-500', k === eng);
            b.classList.toggle('bg-emerald-50', k === eng);
            b.classList.toggle('dark:bg-emerald-900/20', k === eng);
            b.classList.toggle('opacity-50', !has);
            b.disabled = !has;
            if (st) st.innerHTML = k === eng ? '<span class="text-emerald-600">● กำลังใช้งาน</span>' : has ? '<span class="text-gray-400">○ พร้อมใช้ — กดเพื่อสลับ</span>' : '<span class="text-red-400">✕ ยังไม่ได้ตั้งคีย์ใน Railway</span>';
        });
        set('gvOk', s.google_ok ?? 0);
        set('gmOk', s.gemini_ok ?? 0);
        set('gvFail', (s.google_fail ?? 0) + (s.gemini_fail ?? 0));
        set('gvFallback', (s.fallback_ok ?? 0) + (s.fallback_fail ?? 0));
        set('gvMs', s.last_ms != null ? s.last_ms : '—');
        set('gvLastEngine', s.last_engine ? 'มิลลิวินาที (' + (s.last_engine === 'google' ? 'Vision' : s.last_engine) + ')' : 'มิลลิวินาที');
        // 💰 ยอดคงเหลือประมาณการ — สีตามระดับที่เหลือ
        const b = d.budget || {}, rates = d.rates || { vision: 0.05, gemini: 0.01 };
        const thb = (v) => '฿' + (Math.round(v * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const paint = (key, start, used, calls, rate) => {
            const card = document.getElementById(key === 'vision' ? 'bgVisionCard' : 'bgGeminiCard'); if (!card) return;
            const left = Math.max(0, (start || 0) - (used || 0)); const pct = start ? Math.max(0, Math.min(100, left / start * 100)) : 0;
            // สีใช้เฉพาะแถบซ้าย/แถบ %/ป้าย — ตัวเลขและพื้นเป็นสีปกติ อ่านง่ายทั้งโหมดสว่างและมืด
            const col = !start ? '#94a3b8' : pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
            const label = !start ? '' : pct > 50 ? 'ปกติ' : pct > 20 ? 'เริ่มน้อย' : 'ใกล้หมด!';
            card.className = 'rounded-2xl p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors';
            card.style.borderLeft = '6px solid ' + col;
            // สีตัวเลขตามพื้นการ์ดจริง (ธีมมืดของเว็บไม่ได้ใช้ dark: ของ Tailwind)
            const bg = getComputedStyle(card).backgroundColor.match(/\d+/g) || [255, 255, 255];
            const lum = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]);
            const fg = lum < 128 ? '#ffffff' : '#0f172a', sub = lum < 128 ? '#cbd5e1' : '#475569';
            card.style.color = fg;
            const id = key === 'vision' ? 'Vision' : 'Gemini';
            set('bg' + id + 'Left', start ? thb(left) : 'ยังไม่ตั้งยอด'); const leftEl = document.getElementById('bg' + id + 'Left'); if (leftEl) leftEl.style.color = fg;
            const infoEl = document.getElementById('bg' + id + 'Info'); if (infoEl) infoEl.style.color = sub;
            const pctEl = document.getElementById('bg' + id + 'Pct');
            if (pctEl) { pctEl.textContent = start ? `เหลือ ${Math.round(pct)}% • ${label}` : ''; pctEl.style.color = col; }
            const bar = document.getElementById('bg' + id + 'Bar'); if (bar) { bar.style.width = pct + '%'; bar.style.background = col; }
            set('bg' + id + 'Info', start ? `ตั้งต้น ${thb(start)} • ใช้ไป ${thb(used || 0)} (${(calls || 0).toLocaleString()} รูป) • ใช้ได้อีก ~${Math.floor(left / rate).toLocaleString()} รูป` : 'กด ✏️ ตั้งยอด แล้วใส่ยอดที่เห็นในหน้า Google');
        };
        paint('vision', b.vision_start, b.vision_used, b.vision_calls, rates.vision);
        paint('gemini', b.gemini_start, b.gemini_used, b.gemini_calls, rates.gemini);
        // 📅 ประวัติรายวัน
        window.__ocrHistory = d.history || {}; window.__ocrToday = d.today; window.__ocrRates = rates;
        renderUsage();
        const errEl = document.getElementById('gvLastError');
        if (errEl) {
            if (s.last_error) { errEl.classList.remove('hidden'); errEl.textContent = '⚠️ ข้อผิดพลาดล่าสุด: ' + s.last_error; }
            else errEl.classList.add('hidden');
        }
    } catch (e) {
        badge.innerHTML = '🔴 ติดต่อเซิร์ฟเวอร์ไม่ได้';
        badge.className = 'bg-red-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-red-300/50';
    }
};

window.setOcrEngine = async function(engine) {
    const badge = document.getElementById('gvStatusBadge');
    try {
        if (badge) badge.innerHTML = '⏳ กำลังสลับเป็น ' + (OCR_ENGINE_LABEL[engine] || engine) + '...';
        if (typeof window.clearSettingCache === 'function') window.clearSettingCache();
        const { error } = await appDB.from('settings').upsert([{ key: 'ocr_engine', value: JSON.stringify(engine) }]);
        if (error) throw error;
        // Railway อ่านค่าใหม่ทันทีตอนถูกเรียก /health (เราเคลียร์ cache ฝั่งนั้นให้แล้ว)
        await new Promise(r => setTimeout(r, 400));
        fetchGoogleOcrStatus(true);
    } catch (e) {
        if (badge) badge.innerHTML = '🔴 สลับไม่สำเร็จ: ' + (e.message || e);
    }
};

// 💰 ตั้งยอดตั้งต้น (บาท) — โมดัลสวยๆ แทน prompt
window.setOcrBudget = function(which) {
    const isV = which === 'vision';
    const label = isV ? 'เครดิต Google Cloud (Vision)' : 'เงินเติม Gemini';
    const hint = isV ? 'ดูจาก Google Cloud → Billing → "You have a credit"' : 'ดูจาก AI Studio → Projects → ยอด Prepay';
    const link = isV ? 'https://console.cloud.google.com/billing' : 'https://aistudio.google.com/projects';
    const accent = isV ? '#10b981' : '#0ea5e9';
    document.getElementById('ocrBudgetModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'ocrBudgetModal';
    wrap.innerHTML = `
    <div style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.65);backdrop-filter:blur(6px);animation:obFade .15s ease">
      <div style="width:min(440px,92vw);background:linear-gradient(180deg,#151a26,#0f1420);border:1px solid rgba(255,255,255,.08);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden;animation:obPop .18s cubic-bezier(.2,.9,.3,1.2);font-family:inherit">
        <div style="height:4px;background:linear-gradient(90deg,${accent},transparent)"></div>
        <div style="padding:22px 24px 8px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:12px;background:${accent}22;display:flex;align-items:center;justify-content:center;font-size:20px">💰</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff">ตั้งยอด${label}</div>
              <div style="font-size:12px;color:#8b93a8;margin-top:2px">ระบบจะเริ่มนับใหม่จากยอดนี้ แล้วหักตามการใช้จริง</div>
            </div>
          </div>
        </div>
        <div style="padding:14px 24px 6px">
          <label style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8b93a8">ยอดที่มีตอนนี้ (บาท)</label>
          <div style="position:relative;margin-top:8px">
            <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:20px;font-weight:900;color:${accent}">฿</span>
            <input id="obInput" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off"
              style="width:100%;box-sizing:border-box;padding:14px 16px 14px 42px;border-radius:14px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;font-size:26px;font-weight:900;letter-spacing:.5px;outline:none;transition:border-color .15s,box-shadow .15s">
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" id="obQuick"></div>
          <div style="font-size:12px;color:#8b93a8;margin-top:10px">💡 ${hint} · <a href="${link}" target="_blank" style="color:${accent};font-weight:700;text-decoration:none">เปิดดูยอดจริง ↗</a></div>
          <div id="obErr" style="display:none;font-size:12px;color:#f87171;font-weight:700;margin-top:8px"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding:16px 24px 22px">
          <button id="obCancel" style="padding:11px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#cbd5e1;font-weight:800;font-size:13px;cursor:pointer">ยกเลิก</button>
          <button id="obSave" style="padding:11px 22px;border-radius:12px;border:0;background:${accent};color:#04111a;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 8px 20px ${accent}55">บันทึกยอด</button>
        </div>
      </div>
    </div>
    <style>@keyframes obFade{from{opacity:0}to{opacity:1}}@keyframes obPop{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}#obInput:focus{border-color:${accent};box-shadow:0 0 0 4px ${accent}33}</style>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('#obInput'), err = wrap.querySelector('#obErr');
    const quick = wrap.querySelector('#obQuick');
    (isV ? [9869, 5000, 3000, 1000] : [300, 500, 1000, 2000]).forEach(v => { const b = document.createElement('button'); b.textContent = '฿' + v.toLocaleString(); b.style.cssText = 'padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#cbd5e1;font-weight:700;font-size:12px;cursor:pointer'; b.onclick = () => { input.value = v; input.focus(); }; quick.appendChild(b); });
    const close = () => wrap.remove();
    wrap.querySelector('#obCancel').onclick = close;
    wrap.firstElementChild.addEventListener('mousedown', e => { if (e.target === wrap.firstElementChild) close(); });
    document.addEventListener('keydown', function esc(e) { if (!document.body.contains(wrap)) return document.removeEventListener('keydown', esc); if (e.key === 'Escape') close(); });
    const save = async () => {
        const num = parseFloat(String(input.value).replace(/[^\d.]/g, ''));
        if (isNaN(num) || num < 0) { err.style.display = ''; err.textContent = 'ใส่ตัวเลขบาท เช่น 9869'; input.focus(); return; }
        const btn = wrap.querySelector('#obSave'); btn.textContent = '⏳ กำลังบันทึก...'; btn.disabled = true;
        try {
            if (typeof window.clearSettingCache === 'function') window.clearSettingCache();
            const { data } = await appDB.from('settings').select('value').eq('key', 'ocr_budget').maybeSingle();
            const b = (data && data.value) ? JSON.parse(data.value) : {};
            if (isV) { b.vision_start = num; b.vision_used = 0; b.vision_calls = 0; } else { b.gemini_start = num; b.gemini_used = 0; b.gemini_calls = 0; }
            b.reset_at = Date.now();
            const { error } = await appDB.from('settings').upsert([{ key: 'ocr_budget', value: JSON.stringify(b) }]);
            if (error) throw error;
            btn.textContent = '✅ บันทึกแล้ว'; setTimeout(() => { close(); fetchGoogleOcrStatus(true); }, 400);
        } catch (e) { err.style.display = ''; err.textContent = 'บันทึกไม่สำเร็จ: ' + (e.message || e); btn.textContent = 'บันทึกยอด'; btn.disabled = false; }
    };
    wrap.querySelector('#obSave').onclick = save;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    setTimeout(() => input.focus(), 50);
};

// 📅 สถิติการใช้ตามช่วงเวลา
let usagePeriod = 'today', usageDate = '';
window.renderUsage = function() {
    const H = window.__ocrHistory || {}, today = window.__ocrToday || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const dayShift = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() - n * 86400e3).toISOString().slice(0, 10);
    let days = [], title = '';
    if (usageDate) { days = [usageDate]; title = 'วันที่ ' + usageDate; }
    else if (usagePeriod === 'today') { days = [today]; title = 'วันนี้ (' + today + ')'; }
    else if (usagePeriod === 'yesterday') { days = [dayShift(1)]; title = 'เมื่อวาน (' + dayShift(1) + ')'; }
    else if (usagePeriod === 'all') { days = Object.keys(H); title = 'ทั้งหมด (' + days.length + ' วันที่มีข้อมูล)'; }
    else { const n = parseInt(usagePeriod, 10); for (let i = 0; i < n; i++) days.push(dayShift(i)); title = n + ' วันล่าสุด (' + dayShift(n - 1) + ' → ' + today + ')'; }
    const sum = { vision: 0, gemini: 0, fallback: 0, vision_thb: 0, gemini_thb: 0 };
    days.forEach(dk => { const h = H[dk]; if (!h) return; for (const k in sum) sum[k] += (h[k] || 0); });
    const thb = (v) => '฿' + (Math.round(v * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('usageTitle', title);
    set('usVision', sum.vision.toLocaleString()); set('usVisionThb', thb(sum.vision_thb));
    set('usGemini', sum.gemini.toLocaleString()); set('usGeminiThb', thb(sum.gemini_thb));
    set('usFallback', sum.fallback.toLocaleString());
    set('usTotalThb', thb(sum.vision_thb + sum.gemini_thb)); set('usTotalN', (sum.vision + sum.gemini + sum.fallback).toLocaleString() + ' รูป');
    document.querySelectorAll('.usage-p').forEach(btn => { const on = !usageDate && btn.dataset.p === usagePeriod; btn.className = 'usage-p px-3 py-1.5 rounded-lg text-xs font-bold ' + (on ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'); });
};
document.addEventListener('click', (e) => { const btn = e.target.closest('.usage-p'); if (!btn) return; usagePeriod = btn.dataset.p; usageDate = ''; const di = document.getElementById('usageDate'); if (di) di.value = ''; renderUsage(); });
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'usageDate') { usageDate = e.target.value; renderUsage(); } });
