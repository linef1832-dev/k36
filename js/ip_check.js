// ==========================================
// 🌐 ระบบตรวจสอบ IP พนักงาน (IP CHECK)
// ==========================================
// ใช้ตรวจจับ:
// 1. พนักงานที่แชร์บัญชี (Login จาก IP เดียวกันแต่หลายคน)
// 2. การ Login จากที่ตั้งผิดปกติ
// 3. ดูประวัติการเข้าใช้งานของพนักงานแต่ละคน
// ==========================================

let globalIpLogs = [];
let currentIpFilterUser = 'all';
let currentIpTab = 'all'; // all | duplicates | by_user

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
// 🎯 เปลี่ยน Tab (ทั้งหมด / IP ซ้ำ / สรุปต่อคน)
// ==========================================
window.switchIpTab = function(tab) {
    currentIpTab = tab;

    // อัปเดต UI ปุ่ม Tab
    document.querySelectorAll('.ip-tab-btn').forEach(b => {
        b.classList.remove('bg-sky-600', 'text-white');
        b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
    });
    const activeBtn = document.getElementById('ipTab_' + tab);
    if (activeBtn) {
        activeBtn.classList.add('bg-sky-600', 'text-white');
        activeBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
    }

    renderIpView();
};

// ==========================================
// 🔍 ตอน Filter เปลี่ยน
// ==========================================
window.filterIpLogs = function() {
    const sel = document.getElementById('ipUserFilter');
    currentIpFilterUser = sel ? sel.value : 'all';
    renderIpView();
};

// ==========================================
// 🎨 วาดข้อมูลตาม Tab ที่เลือก
// ==========================================
function renderIpView() {
    if (currentIpTab === 'duplicates') {
        renderDuplicateIps();
    } else if (currentIpTab === 'by_user') {
        renderByUser();
    } else {
        renderAllLogs();
    }
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

    // กรองตามคน
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

    // 🌟 สร้าง Map ของ IP -> จำนวนคนที่ใช้ IP นั้น (เพื่อระบายสีเตือน)
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
                        <th class="px-3 py-2 text-left">เวลา Login</th>
                        <th class="px-3 py-2 text-left">พนักงาน</th>
                        <th class="px-3 py-2 text-left">IP Address</th>
                        <th class="px-3 py-2 text-left">ประเทศ / เมือง</th>
                        <th class="px-3 py-2 text-left">ผู้ให้บริการ (ISP)</th>
                        <th class="px-3 py-2 text-left">อุปกรณ์</th>
                        <th class="px-3 py-2 text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(l => {
                        const sharedCount = (ipUserMap[l.ip_address] || new Set()).size;
                        const isShared = sharedCount > 1;
                        const time = l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '-';
                        const device = parseUserAgent(l.user_agent || '');
                        return `
                            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isShared ? 'bg-amber-50 dark:bg-amber-900/20' : ''}">
                                <td class="px-3 py-2 text-xs">${time}</td>
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
// ⚠️ Tab 2: IP ซ้ำ (มีพนักงานหลายคนใช้ IP เดียวกัน)
// ==========================================
function renderDuplicateIps() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    // จัดกลุ่มตาม IP -> ดูว่ามีคนใช้กี่คน
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

    // เอาเฉพาะ IP ที่มีคนใช้ >= 2 คน
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
// 👤 Tab 3: สรุปจำนวน IP ต่อพนักงาน
// ==========================================
function renderByUser() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    // จัดกลุ่มตาม user_id -> ดูว่าใช้กี่ IP
    const userMap = {};
    globalIpLogs.forEach(l => {
        if (!l.user_id) return;
        if (!userMap[l.user_id]) {
            userMap[l.user_id] = { user_id: l.user_id, username: l.username, ips: {}, totalLogins: 0, lastSeen: l.login_time };
        }
        if (l.ip_address) {
            if (!userMap[l.user_id].ips[l.ip_address]) {
                userMap[l.user_id].ips[l.ip_address] = { ip: l.ip_address, count: 0, country: l.country, city: l.city };
            }
            userMap[l.user_id].ips[l.ip_address].count++;
        }
        userMap[l.user_id].totalLogins++;
        if (l.login_time > userMap[l.user_id].lastSeen) userMap[l.user_id].lastSeen = l.login_time;
    });

    // เรียงตามจำนวน IP มาก -> น้อย (คนที่ใช้หลาย IP น่าสงสัย)
    const users = Object.values(userMap).sort((a, b) => Object.keys(b.ips).length - Object.keys(a.ips).length);

    if (users.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400">ยังไม่มีข้อมูล</div>`;
        return;
    }

    container.innerHTML = users.map(u => {
        const ipCount = Object.keys(u.ips).length;
        const isMany = ipCount >= 3; // ใช้ IP เกิน 3 ตัว = น่าสงสัย
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
                <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-gray-500 text-right">
                    Login รวม: <span class="font-bold text-slate-700 dark:text-slate-200">${u.totalLogins}</span> ครั้ง
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

    // หา IP ที่ใช้ร่วมกัน
    const ipMap = {};
    globalIpLogs.forEach(l => {
        if (!l.ip_address || l.ip_address === 'unknown') return;
        if (!ipMap[l.ip_address]) ipMap[l.ip_address] = new Set();
        ipMap[l.ip_address].add(l.user_id);
    });
    const sharedIps = Object.values(ipMap).filter(s => s.size >= 2).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('ipStatTotal',  totalLogs.toLocaleString('en-US'));
    set('ipStatUsers',  uniqueUsers.toLocaleString('en-US'));
    set('ipStatIps',    uniqueIps.toLocaleString('en-US'));
    set('ipStatShared', sharedIps.toLocaleString('en-US'));
}

// ==========================================
// 🔧 Helper: แปลง User Agent ให้อ่านง่าย
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
        inputLabel: 'จะลบ Log ที่เก่ากว่าจำนวนวันที่ระบุ (เช่น 90 = ลบของเก่ากว่า 90 วัน)',
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
// 📤 Export ข้อมูลเป็น CSV
// ==========================================
window.exportIpLogsCSV = function() {
    if (globalIpLogs.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ยังไม่มีข้อมูลให้ Export', 'info');
    
    const headers = ['เวลา Login', 'พนักงาน', 'IP', 'ประเทศ', 'เมือง', 'ISP', 'User Agent'];
    const rows = globalIpLogs.map(l => [
        l.login_time ? new Date(l.login_time).toLocaleString('th-TH') : '',
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

    // 🌟 \uFEFF = BOM สำหรับ UTF-8 ให้ Excel เปิดภาษาไทยได้ไม่เพี้ยน
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IP_Logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};