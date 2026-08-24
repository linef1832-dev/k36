// ==========================================
// 🧠 ตัวแปรส่วนกลาง (Global Variables)
// ==========================================
const DB_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGJidGp4dWlkZnVicGlhdXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjQ2ODgsImV4cCI6MjA4MzIwMDY4OH0.4orJyfFcOwnZcnHFjLOTLXaqFNeapCVe9yCxj3rLMBM';

let appDB;
let currentUser = {};
let TEAM_LIST = ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188'];
let GLOBAL_USER_LIST = [];

// ==========================================
// 🔧 [FIX] safeSetItem / safeGetItem — ป้องกัน localStorage เต็มหรือ Private Mode
// ฟังก์ชันนี้ถูกเรียกจาก auth.js, system_core.js, duty.js, discord.js ฯลฯ
// แต่ไม่เคยถูก define ไว้ที่ไหน ทำให้ ReferenceError ทุกครั้งที่เรียก
// ==========================================
window.safeSetItem = function(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('[safeSetItem] localStorage error:', e);
    }
};

window.safeGetItem = function(key, fallback) {
    try {
        const val = localStorage.getItem(key);
        return val !== null ? val : (fallback !== undefined ? fallback : null);
    } catch (e) {
        console.warn('[safeGetItem] localStorage error:', e);
        return fallback !== undefined ? fallback : null;
    }
};

// ==========================================
// 🚀 เริ่มทำงานเมื่อเปิดเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    if(savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        const themeIcon = document.getElementById('themeIcon');
        if(themeIcon) themeIcon.innerText = 'light_mode';
        const cb = document.getElementById('themeToggleCb');
        if(cb) cb.checked = true;
    }

    if (window.supabase) {
        appDB = window.supabase.createClient(DB_URL, DB_KEY);
    }

    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        // 🔄 ฟังการเปลี่ยนกะ/แผนก/ทีมของตัวเองแบบ realtime (เดิมมีฟังก์ชันแต่ไม่เคยถูกเรียก)
        setTimeout(() => { if (typeof window.subscribeUserChanges === 'function') window.subscribeUserChanges(); }, 300);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');

        // [FIX] โหลด dept_menu_rules จาก DB ก่อนแสดงเมนู
        // ปัญหาเดิม: applySidebarPermissions รันก่อน loadSettings เสร็จ
        // ทำให้ SETTINGS['dept_menu_rules'] ยังว่าง → เมนูทุกอย่างถูกซ่อนหมด
        // วิธีแก้: ดึง dept_menu_rules ตรงๆ ก่อน 1 ครั้ง แล้วค่อย showPage
        if (appDB) {
            try {
                const { data } = await appDB
                    .from('settings')
                    .select('value')
                    .eq('key', 'dept_menu_rules')
                    .maybeSingle();
                if (data && data.value) {
                    // อัปเดตทั้ง SETTINGS และ cache ในคราวเดียว
                    if (typeof SETTINGS !== 'undefined') {
                        SETTINGS['dept_menu_rules'] = data.value;
                    }
                    window.safeSetItem('cached_menu_rules', data.value);
                }
            } catch(e) {
                console.warn('[startup] dept_menu_rules fetch failed, falling back to cache', e);
            }
        }

        showPage('dashboard');
    } else {
        showLogin();
    }
});

// ==========================================
// 🔄 ระบบดึงหน้าเว็บ (Router) และกระตุ้นสมองกล
// ==========================================
async function showLogin() {
    const loading = document.getElementById('loading');
    if(loading) loading.classList.remove('hidden');
    try {
        const response = await fetch(`./pages/login.html?v=${window._APP_VERSION || Date.now()}`);
        const html = await response.text();
        document.getElementById('login-container').innerHTML = html;
        
        if(typeof setupPinInputs === 'function') setupPinInputs();
        
        const savedName = localStorage.getItem('remember_me_name');
        if (savedName && document.getElementById('loginName')) {
            document.getElementById('loginName').value = savedName;
            document.getElementById('rememberMe').checked = true;
        }
    } catch (err) {
        console.error('Error loading login:', err);
    } finally {
        if(loading) loading.classList.add('hidden');
    }
}

// 1. สร้างตัวแปรเก็บ Cache สำหรับ HTML String
const pageCache = {};

// ==========================================
// 🧹 ระบบจัดการ Realtime Subscriptions ตามหน้า (กัน memory leak)
// ==========================================
window._pageSubscriptions = window._pageSubscriptions || new Set();

window.registerPageSubscription = function(channel) {
    if (!channel) return channel;
    window._pageSubscriptions.add(channel);
    return channel;
};

window.cleanupPageSubscriptions = function() {
    if (!appDB || !window._pageSubscriptions || window._pageSubscriptions.size === 0) return;
    window._pageSubscriptions.forEach(ch => {
        try { appDB.removeChannel(ch); } catch (e) { /* ignore */ }
    });
    window._pageSubscriptions.clear();
};

// ==========================================
// 🧹 ระบบจัดการ setInterval / setTimeout ตามหน้า (กัน CPU drain)
// ==========================================
window._pageIntervals = window._pageIntervals || new Set();

window.registerPageInterval = function(intervalId) {
    if (!intervalId) return intervalId;
    window._pageIntervals.add(intervalId);
    return intervalId;
};

window.cleanupPageIntervals = function() {
    if (!window._pageIntervals || window._pageIntervals.size === 0) return;
    window._pageIntervals.forEach(id => {
        try { clearInterval(id); } catch (e) { /* ignore */ }
    });
    window._pageIntervals.clear();
};

// ==========================================
// 📦 [PERF] โหลด JS เฉพาะหน้าที่เปิด
// เดิม index.html โหลดทุกไฟล์ ~2 MB ตั้งแต่เปิดเว็บ ทั้งที่ใช้แค่ 1-2 หน้า
// ตอนนี้โหลดแค่ global/auth/system_core/dashboard/sheet/wrapped ก่อน
// ไฟล์ของแต่ละหน้าจะถูกดึงตอนกดเข้าหน้านั้นครั้งแรก (โหลดแล้วจำไว้ ไม่โหลดซ้ำ)
// เปลี่ยน version ทีเดียวที่ window._APP_VERSION ใน index.html
// ==========================================
const PAGE_SCRIPTS = {
    leave:             ['leave', 'swap'],
    swap:              ['leave', 'swap'],
    duty:              ['duty'],
    discord:           ['discord'],
    summary:           ['summary'],
    telegram:          ['Telegram'],
    password:          ['Password'],
    files:             ['FilesApp'],
    od_config:         ['od_config'],
    kbiz:              ['kbiz'],
    gallery:           ['gallery'],
    logo_editor:       ['logo_editor'],
    fine:              ['fine'],
    withdrawal_report: ['withdrawal_report'],
    sop:               ['sop'],
    ip_check:          ['ip_check'],
    slip_check:        ['slip_check'],
};
window._loadedScripts = {};
window.loadScript = function(name) {
    if (window._loadedScripts[name]) return window._loadedScripts[name];
    window._loadedScripts[name] = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = `./js/${name}.js?v=${window._APP_VERSION || Date.now()}`;
        el.onload = () => resolve(name);
        el.onerror = () => { delete window._loadedScripts[name]; reject(new Error(`โหลดไฟล์ ${name}.js ไม่สำเร็จ`)); };
        document.head.appendChild(el);
    });
    return window._loadedScripts[name];
};
window.loadPageScripts = async function(pageName) {
    const list = PAGE_SCRIPTS[pageName] || [];
    for (const n of list) await window.loadScript(n);   // ตามลำดับ (leave ต้องมาก่อน swap)
};
// ฟังก์ชันที่ถูกเรียกข้ามหน้า (เช่น dashboard เรียกของ duty) — ตัวแทนจะโหลดไฟล์จริงก่อนแล้วค่อยเรียก
window.lazyStub = function(fnName, scriptName) {
    if (typeof window[fnName] === 'function') return;
    const stub = async function(...args) {
        await window.loadScript(scriptName);
        if (typeof window[fnName] === 'function' && window[fnName] !== stub) return window[fnName](...args);
        throw new Error(`${fnName} ไม่พบใน ${scriptName}.js`);
    };
    window[fnName] = stub;
};
window.lazyStub('loadExcelLibrary', 'summary');         // leave.js → summary.js
window.lazyStub('initSlipCheck', 'slip_check');
window.lazyStub('initOdConfig', 'od_config');

// ==========================================
// 🍽️ [กติกาพัก] "พักพร้อมกันได้ไม่เกินกี่คน — ต่อเว็บ — อัตโนมัติตามตารางหน้าที่"
// นับคนของแต่ละเว็บ (หลัก + รอง รวมกัน) จากตารางจัดหน้าที่ของวันนั้น แล้วใช้กติกา:
//   1-4 คน→1, 5-7→2, 8-10→3, 11-14→4, 15-20→5, 21-25→6, 26-30→7, 31+→8
// แยก AM / OD เพราะแต่ละแผนกมีตารางหน้าที่ของตัวเอง ไม่ปนกัน — ไม่มีค่าให้ตั้ง ไม่ต้องกดคำนวณ
// ==========================================
window.breakCapByRule = function(total) {
    if (!total || total <= 0) return 0;
    if (total <= 4) return 1;
    if (total <= 7) return 2;
    if (total <= 10) return 3;
    if (total <= 14) return 4;
    if (total <= 20) return 5;
    if (total <= 25) return 6;
    if (total <= 30) return 7;
    return 8;
};
// สร้างแผนที่จากตารางหน้าที่ — 🌟 แยกกลุ่ม "หลัก" กับ "รอง" ของแต่ละเว็บออกจากกัน
// กติกา: หลักชนหลัก (เว็บเดียวกัน) ❌ | รองชนรอง (เว็บเดียวกัน) ❌ | หลักชนรอง ✅
// เหตุผล: ถ้าหลักไปพัก ยังมีรองเฝ้า / ถ้ารองไปพัก ยังมีหลักเฝ้า → หน้างานไม่มีวันโล่ง
window.buildCoverageMap = function(roster) {
    const webs = {};        // "เว็บ (หลัก)" หรือ "เว็บ (รอง)" -> Set(username)
    const websOf = {};      // username -> ["เว็บ (หลัก)", "เว็บ (รอง)", ...]
    for (const team in (roster || {})) {
        (roster[team] || []).forEach(u => {
            if (!u || !u.username || String(u.username).includes('ขาดคน')) return;
            const add = (t) => {
                if (!t) return;
                (webs[t] = webs[t] || new Set()).add(u.username);
                (websOf[u.username] = websOf[u.username] || []);
                if (!websOf[u.username].includes(t)) websOf[u.username].push(t);
            };
            add(`${team} (หลัก)`);                                        // คนนี้เป็นหลักของเว็บนี้
            if (u.secondary_team) add(`${u.secondary_team} (รอง)`);       // และเป็นรองของอีกเว็บ
        });
    }
    return { webs, websOf };
};
// เช็คว่า username พักช่วงนี้ได้ไหม — ทุกเว็บที่เขารับผิดชอบต้องยังไม่เต็มเพดาน
// → { ok, problems:[{team, used, cap, total}], canLeave }
window.checkCoverage = function(username, covMap, slotBookings) {
    const myWebs = (covMap && covMap.websOf[username]) || [];
    if (myWebs.length === 0) return { ok: true, problems: [], canLeave: Infinity };
    const onBreak = new Set((slotBookings || []).map(b => b.staff_name).filter(Boolean));
    const problems = [];
    let canLeave = Infinity;
    myWebs.forEach(team => {
        const members = covMap.webs[team] || new Set();
        let used = 0;
        members.forEach(n => { if (n !== username && onBreak.has(n)) used++; });
        const cap = window.breakCapByRule(members.size);
        if (used >= cap) problems.push({ team, used, cap, total: members.size });
        canLeave = Math.min(canLeave, Math.max(0, cap - used));
    });
    return { ok: problems.length === 0, problems, canLeave };
};

async function showPage(pageName) {
    const loading = document.getElementById('loading');

    // 🧹 ก่อนเปลี่ยนหน้า: เคลียร์ subscription + intervals ของหน้าเดิมเพื่อกัน leak
    window.cleanupPageSubscriptions();
    window.cleanupPageIntervals();

    try {
        if (!pageCache[pageName] && loading) loading.classList.remove('hidden');
        
        if (!pageCache[pageName]) {
            const _v = window._APP_VERSION || Date.now();
            const response = await fetch(`./pages/${pageName}.html?v=${_v}`);
            if (!response.ok) throw new Error('Page not found');
            pageCache[pageName] = await response.text();
        }
        // 📦 โหลด JS ของหน้านี้ (ครั้งแรกเท่านั้น)
        if (loading) loading.classList.remove('hidden');
        await window.loadPageScripts(pageName);
        
        const htmlContent = pageCache[pageName];

        const updateDOM = () => {
            const appContent = document.getElementById('app-content');
            appContent.innerHTML = htmlContent;
            appContent.classList.remove('hidden');
            
            document.querySelectorAll('.nm-menu-title').forEach(el => el.classList.remove('active'));
            const activeBtn = document.querySelector(`button[onclick*="showPage('${pageName}')"]`);
            if (activeBtn) activeBtn.classList.add('active');

            requestAnimationFrame(async () => {
                if(document.getElementById('uName') && currentUser && currentUser.username) {
                    document.getElementById('uName').innerText = currentUser.username;
                }

                if (pageName === 'dashboard') {
                    if (typeof initDashboard === 'function') initDashboard();
                    if (typeof refreshAdminData === 'function') refreshAdminData();
                    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                        if (document.getElementById('userManagerUIBlock')) {
                            document.getElementById('userManagerUIBlock').classList.remove('hidden');
                            document.getElementById('userManagerUIBlock').classList.add('flex');
                        }
                    }
                }
                else if (pageName === 'fine') {
                    if (typeof initFineApp === 'function') await initFineApp();
                }

                else if (pageName === 'sop') {
                    if (typeof initSopApp === 'function') await initSopApp();
                }
                else if (pageName === 'od_center') {
                    if (typeof initOdCenterApp === 'function') await initOdCenterApp();
                }
                else if (pageName === 'leave') {
                    if (typeof initLeaveTable === 'function') await initLeaveTable();
                }
                else if (pageName === 'gallery') {
                    if (typeof initGalleryApp === 'function') initGalleryApp();
                }
                else if (pageName === 'logo_editor') {
                    if (typeof initLogoEditorApp === 'function') initLogoEditorApp();
                }
                else if (pageName === 'duty') {
                    if (typeof initDutyApp === 'function') await initDutyApp();
                }
                else if (pageName === 'discord') {
                    if (typeof applyDiscordPermissions === 'function') applyDiscordPermissions();
                }
                else if (pageName === 'withdrawal_report') {
                    if (typeof initWithdrawalReport === 'function') await initWithdrawalReport();
                }
                else if (pageName === 'summary') {
                    if (typeof initSummaryDate === 'function') initSummaryDate();
                    if (typeof fetchAvailableDates === 'function') fetchAvailableDates(); 
                    if (typeof fetchHistoricalSummary === 'function') await fetchHistoricalSummary(true); 
                }
                else if (pageName === 'telegram') {
                    if (typeof initTelegramApp === 'function') await initTelegramApp();
                }
                else if (pageName === 'password') {
                    if (typeof initPasswordApp === 'function') await initPasswordApp();
                }
                else if (pageName === 'files') {
                    if (typeof initFilesApp === 'function') await initFilesApp(); 
                }
                else if (pageName === 'od_config') {
                    if (typeof initOdConfig === 'function') await initOdConfig();
                }
                else if (pageName === 'sheet') {
                    if (typeof fetchSheets === 'function') await fetchSheets(); 
                    if (typeof renderSheetMenu === 'function') renderSheetMenu();
                    if (typeof renderRecentTabs === 'function') renderRecentTabs();
                    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
                        if(document.getElementById('sheetAdminControls')) document.getElementById('sheetAdminControls').classList.remove('hidden');
                    }
                    const sheetApp = document.getElementById('sheetApp');
                    if (sheetApp) {
                        sheetApp.classList.remove('hidden');
                        sheetApp.classList.add('flex');
                    }
                    if (document.getElementById('sheetMenu')) document.getElementById('sheetMenu').classList.remove('hidden');
                    if (document.getElementById('sheetViewer')) {
                        document.getElementById('sheetViewer').classList.add('hidden');
                        document.getElementById('sheetViewer').classList.remove('flex');
                    }
                }
                else if (pageName === 'kbiz') {
                    if (typeof fetchKbizData === 'function') await fetchKbizData();
                }

                else if (pageName === 'swap') {
                    if (typeof openAutoSwapModal === 'function') await openAutoSwapModal();
                }
                else if (pageName === 'ip_check') {
                    if (typeof initIpCheckApp === 'function') await initIpCheckApp();
                }
                else if (pageName === 'slip_check') {
                    if (typeof window.initSlipCheck === 'function') await window.initSlipCheck();
                }
            });
        };

        if (document.startViewTransition) {
            const transition = document.startViewTransition(() => updateDOM());
            try { await transition.updateCallbackDone; } catch (e) { /* ignore */ }
        } else {
            updateDOM();
        }

    } catch (err) {
        console.error(err);
        document.getElementById('app-content').innerHTML = `<div class="p-10 text-center text-red-500 font-bold">เกิดข้อผิดพลาดในการโหลดหน้า ${pageName}<br><br><span class="text-xs text-gray-500">${err.message}</span></div>`;
    } finally {
        if(loading) loading.classList.add('hidden');
    }
}

// ==========================================
// 🎨 ระบบเปลี่ยนโหมดสี
// ==========================================
function toggleTheme() {
    const cb = document.getElementById('themeToggleCb');
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'light_mode';
        localStorage.setItem('theme', 'light');
        if(cb) cb.checked = false;
    } else {
        document.documentElement.classList.add('dark');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'dark_mode';
        localStorage.setItem('theme', 'dark');
        if(cb) cb.checked = true;
    }
}

// ==========================================
// 🧩 ระบบดึง HTML Template
// ==========================================
window.renderTemplate = function(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return '';
    let html = tpl.innerHTML;
    for (const key in data) {
        html = html.split(`{{${key}}}`).join(data[key] !== undefined && data[key] !== null ? data[key] : '');
    }
    return html;
};

// ==========================================
// 🛠️ ฟังก์ชันเพิ่มแผนก และ Role ลงฐานข้อมูล
// ==========================================
window.addCustomPermDept = async function() {
    const inputEl = document.getElementById('newDeptInput');
    if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อแผนก', 'error');
    
    const deptName = inputEl.value.toUpperCase().trim();
    if (!deptName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อแผนกก่อนกดเพิ่มครับ', 'warning');

    let currentDepts = [];
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'custom_departments').single();
        if(data && data.value) currentDepts = JSON.parse(data.value);
    } catch(e) {}

    if (!currentDepts.includes(deptName)) {
        currentDepts.push(deptName);
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        await appDB.from('settings').upsert([{ key: 'custom_departments', value: JSON.stringify(currentDepts) }]);
        
        inputEl.value = '';
        await window.loadSettings();
        
        Swal.fire({icon: 'success', title: 'สำเร็จ', text: `เพิ่มแผนก ${deptName} แล้ว`, timer: 1500, showConfirmButton: false});
    } else {
        Swal.fire('เตือน', 'มีแผนกนี้ในระบบแล้ว', 'warning');
    }
};

window.addCustomPermRole = async function() {
    const inputEl = document.getElementById('newRoleInput');
    if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อ Role', 'error');
    
    const roleName = inputEl.value.toLowerCase().trim();
    if (!roleName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อ Role ก่อนกดเพิ่มครับ', 'warning');

    let currentRoles = [];
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'custom_roles').single();
        if(data && data.value) currentRoles = JSON.parse(data.value);
    } catch(e) {}

    if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        await appDB.from('settings').upsert([{ key: 'custom_roles', value: JSON.stringify(currentRoles) }]);
        
        inputEl.value = '';
        await window.loadSettings();
        
        Swal.fire({icon: 'success', title: 'สำเร็จ', text: `เพิ่มตำแหน่ง ${roleName.toUpperCase()} แล้ว`, timer: 1500, showConfirmButton: false});
    } else {
        Swal.fire('เตือน', 'มีตำแหน่งนี้ในระบบแล้ว', 'warning');
    }
};

// ==========================================
// 🗑️ ฟังก์ชันลบแผนก และ Role ที่สร้างเอง
// ==========================================
window.deleteCustomPermDept = async function(dept) {
    Swal.fire({
        title: `ลบแผนก ${dept}?`,
        text: 'ลบแล้วจะไม่แสดงในตารางอีก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบเลย',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            let dbDepts = [];
            try { dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]'); } catch(e) {}
            
            dbDepts = dbDepts.filter(d => d !== dept);
            SETTINGS['custom_departments'] = JSON.stringify(dbDepts);
            
            await appDB.from('settings').upsert([{ key: 'custom_departments', value: JSON.stringify(dbDepts) }]);
            window.renderPermsTable();
            Swal.fire({icon: 'success', title: 'ลบแผนกสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

window.deleteCustomPermRole = async function() {
    let dbRoles = [];
    try { dbRoles = JSON.parse(SETTINGS['custom_roles'] || '[]'); } catch(e) {}
    
    if (dbRoles.length === 0) return Swal.fire('ไม่มี Role ให้ลบ', 'มีแต่ Role มาตรฐานของระบบครับ', 'info');

    let options = {};
    dbRoles.forEach(r => options[r] = r.toUpperCase());

    const { value: roleToDelete } = await Swal.fire({
        title: 'เลือกลบ Role ที่สร้างเอง',
        input: 'select',
        inputOptions: options,
        inputPlaceholder: '-- เลือก Role ที่ต้องการลบ --',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบทิ้ง',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });

    if (roleToDelete) {
        Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        dbRoles = dbRoles.filter(r => r !== roleToDelete);
        SETTINGS['custom_roles'] = JSON.stringify(dbRoles);
        
        await appDB.from('settings').upsert([{ key: 'custom_roles', value: JSON.stringify(dbRoles) }]);
        window.renderPermsTable();
        Swal.fire({icon: 'success', title: 'ลบ Role สำเร็จ', timer: 1000, showConfirmButton: false});
    }
};

// ==========================================
// ✏️ ฟังก์ชันเปลี่ยนชื่อแผนก และอัปเดตพนักงานทั้งระบบ
// ==========================================
window.renameCustomPermDept = async function(oldDept) {
    const { value: newDeptRaw } = await Swal.fire({
        title: `เปลี่ยนชื่อแผนก ${oldDept}`,
        input: 'text',
        inputValue: oldDept,
        inputPlaceholder: 'พิมพ์ชื่อแผนกใหม่...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });

    if (newDeptRaw) {
        const newDept = newDeptRaw.toUpperCase().trim();
        if (!newDept || newDept === oldDept) return;

        let dbDepts = [];
        try { dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]'); } catch(e) {}

        if (dbDepts.includes(newDept) || ['AM', 'OD', 'AMQL'].includes(newDept)) {
            return Swal.fire('เตือน', 'มีแผนกชื่อนี้อยู่ในระบบแล้วครับ', 'warning');
        }

        Swal.fire({title: 'กำลังอัปเดตข้อมูลทั้งระบบ...', text: 'โปรดรอสักครู่...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

        try {
            dbDepts = dbDepts.map(d => d === oldDept ? newDept : d);
            SETTINGS['custom_departments'] = JSON.stringify(dbDepts);

            let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
            Object.keys(newPerms).forEach(key => {
                if (key.startsWith(oldDept + '_')) {
                    const newKey = key.replace(oldDept + '_', newDept + '_');
                    newPerms[newKey] = newPerms[key];
                    delete newPerms[key];
                }
            });
            MENU_PERMS = newPerms;
            SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
            window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));

            await appDB.from('settings').upsert([
                { key: 'custom_departments', value: JSON.stringify(dbDepts) },
                { key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }
            ]);

            await appDB.from('users').update({ department: newDept }).eq('department', oldDept);

            if (typeof GLOBAL_USER_LIST !== 'undefined') {
                GLOBAL_USER_LIST.forEach(u => {
                    if (u.department === oldDept) u.department = newDept;
                });
            }

            window.renderPermsTable();
            if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();

            Swal.fire({icon: 'success', title: 'เปลี่ยนชื่อแผนกสำเร็จ!', text: `ระบบอัปเดตแท็กของพนักงานทุกคนเป็น ${newDept} เรียบร้อยแล้วครับ 🎉`, timer: 2500, showConfirmButton: false});

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
    }
};

// ==========================================
// 🗄️ Settings Cache — ลด Supabase query
// ==========================================
const _settingsCache = {};
const _SETTINGS_TTL  = 5 * 60 * 1000;

window.getSettingCached = async function(key) {
    const now = Date.now();
    if (_settingsCache[key] && (now - _settingsCache[key].ts) < _SETTINGS_TTL) {
        return _settingsCache[key].value;
    }
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', key).maybeSingle();
        const val = data?.value ?? null;
        _settingsCache[key] = { value: val, ts: now };
        return val;
    } catch(e) {
        return _settingsCache[key]?.value ?? null;
    }
};

window.clearSettingCache = function(key) {
    if (key) delete _settingsCache[key];
    else Object.keys(_settingsCache).forEach(k => delete _settingsCache[k]);
};

// ==========================================
// 🗄️ Users Cache — ลด query users table
// ==========================================
let _usersCacheTs = 0;
const _USERS_TTL  = 3 * 60 * 1000;

window.getUsersCached = async function() {
    const now = Date.now();
    if (GLOBAL_USER_LIST.length > 0 && (now - _usersCacheTs) < _USERS_TTL) {
        return GLOBAL_USER_LIST;
    }
    try {
        const { data } = await appDB.from('users').select('*');
        if (data) {
            GLOBAL_USER_LIST = data;
            _usersCacheTs = now;
        }
        return GLOBAL_USER_LIST;
    } catch(e) {
        return GLOBAL_USER_LIST;
    }
};

window.clearUsersCache = function() { _usersCacheTs = 0; };

// ==========================================
// 📡 debouncedBroadcast — broadcast realtime แบบ debounce กัน spam
// ถูกเรียกจาก duty.js 16+ จุด แต่ไม่เคย define ไว้ที่ไหน
// ==========================================
(function() {
    const _timers = {};
    window.debouncedBroadcast = function(channel, event, delay) {
        delay = delay || 800;
        if (_timers[channel]) clearTimeout(_timers[channel]);
        _timers[channel] = setTimeout(function() {
            try {
                if (typeof appDB !== 'undefined' && appDB.channel) {
                    appDB.channel(channel).send({
                        type: 'broadcast',
                        event: event || 'force_reload'
                    });
                }
            } catch(e) {
                console.warn('[debouncedBroadcast] failed:', e);
            }
            delete _timers[channel];
        }, delay);
    };
})();

// ====== TAG Badge Helper ======
// ── ป้าย TAG ────────────────────────────────────────────────────────────
// TAG บอก "รูปแบบการทำงาน" อย่างเดียว: ONLINE / TEMP / ONSITE
// ส่วน "แผนก" (AM / OD) มาจากช่อง department ซึ่งเป็นตัวคุมสิทธิ์ ไม่เกี่ยวกับ TAG
// ป้ายที่แสดงจะประกอบสองอย่างเข้าด้วยกัน เช่น  AM · ONLINE
window.TAG_OPTIONS = [
    { value: 'ONLINE', label: 'ONLINE', desc: 'ออนไลน์ — ถ่ายรูปเช็คชื่อ' },
    { value: 'TEMP',   label: 'TEMP',   desc: 'ออนไลน์ชั่วคราว — ถ่ายรูปอีกกลุ่ม' },
    { value: 'ONSITE', label: 'ONSITE', desc: 'หน้างาน — ไม่ต้องถ่ายรูป' },
];

// ตัดแผนกให้เหลือสายหลัก: AMQL / AMTT / AM → AM · ODQL / OD → OD
window.getDeptPrefix = function(department) {
    const d = String(department || '').toUpperCase();
    if (d.startsWith('AM')) return 'AM';
    if (d.startsWith('OD')) return 'OD';
    return d || '';
};

window.getTagBadge = function(tag, department) {
    if (!tag) return '';
    // ป้ายสองโทน — ครึ่งซ้ายคือ "สายงาน" (สีเป็นตัวบอก) ครึ่งขวาคือ "รูปแบบการทำงาน"
    // แยกเป็นสองช่องจริง ๆ แทนการใช้จุดคั่น เพราะสองค่านี้มาจากคนละช่องข้อมูล
    // ตาจะจับสีก่อน (AM/OD) แล้วค่อยอ่านข้อความ (ONLINE/TEMP/ONSITE)
    const palette = {
        'AM': { solid:'#16a34a', tint:'#86efac', glow:'rgba(22,163,74,.45)' },   // เขียว
        'OD': { solid:'#ea580c', tint:'#fdba74', glow:'rgba(234,88,12,.45)' },   // ส้ม
    };
    const prefix = window.getDeptPrefix(department);
    const p = palette[prefix] || { solid:'#475569', tint:'#cbd5e1', glow:'rgba(71,85,105,.4)' };

    // ── หมายเหตุเรื่องการจัดกึ่งกลาง ────────────────────────────────────
    // 1) แนวนอน: letter-spacing เติมช่องว่างท้ายตัวอักษรตัวสุดท้ายด้วย
    //    ข้อความจึงดูเบี้ยวไปทางซ้าย → ลด padding ขวาลงเท่ากับ letter-spacing
    // 2) แนวตั้ง: ตัวพิมพ์ใหญ่ล้วนไม่มีหางล่าง กล่องตัวอักษรจึงเหลือที่ว่าง
    //    ด้านล่างมากกว่าด้านบน ตาเลยเห็นว่าลอยสูง → ดันลงครึ่งพิกเซล
    const H = 18;
    const wrap = `display:inline-flex;align-items:stretch;margin-left:7px;vertical-align:middle;`
        + `border-radius:999px;overflow:hidden;font-size:9px;line-height:1;`
        + `white-space:nowrap;flex-shrink:0;height:${H}px;`
        + `box-shadow:0 1px 3px ${p.glow}, inset 0 0 0 1px ${p.solid}66;`;
    const cell = `display:flex;align-items:center;justify-content:center;box-sizing:border-box;height:100%;`;
    const left = cell + `background:${p.solid};color:#fff;padding:0 8.1px 0 9px;`
        + `font-weight:900;letter-spacing:.9px;text-shadow:0 1px 1px rgba(0,0,0,.28);`;
    const right = cell + `background:#0f172a;color:${p.tint};padding:0 9px 0 10px;`
        + `font-weight:800;letter-spacing:1px;border-left:1px solid rgba(255,255,255,.14);`;
    const nudge = `position:relative;top:.5px;display:block;`;

    const cellHtml = (style, txt) => `<span style="${style}"><span style="${nudge}">${txt}</span></span>`;
    if (!prefix) return `<span style="${wrap}">${cellHtml(right, tag)}</span>`;
    return `<span style="${wrap}">${cellHtml(left, prefix)}${cellHtml(right, tag)}</span>`;
};

window.getTagBadgeByName = function(name) {
    if (!window.GLOBAL_USER_LIST || !name) return '';
    const u = window.GLOBAL_USER_LIST.find(x =>
        x.username && x.username.toLowerCase() === name.toLowerCase()
    );
    return u ? window.getTagBadge(u.tag, u.department) : '';
};
// ====== จบ TAG Badge Helper ======
