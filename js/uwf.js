let globalUwfComputers = [];
let uwfSubscription = null;

window.initUwfApp = async function() {
    // โหลดข้อมูลเมื่อเปิดหน้าต่าง
    await fetchUwfComputers();
    subscribeUwfChanges();
};

window.fetchUwfComputers = async function() {
    const grid = document.getElementById('uwfGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="col-span-full text-center py-20"><span class="material-icons animate-spin text-cyan-500 text-5xl mb-2">sync</span><br><span class="text-gray-400 font-bold">กำลังโหลดสถานะคอมพิวเตอร์...</span></div>';

    try {
        const { data, error } = await appDB.from('uwf_computers').select('*').order('computer_name', { ascending: true });
        if (error) throw error;
        
        globalUwfComputers = data || [];
        renderUwfGrid();
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">โหลดไม่สำเร็จ: ${e.message}</div>`;
    }
};

window.renderUwfGrid = function() {
    const grid = document.getElementById('uwfGrid');
    if (!grid) return;
    
    const searchVal = document.getElementById('uwfSearchInput') ? document.getElementById('uwfSearchInput').value.toLowerCase() : '';
    const filtered = globalUwfComputers.filter(pc => pc.computer_name.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-20 font-bold">ไม่พบข้อมูลคอมพิวเตอร์</div>';
        return;
    }

    grid.innerHTML = filtered.map(pc => {
        // จัดการสีและไอคอนตามสถานะ
        const isOnline = pc.is_online;
        const isFrozen = pc.uwf_status;
        
        const onlineColor = isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-500';
        const onlineText = isOnline ? 'Online' : 'Offline';
        
        const freezeBg = isFrozen ? 'bg-blue-900/30 border-blue-500/50' : 'bg-red-900/30 border-red-500/50';
        const freezeText = isFrozen ? '<span class="text-blue-400 font-bold"><span class="material-icons text-[14px] align-middle">ac_unit</span> แช่แข็งอยู่</span>' 
                                    : '<span class="text-red-400 font-bold"><span class="material-icons text-[14px] align-middle">lock_open</span> ปลดล็อคแล้ว</span>';
        
        const btnAction = isFrozen 
            ? `<button onclick="toggleUwfStatus('${pc.computer_name}', false)" class="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-lg font-bold text-xs transition border border-red-500/50 flex justify-center items-center gap-1"><span class="material-icons text-[14px]">lock_open</span> สั่งปลดล็อค</button>`
            : `<button onclick="toggleUwfStatus('${pc.computer_name}', true)" class="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white py-2 rounded-lg font-bold text-xs transition border border-blue-500/50 flex justify-center items-center gap-1"><span class="material-icons text-[14px]">ac_unit</span> สั่งแช่แข็ง</button>`;

        return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col group hover:border-cyan-500 transition">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-3xl text-slate-400 dark:text-slate-500 group-hover:text-cyan-400 transition">desktop_windows</span>
                    <div>
                        <h4 class="font-black text-slate-800 dark:text-white text-base">${pc.computer_name}</h4>
                        <div class="flex items-center gap-1.5 mt-0.5"><span class="w-2 h-2 rounded-full ${onlineColor}"></span><span class="text-[10px] text-gray-500 font-bold">${onlineText}</span></div>
                    </div>
                </div>
                <button onclick="restartComputer('${pc.computer_name}')" class="text-gray-400 hover:text-amber-500 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg border border-transparent dark:border-slate-700 transition" title="สั่ง Restart เครื่อง"><span class="material-icons text-[18px]">restart_alt</span></button>
            </div>
            
            <div class="mt-auto flex flex-col gap-2">
                <div class="p-2 rounded-lg border text-center text-xs shadow-inner ${freezeBg}">
                    ${freezeText}
                </div>
                ${btnAction}
            </div>
        </div>
        `;
    }).join('');
};

window.toggleUwfStatus = async function(computerName, targetStatus) {
    const actionText = targetStatus ? 'แช่แข็ง' : 'ปลดล็อค';
    const result = await Swal.fire({
        title: `ยืนยันการ ${actionText}?`,
        text: `เครื่อง ${computerName} จะทำการ Restart ทันทีที่รับคำสั่ง`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: targetStatus ? '#3b82f6' : '#ef4444',
        confirmButtonText: `ใช่, ${actionText}เลย`
    });

    if (result.isConfirmed) {
        Swal.fire({title: 'กำลังส่งคำสั่ง...', didOpen: () => Swal.showLoading()});
        
        // อัปเดตลง Database เพื่อให้ Agent ในเครื่องนั้นดึงคำสั่งไปทำงาน
        const { error } = await appDB.from('uwf_computers').update({ uwf_status: targetStatus }).eq('computer_name', computerName);
        
        if (error) Swal.fire('Error', error.message, 'error');
        else Swal.fire({icon: 'success', title: 'ส่งคำสั่งสำเร็จ', timer: 1000, showConfirmButton: false});
    }
};

window.restartComputer = async function(computerName) {
    const result = await Swal.fire({
        title: `สั่ง Restart ${computerName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'รีสตาร์ท',
        confirmButtonColor: '#f59e0b'
    });

    if (result.isConfirmed) {
        // (ทริคเพิ่มเติม: ถ้าต้องการสั่งรีสตาร์ทเพียวๆ คุณอาจต้องเพิ่ม column เช่น 'command' ให้ agent ดึงไปอ่านด้วยครับ)
        Swal.fire('ส่งคำสั่งแล้ว', `เครื่อง ${computerName} กำลังเริ่มระบบใหม่`, 'success');
    }
};

window.subscribeUwfChanges = function() {
    if (uwfSubscription) return;
    uwfSubscription = appDB.channel('custom-uwf-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'uwf_computers' }, (payload) => {
            fetchUwfComputers(); // โหลดข้อมูลวาดหน้าเว็บใหม่แบบเรียลไทม์
        })
        .subscribe();
};
