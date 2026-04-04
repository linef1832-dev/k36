// ==========================================
// ควบคุมการสลับ Tab ในหน้า Admin
// ==========================================
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
        
        // สลับหน้าเนื้อหา
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
