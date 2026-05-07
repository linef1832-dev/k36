// ==========================================
// 🔍 OD CENTER — ตรวจลิงก์เว็บอัตโนมัติ
// ==========================================

let odcWebsites = [];   // [{ id, name, emoji, color, links: [{key, label, url, type}] }]
let odcResults = {};    // { 'webId.linkKey': { status: 'ok'|'fail'|'manual_ok'|'manual_fail'|'pending', time, detail } }
let odcCurrentRound = null; // { date, time, assignee, started_at }

// LINK_TYPES: 'auto' = ตรวจอัตโนมัติได้, 'manual' = ต้องมือถือเช็ค (เช่น APK)
const ODC_LINK_TYPES = {
    'login':    { label: 'ลิ้งค์เข้าสู่ระบบ',           type: 'auto',   icon: 'login' },
    'referral': { label: 'ลิ้งค์ แนะนำเพื่อน',           type: 'auto',   icon: 'group_add' },
    'apk':      { label: 'ลิ้งค์ดาวน์โหลดแอปพลิเคชัน',  type: 'manual', icon: 'phone_android' },
    'group':    { label: 'ตรวจสอบกลุ่มเก็งกำไร',         type: 'auto',   icon: 'forum' }
};

// default websites — admin แก้ได้ทีหลัง
const ODC_DEFAULT_WEBSITES = [
    { id: 'jun88', name: 'Jun88', emoji: '🔵', color: '#3b82f6', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'mk8',   name: 'MK8',   emoji: '⚫️', color: '#0f172a', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'f168',  name: 'F168',  emoji: '🟠', color: '#f97316', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'pg688', name: 'PG688', emoji: '🟣', color: '#a855f7', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'jl69',  name: 'JL69',  emoji: '🟡', color: '#eab308', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'nm9',   name: 'NM9',   emoji: '🔴', color: '#ef4444', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'vv72',  name: 'VV72',  emoji: '🔘', color: '#64748b', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'th26',  name: 'TH26',  emoji: '🟤', color: '#92400e', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'k188',  name: 'K188',  emoji: '🩷', color: '#ec4899', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'bt678', name: 'BT678', emoji: '⚪️', color: '#94a3b8', links: { login: '', referral: '', apk: '', group: '' } }
];

// ==========================================
// INIT
// ==========================================
window.initOdCenterApp = async function() {
    await odc_loadWebsites();
    await odc_loadCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();

    // แสดง admin controls ถ้าเป็น admin/manager
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('odcenter_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    if (isAdmin) {
        const ctrl = document.getElementById('odcAdminControls');
        if (ctrl) { ctrl.classList.remove('hidden'); ctrl.classList.add('flex'); }
    }
};

// ==========================================
// LOAD/SAVE
// ==========================================
window.odc_loadWebsites = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_websites').single();
        if (data && data.value) {
            odcWebsites = JSON.parse(data.value);
        } else {
            odcWebsites = JSON.parse(JSON.stringify(ODC_DEFAULT_WEBSITES));
            await appDB.from('settings').upsert([{ key: 'odc_websites', value: JSON.stringify(odcWebsites) }]);
        }
    } catch (e) {
        console.warn('Use default websites:', e);
        odcWebsites = JSON.parse(JSON.stringify(ODC_DEFAULT_WEBSITES));
    }
};

window.odc_saveWebsites = async function() {
    await appDB.from('settings').upsert([{ key: 'odc_websites', value: JSON.stringify(odcWebsites) }]);
};

window.odc_loadCurrentRound = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_current_round').single();
        if (data && data.value) {
            odcCurrentRound = JSON.parse(data.value);
            odcResults = odcCurrentRound.results || {};
        }
    } catch (e) {
        odcCurrentRound = null;
        odcResults = {};
    }
};

window.odc_saveCurrentRound = async function() {
    if (!odcCurrentRound) odcCurrentRound = { date: new Date().toISOString().split('T')[0], time: '12:00', assignee: '', started_at: new Date().toISOString() };
    odcCurrentRound.results = odcResults;
    odcCurrentRound.updated_at = new Date().toISOString();
    await appDB.from('settings').upsert([{ key: 'odc_current_round', value: JSON.stringify(odcCurrentRound) }]);
};

// V2: เริ่ม/ใช้รอบของวันนี้อัตโนมัติ — ไม่ต้องกดรับงาน
// ทุกครั้งที่ทำการตรวจ → ระบบเซ็ตชื่อคนทำให้เลย
window.odc_ensureRound = async function() {
    const myUsername = (currentUser && (currentUser.username || currentUser.name)) || '';
    if (!myUsername) return false;

    const today = new Date().toISOString().split('T')[0];
    const isNewRound = !odcCurrentRound || odcCurrentRound.date !== today;

    if (isNewRound) {
        // เริ่มรอบใหม่อัตโนมัติ
        odcCurrentRound = {
            date: today,
            time: '12:00',
            assignee: myUsername,
            started_at: new Date().toISOString(),
            results: {}
        };
        odcResults = {};
    } else if (!odcCurrentRound.assignee || odcCurrentRound.assignee !== myUsername) {
        // ถ้ายังไม่มีชื่อ หรือคนอื่นมาตรวจต่อ → ใช้ชื่อล่าสุด
        odcCurrentRound.assignee = myUsername;
    }

    return true;
};

// (เก็บ claimRound ไว้เผื่อ backward compat แต่ไม่ใช้แล้ว)
window.odc_claimRound = window.odc_ensureRound;

// ==========================================
// AUTO CHECK (ลิงก์ปกติ — ไม่ใช่ APK)
// ==========================================
window.odc_runAllChecks = async function() {
    // V2: auto ensure round — ไม่ต้องถาม
    const ok = await odc_ensureRound();
    if (!ok) {
        Swal.fire('Error', 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 'error');
        return;
    }

    // เก็บ list ลิงก์ที่ตรวจอัตโนมัติได้
    const checks = [];
    odcWebsites.forEach(w => {
        Object.keys(w.links || {}).forEach(linkKey => {
            const url = w.links[linkKey];
            if (!url) return;
            const meta = ODC_LINK_TYPES[linkKey];
            if (!meta || meta.type !== 'auto') return;
            checks.push({ webId: w.id, linkKey, url });
        });
    });

    if (checks.length === 0) {
        Swal.fire('ไม่มีลิงก์ให้ตรวจ', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }

    sop_showInlineToast(`กำลังตรวจ ${checks.length} ลิงก์...`, 'info');

    // mark all as pending
    checks.forEach(c => {
        odcResults[`${c.webId}.${c.linkKey}`] = { status: 'pending' };
    });
    odc_renderWebsites();

    // ยิง parallel ทุกลิงก์
    await Promise.all(checks.map(async (c) => {
        const startTime = Date.now();
        try {
            // ใช้ no-cors mode — เช็คว่าเซิร์ฟเวอร์ตอบกลับหรือไม่
            // ถ้า fetch ผ่าน = เซิร์ฟเวอร์ออนไลน์
            // ถ้า fetch error = offline / DNS error / blocked
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 10000);

            await fetch(c.url, {
                method: 'GET',
                mode: 'no-cors',
                signal: ctrl.signal,
                cache: 'no-store'
            });
            clearTimeout(timeout);

            const elapsed = Date.now() - startTime;
            odcResults[`${c.webId}.${c.linkKey}`] = {
                status: 'ok',
                time: elapsed,
                checked_at: new Date().toISOString()
            };
        } catch (e) {
            odcResults[`${c.webId}.${c.linkKey}`] = {
                status: 'fail',
                error: e.name === 'AbortError' ? 'timeout (>10s)' : (e.message || 'connection failed'),
                checked_at: new Date().toISOString()
            };
        }
    }));

    await odc_saveCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();

    const okCount = checks.filter(c => odcResults[`${c.webId}.${c.linkKey}`]?.status === 'ok').length;
    sop_showInlineToast(`ตรวจเสร็จ — ${okCount}/${checks.length} ปกติ`, okCount === checks.length ? 'success' : 'info');
};

// ==========================================
// MANUAL CHECK (สำหรับ APK)
// ==========================================
window.odc_setManualResult = async function(webId, linkKey, ok) {
    const ready = await odc_ensureRound();
    if (!ready) return;
    odcResults[`${webId}.${linkKey}`] = {
        status: ok ? 'manual_ok' : 'manual_fail',
        checked_at: new Date().toISOString(),
        checked_by: (currentUser && (currentUser.username || currentUser.name)) || 'admin'
    };
    await odc_saveCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();
    sop_showInlineToast(ok ? 'บันทึก: ใช้ได้ ✅' : 'บันทึก: ใช้ไม่ได้ 🔴', ok ? 'success' : 'info');
};

// ==========================================
// 👁️ VIEW IN IFRAME (ฝังเว็บมาดูในระบบ)
// ==========================================
window.odc_viewInline = async function(webId, linkKey) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;
    const url = w.links[linkKey];
    if (!url) {
        Swal.fire('ไม่มีลิงก์', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }
    const meta = ODC_LINK_TYPES[linkKey];

    // กำหนดขนาด popup ให้ใหญ่เกือบเต็มจอ
    await Swal.fire({
        title: `<div class="text-base font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">visibility</span> ${w.emoji || ''} ${w.name} — ${meta.label}</div>`,
        html: `
            <div class="text-left">
                <!-- Toolbar เหมือน browser -->
                <div class="bg-slate-100 dark:bg-slate-900 rounded-t-xl border-2 border-b-0 border-gray-300 dark:border-slate-600 px-2 py-1.5 flex items-center gap-1.5 flex-wrap">
                    <button onclick="odc_iframeBack()" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ย้อนกลับ"><span class="material-icons text-[16px]">arrow_back</span></button>
                    <button onclick="odc_iframeReload()" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="รีโหลด"><span class="material-icons text-[16px]">refresh</span></button>
                    <button onclick="odc_iframeHome('${url}')" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="กลับหน้าหลัก"><span class="material-icons text-[16px]">home</span></button>
                    <div class="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate" id="odcIframeUrlBar">${url}</div>
                    <a href="${url}" target="_blank" rel="noopener" class="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition" title="เปิดในแท็บใหม่"><span class="material-icons text-[12px]">open_in_new</span></a>
                </div>

                <!-- Tip -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border-x-2 border-blue-300 dark:border-blue-700 px-2.5 py-1 text-[11px] flex items-center gap-1.5">
                    <span class="material-icons text-blue-500 text-[14px]">touch_app</span>
                    <span>เห็นเว็บในกรอบ → ตรวจดูว่าเว็บโหลดได้ครบ → กด ✅/🔴 ด้านล่าง (ทางเข้า 1-5 จะเปิดแท็บใหม่ — ปิดแท็บแล้วกลับมาที่นี่)</span>
                </div>

                <!-- Iframe container -->
                <div class="relative bg-slate-100 dark:bg-slate-900 rounded-b-xl overflow-hidden border-2 border-t-0 border-gray-300 dark:border-slate-600" style="height: 62vh;">
                    <div id="odcIframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
                        <span class="material-icons animate-spin text-blue-500 text-3xl mb-2">sync</span>
                        <p class="text-sm font-bold text-slate-600 dark:text-gray-300">กำลังโหลดเว็บ...</p>
                        <p class="text-[10px] text-gray-500 mt-1">ถ้าโหลดไม่ขึ้น = เว็บนี้ block iframe → กด <span class="material-icons text-[12px] align-middle">open_in_new</span> เพื่อเปิดแท็บใหม่</p>
                    </div>
                    <iframe src="${url}" id="odcIframe" class="w-full h-full bg-white" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
                </div>

                <!-- ปุ่มบันทึกผล -->
                <div class="flex gap-2 justify-center pt-3">
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', true); Swal.close();" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-[18px]">check_circle</span> ปกติ ใช้ได้
                    </button>
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', false); Swal.close();" class="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-[18px]">cancel</span> ผิดปกติ
                    </button>
                </div>
            </div>
        `,
        width: '92vw',
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            const iframe = document.getElementById('odcIframe');
            if (!iframe) return;

            iframe.addEventListener('load', () => {
                const loading = document.getElementById('odcIframeLoading');
                if (loading) loading.style.display = 'none';

                // อัพเดท URL bar (อาจอ่านไม่ได้ถ้า cross-origin — fallback เงียบๆ)
                try {
                    const newUrl = iframe.contentWindow.location.href;
                    const bar = document.getElementById('odcIframeUrlBar');
                    if (bar && newUrl) bar.innerText = newUrl;

                    // ดักการคลิกในเว็บ (ถ้าเป็น same-origin) — แก้ target="_blank" เป็น _self
                    try {
                        const links = iframe.contentDocument.querySelectorAll('a[target="_blank"]');
                        links.forEach(a => a.target = '_self');
                    } catch (_) { /* cross-origin — skip */ }
                } catch (e) { /* cross-origin — silent */ }
            });
        }
    });
};

// ฟังก์ชันควบคุม iframe
window.odc_iframeBack = function() {
    try {
        const iframe = document.getElementById('odcIframe');
        if (iframe && iframe.contentWindow) iframe.contentWindow.history.back();
    } catch (e) { console.warn('Cannot go back:', e); }
};

window.odc_iframeReload = function() {
    const iframe = document.getElementById('odcIframe');
    if (iframe) {
        const loading = document.getElementById('odcIframeLoading');
        if (loading) loading.style.display = 'flex';
        iframe.src = iframe.src;
    }
};

window.odc_iframeHome = function(homeUrl) {
    const iframe = document.getElementById('odcIframe');
    if (iframe) {
        const loading = document.getElementById('odcIframeLoading');
        if (loading) loading.style.display = 'flex';
        iframe.src = homeUrl;
    }
};

// ==========================================
// 📱 SHOW QR CODE สำหรับลิงก์ APK
// ==========================================
window.odc_showQrCode = async function(webId, linkKey) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;
    const url = w.links[linkKey];
    if (!url) {
        Swal.fire('ไม่มีลิงก์', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }

    const meta = ODC_LINK_TYPES[linkKey];
    // ใช้ Google Chart API สร้าง QR code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    await Swal.fire({
        title: `<div class="text-lg font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">qr_code_2</span> ${w.name} — ${meta.label}</div>`,
        html: `
            <div class="text-center space-y-3">
                <div class="bg-white p-4 rounded-2xl inline-block shadow-md border border-gray-200">
                    <img src="${qrUrl}" alt="QR Code" class="w-[260px] h-[260px]" />
                </div>
                <div class="text-xs text-gray-500 break-all px-2 font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">${url}</div>
                <div class="text-sm text-slate-700 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3">
                    📱 <b>วิธีใช้:</b><br>
                    1. เปิดกล้องมือถือ → สแกน QR<br>
                    2. กดดาวน์โหลด/ติดตั้งแอป<br>
                    3. กลับมาหน้านี้ → กด "ใช้ได้" หรือ "ใช้ไม่ได้"
                </div>
                <div class="flex gap-2 justify-center pt-2">
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', true); Swal.close();" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-sm">check_circle</span> ใช้ได้
                    </button>
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', false); Swal.close();" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-sm">cancel</span> ใช้ไม่ได้
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '440px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

// ==========================================
// RENDER
// ==========================================
function odc_lightenHex(hex, amt) {
    if (!hex || !hex.startsWith('#')) return hex;
    const c = hex.replace('#', '');
    const r = Math.min(255, parseInt(c.substr(0,2), 16) + amt);
    const g = Math.min(255, parseInt(c.substr(2,2), 16) + amt);
    const b = Math.min(255, parseInt(c.substr(4,2), 16) + amt);
    return `rgb(${r},${g},${b})`;
}

window.odc_renderWebsites = function() {
    const container = document.getElementById('odcWebsitesContainer');
    if (!container) return;

    if (!odcWebsites || odcWebsites.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 dark:text-gray-600 py-20 flex flex-col items-center select-none">
                <span class="material-icons text-[80px] opacity-30">link_off</span>
                <h2 class="text-xl font-black text-gray-500 mt-3">ยังไม่มีเว็บ</h2>
                <p class="text-sm mt-1">กดปุ่ม "จัดการเว็บ" เพื่อเพิ่ม</p>
            </div>`;
        return;
    }

    let html = '';
    odcWebsites.forEach(w => {
        const linksHtml = Object.keys(ODC_LINK_TYPES).map(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const url = (w.links || {})[linkKey] || '';
            const result = odcResults[`${w.id}.${linkKey}`] || {};

            let statusIcon = 'help_outline';
            let statusIconClass = 'text-gray-400';
            let statusBorderClass = 'border-gray-300 dark:border-slate-600';
            let statusDetail = '<div class="text-[10px] text-gray-400 italic">ยังไม่ได้ตรวจ</div>';

            if (result.status === 'ok' || result.status === 'manual_ok') {
                statusIcon = 'check_circle';
                statusIconClass = 'text-emerald-500';
                statusBorderClass = 'border-emerald-500';
                const detail = result.status === 'manual_ok' ? `เช็คโดย: ${result.checked_by || '-'}` : `${result.time || 0}ms`;
                statusDetail = `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✅ ปกติ — ${detail}</div>`;
            } else if (result.status === 'fail' || result.status === 'manual_fail') {
                statusIcon = 'error';
                statusIconClass = 'text-red-500';
                statusBorderClass = 'border-red-500';
                const detail = result.status === 'manual_fail' ? `เช็คโดย: ${result.checked_by || '-'}` : (result.error || 'ผิดพลาด');
                statusDetail = `<div class="text-[10px] text-red-600 dark:text-red-400 font-bold">🔴 ${detail}</div>`;
            } else if (result.status === 'pending') {
                statusIcon = 'sync';
                statusIconClass = 'text-blue-500 animate-spin';
                statusBorderClass = 'border-blue-500';
                statusDetail = `<div class="text-[10px] text-blue-600 dark:text-blue-400 font-bold animate-pulse">กำลังตรวจ...</div>`;
            }

            // Action buttons
            let actions = '';
            if (url) {
                // ปุ่ม "ดูในระบบ" (iframe popup) — สำหรับลิงก์ที่ไม่ใช่ APK
                if (meta.type !== 'manual') {
                    actions += `<button onclick="odc_viewInline('${w.id}', '${linkKey}')" class="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition active:scale-95" title="ดูเว็บในระบบ"><span class="material-icons text-[14px]">visibility</span>ดู</button>`;
                }

                // ปุ่มเปิดแท็บใหม่ (สำรอง)
                actions += `<a href="${url}" target="_blank" rel="noopener" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="เปิดแท็บใหม่"><span class="material-icons text-[14px]">open_in_new</span></a>`;

                if (meta.type === 'manual') {
                    // APK: QR code + Manual buttons
                    actions += `<button onclick="odc_showQrCode('${w.id}', '${linkKey}')" class="bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-gray-400 hover:text-purple-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="QR สแกนมือถือ"><span class="material-icons text-[14px]">qr_code_2</span></button>`;
                }

                // ปุ่ม ✅/🔴 manual check — มีให้ทุกลิงก์
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', true)" class="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="ใช้ได้"><span class="material-icons text-[12px]">check</span></button>`;
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', false)" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="ใช้ไม่ได้"><span class="material-icons text-[12px]">close</span></button>`;
            } else {
                actions += `<span class="text-[10px] text-amber-600 italic">⚠️ ยังไม่ได้ใส่ลิงก์</span>`;
            }

            return `
                <div class="flex items-center gap-3 p-3 rounded-xl border-l-4 ${statusBorderClass} bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
                    <span class="material-icons text-[22px] ${statusIconClass}">${statusIcon}</span>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                            <span class="material-icons text-[16px] text-gray-500">${meta.icon}</span>
                            ${meta.label}
                            ${meta.type === 'manual' ? '<span class="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">📱 มือถือ</span>' : ''}
                        </div>
                        <div class="text-[10px] text-gray-500 dark:text-gray-400 truncate font-mono">${url || '(ไม่มีลิงก์)'}</div>
                        ${statusDetail}
                    </div>
                    <div class="flex items-center gap-1 shrink-0 flex-wrap justify-end">${actions}</div>
                </div>
            `;
        }).join('');

        // header with stats
        const totalLinks = Object.values(w.links || {}).filter(u => u).length;
        const okLinks = Object.keys(w.links || {}).filter(k => {
            const r = odcResults[`${w.id}.${k}`];
            return r && (r.status === 'ok' || r.status === 'manual_ok');
        }).length;
        const failLinks = Object.keys(w.links || {}).filter(k => {
            const r = odcResults[`${w.id}.${k}`];
            return r && (r.status === 'fail' || r.status === 'manual_fail');
        }).length;

        let statusBadge = `${okLinks}/${totalLinks}`;
        if (failLinks > 0) statusBadge += ` ⚠️`;
        else if (okLinks === totalLinks && totalLinks > 0) statusBadge += ` ✅`;

        const wColor = w.color || '#3b82f6';
        const wColorLight = odc_lightenHex(wColor, 30);

        html += `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md overflow-hidden">
                <div class="text-white px-5 py-3 flex items-center gap-3 flex-wrap" style="background: linear-gradient(to right, ${wColor}, ${wColorLight});">
                    <span class="text-2xl shrink-0">${w.emoji || '🌐'}</span>
                    <h3 class="font-black text-lg tracking-wide flex-1">${(w.name || '').replace(/</g, '&lt;')}</h3>
                    <span class="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full">${statusBadge}</span>
                </div>
                <div class="p-3 space-y-2">${linksHtml}</div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.odc_updateStatusBar = function() {
    const lastCheck = document.getElementById('odcLastCheck');
    const okEl = document.getElementById('odcOkCount');
    const errEl = document.getElementById('odcErrCount');
    const assignedEl = document.getElementById('odcAssignedTo');

    let okCount = 0, errCount = 0;
    Object.values(odcResults).forEach(r => {
        if (r.status === 'ok' || r.status === 'manual_ok') okCount++;
        else if (r.status === 'fail' || r.status === 'manual_fail') errCount++;
    });
    if (okEl) okEl.innerText = okCount;
    if (errEl) errEl.innerText = errCount;

    // V2: ใช้ชื่อ user ที่ login อยู่เลย
    const myUsername = (currentUser && (currentUser.username || currentUser.name)) || '-';

    if (odcCurrentRound) {
        const today = new Date().toISOString().split('T')[0];
        if (odcCurrentRound.date === today) {
            // วันนี้ — โชว์ชื่อ assignee (ถ้ามี) หรือ user ปัจจุบัน
            if (assignedEl) assignedEl.innerText = odcCurrentRound.assignee || myUsername;
            if (lastCheck && odcCurrentRound.updated_at) {
                lastCheck.innerText = `รอบ ${odcCurrentRound.date} ${odcCurrentRound.time} — อัพเดทล่าสุด ${new Date(odcCurrentRound.updated_at).toLocaleTimeString('th-TH')}`;
            } else if (lastCheck) {
                lastCheck.innerText = `รอบ ${odcCurrentRound.date} ${odcCurrentRound.time}`;
            }
        } else {
            // รอบเก่า — โชว์ชื่อ user ปัจจุบัน เพราะรอบใหม่จะเริ่ม
            if (assignedEl) assignedEl.innerText = myUsername;
            if (lastCheck) lastCheck.innerText = `รอบใหม่ ${new Date().toISOString().split('T')[0]} (รอบเก่า: ${odcCurrentRound.date})`;
        }
    } else {
        // ยังไม่มีรอบ — โชว์ชื่อ user ปัจจุบัน
        if (assignedEl) assignedEl.innerText = myUsername;
        if (lastCheck) lastCheck.innerText = 'พร้อมตรวจ — กดปุ่ม "ตรวจอัตโนมัติทั้งหมด"';
    }
};

// ==========================================
// BUILD REPORT
// ==========================================
window.odc_buildReport = async function() {
    const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = odcCurrentRound?.time || '12.00';
    const assignee = odcCurrentRound?.assignee || '-';

    let report = `OD CENTER : รับผิดชอบตรวจสอบเวลา ${time} น.\n`;
    report += `📅 วันที่: ${today}\n`;
    report += `👤 ผู้ตรวจ: ${assignee}\n\n`;

    odcWebsites.forEach(w => {
        report += `${w.emoji || '🌐'}เว็บ ${w.name}${w.emoji || '🌐'}\n`;
        Object.keys(ODC_LINK_TYPES).forEach(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const result = odcResults[`${w.id}.${linkKey}`];
            let statusText = 'ยังไม่ได้ตรวจ';
            if (result) {
                if (result.status === 'ok' || result.status === 'manual_ok') {
                    statusText = (linkKey === 'group') ? `เรียบร้อย ${w.name}` : 'ปกติ';
                } else if (result.status === 'fail' || result.status === 'manual_fail') {
                    statusText = '⚠️ ผิดปกติ';
                }
            }
            report += `* ${meta.label}  /  ${statusText}\n`;
        });
        report += `\n`;
    });

    await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-purple-500">description</span> รายงาน OD Center</div>',
        html: `
            <div class="text-left">
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3 mb-3 text-xs">
                    คัดลอกข้อความแล้วไปวางใน Telegram/Line
                </div>
                <textarea id="odcReportText" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-mono leading-relaxed" rows="20">${report}</textarea>
            </div>
        `,
        width: '720px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">content_copy</span> คัดลอก',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#a855f7',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const ta = document.getElementById('odcReportText');
            if (ta) {
                ta.select();
                document.execCommand('copy');
                navigator.clipboard?.writeText(ta.value).catch(()=>{});
            }
            return true;
        }
    }).then(r => {
        if (r.isConfirmed) sop_showInlineToast('คัดลอกแล้ว ✅', 'success');
    });
};

// ==========================================
// SEND TELEGRAM
// ==========================================
window.odc_sendTelegram = async function() {
    // ใช้ config เดียวกับ sop telegram
    if (typeof sop_loadTelegramConfig === 'function') await sop_loadTelegramConfig();
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        Swal.fire({
            title: 'ยังไม่ได้ตั้งค่า Telegram',
            html: 'กรุณาเข้าไปตั้งค่า Bot Token และ Chat ID ในหน้า OD ก่อน',
            icon: 'warning',
            confirmButtonColor: '#06b6d4'
        });
        return;
    }

    const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = odcCurrentRound?.time || '12.00';
    const assignee = odcCurrentRound?.assignee || '-';

    let report = `<b>OD CENTER</b> : รับผิดชอบตรวจสอบเวลา ${time} น.\n`;
    report += `📅 ${today}    👤 ${assignee}\n\n`;

    odcWebsites.forEach(w => {
        report += `${w.emoji || '🌐'}<b>เว็บ ${w.name}</b>${w.emoji || '🌐'}\n`;
        Object.keys(ODC_LINK_TYPES).forEach(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const result = odcResults[`${w.id}.${linkKey}`];
            let statusText = '⏸️ ยังไม่ตรวจ';
            if (result) {
                if (result.status === 'ok' || result.status === 'manual_ok') {
                    statusText = (linkKey === 'group') ? `✅ เรียบร้อย ${w.name}` : '✅ ปกติ';
                } else if (result.status === 'fail' || result.status === 'manual_fail') {
                    statusText = '🔴 ผิดปกติ';
                }
            }
            report += `* ${meta.label} / ${statusText}\n`;
        });
        report += `\n`;
    });

    const confirm = await Swal.fire({
        title: 'ส่งรายงานเข้า Telegram?',
        html: `<div class="text-left text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg max-h-[400px] overflow-y-auto whitespace-pre-wrap font-mono text-xs">${report.replace(/<b>/g, '').replace(/<\/b>/g, '')}</div>`,
        showCancelButton: true,
        confirmButtonText: '📤 ส่ง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4',
        cancelButtonColor: '#64748b',
        width: '600px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังส่ง...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cfg.chat_id, text: report, parse_mode: 'HTML' })
        });
        const json = await res.json();
        if (json.ok) {
            Swal.fire({ icon: 'success', title: 'ส่งสำเร็จ! ✅', timer: 1500, showConfirmButton: false });
            // บันทึกประวัติ
            await odc_archiveRound();
        } else {
            Swal.fire('ส่งไม่สำเร็จ', json.description || 'ไม่ทราบสาเหตุ', 'error');
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// ARCHIVE (เก็บประวัติ)
// ==========================================
window.odc_archiveRound = async function() {
    if (!odcCurrentRound) return;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_history').single();
        let history = [];
        if (data && data.value) history = JSON.parse(data.value);
        history.unshift({
            ...odcCurrentRound,
            sent_at: new Date().toISOString()
        });
        // เก็บแค่ 30 รอบล่าสุด
        history = history.slice(0, 30);
        await appDB.from('settings').upsert([{ key: 'odc_history', value: JSON.stringify(history) }]);
    } catch (e) { console.warn('archive error:', e); }
};

// ==========================================
// VIEW HISTORY
// ==========================================
window.odc_viewHistory = async function() {
    Swal.fire({ title: 'กำลังโหลด...', didOpen: () => Swal.showLoading() });
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_history').single();
        const history = (data && data.value) ? JSON.parse(data.value) : [];

        if (history.length === 0) {
            Swal.fire('ไม่มีประวัติ', 'ยังไม่เคยส่งรายงาน', 'info');
            return;
        }

        const itemsHtml = history.map(h => {
            const total = odcWebsites.length * 4;
            let ok = 0, fail = 0;
            Object.values(h.results || {}).forEach(r => {
                if (r.status === 'ok' || r.status === 'manual_ok') ok++;
                else if (r.status === 'fail' || r.status === 'manual_fail') fail++;
            });
            const statusColor = fail > 0 ? '#ef4444' : (ok === total ? '#10b981' : '#eab308');
            return `
                <div class="bg-slate-50 dark:bg-slate-900 border-l-4 rounded-xl p-3 mb-2 shadow-sm" style="border-left-color: ${statusColor};">
                    <div class="font-bold text-slate-800 dark:text-white text-sm">📅 ${h.date} ${h.time || ''}</div>
                    <div class="text-xs text-gray-500 mt-1">👤 ${h.assignee || '-'} | ✅ ${ok} | 🔴 ${fail}</div>
                    <div class="text-[10px] text-gray-400">ส่ง: ${h.sent_at ? new Date(h.sent_at).toLocaleString('th-TH') : '-'}</div>
                </div>
            `;
        }).join('');

        Swal.fire({
            title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">history</span> ประวัติการตรวจ</div>',
            html: `<div class="text-left max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">${itemsHtml}</div>`,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// MANAGE WEBSITES (admin)
// ==========================================
window.odc_manageWebsites = async function() {
    function buildList() {
        if (!odcWebsites || odcWebsites.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ยังไม่มีเว็บ</div>';
        return odcWebsites.map((w, idx) => `
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-2 shadow-sm overflow-hidden">
                <div class="px-3 py-2 flex justify-between items-center gap-2 cursor-pointer" onclick="document.getElementById('odcMgrLinks_${idx}').classList.toggle('hidden')" style="border-left: 6px solid ${w.color || '#3b82f6'};">
                    <span class="text-xl">${w.emoji || '🌐'}</span>
                    <span class="text-slate-800 dark:text-white font-bold text-sm flex-1 truncate">${(w.name || '').replace(/</g, '&lt;')}</span>
                    <span class="text-[10px] text-gray-500">${Object.values(w.links || {}).filter(u=>u).length}/4 ลิงก์</span>
                    <button onclick="event.stopPropagation(); odc_removeWebsite(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="ลบ"><span class="material-icons text-[14px]">delete</span></button>
                </div>
                <div id="odcMgrLinks_${idx}" class="px-3 py-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 space-y-2">
                    ${Object.keys(ODC_LINK_TYPES).map(lk => {
                        const meta = ODC_LINK_TYPES[lk];
                        const val = (w.links || {})[lk] || '';
                        return `
                            <div>
                                <label class="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                    <span class="material-icons text-[12px]">${meta.icon}</span>${meta.label}
                                </label>
                                <input type="text" data-webidx="${idx}" data-linkkey="${lk}" value="${val.replace(/"/g, '&quot;')}" placeholder="https://..." class="odcMgrLinkInput w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-mono outline-none focus:border-blue-500">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    window.odcRebuildMgrList = () => {
        const c = document.getElementById('odcMgrListContainer');
        if (c) c.innerHTML = buildList();
    };

    const html = `
        <div class="text-left">
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">เพิ่มเว็บใหม่</div>
                <div class="grid grid-cols-3 gap-2 mb-2">
                    <input type="text" id="odcNewWebEmoji" placeholder="🔵" maxlength="3" class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-center text-lg outline-none focus:border-blue-500">
                    <input type="text" id="odcNewWebName" placeholder="ชื่อเว็บ (Jun88)" class="col-span-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-sm font-bold outline-none focus:border-blue-500">
                </div>
                <input type="color" id="odcNewWebColor" value="#3b82f6" class="w-full h-9 rounded-lg cursor-pointer">
                <button onclick="odc_addWebsite()" class="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 shadow"><span class="material-icons text-sm">add</span>เพิ่มเว็บ</button>
            </div>
            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-slate-700 pb-1 flex justify-between items-center">
                <span>เว็บที่มีอยู่</span>
                <span class="text-[9px] text-gray-400 italic">คลิกเว็บเพื่อแก้ลิงก์</span>
            </div>
            <div id="odcMgrListContainer" class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 pb-2">${buildList()}</div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-slate-500">settings</span> จัดการเว็บ</div>',
        html: html,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            // อ่านลิงก์ทั้งหมดจาก inputs
            document.querySelectorAll('.odcMgrLinkInput').forEach(inp => {
                const wIdx = parseInt(inp.dataset.webidx);
                const lk = inp.dataset.linkkey;
                if (odcWebsites[wIdx]) {
                    if (!odcWebsites[wIdx].links) odcWebsites[wIdx].links = {};
                    odcWebsites[wIdx].links[lk] = inp.value.trim();
                }
            });
            return true;
        }
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await odc_saveWebsites();
        odc_renderWebsites();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ ✅', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.odc_addWebsite = function() {
    const emoji = (document.getElementById('odcNewWebEmoji').value || '🌐').trim();
    const name = (document.getElementById('odcNewWebName').value || '').trim();
    const color = document.getElementById('odcNewWebColor').value || '#3b82f6';
    if (!name) { Swal.showValidationMessage('กรุณาใส่ชื่อเว็บ'); return; }
    Swal.resetValidationMessage();

    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (odcWebsites.some(w => w.id === id || w.name === name)) {
        Swal.showValidationMessage('มีเว็บนี้อยู่แล้ว'); return;
    }
    odcWebsites.push({
        id, name, emoji, color,
        links: { login: '', referral: '', apk: '', group: '' }
    });
    document.getElementById('odcNewWebName').value = '';
    document.getElementById('odcNewWebEmoji').value = '';
    if (window.odcRebuildMgrList) window.odcRebuildMgrList();
};

window.odc_removeWebsite = function(idx) {
    Swal.fire({
        title: 'ลบเว็บนี้?',
        html: `<div class="text-sm">เว็บ <b>${odcWebsites[idx]?.name || ''}</b> จะถูกลบ`,
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b'
    }).then(r => {
        if (r.isConfirmed) {
            odcWebsites.splice(idx, 1);
            if (window.odcRebuildMgrList) window.odcRebuildMgrList();
        }
    });
};

// helper toast (ถ้าหน้า sop ไม่ได้โหลด)
if (typeof window.sop_showInlineToast !== 'function') {
    window.sop_showInlineToast = function(msg, type) {
        type = type || 'info';
        let t = document.getElementById('odcInlineToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'odcInlineToast';
            t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:10px 16px;border-radius:12px;font-weight:bold;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,0.25);pointer-events:none;transition:opacity 0.2s;';
            document.body.appendChild(t);
        }
        let bg = '#3b82f6';
        if (type === 'success') bg = '#10b981';
        else if (type === 'error') bg = '#ef4444';
        else if (type === 'info') bg = '#0ea5e9';
        t.style.background = bg; t.style.color = 'white';
        t.innerText = msg;
        t.style.opacity = '1';
        setTimeout(() => {
            if (t) { t.style.opacity = '0'; setTimeout(() => { if (t && t.parentNode) t.remove(); }, 250); }
        }, 1800);
    };
}
