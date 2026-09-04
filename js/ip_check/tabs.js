// ════════════════════════════════════════════════════════════════════
// 📦 ip_check/tabs.js — ส่วนที่ 2/4 ของระบบตรวจสอบ IP/FP (แยกจาก ip_check.js เดิม 2,059 บรรทัด)
// เนื้อหา: Tab: IP/FP เปลี่ยนกลางคัน, IP/FP ซ้ำ, สรุปต่อคน, การ์ดสรุป, ลบ log, Export CSV
// ⚠️ ลำดับโหลด: ip_check/core → ip_check/tabs → ip_check/risk → ip_check/alerts
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
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