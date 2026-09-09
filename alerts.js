// ════════════════════════════════════════════════════════════════════
// 📦 ip_check/alerts.js — ส่วนที่ 4/4 ของระบบตรวจสอบ IP/FP (แยกจาก ip_check.js เดิม 2,059 บรรทัด)
// เนื้อหา: Live Alert Banner, Login ซ้อน 2 เครื่อง, Timezone ไม่ตรง IP
// ⚠️ ลำดับโหลด: ip_check/core → ip_check/tabs → ip_check/risk → ip_check/alerts
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🚨 Live Alert Banner — แจ้งเตือนทันทีตอนเปิดหน้า
// ==========================================
window.renderLiveAlerts = function() {
    const banner = document.getElementById('ipAlertBanner');
    if (!banner) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = globalIpLogs.filter(l => l.login_time && new Date(l.login_time) >= today);

    const alerts = [];

    // 1. VPN วันนี้
    const vpnToday = todayLogs.filter(l => VPN_ISP_KEYWORDS.some(k => (l.isp||'').toLowerCase().includes(k)));
    const vpnUsers = [...new Set(vpnToday.map(l => l.username))];
    if (vpnUsers.length > 0) {
        alerts.push({
            level: 'critical',
            icon: 'vpn_lock',
            title: `พบการใช้ VPN/Proxy วันนี้ ${vpnUsers.length} คน`,
            detail: vpnUsers.join(', '),
            tab: 'vpn'
        });
    }

    // 2. FP เปลี่ยนวันนี้ (สลับเครื่อง)
    const fpChangeToday = todayLogs.filter(l => l.event_type === 'fp_change');
    const fpUsers = [...new Set(fpChangeToday.map(l => l.username))];
    if (fpUsers.length > 0) {
        alerts.push({
            level: 'critical',
            icon: 'devices',
            title: `สลับเครื่องวันนี้ ${fpUsers.length} คน`,
            detail: fpUsers.join(', '),
            tab: 'fp_changes'
        });
    }

    // 3. IP เปลี่ยนวันนี้
    const ipChangeToday = todayLogs.filter(l => l.event_type === 'ip_change');
    const ipChangeUsers = [...new Set(ipChangeToday.map(l => l.username))];
    if (ipChangeUsers.length > 0) {
        alerts.push({
            level: 'high',
            icon: 'swap_horiz',
            title: `IP เปลี่ยนกลางคันวันนี้ ${ipChangeUsers.length} คน`,
            detail: ipChangeUsers.join(', '),
            tab: 'changes'
        });
    }

    // 4. Login ตี 1-5 วันนี้
    const oddToday = todayLogs.filter(l => {
        const h = new Date(l.login_time).getHours();
        return h >= 1 && h <= 5;
    });
    const oddUsers = [...new Set(oddToday.map(l => l.username))];
    if (oddUsers.length > 0) {
        alerts.push({
            level: 'medium',
            icon: 'schedule',
            title: `Login ผิดเวลาวันนี้ (ตี 1-5) ${oddUsers.length} คน`,
            detail: oddUsers.join(', '),
            tab: 'heatmap'
        });
    }

    // 5. Session Overlap วันนี้
    const overlapUsers = detectSessionOverlapUsers(todayLogs);
    if (overlapUsers.length > 0) {
        alerts.push({
            level: 'critical',
            icon: 'supervisor_account',
            title: `Login พร้อมกัน 2 เครื่องวันนี้ ${overlapUsers.length} คน`,
            detail: overlapUsers.join(', '),
            tab: 'overlap'
        });
    }

    // 6. TZ Mismatch วันนี้
    const tzMismatchUsers = detectTzMismatchUsers(todayLogs);
    if (tzMismatchUsers.length > 0) {
        alerts.push({
            level: 'high',
            icon: 'travel_explore',
            title: `Timezone ไม่ตรงกับ IP วันนี้ ${tzMismatchUsers.length} คน`,
            detail: tzMismatchUsers.join(', '),
            tab: 'tzmismatch'
        });
    }

    if (alerts.length === 0) {
        banner.style.display = 'block';
        banner.innerHTML = `
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:10px">
                <span class="material-icons" style="color:#16a34a;font-size:22px">verified_user</span>
                <div>
                    <div style="font-weight:700;color:#15803d;font-size:14px">✅ วันนี้ไม่พบเหตุการณ์ผิดปกติ</div>
                    <div style="font-size:11px;color:#166534;margin-top:2px">ตรวจสอบแล้ว ${todayLogs.length} รายการ</div>
                </div>
            </div>`;
        return;
    }

    const levelStyle = {
        critical: { bg:'#fef2f2', border:'#fca5a5', dot:'#ef4444', text:'#991b1b', sub:'#dc2626' },
        high:     { bg:'#fff7ed', border:'#fed7aa', dot:'#f97316', text:'#9a3412', sub:'#ea580c' },
        medium:   { bg:'#fefce8', border:'#fde68a', dot:'#eab308', text:'#713f12', sub:'#ca8a04' }
    };

    banner.style.display = 'block';
    banner.innerHTML = `
        <div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
            <div style="background:linear-gradient(90deg,#1e293b,#334155);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                    <span class="material-icons" style="color:#f87171;font-size:20px;animation:pulse 1.5s infinite">warning</span>
                    <span style="color:#f1f5f9;font-weight:700;font-size:14px">🚨 แจ้งเตือนวันนี้ — พบ ${alerts.length} เหตุการณ์ผิดปกติ</span>
                </div>
                <span style="color:#94a3b8;font-size:11px">ตรวจสอบ ${todayLogs.length} รายการ จาก ${new Date().toLocaleDateString('th-TH')}</span>
            </div>
            <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
                ${alerts.map(a => {
                    const s = levelStyle[a.level];
                    return `
                    <div style="background:${s.bg};border:1px solid ${s.border};border-radius:10px;padding:10px 14px;display:flex;align-items:flex-start;gap:10px;cursor:pointer" onclick="switchIpTab('${a.tab}')">
                        <span class="material-icons" style="color:${s.dot};font-size:20px;flex-shrink:0;margin-top:1px">${a.icon}</span>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:700;color:${s.text};font-size:13px">${a.title}</div>
                            <div style="font-size:11px;color:${s.sub};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.detail}</div>
                        </div>
                        <span class="material-icons" style="color:${s.dot};font-size:16px;flex-shrink:0;margin-top:2px">chevron_right</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}</style>`;
};

// ==========================================
// 👥 Session Overlap — Login พร้อมกัน 2 เครื่อง
// ==========================================
function detectSessionOverlapUsers(logs) {
    // จัดกลุ่มตาม user แล้วหาช่วงเวลา login ที่ซ้อนกัน (ภายใน 5 นาที ต่าง FP)
    const userLogs = {};
    logs.forEach(l => {
        if (!l.user_id || l.event_type !== 'login') return;
        if (!userLogs[l.user_id]) userLogs[l.user_id] = { username: l.username, logs: [] };
        userLogs[l.user_id].logs.push(l);
    });
    const suspects = [];
    Object.values(userLogs).forEach(u => {
        const ls = u.logs.sort((a,b) => new Date(a.login_time) - new Date(b.login_time));
        for (let i = 1; i < ls.length; i++) {
            const prev = ls[i-1], curr = ls[i];
            const diffMin = (new Date(curr.login_time) - new Date(prev.login_time)) / 60000;
            if (diffMin <= 5 && prev.fingerprint && curr.fingerprint && prev.fingerprint !== curr.fingerprint) {
                suspects.push(u.username);
                break;
            }
        }
    });
    return [...new Set(suspects)];
}

window.renderSessionOverlap = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const userLogs = {};
    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let logs = globalIpLogs.filter(l => l.event_type === 'login');
    if (term) logs = logs.filter(l => (l.username||'').toLowerCase().includes(term));

    logs.forEach(l => {
        if (!l.user_id) return;
        if (!userLogs[l.user_id]) userLogs[l.user_id] = { username: l.username, logs: [] };
        userLogs[l.user_id].logs.push(l);
    });

    const overlaps = [];
    Object.values(userLogs).forEach(u => {
        const ls = u.logs.sort((a,b) => new Date(a.login_time) - new Date(b.login_time));
        for (let i = 1; i < ls.length; i++) {
            const prev = ls[i-1], curr = ls[i];
            const diffMin = (new Date(curr.login_time) - new Date(prev.login_time)) / 60000;
            if (diffMin <= 5 && prev.fingerprint && curr.fingerprint && prev.fingerprint !== curr.fingerprint) {
                overlaps.push({ username: u.username, prev, curr, diffMin: diffMin.toFixed(1) });
            }
        }
    });

    const isDark = document.documentElement.classList.contains('dark');
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const subColor = isDark ? '#94a3b8' : '#64748b';

    if (overlaps.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
            <span class="material-icons text-6xl mb-2">supervisor_account</span>
            <p class="font-bold">ไม่พบการ Login พร้อมกัน 2 เครื่อง 🎉</p>
            <p class="text-xs text-gray-400 mt-1">เกณฑ์: login 2 ครั้งใน 5 นาที ต่าง Fingerprint = น่าสงสัย</p>
        </div>`;
        return;
    }

    const _tc = Math.max(1, Math.ceil(overlaps.length / IP_PAGE_SIZE));
    const _p = Math.min(Math.max(1, ipPages.overlap || 1), _tc);
    ipPages.overlap = _p;
    const paged = overlaps.slice((_p-1)*IP_PAGE_SIZE, _p*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 rounded-xl p-4 border-l-4 border-rose-500" style="background:${isDark?'rgba(159,18,57,.2)':'#fff1f2'}">
            <div class="flex items-center gap-2 font-bold" style="color:${isDark?'#fda4af':'#be123c'}">
                <span class="material-icons">supervisor_account</span>
                พบ ${overlaps.length} กรณี Login พร้อมกัน 2 เครื่อง (ภายใน 5 นาที)
            </div>
            <p class="text-xs mt-1" style="color:${isDark?'#fb7185':'#e11d48'}">บัญชีเดียวกัน login จาก 2 เครื่องที่ต่างกัน (FP ต่างกัน) ในเวลาใกล้เคียง = น่าสงสัยว่าแชร์บัญชี</p>
        </div>
        ${paged.map(o => `
        <div class="col-span-full rounded-2xl shadow p-4 border-l-4 border-rose-500" style="background:${cardBg}">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div class="font-black text-lg" style="color:${textColor}">${o.username}</div>
                <span style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:99px">⚠ ห่างกัน ${o.diffMin} นาที</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div style="background:${isDark?'rgba(51,65,85,.5)':'#f8fafc'};border-radius:12px;padding:12px;border:1px solid ${isDark?'#334155':'#e2e8f0'}">
                    <div style="font-size:10px;font-weight:700;color:${subColor};text-transform:uppercase;margin-bottom:6px">เครื่องที่ 1</div>
                    <div style="font-family:monospace;font-size:12px;color:#0369a1;font-weight:700">${o.prev.ip_address || '-'}</div>
                    <div style="font-size:11px;color:${subColor};margin-top:3px">${o.prev.country || '-'} / ${o.prev.city || '-'}</div>
                    <div style="font-size:11px;color:${subColor}">${parseUserAgent(o.prev.user_agent || '')}</div>
                    <div style="font-family:monospace;font-size:10px;color:#6366f1;margin-top:3px">FP: ${shortFp(o.prev.fingerprint)}</div>
                    <div style="font-size:10px;color:${subColor};margin-top:3px">${new Date(o.prev.login_time).toLocaleString('th-TH')}</div>
                </div>
                <div style="background:${isDark?'rgba(127,29,29,.3)':'#fff1f2'};border-radius:12px;padding:12px;border:1px solid ${isDark?'#7f1d1d':'#fecdd3'}">
                    <div style="font-size:10px;font-weight:700;color:#e11d48;text-transform:uppercase;margin-bottom:6px">⚡ เครื่องที่ 2 (${o.diffMin} นาทีต่อมา)</div>
                    <div style="font-family:monospace;font-size:12px;color:#e11d48;font-weight:700">${o.curr.ip_address || '-'}</div>
                    <div style="font-size:11px;color:#e11d48;margin-top:3px">${o.curr.country || '-'} / ${o.curr.city || '-'}</div>
                    <div style="font-size:11px;color:#e11d48">${parseUserAgent(o.curr.user_agent || '')}</div>
                    <div style="font-family:monospace;font-size:10px;color:#a855f7;margin-top:3px">FP: ${shortFp(o.curr.fingerprint)}</div>
                    <div style="font-size:10px;color:#e11d48;margin-top:3px">${new Date(o.curr.login_time).toLocaleString('th-TH')}</div>
                </div>
            </div>
        </div>`).join('')}
        ${_tc > 1 ? renderIpPagination(_tc, overlaps.length, 'overlap') : ''}`;
};

// ==========================================
// 🌍 Timezone Mismatch — IP บอกที่หนึ่ง TZ บอกอีกที่
// ==========================================
const TZ_COUNTRY_MAP = {
    'TH': ['Asia/Bangkok'],
    'SG': ['Asia/Singapore'],
    'MY': ['Asia/Kuala_Lumpur'],
    'JP': ['Asia/Tokyo'],
    'CN': ['Asia/Shanghai','Asia/Chongqing','Asia/Harbin','Asia/Urumqi'],
    'IN': ['Asia/Calcutta','Asia/Kolkata'],
    'AU': ['Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth'],
    'US': ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu'],
    'GB': ['Europe/London'],
    'DE': ['Europe/Berlin'],
    'FR': ['Europe/Paris'],
    'KR': ['Asia/Seoul'],
    'ID': ['Asia/Jakarta','Asia/Makassar','Asia/Jayapura'],
    'PH': ['Asia/Manila'],
    'VN': ['Asia/Ho_Chi_Minh','Asia/Saigon'],
    'HK': ['Asia/Hong_Kong'],
    'TW': ['Asia/Taipei']
};

function detectTzMismatchUsers(logs) {
    const suspects = new Set();
    logs.forEach(l => {
        if (!l.timezone || !l.country) return;
        const expected = TZ_COUNTRY_MAP[l.country];
        if (!expected) return;
        if (!expected.some(tz => l.timezone.includes(tz.split('/')[1]))) {
            suspects.add(l.username);
        }
    });
    return [...suspects];
}

window.renderTzMismatch = function() {
    const container = document.getElementById('ipLogsContainer');
    if (!container) return;

    const term = (document.getElementById('ipSearchInput')?.value || '').toLowerCase().trim();
    let suspects = globalIpLogs.filter(l => {
        if (!l.timezone || !l.country) return false;
        const expected = TZ_COUNTRY_MAP[l.country];
        if (!expected) return false;
        return !expected.some(tz => l.timezone.includes(tz.split('/')[1]));
    });
    if (term) suspects = suspects.filter(l => (l.username||'').toLowerCase().includes(term) || (l.ip_address||'').toLowerCase().includes(term));

    const isDark = document.documentElement.classList.contains('dark');
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const subColor = isDark ? '#94a3b8' : '#64748b';

    const hasTimezone = globalIpLogs.some(l => l.timezone);

    if (!hasTimezone) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20" style="color:${subColor}">
            <span class="material-icons text-6xl mb-2 opacity-30">travel_explore</span>
            <p class="font-bold">ยังไม่มีข้อมูล Timezone</p>
            <p class="text-xs mt-2 text-center max-w-sm" style="color:${subColor}">ข้อมูล timezone จะเริ่มเก็บจากนี้ไป หลัง login ครั้งถัดไป</p>
        </div>`;
        return;
    }

    if (suspects.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 text-emerald-500">
            <span class="material-icons text-6xl mb-2">travel_explore</span>
            <p class="font-bold">ไม่พบ Timezone ผิดปกติ 🎉</p>
            <p class="text-xs text-gray-400 mt-1">Timezone ตรงกับประเทศของ IP ทุกรายการ</p>
        </div>`;
        return;
    }

    const _tc = Math.max(1, Math.ceil(suspects.length / IP_PAGE_SIZE));
    const _p = Math.min(Math.max(1, ipPages.tzmismatch || 1), _tc);
    ipPages.tzmismatch = _p;
    const paged = suspects.slice((_p-1)*IP_PAGE_SIZE, _p*IP_PAGE_SIZE);

    container.innerHTML = `
        <div class="col-span-full mb-3 rounded-xl p-4 border-l-4 border-cyan-500" style="background:${isDark?'rgba(22,78,99,.3)':'#ecfeff'}">
            <div class="flex items-center gap-2 font-bold" style="color:${isDark?'#67e8f9':'#0e7490'}">
                <span class="material-icons">travel_explore</span>
                พบ ${suspects.length} รายการที่ Timezone ไม่ตรงกับ IP
            </div>
            <p class="text-xs mt-1" style="color:${isDark?'#22d3ee':'#0891b2'}">IP บอกว่าอยู่ประเทศ X แต่ Browser ใช้ Timezone ของประเทศ Y = น่าสงสัยว่าใช้ VPN ซ่อน IP จริง</p>
        </div>
        ${paged.map(l => {
            const expected = TZ_COUNTRY_MAP[l.country] || [];
            return `
        <div class="col-span-full rounded-2xl shadow p-4 border-l-4 border-cyan-500" style="background:${cardBg}">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                    <div class="font-black text-lg" style="color:${textColor}">${l.username}</div>
                    <div style="font-size:11px;color:${subColor}">${new Date(l.login_time).toLocaleString('th-TH')}</div>
                </div>
                <span style="background:#0891b2;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:99px">🌍 TZ ไม่ตรง</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div style="background:${isDark?'rgba(51,65,85,.5)':'#f8fafc'};border-radius:10px;padding:10px;border:1px solid ${isDark?'#334155':'#e2e8f0'}">
                    <div style="font-size:10px;font-weight:700;color:${subColor};text-transform:uppercase;margin-bottom:4px">🌐 IP บอกว่าอยู่</div>
                    <div style="font-family:monospace;font-weight:700;color:#0369a1;font-size:12px">${l.ip_address}</div>
                    <div style="font-size:12px;font-weight:700;margin-top:4px;color:${textColor}">${l.country} / ${l.city || '-'}</div>
                    <div style="font-size:11px;color:${subColor}">${l.isp || '-'}</div>
                </div>
                <div style="background:${isDark?'rgba(21,128,61,.2)':'#f0fdf4'};border-radius:10px;padding:10px;border:1px solid ${isDark?'#166534':'#bbf7d0'}">
                    <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;margin-bottom:4px">✅ TZ ที่ควรเป็น</div>
                    <div style="font-size:12px;font-weight:700;color:#15803d">${expected.join(', ') || '-'}</div>
                </div>
                <div style="background:${isDark?'rgba(127,29,29,.2)':'#fff1f2'};border-radius:10px;padding:10px;border:1px solid ${isDark?'#7f1d1d':'#fecdd3'}">
                    <div style="font-size:10px;font-weight:700;color:#e11d48;text-transform:uppercase;margin-bottom:4px">⚠️ TZ จริงที่ Browser ใช้</div>
                    <div style="font-size:12px;font-weight:700;color:#be123c">${l.timezone || '-'}</div>
                </div>
            </div>
        </div>`;
        }).join('')}
        ${_tc > 1 ? renderIpPagination(_tc, suspects.length, 'tzmismatch') : ''}`;
};
