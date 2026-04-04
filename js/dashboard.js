// ==========================================
// ควบคุมระบบหน้า Dashboard & Admin Panel
// ==========================================
window.openAdminPanel = async function() {
    // ถ้าไม่ได้อยู่หน้า dashboard ให้โหลดหน้า dashboard ก่อน
    if (!document.getElementById('adminPanel')) {
        await showPage('dashboard');
        // รอให้ระบบโหลดหน้าเสร็จแป๊บนึง ค่อยสลับกล่อง
        setTimeout(() => {
            document.getElementById('mainContentArea').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            document.getElementById('adminPanel').classList.add('flex');
            switchAdminTab('settings'); // เปิดแท็บแรกเสมอ
        }, 300);
    } else {
        // ถ้าอยู่หน้า dashboard อยู่แล้ว สลับกล่องได้เลย
        document.getElementById('mainContentArea').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('flex');
        switchAdminTab('settings');
    }
};

window.switchAdminTab = function(tab) {
    const tabs = ['settings', 'users', 'perms', 'info'];
    
    tabs.forEach(t => {
        const btn = document.getElementById('btnAdminTab_' + t);
        const view = document.getElementById('adminView_' + t);
        
        // สลับสีปุ่ม
        if (btn) {
            if (t === tab) {
                btn.className = 'whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 bg-amber-500 text-slate-900 shadow-md';
            } else {
                btn.className = 'whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
            }
        }
        
        // สลับกล่องเนื้อหา
        if (view) {
            if (t === tab) {
                view.classList.remove('hidden');
                view.classList.add('flex');
            } else {
                view.classList.add('hidden');
                view.classList.remove('flex');
            }
        }
    });
};
