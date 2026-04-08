// ==========================================
// 🤖 ระบบจัดการบอท K BIZ (K BIZ APP)
// ==========================================
let globalKbizBots = [];

// 🌟 ตัวช่วยดึง HTML Template และแทนที่ข้อมูล (เหมือนของหน้า Summary/Gallery)
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
            
            // 🌟 ป้องกันข้อมูลเก่าพัง: เช็คว่าบอทตัวไหนไม่มี ID ให้สร้างใหม่และเซฟทับเลย
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
    } catch(e) { globalKbizBots = []; renderKbizGrid(); }
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

    // 🌟 ส่งค่าจาก JS เข้าไปฝังใน Template ของ HTML
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

    // เช็คชื่อซ้ำเฉพาะตอนสร้างใหม่ (id ว่าง)
    if (!id && globalKbizBots.some(b => b.machine_id.toLowerCase() === mId.toLowerCase())) {
        return Swal.fire('ข้อมูลซ้ำ', `ชื่อเครื่อง ${mId} มีในระบบแล้วครับ`, 'warning');
    }

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

    if (id && id.trim() !== '') {
        // โหมดแก้ไข
        const index = globalKbizBots.findIndex(x => String(x.id) === String(id));
        if(index !== -1) {
            globalKbizBots[index] = { id, machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive };
        } else {
            globalKbizBots.push({ id, machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive });
        }
    } else {
        // โหมดเพิ่มใหม่
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
