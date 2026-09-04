// ════════════════════════════════════════════════════════════════════
// 📦 ip_check/core.js — ส่วนที่ 1/4 ของระบบตรวจสอบ IP/FP (แยกจาก ip_check.js เดิม 2,059 บรรทัด)
// เนื้อหา: init, ดึงข้อมูล, dropdown, ระบบแท็บ, Tab ประวัติทั้งหมด + แบ่งหน้า
// ⚠️ ลำดับโหลด: ip_check/core → ip_check/tabs → ip_check/risk → ip_check/alerts
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 🌐 ระบบตรวจสอบ IP + FP พนักงาน V3
// ==========================================
// เพิ่มจาก V2:
//   ✅ แสดง FP (Browser Fingerprint) ในตาราง
//   ✅ Tab "FP เปลี่ยนกลางคัน"     - ตรวจจับการสลับเครื่อง
//   ✅ Tab "FP ซ้ำ"                - หลายคนใช้เครื่องเดียวกัน
//   ✅ FP-aware ในการค้นหา / Export / สรุปต่อพนักงาน
//
// 📌 ใช้ column `fingerprint` ใน table user_ip_logs
//    (ดูคำสั่ง SQL ใน README ที่ส่งมาคู่กัน)
// ==========================================

let globalIpLogs = [];
let currentIpFilterUser = 'all';
let currentIpTab = 'all';

// 📄 ระบบแบ่งหน้า (pagination) — ทุกแท็บ
const IP_PAGE_SIZE = 30;
let ipPages = {
    all: 1, changes: 1, fp_changes: 1,
    duplicates: 1, fp_duplicates: 1, by_user: 1,
    risk: 1, vpn: 1, overlap: 1, tzmismatch: 1
};
// backward compat
Object.defineProperty(window, 'ipCurrentPage', {
    get: () => ipPages[currentIpTab] || 1,
    set: (v) => { ipPages[currentIpTab] = v; }
});

// ==========================================
// 🚀 เริ่มต้นเมื่อเข้าหน้านี้
// ==========================================
window.initIpCheckApp = async function() {
    if (!currentUser) return;

    // 🔒 จำกัดเฉพาะ admin/manager หรือคนที่มีสิทธิ์ ip_view เท่านั้น
    const canView = (currentUser.role === 'manager' || currentUser.role === 'admin')
                 || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('ip_view'));
    
    if (!canView) {
        const grid = document.getElementById('ipLogsContainer');
        if (grid) grid.innerHTML = `
            <div class="col-span-full text-center py-20 text-gray-400">
                <span class="material-icons text-6xl mb-2 opacity-20">block</span>
                <p class="font-bold">คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้</p>
            </div>`;
        return;
    }

    await fetchIpLogs();
    populateIpUserFilter();
};

// ==========================================
// 📥 ดึงข้อมูล IP จาก Supabase
// ==========================================
async function fetchIpLogs() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full text-center py-10">
            <span class="material-icons animate-spin text-sky-500 text-4xl">sync</span>
            <p class="text-gray-400 mt-2 font-bold">กำลังโหลดข้อมูล IP & FP...</p>
        </div>`;

    try {
        const { data, error } = await appDB.from('user_ip_logs')
            .select('*')
            .order('login_time', { ascending: false })
            .limit(1000);

        if (error) throw error;
        globalIpLogs = data || [];
        renderIpView();
        updateIpSummary();
        renderLiveAlerts();
    } catch (err) {
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-10 font-bold">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
    }
}

// ==========================================
// 📋 ใส่รายชื่อพนักงานลง Dropdown filter
// ==========================================
function populateIpUserFilter() {
    const select = document.getElementById('ipUserFilter');
    if (!select || !window.GLOBAL_USER_LIST) return;
    
    const oldVal = select.value;
    select.innerHTML = `<option value="all">-- ดูทั้งหมด --</option>`;
    
    window.GLOBAL_USER_LIST
        .filter(u => u && u.username)
        .sort((a, b) => String(a.username).localeCompare(String(b.username)))
        .forEach(u => {
            select.innerHTML += `<option value="${u.id}">${u.username}</option>`;
        });
    
    if (oldVal) select.value = oldVal;
}

// ==========================================
// 🎯 เปลี่ยน Tab
// ==========================================
window.switchIpTab = function(tab) {
    currentIpTab = tab;
    ipPages[tab] = 1; // รีเซ็ตกลับหน้าแรกเมื่อเปลี่ยนแท็บ

    document.querySelectorAll('.ip-tab-btn').forEach(b => {
        b.classList.remove('bg-sky-600', 'bg-rose-600', 'bg-fuchsia-600', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-600', 'text-white');
        b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
    });
    const activeBtn = document.getElementById('ipTab_' + tab);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
        // 🌟 สีของแต่ละ Tab
        const colorMap = {
            all:           'bg-sky-600',
            changes:       'bg-rose-600',
            fp_changes:    'bg-fuchsia-600',
            duplicates:    'bg-amber-500',
            fp_duplicates: 'bg-orange-500',
            by_user:       'bg-emerald-600',
            risk:          'bg-slate-700',
            vpn:           'bg-purple-600',
            travel:        'bg-red-600',
            heatmap:       'bg-blue-600',
            timeline:      'bg-indigo-600',
            overlap:       'bg-rose-600',
            tzmismatch:    'bg-cyan-600'
        };
        activeBtn.classList.add(colorMap[tab] || 'bg-sky-600', 'text-white');
    }

    renderIpView();
};

window.filterIpLogs = function() {
    const sel = document.getElementById('ipUserFilter');
    currentIpFilterUser = sel ? sel.value : 'all';
    ipCurrentPage = 1; // รีเซ็ตกลับหน้าแรกเมื่อกรอง
    renderIpView();
};

// ==========================================
// 🎨 วาดข้อมูลตาม Tab ที่เลือก
// ==========================================
function renderIpView() {
    if      (currentIpTab === 'changes')      renderIpChanges();
    else if (currentIpTab === 'fp_changes')   renderFpChanges();
    else if (currentIpTab === 'duplicates')   renderDuplicateIps();
    else if (currentIpTab === 'fp_duplicates')renderDuplicateFps();
    else if (currentIpTab === 'by_user')      renderByUser();
    else if (currentIpTab === 'risk')         renderRiskBoard();
    else if (currentIpTab === 'vpn')          renderVpnDetector();
    else if (currentIpTab === 'travel')       renderImpossibleTravel();
    else if (currentIpTab === 'heatmap')      renderLoginHeatmap();
    else if (currentIpTab === 'timeline')     renderUserTimeline();
    else if (currentIpTab === 'overlap')      renderSessionOverlap();
    else if (currentIpTab === 'tzmismatch')   renderTzMismatch();
    else                                      renderAllLogs();
}

// ==========================================
// 🏷️ Helper: Badge สำหรับ event_type
// ==========================================
function eventBadge(type) {
    if (type === 'ip_change') {
        return `<span class="inline-flex items-center gap-1 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    <span class="material-icons text-[12px]">swap_horiz</span> เปลี่ยน IP
                </span>`;
    }
    if (type === 'fp_change') {
        return `<span class="inline-flex items-center gap-1 bg-fuchsia-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    <span class="material-icons text-[12px]">devices</span> เปลี่ยนเครื่อง
                </span>`;
    }
    return `<span class="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                <span class="material-icons text-[12px]">login</span> Login
            </span>`;
}

// ==========================================
// 🔤 Helper: ตัด FP ให้สั้นลง (8 ตัวแรก)
// ==========================================
function shortFp(fp) {
    if (!fp) return '-';
    return String(fp).substring(0, 8);
}

// ==========================================
// 📜 Tab 1: ประวัติทั้งหมด
// ==========================================
function renderAllLogs() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    let logs = globalIpLogs;
    
    // กรองตามการค้นหา (รวม fingerprint ด้วย)
    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (term) {
        logs = logs.filter(l =>
            (l.username || '').toLowerCase().includes(term) ||
            (l.ip_address || '').toLowerCase().includes(term) ||
            (l.country || '').toLowerCase().includes(term) ||
            (l.city || '').toLowerCase().includes(term) ||
            (l.fingerprint || '').toLowerCase().includes(term)
        );
    }

    if (currentIpFilterUser !== 'all') {
        logs = logs.filter(l => String(l.user_id) === String(currentIpFilterUser));
    }

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-gray-400">
                <span class="material-icons text-6xl mb-2 opacity-20">wifi_off</span>
                <p class="font-bold">ยังไม่มีข้อมูล IP</p>
            </div>`;
        return;
    }

    // Map ของ IP -> จำนวนคนที่ใช้ IP นั้น
    const ipUserMap = {};
    // Map ของ FP -> จำนวนคนที่ใช้ FP นั้น
    const fpUserMap = {};
    globalIpLogs.forEach(l => {
        if (l.ip_address) {
            if (!ipUserMap[l.ip_address]) ipUserMap[l.ip_address] = new Set();
            ipUserMap[l.ip_address].add(l.user_id);
        }
        if (l.fingerprint) {
            if (!fpUserMap[l.fingerprint]) fpUserMap[l.fingerprint] = new Set();
            fpUserMap[l.fingerprint].add(l.user_id);
        }
    });

    // 📄 แบ่งหน้า: คำนวณจำนวนหน้า + ตัดข้อมูลเฉพาะหน้าปัจจุบัน
    const totalPages = Math.max(1, Math.ceil(logs.length / IP_PAGE_SIZE));
    if (ipCurrentPage > totalPages) ipCurrentPage = totalPages;
    if (ipCurrentPage < 1) ipCurrentPage = 1;
    const startIdx = (ipCurrentPage - 1) * IP_PAGE_SIZE;
    const pagedLogs = logs.slice(startIdx, startIdx + IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full overflow-x-auto rounded-xl shadow-md">
            <table class="min-w-full bg-white dark:bg-slate-800 text-sm">
                <thead class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    <tr>
                        <th class="px-3 py-2 text-left">เวลา</th>
                        <th class="px-3 py-2 text-left">ประเภท</th>
                        <th class="px-3 py-2 text-left">พนักงาน</th>
                        <th class="px-3 py-2 text-left">IP Address</th>
                        <th class="px-3 py-2 text-left">FP (อุปกรณ์)</th>
                        <th class="px-3 py-2 text-left">ประเทศ / เมือง</th>
                        <th class="px-3 py-2 text-left">ISP</th>
                        <th class="px-3 py-2 text-left">อุปกรณ์</th>
                        <th class="px-3 py-2 text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagedLogs.map(l => {
                        const sharedIpCount = (ipUserMap[l.ip_address] || new Set()).size;
                        const sharedFpCount = (fpUserMap[l.fingerprint] || new Set()).size;
                        const isSharedIp = sharedIpCount > 1;
                        const isSharedFp = sharedFpCount > 1;
                        const isIpChange = l.event_type === 'ip_change';
                        const isFpChange = l.event_type === 'fp_change';
                        const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';
                        const device = parseUserAgent(l.user_agent || '');
                        // 🌟 ลำดับสีพื้นหลัง (FP เปลี่ยน > IP เปลี่ยน > FP ซ้ำ > IP ซ้ำ)
                        let rowClass = '';
                        if (isFpChange) rowClass = 'bg-fuchsia-50 dark:bg-fuchsia-900/20';
                        else if (isIpChange) rowClass = 'bg-rose-50 dark:bg-rose-900/20';
                        else if (isSharedFp) rowClass = 'bg-orange-50 dark:bg-orange-900/20';
                        else if (isSharedIp) rowClass = 'bg-amber-50 dark:bg-amber-900/20';
                        return `
                            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${rowClass}">
                                <td class="px-3 py-2 text-xs">${time}</td>
                                <td class="px-3 py-2">${eventBadge(l.event_type)}</td>
                                <td class="px-3 py-2 font-bold text-slate-800 dark:text-white">${l.username || '-'}</td>
                                <td class="px-3 py-2">
                                    <span class="font-mono text-xs ${isSharedIp ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'}">${l.ip_address || '-'}</span>
                                    ${isSharedIp ? `<span class="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">⚠ ${sharedIpCount} คน</span>` : ''}
                                </td>
                                <td class="px-3 py-2">
                                    ${l.fingerprint ? `
                                        <span class="font-mono text-xs ${isSharedFp ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-indigo-600 dark:text-indigo-300'}" title="${l.fingerprint}">${shortFp(l.fingerprint)}</span>
                                        ${isSharedFp ? `<span class="ml-1 text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">⚠ ${sharedFpCount} คน</span>` : ''}
                                    ` : '<span class="text-gray-400 text-xs">-</span>'}
                                </td>
                                <td class="px-3 py-2 text-xs">${l.country || '-'} / ${l.city || '-'}</td>
                                <td class="px-3 py-2 text-xs text-gray-500">${l.isp || '-'}</td>
                                <td class="px-3 py-2 text-xs text-gray-500">${device}</td>
                                <td class="px-3 py-2 text-center">
                                    <button onclick="deleteIpLog(${l.id})" class="text-red-400 hover:text-red-600" title="ลบ">
                                        <span class="material-icons text-base">delete</span>
                                    </button>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${totalPages > 1 ? renderIpPagination(totalPages, logs.length) : ''}`;
}

// ==========================================
// 📄 แถบปุ่มเลื่อนหน้า 1 2 3 4 ...
// ==========================================
function renderIpPagination(totalPages, totalItems, tabKey) {
    tabKey = tabKey || currentIpTab;
    const cur = ipPages[tabKey] || 1;
    let pages = [];

    // แสดงหน้าแบบ: 1 ... (cur-1) cur (cur+1) ... last
    const addPage = (p) => {
        const active = p === cur;
        pages.push(`<button onclick="gotoIpPage(${p},'${tabKey}')" class="min-w-[36px] h-9 px-2 rounded-lg text-sm font-bold transition ${active ? 'bg-sky-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-600'}">${p}</button>`);
    };
    const addDots = () => pages.push(`<span class="px-1 text-gray-400">...</span>`);

    if (totalPages <= 7) {
        for (let p = 1; p <= totalPages; p++) addPage(p);
    } else {
        addPage(1);
        if (cur > 3) addDots();
        const from = Math.max(2, cur - 1);
        const to = Math.min(totalPages - 1, cur + 1);
        for (let p = from; p <= to; p++) addPage(p);
        if (cur < totalPages - 2) addDots();
        addPage(totalPages);
    }

    const prevDisabled = cur <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sky-50 dark:hover:bg-slate-600';
    const nextDisabled = cur >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sky-50 dark:hover:bg-slate-600';

    return `
        <div class="col-span-full flex items-center justify-between flex-wrap gap-3 mt-2 px-1">
            <div class="text-xs text-gray-500 dark:text-gray-400 font-bold">
                หน้า ${cur} / ${totalPages} (ทั้งหมด ${totalItems} รายการ)
            </div>
            <div class="flex items-center gap-1">
                <button onclick="gotoIpPage(${cur - 1},'${tabKey}')" ${cur <= 1 ? 'disabled' : ''} class="h-9 px-3 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 transition ${prevDisabled} flex items-center gap-1">
                    <span class="material-icons text-base">chevron_left</span> ก่อนหน้า
                </button>
                ${pages.join('')}
                <button onclick="gotoIpPage(${cur + 1},'${tabKey}')" ${cur >= totalPages ? 'disabled' : ''} class="h-9 px-3 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-gray-200 dark:border-slate-600 transition ${nextDisabled} flex items-center gap-1">
                    ถัดไป <span class="material-icons text-base">chevron_right</span>
                </button>
            </div>
        </div>`;
}

window.gotoIpPage = function(page, tabKey) {
    tabKey = tabKey || currentIpTab;
    ipPages[tabKey] = page;
    renderIpView();
    // เลื่อนขึ้นบนสุดของตาราง
    const container = document.getElementById('ipLogsContainer');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ==========================================