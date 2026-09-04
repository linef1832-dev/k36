// ════════════════════════════════════════════════════════════════════
// 📦 summary/core.js — ส่วนที่ 1/2 ของหน้าสรุปยอดทำรายการ (แยกจาก summary.js เดิม 2,048 บรรทัด)
// เนื้อหา: โหลด Excel lib, ดึง/ประมวลผลยอด, วาดตารางสรุป, กรอง/ค้นหา
// ⚠️ ลำดับโหลด: summary/core → summary/export
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// ====================================================
// 📊 ลอจิกหน้าสรุปยอดทำรายการ (V. สมบูรณ์ แยกหน้า HTML ชัดเจน + แก้บัคกะ)
// ====================================================

let pendingSummaryData = []; 
let viewMode = 'preview'; 
let summaryActiveWebFilter = 'ALL';
window.uploadedFileDates = window.uploadedFileDates || new Set();
window.pendingFileNames = window.pendingFileNames || []; 
window.availableSummaryDates = [];
window.selectedSummaryDates = window.selectedSummaryDates || new Set();
let summaryRenderTimer;
let summarySubscription = null;

// 🌟 ฟังก์ชันสำหรับโหลด ExcelJS แบบ Lazy Load
window.loadExcelLibrary = function(callback) {
    if (typeof ExcelJS !== 'undefined') {
        callback();
        return;
    }

    Swal.fire({ title: 'กำลังโหลดเครื่องมือสร้าง Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.body.appendChild(script1);

    script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
        document.body.appendChild(script2);

        script2.onload = () => {
            Swal.close();
            callback();
        };
    };
};

// 🌟 ตัวช่วยคำนวณ "วันที่เมื่อวาน" ที่แม่นยำที่สุด
window.getYesterdayDateStr = function(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// 🌟 ฟังก์ชันทำความสะอาดคีย์เพื่อเทียบยอดแบบไม่แคร์พิมพ์เล็ก/ใหญ่
window.cleanKeyStr = function(empName, website) {
    let n = (empName || '').toLowerCase().trim();
    let w = (website || '').toLowerCase().trim();
    return `${n}_${w}`;
};

// 🌟 ตัวช่วยสร้างป้ายส่วนต่างขึ้น-ลง
function buildDiffBadge(diffValue, extraClasses = '') {
    if (diffValue > 0) return `<span class="text-emerald-400 font-bold bg-emerald-900/30 px-1.5 py-0.5 rounded flex items-center border border-emerald-800/50 text-[10px] shadow-sm ${extraClasses}"><span class="material-icons text-[10px]">trending_up</span>+${diffValue}</span>`;
    if (diffValue < 0) return `<span class="text-red-400 font-bold bg-red-900/30 px-1.5 py-0.5 rounded flex items-center border border-red-800/50 text-[10px] shadow-sm ${extraClasses}"><span class="material-icons text-[10px]">trending_down</span>${diffValue}</span>`;
    return `<span class="text-gray-400 bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600 shadow-sm ${extraClasses}">คงที่</span>`;
}

// 🌟 ตัวช่วยดึง HTML Template และแทนที่ข้อมูล
function getTpl(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) {
        if (templateId === 'tpl-no-data') return `<div class="text-center py-20 text-gray-400 font-bold flex flex-col items-center"><span class="material-icons text-7xl mb-4 opacity-20">search_off</span>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>`;
        if (templateId === 'tpl-emp-not-found') return `<div class="text-center py-10 text-gray-400 font-bold">ไม่พบพนักงานชื่อ "${data.keyword}" ในวันนี้</div>`;
        return ''; 
    }
    let html = tpl.innerHTML;
    for (const key in data) {
        const val = data[key] !== undefined && data[key] !== null ? data[key] : '';
        html = html.split(`{{${key}}}`).join(val);
    }
    return html;
}

// 🌟 ตัวช่วยแปลงชื่อกะให้เป็นมาตรฐานเดียวกัน
window.normalizeShiftName = function(shift) {
    let s = String(shift || '').trim().replace('กะ', '');
    if (s === 'เช้า') return 'กะเช้า';
    if (s === 'กลาง') return 'กะกลาง';
    if (s === 'ดึก') return 'กะดึก';
    if (s === 'อิสระ' || s === 'all' || s === '') return 'กะอิสระ';
    return 'UNKNOWN';
};

const SHIFT_BADGE_STYLES = {
    'กะเช้า': { text: 'เช้า', colorClass: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
    'กะกลาง': { text: 'กลาง', colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    'กะดึก': { text: 'ดึก', colorClass: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    'กะอิสระ': { text: 'อิสระ', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    'all': { text: 'อิสระ', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' }
};

// 🌟 ตัวช่วยสร้าง HTML ป้ายชื่อกะ
window.getShiftBadgeHtml = function(shift) {
    const style = SHIFT_BADGE_STYLES[shift] || { text: 'ไม่ระบุ', colorClass: 'bg-slate-500/20 text-slate-400 border-slate-500/50' };
    return `<span class="text-[10px] ${style.colorClass} border px-1.5 py-0.5 rounded shadow-sm ml-2">${style.text}</span>`;
};

// cache วันที่ใช้ได้ — หมดอายุทุก 5 นาที
let _summaryDatesCacheTs = 0;
const _SUMMARY_DATES_TTL = 5 * 60 * 1000;

window.initSummaryDate = async function() {
    // ใช้ getUsersCached (TTL 3 นาที) แทนการ fetchUsers(true) ทุกครั้ง
    // ถ้ายัง fresh อยู่ return ทันทีไม่ hit DB — ประหยัดเวลา ~300-800ms
    if (typeof window.getUsersCached === 'function') {
        const users = await window.getUsersCached();
        if (users && users.length > 0) {
            window.GLOBAL_USER_LIST = users;
            window.invalidateSummaryUserCache?.();
        }
    }

    // ถ้ามีข้อมูลค้างไว้ render ทันทีไม่ต้อง fetch ใหม่
    if (pendingSummaryData && pendingSummaryData.length > 0) {
        if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
        if (typeof window.fetchLeaderboardData === 'function') window.fetchLeaderboardData();
        return;
    }

    Swal.fire({title: 'กำลังเตรียมข้อมูลสรุปยอด...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const dateInput = document.getElementById('summaryDateFilter');
        if(dateInput && !dateInput.value) {
            const today = new Date();
            const offset = today.getTimezoneOffset() * 60000;
            dateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
        }

        // ดึงขนานกัน — logos + dates (dates ใช้ cache ถ้ายัง fresh)
        const now = Date.now();
        const initFetches = [loadWebLogos()];
        if (typeof fetchAvailableDates === 'function' && (now - _summaryDatesCacheTs) > _SUMMARY_DATES_TTL) {
            initFetches.push(fetchAvailableDates().then(() => { _summaryDatesCacheTs = Date.now(); }));
        } else if (typeof fetchAvailableDates === 'function' && window.availableSummaryDates?.length > 0) {
            // dates ยัง fresh — render จาก cache โดยไม่ hit DB
            if (typeof window.renderDateSelector === 'function') window.renderDateSelector();
        }
        await Promise.all(initFetches);

        await window.fetchHistoricalSummary(true);
        if (typeof window.subscribeSummaryChanges === 'function') window.subscribeSummaryChanges();

    } catch(e) { console.error("Init Summary Error:", e); }
    finally { Swal.close(); }
}

window.subscribeSummaryChanges = function() {
    if (!window.appDB) return;
    if (summarySubscription) window.appDB.removeChannel(summarySubscription);

    summarySubscription = window.appDB.channel('summary-updates')
    .on('broadcast', { event: 'force_summary_reload' }, async (payload) => {
        const currentDate = document.getElementById('summaryDateFilter') ? document.getElementById('summaryDateFilter').value : '';
        if (viewMode === 'history' && payload?.payload?.date === currentDate) {
            await window.fetchHistoricalSummary(true);
        }
    }).subscribe();

    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(summarySubscription);
};

window.loadWebLogos = async function() {
    try {
        const { data } = await (window.cachedQuery
            ? window.cachedQuery('sum_logos', () => appDB.from('settings').select('value').eq('key', 'summary_web_logos').single(), 300000)
            : appDB.from('settings').select('value').eq('key', 'summary_web_logos').single());
        if (data && data.value) {
            window.summaryWebLogos = JSON.parse(data.value);
            if (typeof SETTINGS !== 'undefined') SETTINGS['summary_web_logos'] = data.value;
        } else window.summaryWebLogos = {};
    } catch (e) { window.summaryWebLogos = {}; }
}

window.fetchAvailableDates = async function(forceRender = false) {
    try {
        const { data } = await (window.cachedQuery
            ? window.cachedQuery('sum_dates', () => appDB.from('transaction_daily_summary').select('date').order('date', {ascending: false}).limit(1000), 60000)
            : appDB.from('transaction_daily_summary').select('date').order('date', {ascending: false}).limit(1000));
        if (data) {
            window.availableSummaryDates = [...new Set(data.map(item => item.date))].slice(0, 15);
            if (forceRender || !pendingSummaryData || pendingSummaryData.length === 0) window.renderSummaryDashboard();
        }
    } catch(e) { console.error("Fetch dates error:", e); }
}

// 🌟 เพิ่มตัวแปรเก็บ Cache พจนานุกรมชื่อ เพื่อลดการวนลูปซ้ำซ้อน
let summaryUserCacheMap = null;
let summarySortedUserCache = null;
let summaryUserCacheRef = null; // 🌟 [แก้บัคกะ] เก็บ reference ของ GLOBAL_USER_LIST ตอนสร้าง cache เพื่อตรวจว่ามีการรีเฟรชใหม่หรือยัง

// 🌟 [แก้บัคกะ] ตัวช่วยล้าง Cache บังคับ ใช้ตอนรีเฟรชรายชื่อพนักงาน (กรณีแอดมินแก้กะใหม่)
window.invalidateSummaryUserCache = function() {
    summaryUserCacheMap = null;
    summarySortedUserCache = null;
    summaryUserCacheRef = null;
};

// 🌟 [แก้บัคกะ v3] บังคับรีเฟรชรายชื่อพนักงานแบบ "ปลอดภัยที่สุด"
// ลำดับการพยายาม:
//   1. fetchUsers(true) ของ system_core (ถ้า implementation รับ forceRefresh)
//   2. fetchUsers() แบบไม่ส่ง parameter (เผื่อเวอร์ชันเก่า)
//   3. ดึงตรงจาก DB ทั้งตาราง users (fallback สุดท้าย)
window.refreshUserListForSummary = async function() {
    // ใช้ getUsersCached (TTL 3 นาที) แทน fetchUsers(true) ทุกครั้ง
    // ถ้า cache ยัง fresh จะไม่ hit DB เลย — เร็วขึ้น ~300-800ms
    if (typeof window.getUsersCached === 'function') {
        const users = await window.getUsersCached();
        if (users && users.length > 0) window.GLOBAL_USER_LIST = users;
    } else if (typeof appDB !== 'undefined') {
        try {
            const { data, error } = await appDB.from('users').select('*');
            if (!error && data && data.length > 0) window.GLOBAL_USER_LIST = data;
        } catch(e) { console.warn('[Summary] fallback fetch users failed:', e); }
    }
    window.invalidateSummaryUserCache?.();
};

function buildSummaryUserCache() {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return;
    summaryUserCacheMap = new Map();
    window.GLOBAL_USER_LIST.forEach(u => {
        const dbName = String(u.username || '').toLowerCase().trim();
        summaryUserCacheMap.set(dbName, u);
    });
    // เรียงลำดับแค่ครั้งเดียวพอ
    summarySortedUserCache = [...window.GLOBAL_USER_LIST].sort((a, b) => (b.username || '').length - (a.username || '').length);
    // 🌟 [แก้บัคกะ] เก็บ reference ของ array ปัจจุบันไว้ — ถ้า fetchUsers(true) ทำงาน array จะกลายเป็นชุดใหม่ (reference เปลี่ยน) → cache จะถูก rebuild อัตโนมัติ
    summaryUserCacheRef = window.GLOBAL_USER_LIST;
}

// 🌟 ระบบอ่านกะที่ฉลาดและทำงานไวขึ้น (O(1) Lookup)
function getShiftFromName(name) {
    const searchName = String(name || '').toLowerCase().trim();
    if (!searchName) return 'UNKNOWN';

    // 1. พยายามหาจากฐานข้อมูลก่อน
    if (window.GLOBAL_USER_LIST && window.GLOBAL_USER_LIST.length > 0) {
        // ถ้าพจนานุกรมยังไม่ถูกสร้าง / จำนวนพนักงานเปลี่ยน / array ถูกรีเฟรชใหม่ → สร้างใหม่
        // 🌟 [แก้บัคกะ] เพิ่มเช็ค reference ด้วย เพื่อจับกรณีแอดมินอัปเดตกะของพนักงานคนเดิม (จำนวนเท่าเดิมแต่ข้อมูลใหม่)
        if (!summaryUserCacheMap
            || summaryUserCacheMap.size !== window.GLOBAL_USER_LIST.length
            || summaryUserCacheRef !== window.GLOBAL_USER_LIST) {
            buildSummaryUserCache();
        }

        // ค้นหาแบบเปิดพจนานุกรม (เจอทันที ไม่ต้องวนลูป)
        let foundUser = summaryUserCacheMap.get(searchName);
        
        // ถ้าไม่เจอ ค่อยวนลูปหาแบบเช็คตัวอักษรนำหน้า (ทางเลือกสุดท้าย)
        if (!foundUser) {
            foundUser = summarySortedUserCache.find(u => {
                const dbName = String(u.username || '').toLowerCase().trim();
                return (dbName.length >= 3 && searchName.startsWith(dbName)) || 
                       (searchName.length >= 3 && dbName.startsWith(searchName));
            });
        }
        
        if (foundUser) {
            return window.normalizeShiftName(foundUser.allowed_shift);
        }
    }
    
    // 2. ถ้าในฐานข้อมูลไม่มี ให้เดาจากชื่อ
    if (searchName.includes('เช้า')) return 'กะเช้า';
    if (searchName.includes('กลาง')) return 'กะกลาง';
    if (searchName.includes('ดึก')) return 'กะดึก';
    
    return 'UNKNOWN';
}

// 🌟 ฟังก์ชันบังคับดึงรายชื่อพนักงาน (อุดรอยรั่วตอนเปิดหน้าเว็บครั้งแรก)

function parseAmount(val) {
    if(!val) return 0;
    if(typeof val === 'number') return val;
    let cleanVal = String(val).replace(/[^0-9.-]+/g, ''); 
    return parseFloat(cleanVal) || 0;
}

// 🌟 ตารางจับคู่ชื่อแบรนด์ (รวมชื่อค่ายเกมจริง) → รหัสเว็บมาตรฐาน
// ใช้ตอนอ่านคอลัมน์ "แบรนด์" จากไฟล์ TCG ที่อาจขึ้นเป็น "Jili", "PGSoft" ฯลฯ
const BRAND_ALIASES = {
    'PG688':  ['pg688', 'pg', 'pgsoft', 'pg soft', 'pg-soft', 'pgslot', 'pg slot'],
    'JL69':   ['jl69', 'jl', 'jili', 'jiligames', 'jili games', 'jili gaming'],
    'NM9':    ['nm9', 'nm'],
    'VV72':   ['vv72', 'vv'],
    'Jun88':  ['jun88', 'jun'],
    'MK8':    ['mk8', 'mk'],
    'TH26':   ['th26'],
    'BT678':  ['bt678', 'bt'],
    'K188':   ['k188'],
    'F168':   ['f168']
};

// 🌟 พยายามจับคู่ค่าในคอลัมน์ "แบรนด์" → รหัสเว็บมาตรฐาน
function matchBrandToWeb(rawWeb) {
    if (!rawWeb) return '';
    const normalized = String(rawWeb).trim().toLowerCase().replace(/[\s_\-]+/g, '');
    if (!normalized) return '';

    // 1. exact match กับ alias ก่อน (แม่นที่สุด)
    for (const [webCode, aliases] of Object.entries(BRAND_ALIASES)) {
       for (const alias of aliases) {
          const normAlias = alias.replace(/[\s_\-]+/g, '');
          if (normalized === normAlias) return webCode;
       }
    }

    // 2. startsWith / includes (เผื่อมีคำต่อท้าย)
    for (const [webCode, aliases] of Object.entries(BRAND_ALIASES)) {
       for (const alias of aliases) {
          const normAlias = alias.replace(/[\s_\-]+/g, '');
          if (normAlias.length >= 2 && (normalized.startsWith(normAlias) || normalized.includes(normAlias))) {
             return webCode;
          }
       }
    }

    return '';
}

window.clearSummaryData = async function() {
    pendingSummaryData = [];
    viewMode = 'preview';
    if (window.uploadedFileDates) window.uploadedFileDates.clear();
    window.pendingFileNames = [];
    if (window.selectedSummaryDates) window.selectedSummaryDates.clear();

    const dateFilter = document.getElementById('summaryDateFilter');
    if (dateFilter) dateFilter.value = '';

    const dateSpan = document.getElementById('summaryFileDates');
    if (dateSpan) { dateSpan.innerText = '-'; dateSpan.className = "text-sky-500"; }

    const lbMode = document.getElementById('leaderboardMode');
    if (lbMode) lbMode.value = 'monthly';
    
    summaryActiveWebFilter = 'ALL';

    if (typeof fetchAvailableDates === 'function') await fetchAvailableDates(true); 
    else renderSummaryDashboard();

    if (typeof fetchLeaderboardData === 'function') fetchLeaderboardData();
};

window.toggleSummaryWebFilter = function(webName) {
    if (summaryActiveWebFilter === webName) summaryActiveWebFilter = 'ALL';
    else summaryActiveWebFilter = webName;
    renderSummaryDashboard();
};

window.filterSummaryLeaderboard = function() {
    const term = document.getElementById('leaderboardSearch') ? document.getElementById('leaderboardSearch').value.toLowerCase() : '';
    const items = document.querySelectorAll('.leaderboard-item');
    
    items.forEach((item, index) => {
        const name = item.getAttribute('data-name').toLowerCase();
        
        if (term === '') {
            // 🌟 ถ้าไม่ได้พิมพ์ค้นหา ให้โชว์แค่ 10 อันดับแรก (ซ่อนคนที่เหลือ)
            if (index < 10) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        } else {
            // 🌟 ถ้าพิมพ์ค้นหา ให้โชว์คนที่ชื่อตรง (แม้จะอยู่อันดับ 95 ก็จะโผล่ขึ้นมาพร้อมอันดับ)
            if (name.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        }
    });
};

window.handleDragOverExcel = function(e) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.add('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
};

window.handleDragLeaveExcel = function(e) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
};

window.handleDropExcel = function(e, systemName) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) window.processExcelUpload(e, systemName);
};

// 🌟 ฟังก์ชันดึงชื่อพนักงานจริงจากระบบ (อัปเกรดให้ทำงานไวขึ้นด้วย Cache)
function getRealDbUser(rawName) {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return null;
    
    // เรียกใช้พจนานุกรม (ใช้เกณฑ์เช็ค reference เดียวกับ getShiftFromName)
    if (!summaryUserCacheMap
        || summaryUserCacheMap.size !== window.GLOBAL_USER_LIST.length
        || summaryUserCacheRef !== window.GLOBAL_USER_LIST) {
        buildSummaryUserCache();
    }
    
    const searchName = String(rawName || '').toLowerCase().trim();
    if (!searchName) return null;
    
    // 1. ลองหาแบบตรงตัวเป๊ะๆ ก่อน (ใช้เวลา 0.001 วิ)
    if (summaryUserCacheMap.has(searchName)) return summaryUserCacheMap.get(searchName);

    // 2. ถ้าไม่เจอ ลองหาแบบตัดคำนำหน้า m, a, n (เผื่อมีคนพิมพ์ผิด)
    if (searchName.match(/^[man]/)) {
        const strippedSearchName = searchName.substring(1);
        if (summaryUserCacheMap.has(strippedSearchName)) return summaryUserCacheMap.get(strippedSearchName);
    }

    // 3. ถ้ายังไม่เจออีก ลองหาแบบ contains โดยอิงจากลิสต์ที่ถูก sort เตรียมไว้แล้ว
    const match = summarySortedUserCache.find(u => {
        const dbName = String(u.username || '').toLowerCase().trim();
        return dbName.length >= 3 && (searchName.startsWith(dbName) || dbName.startsWith(searchName));
    });
    
    return match || null;
}

window.processExcelUpload = async function(event, fallbackSystemName) {
    let files = [];
    if (event.dataTransfer && event.dataTransfer.files.length > 0) files = Array.from(event.dataTransfer.files);
    else if (event.target && event.target.files.length > 0) files = Array.from(event.target.files);

    if (files.length === 0) return;

    // 🌟 [แก้บัคกะ] บังคับรีเฟรชรายชื่อพนักงาน + ล้าง cache กะ ก่อนประมวลผลไฟล์
    // เพื่อให้กะที่แอดมินเพิ่งแก้สะท้อนทันทีตอนคำนวณยอดจาก Excel
    if (typeof window.refreshUserListForSummary === 'function') {
        await window.refreshUserListForSummary();
    } else if (typeof fetchUsers === 'function') {
        try { await fetchUsers(true); } catch(e) { console.warn('fetchUsers refresh failed', e); }
    }

    // 🌟 เพิ่มบรรทัดนี้: บังคับโหลด ExcelJS ให้เสร็จก่อนเริ่มประมวลผล
    window.loadExcelLibrary(async () => {
        Swal.fire({
            title: `กำลังประมวลผล ${files.length} ไฟล์...`, html: 'ระบบกำลังดึงข้อมูลและคัดกรองกะของพนักงาน...',
            allowOutsideClick: false, didOpen: () => Swal.showLoading()
        });

        try {
            let totalExtracted = 0; let skippedFiles = []; let errorFiles = [];
            window._unknownTcgBrands = new Set(); // 🌟 เริ่มนับแบรนด์แปลกใหม่ทุกรอบการดึง
            let savedFilesList = [];
            
            if (typeof appDB !== 'undefined') {
                const { data: savedFilesData } = await appDB.from('settings').select('value').eq('key', 'saved_excel_files').single();
                if (savedFilesData && savedFilesData.value) savedFilesList = JSON.parse(savedFilesData.value);
            }

            for (let fIndex = 0; fIndex < files.length; fIndex++) {
                let file = files[fIndex];
                const fileName = file.name.toLowerCase();

                Swal.update({ html: `กำลังวิเคราะห์ไฟล์ที่ ${fIndex + 1}/${files.length}<br><b class="text-sky-500">${file.name}</b>` });

                if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) { skippedFiles.push(`${file.name} (ไม่ใช่ไฟล์ Excel/CSV)`); continue; }
                if (window.pendingFileNames.includes(fileName)) { skippedFiles.push(`${file.name} (ซ้ำในรอบนี้)`); continue; }
                window.pendingFileNames.push(fileName);

                let fileSystem = 'K36'; 
                if (fileName.includes('jl69') || fileName.includes('nm9') || fileName.includes('pg688')) fileSystem = 'TCG';
                else if (fileName.includes('f168')) fileSystem = 'WG';

                try {
                    let parsedRowsData = [];
                    if (fileName.endsWith('.csv')) {
                        const text = await file.text();
                        const parseCSV = (str) => {
                            const rows = []; let currentRow = []; let currentCell = ''; let inQuotes = false;
                            for (let i = 0; i < str.length; i++) {
                                let cc = str[i], nc = str[i + 1];
                                if (cc === '"' && inQuotes && nc === '"') { currentCell += '"'; i++; } 
                                else if (cc === '"') { inQuotes = !inQuotes; } 
                                else if (cc === ',' && !inQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; } 
                                else if ((cc === '\n' || cc === '\r') && !inQuotes) {
                                    if (cc === '\r' && nc === '\n') i++; 
                                    currentRow.push(currentCell.trim());
                                    if (currentRow.some(v => v !== '')) rows.push(currentRow); 
                                    currentRow = []; currentCell = '';
                                } else { currentCell += cc; }
                            }
                            if (currentCell !== '' || currentRow.length > 0) {
                                currentRow.push(currentCell.trim());
                                if (currentRow.some(v => v !== '')) rows.push(currentRow);
                            }
                            return rows;
                        };
                        parsedRowsData = parseCSV(text);
                    } else {
                        const wb = new ExcelJS.Workbook();
                        const buffer = await file.arrayBuffer();
                        await wb.xlsx.load(buffer);
                        const ws = wb.worksheets[0]; 
                        ws.eachRow((row, rowNumber) => {
                            let cols = [];
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                let val = cell.value;
                                if (val && typeof val === 'object' && val.text) val = val.text;
                                if (val && val instanceof Date) {
                                    const offset = val.getTimezoneOffset() * 60000;
                                    const localDate = new Date(val - offset);
                                    const ds = localDate.toISOString().split('T')[0];
                                    const ts = localDate.toISOString().split('T')[1].split('.')[0];
                                    val = `${ds} ${ts}`; 
                                }
                                cols[colNumber - 1] = String(val || '');
                            });
                            for(let i=0; i<cols.length; i++) { if(cols[i]===undefined) cols[i]=''; }
                            parsedRowsData.push(cols);
                        });
                    }

                    const webNameMap = { 'vv72': 'VV72', 'jun88': 'Jun88', 'mk8': 'MK8', 'th26': 'TH26', 'bt678': 'BT678', 'k188': 'K188', 'nm9': 'NM9', 'pg688': 'PG688', 'jl69': 'JL69', 'f168': 'F168' };
                    let colMap = { amount: -1, status: -1, emp: -1, web: -1 };
                    let headerFound = false; let startDataRow = 1;

                    for (let r = 0; r < Math.min(10, parsedRowsData.length); r++) {
                        if(!parsedRowsData[r]) continue;
                        let rowClean = parsedRowsData[r].map(c => String(c).replace(/[\s\r\n]+/g, '').toLowerCase());
                        
                        if (fileSystem === 'TCG') {
                            let cEmp = rowClean.findIndex(c => c.includes('ข้อมูลการอนุมัติครั้งแรก'));
                            let cStat = rowClean.findIndex(c => c === 'สถานะ' || c === 'status');
                            let cAmt = rowClean.findIndex(c => c.includes('จำนวนที่จ่ายจริง'));
                            // 🌟 แก้บัค: ใช้ .includes() ให้ยืดหยุ่นเหมือนคอลัมน์อื่น + รองรับชื่อหัวคอลัมน์หลายแบบ
                            let cWeb = rowClean.findIndex(c => c.includes('แบรนด์') || c.includes('brand') || c.includes('แพลตฟอร์ม') || c.includes('platform') || c.includes('ผลิตภัณฑ์') || c.includes('product'));

                            if (cEmp !== -1 && cStat !== -1 && cAmt !== -1) {
                                colMap = { emp: cEmp, status: cStat, amount: cAmt, web: cWeb !== -1 ? cWeb : -1 };
                                headerFound = true; startDataRow = r + 1;
                                // 🌟 แจ้งเตือนถ้าหา column แบรนด์ไม่เจอ (จะทำให้ทุกรายการเข้า default web)
                                if (cWeb === -1) {
                                    console.warn(`[TCG] ไม่พบคอลัมน์แบรนด์ในไฟล์ "${file.name}" — รายการทั้งหมดจะถูกจัดเป็น default web (${fileName})`);
                                }
                                break;
                            }
                        } else { 
                            let cEmp = rowClean.findIndex(c => c.includes('riskverification'));
                            let cStat = rowClean.findIndex(c => c === 'status' || c === 'สถานะ');
                            let cAmt = rowClean.findIndex(c => c.includes('actualw/d'));

                            if (cEmp === -1) cEmp = rowClean.findIndex(c => c.includes('approvedby') || c.includes('ตรวจสอบโดย'));

                            if (cEmp !== -1 && cStat !== -1 && cAmt !== -1) {
                                colMap = { emp: cEmp, status: cStat, amount: cAmt, web: cEmp };
                                headerFound = true; startDataRow = r + 1; break;
                            }
                        }
                    }

                    if (!headerFound) {
                        if (fileSystem === 'TCG') colMap = { amount: 16, status: 22, web: 23, emp: 24 };
                        else colMap = { amount: 25, status: 31, web: 33, emp: 33 };
                    }

                    let defaultWeb = '';
                    for (let w of Object.keys(webNameMap)) { if (fileName.includes(w)) { defaultWeb = webNameMap[w]; break; } }
                    
                    if (!defaultWeb) {
                        for (let r = startDataRow; r < Math.min(startDataRow + 50, parsedRowsData.length); r++) {
                            if (!parsedRowsData[r]) continue;
                            if (fileSystem === 'TCG') {
                                let rawWeb = colMap.web !== -1 ? String(parsedRowsData[r][colMap.web] || '').trim().toLowerCase() : '';
                                defaultWeb = matchBrandToWeb(rawWeb);
                                if (!defaultWeb) {
                                    for (let w of Object.keys(webNameMap)) { if (rawWeb.startsWith(w.substring(0, 2)) || rawWeb.includes(w)) { defaultWeb = webNameMap[w]; break; } }
                                }
                            } else {
                                let rawApp = colMap.emp !== -1 ? String(parsedRowsData[r][colMap.emp] || '').trim().toLowerCase() : '';
                                let fw = rawApp.split(/[\s\r\n]+/)[0] || '';
                                for (let w of Object.keys(webNameMap)) { if (fw.endsWith(w)) { defaultWeb = webNameMap[w]; break; } }
                            }
                            if (defaultWeb) break;
                        }
                    }
                    if (!defaultWeb) defaultWeb = fileSystem === 'TCG' ? 'PG688' : 'Jun88'; 

                    // 🌟 แก้บัค: บางไฟล์ TCG (เช่น NM9, JL69) export ออกมาแล้วข้อมูลเลื่อนจาก header หลายคอลัมน์
                    // ตรวจจับโดยเทียบค่าที่ตำแหน่ง status ว่าตรงกับคำสถานะจริงไหม ถ้าไม่ → หาตำแหน่งจริงแล้วเลื่อน colMap ทั้งชุด
                    if (fileSystem === 'TCG' && headerFound && colMap.status !== -1 && parsedRowsData.length > startDataRow) {
                        const STATUS_WORDS = ['จ่าย', 'paid', 'success', 'approved', 'reject', 'cancel', 'fail', 'ปฏิเสธ', 'ยกเลิก', 'pending'];
                        // หาแถวตัวอย่างที่ไม่ว่าง
                        let sampleRow = null;
                        for (let i = startDataRow; i < Math.min(startDataRow + 10, parsedRowsData.length); i++) {
                            if (parsedRowsData[i] && parsedRowsData[i].length >= colMap.status + 1) {
                                const v = String(parsedRowsData[i][colMap.status] || '').trim();
                                if (v) { sampleRow = parsedRowsData[i]; break; }
                            }
                        }
                        if (sampleRow) {
                            const headerStatusVal = String(sampleRow[colMap.status] || '').trim().toLowerCase();
                            const isValidStatus = STATUS_WORDS.some(w => headerStatusVal === w || headerStatusVal.includes(w));
                            if (!isValidStatus) {
                                // หาตำแหน่งจริงของ status ใน data row (ไล่จากซ้ายไปขวา)
                                let realStatusCol = -1;
                                for (let c = colMap.status; c < sampleRow.length; c++) {
                                    const val = String(sampleRow[c] || '').trim().toLowerCase();
                                    if (STATUS_WORDS.some(w => val === w)) { realStatusCol = c; break; }
                                }
                                if (realStatusCol !== -1 && realStatusCol > colMap.status) {
                                    const shift = realStatusCol - colMap.status;
                                    console.warn(`[TCG] ข้อมูลในไฟล์ "${file.name}" เลื่อนจาก header +${shift} คอลัมน์ — ปรับตำแหน่งอัตโนมัติ`);
                                    colMap.status += shift;
                                    colMap.amount += shift;
                                    if (colMap.web !== -1) colMap.web += shift;
                                    colMap.emp += shift;
                                }
                            }
                        }
                    }

                    let extractedRows = []; let detectedDate = null;

                    for (let i = startDataRow; i < parsedRowsData.length; i++) {
                        let cellData = parsedRowsData[i];
                        if (!cellData || cellData.length < 3) continue; 

                        let empName = ''; let amount = 0; let webName = '';
                        let txStatus = 'Approved'; let odType = 'ปกติ'; let rowDate = null;
                        let hour = null; 

                        for (let c of cellData) {
                            const strC = String(c).trim();
                            let match = strC.match(/(202\d-\d{1,2}-\d{1,2})(?:\s+(\d{1,2}):\d{2}:\d{2})?/);
                            let altMatch = strC.match(/(\d{1,2})\/(\d{1,2})\/(202\d)(?:\s+(\d{1,2}):\d{2}(?::\d{2})?)?/);
                            let rowDateStr = null;

                            if (match) { rowDateStr = match[1]; hour = match[2] ? parseInt(match[2], 10) : null; } 
                            else if (altMatch) {
                                let p1 = parseInt(altMatch[1], 10); let p2 = parseInt(altMatch[2], 10);
                                let y = altMatch[3]; let m = p2 > 12 ? p1 : p2; let d = p2 > 12 ? p2 : p1; 
                                rowDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                hour = altMatch[4] ? parseInt(altMatch[4], 10) : null;
                            }

                            if (rowDateStr) {
                                rowDate = rowDateStr;
                                if (hour !== null && hour >= 0 && hour < 8) {
                                    let dObj = new Date(rowDate); dObj.setDate(dObj.getDate() - 1);
                                    rowDate = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
                                }
                                window.uploadedFileDates.add(rowDate); 
                                break; 
                            }
                        }
                        if (!detectedDate && rowDate) detectedDate = rowDate; 

                        amount = parseAmount(cellData[colMap.amount]);
                        let rawStatus = String(cellData[colMap.status] || '').toUpperCase();
                        let rawApproveStr = String(cellData[colMap.emp] || '').trim().toLowerCase();

                        if (fileSystem === 'TCG' && colMap.web !== -1) {
                            let rawWeb = String(cellData[colMap.web] || '').trim().toLowerCase();
                            // 🌟 ใช้ alias map ก่อน เผื่อรองรับชื่อค่ายเกม (Jili, PGSoft ฯลฯ)
                            webName = matchBrandToWeb(rawWeb);
                            // fallback: ใช้ logic เดิม (เผื่อ alias ไม่ครอบ)
                            if (!webName) {
                                for (let w of Object.keys(webNameMap)) { if (rawWeb.startsWith(w.substring(0, 2)) || rawWeb.includes(w)) { webName = webNameMap[w]; break; } }
                            }
                            // เก็บแบรนด์แปลกๆ ที่จับคู่ไม่ได้ → log ให้ดู
                            if (!webName && rawWeb) {
                                if (!window._unknownTcgBrands) window._unknownTcgBrands = new Set();
                                window._unknownTcgBrands.add(rawWeb);
                            }
                        }

                        if (rawStatus.includes('REJECT') || rawStatus.includes('DECLINE') || rawStatus.includes('CANCEL') || rawStatus.includes('FAIL') || rawStatus.includes('REFUND') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('ยกเลิก')) {
                            txStatus = 'Reject'; amount = 0;
                        }

                        let firstWord = rawApproveStr.split(/[\s\r\n]+/)[0] || ''; 
                        
                        if (firstWord && firstWord !== 'system' && firstWord !== 'auto' && firstWord !== '-' && firstWord !== 'nan' && !firstWord.includes('202') && firstWord !== 'null') {
                            for (let w of Object.keys(webNameMap)) {
                                if (firstWord.endsWith(w)) {
                                    if (fileSystem === 'K36') webName = webNameMap[w]; 
                                    firstWord = firstWord.replace(w, '');
                                    break;
                                }
                            }

                            if(firstWord.startsWith('odol')) { odType = 'ODOL'; firstWord = firstWord.replace('odol', ''); }
                            else if(firstWord.startsWith('odo')) { odType = 'OD'; firstWord = firstWord.replace('odo', ''); }
                            else if(firstWord.startsWith('od')) { odType = 'OD'; firstWord = firstWord.replace('od', ''); }
                            else if(firstWord.startsWith('am')) { odType = 'AM'; firstWord = firstWord.replace('am', ''); }
                            else if(firstWord.startsWith('fttt')) { odType = 'ปกติ'; firstWord = firstWord.replace('fttt', ''); }
                            else if(firstWord.startsWith('ftt')) { odType = 'ปกติ'; firstWord = firstWord.replace('ftt', ''); }
                            else if(firstWord.startsWith('ft')) { odType = 'ปกติ'; firstWord = firstWord.replace('ft', ''); }
                            
                            firstWord = firstWord.replace(/(\d+|vv)$/i, ''); empName = firstWord;
                        } else { continue; }

                        if (!empName || empName.length < 2 || /^[\d\W]+$/.test(empName)) continue; 
                        const sysWords = ['system', 'auto', 'null', 'nan', 'admin', 'api', 'bot'];
                        if (sysWords.includes(empName.toLowerCase())) continue;
                        
                        if (!webName) webName = defaultWeb; 

                        let extractedShiftFromTime = 'UNKNOWN';
                        if (hour !== null) {
                            if (hour >= 7 && hour < 19) extractedShiftFromTime = 'กะเช้า';
                            else extractedShiftFromTime = 'กะดึก';
                        }

                        const realUser = getRealDbUser(empName);
                        let finalShift = extractedShiftFromTime;
                        
                        if (realUser) {
                            empName = realUser.username; 
                            if (realUser.allowed_shift && realUser.allowed_shift !== 'all') {
                                finalShift = realUser.allowed_shift;
                            } else if (realUser.allowed_shift === 'all') {
                                if (extractedShiftFromTime !== 'UNKNOWN') finalShift = extractedShiftFromTime;
                                else finalShift = 'กะอิสระ';
                            }
                        }

                        const finalRowDate = rowDate || detectedDate || document.getElementById('summaryDateFilter').value;
                        extractedRows.push({ empName, amount, website: webName, system: fileSystem, status: txStatus, odType: odType, date: finalRowDate, shift: finalShift });
                    }

                    const uniqueDates = [...new Set(extractedRows.map(r => r.date))];
                    const yesterdayDates = uniqueDates.map(d => window.getYesterdayDateStr(d));

                    let yestMap = {};
                    if (typeof appDB !== 'undefined' && yesterdayDates.length > 0) {
                        const { data: yestData } = await appDB.from('transaction_daily_summary')
                            .select('date, employee_name, website, count')
                            .in('date', yesterdayDates);
                        if (yestData) {
                            yestData.forEach(r => yestMap[`${r.date}_${window.cleanKeyStr(r.employee_name, r.website)}`] = parseInt(r.count) || 0);
                        }
                    }

                    extractedRows.forEach(row => {
                        let existingIndex = pendingSummaryData.findIndex(p => 
                            p.empName.toLowerCase() === row.empName.toLowerCase() && 
                            p.website.toLowerCase() === row.website.toLowerCase() && 
                            p.date === row.date
                        );
                        
                        const rowYestDate = window.getYesterdayDateStr(row.date);
                        const yestCount = yestMap[`${rowYestDate}_${window.cleanKeyStr(row.empName, row.website)}`] || 0;

                        let customSystems = JSON.parse(localStorage.getItem('custom_web_systems') || '{}');
                        if (customSystems[row.website]) { row.system = customSystems[row.website]; }

                        if (existingIndex > -1) {
                            pendingSummaryData[existingIndex].count += 1;
                            pendingSummaryData[existingIndex].totalAmount += row.amount; 
                            if (row.status === 'Reject') pendingSummaryData[existingIndex].rejectCount = (pendingSummaryData[existingIndex].rejectCount || 0) + 1;
                            else pendingSummaryData[existingIndex].approvedCount = (pendingSummaryData[existingIndex].approvedCount || 0) + 1;
                            
                            pendingSummaryData[existingIndex].yestCount = yestCount; 
                            pendingSummaryData[existingIndex].diffFromYesterday = pendingSummaryData[existingIndex].count - yestCount;
                        } else {
                            pendingSummaryData.push({
                                date: row.date, empName: row.empName, website: row.website, system: row.system, shift: row.shift, odType: row.odType,
                                count: 1, approvedCount: row.status !== 'Reject' ? 1 : 0, rejectCount: row.status === 'Reject' ? 1 : 0,
                                totalAmount: row.amount, yestCount: yestCount, diffFromYesterday: 1 - yestCount
                            });
                        }
                    });
                    totalExtracted += extractedRows.length;
                } catch (e) {
                    console.error(`Error in file ${file.name}:`, e);
                    window.pendingFileNames = window.pendingFileNames.filter(n => n !== fileName);
                    errorFiles.push(`${file.name} (${e.message})`);
                }
            } 

            const dateSpan = document.getElementById('summaryFileDates');
            if(dateSpan) {
                if (window.uploadedFileDates.size > 0) {
                    const dateArr = Array.from(window.uploadedFileDates).sort().map(d => {
                        const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`;
                    });
                    dateSpan.innerText = dateArr.join(', ');
                    dateSpan.className = "text-emerald-500 font-black"; 
                } else { dateSpan.innerText = '-'; }
            }

            viewMode = 'preview';
            renderSummaryDashboard();
            fetchLeaderboardData();

            // 🌟 แจ้งแบรนด์ TCG ที่จับคู่ไม่ได้ (จะตกไป default web ทำให้ยอดเพี้ยน)
            if (window._unknownTcgBrands && window._unknownTcgBrands.size > 0) {
                console.warn('[TCG] พบแบรนด์ที่ระบบยังไม่รู้จัก (รายการเหล่านี้ถูกจัดเป็น default web):', Array.from(window._unknownTcgBrands));
            }

            let resultHtml = `ดึงข้อมูลมาได้ <b>${totalExtracted}</b> รายการ (เฉพาะ OD)<br><span class="text-sm text-green-600 font-bold">(ยอดถูกบวกทบกันเรียบร้อยแล้ว)</span>`;
            if (skippedFiles.length > 0) resultHtml += `<br><br><span class="text-xs text-orange-500"><b>ข้ามไฟล์ซ้ำ:</b><br>${skippedFiles.join('<br>')}</span>`;
            if (errorFiles.length > 0) resultHtml += `<br><br><span class="text-xs text-red-500"><b>ไฟล์ที่มีปัญหา:</b><br>${errorFiles.join('<br>')}</span>`;

            if (totalExtracted > 0) Swal.fire({ icon: 'success', title: 'ประมวลผลเสร็จสิ้น!', html: resultHtml, showConfirmButton: true, confirmButtonColor: '#10b981' });
            else Swal.fire({ icon: 'warning', title: 'เสร็จสิ้น (ไม่ได้ข้อมูลเพิ่ม)', html: resultHtml, showConfirmButton: true, confirmButtonColor: '#f59e0b' });
            
        } catch (e) { Swal.fire('Error', 'เกิดข้อผิดพลาดในระบบ: ' + e.message, 'error'); }
        if (event.target && event.target.type === 'file') event.target.value = ''; 
    }); // ปิด Block loadExcelLibrary
};

window.debounceRenderSummary = function() {
    clearTimeout(summaryRenderTimer);
    summaryRenderTimer = setTimeout(() => { window.renderSummaryDashboard(); }, 200);
};

window.renderSummaryDashboard = function() {
    if (typeof SETTINGS !== 'undefined' && SETTINGS['summary_web_logos']) {
        try { window.summaryWebLogos = typeof SETTINGS['summary_web_logos'] === 'string' ? JSON.parse(SETTINGS['summary_web_logos']) : SETTINGS['summary_web_logos']; } 
        catch(e) { window.summaryWebLogos = {}; }
    } else if (typeof window.summaryWebLogos === 'undefined') { window.summaryWebLogos = {}; }
    const safeWebLogos = window.summaryWebLogos;

    const mainBox = document.getElementById('summaryTableBody');
    const webBox = document.getElementById('summaryWebGrid');
    const statsBox = document.getElementById('shiftSummaryStats');
    
    const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
    const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
    const searchKeyword = document.getElementById('summarySearch') ? document.getElementById('summarySearch').value.toLowerCase().trim() : '';

    if (webBox) webBox.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-1";
    if (mainBox) mainBox.className = "flex-1 overflow-y-auto custom-scrollbar pr-2 content-start";

    const hasData = typeof pendingSummaryData !== 'undefined' && pendingSummaryData.length > 0;

    if (!hasData) {
        let datesHtml = '';
        if (window.availableSummaryDates && window.availableSummaryDates.length > 0) {
            let btns = window.availableSummaryDates.map(d => {
                const [y, m, day] = d.split('-');
                return getTpl('tpl-date-button', { 
                    d: d, day: day, m: m, year: y, 
                    cardClass: window.selectedSummaryDates.has(d) ? 'bg-gradient-to-br from-sky-500 to-blue-600 border-transparent shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105 z-10' : 'bg-slate-800 border-slate-600 hover:border-sky-400 hover:bg-slate-700',
                    iconClass: window.selectedSummaryDates.has(d) ? 'text-white' : 'text-gray-500',
                    textClass: window.selectedSummaryDates.has(d) ? 'text-white' : 'text-gray-300',
                    checkIcon: window.selectedSummaryDates.has(d) ? 'check_circle' : 'radio_button_unchecked'
                });
            }).join('');
            datesHtml = getTpl('tpl-date-selector-container', { 
                datesHtml: btns, 
                selectedCount: window.selectedSummaryDates.size,
                disabledAttr: window.selectedSummaryDates.size === 0 ? 'disabled' : ''
            });
        }

        if(mainBox) mainBox.innerHTML = getTpl('tpl-no-data') + `<div class="text-center py-2 w-full">${datesHtml}</div>`;
        if(statsBox) statsBox.innerHTML = '<div class="text-center text-gray-400 text-sm py-2 w-full">ยังไม่มีข้อมูลยอดรวม</div>';
        
    } else {
        let shiftStats = { 'กะเช้า': 0, 'กะกลาง': 0, 'กะดึก': 0, 'UNKNOWN': 0, 'TOTAL': 0, 'TOTAL_YEST': 0, 'APPROVED': 0, 'REJECT': 0 };
        
        let filteredData = pendingSummaryData;
        if (shiftFilter !== 'ALL') filteredData = filteredData.filter(item => item.shift === shiftFilter || (shiftFilter==='UNKNOWN' && (item.shift==='กะอิสระ' || item.shift==='UNKNOWN')));
        if (odFilter !== 'ALL') filteredData = filteredData.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));
        if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter(item => item.website === summaryActiveWebFilter);

        filteredData = filteredData.filter(item => !item.empName.toLowerCase().includes('system') && !item.empName.toLowerCase().includes('auto'));

        filteredData.forEach(item => {
            shiftStats.TOTAL += item.count;
            shiftStats.TOTAL_YEST += item.yestCount || 0; 
            shiftStats.APPROVED += (item.approvedCount || 0);
            shiftStats.REJECT += (item.rejectCount || 0);
            if(shiftStats[item.shift] !== undefined) shiftStats[item.shift] += item.count;
            else shiftStats['UNKNOWN'] += item.count;
        });

        let grandDiff = shiftStats.TOTAL - shiftStats.TOTAL_YEST;
        let grandDiffHtml = '';
        if (grandDiff !== 0) grandDiffHtml = buildDiffBadge(grandDiff, 'ml-2 bg-slate-900 border-none scale-110');

        if (statsBox) {
            statsBox.innerHTML = getTpl('tpl-shift-stats', {
                total: shiftStats.TOTAL.toLocaleString(),
                totalDiffHtml: grandDiffHtml,
                approved: shiftStats.APPROVED.toLocaleString(),
                reject: shiftStats.REJECT.toLocaleString(),
                morning: shiftStats['กะเช้า'].toLocaleString(),
                afternoon: shiftStats['กะกลาง'].toLocaleString(),
                night: shiftStats['กะดึก'].toLocaleString()
            });
        }

        if (mainBox) {
            if (filteredData.length === 0) {
                mainBox.innerHTML = getTpl('tpl-no-data');
            } else {
                let htmlArr = [];
                
                if (viewMode === 'history' || viewMode === 'monthly_history') {
                    htmlArr.push(getTpl('tpl-history-header'));
                }

                let dateGroups = {};
                filteredData.forEach(item => {
                    let itemDate = item.date || document.getElementById('summaryDateFilter').value || 'ไม่ระบุวันที่';
                    if(!dateGroups[itemDate]) {
                        dateGroups[itemDate] = { totalCount: 0, totalYestCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, emps: {} };
                    }
                    let dGroup = dateGroups[itemDate];
                    dGroup.totalCount += item.count;
                    dGroup.totalYestCount += item.yestCount || 0; 
                    dGroup.totalMoney += item.totalAmount;
                    dGroup.totalApproved += (item.approvedCount || 0);
                    dGroup.totalReject += (item.rejectCount || 0);

                    if(!dGroup.emps[item.empName]) {
                        dGroup.emps[item.empName] = { totalCount: 0, totalYestCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, webs: [], shift: item.shift, odType: item.odType || 'ปกติ' };
                    }
                    dGroup.emps[item.empName].totalCount += item.count;
                    dGroup.emps[item.empName].totalYestCount += item.yestCount || 0; 
                    dGroup.emps[item.empName].totalApproved += (item.approvedCount || 0);
                    dGroup.emps[item.empName].totalReject += (item.rejectCount || 0);
                    dGroup.emps[item.empName].totalMoney += item.totalAmount;
                    dGroup.emps[item.empName].webs.push(item);
                });

                const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));

                sortedDates.forEach((dateStr) => {
                    const dGroup = dateGroups[dateStr];
                    let displayDate = dateStr;
                    if(dateStr.includes('-')) {
                        const [y, m, d] = dateStr.split('-');
                        const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
                        displayDate = `วันที่ ${parseInt(d)} ${monthNames[parseInt(m)-1]} ${parseInt(y)+543}`;
                    }

                    let groupDiff = dGroup.totalCount - dGroup.totalYestCount;
                    let groupDiffHtml = buildDiffBadge(groupDiff);

                    htmlArr.push(getTpl('tpl-date-group-start', {
                        displayDate: displayDate,
                        empCount: Object.keys(dGroup.emps).length,
                        totalCount: dGroup.totalCount.toLocaleString(),
                        totalDiffHtml: groupDiffHtml,
                        totalApproved: dGroup.totalApproved,
                        totalReject: dGroup.totalReject,
                        hiddenClass: sortedDates.length === 1 ? '' : 'hidden'
                    }));

                    let sortedEmps = Object.keys(dGroup.emps).sort((a, b) => dGroup.emps[b].totalCount - dGroup.emps[a].totalCount);
                    if (searchKeyword !== '') sortedEmps = sortedEmps.filter(name => name.toLowerCase().includes(searchKeyword));

                    if (sortedEmps.length === 0) {
                        htmlArr.push(getTpl('tpl-emp-not-found', { keyword: searchKeyword }));
                    } else {
                        sortedEmps.forEach((name, index) => {
                            const data = dGroup.emps[name];
                            
                            let shiftBadgeHtml = window.getShiftBadgeHtml(data.shift);

                            let odBadge = '';
                            if (data.odType === 'OD') odBadge = '<span class="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full ml-1 font-bold shadow">OD</span>';
                            if (data.odType === 'ODOL') odBadge = '<span class="text-[9px] bg-pink-600 text-white px-1.5 py-0.5 rounded-full ml-1 font-bold shadow">ODOL</span>';

                            let webTags = data.webs.map(w => {
                                let diffNum = w.count - (w.yestCount || 0);
                                let diffHtml = buildDiffBadge(diffNum, '');

                                return getTpl('tpl-web-subcard', {
                                    website: w.website, diffHtml: diffHtml,
                                    yestCount: w.yestCount || 0, count: w.count,
                                    approvedCount: w.approvedCount || 0, rejectCount: w.rejectCount || 0,
                                    totalAmount: w.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})
                                });
                            }).join('');

                            let quickWebBadges = data.webs.map(w => `<span class="bg-slate-900 border border-slate-600 px-1.5 py-0.5 rounded text-[10px] text-gray-300 whitespace-nowrap shadow-sm"><b class="text-sky-400">${w.website}:</b> ${w.count}</span>`).join('');

                            let empDiff = data.totalCount - data.totalYestCount;
                            let empDiffHtml = buildDiffBadge(empDiff, 'mt-1');

                            htmlArr.push(getTpl('tpl-emp-row', {
                                index: index + 1, name: name, odBadge: odBadge, shiftBadge: shiftBadgeHtml,
                                quickWebBadges: quickWebBadges, totalCount: data.totalCount, 
                                totalDiffHtml: empDiffHtml,
                                webTagsHtml: webTags
                            }));
                        });
                    }
                    htmlArr.push(getTpl('tpl-date-group-end'));
                });

                if (viewMode === 'history' || viewMode === 'monthly_history') {
                    let datesHtml = '';
                    if (window.availableSummaryDates && window.availableSummaryDates.length > 0) {
                        let btns = window.availableSummaryDates.map(d => {
                            const [y, m, day] = d.split('-');
                            return getTpl('tpl-date-button', { 
                                d: d, day: day, m: m, year: y, 
                                cardClass: window.selectedSummaryDates.has(d) ? 'bg-gradient-to-br from-sky-500 to-blue-600 border-transparent shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105 z-10' : 'bg-slate-800 border-slate-600 hover:border-sky-400 hover:bg-slate-700',
                                iconClass: window.selectedSummaryDates.has(d) ? 'text-white' : 'text-gray-500',
                                textClass: window.selectedSummaryDates.has(d) ? 'text-white' : 'text-gray-300',
                                checkIcon: window.selectedSummaryDates.has(d) ? 'check_circle' : 'radio_button_unchecked'
                            });
                        }).join('');
                        datesHtml = getTpl('tpl-date-selector-container', { 
                            datesHtml: btns, 
                            selectedCount: window.selectedSummaryDates.size,
                            disabledAttr: window.selectedSummaryDates.size === 0 ? 'disabled' : ''
                        });
                    }
                    htmlArr.push(getTpl('tpl-history-footer', { datesHtml: datesHtml }));
                }

                mainBox.innerHTML = htmlArr.join('');
            }
        }
    }

    if (webBox) {
        let webAgg = {};
        let defaultWebList = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188']; 
        let customSystems = JSON.parse(localStorage.getItem('custom_web_systems') || '{}');

        defaultWebList.forEach(web => {
            let sysLabel = 'SYSTEM';
            if (customSystems[web]) sysLabel = customSystems[web];
            else {
                if(['Jun88', 'MK8', 'VV72', 'TH26', 'BT678', 'K188'].includes(web)) sysLabel = 'K36';
                else if(['F168'].includes(web)) sysLabel = 'WG';
                else if(['PG688', 'JL69', 'NM9'].includes(web)) sysLabel = 'TCG';
            }
            webAgg[web] = { count: 0, amount: 0, sys: sysLabel };
        });

        if (hasData) {
            let dataForWebCards = pendingSummaryData;
            if (shiftFilter !== 'ALL') dataForWebCards = dataForWebCards.filter(item => item.shift === shiftFilter || (shiftFilter==='UNKNOWN' && item.shift==='กะอิสระ'));
            if (odFilter !== 'ALL') dataForWebCards = dataForWebCards.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));

            dataForWebCards.forEach(item => {
                if (!webAgg[item.website]) webAgg[item.website] = { count: 0, amount: 0, sys: item.system || 'SYSTEM' };
                webAgg[item.website].count += item.count;
                webAgg[item.website].amount += item.totalAmount;
                if (item.system) webAgg[item.website].sys = item.system;
            });
        }

        if (Object.keys(webAgg).length > 0) {
            webBox.innerHTML = Object.keys(webAgg).map(web => {
                const w = webAgg[web];
                const defaultImg = `https://ui-avatars.com/api/?name=${web}&background=random&color=fff&size=256`;
                const imgUrl = safeWebLogos[web] ? safeWebLogos[web] : defaultImg;
                const isActive = (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter === web);
                
                return getTpl('tpl-web-card', {
                    cardStyle: isActive ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20 scale-[1.02]' : 'hover:border-sky-500 hover:shadow-lg opacity-95 hover:opacity-100',
                    web: web, imgUrl: imgUrl, sys: w.sys,
                    filterBadge: isActive ? '<div class="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-30 flex items-center gap-1"><span class="material-icons text-[10px]">check_circle</span> กำลังดู</div>' : '',
                    countColor: w.count > 0 ? 'text-sky-400' : 'text-gray-500',
                    count: w.count.toLocaleString(),
                    amountColor: w.amount > 0 ? 'text-emerald-400 bg-[#0b1120] border-emerald-900/50' : 'text-gray-500 bg-slate-800 border-slate-700',
                    amount: w.amount.toLocaleString('en-US', {minimumFractionDigits: 2})
                });
            }).join('');
        }
    }
};

window.fetchLeaderboardData = async function() {
    const lbBox = document.getElementById('summaryLeaderboard');
    const modeEl = document.getElementById('leaderboardMode');
    const monthInput = document.getElementById('leaderboardMonth');
    const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
    
    if(!lbBox) return;

    let lbShiftFilter = document.getElementById('leaderboardShiftFilter');
    let lbWebFilter = document.getElementById('leaderboardWebFilter');
    
    if (!lbWebFilter && modeEl) {
        let webOptions = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188'];
        const filterHtml = `
            <select id="leaderboardShiftFilter" onchange="fetchLeaderboardData()" class="bg-transparent text-sky-400 text-[10px] font-bold outline-none cursor-pointer pr-1 border-r border-gray-600 mr-2">
                <option value="ALL" class="bg-slate-800 text-white">⏱️ รวมทุกกะ</option>
                <option value="กะเช้า" class="bg-slate-800 text-white">☀️ เช้า</option>
                <option value="กะกลาง" class="bg-slate-800 text-white">🌤️ กลาง</option>
                <option value="กะดึก" class="bg-slate-800 text-white">🌙 ดึก</option>
                <option value="UNKNOWN" class="bg-slate-800 text-gray-400">❓ ไม่ระบุกะ</option>
            </select>
            <select id="leaderboardWebFilter" onchange="fetchLeaderboardData()" class="bg-transparent text-emerald-400 text-[10px] font-bold outline-none cursor-pointer pr-1 border-r border-gray-600 mr-2">
                <option value="ALL" class="bg-slate-800 text-white">🏆 รวมทุกเว็บ</option>
                ${webOptions.map(w => `<option value="${w}" class="bg-slate-800 text-white">${w}</option>`).join('')}
            </select>
        `;
        modeEl.insertAdjacentHTML('beforebegin', filterHtml);
        lbShiftFilter = document.getElementById('leaderboardShiftFilter');
        lbWebFilter = document.getElementById('leaderboardWebFilter');
    }

    let mode = 'monthly';
    if(modeEl) mode = modeEl.value;
    const selectedWeb = lbWebFilter ? lbWebFilter.value : 'ALL';
    const shiftFilter = lbShiftFilter ? lbShiftFilter.value : 'ALL';

    if (monthInput) {
        if (mode === 'monthly') {
            monthInput.classList.remove('hidden');
            if(!monthInput.value) {
                const d = new Date();
                monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
        } else {
            monthInput.classList.add('hidden');
        }
    }

    lbBox.innerHTML = '<div class="text-center py-10 text-gray-400"><span class="material-icons animate-spin text-3xl mb-2">sync</span><br>กำลังคำนวณอันดับ...</div>';

    if (typeof fetchUsers === 'function' && (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    if (viewMode === 'preview' && pendingSummaryData.length > 0) {
        let aggMap = {};
        let targetData = pendingSummaryData;
        
        if (shiftFilter !== 'ALL') {
            targetData = targetData.filter(i => {
                let s = i.shift;
                if (!s || s === 'UNKNOWN') {
                    if (i.empName.includes('เช้า')) s = 'กะเช้า';
                    else if (i.empName.includes('กลาง')) s = 'กะกลาง';
                    else if (i.empName.includes('ดึก')) s = 'กะดึก';
                    else s = 'UNKNOWN';
                }
                return s === shiftFilter || (shiftFilter === 'UNKNOWN' && s === 'กะอิสระ');
            });
        }
        
        if (odFilter !== 'ALL') targetData = targetData.filter(i => i.odType === odFilter || (i.odType === undefined && odFilter === 'ปกติ'));
        if (selectedWeb !== 'ALL') targetData = targetData.filter(i => i.website === selectedWeb); 

        targetData.forEach(r => {
            const name = r.empName;
            if (!name || name.toLowerCase().includes('system') || name.toLowerCase().includes('auto')) return;

            if (!aggMap[name]) aggMap[name] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, shift: r.shift };
            aggMap[name].totalCount += r.count;
            aggMap[name].totalMoney += r.totalAmount;
            aggMap[name].totalApproved += (r.approvedCount || 0);
            aggMap[name].totalReject += (r.rejectCount || 0);
        });

        drawLeaderboardFromMap(aggMap, lbBox);
        return;
    }

    try {
        // [FIX] เดิม await query ตรง ๆ ซึ่งถูกตัดที่ 1000 แถวโดยไม่แจ้ง error
        // วัดจริง: เดือน ส.ค. 2026 มี 1,213 แถว → อันดับขาดไป 213 แถว
        // และถ้าไม่ได้เลือกโหมดรายเดือน จะดึงทั้งตาราง 7,104 แถว เหลือ 1,000
        // จึงเก็บเงื่อนไขไว้ก่อน แล้วให้ selectAllRows สร้าง query ใหม่ทีละหน้า
        let _lbStart = null, _lbEnd = null;

        if (mode === 'monthly' && monthInput && monthInput.value) {
            const [year, month] = monthInput.value.split('-');
            _lbStart = `${year}-${month}-01`;
            // [FIX เวลา] เดิมใช้ .toISOString() ซึ่งแปลงเป็นเวลา UTC (+0)
            // ทำให้ "วันสุดท้ายของเดือน เที่ยงคืนเวลาไทย" กลายเป็นวันก่อนหน้า
            // ผลคือยอดของวันสุดท้ายของทุกเดือนหายไปจากอันดับ
            // แก้เป็น: เอาเฉพาะ "เลขวัน" มาประกอบข้อความเอง ไม่ผ่าน UTC
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            _lbEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        }

        const _buildLbQuery = () => {
            let q = appDB.from('transaction_daily_summary').select('date, employee_name, website, count, approved_count, reject_count, total_amount').order('id', { ascending: true });
            if (_lbStart && _lbEnd) q = q.gte('date', _lbStart).lte('date', _lbEnd);
            if (selectedWeb !== 'ALL') q = q.eq('website', selectedWeb);
            return q;
        };

        const { data, error } = await window.selectAllRows(_buildLbQuery);
        if (error) throw error;

        if (!data || data.length === 0) {
            lbBox.innerHTML = '<div class="text-center py-10 text-gray-400 font-bold">ไม่มีข้อมูลจัดอันดับ</div>';
            return;
        }

        let aggMap = {};
        data.forEach(r => {
            const name = r.employee_name;
            if (!name || name.toLowerCase().includes('system') || name.toLowerCase().includes('auto')) return;

            let shift = typeof getShiftFromName === 'function' ? getShiftFromName(name) : 'UNKNOWN';
            
            if (shift === 'UNKNOWN') {
                if (name.includes('เช้า')) shift = 'กะเช้า';
                else if (name.includes('กลาง')) shift = 'กะกลาง';
                else if (name.includes('ดึก')) shift = 'กะดึก';
            }

            // ยอมให้โชว์ถ้ากะตรงกับที่เลือก หรือเลือกหาคนไม่ระบุกะ
            if (shiftFilter !== 'ALL' && shift !== shiftFilter && !(shiftFilter === 'UNKNOWN' && shift === 'กะอิสระ')) return;
            
            if (!aggMap[name]) aggMap[name] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, shift: shift };
            aggMap[name].totalCount += parseInt(r.count) || 0;
            aggMap[name].totalMoney += parseFloat(r.total_amount) || 0;
            
            const appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : parseInt(r.count) || 0;
            const rejCount = (r.reject_count !== undefined && r.reject_count !== null) ? parseInt(r.reject_count) : 0;

            aggMap[name].totalApproved += appCount;
            aggMap[name].totalReject += rejCount;
        });

        drawLeaderboardFromMap(aggMap, lbBox);

    } catch (e) {
        lbBox.innerHTML = '<div class="text-center py-10 text-red-500 font-bold">โหลดข้อมูลผิดพลาด</div>';
    }
};

function drawLeaderboardFromMap(aggMap, lbBox) {
    const sortedEmps = Object.keys(aggMap).sort((a, b) => {
        if (aggMap[b].totalCount !== aggMap[a].totalCount) {
            return aggMap[b].totalCount - aggMap[a].totalCount; 
        }
        return aggMap[b].totalApproved - aggMap[a].totalApproved; 
    });

    if(sortedEmps.length === 0) {
        lbBox.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">ไม่พบข้อมูล</div>`;
        return;
    }

    // 🌟 เอา .slice ออก เพื่อวาดทุกคนลงไป แต่เดี๋ยวเราจะให้ฟังก์ชันค้นหาช่วยซ่อนให้
    lbBox.innerHTML = sortedEmps.map((name, i) => {
        const d = aggMap[name];
        let medalClass = ''; let medalText = i + 1;
        if (i === 0) medalClass = 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
        else if (i === 1) medalClass = 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 scale-105 shadow-md'; 
        else if (i === 2) medalClass = 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-50 scale-105 shadow-md'; 
        else medalClass = 'bg-slate-700 text-slate-400 border border-slate-600'; 

        return getTpl('tpl-leaderboard-item', {
            name: name, medalClass: medalClass, medalText: medalText,
            totalCount: d.totalCount, totalApproved: d.totalApproved, totalReject: d.totalReject,
            totalMoney: d.totalMoney.toLocaleString('en-US', {minimumFractionDigits: 2})
        });
    }).join('');

    if(typeof window.filterSummaryLeaderboard === 'function') window.filterSummaryLeaderboard();
}

window.saveSummaryToSupabase = async function() {
    if (viewMode === 'monthly_history') return Swal.fire('ข้อมูลรายเดือน', 'นี่คือข้อมูลสรุปรวมทั้งเดือนจากฐานข้อมูล ไม่สามารถบันทึกซ้ำได้ครับ', 'info');
    if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'กรุณาอัปโหลดไฟล์ให้เรียบร้อยก่อนบันทึก', 'warning');

    Swal.fire({title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const fallbackDate = document.getElementById('summaryDateFilter').value;
        const groupedData = {};
        
        pendingSummaryData.forEach(item => {
            const dateVal = item.date || fallbackDate;
            const empName = (item.empName || '').trim();
            const web = (item.website || '').trim();
            
            const key = `${dateVal}_${empName.toLowerCase()}_${web.toLowerCase()}`;

            if (!groupedData[key]) {
                groupedData[key] = {
                    date: dateVal, employee_name: empName, website: web, system: item.system || 'UNKNOWN',
                    count: item.count || 0, total_amount: item.totalAmount || 0,
                    approved_count: item.approvedCount || 0, reject_count: item.rejectCount || 0
                };
            } else {
                groupedData[key].count += (item.count || 0);
                groupedData[key].total_amount += (item.totalAmount || 0);
                groupedData[key].approved_count += (item.approvedCount || 0);
                groupedData[key].reject_count += (item.rejectCount || 0);
            }
        });

        const finalInsertData = Object.values(groupedData);

        const chunkSize = 500;
        for (let i = 0; i < finalInsertData.length; i += chunkSize) {
            const chunk = finalInsertData.slice(i, i + chunkSize);
            window._sumCache = {};  // มีข้อมูลใหม่เข้า → ล้าง cache
            const { error } = await appDB.from('transaction_daily_summary').upsert(chunk, { onConflict: 'date,employee_name,website' });
            if (window.clearQueryCache) window.clearQueryCache('sum_');
            if (error) throw error;
        }

        if (window.pendingFileNames && window.pendingFileNames.length > 0) {
            const { data: savedFilesData } = await appDB.from('settings').select('value').eq('key', 'saved_excel_files').single();
            let savedFilesList = savedFilesData && savedFilesData.value ? JSON.parse(savedFilesData.value) : [];
            savedFilesList = [...new Set([...savedFilesList, ...window.pendingFileNames])];
            await appDB.from('settings').upsert([{ key: 'saved_excel_files', value: JSON.stringify(savedFilesList) }]);
            window.pendingFileNames = []; 
        }

        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false});
        
        viewMode = 'history';
        await fetchAvailableDates(); 
        document.getElementById('summaryDateFilter').value = fallbackDate; 
        await window.fetchHistoricalSummary(true); 

        // [FIX] เดิมสร้าง channel ใหม่แล้ว .send() ทันทีโดยไม่ได้ subscribe ก่อน — Supabase จะไม่ส่งออกไปจริง
        // ใช้ channel เดิมที่ subscribeSummaryChanges เปิดค้างไว้แทน
        if (summarySubscription) {
            summarySubscription.send({
                type: 'broadcast', event: 'force_summary_reload', payload: { date: fallbackDate }
            });
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.fetchHistoricalSummary = async function(silent = false) {
    const dateVal = document.getElementById('summaryDateFilter') ? document.getElementById('summaryDateFilter').value : '';
    if (!dateVal) return;

    if (!silent) Swal.fire({ title: 'กำลังดึงข้อมูลรายวัน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // 🌟 [แก้บัคกะ] บังคับรีเฟรชรายชื่อพนักงาน + ล้าง cache กะ ทุกครั้งที่เปลี่ยนวัน
        // เพื่อให้กะที่แอดมินเพิ่งแก้สะท้อนกลับทันทีในข้อมูลย้อนหลัง
        if (typeof window.refreshUserListForSummary === 'function') {
            await window.refreshUserListForSummary();
        } else if (typeof fetchUsers === 'function') {
            try { await fetchUsers(true); } catch(e) { console.warn('fetchUsers refresh failed', e); }
        }

        // 🌟 แก้ไข: บังคับคำนวณหาวันที่เมื่อวานให้ถูกต้องที่สุด
        const yesterdayDateObj = new Date(dateVal);
        yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
        const yesterdayStr = `${yesterdayDateObj.getFullYear()}-${String(yesterdayDateObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDateObj.getDate()).padStart(2, '0')}`;

        // ⚡ กันยิงซ้ำ: ถ้าคำขอชุดเดิม (วันเดียวกัน) ยังวิ่งอยู่ ให้รอผลก้อนเดิมแทนการยิงใหม่
        //    และเก็บผลไว้ใช้ซ้ำ 20 วินาที (กดสลับหน้าไปมาไม่ต้องโหลดใหม่ทุกครั้ง)
        window._sumCache = window._sumCache || {};
        const _ck = `daily_${dateVal}`;
        const _now = Date.now();
        let _entry = window._sumCache[_ck];
        if (!_entry || (!_entry.promise && _now - (_entry.ts || 0) > 20000)) {
            _entry = window._sumCache[_ck] = {
                ts: _now,
                promise: Promise.all([
                    appDB.from('transaction_daily_summary').select('date, employee_name, website, count, approved_count, reject_count, total_amount').eq('date', dateVal),
                    appDB.from('transaction_daily_summary').select('employee_name, website, count').eq('date', yesterdayStr),
                    appDB.from('schedules').select('staff_name, shift_name').eq('work_date', dateVal)
                ]),
            };
            _entry.promise.then(r => { _entry.data = r; _entry.promise = null; _entry.ts = Date.now(); })
                          .catch(() => { delete window._sumCache[_ck]; });
        }
        const [todayRes, yestRes, schedulesRes] = _entry.promise ? await _entry.promise : _entry.data;

        if (todayRes.error) throw todayRes.error;

        let yestMap = {};
        if (yestRes.data) {
            // 🌟 แก้ไข: จัดเก็บข้อมูลของเมื่อวานให้แม่นยำ
            yestRes.data.forEach(r => yestMap[`${window.cleanKeyStr(r.employee_name, r.website)}`] = parseInt(r.count) || 0);
        }

        let schMap = {};
        if (schedulesRes && schedulesRes.data) {
            schedulesRes.data.forEach(s => schMap[`${s.work_date}_${(s.staff_name || '').toLowerCase().trim()}`] = s.shift_name);
        }

        if (todayRes.data && todayRes.data.length > 0) {
            let mappedData = todayRes.data.map(r => {
                const todayCount = parseInt(r.count) || 0;
                
                // 🌟 ดึงข้อมูลของเมื่อวานมาเทียบ (ถ้าไม่มีให้เป็น 0)
                const yestCount = yestMap[window.cleanKeyStr(r.employee_name, r.website)] || 0;
                
                const appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : todayCount;
                const rejCount = (r.reject_count !== undefined && r.reject_count !== null) ? parseInt(r.reject_count) : 0;

                let empKey = (r.employee_name || '').toLowerCase().trim();
                // 🌟 [แก้บัคกะ v3] ดึง user object ออกมาตรงๆ แล้วใช้ allowed_shift ที่ raw
                // เหตุผล: getShiftFromName ผ่าน normalize อีกชั้น ถ้า DB เก็บ format แปลกๆ
                // (เช่น 'morning' หรือเว้นวรรค) จะคืน UNKNOWN แล้วตกไปใช้ schedules วันเก่า
                const realUser = typeof getRealDbUser === 'function' ? getRealDbUser(r.employee_name) : null;
                let actualShift;
                
                if (realUser && realUser.allowed_shift) {
                    const rawShift = String(realUser.allowed_shift).trim().toLowerCase();
                    // ถ้าพนักงานมีกะถาวรในระบบ (ไม่ใช่ 'all'/'อิสระ') → ใช้ค่าล่าสุดจาก users เลย
                    if (rawShift && rawShift !== 'all' && rawShift !== 'กะอิสระ' && rawShift !== 'อิสระ') {
                        actualShift = realUser.allowed_shift; // ใช้ค่า raw ส่งให้ normalize ทีหลัง
                    } else {
                        // พนักงานกะอิสระ → ค่อยดู schedules ของวันนั้น
                        actualShift = schMap[`${r.date}_${empKey}`] || realUser.allowed_shift;
                    }
                } else {
                    // ไม่เจอ user ในระบบ → ดู schedules ก่อน, ถ้าไม่มีค่อย fallback การเดาจากชื่อ
                    actualShift = schMap[`${r.date}_${empKey}`] 
                        || (typeof getShiftFromName === 'function' ? getShiftFromName(r.employee_name) : 'UNKNOWN');
                }
                
                actualShift = window.normalizeShiftName(actualShift);

                // 🌟 [Debug] ถ้ายังโชว์กะผิดให้เปิด F12 → console ดู log นี้แล้วส่งกลับให้ดู
                if (window._debugSummaryShift) {
                    console.log('[Shift Debug]', r.employee_name, {
                        foundInUserList: !!realUser,
                        rawAllowedShift: realUser ? realUser.allowed_shift : null,
                        schedulesShift: schMap[`${r.date}_${empKey}`] || null,
                        finalShift: actualShift
                    });
                }

                return {
                    empName: r.employee_name, website: r.website, system: r.system, count: todayCount, totalAmount: parseFloat(r.total_amount) || 0,
                    shift: actualShift, 
                    yestCount: yestCount, // 🌟 กำหนดค่าที่นี่ให้ชัดเจน
                    diffFromYesterday: todayCount - yestCount, // 🌟 คำนวณส่วนต่าง
                    approvedCount: appCount, rejectCount: rejCount
                };
            });
            
            pendingSummaryData = mappedData; 
            viewMode = 'history';
            
            renderSummaryDashboard(); 
            fetchLeaderboardData();
            
            if (!silent) {
                Swal.fire({ icon: 'success', title: 'ดึงข้อมูลสำเร็จ', timer: 1000, showConfirmButton: false });
            } else {
                Swal.close(); 
            }
        } else {
            pendingSummaryData = []; 
            renderSummaryDashboard(); 
            fetchLeaderboardData();
            if (!silent) Swal.fire('ไม่มีข้อมูล', `ไม่มีข้อมูลสรุปยอดของวันที่ ${dateVal}`, 'info');
        }
    } catch (e) { 
        if (!silent) Swal.fire('Error', e.message, 'error'); 
        console.error("Fetch Summary Error:", e);
    }
};

// ==========================================