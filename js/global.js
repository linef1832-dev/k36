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
// 🔗 [FIX] ผูก currentUser / GLOBAL_USER_LIST เข้ากับ window ให้เป็น "ตัวเดียวกัน"
// ตัวแปรที่ประกาศด้วย let ที่ระดับบนสุดของสคริปต์ จะไม่กลายเป็น property ของ window
// แต่โค้ดในโปรเจกต์อ่าน/เขียนปนกันทั้งสองแบบ (บางไฟล์ใช้ชื่อตรง ๆ บางไฟล์ใช้ window.)
// จึงกลายเป็นตัวแปรคนละตัว เช่น dashboard.js เขียน window.currentUser
// แต่ system_core.js อ่าน currentUser ตรง ๆ เลยได้ค่าเก่า
// ผูกด้วย accessor ทำให้เป็นตัวเดียวกันจริง โดยไม่ต้องไล่แก้จุดเรียกทั้ง 86 จุด
// ==========================================
Object.defineProperty(window, 'currentUser', {
    get: function() { return currentUser; },
    set: function(v) { currentUser = v; },
    configurable: true, enumerable: true
});
Object.defineProperty(window, 'GLOBAL_USER_LIST', {
    get: function() { return GLOBAL_USER_LIST; },
    set: function(v) { GLOBAL_USER_LIST = v; },
    configurable: true, enumerable: true
});

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
// 🛡️ แจ้งเตือนเมื่อ "เขียนฐานข้อมูลไม่สำเร็จ"
// ปัญหาเดิม: มี 56 จุดในโปรเจกต์ที่เขียน DB แล้วเด้ง "สำเร็จ" ทันทีโดยไม่เช็ค error
// ถ้า Supabase ปฏิเสธ (สิทธิ์ RLS / เน็ตหลุด / ข้อมูลผิดรูป) ผู้ใช้จะเห็นว่าบันทึกแล้ว
// ทั้งที่ข้อมูลไม่เข้า แล้วเดินจากไปโดยไม่รู้ตัว
//
// วิธีแก้: ดักที่ตัว Supabase client จุดเดียว แทนการไล่แก้ทีละ 56 จุด
//   - ทำงานเฉพาะตอน error เท่านั้น ตอนสำเร็จทุกอย่างเหมือนเดิม 100%
//   - ไม่แตะค่าที่คืนกลับ โค้ดเดิมที่เช็ค error เองอยู่แล้วยังทำงานเหมือนเดิม
//   - ใช้แถบแจ้งเตือนของตัวเอง ไม่ใช้ SweetAlert เพราะ popup "สำเร็จ" ของโค้ดเดิม
//     จะขึ้นทับ toast ทันที ทำให้ผู้ใช้ไม่ทันเห็น
// ==========================================
window._showDbError = function(msg) {
    try {
        if (!document.body) return;
        let box = document.getElementById('dbErrorBanner');
        if (!box) {
            box = document.createElement('div');
            box.id = 'dbErrorBanner';
            box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:min(560px,92vw);display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:14px;background:#7f1d1d;border:1px solid #ef4444;color:#fee2e2;font-size:13px;line-height:1.5;box-shadow:0 12px 32px -8px rgba(0,0,0,.6);cursor:pointer;';
            box.title = 'คลิกเพื่อปิด';
            box.onclick = function() { box.remove(); };
            document.body.appendChild(box);
        }
        box.textContent = '';
        const ic = document.createElement('span');
        ic.className = 'material-icons';
        ic.style.cssText = 'font-size:18px;color:#fca5a5;flex-shrink:0';
        ic.textContent = 'error_outline';
        const wrap = document.createElement('span');
        const t1 = document.createElement('b');
        t1.style.cssText = 'display:block;margin-bottom:2px';
        t1.textContent = 'บันทึกลงฐานข้อมูลไม่สำเร็จ';
        const t2 = document.createElement('span');
        t2.style.cssText = 'opacity:.9;word-break:break-word';
        t2.textContent = msg;
        wrap.appendChild(t1); wrap.appendChild(t2);
        box.appendChild(ic); box.appendChild(wrap);
        clearTimeout(box._t);
        box._t = setTimeout(function() { if (box.parentNode) box.remove(); }, 9000);
    } catch (e) { console.warn('[_showDbError]', e); }
};

window._installDbWriteGuard = function(db) {
    if (!db || typeof db.from !== 'function' || db.__writeGuardOn) return;
    db.__writeGuardOn = true;

    let lastMsg = '', lastAt = 0;
    // ตารางที่เป็นบันทึกประวัติล้วน ๆ — ถ้าเขียนไม่ผ่านก็ไม่ควรเด้งแถบแดงรบกวนผู้ใช้
    // (ยังขึ้น console.error ให้แอดมินเห็นเหมือนเดิม)
    const QUIET_TABLES = ['user_ip_logs', 'system_logs'];

    const notify = function(err, table) {
        try {
            console.error('[เขียนฐานข้อมูลไม่สำเร็จ]', err);
            const msg = (err && (err.message || err.details || err.hint)) || 'ไม่ทราบสาเหตุ';
            const now = Date.now();
            if (QUIET_TABLES.indexOf(table) !== -1) return;
            if (msg === lastMsg && (now - lastAt) < 4000) return;   // กันเด้งรัวตอนเขียนหลายรายการติดกัน
            lastMsg = msg; lastAt = now;
            window._showDbError(msg);
        } catch (e) {}
    };

    const watch = function(builder, table) {
        try {
            if (!builder || typeof builder.then !== 'function' || builder.__dbWatched) return builder;
            builder.__dbWatched = true;
            const origThen = builder.then.bind(builder);
            builder.then = function(onOk, onErr) {
                return origThen(function(res) {
                    if (res && res.error) notify(res.error, table);
                    return onOk ? onOk(res) : res;
                }, onErr);
            };
        } catch (e) {}
        return builder;
    };

    const origFrom = db.from.bind(db);
    db.from = function(table) {
        const qb = origFrom(table);
        try {
            ['insert', 'update', 'upsert', 'delete'].forEach(function(m) {
                const orig = qb[m];
                if (typeof orig !== 'function') return;
                qb[m] = function() { return watch(orig.apply(qb, arguments), table); };
            });
        } catch (e) {}
        return qb;
    };
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
        // [FIX] appDB ประกาศด้วย let จึงไม่กลายเป็น property ของ window
        // summary.js อ่านผ่าน window.appDB ทำให้ realtime ของหน้าสรุปยอดไม่เคยทำงาน
        window.appDB = appDB;
        // ดักการเขียนฐานข้อมูลที่ล้มเหลว (ดูรายละเอียดที่ _installDbWriteGuard)
        try { window._installDbWriteGuard(appDB); } catch (e) { console.warn('[dbWriteGuard]', e); }
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


// ==========================================================
// 🖼️ ตัวย่อรูปอัตโนมัติก่อนอัปโหลด (ใช้ร่วมกันทุกหน้า)
// ย่อขนาด + บีบคุณภาพในเบราว์เซอร์ก่อนส่งขึ้น Storage
// ช่วยลดทั้งพื้นที่เก็บและเวลาโหลดของผู้ใช้ทุกคน
// ==========================================================
// ==========================================
// ⚡ [SPEED] กันยิงคำขอซ้ำในช่วงสั้นๆ (request de-dup + micro cache)
// ถ้าโค้ดหลายที่ขอข้อมูลชุดเดียวกันพร้อมกัน จะยิงจริงครั้งเดียวแล้วแชร์ผลกัน
// ==========================================
window._reqCache = {};
window.cachedQuery = async function(key, fn, ttlMs = 15000) {
    const now = Date.now();
    const hit = window._reqCache[key];
    if (hit && (now - hit.ts) < ttlMs) return hit.promise;   // ใช้ผลเดิม / รอผลที่กำลังยิงอยู่
    const promise = Promise.resolve().then(fn);
    window._reqCache[key] = { ts: now, promise };
    promise.catch(() => { delete window._reqCache[key]; });   // พังแล้วอย่า cache ไว้
    return promise;
};
window.clearQueryCache = function(prefix) {
    if (!prefix) { window._reqCache = {}; return; }
    Object.keys(window._reqCache).forEach(k => { if (k.startsWith(prefix)) delete window._reqCache[k]; });
};

// ==========================================
// 🔍 เครื่องมือหาโลโก้เว็บที่ไฟล์ใหญ่เกินจำเป็น
// วิธีใช้: เปิด Console (F12) แล้วพิมพ์  checkBigLogos()
// ==========================================
window.checkBigLogos = async function(limitKB = 200) {
    try {
        const logos = window.summaryWebLogos || {};
        const names = Object.keys(logos);
        if (!names.length) { console.log('⚠️ ยังไม่มีข้อมูลโลโก้ (ลองเข้าหน้าสรุปยอดก่อน แล้วรันใหม่)'); return; }
        console.log(`🔍 กำลังตรวจโลโก้ ${names.length} เว็บ...`);
        const rows = [];
        for (const web of names) {
            const url = logos[web];
            if (!url) continue;
            try {
                const res = await fetch(url, { method: 'HEAD' });
                const kb = Math.round((+res.headers.get('content-length') || 0) / 1024);
                rows.push({ เว็บ: web, ขนาด_KB: kb, สถานะ: kb > limitKB ? '🔴 ใหญ่เกิน ควรย่อ' : '✅ โอเค', ลิงก์: url });
            } catch (e) { rows.push({ เว็บ: web, ขนาด_KB: '?', สถานะ: '⚠️ เช็คไม่ได้', ลิงก์: url }); }
        }
        rows.sort((a, b) => (+b.ขนาด_KB || 0) - (+a.ขนาด_KB || 0));
        console.table(rows);
        const big = rows.filter(r => +r.ขนาด_KB > limitKB);
        if (big.length) {
            console.log(`\n🔴 พบ ${big.length} เว็บที่โลโก้ใหญ่เกิน ${limitKB} KB:`);
            big.forEach(b => console.log(`   • ${b.เว็บ} = ${b.ขนาด_KB} KB`));
            console.log('\n💡 วิธีแก้: ไปหน้าสรุปยอด → คลิกโลโก้เว็บนั้น → อัปรูปเดิมใหม่อีกครั้ง');
            console.log('   ระบบจะย่อให้อัตโนมัติเหลือ ~20-50 KB');
        } else {
            console.log('✅ โลโก้ทุกเว็บขนาดเหมาะสมแล้ว');
        }
        return rows;
    } catch (e) { console.error('เช็คโลโก้ไม่สำเร็จ:', e); }
};

window.compressImage = async function(file, opts = {}) {
    const maxW = opts.maxWidth || 800;      // กว้างสุด
    const maxH = opts.maxHeight || 800;     // สูงสุด
    const quality = opts.quality || 0.85;   // คุณภาพ 0-1
    const skipUnder = (opts.skipUnderKB || 150) * 1024;  // เล็กกว่านี้ไม่ต้องย่อ

    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file; // ย่อแล้วเสียภาพเคลื่อนไหว/เวกเตอร์
    if (file.size <= skipUnder) return file;

    try {
        const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = dataUrl;
        });

        let { width: w, height: h } = img;
        if (w <= maxW && h <= maxH && file.size < 400 * 1024) return file;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio); h = Math.round(h * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
        if (!blob || blob.size >= file.size) return file;   // ย่อแล้วไม่เล็กลง ใช้ของเดิม

        const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
        const out = new File([blob], newName, { type: 'image/webp' });
        console.log(`[ย่อรูป] ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(out.size/1024).toFixed(0)}KB`);
        return out;
    } catch (e) {
        console.warn('[ย่อรูป] ล้มเหลว ใช้ไฟล์เดิม', e);
        return file;
    }
};

// 1. สร้างตัวแปรเก็บ Cache สำหรับ HTML String
const pageCache = {};

// ==========================================
// ⚡ [SPEED] DOM Snapshot — กดเข้าหน้าแล้วข้อมูลเด้งขึ้นทันที
// หลักการ: ก่อนออกจากหน้า เก็บภาพ DOM ล่าสุด (ที่มีข้อมูลแล้ว) ไว้
// พอกลับเข้ามา → แปะภาพเดิมขึ้นจอทันที (0 วินาที) แล้วค่อยให้
// init ของหน้านั้นดึงข้อมูลใหม่มาวาดทับเงียบๆ ข้างหลัง
// ปุ่ม onclick ต่างๆ ใช้ได้ทันทีเพราะเป็น inline attribute ทั้งระบบ
// ==========================================
const domSnapshot = {};
window._currentPageName = null;

// ชิปเล็กๆ มุมจอ บอกว่ากำลังดึงข้อมูลชุดใหม่
window._showRefreshChip = function() {
    if (document.getElementById('pageRefreshChip')) return;
    const el = document.createElement('div');
    el.id = 'pageRefreshChip';
    el.innerHTML = `<span class="material-icons animate-spin" style="font-size:14px;color:#E8C15A">sync</span> กำลังอัปเดตข้อมูล...`;
    el.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:9999;display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:rgba(10,16,29,0.92);border:1px solid rgba(232,193,90,0.35);color:#f5e3ae;font-size:11px;font-weight:700;box-shadow:0 8px 24px -8px rgba(0,0,0,0.6);backdrop-filter:blur(4px);transition:opacity .25s;';
    document.body.appendChild(el);
};
window._hideRefreshChip = function() {
    const el = document.getElementById('pageRefreshChip');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
};

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
// ตอนนี้โหลดแค่ global/auth/system_core/dashboard/sheet ก่อน
// ไฟล์ของแต่ละหน้าจะถูกดึงตอนกดเข้าหน้านั้นครั้งแรก (โหลดแล้วจำไว้ ไม่โหลดซ้ำ)
// เปลี่ยน version ทีเดียวที่ window._APP_VERSION ใน index.html
// ==========================================
const PAGE_SCRIPTS = {
    leave:             ['leave', 'swap'],
    swap:              ['leave', 'swap'],
    duty:              ['duty'],
    discord:           ['discord', 'tts_control'],
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
    ip_allow:          ['ip_allow'],
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

    // ⚡ [SPEED] เก็บภาพหน้าปัจจุบัน (ที่มีข้อมูลวาดเสร็จแล้ว) ไว้ก่อนสลับ
    const _prevApp = document.getElementById('app-content');
    if (window._currentPageName && _prevApp && _prevApp.innerHTML && _prevApp.innerHTML.length > 50) {
        domSnapshot[window._currentPageName] = _prevApp.innerHTML;
    }

    // มี snapshot + สคริปต์โหลดครบแล้ว = โชว์ได้ทันที ไม่ต้องขึ้น overlay เลย
    const _snapReady = !!domSnapshot[pageName];
    const _scriptsReady = (typeof PAGE_SCRIPTS !== 'undefined')
        ? (PAGE_SCRIPTS[pageName] || []).every(n => window._loadedScripts && window._loadedScripts[n])
        : false;
    const _instant = _snapReady && _scriptsReady && !!pageCache[pageName];

    try {
        if (!pageCache[pageName] && loading) loading.classList.remove('hidden');
        
        if (!pageCache[pageName]) {
            const _v = window._APP_VERSION || Date.now();
            const response = await fetch(`./pages/${pageName}.html?v=${_v}`);
            if (!response.ok) throw new Error('Page not found');
            pageCache[pageName] = await response.text();
        }
        // 📦 โหลด JS ของหน้านี้ (ครั้งแรกเท่านั้น)
        if (loading && !_instant) loading.classList.remove('hidden');
        await window.loadPageScripts(pageName);
        
        // ⚡ ถ้ามี snapshot ให้แปะภาพเดิม (มีข้อมูลอยู่แล้ว) ขึ้นก่อน — ตาเห็นทันที
        const usedSnapshot = !!domSnapshot[pageName];
        const htmlContent = domSnapshot[pageName] || pageCache[pageName];

        const updateDOM = () => {
            const appContent = document.getElementById('app-content');
            appContent.innerHTML = htmlContent;
            appContent.classList.remove('hidden');
            window._currentPageName = pageName;
            
            document.querySelectorAll('.nm-menu-title').forEach(el => el.classList.remove('active'));
            const activeBtn = document.querySelector(`button[onclick*="showPage('${pageName}')"]`);
            if (activeBtn) activeBtn.classList.add('active');

            requestAnimationFrame(async () => {
                // ⚡ กำลังโชว์ข้อมูลชุดเก่าอยู่ → ขึ้นชิปบอกว่าเบื้องหลังกำลังดึงของใหม่
                if (usedSnapshot && window._showRefreshChip) window._showRefreshChip();

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
                else if (pageName === 'ip_allow') {
                    if (typeof initIpAllowApp === 'function') await initIpAllowApp();
                }
                else if (pageName === 'slip_check') {
                    if (typeof window.initSlipCheck === 'function') await window.initSlipCheck();
                }

                // ⚡ ข้อมูลชุดใหม่วาดเสร็จแล้ว → ปิดชิป + เก็บ snapshot เวอร์ชันสดไว้เลย
                if (window._hideRefreshChip) window._hideRefreshChip();
                const _appNow = document.getElementById('app-content');
                if (_appNow && window._currentPageName === pageName) {
                    domSnapshot[pageName] = _appNow.innerHTML;
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
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'dark_mode';
        localStorage.setItem('theme', 'light');
        if(cb) cb.checked = false;
    } else {
        document.documentElement.classList.add('dark');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = 'light_mode';
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
// [ลบออก] addCustomPermDept ตัวนี้ซ้ำกับใน system_core.js และไม่มีการเช็คสิทธิ์แอดมิน — ใช้ตัวใน system_core.js แทน

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
// ถูกเรียกจาก duty.js 22 จุด ด้วย channel 'duty-updates'
// ตัวรับอยู่ที่ duty.js > subscribeDutyChanges (event 'force_reload')
//
// [FIX] เดิมสร้าง channel ใหม่ทุกครั้งแล้ว .send() ทันทีโดยไม่ subscribe ก่อน
//       Supabase จะไม่ส่งออกไปจริง (เงียบ ไม่มี error) และ channel ที่สร้างทิ้งไว้
//       ก็ไม่เคยถูกปิด กลายเป็น memory leak สะสมทุกครั้งที่แก้ตารางเวร
// ตอนนี้: ส่งผ่าน channel ที่หน้านั้น subscribe ไว้อยู่แล้วเป็นอันดับแรก
//         (ผู้ส่งจึงไม่ได้รับ broadcast ของตัวเอง = ไม่รีโหลดซ้ำซ้อน)
//         ถ้าไม่มีจริง ๆ ค่อยเปิดของตัวเองไว้ตัวเดียวแล้วใช้ซ้ำ ไม่สร้างใหม่ทุกครั้ง
// ==========================================
(function() {
    const _timers = {};
    const _own = {};   // ชื่อ channel -> { ch, ready, queue } เฉพาะกรณีที่ต้องเปิดเอง

    // หา channel ที่ต่อสำเร็จอยู่แล้วในชื่อเดียวกัน
    function _findJoined(name) {
        try {
            const list = (appDB.getChannels && appDB.getChannels()) || [];
            for (let i = 0; i < list.length; i++) {
                const c = list[i];
                if (!c || !c.topic) continue;
                if ((c.topic === name || c.topic === 'realtime:' + name) && c.state === 'joined') return c;
            }
        } catch (e) {}
        return null;
    }

    function _emit(name, event) {
        try {
            if (typeof appDB === 'undefined' || !appDB || !appDB.channel) return;

            const joined = _findJoined(name);
            if (joined) { joined.send({ type: 'broadcast', event: event }); return; }

            let entry = _own[name];
            if (!entry) {
                const ch = appDB.channel(name);
                entry = _own[name] = { ch: ch, ready: false, queue: [] };
                ch.subscribe(function(status) {
                    if (status !== 'SUBSCRIBED') return;
                    entry.ready = true;
                    const pending = entry.queue;
                    entry.queue = [];
                    pending.forEach(function(ev) {
                        try { ch.send({ type: 'broadcast', event: ev }); } catch (e) {}
                    });
                });
            }
            // ยังต่อไม่เสร็จ → พักไว้ก่อน แล้วส่งตอน subscribe สำเร็จ (กันส่งทิ้งเปล่าแบบเดิม)
            if (entry.ready) entry.ch.send({ type: 'broadcast', event: event });
            else if (entry.queue.indexOf(event) === -1) entry.queue.push(event);
        } catch (e) {
            console.warn('[debouncedBroadcast] failed:', e);
        }
    }

    window.debouncedBroadcast = function(channel, event, delay) {
        delay = delay || 800;
        if (_timers[channel]) clearTimeout(_timers[channel]);
        _timers[channel] = setTimeout(function() {
            delete _timers[channel];
            _emit(channel, event || 'force_reload');
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
