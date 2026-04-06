// ==========================================
// 🟢 ฟังก์ชันเช็คสิทธิ์ (โชว์ปุ่มแอดมิน) ตอนเปิดหน้า
// ==========================================
window.initSheetApp = async function() {
    const btnManage = document.getElementById('btnManageSheet');
    if (btnManage) {
        if (window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.role === 'manager')) {
            btnManage.classList.remove('hidden'); // ถ้าเป็นแอดมินให้โชว์ปุ่มจัดการชีท
        } else {
            btnManage.classList.add('hidden'); // พนักงานทั่วไปซ่อนปุ่ม
        }
    }
};

// ==========================================
// 🟢 ระบบเปิดลิงก์ & จัดการแท็บ (Sheet Viewer)
// ==========================================

let recentTabs = JSON.parse(localStorage.getItem('sheet_recent_tabs') || '[]');

window.renderRecentTabs = function() {
    const container = document.getElementById('recentTabsContainer');
    if (!container) return;
    
    if (recentTabs.length === 0) { 
        container.classList.add('hidden'); 
        return; 
    }
    container.classList.remove('hidden');

    let html = recentTabs.map(tab => {
        const isViewerVisible = !document.getElementById('sheetViewer').classList.contains('hidden');
        const isActive = document.getElementById('sheetTitle').innerText.includes(tab.name) && isViewerVisible;
        const activeClass = isActive ? 'bg-white text-blue-700 border-t-2 border-blue-600 rounded-t-lg shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 rounded-t-lg opacity-80';
        const icon = (tab.url && tab.url.startsWith('http')) ? 'link' : 'table_chart';

        return `<div onclick='openSheet(${JSON.stringify(tab)})' class="${activeClass} px-3 py-1.5 min-w-[120px] max-w-[200px] flex items-center justify-between gap-2 cursor-pointer transition select-none group border-x border-t border-gray-300/50">
            <div class="flex items-center gap-1 overflow-hidden">
                <span class="material-icons text-xs">${icon}</span>
                <span class="text-xs font-bold truncate">${tab.name || tab.title}</span>
            </div>
            <button onclick="closeTab(event, '${tab.id}')" class="text-gray-400 hover:text-red-500 rounded-full p-0.5 hover:bg-gray-100/50">
                <span class="material-icons text-[14px] font-bold">close</span>
            </button>
        </div>`;
    }).join('');

    if (recentTabs.length > 1) { 
        html += `<button onclick="clearAllTabs()" class="ml-2 px-2 pb-2 text-[10px] text-red-500 hover:text-red-700 underline shrink-0">ล้างทั้งหมด</button>`; 
    }
    container.innerHTML = html;
};

window.addToRecentTabs = function(sheet) {
    recentTabs = recentTabs.filter(t => t.id !== sheet.id);
    recentTabs.unshift(sheet);
    if (recentTabs.length > 10) recentTabs.pop();
    localStorage.setItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    renderRecentTabs();
};

window.closeTab = function(e, id) {
    e.stopPropagation();
    recentTabs = recentTabs.filter(t => t.id !== id);
    localStorage.setItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    if (recentTabs.length === 0) closeSheet();
    renderRecentTabs();
};

window.clearAllTabs = function() {
    recentTabs = [];
    localStorage.setItem('sheet_recent_tabs', '[]');
    renderRecentTabs();
    closeSheet();
};

window.openSheet = function(sheet) {
    // ซ่อนเมนูกรุ๊ป และโชว์หน้าจอ iFrame
    document.getElementById('sheetMenu').classList.add('hidden');
    document.getElementById('sheetViewer').classList.remove('hidden');
    
    // อัปเดตป้ายชื่อบนหัว
    const groupName = sheet.category || sheet.group_name || 'ทั่วไป';
    const sheetName = sheet.title || sheet.name || 'ไม่มีชื่อ';
    document.getElementById('sheetTitle').innerHTML = `<span class="text-gray-500">${groupName}</span> <span class="material-icons text-xs mx-1">arrow_forward_ios</span> <span class="text-white">${sheetName}</span>`;
    
    document.getElementById('sheetLoading').classList.remove('hidden');
    addToRecentTabs(sheet);

    // จัดการลิงก์ URL
    let finalUrl = sheet.url || sheet.sheet_id || '';
    if (finalUrl && !finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
    }
    
    // ตั้งค่าปุ่มเปิดแท็บใหม่
    const btnNewTab = document.getElementById('btnOpenNewTab');
    if (btnNewTab) {
        btnNewTab.onclick = () => window.open(finalUrl, '_blank');
    }
    
    // สั่งโหลดหน้าเว็บลงใน iFrame
    const frame = document.getElementById('sheetFrame');
    frame.onload = function() { document.getElementById('sheetLoading')?.classList.add('hidden'); };
    frame.src = finalUrl;
};

window.closeSheet = function() {
    const frame = document.getElementById('sheetFrame');
    if(frame) frame.src = 'about:blank'; // ล้างหน้าจอ
    document.getElementById('sheetViewer')?.classList.add('hidden');
    document.getElementById('sheetMenu')?.classList.remove('hidden');
    renderRecentTabs();
};

// สั่งให้ระบบวาดแท็บที่เคยเปิดไว้ตอนโหลดหน้าเว็บครั้งแรก
setTimeout(() => { renderRecentTabs(); }, 500);

// ==========================================
// 🟢 ระบบดักจับการสลับหน้า 
// ==========================================
const showPage_Old_Sheet = window.showPage; 
window.showPage = async function(page) {
    if (typeof showPage_Old_Sheet === 'function') {
        await showPage_Old_Sheet(page);
    }
    if (page === 'sheet') {
        ['mainContentArea', 'adminPanel', 'logsPage', 'leaveApp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const sheetApp = document.getElementById('sheetApp');
        if (sheetApp) {
            sheetApp.classList.remove('hidden');
            sheetApp.classList.add('flex');
        }
        if (typeof window.initSheetApp === 'function') window.initSheetApp();
    } else {
        const sheetApp = document.getElementById('sheetApp');
        if (sheetApp) {
            sheetApp.classList.add('hidden');
            sheetApp.classList.remove('flex');
        }
    }
};
