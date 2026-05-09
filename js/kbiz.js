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
        const { data } = await appDB.from('settings').select('value').eq('key', 'kbiz_bots_data').single();
        if (data && data.value) {
            globalKbizBots = JSON.parse(data.value);
            let needSave = false;
            globalKbizBots = globalKbizBots.map(b => {
                if (!b.id) {
                    needSave = true;
                    return { ...b, id: 'bot_' + Math.random().toString(36).substr(2, 9) };
                }
                return b;
            });
            if (needSave) {
                await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
            }
        } else {
            globalKbizBots = [];
        }
        renderKbizGrid();
        fetchOcrKeysData();
        fetchTelegramBotConfig();
        startVpsStatsPolling();
    } catch(e) { 
        globalKbizBots = []; 
        renderKbizGrid(); 
        fetchOcrKeysData();
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
        await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
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
            await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
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
        const { data } = await appDB.from('settings').select('value').eq('key', 'ocr_api_keys_data').single();
        if (data && data.value) {
            globalOcrKeys = JSON.parse(data.value);
            const needSave = autoResetIfNewDay(globalOcrKeys);
            globalOcrKeys.forEach(k => {
                if (typeof k.used_count !== 'number') { k.used_count = 0; k.last_used_date = getTodayKey(); }
                if (!k.last_used_date) k.last_used_date = getTodayKey();
            });
            if (needSave) {
                await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
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
        await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
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
            await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
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
            await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
            renderOcrKeysGrid();
            Swal.fire({icon: 'success', title: 'รีเซ็ตแล้ว!', timer: 1200, showConfirmButton: false});
        }
    });
};

setInterval(() => {
    if (document.getElementById('ocrKeysGrid')) {
        fetchOcrKeysData();
    }
}, 30000);


// ==========================================
// 🤖 ระบบจัดการ Telegram Bot Config
// ==========================================
let globalTelegramConfig = {};

async function fetchTelegramBotConfig() {
    if (!document.getElementById('telegramBotToken')) return;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'telegram_bot_config').single();
        if (data && data.value) {
            globalTelegramConfig = JSON.parse(data.value);
        } else {
            globalTelegramConfig = {};
        }
    } catch(e) {
        globalTelegramConfig = {};
    }
    renderTelegramBotConfig();
}

function renderTelegramBotConfig() {
    const tokenInput = document.getElementById('telegramBotToken');
    if (!tokenInput) return;

    tokenInput.value = globalTelegramConfig.token || '';
    document.getElementById('telegramPickStrategy').value = globalTelegramConfig.pick_strategy || 'random';
    document.getElementById('telegramEnabled').checked = globalTelegramConfig.enabled !== false;

    const select = document.getElementById('telegramPreferredMachine');
    const activeBots = (globalKbizBots || []).filter(b => b.is_active);
    let optionsHtml = '<option value="">🎲 อัตโนมัติ (สลับใช้ทุกตัวที่ active)</option>';
    optionsHtml += activeBots.map(b => 
        `<option value="${b.machine_id}">${b.machine_id}${b.display_name ? ' — ' + b.display_name : ''}</option>`
    ).join('');
    select.innerHTML = optionsHtml;
    select.value = globalTelegramConfig.preferred_machine || '';

    const badge = document.getElementById('telegramBotStatusBadge');
    if (badge) {
        const hasToken = !!globalTelegramConfig.token;
        const isEnabled = globalTelegramConfig.enabled !== false;
        if (!hasToken) {
            badge.textContent = '⚠ ยังไม่ตั้ง Token';
            badge.className = 'bg-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-amber-300/50';
        } else if (!isEnabled) {
            badge.textContent = '⏸ ปิดใช้งาน';
            badge.className = 'bg-red-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-red-300/50';
        } else {
            badge.textContent = '✅ พร้อมใช้งาน';
            badge.className = 'bg-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-300/50';
        }
    }
}

window.toggleTelegramTokenVisibility = function() {
    const input = document.getElementById('telegramBotToken');
    const icon = document.getElementById('telegramTokenEyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
};

window.saveTelegramConfig = async function(e) {
    if (e) e.preventDefault();
    const token = document.getElementById('telegramBotToken').value.trim();
    const preferred = document.getElementById('telegramPreferredMachine').value;
    const strategy = document.getElementById('telegramPickStrategy').value;
    const enabled = document.getElementById('telegramEnabled').checked;

    if (token && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
        return Swal.fire('Token รูปแบบไม่ถูกต้อง', 'Token ของ Telegram ต้องเป็นแบบ <b>123456789:ABCdef...</b>', 'warning');
    }

    const config = {
        token: token,
        preferred_machine: preferred,
        pick_strategy: strategy,
        enabled: enabled,
        updated_at: new Date().toISOString()
    };

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    try {
        await appDB.from('settings').upsert([{ key: 'telegram_bot_config', value: JSON.stringify(config) }]);
        globalTelegramConfig = config;
        renderTelegramBotConfig();
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ!',
            html: '⚠ <b>อย่าลืมรีสตาร์ท bot บน VPS</b><br><span class="text-xs">ปิดหน้าต่าง CMD แล้ว double-click <code>2-start-bot.bat</code> ใหม่</span>',
            timer: 3500,
            showConfirmButton: false
        });
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
};

window.testTelegramBotInfo = async function() {
    const token = document.getElementById('telegramBotToken').value.trim();
    if (!token) return Swal.fire('ไม่มี Token', 'กรอก token ก่อน', 'warning');

    Swal.fire({title: 'กำลังทดสอบ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (data.ok) {
            const b = data.result;
            Swal.fire({
                icon: 'success',
                title: 'Token ใช้งานได้!',
                html: `
                    <div class="text-left text-sm space-y-1 mt-2">
                        <div>🤖 ชื่อบอท: <b>${b.first_name}</b></div>
                        <div>📛 Username: <code>@${b.username}</code></div>
                        <div>🔗 Link: <a href="https://t.me/${b.username}" target="_blank" class="text-sky-500 underline">t.me/${b.username}</a></div>
                    </div>
                `
            });
        } else {
            Swal.fire('Token ใช้ไม่ได้', data.description || 'Telegram API ปฏิเสธ token นี้', 'error');
        }
    } catch(err) {
        Swal.fire('เชื่อมไม่ได้', err.message, 'error');
    }
};


// ==========================================
// 📊 VPS STATS DASHBOARD
// ==========================================
let _vpsStatsTimer = null;

window.fetchVpsStats = async function(manual = false) {
    if (!document.getElementById('vpsStatsCard')) return;

    const btnIcon = manual ? document.querySelector('#vpsStatsRefreshBtn .material-icons') : null;
    if (btnIcon) btnIcon.classList.add('animate-spin');

    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'vps_stats').single();
        if (data && data.value) {
            const stats = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            renderVpsStats(stats);
        } else {
            setVpsStatsOffline();
        }
    } catch(e) {
        setVpsStatsOffline();
    } finally {
        if (btnIcon) {
            setTimeout(() => btnIcon.classList.remove('animate-spin'), 600);
        }
    }
};

function formatUptime(sec) {
    if (!sec || sec < 0) return '—';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d} วัน ${h} ชม`;
    if (h > 0) return `${h} ชม ${m} นาที`;
    return `${m} นาที`;
}

function timeAgo(isoString) {
    if (!isoString) return '—';
    const past = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - past) / 1000);
    if (isNaN(diffSec)) return '—';
    if (diffSec < 5) return 'เมื่อสักครู่';
    if (diffSec < 60) return `${diffSec} วินาทีก่อน`;
    if (diffSec < 3600) return `${Math.floor(diffSec/60)} นาทีก่อน`;
    if (diffSec < 86400) return `${Math.floor(diffSec/3600)} ชม.ก่อน`;
    return `${Math.floor(diffSec/86400)} วันก่อน`;
}

function colorByPercent(percent) {
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-300' };
    if (percent >= 75) return { bar: 'bg-orange-500', text: 'text-orange-300' };
    if (percent >= 50) return { bar: 'bg-amber-500', text: 'text-amber-300' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-300' };
}

function renderVpsStats(stats) {
    if (!stats) return setVpsStatsOffline();

    const updatedAt = stats.updated_at;
    if (updatedAt) {
        const ageSec = (Date.now() - new Date(updatedAt).getTime()) / 1000;
        if (ageSec > 90) {
            setVpsStatsStale(stats);
            return;
        }
    }

    const cpu = stats.cpu_percent ?? 0;
    const cpuColor = colorByPercent(cpu);
    document.getElementById('vpsStatsCpu').textContent = `${cpu.toFixed(1)}%`;
    document.getElementById('vpsStatsCpu').className = `text-base font-black ${cpuColor.text}`;
    const cpuBar = document.getElementById('vpsStatsCpuBar');
    cpuBar.style.width = `${Math.min(100, cpu)}%`;
    cpuBar.className = `h-full transition-all ${cpuColor.bar}`;

    const ramPct = stats.ram_percent ?? 0;
    const ramColor = colorByPercent(ramPct);
    document.getElementById('vpsStatsRam').textContent = `${ramPct.toFixed(1)}%`;
    document.getElementById('vpsStatsRam').className = `text-base font-black ${ramColor.text}`;
    const ramBar = document.getElementById('vpsStatsRamBar');
    ramBar.style.width = `${ramPct}%`;
    ramBar.className = `h-full transition-all ${ramColor.bar}`;
    document.getElementById('vpsStatsRamDetail').textContent =
        `${stats.ram_used_gb?.toFixed(2) || 0} / ${stats.ram_total_gb?.toFixed(2) || 0} GB`;

    const diskPct = stats.disk_percent ?? 0;
    const diskColor = colorByPercent(diskPct);
    document.getElementById('vpsStatsDisk').textContent = `${diskPct.toFixed(1)}%`;
    document.getElementById('vpsStatsDisk').className = `text-base font-black ${diskColor.text}`;
    const diskBar = document.getElementById('vpsStatsDiskBar');
    diskBar.style.width = `${diskPct}%`;
    diskBar.className = `h-full transition-all ${diskColor.bar}`;
    document.getElementById('vpsStatsDiskDetail').textContent =
        `${stats.disk_used_gb?.toFixed(1) || 0} / ${stats.disk_total_gb?.toFixed(1) || 0} GB`;

    document.getElementById('vpsStatsUptime').textContent = formatUptime(stats.system_uptime_sec);
    document.getElementById('vpsStatsBotUptime').textContent = `Bot: ${formatUptime(stats.bot_uptime_sec)}`;

    document.getElementById('vpsStatsUpdatedAt').textContent = timeAgo(updatedAt);
    document.getElementById('vpsStatsBotMem').textContent =
        `Bot RAM: ${stats.bot_mem_mb?.toFixed(1) || 0} MB`;

    // จุดเขียวกระพริบ
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        statusEl.innerHTML = `
            <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span class="font-bold text-emerald-300">Online</span>
        `;
    }
}

function setVpsStatsOffline() {
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span class="font-bold text-red-300">ยังไม่มีข้อมูล</span>
        `;
    }
}

function setVpsStatsStale(stats) {
    if (stats) renderVpsStatsValuesOnly(stats);
    const statusEl = document.getElementById('vpsStatsStatus');
    if (statusEl) {
        const updatedAt = stats?.updated_at;
        statusEl.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-orange-500"></span>
            <span class="font-bold text-orange-300">ข้อมูลค้าง (${timeAgo(updatedAt)})</span>
        `;
    }
}

function renderVpsStatsValuesOnly(stats) {
    document.getElementById('vpsStatsCpu').textContent = `${(stats.cpu_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsRam').textContent = `${(stats.ram_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsDisk').textContent = `${(stats.disk_percent ?? 0).toFixed(1)}%`;
    document.getElementById('vpsStatsUptime').textContent = formatUptime(stats.system_uptime_sec);
    document.getElementById('vpsStatsUpdatedAt').textContent = timeAgo(stats.updated_at);
}

// auto refresh ทุก 5 นาที (300,000 ms)
function startVpsStatsPolling() {
    if (_vpsStatsTimer) clearInterval(_vpsStatsTimer);
    fetchVpsStats();
    _vpsStatsTimer = setInterval(fetchVpsStats, 5 * 60 * 1000);
}


// ==========================================
// 🧹 ปุ่มเคลียร์ RAM
// ==========================================
window.clearVpsRam = async function() {
    const result = await Swal.fire({
        title: '🧹 เคลียร์ RAM cache?',
        html: 'ระบบจะล้าง <b>OS cache</b> เพื่อคืน RAM<br><span class="text-xs text-gray-500">✅ ปลอดภัย — Chrome ไม่ปิด<br>⏱ ใช้เวลา ~5 วินาที</span>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: '🧹 เคลียร์เลย',
        cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'กำลังส่งคำสั่ง...',
        html: '<span class="text-xs">รอ bot บน VPS รับคำสั่ง — สูงสุด 10 วินาที</span>',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
    });

    try {
        // ส่ง command ขึ้น Supabase
        const cmdPayload = {
            action: 'clear_ram',
            requested_at: new Date().toISOString()
        };
        await appDB.from('settings').upsert([{
            key: 'vps_command',
            value: JSON.stringify(cmdPayload)
        }]);

        // รอ bot ทำเสร็จ — poll ผลลัพธ์ทุก 1 วินาที (max 15s)
        const startTime = Date.now();
        let cmdResult = null;
        while (Date.now() - startTime < 15000) {
            await new Promise(r => setTimeout(r, 1500));
            try {
                const { data } = await appDB.from('settings').select('value').eq('key', 'vps_command_result').single();
                if (data && data.value) {
                    const r = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                    if (r && r.executed_at) {
                        const execTime = new Date(r.executed_at).getTime();
                        if (execTime > startTime - 5000) {
                            cmdResult = r;
                            break;
                        }
                    }
                }
            } catch(e) { /* ignore */ }
        }

        if (!cmdResult) {
            return Swal.fire({
                icon: 'warning',
                title: 'ไม่ได้รับคำตอบ',
                html: 'Bot ไม่ตอบกลับใน 15 วินาที<br><span class="text-xs">ลองอีกครั้งหรือเช็คสถานะ bot</span>',
            });
        }

        if (cmdResult.success) {
            await fetchVpsStats(true); // refresh stats ทันที
            Swal.fire({
                icon: 'success',
                title: '✅ เคลียร์ RAM สำเร็จ!',
                html: `
                    <div class="text-left text-sm space-y-1 mt-2">
                        <div>🆓 คืน RAM: <b class="text-emerald-600">${cmdResult.freed_mb} MB</b></div>
                        <div>📊 ก่อน: ${cmdResult.before_mb} MB (${cmdResult.before_percent}%)</div>
                        <div>📊 หลัง: ${cmdResult.after_mb} MB (${cmdResult.after_percent}%)</div>
                    </div>
                `,
                timer: 5000,
                showConfirmButton: true,
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'เคลียร์ไม่ได้',
                text: cmdResult.error || 'ไม่ทราบสาเหตุ',
            });
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error');
    }
};
