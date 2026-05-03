// ==========================================
// 🌐 ระบบตรวจสอบ IP พนักงาน V2 (มี Heartbeat Detection)
// ==========================================
// Tab:
//   1. ทั้งหมด          - ทุก event
//   2. IP เปลี่ยนกลางคัน - เฉพาะ event_type = ip_change (สำคัญสุด!)
//   3. IP ซ้ำ           - หลายคนใช้ IP เดียวกัน
//   4. สรุปต่อพนักงาน    - แต่ละคนใช้กี่ IP
// ==========================================

let globalIpLogs = [];
let currentIpFilterUser = 'all';
let currentIpTab = 'all';

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
            <p class="text-gray-400 mt-2 font-bold">กำลังโหลดข้อมูล IP...</p>
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

    document.querySelectorAll('.ip-tab-btn').forEach(b => {
        b.classList.remove('bg-sky-600', 'bg-rose-600', 'bg-amber-500', 'bg-emerald-600', 'text-white');
        b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
    });
    const activeBtn = document.getElementById('ipTab_' + tab);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
        // 🌟 สีของแต่ละ Tab
        const colorMap = {
            all:        'bg-sky-600',
            changes:    'bg-rose-600',
            duplicates: 'bg-amber-500',
            by_user:    'bg-emerald-600'
        };
        activeBtn.classList.add(colorMap[tab] || 'bg-sky-600', 'text-white');
    }

    renderIpView();
};

window.filterIpLogs = function() {
    const sel = document.getElementById('ipUserFilter');
    currentIpFilterUser = sel ? sel.value : 'all';
    renderIpView();
};

// ==========================================
// 🎨 วาดข้อมูลตาม Tab ที่เลือก
// ==========================================
function renderIpView() {
    if (currentIpTab === 'changes') {
        renderIpChanges();
    } else if (currentIpTab === 'duplicates') {
        renderDuplicateIps();
    } else if (currentIpTab === 'by_user') {
        renderByUser();
    } else {
        renderAllLogs();
    }
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
    return `<span class="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                <span class="material-icons text-[12px]">login</span> Login
            </span>`;
}

// ==========================================
// 📜 Tab 1: ประวัติทั้งหมด
// ==========================================
function renderAllLogs() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    let logs = globalIpLogs;
    
    // กรองตามการค้นหา
    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    if (term) {
        logs = logs.filter(l =>
            (l.username || '').toLowerCase().includes(term) ||
            (l.ip_address || '').toLowerCase().includes(term) ||
            (l.country || '').toLowerCase().includes(term) ||
            (l.city || '').toLowerCase().includes(term)
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
    globalIpLogs.forEach(l => {
        if (!l.ip_address) return;
        if (!ipUserMap[l.ip_address]) ipUserMap[l.ip_address] = new Set();
        ipUserMap[l.ip_address].add(l.user_id);
    });

    container.innerHTML = `
        <div class="col-span-full overflow-x-auto rounded-xl shadow-md">
            <table class="min-w-full bg-white dark:bg-slate-800 text-sm">
                <thead class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    <tr>
                        <th class="px-3 py-2 text-left">เวลา</th>
                        <th class="px-3 py-2 text-left">ประเภท</th>
                        <th class="px-3 py-2 text-left">พนักงาน</th>
                        <th class="px-3 py-2 text-left">IP Address</th>
                        <th class="px-3 py-2 text-left">ประเทศ / เมือง</th>
                        <th class="px-3 py-2 text-left">ISP</th>
                        <th class="px-3 py-2 text-left">อุปกรณ์</th>
                        <th class="px-3 py-2 text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(l => {
                        const sharedCount = (ipUserMap[l.ip_address] || new Set()).size;
                        const isShared = sharedCount > 1;
                        const isChange = l.event_type === 'ip_change';
                        const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';
                        const device = parseUserAgent(l.user_agent || '');
                        // 🌟 แถวที่ IP เปลี่ยนกลางคัน → พื้นหลังสีชมพู, IP ซ้ำกัน → พื้นหลังเหลือง
                        let rowClass = '';
                        if (isChange) rowClass = 'bg-rose-50 dark:bg-rose-900/20';
                        else if (isShared) rowClass = 'bg-amber-50 dark:bg-amber-900/20';
                        return `
                            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${rowClass}">
                                <td class="px-3 py-2 text-xs">${time}</td>
                                <td class="px-3 py-2">${eventBadge(l.event_type)}</td>
                                <td class="px-3 py-2 font-bold text-slate-800 dark:text-white">${l.username || '-'}</td>
                                <td class="px-3 py-2">
                                    <span class="font-mono text-xs ${isShared ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'}">${l.ip_address || '-'}</span>
                                    ${isShared ? `<span class="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">⚠ ${sharedCount} คน</span>` : ''}
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
        </div>`;
}

// ==========================================
// 🚨 Tab 2: IP เปลี่ยนกลางคัน (ใหม่!)
// ==========================================
function renderIpChanges() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    let changes = globalIpLogs.filter(l => l.event_type === 'ip_change');

    if (currentIpFilterUser !== 'all') {
        changes = changes.filter(l => String(l.user_id) === String(currentIpFilterUser));
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

    // 🌟 หา IP ก่อนหน้าของการเปลี่ยนแต่ละครั้ง (เพื่อให้เห็นว่าเปลี่ยนจาก IP ไหน → ไปไหน)
    const userLogs = {};
    globalIpLogs.forEach(l => {
        if (!userLogs[l.user_id]) userLogs[l.user_id] = [];
        userLogs[l.user_id].push(l);
    });
    // เรียงเก่า → ใหม่ในแต่ละ user
    Object.values(userLogs).forEach(arr => arr.sort((a, b) => new Date(a.login_time) - new Date(b.login_time)));

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
        ${changes.map(l => {
            // หา log ก่อนหน้าของคนนี้ที่ IP ต่างจาก ip_change ตัวนี้
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
    `;
}

// ==========================================
// ⚠️ Tab 3: IP ซ้ำ
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

    const duplicates = Object.values(ipMap).filter(g => Object.keys(g.users).length >= 2);
    duplicates.sort((a, b) => Object.keys(b.users).length - Object.keys(a.users).length);

    if (duplicates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
                <span class="material-icons text-6xl mb-2">verified</span>
                <p class="font-bold">ไม่พบ IP ที่ซ้ำซ้อนระหว่างพนักงาน 🎉</p>
                <p class="text-xs text-gray-400 mt-1">พนักงานทุกคน Login จาก IP ของตัวเอง</p>
            </div>`;
        return;
    }

    container.innerHTML = duplicates.map(g => {
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
    }).join('');
}

// ==========================================
// 👤 Tab 4: สรุปจำนวน IP ต่อพนักงาน
// ==========================================
function renderByUser() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const userMap = {};
    globalIpLogs.forEach(l => {
        if (!l.user_id) return;
        if (!userMap[l.user_id]) {
            userMap[l.user_id] = { user_id: l.user_id, username: l.username, ips: {}, totalLogins: 0, ipChanges: 0, lastSeen: l.login_time };
        }
        if (l.ip_address) {
            if (!userMap[l.user_id].ips[l.ip_address]) {
                userMap[l.user_id].ips[l.ip_address] = { ip: l.ip_address, count: 0, country: l.country, city: l.city };
            }
            userMap[l.user_id].ips[l.ip_address].count++;
        }
        userMap[l.user_id].totalLogins++;
        // 🌟 นับจำนวนครั้งที่เปลี่ยน IP กลางคัน
        if (l.event_type === 'ip_change') userMap[l.user_id].ipChanges++;
        if (l.login_time > userMap[l.user_id].lastSeen) userMap[l.user_id].lastSeen = l.login_time;
    });

    const users = Object.values(userMap).sort((a, b) => Object.keys(b.ips).length - Object.keys(a.ips).length);

    if (users.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400">ยังไม่มีข้อมูล</div>`;
        return;
    }

    container.innerHTML = users.map(u => {
        const ipCount = Object.keys(u.ips).length;
        const isMany = ipCount >= 3;
        const ipList = Object.values(u.ips).sort((a, b) => b.count - a.count).map(ip => `
            <div class="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-700/50 rounded text-xs">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-slate-700 dark:text-slate-200">${ip.ip}</span>
                    <span class="text-gray-400">(${ip.country || '-'}, ${ip.city || '-'})</span>
                </div>
                <span class="text-sky-600 dark:text-sky-400 font-bold">${ip.count} ครั้ง</span>
            </div>`).join('');

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 border-l-4 ${isMany ? 'border-rose-500' : 'border-emerald-500'}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="material-icons ${isMany ? 'text-rose-500' : 'text-emerald-500'}">person</span>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-white">${u.username}</div>
                            <div class="text-[10px] text-gray-500">เข้าล่าสุด: ${new Date(u.lastSeen).toLocaleString('th-TH')}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black ${isMany ? 'text-rose-500' : 'text-emerald-500'}">${ipCount}</div>
                        <div class="text-[10px] text-gray-400">IP ที่ใช้</div>
                    </div>
                </div>
                <div class="space-y-1 max-h-48 overflow-y-auto">${ipList}</div>
                <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-gray-500 flex justify-between items-center">
                    <span>Login รวม: <span class="font-bold text-slate-700 dark:text-slate-200">${u.totalLogins}</span> ครั้ง</span>
                    ${u.ipChanges > 0 ? `<span class="text-rose-500 font-bold">⚠ เปลี่ยน IP กลางคัน ${u.ipChanges} ครั้ง</span>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ==========================================
// 📊 อัปเดตการ์ดสรุปด้านบน
// ==========================================
function updateIpSummary() {
    const totalLogs = globalIpLogs.length;
    const uniqueUsers = new Set(globalIpLogs.map(l => l.user_id)).size;
    const uniqueIps   = new Set(globalIpLogs.map(l => l.ip_address).filter(x => x && x !== 'unknown')).size;
    // 🌟 นับจำนวน IP เปลี่ยนกลางคัน
    const ipChanges = globalIpLogs.filter(l => l.event_type === 'ip_change').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('ipStatTotal',   totalLogs.toLocaleString('en-US'));
    set('ipStatUsers',   uniqueUsers.toLocaleString('en-US'));
    set('ipStatIps',     uniqueIps.toLocaleString('en-US'));
    set('ipStatChanges', ipChanges.toLocaleString('en-US'));
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
// 📤 Export CSV
// ==========================================
window.exportIpLogsCSV = function() {
    if (globalIpLogs.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ยังไม่มีข้อมูลให้ Export', 'info');
    
    const headers = ['เวลา', 'ประเภท', 'พนักงาน', 'IP', 'ประเทศ', 'เมือง', 'ISP', 'User Agent'];
    const rows = globalIpLogs.map(l => [
        l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '',
        l.event_type === 'ip_change' ? 'เปลี่ยน IP' : 'Login',
        l.username || '',
        l.ip_address || '',
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
    a.download = `IP_Logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};