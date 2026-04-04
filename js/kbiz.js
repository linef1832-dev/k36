// ==========================================
// 🤖 ระบบจัดการบอท K BIZ (K BIZ APP)
// ==========================================
let globalKbizBots = [];

async function fetchKbizData() {
    const grid = document.getElementById('kbizGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-20"><span class="material-icons animate-spin text-emerald-500 text-5xl mb-2">sync</span><br><span class="text-gray-400 font-bold">กำลังโหลดข้อมูลบอท...</span></div>';
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'kbiz_bots_data').single();
        if (data && data.value) globalKbizBots = JSON.parse(data.value);
        else globalKbizBots = [];
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

    grid.innerHTML = filtered.map(b => {
        const statusColor = b.is_active ? 'bg-emerald-500' : 'bg-gray-500';
        const statusText = b.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
        
        return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all group relative flex flex-col h-full transform hover:-translate-y-1">
            <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                <button onclick="editKbizBot('${b.id}')" class="text-gray-400 hover:text-amber-500 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">edit</span></button>
                <button onclick="deleteKbizBot('${b.id}')" class="text-gray-400 hover:text-red-500 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">delete</span></button>
            </div>
            <div class="flex items-center gap-4 mb-4">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-inner"><span class="material-icons text-3xl text-slate-500 dark:text-slate-400">computer</span></div>
                <div class="flex-1 min-w-0 pt-1">
                    <h4 class="font-black text-slate-800 dark:text-white text-lg truncate">${b.machine_id}</h4>
                    <div class="flex items-center gap-1.5 mt-1"><span class="w-2 h-2 rounded-full ${statusColor} shadow-[0_0_5px_currentColor]"></span><span class="text-[10px] font-bold text-gray-500">${statusText}</span></div>
                </div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 mt-auto space-y-2">
                <div class="text-xs text-gray-500 font-bold truncate">${b.display_name || '-'}</div>
                <div class="flex justify-between items-center text-xs border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span class="text-gray-500">User: <b class="text-slate-700 dark:text-gray-300 ml-1">${b.username}</b></span>
                    <span class="text-gray-500">Pass: <b class="text-emerald-600 dark:text-emerald-400 ml-1 blur-sm hover:blur-none transition cursor-pointer select-all" title="คลิกเพื่อดูรหัส">${b.password}</b></span>
                </div>
            </div>
        </div>`;
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

    if (id) {
        const index = globalKbizBots.findIndex(x => String(x.id) === String(id));
        if(index !== -1) globalKbizBots[index] = { id, machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive };
    } else {
        globalKbizBots.push({ id: 'bot_' + Date.now(), machine_id: mId, display_name: dName, username: user, password: pass, is_active: isActive });
    }

    try {
        await appDB.from('settings').upsert([{ key: 'kbiz_bots_data', value: JSON.stringify(globalKbizBots) }]);
        document.getElementById('kbizModal').classList.add('hidden');
        renderKbizGrid();
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
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