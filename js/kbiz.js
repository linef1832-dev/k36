// ==========================================
// 🤖 ระบบจัดการบอท K BIZ (K BIZ APP)
// ==========================================
let globalKbizBots = [];
let globalOcrKeys = [];

// 🌟 ตัวช่วยดึง HTML Template และแทนที่ข้อมูล
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
        // 🔑 โหลด OCR keys หลังโหลดบอทเสร็จ
        fetchOcrKeysData();
    } catch(e) { 
        globalKbizBots = []; 
        renderKbizGrid(); 
        fetchOcrKeysData();
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
// 🔑 ระบบจัดการ OCR API KEYS
// ==========================================

// ฟังก์ชันซ่อน API key (โชว์แค่ 4 ตัวแรก + ดอท + 4 ตัวสุดท้าย)
function maskOcrKey(key) {
    if (!key || key.length < 8) return key || '';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

// อัพเดทป้ายสถานะใน modal เมื่อกดสวิตช์
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

async function fetchOcrKeysData() {
    const grid = document.getElementById('ocrKeysGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10"><span class="material-icons animate-spin text-amber-500 text-4xl mb-2">sync</span><br><span class="text-gray-400 font-bold text-sm">กำลังโหลด API Keys...</span></div>';
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'ocr_api_keys_data').single();
        if (data && data.value) {
            globalOcrKeys = JSON.parse(data.value);
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
        return getKbizTpl('tpl-ocr-key-card', {
            id: k.id,
            key_name: k.key_name,
            api_key: k.api_key,
            statusColor: k.is_active ? 'bg-emerald-500' : 'bg-gray-500',
            statusText: k.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
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

    if (!keyName) {
        return Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณาตั้งชื่อ Key', 'warning');
    }

    if (keyValue.length < 10) {
        return Swal.fire('Key สั้นเกินไป', 'API key ดูสั้นผิดปกติ ตรวจสอบให้แน่ใจว่าก๊อปมาครบ', 'warning');
    }

    // เช็ค key ซ้ำ — เฉพาะกับ key อื่น (ไม่ใช่ตัวเอง)
    const isDuplicate = globalOcrKeys.some(k => 
        k.api_key === keyValue && String(k.id) !== String(id)
    );
    if (isDuplicate) {
        return Swal.fire('Key ซ้ำ', 'API key นี้มีในระบบแล้วครับ', 'warning');
    }

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

    if (id && id.trim() !== '') {
        // 🟢 โหมดแก้ไข
        const index = globalOcrKeys.findIndex(x => String(x.id) === String(id));
        if(index !== -1) {
            globalOcrKeys[index] = { 
                id: globalOcrKeys[index].id, 
                key_name: keyName, 
                api_key: keyValue, 
                is_active: isActive 
            };
        } else {
            globalOcrKeys.push({ id, key_name: keyName, api_key: keyValue, is_active: isActive });
        }
    } else {
        // 🟢 โหมดเพิ่มใหม่
        if (globalOcrKeys.length >= 5) {
            Swal.close();
            return Swal.fire('ครบแล้ว', 'ใส่ key ได้สูงสุด 5 อัน', 'warning');
        }
        globalOcrKeys.push({ 
            id: 'key_' + Date.now(), 
            key_name: keyName, 
            api_key: keyValue, 
            is_active: isActive 
        });
    }

    try {
        await appDB.from('settings').upsert([{ key: 'ocr_api_keys_data', value: JSON.stringify(globalOcrKeys) }]);
        document.getElementById('ocrKeyModal').classList.add('hidden');
        renderOcrKeysGrid();
        Swal.fire({
            icon: 'success', 
            title: id ? 'แก้ไขสำเร็จ!' : 'เพิ่ม Key สำเร็จ!', 
            timer: 1500, 
            showConfirmButton: false
        });
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
