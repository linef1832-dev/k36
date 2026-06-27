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
    risk: 1, vpn: 1
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
            timeline:      'bg-indigo-600'
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
// 🚨 Tab 2: IP เปลี่ยนกลางคัน
// ==========================================
function renderIpChanges() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    let changes = globalIpLogs.filter(l => l.event_type === 'ip_change');

    if (currentIpFilterUser !== 'all') {
        changes = changes.filter(l => String(l.user_id) === String(currentIpFilterUser));
    }

    // search filter
    const _term1 = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (_term1) {
        changes = changes.filter(l =>
            (l.username || '').toLowerCase().includes(_term1) ||
            (l.ip_address || '').toLowerCase().includes(_term1) ||
            (l.fingerprint || '').toLowerCase().includes(_term1) ||
            (l.country || '').toLowerCase().includes(_term1)
        );
    }

    if (changes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
                <span class="material-icons text-6xl mb-2">verified</span>
                <p class="font-bold">ไม่พบการเปลี่ยน IP กลางคัน 🎉</p>
                <p class="text-xs text-gray-400 mt-1">พนักงานทุกคนใช้งานจาก IP เดียวตลอดทั้ง Session</p>
            </div>`;
        return;
    }

    // 🌟 หา IP ก่อนหน้าของการเปลี่ยนแต่ละครั้ง
    const userLogs = {};
    globalIpLogs.forEach(l => {
        if (!userLogs[l.user_id]) userLogs[l.user_id] = [];
        userLogs[l.user_id].push(l);
    });
    Object.values(userLogs).forEach(arr => arr.sort((a, b) => new Date(a.login_time) - new Date(b.login_time)));

    const _tc1 = Math.max(1, Math.ceil(changes.length / IP_PAGE_SIZE));
    const _p1 = Math.min(Math.max(1, ipPages.changes), _tc1);
    ipPages.changes = _p1;
    const _pagedChanges = changes.slice((_p1-1)*IP_PAGE_SIZE, _p1*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500 p-4 rounded-lg">
            <div class="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                <span class="material-icons">warning</span>
                <span>พบการเปลี่ยน IP กลางคัน ${changes.length} ครั้ง</span>
            </div>
            <p class="text-xs text-rose-600 dark:text-rose-400 mt-1">
                การเปลี่ยน IP โดยไม่ Login ใหม่ มักเกิดจาก: 🔸 เปิด/ปิด VPN  🔸 สลับเครือข่าย WiFi-Mobile  🔸 ใช้ Proxy
            </p>
        </div>
        ${_pagedChanges.map(l => {
            const userArr = userLogs[l.user_id] || [];
            const idx = userArr.findIndex(x => x.id === l.id);
            const prevLog = idx > 0 ? userArr.slice(0, idx).reverse().find(x => x.ip_address && x.ip_address !== l.ip_address) : null;
            const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';

            return `
                <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 border-rose-500">
                    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div class="flex items-center gap-3">
                            <span class="material-icons text-rose-500 text-3xl">swap_horiz</span>
                            <div>
                                <div class="font-bold text-lg text-slate-800 dark:text-white">${l.username || '-'}</div>
                                <div class="text-xs text-gray-500">${time}</div>
                            </div>
                        </div>
                        <span class="bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-bold">⚠ เปลี่ยน IP โดยไม่ Logout</span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        ${prevLog ? `
                        <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div class="text-[10px] font-bold text-gray-500 uppercase">IP เดิม</div>
                            <div class="font-mono font-bold text-slate-800 dark:text-white">${prevLog.ip_address}</div>
                            <div class="text-xs text-gray-500 mt-1">${prevLog.country || '-'} • ${prevLog.city || '-'}</div>
                            <div class="text-xs text-gray-500">${prevLog.isp || '-'}</div>
                        </div>
                        <div class="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-700">
                            <div class="text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase">IP ใหม่ 🆕</div>
                            <div class="font-mono font-bold text-rose-700 dark:text-rose-200">${l.ip_address}</div>
                            <div class="text-xs text-rose-600 dark:text-rose-300 mt-1">${l.country || '-'} • ${l.city || '-'}</div>
                            <div class="text-xs text-rose-600 dark:text-rose-300">${l.isp || '-'}</div>
                        </div>
                        ` : `
                        <div class="md:col-span-2 p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-700">
                            <div class="text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase">IP ใหม่ 🆕</div>
                            <div class="font-mono font-bold text-rose-700 dark:text-rose-200">${l.ip_address}</div>
                            <div class="text-xs text-rose-600 dark:text-rose-300 mt-1">${l.country || '-'} • ${l.city || '-'} • ${l.isp || '-'}</div>
                        </div>
                        `}
                    </div>
                </div>`;
        }).join('')}
        ${_tc1 > 1 ? renderIpPagination(_tc1, changes.length, 'changes') : ''}
    `;
}

// ==========================================
// 🚨 Tab 3: FP เปลี่ยนกลางคัน (ใหม่!) - สลับเครื่อง
// ==========================================
function renderFpChanges() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    let changes = globalIpLogs.filter(l => l.event_type === 'fp_change');

    if (currentIpFilterUser !== 'all') {
        changes = changes.filter(l => String(l.user_id) === String(currentIpFilterUser));
    }

    // search filter
    const _term2 = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (_term2) {
        changes = changes.filter(l =>
            (l.username || '').toLowerCase().includes(_term2) ||
            (l.ip_address || '').toLowerCase().includes(_term2) ||
            (l.fingerprint || '').toLowerCase().includes(_term2) ||
            (l.country || '').toLowerCase().includes(_term2)
        );
    }

    if (changes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
                <span class="material-icons text-6xl mb-2">verified</span>
                <p class="font-bold">ไม่พบการสลับเครื่อง 🎉</p>
                <p class="text-xs text-gray-400 mt-1">พนักงานทุกคนใช้งานจากเครื่องเดียวตลอดทั้ง Session</p>
            </div>`;
        return;
    }

    // หา FP ก่อนหน้าของแต่ละการเปลี่ยน
    const userLogs = {};
    globalIpLogs.forEach(l => {
        if (!userLogs[l.user_id]) userLogs[l.user_id] = [];
        userLogs[l.user_id].push(l);
    });
    Object.values(userLogs).forEach(arr => arr.sort((a, b) => new Date(a.login_time) - new Date(b.login_time)));

    const _tc2 = Math.max(1, Math.ceil(changes.length / IP_PAGE_SIZE));
    const _p2 = Math.min(Math.max(1, ipPages.fp_changes), _tc2);
    ipPages.fp_changes = _p2;
    const _pagedFpChanges = changes.slice((_p2-1)*IP_PAGE_SIZE, _p2*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 bg-fuchsia-50 dark:bg-fuchsia-900/20 border-l-4 border-fuchsia-500 p-4 rounded-lg">
            <div class="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-300 font-bold">
                <span class="material-icons">devices</span>
                <span>พบการสลับเครื่องกลางคัน ${changes.length} ครั้ง</span>
            </div>
            <p class="text-xs text-fuchsia-600 dark:text-fuchsia-400 mt-1">
                FP (Browser Fingerprint) เปลี่ยนโดยไม่ Login ใหม่ = สลับอุปกรณ์ / browser มักเกิดจาก:
                🔸 ส่งบัญชีให้คนอื่นใช้  🔸 แชร์ Session  🔸 เปลี่ยน browser/incognito
            </p>
        </div>
        ${_pagedFpChanges.map(l => {
            const userArr = userLogs[l.user_id] || [];
            const idx = userArr.findIndex(x => x.id === l.id);
            const prevLog = idx > 0 ? userArr.slice(0, idx).reverse().find(x => x.fingerprint && x.fingerprint !== l.fingerprint) : null;
            const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';
            const device = parseUserAgent(l.user_agent || '');
            const prevDevice = prevLog ? parseUserAgent(prevLog.user_agent || '') : '';

            return `
                <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 border-fuchsia-500">
                    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div class="flex items-center gap-3">
                            <span class="material-icons text-fuchsia-500 text-3xl">devices</span>
                            <div>
                                <div class="font-bold text-lg text-slate-800 dark:text-white">${l.username || '-'}</div>
                                <div class="text-xs text-gray-500">${time}</div>
                            </div>
                        </div>
                        <span class="bg-fuchsia-500 text-white px-3 py-1 rounded-full text-xs font-bold">🚨 สลับเครื่องโดยไม่ Logout</span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        ${prevLog ? `
                        <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div class="text-[10px] font-bold text-gray-500 uppercase">เครื่องเดิม</div>
                            <div class="font-mono font-bold text-slate-800 dark:text-white" title="${prevLog.fingerprint}">${shortFp(prevLog.fingerprint)}</div>
                            <div class="text-xs text-gray-500 mt-1">${prevDevice}</div>
                            <div class="text-xs text-gray-500">IP: ${prevLog.ip_address || '-'}</div>
                        </div>
                        <div class="p-3 bg-fuchsia-50 dark:bg-fuchsia-900/30 rounded-lg border border-fuchsia-200 dark:border-fuchsia-700">
                            <div class="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-300 uppercase">เครื่องใหม่ 🆕</div>
                            <div class="font-mono font-bold text-fuchsia-700 dark:text-fuchsia-200" title="${l.fingerprint}">${shortFp(l.fingerprint)}</div>
                            <div class="text-xs text-fuchsia-600 dark:text-fuchsia-300 mt-1">${device}</div>
                            <div class="text-xs text-fuchsia-600 dark:text-fuchsia-300">IP: ${l.ip_address || '-'}</div>
                        </div>
                        ` : `
                        <div class="md:col-span-2 p-3 bg-fuchsia-50 dark:bg-fuchsia-900/30 rounded-lg border border-fuchsia-200 dark:border-fuchsia-700">
                            <div class="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-300 uppercase">เครื่องใหม่ 🆕</div>
                            <div class="font-mono font-bold text-fuchsia-700 dark:text-fuchsia-200" title="${l.fingerprint}">${shortFp(l.fingerprint)}</div>
                            <div class="text-xs text-fuchsia-600 dark:text-fuchsia-300 mt-1">${device} • IP: ${l.ip_address || '-'}</div>
                        </div>
                        `}
                    </div>
                </div>`;
        }).join('')}
        ${_tc2 > 1 ? renderIpPagination(_tc2, changes.length, 'fp_changes') : ''}
    `;
}

// ==========================================
// ⚠️ Tab 4: IP ซ้ำ
// ==========================================
function renderDuplicateIps() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const ipMap = {};
    globalIpLogs.forEach(l => {
        if (!l.ip_address || l.ip_address === 'unknown') return;
        if (!ipMap[l.ip_address]) ipMap[l.ip_address] = { ip: l.ip_address, users: {}, lastSeen: l.login_time, country: l.country, city: l.city, isp: l.isp };
        if (!ipMap[l.ip_address].users[l.user_id]) {
            ipMap[l.ip_address].users[l.user_id] = { username: l.username, count: 0, lastTime: l.login_time };
        }
        ipMap[l.ip_address].users[l.user_id].count++;
        if (l.login_time > ipMap[l.ip_address].users[l.user_id].lastTime) {
            ipMap[l.ip_address].users[l.user_id].lastTime = l.login_time;
        }
    });

    let duplicates = Object.values(ipMap).filter(g => Object.keys(g.users).length >= 2);
    duplicates.sort((a, b) => Object.keys(b.users).length - Object.keys(a.users).length);

    // search filter
    const _term3 = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (_term3) {
        duplicates = duplicates.filter(g =>
            g.ip.toLowerCase().includes(_term3) ||
            (g.country || '').toLowerCase().includes(_term3) ||
            (g.isp || '').toLowerCase().includes(_term3) ||
            Object.values(g.users).some(u => (u.username || '').toLowerCase().includes(_term3))
        );
    }

    if (duplicates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
                <span class="material-icons text-6xl mb-2">verified</span>
                <p class="font-bold">ไม่พบ IP ที่ซ้ำซ้อนระหว่างพนักงาน 🎉</p>
                <p class="text-xs text-gray-400 mt-1">พนักงานทุกคน Login จาก IP ของตัวเอง</p>
            </div>`;
        return;
    }

    const _tc3 = Math.max(1, Math.ceil(duplicates.length / IP_PAGE_SIZE));
    const _p3 = Math.min(Math.max(1, ipPages.duplicates), _tc3);
    ipPages.duplicates = _p3;
    const _pagedDupIps = duplicates.slice((_p3-1)*IP_PAGE_SIZE, _p3*IP_PAGE_SIZE);

    container.innerHTML = _pagedDupIps.map(g => {
        const userCount = Object.keys(g.users).length;
        const userList = Object.values(g.users)
            .sort((a, b) => b.count - a.count)
            .map(u => `
                <div class="flex justify-between items-center px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-800 dark:text-white">${u.username}</span>
                        <span class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastTime).toLocaleString('th-TH')}</span>
                    </div>
                    <span class="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-bold px-2 py-1 rounded-full">${u.count} ครั้ง</span>
                </div>`).join('');

        return `
            <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 border-amber-500">
                <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div class="flex items-center gap-3">
                        <span class="material-icons text-amber-500 text-3xl">warning</span>
                        <div>
                            <div class="font-mono font-bold text-lg text-slate-800 dark:text-white">${g.ip}</div>
                            <div class="text-xs text-gray-500">${g.country || '-'} • ${g.city || '-'} • ${g.isp || '-'}</div>
                        </div>
                    </div>
                    <span class="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold">⚠ ใช้ร่วม ${userCount} คน</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    ${userList}
                </div>
            </div>`;
    }).join('') + (_tc3 > 1 ? renderIpPagination(_tc3, duplicates.length, 'duplicates') : '');
}

// ==========================================
// ⚠️ Tab 5: FP ซ้ำ (ใหม่!) - หลายคนใช้เครื่องเดียวกัน
// ==========================================
function renderDuplicateFps() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const fpMap = {};
    globalIpLogs.forEach(l => {
        if (!l.fingerprint) return;
        if (!fpMap[l.fingerprint]) {
            fpMap[l.fingerprint] = {
                fp: l.fingerprint,
                users: {},
                lastSeen: l.login_time,
                user_agent: l.user_agent
            };
        }
        if (!fpMap[l.fingerprint].users[l.user_id]) {
            fpMap[l.fingerprint].users[l.user_id] = {
                username: l.username,
                count: 0,
                lastTime: l.login_time,
                ip_address: l.ip_address
            };
        }
        fpMap[l.fingerprint].users[l.user_id].count++;
        if (l.login_time > fpMap[l.fingerprint].users[l.user_id].lastTime) {
            fpMap[l.fingerprint].users[l.user_id].lastTime = l.login_time;
            fpMap[l.fingerprint].users[l.user_id].ip_address = l.ip_address;
        }
    });

    let duplicates = Object.values(fpMap).filter(g => Object.keys(g.users).length >= 2);
    duplicates.sort((a, b) => Object.keys(b.users).length - Object.keys(a.users).length);

    // search filter
    const _term4 = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (_term4) {
        duplicates = duplicates.filter(g =>
            g.fp.toLowerCase().includes(_term4) ||
            Object.values(g.users).some(u => (u.username || '').toLowerCase().includes(_term4))
        );
    }

    if (duplicates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
                <span class="material-icons text-6xl mb-2">verified</span>
                <p class="font-bold">ไม่พบเครื่อง (FP) ที่ใช้ร่วมกัน 🎉</p>
                <p class="text-xs text-gray-400 mt-1">พนักงานทุกคนใช้เครื่องของตัวเองในการ Login</p>
            </div>`;
        return;
    }

    const _tc4 = Math.max(1, Math.ceil(duplicates.length / IP_PAGE_SIZE));
    const _p4 = Math.min(Math.max(1, ipPages.fp_duplicates), _tc4);
    ipPages.fp_duplicates = _p4;
    const _pagedDupFps = duplicates.slice((_p4-1)*IP_PAGE_SIZE, _p4*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-lg">
            <div class="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-bold">
                <span class="material-icons">device_hub</span>
                <span>พบ ${duplicates.length} เครื่อง (FP) ที่หลายคนใช้ร่วมกัน</span>
            </div>
            <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                เครื่องเดียวกันถูกใช้ Login หลายบัญชี = น่าสงสัยว่าแชร์บัญชีกัน
                (FP ซ้ำมีน้ำหนักกว่า IP ซ้ำมาก เพราะ IP ซ้ำได้จากการอยู่บ้าน/ออฟฟิศเดียวกัน)
            </p>
        </div>
        ${_pagedDupFps.map(g => {
            const userCount = Object.keys(g.users).length;
            const device = parseUserAgent(g.user_agent || '');
            const userList = Object.values(g.users)
                .sort((a, b) => b.count - a.count)
                .map(u => `
                    <div class="flex justify-between items-center px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-800 dark:text-white">${u.username}</span>
                            <span class="text-[10px] text-gray-500">IP: ${u.ip_address || '-'}</span>
                            <span class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastTime).toLocaleString('th-TH')}</span>
                        </div>
                        <span class="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">${u.count} ครั้ง</span>
                    </div>`).join('');

            return `
                <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 border-orange-500">
                    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div class="flex items-center gap-3">
                            <span class="material-icons text-orange-500 text-3xl">device_hub</span>
                            <div>
                                <div class="font-mono font-bold text-lg text-slate-800 dark:text-white" title="${g.fp}">FP: ${shortFp(g.fp)}</div>
                                <div class="text-xs text-gray-500">${device}</div>
                            </div>
                        </div>
                        <span class="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">🚨 ใช้ร่วม ${userCount} คน</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        ${userList}
                    </div>
                </div>`;
        }).join('')}
        ${_tc4 > 1 ? renderIpPagination(_tc4, fpDuplicates.length, 'fp_duplicates') : ''}
    `;
}

// ==========================================
// 👤 Tab 6: สรุปจำนวน IP/FP ต่อพนักงาน
// ==========================================
function renderByUser() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const userMap = {};
    globalIpLogs.forEach(l => {
        if (!l.user_id) return;
        if (!userMap[l.user_id]) {
            userMap[l.user_id] = {
                user_id: l.user_id,
                username: l.username,
                ips: {},
                fps: {},
                totalLogins: 0,
                ipChanges: 0,
                fpChanges: 0,
                lastSeen: l.login_time
            };
        }
        if (l.ip_address) {
            if (!userMap[l.user_id].ips[l.ip_address]) {
                userMap[l.user_id].ips[l.ip_address] = { ip: l.ip_address, count: 0, country: l.country, city: l.city };
            }
            userMap[l.user_id].ips[l.ip_address].count++;
        }
        if (l.fingerprint) {
            if (!userMap[l.user_id].fps[l.fingerprint]) {
                userMap[l.user_id].fps[l.fingerprint] = { fp: l.fingerprint, count: 0, ua: l.user_agent };
            }
            userMap[l.user_id].fps[l.fingerprint].count++;
        }
        userMap[l.user_id].totalLogins++;
        if (l.event_type === 'ip_change') userMap[l.user_id].ipChanges++;
        if (l.event_type === 'fp_change') userMap[l.user_id].fpChanges++;
        if (l.login_time > userMap[l.user_id].lastSeen) userMap[l.user_id].lastSeen = l.login_time;
    });

    // 🌟 เรียงตามจำนวน FP มาก → น้อย (FP เยอะ = น่าสงสัยมาก)
    let users = Object.values(userMap).sort((a, b) => {
        const fpDiff = Object.keys(b.fps).length - Object.keys(a.fps).length;
        if (fpDiff !== 0) return fpDiff;
        return Object.keys(b.ips).length - Object.keys(a.ips).length;
    });

    // search filter
    const _term5 = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (_term5) {
        users = users.filter(u =>
            (u.username || '').toLowerCase().includes(_term5) ||
            Object.keys(u.ips).some(ip => ip.toLowerCase().includes(_term5))
        );
    }

    if (users.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400">ยังไม่มีข้อมูล</div>`;
        return;
    }

    const _tc5 = Math.max(1, Math.ceil(users.length / IP_PAGE_SIZE));
    const _p5 = Math.min(Math.max(1, ipPages.by_user), _tc5);
    ipPages.by_user = _p5;
    const _pagedUsers = users.slice((_p5-1)*IP_PAGE_SIZE, _p5*IP_PAGE_SIZE);

    container.innerHTML = _pagedUsers.map(u => {
        const ipCount = Object.keys(u.ips).length;
        const fpCount = Object.keys(u.fps).length;
        // 🚨 ระดับความน่าสงสัย: FP ≥ 2 = น่าสงสัยมาก, IP ≥ 3 = น่าสงสัยพอควร
        const isHighRisk = fpCount >= 2;
        const isMediumRisk = !isHighRisk && ipCount >= 3;
        const borderColor = isHighRisk ? 'border-fuchsia-500' : (isMediumRisk ? 'border-rose-500' : 'border-emerald-500');
        const accentColor = isHighRisk ? 'text-fuchsia-500' : (isMediumRisk ? 'text-rose-500' : 'text-emerald-500');

        const ipList = Object.values(u.ips).sort((a, b) => b.count - a.count).map(ip => `
            <div class="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-700/50 rounded text-xs">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-slate-700 dark:text-slate-200">${ip.ip}</span>
                    <span class="text-gray-400">(${ip.country || '-'}, ${ip.city || '-'})</span>
                </div>
                <span class="text-sky-600 dark:text-sky-400 font-bold">${ip.count} ครั้ง</span>
            </div>`).join('');

        const fpList = Object.values(u.fps).sort((a, b) => b.count - a.count).map(fp => {
            const dev = parseUserAgent(fp.ua || '');
            return `
            <div class="flex items-center justify-between px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded text-xs">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-indigo-700 dark:text-indigo-300" title="${fp.fp}">${shortFp(fp.fp)}</span>
                    <span class="text-gray-400">(${dev})</span>
                </div>
                <span class="text-indigo-600 dark:text-indigo-400 font-bold">${fp.count} ครั้ง</span>
            </div>`;
        }).join('');

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 ${borderColor}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="material-icons ${accentColor}">person</span>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-white">${u.username}</div>
                            <div class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastSeen).toLocaleString('th-TH')}</div>
                        </div>
                    </div>
                    <div class="flex gap-3 text-right">
                        <div>
                            <div class="text-2xl font-black text-sky-500">${ipCount}</div>
                            <div class="text-[10px] text-gray-400">IP</div>
                        </div>
                        <div>
                            <div class="text-2xl font-black ${isHighRisk ? 'text-fuchsia-500' : 'text-indigo-500'}">${fpCount}</div>
                            <div class="text-[10px] text-gray-400">FP</div>
                        </div>
                    </div>
                </div>
                
                ${ipList ? `
                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">📡 IP ที่ใช้</div>
                    <div class="space-y-1 max-h-32 overflow-y-auto mb-2">${ipList}</div>
                ` : ''}
                
                ${fpList ? `
                    <div class="text-[10px] font-bold text-indigo-500 uppercase mb-1">🖥️ เครื่อง (FP) ที่ใช้</div>
                    <div class="space-y-1 max-h-32 overflow-y-auto">${fpList}</div>
                ` : ''}
                
                <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-gray-500 flex justify-between items-center flex-wrap gap-1">
                    <span>Login รวม: <span class="font-bold text-slate-700 dark:text-slate-200">${u.totalLogins}</span> ครั้ง</span>
                    <div class="flex gap-2">
                        ${u.ipChanges > 0 ? `<span class="text-rose-500 font-bold">⚠ IP เปลี่ยน ${u.ipChanges}x</span>` : ''}
                        ${u.fpChanges > 0 ? `<span class="text-fuchsia-500 font-bold">🚨 สลับเครื่อง ${u.fpChanges}x</span>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('') + (_tc5 > 1 ? renderIpPagination(_tc5, users.length, 'by_user') : '');
}

// ==========================================
// 📊 อัปเดตการ์ดสรุปด้านบน
// ==========================================
function updateIpSummary() {
    const totalLogs = globalIpLogs.length;
    const uniqueUsers = new Set(globalIpLogs.map(l => l.user_id)).size;
    const uniqueIps   = new Set(globalIpLogs.map(l => l.ip_address).filter(x => x && x !== 'unknown')).size;
    const uniqueFps   = new Set(globalIpLogs.map(l => l.fingerprint).filter(x => x)).size;
    const ipChanges   = globalIpLogs.filter(l => l.event_type === 'ip_change').length;
    const fpChanges   = globalIpLogs.filter(l => l.event_type === 'fp_change').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('ipStatTotal',     totalLogs.toLocaleString('en-US'));
    set('ipStatUsers',     uniqueUsers.toLocaleString('en-US'));
    set('ipStatIps',       uniqueIps.toLocaleString('en-US'));
    set('ipStatFps',       uniqueFps.toLocaleString('en-US'));
    set('ipStatChanges',   ipChanges.toLocaleString('en-US'));
    set('ipStatFpChanges', fpChanges.toLocaleString('en-US'));
}

// ==========================================
// 🔧 Helper: แปลง User Agent
// ==========================================
function parseUserAgent(ua) {
    if (!ua) return '-';
    let device = 'Desktop';
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
    
    let browser = 'Other';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    
    let os = '';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'Mac';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${device} • ${browser}${os ? ' • ' + os : ''}`;
}

// ==========================================
// 🗑️ ลบ Log
// ==========================================
window.deleteIpLog = async function(id) {
    Swal.fire({
        title: 'ลบรายการนี้?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบ'
    }).then(async (r) => {
        if (r.isConfirmed) {
            await appDB.from('user_ip_logs').delete().eq('id', id);
            await fetchIpLogs();
            Swal.fire({icon: 'success', title: 'ลบแล้ว', timer: 1000, showConfirmButton: false});
        }
    });
};

// ==========================================
// 🗑️ ลบ Log เก่ากว่า X วัน
// ==========================================
window.cleanOldIpLogs = async function() {
    const { value: days } = await Swal.fire({
        title: 'ลบ Log เก่ากว่ากี่วัน?',
        input: 'number',
        inputValue: 90,
        inputLabel: 'จะลบ Log ที่เก่ากว่าจำนวนวันที่ระบุ',
        showCancelButton: true,
        confirmButtonText: 'ลบเลย',
        confirmButtonColor: '#d33'
    });
    if (!days || days < 1) return;

    Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await appDB.from('user_ip_logs').delete().lt('login_time', cutoff);
    if (error) return Swal.fire('Error', error.message, 'error');
    await fetchIpLogs();
    Swal.fire({icon: 'success', title: `ลบ Log เก่ากว่า ${days} วันแล้ว`, timer: 1500, showConfirmButton: false});
};

// ==========================================
// 📤 Export CSV (เพิ่ม FP เข้ามา)
// ==========================================
window.exportIpLogsCSV = function() {
    if (globalIpLogs.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ยังไม่มีข้อมูลให้ Export', 'info');
    
    const headers = ['เวลา', 'ประเภท', 'พนักงาน', 'IP', 'FP', 'ประเทศ', 'เมือง', 'ISP', 'User Agent'];
    const eventTypeMap = {
        'ip_change': 'เปลี่ยน IP',
        'fp_change': 'สลับเครื่อง',
        'login': 'Login'
    };
    const rows = globalIpLogs.map(l => [
        l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '',
        eventTypeMap[l.event_type] || 'Login',
        l.username || '',
        l.ip_address || '',
        l.fingerprint || '',
        l.country || '',
        l.city || '',
        l.isp || '',
        (l.user_agent || '').replace(/"/g, '""')
    ]);
    
    const csv = [headers, ...rows]
        .map(r => r.map(c => `"${c}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IP_FP_Logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};
// ==========================================
// 🛡️ ยืนยันว่าไฟล์นี้โหลดสำเร็จ (debug log)
// ==========================================
console.log('[ip_check.js] โหลดสำเร็จ — ฟังก์ชัน fetchIpLogs/switchIpTab พร้อมใช้งาน');

// ==========================================
// 🔥 ฟีเจอร์ใหม่ V5
// ==========================================

// ==========================================
// 🏆 Risk Score — คะแนนความน่าสงสัยต่อคน
// ==========================================
const VPN_ISP_KEYWORDS = [
    'vpn','proxy','hosting','datacenter','data center','digitalocean',
    'linode','vultr','hetzner','ovh','cloudflare','amazon','google cloud',
    'microsoft azure','fastly','leaseweb','choopa','as-choopa','multacom',
    'psychz','quadranet','tzulo','buyvm','frantech','m247','mullvad',
    'nordvpn','expressvpn','torguard','hidemyass','privateinternetaccess',
    'surfshark','cyberghost'
];

function calcRiskScore(u) {
    let score = 0;
    const reasons = [];
    const ipCount  = Object.keys(u.ips  || {}).length;
    const fpCount  = Object.keys(u.fps  || {}).length;
    const countries = new Set(Object.values(u.ips || {}).map(i => i.country).filter(c => c && c !== '-'));

    if (u.fpChanges > 0)  { score += u.fpChanges  * 30; reasons.push(`🔴 สลับเครื่อง ${u.fpChanges} ครั้ง`); }
    if (u.ipChanges > 0)  { score += u.ipChanges  * 15; reasons.push(`🟠 เปลี่ยน IP ${u.ipChanges} ครั้ง`); }
    if (fpCount > 1)      { score += (fpCount-1)  * 20; reasons.push(`🟠 ใช้ ${fpCount} เครื่อง`); }
    if (ipCount > 2)      { score += (ipCount-2)  * 8;  reasons.push(`🟡 ใช้ ${ipCount} IP`); }
    if (countries.size > 1){ score += countries.size * 25; reasons.push(`🔴 ${countries.size} ประเทศ: ${[...countries].join(', ')}`); }

    // VPN ISP check
    const isps = Object.values(u.ips || {}).map(i => (i.isp || '').toLowerCase());
    const vpnHits = isps.filter(isp => VPN_ISP_KEYWORDS.some(k => isp.includes(k)));
    if (vpnHits.length > 0) { score += 40; reasons.push(`🔴 ISP น่าสงสัย (VPN/Datacenter)`); }

    // ชั่วโมงผิดปกติ (ตี 1 - ตี 5)
    const oddHour = (u.allTimes || []).filter(t => {
        const h = new Date(t).getHours();
        return h >= 1 && h <= 5;
    }).length;
    if (oddHour > 0) { score += oddHour * 5; reasons.push(`🟡 Login ดึก/ตี ${oddHour} ครั้ง`); }

    let level = 'low';
    if (score >= 60) level = 'critical';
    else if (score >= 30) level = 'high';
    else if (score >= 10) level = 'medium';

    return { score, level, reasons };
}

window.renderRiskBoard = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    // สร้าง userMap
    const userMap = {};
    globalIpLogs.forEach(l => {
        if (!l.user_id) return;
        if (!userMap[l.user_id]) {
            userMap[l.user_id] = {
                user_id: l.user_id, username: l.username,
                ips: {}, fps: {}, ipChanges: 0, fpChanges: 0,
                allTimes: [], lastSeen: l.login_time
            };
        }
        const u = userMap[l.user_id];
        if (l.ip_address) u.ips[l.ip_address] = { country: l.country, isp: l.isp };
        if (l.fingerprint) u.fps[l.fingerprint] = true;
        if (l.event_type === 'ip_change') u.ipChanges++;
        if (l.event_type === 'fp_change') u.fpChanges++;
        if (l.login_time) u.allTimes.push(l.login_time);
        if (l.login_time > u.lastSeen) u.lastSeen = l.login_time;
    });

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let users = Object.values(userMap);
    if (term) users = users.filter(u => (u.username || '').toLowerCase().includes(term));

    users = users.map(u => ({ ...u, ...calcRiskScore(u) }))
                 .sort((a, b) => b.score - a.score);

    const levelColor = {
        critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500', badge: 'bg-red-500', label: '🔴 วิกฤต' },
        high:     { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-500', badge: 'bg-orange-500', label: '🟠 สูง' },
        medium:   { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-500', badge: 'bg-yellow-500', label: '🟡 กลาง' },
        low:      { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-300', badge: 'bg-slate-400', label: '🟢 ปกติ' }
    };

    const _tc = Math.max(1, Math.ceil(users.length / IP_PAGE_SIZE));
    const _p  = Math.min(Math.max(1, ipPages.risk || 1), _tc);
    ipPages.risk = _p;
    const paged = users.slice((_p-1)*IP_PAGE_SIZE, _p*IP_PAGE_SIZE);

    const suspicious = users.filter(u => u.level !== 'low').length;

    container.innerHTML = `
        <div class="col-span-full mb-3 p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-white flex items-center justify-between flex-wrap gap-3">
            <div>
                <div class="font-black text-lg">🏆 Risk Score Board</div>
                <div class="text-xs opacity-75">คำนวณจาก: FP เปลี่ยน × 30 | IP เปลี่ยน × 15 | หลายเครื่อง × 20 | VPN × 40 | หลายประเทศ × 25</div>
            </div>
            <div class="flex gap-3">
                <div class="text-center"><div class="text-2xl font-black text-red-400">${users.filter(u=>u.level==='critical').length}</div><div class="text-[10px] opacity-75">วิกฤต</div></div>
                <div class="text-center"><div class="text-2xl font-black text-orange-400">${users.filter(u=>u.level==='high').length}</div><div class="text-[10px] opacity-75">สูง</div></div>
                <div class="text-center"><div class="text-2xl font-black text-yellow-400">${users.filter(u=>u.level==='medium').length}</div><div class="text-[10px] opacity-75">กลาง</div></div>
                <div class="text-center"><div class="text-2xl font-black text-green-400">${users.filter(u=>u.level==='low').length}</div><div class="text-[10px] opacity-75">ปกติ</div></div>
            </div>
        </div>
        ${paged.map((u, i) => {
            const c = levelColor[u.level];
            const rank = (_p-1)*IP_PAGE_SIZE + i + 1;
            return `
            <div class="col-span-full ${c.bg} rounded-2xl shadow p-4 border-l-4 ${c.border}">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-3">
                        <div class="text-2xl font-black text-slate-400 w-8">#${rank}</div>
                        <div>
                            <div class="font-black text-lg text-slate-800 dark:text-white">${u.username}</div>
                            <div class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastSeen).toLocaleString('th-TH')}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-3xl font-black ${u.level === 'critical' ? 'text-red-500' : u.level === 'high' ? 'text-orange-500' : u.level === 'medium' ? 'text-yellow-500' : 'text-slate-400'}">${u.score}</div>
                        <span class="${c.badge} text-white text-xs font-bold px-3 py-1 rounded-full">${c.label}</span>
                    </div>
                </div>
                ${u.reasons.length > 0 ? `
                <div class="mt-3 flex flex-wrap gap-2">
                    ${u.reasons.map(r => `<span class="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg font-bold">${r}</span>`).join('')}
                </div>` : '<div class="mt-2 text-xs text-green-500 font-bold">✅ ไม่พบพฤติกรรมผิดปกติ</div>'}
            </div>`;
        }).join('')}
        ${_tc > 1 ? renderIpPagination(_tc, users.length, 'risk') : ''}
    `;
};

// ==========================================
// 🛡️ VPN / Datacenter Detector
// ==========================================
window.renderVpnDetector = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let suspects = globalIpLogs.filter(l => {
        const isp = (l.isp || '').toLowerCase();
        return VPN_ISP_KEYWORDS.some(k => isp.includes(k));
    });
    if (term) suspects = suspects.filter(l => (l.username||'').toLowerCase().includes(term) || (l.ip_address||'').toLowerCase().includes(term));

    if (suspects.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
            <span class="material-icons text-6xl mb-2">verified_user</span>
            <p class="font-bold">ไม่พบการใช้ VPN / Proxy / Datacenter IP 🎉</p></div>`;
        return;
    }

    // Group by IP
    const ipMap = {};
    suspects.forEach(l => {
        if (!ipMap[l.ip_address]) ipMap[l.ip_address] = { ip: l.ip_address, isp: l.isp, country: l.country, users: new Set(), logs: [] };
        ipMap[l.ip_address].users.add(l.username);
        ipMap[l.ip_address].logs.push(l);
    });
    const groups = Object.values(ipMap).sort((a,b) => b.users.size - a.users.size);

    const _tc = Math.max(1, Math.ceil(groups.length / IP_PAGE_SIZE));
    const _p  = Math.min(Math.max(1, ipPages.vpn || 1), _tc);
    ipPages.vpn = _p;
    const paged = groups.slice((_p-1)*IP_PAGE_SIZE, _p*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 rounded-xl">
            <div class="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold">
                <span class="material-icons">vpn_lock</span>
                <span>พบ ${groups.length} IP ที่น่าสงสัย (VPN / Proxy / Datacenter)</span>
            </div>
            <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">ตรวจจากชื่อ ISP ที่มักใช้ซ่อน IP จริง</p>
        </div>
        ${paged.map(g => `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-4 border-l-4 border-purple-500">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                    <div class="font-mono font-bold text-lg text-purple-700 dark:text-purple-300">${g.ip}</div>
                    <div class="text-xs text-gray-500">${g.country || '-'} • ${g.isp}</div>
                </div>
                <span class="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">⚠ VPN/Proxy • ${g.users.size} คน</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${[...g.users].map(u => `<span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">${u}</span>`).join('')}
            </div>
        </div>`).join('')}
        ${_tc > 1 ? renderIpPagination(_tc, groups.length, 'vpn') : ''}
    `;
};

// ==========================================
// ✈️ Impossible Travel Detector
// ==========================================
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

window.renderImpossibleTravel = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    // จัดกลุ่มตาม user แล้วเรียงตามเวลา
    const userLogs = {};
    globalIpLogs.forEach(l => {
        if (!l.latitude || !l.longitude) return;
        if (!userLogs[l.user_id]) userLogs[l.user_id] = [];
        userLogs[l.user_id].push(l);
    });
    Object.values(userLogs).forEach(arr => arr.sort((a,b) => new Date(a.login_time) - new Date(b.login_time)));

    const alerts = [];
    Object.values(userLogs).forEach(logs => {
        for (let i = 1; i < logs.length; i++) {
            const prev = logs[i-1], curr = logs[i];
            const distKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            const diffHr = (new Date(curr.login_time) - new Date(prev.login_time)) / 3600000;
            if (diffHr <= 0) continue;
            const speedKmh = distKm / diffHr;
            // ถ้าต้องเดินทางเกิน 900 km/h (เร็วกว่าเครื่องบินพาณิชย์) = ผิดปกติ
            if (distKm > 100 && speedKmh > 900) {
                alerts.push({ username: curr.username, prev, curr, distKm: Math.round(distKm), speedKmh: Math.round(speedKmh), diffHr: diffHr.toFixed(1) });
            }
        }
    });

    const hasLatLng = globalIpLogs.some(l => l.latitude && l.longitude);

    if (!hasLatLng) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-slate-400">
            <span class="material-icons text-6xl mb-2 opacity-30">flight</span>
            <p class="font-bold">ยังไม่มีข้อมูลพิกัด (lat/lng)</p>
            <p class="text-xs mt-2 text-center max-w-sm">ข้อมูลพิกัดจะเริ่มเก็บจากนี้ไป หลังจาก login ใหม่ครั้งถัดไป<br>รอสัก 1-2 วันแล้วกลับมาเช็คใหม่</p>
        </div>`;
        return;
    }

    if (alerts.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
            <span class="material-icons text-6xl mb-2">flight_land</span>
            <p class="font-bold">ไม่พบ Impossible Travel 🎉</p></div>`;
        return;
    }

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let filtered = alerts;
    if (term) filtered = filtered.filter(a => (a.username||'').toLowerCase().includes(term));

    container.innerHTML = `
        <div class="col-span-full mb-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold">
                <span class="material-icons">flight</span>
                <span>พบ ${filtered.length} กรณี Impossible Travel (เดินทางเร็วเกินจริง)</span>
            </div>
            <p class="text-xs text-red-600 dark:text-red-400 mt-1">เกณฑ์: ระยะทาง > 100km และความเร็ว > 900 km/h ภายในเวลาเดียวกัน = ไม่ใช่คนเดียวกัน</p>
        </div>
        ${filtered.map(a => `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-4 border-l-4 border-red-500">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="font-black text-lg text-slate-800 dark:text-white">${a.username}</div>
                <div class="flex gap-2">
                    <span class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">🚀 ${a.speedKmh.toLocaleString()} km/h</span>
                    <span class="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">📍 ${a.distKm.toLocaleString()} km</span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">จุดเดิม</div>
                    <div class="font-bold text-slate-800 dark:text-white">${a.prev.country} • ${a.prev.city}</div>
                    <div class="font-mono text-xs text-slate-500">${a.prev.ip_address}</div>
                    <div class="text-xs text-gray-400 mt-1">${new Date(a.prev.login_time).toLocaleString('th-TH')}</div>
                </div>
                <div class="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 border border-red-200 dark:border-red-700">
                    <div class="text-[10px] font-bold text-red-500 uppercase mb-1">⚡ จุดใหม่ (${a.diffHr} ชม.ต่อมา)</div>
                    <div class="font-bold text-red-700 dark:text-red-300">${a.curr.country} • ${a.curr.city}</div>
                    <div class="font-mono text-xs text-red-500">${a.curr.ip_address}</div>
                    <div class="text-xs text-red-400 mt-1">${new Date(a.curr.login_time).toLocaleString('th-TH')}</div>
                </div>
            </div>
        </div>`).join('')}
    `;
};

// ==========================================
// ⏰ Login Heatmap (7 วัน × 24 ชม.)
// ==========================================
window.renderLoginHeatmap = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const grid = {};
    const days = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) grid[`${d}_${h}`] = 0;

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let logs = globalIpLogs;
    if (term) logs = logs.filter(l => (l.username||'').toLowerCase().includes(term));

    let maxCount = 0;
    logs.forEach(l => {
        if (!l.login_time) return;
        const d = new Date(l.login_time);
        const key = `${d.getDay()}_${d.getHours()}`;
        grid[key] = (grid[key] || 0) + 1;
        if (grid[key] > maxCount) maxCount = grid[key];
    });

    const cellColor = (count) => {
        if (count === 0) return 'bg-slate-100 dark:bg-slate-700';
        const ratio = count / maxCount;
        if (ratio >= 0.8) return 'bg-red-500';
        if (ratio >= 0.6) return 'bg-orange-400';
        if (ratio >= 0.4) return 'bg-yellow-400';
        if (ratio >= 0.2) return 'bg-green-400';
        return 'bg-green-200';
    };

    let html = `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div class="font-black text-lg mb-1 text-slate-800 dark:text-white">⏰ Login Heatmap</div>
            <div class="text-xs text-gray-500 mb-4">ความหนาแน่นของ login ตามวัน × ชั่วโมง — สีแดง = บ่อยที่สุด</div>
            <div class="overflow-x-auto">
                <table class="text-[10px] border-separate border-spacing-1">
                    <thead><tr>
                        <th class="w-6 text-gray-400"></th>
                        ${Array.from({length:24},(_,h) => `<th class="w-7 text-center text-gray-400 font-normal">${h}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${days.map((day, d) => `
                        <tr>
                            <td class="text-gray-500 font-bold pr-1">${day}</td>
                            ${Array.from({length:24},(_,h) => {
                                const count = grid[`${d}_${h}`] || 0;
                                const isOdd = h >= 1 && h <= 5;
                                return `<td title="${day} ${h}:00 — ${count} ครั้ง ${isOdd && count > 0 ? '⚠️ ผิดปกติ' : ''}" class="w-7 h-7 rounded ${cellColor(count)} ${isOdd && count > 0 ? 'ring-2 ring-red-400' : ''} cursor-pointer transition hover:opacity-80"></td>`;
                            }).join('')}
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
                <span>น้อย</span>
                <div class="flex gap-1">
                    <div class="w-4 h-4 rounded bg-green-200"></div>
                    <div class="w-4 h-4 rounded bg-green-400"></div>
                    <div class="w-4 h-4 rounded bg-yellow-400"></div>
                    <div class="w-4 h-4 rounded bg-orange-400"></div>
                    <div class="w-4 h-4 rounded bg-red-500"></div>
                </div>
                <span>มาก</span>
                <span class="ml-4">⭕ = ตี 1-5 (น่าสงสัย)</span>
            </div>
        </div>`;

    // odd hour suspects
    const oddUsers = {};
    logs.forEach(l => {
        if (!l.login_time) return;
        const h = new Date(l.login_time).getHours();
        if (h >= 1 && h <= 5) {
            if (!oddUsers[l.username]) oddUsers[l.username] = [];
            oddUsers[l.username].push({ h, time: l.login_time });
        }
    });
    const oddList = Object.entries(oddUsers).sort((a,b) => b[1].length - a[1].length);

    if (oddList.length > 0) {
        html += `
        <div class="col-span-full bg-red-50 dark:bg-red-900/20 rounded-2xl shadow p-4 border-l-4 border-red-400 mt-0">
            <div class="font-bold text-red-700 dark:text-red-300 mb-2">⚠️ พนักงานที่ Login ช่วงเวลาผิดปกติ (ตี 1-5)</div>
            <div class="flex flex-wrap gap-2">
                ${oddList.map(([name, times]) => `
                <div class="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-red-200 dark:border-red-700 text-sm">
                    <span class="font-bold text-slate-800 dark:text-white">${name}</span>
                    <span class="ml-2 text-red-500 font-bold">${times.length} ครั้ง</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;
};

// ==========================================
// 👤 Timeline ต่อพนักงาน
// ==========================================
window.renderUserTimeline = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();

    if (!term) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-slate-400">
            <span class="material-icons text-6xl mb-2 opacity-30">manage_search</span>
            <p class="font-bold">พิมพ์ชื่อพนักงานในช่องค้นหาเพื่อดู Timeline</p>
        </div>`;
        return;
    }

    const logs = globalIpLogs
        .filter(l => (l.username||'').toLowerCase().includes(term))
        .sort((a,b) => new Date(b.login_time) - new Date(a.login_time));

    if (logs.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400"><p class="font-bold">ไม่พบข้อมูลของ "${term}"</p></div>`;
        return;
    }

    const evColor = { login: 'bg-emerald-500', ip_change: 'bg-rose-500', fp_change: 'bg-fuchsia-500' };
    const evLabel = { login: '🟢 Login', ip_change: '🔴 IP เปลี่ยน', fp_change: '🟣 สลับเครื่อง' };

    container.innerHTML = `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
            <div class="font-black text-lg mb-4 text-slate-800 dark:text-white">👤 Timeline: ${logs[0]?.username} (${logs.length} events)</div>
            <div class="relative">
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-600"></div>
                <div class="space-y-4">
                    ${logs.map(l => `
                    <div class="flex gap-4 pl-10 relative">
                        <div class="absolute left-2.5 w-3 h-3 rounded-full ${evColor[l.event_type] || 'bg-slate-400'} mt-1 ring-2 ring-white dark:ring-slate-800"></div>
                        <div class="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                                <span class="text-sm font-bold text-slate-800 dark:text-white">${evLabel[l.event_type] || l.event_type}</span>
                                <span class="text-xs text-gray-400">${new Date(l.login_time).toLocaleString('th-TH')}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-500 space-y-0.5">
                                <div>🌐 <span class="font-mono">${l.ip_address || '-'}</span> — ${l.country || '-'} / ${l.city || '-'}</div>
                                <div>🏢 ${l.isp || '-'}</div>
                                ${l.fingerprint ? `<div>📱 FP: <span class="font-mono">${shortFp(l.fingerprint)}</span></div>` : ''}
                                ${l.timezone ? `<div>🕐 Timezone: ${l.timezone}</div>` : ''}
                                ${l.asn ? `<div>🔌 ASN: ${l.asn}</div>` : ''}
                            </div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>`;
};
