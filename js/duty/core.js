// ════════════════════════════════════════════════════════════════════
// 📦 duty/core.js — ส่วนที่ 1/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: แกนหลัก: ตัวแปรกลาง, ตัวช่วยกลาง, โหลด/วาด/บันทึกตารางเวร, ค้นหา
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
let currentDutyDept = 'AM';
let dutyAccessMatrix = {}; 
let customDutyRoles = {}; 
let currentDutyLeaves = new Set(); 

// [FIX] กะที่พนักงานต้องทำงานจริง "ของวันที่เลือก"
// users.allowed_shift คือกะปัจจุบัน ซึ่งยังไม่เปลี่ยนจนกว่า task จะยิงตอน 05:00 ของวันถัดไป
// คนที่สลับเช้า→ดึกวันนี้ จึงยังเป็น 'กะเช้า' ใน DB ทั้งที่ต้องเข้าดึก 20:00 วันนี้
// ฟังก์ชันนี้เอา scheduled_tasks ของวันนั้นมาทับให้ตรงความจริง
window.getDutyShiftForToday = function(u) {
    if (!u) return null;
    const override = window.currentDutyShiftToday && window.currentDutyShiftToday[String(u.id)];
    return override || u.allowed_shift;
};

window.isDutyShiftMatch = function(u, shiftFilter) {
    const shift = window.getDutyShiftForToday(u);
    return shift === shiftFilter || shift === 'all';
};
let dutySubscription = null;
let sortedTeams = []; 
// ⚠️ ตัวนี้ประกาศด้วย let ที่ระดับไฟล์ จึง "ไม่ได้อยู่บน window"
// อ่านผ่าน window.currentRosterData จะได้ undefined เสมอ — ให้เรียกชื่อตรงๆ เท่านั้น
// (เคยพลาดมาแล้ว ทำให้แผงซัพพอร์ตนับจำนวนคนได้ 0 ทุกเว็บทั้งที่ตารางมีคน)
let currentRosterData = {};
let window_currentAssignedStaff = [];

window.isDutyAdmin = function() {
    // ปรับชื่อแผนกให้ตรงกับรหัสสิทธิ์
    let deptCheck = currentDutyDept;
    if (deptCheck === 'TRAINER_AM') deptCheck = 'AMQL';
    if (deptCheck === 'TRAINER_OD') deptCheck = 'ODQL';
    
    // ดึงค่าสิทธิ์ตามแท็บที่เปิดดูอยู่ เช่น duty_manage_am, duty_manage_od
    const reqPerm = 'duty_manage_' + deptCheck.toLowerCase();
    
    // ระบบจะยอมให้จัดการได้ ถ้ามีสิทธิ์ตรงตามแผนก หรือมีสิทธิ์จัดการแบบรวม (เผื่อแอดมินหลัก)
    return window.hasUserPerm(reqPerm) || window.hasUserPerm('duty_manage'); 
};

// ==========================================
// 🧰 [REFACTOR] ตัวช่วยกลาง — เดิมเงื่อนไขพวกนี้ถูกก๊อปวางซ้ำหลายสิบจุด
// แก้ที่นี่ที่เดียว ทุกระบบในไฟล์จะได้ค่าตรงกัน
// ==========================================

// แผนกนี้เป็น "ผู้สอน" ไหม (AMQL / ODQL / TRAINER_*)
window.isTrainerDept = function(dept) {
    dept = dept || currentDutyDept || '';
    return dept === 'AMQL' || dept === 'ODQL' || dept.startsWith('TRAINER');
};

// แปลงแผนกของ user ให้เทียบกับแท็บได้ (TRAINER เก่า = AMQL)
window.normalizeUserDept = function(u) {
    let d = (u && u.department) || 'AM';
    if (d === 'TRAINER') d = 'AMQL';
    return d;
};

// รายชื่อ "คนที่มาทำงานจริง" ของแผนก+กะที่เลือก (ตัดคนลาหยุดแล้ว)
// opts.anyRole = true → ไม่บังคับ role 'staff' (ใช้กับงานพิเศษของผู้สอน)
window.getDutyActiveStaff = function(shiftFilter, opts) {
    opts = opts || {};
    const trainer = window.isTrainerDept();
    return (GLOBAL_USER_LIST || []).filter(u => {
        if (!u) return false;
        if (window.normalizeUserDept(u) !== currentDutyDept) return false;
        if (!opts.anyRole && !trainer && u.role !== 'staff') return false;
        if (!window.isDutyShiftMatch(u, shiftFilter)) return false;
        if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;
        return true;
    });
};

const LEAVE_STYLES = {
    'X': { text: '✕ หยุดปกติ', color: 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/40 dark:text-red-400', border: 'border-red-200 dark:border-red-900/50' },
    'Table-Booking': { text: '✕ หยุดปกติ', color: 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/40 dark:text-red-400', border: 'border-red-200 dark:border-red-900/50' },
    'XX': { text: 'XX เปลี่ยนกะ', color: 'text-yellow-800 bg-yellow-100 border-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700/50' },
    'X4': { text: 'X4 ลาครึ่งวัน', color: 'text-pink-700 bg-pink-100 border-pink-300 dark:bg-pink-900/40 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-900/50' },
    'KL': { text: 'KL ลากิจ', color: 'text-green-800 bg-green-100 border-green-400 dark:bg-green-900/40 dark:text-green-400', border: 'border-green-300 dark:border-green-800/50' },
    'TL': { text: 'TL สลับวันหยุด', color: 'text-blue-800 bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800/50' },
    'TX': { text: 'TX สลับวันหยุด', color: 'text-blue-800 bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800/50' },
    'PN': { text: 'PN พักร้อน', color: 'text-white bg-amber-800 border-amber-900 dark:bg-amber-900 dark:text-amber-200', border: 'border-amber-700 dark:border-amber-800/50' }
};

const TEAM_COLORS = {
    'Jun88': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800', lightBg: 'bg-blue-100', lightText: 'text-blue-800' },
    'MK8': { bg: 'bg-black', text: 'text-yellow-400', border: 'border-yellow-600', lightBg: 'bg-gray-800', lightText: 'text-yellow-500' },
    'F168': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-700', lightBg: 'bg-orange-100', lightText: 'text-orange-800' },
    'PG688': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', lightBg: 'bg-amber-50', lightText: 'text-amber-700' },
    'JL69': { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-700', lightBg: 'bg-slate-200', lightText: 'text-slate-800' },
    'TH26': { bg: 'bg-gray-700', text: 'text-white', border: 'border-gray-900', lightBg: 'bg-gray-200', lightText: 'text-gray-800' },
    'VV72': { bg: 'bg-red-800', text: 'text-white', border: 'border-red-950', lightBg: 'bg-red-100', lightText: 'text-red-800' },
    'NM9': { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-700', lightBg: 'bg-pink-100', lightText: 'text-pink-800' },
    'สอนงาน': { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-700', lightBg: 'bg-emerald-100', lightText: 'text-emerald-800' },
    'Telegram': { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-700', lightBg: 'bg-sky-100', lightText: 'text-sky-800' },
    'DEFAULT': { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-700', lightBg: 'bg-indigo-100', lightText: 'text-indigo-800' }
};

window.syncTeamOrder = function() {
    // ลบเงื่อนไขดักของผู้สอนออก ให้ทุกคนดึงรายชื่อเว็บจาก TEAM_LIST เหมือนกันหมด
    const savedOrder = JSON.parse(localStorage.getItem('duty_team_order') || '[]');
    let validSaved = savedOrder.filter(t => TEAM_LIST.includes(t));
    
    // ดึงเว็บมาตรฐานทั้งหมดมาใส่
    TEAM_LIST.forEach(t => { if(!validSaved.includes(t)) validSaved.push(t); });
    
    sortedTeams = validSaved;
}

window.moveTeam = function(teamName, direction) {
    if (window.isTrainerDept()) return; 
    const index = sortedTeams.indexOf(teamName);
    if(index === -1) return;
    if(direction === -1 && index > 0) { [sortedTeams[index - 1], sortedTeams[index]] = [sortedTeams[index], sortedTeams[index - 1]]; } 
    else if (direction === 1 && index < sortedTeams.length - 1) { [sortedTeams[index], sortedTeams[index + 1]] = [sortedTeams[index + 1], sortedTeams[index]]; }
    window.safeSetItem('duty_team_order', JSON.stringify(sortedTeams));
    window.renderDutyRequirements();
    window.updateDutyStats(); 
}

window.initDutyApp = async function() {
    Swal.fire({title: 'โหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const dateInput = document.getElementById('dutyDate');
        if (dateInput && !dateInput.value) {
            const today = new Date(); const offset = today.getTimezoneOffset() * 60000;
            dateInput.value = (new Date(today - offset)).toISOString().slice(0, 10);
        }

        // 🚀 ดึง users + access matrix/roles ขนานกัน (อิสระต่อกัน)
        const initFetches = [window.loadDutyAccessAndRoles()];
        if (GLOBAL_USER_LIST.length === 0 && typeof fetchUsers === 'function') {
            initFetches.push(fetchUsers());
        }
        await Promise.all(initFetches);
        
        const teamSelect = document.getElementById('roleEditorTeam');
        if(teamSelect) {
            let opts = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`);
            teamSelect.innerHTML = opts.join('');
        }
        
        window.syncTeamOrder();
        window.ensureDutyExtraButtons();
        window.applyDutyRoleUI(); 

        window.renderDutyAccessTable();
        window.renderDutyRequirements();
        await window.refreshDutyData(); 
        window.renderRoleEditorList();

        window.subscribeDutyChanges(); 
        
        // 🌟 [แก้บัค Realtime] reset flag เพราะเพิ่ง refresh ไป
        window._dutyPendingReload = false;
        window._dutyLastReloadTime = Date.now();
    } catch (err) { console.error("Init Duty Error:", err); } 
    finally { Swal.close(); }
}

// [FIX] ชื่อเว็บ VV72 เคยถูกพิมพ์เป็น 'Vv72' ในข้อมูลเก่า ทำให้มี 2 key ซ้อนกัน
// (สีคนละสี / หัวข้อแยกกัน / ต้อง hack `web === 'VV72' ? 'Vv72' : web` ทุกจุด)
// รวมให้เหลือ 'VV72' ตัวเดียวตอนโหลด — คืนค่า true ถ้ามีการแก้ (จะได้เขียนกลับ DB ทีเดียว)
const TEAM_ALIASES = { 'Vv72': 'VV72' };
window.normalizeTeamName = function(t) { return TEAM_ALIASES[t] || t; };

function normalizeRolesObject(roles) {
    let changed = false;
    Object.keys(TEAM_ALIASES).forEach(oldKey => {
        if (!(oldKey in roles)) return;
        const newKey = TEAM_ALIASES[oldKey];
        const merged = [...(roles[newKey] || [])];
        (roles[oldKey] || []).forEach(r => { if (!merged.includes(r)) merged.push(r); });
        roles[newKey] = merged;
        delete roles[oldKey];
        changed = true;
    });
    return changed;
}
function normalizeAccessMatrix(matrix) {
    let changed = false;
    Object.keys(matrix).forEach(uid => {
        const arr = matrix[uid];
        if (!Array.isArray(arr)) return;
        const fixed = [];
        arr.forEach(t => { const n = window.normalizeTeamName(t); if (!fixed.includes(n)) fixed.push(n); });
        if (fixed.length !== arr.length || fixed.some((t, i) => t !== arr[i])) { matrix[uid] = fixed; changed = true; }
    });
    return changed;
}

window.loadDutyAccessAndRoles = async function() {
    try {
        const { data } = await appDB.from('settings').select('*').in('key', ['duty_access_matrix', 'duty_custom_roles']);
        if(data) {
            const accessData = data.find(d => d.key === 'duty_access_matrix');
            if(accessData && accessData.value) dutyAccessMatrix = JSON.parse(accessData.value);
            else dutyAccessMatrix = {};
            if (normalizeAccessMatrix(dutyAccessMatrix)) {
                window.clearSettingCache();
                appDB.from('settings').upsert([{ key: 'duty_access_matrix', value: JSON.stringify(dutyAccessMatrix) }]).then(() => {}, () => {});
            }

            const rolesData = data.find(d => d.key === 'duty_custom_roles');
            if(rolesData && rolesData.value && Object.keys(JSON.parse(rolesData.value)).length > 0) {
                customDutyRoles = JSON.parse(rolesData.value);
                if (normalizeRolesObject(customDutyRoles)) {
                    window.clearSettingCache();
                    appDB.from('settings').upsert([{ key: 'duty_custom_roles', value: JSON.stringify(customDutyRoles) }]).then(() => {}, () => {});
                }
            } else { 
                // ค่าเริ่มต้นสำหรับแต่ละเว็บ
                customDutyRoles = {
                    'Jun88': [],
                    'MK8': [],
                    'VV72': [],
                    'TH26': [],
                    'K188': [],
                    'BT678': [],
                    'PG688': [],
                    'JL69': [],
                    'NM9': [],
                    'F168': [],
                }; 
                // บันทึกขึ้นฐานข้อมูลทันทีเพื่อให้แอดมินแก้ไขทีหลังได้
                appDB.from('settings').upsert([{ key: 'duty_custom_roles', value: JSON.stringify(customDutyRoles) }]);
            }
        }
    } catch(e) { dutyAccessMatrix = {}; customDutyRoles = {}; }
}

// 🌟 [แก้บัค Realtime] flag บอกว่ามีการเปลี่ยนตอนไม่อยู่หน้านี้ (ตอนเข้ามาจะ reload ทันที)
window._dutyPendingReload = false;
window._dutyLastReloadTime = 0;

window.subscribeDutyChanges = function() {
    if(dutySubscription) { 
        try { appDB.removeChannel(dutySubscription); } catch(e) {}
        dutySubscription = null;
    }
    
    dutySubscription = appDB.channel('duty-updates').on('broadcast', { event: 'force_reload' }, () => {
        const dutyApp = document.getElementById('dutyApp');
        const isOnDutyPage = dutyApp && !dutyApp.classList.contains('hidden');
        
        if (isOnDutyPage) {
            // กัน reload ถี่เกิน (debounce 800ms) เผื่อ broadcast มาหลายครั้งติดกัน
            const now = Date.now();
            if (now - window._dutyLastReloadTime < 800) {
                window._dutyPendingReload = true;
                setTimeout(() => {
                    if (window._dutyPendingReload && !document.getElementById('dutyApp').classList.contains('hidden')) {
                        window._dutyPendingReload = false;
                        window._dutyLastReloadTime = Date.now();
                        window.refreshDutyData();
                    }
                }, 1000);
                return;
            }
            window._dutyLastReloadTime = now;
            window.refreshDutyData();
        } else {
            // ไม่ได้อยู่หน้านี้ → จำไว้ก่อน ตอนกลับมาเข้าจะ reload
            window._dutyPendingReload = true;
        }
    }).subscribe();
    
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(dutySubscription);
    // ปิด polling เมื่อ subscription ถูก unsubscribe ตอนออกจากหน้า (เดิม timer วิ่งค้างตลอด)
    if (dutySubscription && !dutySubscription._dutyPatched) {
        dutySubscription._dutyPatched = true;
        const _origUnsub = dutySubscription.unsubscribe && dutySubscription.unsubscribe.bind(dutySubscription);
        if (_origUnsub) dutySubscription.unsubscribe = function() {
            if (window._dutyPollingTimer) { clearInterval(window._dutyPollingTimer); window._dutyPollingTimer = null; }
            return _origUnsub.apply(this, arguments);
        };
    }
    
    // 🌟 [แก้บัค Realtime] Polling fallback ทุก 30 วิ — เผื่อ broadcast หลุด/เน็ตกระตุก
    if (window._dutyPollingTimer) clearInterval(window._dutyPollingTimer);
    window._dutyPollingTimer = setInterval(() => {
        const dutyApp = document.getElementById('dutyApp');
        if (dutyApp && !dutyApp.classList.contains('hidden')) {
            // เช็คทุก 30 วิว่ามีของใหม่ไหม
            if (typeof window.refreshDutyData === 'function') {
                window.refreshDutyData();
            }
        }
    }, 30000);
}

window.applyDutyRoleUI = function() {
    const isAdmin = window.isDutyAdmin();
    const isTrainerDept = (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || (currentUser.department && currentUser.department.startsWith('TRAINER'))); 
    const isTrainerRole = (currentUser.role && currentUser.role.toLowerCase() === 'trainer');

    let canManageDuty = isAdmin;
    
    // 🚨 กฎเหล็กฮาร์ดโค้ด: ถ้ากำลังเปิดแท็บ "ผู้สอน" (AMQL, ODQL)
    // คนที่จะมีสิทธิ์จัดการ/สุ่มเวรได้ ต้องเป็น 'admin' หรือ 'manager' เท่านั้น!
    // ผู้สอน (trainer) จะถูกริบสิทธิ์ปุ่มจัดการทันที แม้ในหลังบ้านจะเผลอติ๊กสิทธิ์ไว้ก็ตาม
    if (window.isTrainerDept()) {
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            canManageDuty = false; 
        }
    }
    
    const adminElements = document.querySelectorAll('.duty-admin-only');
    const trainerBtn = document.getElementById('btnDutyTRAINER'); 
    
    if(trainerBtn) {
        if(isAdmin || isTrainerDept || isTrainerRole) {
            trainerBtn.classList.remove('hidden', 'no-perm-hidden'); trainerBtn.style.display = '';
        } else trainerBtn.classList.add('hidden');
    }
    
    if (!canManageDuty) {
        adminElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
        const shiftSelect = document.getElementById('dutyShiftSelect');
        if (shiftSelect && currentUser.allowed_shift !== 'all') shiftSelect.value = currentUser.allowed_shift;
        const indicator = document.getElementById('staffShiftIndicator');
        if (indicator) {
            indicator.classList.remove('hidden', 'no-perm-hidden'); indicator.style.display = '';
            document.getElementById('staffShiftLabel').innerText = (currentUser.allowed_shift || 'ไม่ระบุกะ');
        }
    } else {
        adminElements.forEach(el => { el.style.display = ''; el.classList.remove('hidden', 'no-perm-hidden'); });
        const indicator = document.getElementById('staffShiftIndicator');
        if(indicator) indicator.classList.add('hidden');
    }
}

window.switchDutyTab = function(tabName) {
    document.getElementById('dutyTabRoster')?.classList.add('hidden');
    document.getElementById('dutyTabRoster')?.classList.remove('flex');
    document.getElementById('dutyTabSettings')?.classList.add('hidden');
    document.getElementById('dutyTabSettings')?.classList.remove('flex');
    
    const resetClass = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
    const activeClass = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
    
    const btnRoster = document.getElementById('tabBtnRoster');
    const btnSettings = document.getElementById('tabBtnSettings');
    
    if (btnRoster) btnRoster.className = resetClass;
    if (btnSettings) btnSettings.className = resetClass;
    
    if (tabName === 'roster') {
        document.getElementById('dutyTabRoster').classList.remove('hidden');
        document.getElementById('dutyTabRoster').classList.add('flex');
        if (btnRoster) btnRoster.className = activeClass;
        window.renderDutyRequirements();
        if(window.isDutyAdmin()) window.updateDutyStats();
    } else {
        document.getElementById('dutyTabSettings').classList.remove('hidden');
        document.getElementById('dutyTabSettings').classList.add('flex');
        if (btnSettings) btnSettings.className = activeClass;
    }
}

window.switchDutyDept = function(dept) {
    currentDutyDept = dept;
    
    document.getElementById('btnDutyAM')?.classList.remove('active'); 
    document.getElementById('btnDutyOD')?.classList.remove('active');
    document.getElementById('btnDutyAMQL')?.classList.remove('active'); 
    document.getElementById('btnDutyODQL')?.classList.remove('active');
    document.getElementById('btnDutyTRAINER_AM')?.classList.remove('active'); 
    document.getElementById('btnDutyTRAINER_OD')?.classList.remove('active');
    
    document.getElementById(`btnDuty${dept}`)?.classList.add('active');
    let labelText = dept;
    if (dept === 'AMQL') labelText = 'ผู้สอน AM';
    else if (dept === 'ODQL') labelText = 'ผู้สอน OD';
    else if (dept.startsWith('TRAINER')) {
        labelText = dept.replace('TRAINER_', 'ผู้สอน '); 
    }
    const labelEl = document.getElementById('dutyDeptLabel'); 
    if(labelEl) labelEl.innerText = labelText;
    
    const filterTrainer = document.getElementById('trainerDeptFilterContainer');
    
    // โชว์ตัวกรองแผนกผู้สอนตามปกติ
    if (window.isTrainerDept(dept)) {
        if (filterTrainer) filterTrainer.classList.remove('hidden');
    } else {
        if (filterTrainer) filterTrainer.classList.add('hidden');
    }
    
    // บังคับซ่อนช่องเลือกหมวดตลอดเวลา
    const taskModeContainer = document.getElementById('trainerTaskModeContainer');
    if (taskModeContainer) { taskModeContainer.classList.add('hidden'); taskModeContainer.classList.remove('flex'); }
    
    const grid = document.getElementById('dutyResultGrid');
    if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl text-indigo-500 mb-2">sync</span><span class="font-bold text-sm">กำลังจัดเตรียมตาราง...</span></div>`;
    
    setTimeout(() => {
        window.syncTeamOrder(); window.applyDutyRoleUI(); window.renderDutyAccessTable(); window.renderDutyRequirements(); window.refreshDutyData(); 
    }, 50);
};

// ลบการแนบค่า Telegram ลงท้ายชื่อไฟล์เซฟตาราง
function getDutySaveKey(date, shift) {
    return `duty_roster_${currentDutyDept}_${date}_${shift}`;
}

window.currentDutyLeaveData = []; 

window.refreshDutyData = async function() {
    try {
        window.ensureImportantTasksContainer(); // 🌟 NEW: สร้างโครงสร้างกล่องงานพิเศษ

        const targetDateInput = document.getElementById('dutyDate');
        const shiftFilterInput = document.getElementById('dutyShiftSelect');
        
        if (!targetDateInput || !shiftFilterInput) return; 
        
        const targetDate = targetDateInput.value;
        const shiftFilter = shiftFilterInput.value;
        if(!targetDate) return;

        // 🚀 คำนวณคีย์ทั้งหมดก่อน เพื่อยิง 3 query ขนานกันได้ในรอบเดียว
        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const impListKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;
        const stayPinKey = `duty_stay_pins_${currentDutyDept}`;   // 📌 คนที่ถูกล็อกให้อยู่เว็บเดิมข้ามวัน
        const supportKey = `duty_support_${currentDutyDept}_${targetDate}_${shiftFilter}`;  // 🤝 ตารางซัพพอร์ตข้ามเว็บ
        const mergeKey = `duty_merge_rooms_${targetDate}_${shiftFilter}`;   // 🏠 ผลรวมห้อง Discord (ย้ายจาก localStorage มาเก็บ DB)
        const backupKey = `backup_${saveKey}`;                               // 💾 สำเนาตารางก่อนล้าง (ย้ายจาก localStorage มาเก็บ DB)

        // 🚀 ดึง 3 ชุดข้อมูลขนานกัน (leaves + schedules + settings) ลด latency 3 เท่า
        // [FIX] ดึง scheduled_tasks ของวันนั้นมาด้วย เพื่อแยกทิศทางของ XX
        // XX ใน leave_requests มี 2 ความหมาย แยกจากตัวมันเองไม่ได้:
        //   เช้า→ดึก : task ตรงวัน XX + target_shift = กะดึก  → วันนั้น "เข้าดึก 20:00" = ทำงาน ต้องจัดหน้าที่
        //   ดึก→เช้า : task ช้ากว่า XX 1 วัน + target_shift = กะเช้า → วันนั้นหยุดจริง ไม่ต้องจัด
        // ต้องระบุ +07:00 ให้ชัด — scheduled_for เก็บเป็น timestamptz (UTC)
        // task ของวันที่ 1 ส.ค. 05:00 ไทย ถูกเก็บเป็น 2026-07-31T22:00Z
        // ถ้าไม่ใส่โซน จะถูกตีความเป็น UTC แล้ว task หลุดออกจากช่วงทันที
        const taskDayStart = `${targetDate}T00:00:00+07:00`;
        const taskDayEnd = `${targetDate}T23:59:59+07:00`;
        const [leavesRes, schedulesRes, settingsRes, swapRes] = await Promise.all([
            appDB.from('leave_requests').select('user_id, reason, user_name').eq('leave_date', targetDate),
            appDB.from('schedules').select('staff_name, time_slot').eq('work_date', targetDate).eq('shift_name', shiftFilter),
            appDB.from('settings').select('value, key').in('key', [saveKey, impListKey, impAssignKey, impLockKey, stayPinKey, supportKey, mergeKey, backupKey]),
            appDB.from('scheduled_tasks').select('payload, scheduled_for, status')
                .eq('task_type', 'individual_shift_update')
                .gte('scheduled_for', taskDayStart).lte('scheduled_for', taskDayEnd)
        ]);

        // ── หาคนที่ "วันนี้เปลี่ยนไปเข้ากะดึก" (เช้า→ดึก) ──
        window.currentDutyShiftToday = {};   // user_id -> กะที่ต้องทำงานจริงวันนั้น
        const swapToNightIds = new Set();
        (swapRes && swapRes.data ? swapRes.data : []).forEach(t => {
            let pl = t.payload;
            if (typeof pl === 'string') { try { pl = JSON.parse(pl); } catch(e) { pl = {}; } }
            if (!pl || !pl.user_id) return;
            const uid = String(pl.user_id);
            if (pl.target_shift && pl.target_shift !== 'คงเดิม') {
                window.currentDutyShiftToday[uid] = pl.target_shift;
                if (pl.target_shift === 'กะดึก') swapToNightIds.add(uid);
            }
        });

        // ประมวลผล leaves
        const leaves = leavesRes && leavesRes.data;
        currentDutyLeaves = new Set();
        if (leaves) leaves.forEach(l => {
            const uid = String(l.user_id);
            // XX ของคนที่วันนี้ย้ายไปเข้าดึก = วันทำงาน ไม่ใช่วันหยุด
            if (l.reason === 'XX' && swapToNightIds.has(uid)) return;
            currentDutyLeaves.add(uid);
        });

        // ประมวลผล schedules
        window.currentDutySchedules = (schedulesRes && schedulesRes.data) ? schedulesRes.data : [];

        const relevantLeaves = [];
        if (leaves && typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
            leaves.forEach(l => {
                // ข้ามคนที่ XX แล้ววันนี้ย้ายไปเข้าดึก — เขาทำงาน ไม่ควรอยู่ในกล่องลาหยุด
                if (l.reason === 'XX' && swapToNightIds.has(String(l.user_id))) return;
                let userObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(l.user_id) || u.username === l.user_name);
                if (userObj) {
                    let uDept = userObj.department || 'AM';
                    if (uDept === 'TRAINER') uDept = 'AMQL';
                    if (uDept === currentDutyDept) {
                        relevantLeaves.push({ user_id: userObj.id, username: userObj.username, reason: l.reason, originalShift: userObj.allowed_shift || 'all' });
                    }
                }
            });
        }
        window.currentDutyLeaveData = relevantLeaves;
        window.renderDutyLeaveBox();

        let savedRoster = null;
        window.globalImportantTasks = [];
        window.currentImportantAssigns = {};
        window.lockedImportantTasks = {};
        window.dutyStayPins = {};
        window.currentSupportData = {};
        window.savedMergeRooms = [];

        try {
            const data = settingsRes && settingsRes.data;

            // 🏠 ผลรวมห้อง Discord — เดิมเก็บ localStorage (เห็นแค่เครื่องเดียว) ย้ายมา DB
            // ถ้า DB ยังไม่มีแต่เครื่องนี้เคยบันทึกไว้ใน localStorage ให้ย้ายขึ้น DB ให้อัตโนมัติครั้งเดียว
            const mergeRow = data ? data.find(d => d.key === mergeKey) : null;
            if (mergeRow && mergeRow.value) {
                try { const m = JSON.parse(mergeRow.value); window.savedMergeRooms = Array.isArray(m) ? m : []; } catch (e) {}
            } else {
                const legacy = window.safeGetItem(mergeKey, null);
                if (legacy) {
                    try {
                        const m = JSON.parse(legacy);
                        if (Array.isArray(m) && m.length > 0) {
                            window.savedMergeRooms = m;
                            window.clearSettingCache();
                            appDB.from('settings').upsert([{ key: mergeKey, value: legacy }]).then(() => { try { localStorage.removeItem(mergeKey); } catch (e) {} }, () => {});
                        }
                    } catch (e) {}
                }
            }

            if (data && data.length > 0) {
                const rosterRow = data.find(d => d.key === saveKey);
                if (rosterRow && rosterRow.value) savedRoster = rosterRow;

                const listRow = data.find(d => d.key === impListKey);
                if (listRow && listRow.value) window.globalImportantTasks = JSON.parse(listRow.value);

                const assignRow = data.find(d => d.key === impAssignKey);
                if (assignRow && assignRow.value) window.currentImportantAssigns = JSON.parse(assignRow.value);

                const lockRow = data.find(d => d.key === impLockKey);
                if (lockRow && lockRow.value) {
                    let parsedLock = JSON.parse(lockRow.value);
                    // 🌟 แก้บั๊ก: ป้องกันโครงสร้างข้อมูลเก่าตีกัน (ถ้าของเก่าเป็น Array ให้ล้างทิ้งเป็น Object)
                    if (Array.isArray(parsedLock)) {
                        window.lockedImportantTasks = {};
                    } else {
                        window.lockedImportantTasks = parsedLock || {};
                    }
                }

                // 📌 คนที่ถูกล็อกให้อยู่เว็บเดิมข้ามวัน — ตัดตัวที่หมดอายุทิ้งตั้งแต่ตอนโหลด
                const stayPinRow = data.find(d => d.key === stayPinKey);
                if (stayPinRow && stayPinRow.value) {
                    try {
                        const parsedPins = JSON.parse(stayPinRow.value);
                        window.dutyStayPins = (parsedPins && !Array.isArray(parsedPins)) ? parsedPins : {};
                        window.prunePins(window.dutyStayPins);
                    } catch (e) { window.dutyStayPins = {}; }
                }

                // 🤝 ตารางซัพพอร์ตข้ามเว็บของวัน+กะนี้
                const supportRow = data.find(d => d.key === supportKey);
                if (supportRow && supportRow.value) {
                    try {
                        const parsed = JSON.parse(supportRow.value);
                        // ผ่าน normalize เสมอ เพื่อรองรับข้อมูลรูปแบบเก่าที่ key ด้วยเว็บเป้าหมาย
                        window.currentSupportData = (parsed && !Array.isArray(parsed))
                            ? window.normalizeSupportData(parsed) : {};
                    } catch (e) { window.currentSupportData = {}; }
                }
            }
            
            // 🌟 ดึงคนที่ถูกล็อค มายัดใส่ในตารางอัตโนมัติ (เฉพาะวันนี้และอนาคต ป้องกันประวัติอดีตหาย)
            let needSave = false;
            
            // สร้างวันที่ปัจจุบัน (อิงตามเวลาท้องถิ่น)
            const t = new Date();
            const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            
            // ถ้าย้อนไปดูอดีต จะไม่เอาระบบล็อคปัจจุบันไปทับเด็ดขาด (ทำงานเฉพาะเป้าหมาย >= วันนี้)
            if (targetDate >= todayStr) {
                for (const [lTask, lUser] of Object.entries(window.lockedImportantTasks)) {
                    if (window.globalImportantTasks.includes(lTask)) {
                        if (window.currentImportantAssigns[lTask] !== lUser) {
                            window.currentImportantAssigns[lTask] = lUser;
                            needSave = true; 
                        }
                    }
                }
            }
            
            // ถ้ายัดชื่อเข้าตารางใหม่ ให้บันทึกเพื่อจองตัวในวันนั้นๆ ไปเลย
            if (needSave && targetDate) {
                appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);
            }
            
        } catch(e) { console.log(e); }
        
        window.renderImportantTasksPanel();
        // ----------------------------------------------------

        const btnGen = document.getElementById('btnGenerateRoster');
        const grid = document.getElementById('dutyResultGrid');
        const matrixGrid = document.getElementById('dutyMatrixGrid');

        if (savedRoster && savedRoster.value) {
            const parsedRoster = JSON.parse(savedRoster.value);
            window.isRosterPreview = false;
            window.renderRosterGrid(parsedRoster);
            if (btnGen) {
                btnGen.disabled = true; btnGen.innerHTML = '<span class="material-icons text-base">lock</span> จัดแล้ว (ต้องล้างก่อน)';
                btnGen.classList.replace('bg-indigo-600', 'bg-gray-500'); btnGen.classList.replace('hover:bg-indigo-700', 'hover:bg-gray-600');
            }
        } else {
            // 📌 ยังไม่ได้จัดเวรวันนี้ แต่ถ้ามีคนถูกล็อก "อยู่ต่อ" ให้โชว์ชื่อเขาไว้ก่อนเลย
            // จะได้เห็นทันทีที่เลื่อนวันที่ ไม่ต้องรอกดสุ่ม
            // ตั้งใจ "ไม่บันทึก" ลง DB เพราะถ้าบันทึกปุ๊บ ปุ่มสุ่มจะถูกล็อกเป็น "จัดแล้ว"
            // แล้วจะจัดคนที่เหลือไม่ได้เลย — อันนี้เป็นแค่ภาพตัวอย่าง
            //
            // ⚠️ เฉพาะฝ่ายจัดเวรเท่านั้น — ต่อให้ซ่อนป้าย 📌 บนการ์ดไปแล้ว
            // ภาพตัวอย่างเองก็ยังฟ้อง เพราะพนักงานจะเห็นชื่อตัวเองโผล่อยู่ในเว็บ
            // ของวันข้างหน้าที่ยังไม่ได้จัด ซึ่งเป็นไปได้ทางเดียวคือถูกล็อกไว้
            const preview = window.canManageStayPin()
                ? window.buildStayPinPreview(targetDate, shiftFilter)
                : { roster: {}, count: 0 };

            if (preview.count > 0) {
                window.isRosterPreview = true;
                window.renderRosterGrid(preview.roster);
            } else {
                window.isRosterPreview = false;
                if(grid) grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-50"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
                if(matrixGrid) matrixGrid.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50 h-full"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
            }

            if (btnGen) {
                btnGen.disabled = false; btnGen.innerHTML = '<span class="material-icons text-base">casino</span> สุ่มจัดหน้าที่';
                btnGen.classList.replace('bg-gray-500', 'bg-indigo-600'); btnGen.classList.replace('hover:bg-gray-600', 'hover:bg-indigo-700');
            }
        }

        // 🤝 วาดแผงซัพพอร์ตซ้ำ "หลัง" ตารางถูกโหลดเข้า currentRosterData แล้ว
        // renderImportantTasksPanel ด้านบนถูกเรียกก่อน renderRosterGrid
        // แผงจึงนับจำนวนคนจากข้อมูลเก่า ทำให้ทุกเว็บขึ้นว่า "ว่าง"
        if (currentDutyDept === 'AM' && typeof window.renderHelpCalcPanel === 'function') {
            window.renderHelpCalcPanel();
        }

        // 💾 [FIX] backup อ่านจาก DB ก่อน (กู้ได้จากทุกเครื่อง) ถ้าไม่มีค่อยดู localStorage ของเครื่องนี้
        const backupRow = (settingsRes && settingsRes.data) ? settingsRes.data.find(d => d.key === backupKey) : null;
        const backupData = (backupRow && backupRow.value) || window.safeGetItem(backupKey, null);
        const btnRestore = document.getElementById('btnRestoreRoster');
        if (btnRestore) {
            if (backupData && (!savedRoster || !savedRoster.value)) btnRestore.classList.remove('hidden');
            else btnRestore.classList.add('hidden');
        }

        if (window.isDutyAdmin()) window.updateDutyStats();
        window.updateStayPinButton();
    } catch (err) { console.error("Refresh Duty Data Error:", err); }
};

window.renderDutyLeaveBox = function() {
    const leaveContainer = document.getElementById('dutyLeaveList');
    const leaveBadge = document.getElementById('leaveCountBadge');
    if (!leaveContainer) return;

    const shiftFilterEl = document.getElementById('dutyLeaveShiftFilter');
    const typeFilterEl = document.getElementById('dutyLeaveTypeFilter');
    const shiftFilter = shiftFilterEl ? shiftFilterEl.value : 'all';
    const typeFilter = typeFilterEl ? typeFilterEl.value : 'all';

    let filteredLeaves = [...window.currentDutyLeaveData];

    if (shiftFilter !== 'all') {
        if (shiftFilter === 'all_shift') filteredLeaves = filteredLeaves.filter(l => l.originalShift === 'all');
        else filteredLeaves = filteredLeaves.filter(l => l.originalShift === shiftFilter);
    }

    if (typeFilter !== 'all') {
        filteredLeaves = filteredLeaves.filter(l => {
            const rsn = l.reason || 'X';
            if (typeFilter === 'X') return rsn === 'X' || rsn === 'Table-Booking';
            if (typeFilter === 'TL') return rsn === 'TL' || rsn === 'TX';
            return rsn === typeFilter;
        });
    }

    leaveBadge.innerText = filteredLeaves.length;
    let leaveHtml = '';

    if (filteredLeaves.length > 0) {
        filteredLeaves.sort((a, b) => a.username.localeCompare(b.username));
        filteredLeaves.forEach(l => {
            const rsn = l.reason || 'X';
            const style = LEAVE_STYLES[rsn] || { text: rsn, color: 'text-gray-600 bg-gray-100 border-gray-300 dark:bg-slate-700 dark:text-gray-300', border: 'border-gray-200 dark:border-slate-600' };
            let displayRsn = style.text;
            let badgeColor = style.color;
            let boxBorder = style.border;

            const shiftTag = l.originalShift && l.originalShift !== '?' ? `<span class="text-[8px] text-gray-400 ml-1">(${l.originalShift.replace('กะ','')})</span>` : '';

            leaveHtml += `
                <div onclick="restoreFromLeave('${l.user_id}', '${l.username}')" title="คลิกเพื่อดึงกลับมาทำงาน" class="bg-white dark:bg-slate-700 p-1.5 rounded-lg border ${boxBorder} shadow-sm flex justify-between items-center mb-1.5 transition-all hover:bg-blue-50 dark:hover:bg-slate-600 group cursor-pointer hover:border-blue-500">
                    <span class="text-[11px] font-bold text-slate-700 dark:text-gray-200 truncate pr-2 flex items-center">
                        <span class="material-icons text-[14px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mr-1">settings_backup_restore</span>
                        ${l.username} ${shiftTag}
                    </span>
                    <span class="text-[9px] font-black ${badgeColor} px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap group-hover:scale-105 transition-transform">${displayRsn}</span>
                </div>
            `;
        });
        leaveContainer.innerHTML = leaveHtml; 
    } else { 
        leaveContainer.innerHTML = `<div class="text-center text-[10px] text-gray-400 mt-4">ไม่มีข้อมูลตามตัวกรอง</div>`; 
    }
};

window.restoreFromLeave = async function(userId, username) {
    const canRestore = window.isDutyAdmin();
    
    if (!canRestore) {
        return Swal.fire({
            icon: 'error',
            title: 'ไม่มีสิทธิ์ทำรายการ',
            text: 'เฉพาะ Admin, Manager และ Trainer เท่านั้น ที่สามารถดึงพนักงานกลับมาทำงานได้ครับ!',
            confirmButtonColor: '#d33',
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
        });
    }
    
    let optionsHtml = '<option value="" disabled selected>-- เลือกเว็บที่จะให้ไปทำ --</option>';
    sortedTeams.forEach(t => { optionsHtml += `<option value="${t}">${t}</option>`; });

    const { value: selectedTeam } = await Swal.fire({
        title: `<div class="text-xl font-black text-blue-500 mt-2">ดึงพนักงานกลับมาทำงาน</div>`,
        html: `
            <div class="mb-4 text-sm text-gray-500 dark:text-gray-400">ดึง <b class="text-slate-800 dark:text-white text-lg">${username}</b> ออกจากช่องลาหยุด<br>ต้องการให้ไปลงหน้าที่เว็บไหนครับ?</div>
            <select id="swal-restore-team" class="w-full p-3.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner cursor-pointer text-sm transition">
                ${optionsHtml}
            </select>
        `,
        showCancelButton: true, confirmButtonColor: '#3b82f6', cancelButtonColor: '#64748b', confirmButtonText: 'ยืนยัน (ดึงกลับ)', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const select = document.getElementById('swal-restore-team');
            if (!select.value) { Swal.showValidationMessage('กรุณาเลือกเว็บด้วยครับ!'); return false; }
            return select.value;
        }
    });

    if (selectedTeam) {
        Swal.fire({title: 'กำลังย้ายข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            const targetDate = document.getElementById('dutyDate').value;
            const shiftFilter = document.getElementById('dutyShiftSelect').value;

            await appDB.from('leave_requests').delete().eq('user_id', userId).eq('leave_date', targetDate);

            const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(userId));
            if (fullUserObj) {
                if(!currentRosterData[selectedTeam]) currentRosterData[selectedTeam] = [];
                const isExist = currentRosterData[selectedTeam].some(u => String(u.id) === String(userId));
                if (!isExist) currentRosterData[selectedTeam].push({
                    ...fullUserObj,
                    assigned_by: currentUser.username,
                    assigned_at: new Date().toISOString()
                });
                
                const saveKey = getDutySaveKey(targetDate, shiftFilter);
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            }

            await appDB.from('system_logs').insert([{ action_type: 'ย้ายหน้าที่', performed_by: currentUser.username, target_details: `ดึง ${username} กลับจากการลา ไปใส่เว็บ [${selectedTeam}] วันที่: ${targetDate}` }]);
            window.debouncedBroadcast('duty-updates', 'force_reload');
            await window.refreshDutyData();

            Swal.fire({icon: 'success', title: 'ดึงกลับสำเร็จ!', text: `${username} ไปอยู่เว็บ ${selectedTeam} แล้ว`, timer: 1500, showConfirmButton: false});
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
    }
};

window.addStaffToRoster = async function() {
    if (window.blockIfPreview()) return;   // โหมดตัวอย่าง: ห้ามเขียนตารางลง DB
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
        return Swal.fire('!', 'ยังโหลดรายชื่อพนักงานไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่', 'warning');
    }

    // 1. หาคนที่อยู่ใน roster อยู่แล้ว (ไม่ต้องโชว์ในรายการให้เลือก)
    const alreadyAssignedIds = new Set();
    for (const team in currentRosterData) {
        (currentRosterData[team] || []).forEach(u => {
            if (u && u.id) alreadyAssignedIds.add(String(u.id));
        });
    }

    // 2. คัดกรองพนักงานที่:
    //    - แผนกตรงกับ currentDutyDept (สำหรับ AMQL/ODQL ผ่อนเงื่อนไข)
    //    - กะตรงกับ shiftFilter (หรือ allowed_shift = 'all')
    //    - ไม่ลาหยุด
    //    - ไม่อยู่ใน roster อยู่แล้ว
    //    - ไม่ใช่ admin/manager/trainer
    const candidates = GLOBAL_USER_LIST.filter(u => {
        if (!u || !u.username) return false;
        if (alreadyAssignedIds.has(String(u.id))) return false;
        if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;

        const role = (u.role || 'staff').toLowerCase();
        if (['admin', 'manager'].includes(role)) return false;

        // เช็คแผนก
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';
        if (uDept !== currentDutyDept) return false;

        // เช็คกะ (ใช้กะจริงของวันนั้น เผื่อคนที่สลับเช้า→ดึกวันนี้)
        if (!window.isDutyShiftMatch(u, shiftFilter)) return false;

        return true;
    }).sort((a, b) => a.username.localeCompare(b.username, 'th'));

    if (candidates.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'ไม่มีพนักงานให้เพิ่ม',
            html: `ไม่พบพนักงานที่:<br>• แผนก <b>${currentDutyDept}</b><br>• กะ <b>${shiftFilter}</b><br>• ยังไม่อยู่ในตาราง / ไม่ลาหยุด`,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
        });
    }

    // 3. เตรียม dropdown เว็บ — ใช้ลำดับเดียวกับหน้าจอ
    // [FIX] เดิมประกาศ const sortedTeams ทับตัว global แล้วเรียง A-Z ทำให้ลำดับไม่ตรงกับการ์ด
    const teamChoices = (sortedTeams && sortedTeams.length)
        ? [...sortedTeams]
        : (typeof TEAM_LIST !== 'undefined' ? [...TEAM_LIST] : Object.keys(currentRosterData));
    if (teamChoices.length === 0) {
        return Swal.fire('!', 'ไม่มีรายชื่อเว็บ/ทีมในระบบ', 'warning');
    }

    let userOptionsHtml = '<option value="" disabled selected>-- เลือกพนักงาน --</option>';
    candidates.forEach(u => {
        const shiftTag = (u.allowed_shift && u.allowed_shift !== 'all') ? ` [${u.allowed_shift.replace('กะ','')}]` : ' [อิสระ]';
        userOptionsHtml += `<option value="${u.id}">${u.username}${shiftTag}</option>`;
    });

    let teamOptionsHtml = '<option value="" disabled selected>-- เลือกเว็บที่จะใส่ --</option>';
    teamChoices.forEach(t => {
        const cnt = (currentRosterData[t] || []).length;
        teamOptionsHtml += `<option value="${t}">${t} (${cnt} คน)</option>`;
    });

    // 4. เปิด Modal ให้เลือก
    const result = await Swal.fire({
        title: `<div class="text-xl font-black text-emerald-500 mt-2">เพิ่มพนักงานเข้าตาราง</div>`,
        html: `
            <div class="text-left text-xs text-gray-500 dark:text-gray-400 mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                <span class="material-icons text-[14px] align-middle text-emerald-500">info</span>
                <span class="align-middle">วันที่: <b class="text-slate-800 dark:text-white">${targetDate}</b> | กะ: <b class="text-slate-800 dark:text-white">${shiftFilter}</b> | แผนก: <b class="text-slate-800 dark:text-white">${currentDutyDept}</b></span>
            </div>
            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">พนักงาน (ที่ยังไม่อยู่ในตาราง):</label></div>
            <select id="swal-add-user" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm mb-3">
                ${userOptionsHtml}
            </select>
            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">ใส่เข้าเว็บ:</label></div>
            <select id="swal-add-team" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm">
                ${teamOptionsHtml}
            </select>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'เพิ่มเข้าตาราง',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const userId = document.getElementById('swal-add-user').value;
            const team = document.getElementById('swal-add-team').value;
            if (!userId) { Swal.showValidationMessage('กรุณาเลือกพนักงาน'); return false; }
            if (!team) { Swal.showValidationMessage('กรุณาเลือกเว็บปลายทาง'); return false; }
            return { userId, team };
        }
    });

    if (!result.isConfirmed || !result.value) return;
    const { userId, team } = result.value;

    // 5. ทำการ save
    Swal.fire({title: 'กำลังเพิ่ม...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(userId));
        if (!fullUserObj) throw new Error('ไม่พบข้อมูลพนักงาน');

        if (!currentRosterData[team]) currentRosterData[team] = [];
        const isExist = currentRosterData[team].some(u => String(u.id) === String(userId));
        if (isExist) {
            return Swal.fire('ซ้ำ!', `${fullUserObj.username} อยู่ในเว็บ ${team} อยู่แล้ว`, 'info');
        }
        currentRosterData[team].push({
            ...fullUserObj,
            assigned_by: currentUser.username,
            assigned_at: new Date().toISOString()
        });

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        window.clearSettingCache(); const { error: _upsertErr } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
        if (_upsertErr) throw _upsertErr;

        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `เพิ่ม ${fullUserObj.username} เข้าเว็บ [${team}] (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
        }]);

        try { window.debouncedBroadcast('duty-updates', 'force_reload'); } catch(e) {}
        await window.refreshDutyData();

        Swal.fire({
            icon: 'success',
            title: 'เพิ่มสำเร็จ!',
            text: `${fullUserObj.username} ถูกใส่เข้าเว็บ ${team} แล้ว`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('addStaffToRoster error:', err);
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
};

window.clearDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    Swal.fire({
        title: 'ยืนยันการล้างตาราง?', text: `คุณต้องการลบตารางงานวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่? (หน้าที่ประจำที่ล็อคไว้จะไม่หาย)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ล้างเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังล้างข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const saveKey = getDutySaveKey(targetDate, shiftFilter);
            const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`; 
            const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`; 
            
            try {
                let currentDataVal = null;
                const { data: currentData } = await appDB.from('settings').select('value').eq('key', saveKey);
                if (currentData && currentData.length > 0) currentDataVal = currentData[0].value;
                
                if (currentDataVal) {
                    // 💾 [FIX] เก็บสำเนาลง DB ด้วย (เดิม localStorage อย่างเดียว กู้ได้แค่เครื่องที่กดล้าง)
                    window.safeSetItem(`backup_${saveKey}`, currentDataVal);
                    await appDB.from('settings').upsert([{ key: `backup_${saveKey}`, value: currentDataVal }]);
                }
                
                await appDB.from('settings').delete().eq('key', saveKey);
                
                // 🌟 เก็บคนที่โดนล็อคไว้ ไม่ลบทิ้ง
                const keysKept = Object.keys(window.lockedImportantTasks);
                keysKept.forEach(k => {
                    if (!window.globalImportantTasks.includes(k)) delete window.currentImportantAssigns[k];
                });
                
                let newAssigns = {};
                for (const [k, v] of Object.entries(window.lockedImportantTasks)) {
                    if (window.globalImportantTasks.includes(k)) newAssigns[k] = v;
                }
                
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(newAssigns) }]);
                if (window.isTrainerDept()) await appDB.from('settings').delete().eq('key', reportKey);
                
                await appDB.from('system_logs').insert([{ action_type: 'ล้างตารางงาน', performed_by: currentUser.username, target_details: `ล้างตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})` }]);
                window.debouncedBroadcast('duty-updates', 'force_reload');
                
                Swal.fire({ icon: 'success', title: 'ล้างตารางเรียบร้อย', showConfirmButton: false, timer: 1500 });
                if(typeof window.refreshDutyData === 'function') window.refreshDutyData(); 
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.generateDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKeyCheck = getDutySaveKey(targetDate, shiftFilter);
    
    let checkExistVal = null;
    try {
        const { data: checkExist } = await appDB.from('settings').select('value').eq('key', saveKeyCheck);
        if (checkExist && checkExist.length > 0) checkExistVal = checkExist[0].value;
    } catch(e) {}
    
    if (checkExistVal) {
         window.refreshDutyData(); 
         return Swal.fire('ป้องกันการจัดซ้ำ!', 'กะนี้มีการจัดหน้าที่ไปแล้ว กรุณากดปุ่ม "ล้างตาราง" ก่อนสุ่มใหม่ครับ', 'warning');
    }

    const activeStaff = window.getDutyActiveStaff(shiftFilter);
    
    let requiredCount = 0; document.querySelectorAll('.req-input').forEach(i => requiredCount += (parseInt(i.value) || 0));

    if(activeStaff.length === 0) return Swal.fire('ข้อมูลไม่พอ', `ไม่มีพนักงานมาทำงานในกะนี้เลย (ลองเช็คสิทธิ์หรือรายชื่ออีกครั้ง)`, 'error');

    // 🔧 [FIX] ถ้ายังไม่ได้ระบุจำนวนคนต่อเว็บ (ทุกช่องเป็น 0) ระบบเดิมจะวนลูปไม่จัดใครเลย
    // แล้วไปฟ้องว่า "ไม่ได้ติ๊กสิทธิ์" ทั้งที่สิทธิ์ครบ → ให้คำนวณยอดออโต้ให้ก่อน แล้วค่อยจัด
    if (requiredCount === 0) {
        const ask = await Swal.fire({
            icon: 'question',
            title: 'ยังไม่ได้ระบุจำนวนคนต่อเว็บ',
            html: `ช่องจำนวนคนทุกเว็บเป็น <b>0</b> อยู่ ระบบจึงจัดใครลงเว็บไม่ได้<br><br>ให้ระบบ <b>คำนวณยอดคนออโต้</b> (${activeStaff.length} คน) แล้วจัดหน้าที่ต่อเลยไหมครับ?`,
            showCancelButton: true,
            confirmButtonText: '⚡ คำนวณออโต้แล้วจัดเลย',
            cancelButtonText: 'ยกเลิก ไปกรอกเอง'
        });
        if (!ask.isConfirmed) return;
        window.autoSuggestRequirements();
        requiredCount = 0; document.querySelectorAll('.req-input').forEach(i => requiredCount += (parseInt(i.value) || 0));
        if (requiredCount === 0) return; // autoSuggest ฟ้อง error ไปแล้ว (เช่น ไม่มีใครมีสิทธิ์เลย)
    }
    if(requiredCount > activeStaff.length) return Swal.fire('ขาดคน!', `คุณจัดงาน ${requiredCount} คน แต่มีคนว่างแค่ ${activeStaff.length} คน (กรุณาลดจำนวน)`, 'error');

    Swal.fire({title: 'กำลังจัดตารางหลัก...', text: 'ระบบกำลังจัดหน้าที่หลัก โดยจะยังไม่แจกงานรอง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        // 🔄 อ่านประวัติย้อนหลังหลายวัน (แทนของเดิมที่ดูแค่เมื่อวานวันเดียว)
        // เพื่อให้รู้ว่าใครยังไม่เคยไปเว็บไหน จะได้หมุนให้ครบทุกเว็บ
        const rotation = await window.loadDutyRotationHistory(targetDate, shiftFilter);

        // เว็บของ "วันล่าสุดที่มีตาราง" — ใช้แทน yestTeamMap เดิม
        // ถ้าเว้นวันไป (ไม่ได้จัดเวร/หยุดยาว) ตัวนี้ยังหาเจอ ต่างจากของเดิมที่มองแค่ -1 วัน
        const yestTeamMap = {};
        Object.entries(rotation.lastTeam).forEach(([uid, v]) => { yestTeamMap[uid] = v.team; });

        const requirements = {}; const reqsToSave = {};
        document.querySelectorAll('.req-input').forEach(input => {
            const team = input.id.replace('req_', ''); const count = parseInt(input.value) || 0;
            requirements[team] = count; reqsToSave[input.id] = count;
        });
        window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));

        let unassignedPool = [...activeStaff];
        const rosterResult = {};
        sortedTeams.forEach(t => rosterResult[t] = []);
        let remainingReqs = { ...requirements };

        // 📌 ขั้นที่ 0: วางคนที่ถูกล็อก "อยู่ต่อ" ลงเว็บเดิมก่อนสุ่ม
        // ต้องมาก่อนลูปสุ่ม เพราะเป็นคำสั่งตรงจากแอดมิน — ถ้าปล่อยให้ลูปจัด
        // กฎ "ห้ามทำเว็บเดิมซ้ำกับเมื่อวาน" (yestTeamMap) จะเขี่ยเขาออกจากเว็บนั้นทันที
        // ดึง pin สดจาก DB อีกรอบ เผื่อแอดมินอีกคนเพิ่ง/เพิ่งยกเลิกการล็อกไประหว่างที่หน้านี้เปิดค้างอยู่
        await window.loadStayPins();

        const pinnedPlaced = [];
        const pinnedIds = new Set();       // ใช้กันไม่ให้รอบซ่อมสลับคนที่ถูกล็อกออกจากเว็บ
        const pinnedSkipped = [];
        const pinnedOverQuota = [];
        Object.keys(window.dutyStayPins || {}).forEach(uid => {
            // getActiveStayPin คุมกติกาช่วงวัน+กะไว้ที่เดียว จะได้ไม่หลุดกันคนละที่
            const pin = window.getActiveStayPin(uid, targetDate);
            if (!pin || !pin.team) return;
            if (!sortedTeams.includes(pin.team)) return;   // เว็บถูกลบไปแล้ว

            const u = unassignedPool.find(x => String(x.id) === String(uid));
            if (!u) {
                // ติดลาหยุด / สลับกะ / ย้ายแผนก → ข้ามเฉพาะวันนี้ ตัว pin ยังอยู่ใช้วันถัดไปได้
                // เก็บเว็บไว้ด้วย จะได้บอกแอดมินทีหลังว่าใครถูกดึงมาแทนที่เว็บนั้น
                pinnedSkipped.push({ username: pin.username, team: pin.team });
                return;
            }

            if ((remainingReqs[pin.team] || 0) <= 0) pinnedOverQuota.push(`${pin.username} (${pin.team})`);

            rosterResult[pin.team].push({
                ...u,
                secondary_team: null,
                assigned_by: currentUser.username,
                assigned_at: new Date().toISOString(),
                stay_pinned: true
            });
            remainingReqs[pin.team] = Math.max(0, (remainingReqs[pin.team] || 0) - 1);
            unassignedPool = unassignedPool.filter(x => String(x.id) !== String(uid));
            pinnedPlaced.push(`${pin.username} → ${pin.team}`);
            pinnedIds.add(String(uid));
        });

        const rotationStats = { fresh: 0, rotated: 0, repeated: 0, repeatedNames: [] };

        while (true) {
            let teamsNeedingPeople = sortedTeams.filter(t => remainingReqs[t] > 0);
            if (teamsNeedingPeople.length === 0) break; 

            let teamStats = teamsNeedingPeople.map(team => {
                const withAccess = unassignedPool.filter(u => (dutyAccessMatrix[String(u.id)] || []).includes(team));

                // 🔄 ชั้นที่ 1 (เข้มสุด): ต้องวนเว็บอื่นครบรอบก่อน ถึงจะกลับมาเว็บนี้ได้
                // cycleLen = จำนวนเว็บที่คนนั้นมีสิทธิ์ → ห่างจากครั้งล่าสุดอย่างน้อยเท่านั้นวัน
                // คนที่ไม่เคยทำเว็บนี้เลย (Infinity) ผ่านด่านนี้เสมอ
                let eligible = withAccess.filter(u => {
                    const cycleLen = (dutyAccessMatrix[String(u.id)] || []).length;
                    return window.dutyDaysAgoOnTeam(rotation, u.id, team) >= cycleLen;
                });
                // 🛟 ชั้นที่ 2: ผ่อนเหลือแค่ "ไม่ใช่เว็บล่าสุดของเขา" (เท่ากับกฎเดิม)
                if (eligible.length === 0) {
                    eligible = withAccess.filter(u => yestTeamMap[String(u.id)] !== team);
                }

                // 🛟 ชั้นที่ 3: ยอมให้ซ้ำ เพื่อไม่ให้ตารางขาดคน
                if (eligible.length === 0) { eligible = withAccess; }

                return { team: team, eligibleCount: eligible.length, eligibleUsers: eligible };
            });

            teamStats.sort((a, b) => a.eligibleCount - b.eligibleCount);
            let target = teamStats[0];
            let teamToFill = target.team;

            if (target.eligibleCount === 0) {
                rosterResult[teamToFill].push({ username: '<span class="text-red-500 font-bold bg-red-50 px-1 rounded border border-red-200"><span class="material-icons text-[10px]">warning</span> ขาดคน (ไม่มีสิทธิ์)</span>' });
                remainingReqs[teamToFill]--;
                continue;
            }

            let userOptions = target.eligibleUsers.map(u => {
                const uid = String(u.id);
                const access = dutyAccessMatrix[uid] || [];
                const viableTeamsCount = access.filter(t => remainingReqs[t] > 0).length;
                return {
                    user: u,
                    flexibility: viableTeamsCount,
                    access: access,
                    daysAgo: window.dutyDaysAgoOnTeam(rotation, uid, teamToFill),
                    timesOnTeam: (rotation.counts[uid] && rotation.counts[uid][teamToFill]) || 0
                };
            });

            userOptions.sort((a, b) => {
                // 1) ห่างจากเว็บนี้นานสุดมาก่อน — คนที่ไม่เคยทำเลย (Infinity) ได้ก่อนเสมอ
                //    ต้องดัก Infinity แยก เพราะ Infinity - Infinity = NaN จะทำให้ sort เพี้ยน
                if (a.daysAgo !== b.daysAgo) {
                    if (a.daysAgo === Infinity) return -1;
                    if (b.daysAgo === Infinity) return 1;
                    return b.daysAgo - a.daysAgo;
                }
                // 2) เคยลงเว็บนี้น้อยครั้งกว่ามาก่อน — เกลี่ยให้ทั่วถึง
                if (a.timesOnTeam !== b.timesOnTeam) return a.timesOnTeam - b.timesOnTeam;
                // 3) คนที่เลือกได้น้อยเว็บมาก่อน — กันไม่ให้เว็บที่หาคนยากขาดคนทีหลัง
                if (a.flexibility !== b.flexibility) return a.flexibility - b.flexibility;
                return Math.random() - 0.5;
            });

            // 🌟 พระเอกอยู่ตรงนี้: ตอนดึงคนมาลง เราบังคับเคลียร์งานรอง (ความจำเก่า) ทิ้งให้เป็น null เสมอ!
            const chosen = userOptions[0];
            let pickedUser = { ...chosen.user };
            pickedUser.secondary_team = null;
            pickedUser.assigned_by = currentUser.username;
            pickedUser.assigned_at = new Date().toISOString();

            rosterResult[teamToFill].push(pickedUser);
            remainingReqs[teamToFill]--;
            unassignedPool = unassignedPool.filter(u => u.id !== pickedUser.id);
        }

        // 🔧 รอบซ่อม: สลับคู่ที่สลับแล้วดีขึ้น เก็บกวาดเคสซ้ำเว็บเดิมที่หลุดมาจากขั้นสุดท้าย
        // คนที่ถูกล็อก "อยู่ต่อ" ต้องไม่โดนสลับ ไม่งั้นจะขัดกับคำสั่งแอดมิน
        const lockedIds = pinnedIds;
        const repairSwaps = window.repairRosterRotation(rosterResult, rotation, lockedIds);

        // นับสถิติหลังซ่อมเสร็จ ตัวเลขจะได้ตรงกับตารางที่บันทึกจริง
        Object.entries(rosterResult).forEach(([team, list]) => {
            (list || []).forEach(u => {
                if (!u || !u.id) return;
                if (lockedIds.has(String(u.id))) return;        // คนถูกล็อกไม่นับ เพราะไม่ได้ผ่านการหมุน
                const ago = window.dutyDaysAgoOnTeam(rotation, u.id, team);
                const cycleLen = (dutyAccessMatrix[String(u.id)] || []).length;
                if (ago === Infinity)      rotationStats.fresh++;
                else if (ago >= cycleLen)  rotationStats.rotated++;
                else {
                    rotationStats.repeated++;
                    rotationStats.repeatedNames.push(`${u.username} → ${team} (เพิ่งทำเมื่อ ${ago} วันก่อน)`);
                }
            });
        });
        rotationStats.repairSwaps = repairSwaps;

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        window.clearSettingCache(); const { error: _upsertErr2 } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(rosterResult) }]);
        if (_upsertErr2) throw _upsertErr2;

        try {
            // 🌟 สร้าง summary ของผู้ที่ถูกจัดเข้าแต่ละเว็บ
            const summaryParts = [];
            let totalAssigned = 0;
            for (const team of Object.keys(rosterResult).sort((a,b) => a.localeCompare(b))) {
                const names = (rosterResult[team] || [])
                    .filter(u => !u.username.includes('ขาดคน'))
                    .map(u => u.username);
                if (names.length > 0) {
                    summaryParts.push(`[${team}] ${names.join(', ')}`);
                    totalAssigned += names.length;
                }
            }
            const detailText = `จัดเวรแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate}) — รวม ${totalAssigned} คน
${summaryParts.join(' | ')}`;

            await appDB.from('system_logs').insert([{ action_type: 'สุ่มจัดหน้าที่', performed_by: currentUser.username, target_details: detailText }]);
            if(appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
        } catch(logError) {}

        window.refreshDutyData();

        // 🔄 สรุปผลการหมุนเวียนเว็บ ให้แอดมินเห็นว่าหมุนได้ดีแค่ไหน
        let pinSummary = '';
        const totalPicked = rotationStats.fresh + rotationStats.rotated + rotationStats.repeated;
        if (totalPicked > 0) {
            pinSummary += `<div style="margin-top:12px;text-align:left;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:#047857">
                <b>🔄 การหมุนเวียนเว็บ</b> <span style="font-size:10.5px;opacity:.75">(ดูประวัติย้อนหลัง ${rotation.lookback} วัน พบตาราง ${rotation.daysFound} วัน)</span><br>
                • ได้เว็บที่ <b>ไม่เคยทำเลย</b> — ${rotationStats.fresh} คน<br>
                • ได้เว็บที่ <b>วนครบรอบแล้ว</b> — ${rotationStats.rotated} คน
                ${rotationStats.repeated > 0 ? `<br>• <span style="color:#b45309">ยังต้องทำซ้ำก่อนครบรอบ — ${rotationStats.repeated} คน</span>` : ''}
                ${rotationStats.repairSwaps > 0 ? `<br><span style="font-size:10.5px;opacity:.8">🔧 ปรับสลับให้อีก ${rotationStats.repairSwaps} คู่ เพื่อลดการซ้ำเว็บ</span>` : ''}
            </div>`;
        }
        if (rotationStats.repeated > 0) {
            pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:12px;padding:10px 12px;font-size:11px;color:#92400e;max-height:140px;overflow-y:auto">
                คนที่ยังหมุนไม่ครบรอบ (เพราะสิทธิ์หลังบ้านจำกัด หรือคนไม่พอ):<br>${rotationStats.repeatedNames.join('<br>')}</div>`;
        }

        // 📌 สรุปผลของคนที่ถูกล็อกอยู่ต่อ ให้แอดมินเห็นว่าระบบทำอะไรให้บ้าง
        if (pinnedPlaced.length > 0) {
            pinSummary += `<div style="margin-top:12px;text-align:left;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:#b45309">
                <b>📌 อยู่ต่อจากที่ล็อกไว้ ${pinnedPlaced.length} คน</b><br>${pinnedPlaced.join('<br>')}</div>`;
        }
        if (pinnedOverQuota.length > 0) {
            pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:10px 12px;font-size:11.5px;color:#b91c1c">
                ⚠️ เว็บเหล่านี้มีคนล็อกไว้เกินโควตาที่ตั้ง — ยอดคนจะเกินที่ระบุ:<br><b>${pinnedOverQuota.join(', ')}</b></div>`;
        }
        if (pinnedSkipped.length > 0) {
            // บอกให้รู้ว่าใครถูกดึงมาแทน แต่ไม่ไปบังคับล็อกคนแทนไว้
            // "คนมาแทน" = คนที่วันนี้อยู่เว็บนั้น แต่เมื่อวานไม่ได้อยู่
            const lines = pinnedSkipped.map(s => {
                const newFaces = (rosterResult[s.team] || [])
                    .filter(u => u && u.id && yestTeamMap[String(u.id)] !== s.team)
                    .map(u => u.username);
                return `• <b>${s.username}</b> (ล็อกไว้ที่ ${s.team}) → `
                    + (newFaces.length
                        ? `วันนี้ <b>${s.team}</b> ได้ <b>${newFaces.join(', ')}</b> มาแทน`
                        : `วันนี้ <b>${s.team}</b> ใช้คนเดิมทั้งหมด`);
            });
            pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:10px 12px;font-size:11.5px;color:#64748b;line-height:1.8">
                ℹ️ <b>คนที่ถูกล็อกแต่วันนี้ไม่ได้ทำงาน</b> (ลาหยุด / สลับกะ) — การล็อกยังอยู่ ใช้ต่อวันถัดไปได้<br>
                ${lines.join('<br>')}
                <div style="margin-top:6px;opacity:.8">คนที่มาแทนไม่ได้ถูกล็อกไว้ พรุ่งนี้จะหมุนตามปกติ ถ้าอยากให้อยู่ต่อให้กด 📌 เอง</div>
            </div>`;
        }

        if (unassignedPool.length > 0) {
            // 🔧 [FIX] แยกสาเหตุให้ชัด: ไม่มีสิทธิ์เว็บไหนเลย vs มีสิทธิ์แต่โควตาเว็บเต็มแล้ว
            const noAccess = unassignedPool.filter(u => !(dutyAccessMatrix[String(u.id)] || []).some(t => sortedTeams.includes(t)));
            const quotaFull = unassignedPool.filter(u => !noAccess.includes(u));
            let reasonHtml = '';
            if (quotaFull.length > 0) {
                reasonHtml += `<div style="margin-top:6px">มีสิทธิ์แต่<b>โควตาเว็บเต็ม</b> (ตั้งจำนวนรวม ${requiredCount} คน แต่มาทำ ${activeStaff.length} คน) <b>${quotaFull.length} คน</b>:<br><span class="text-amber-500 font-bold">${quotaFull.map(u => u.username).join(', ')}</span><br><span style="font-size:11px;opacity:.8">→ เพิ่มจำนวนคนต่อเว็บ หรือกด "คำนวณยอดคนออโต้" แล้วล้างตารางจัดใหม่</span></div>`;
            }
            if (noAccess.length > 0) {
                reasonHtml += `<div style="margin-top:6px">ไม่ได้ติ๊กสิทธิ์หลังบ้านเว็บไหนเลย <b>${noAccess.length} คน</b>:<br><span class="text-red-500 font-bold">${noAccess.map(u => u.username).join(', ')}</span></div>`;
            }
            Swal.fire({ icon: 'warning', title: `จัดหลักสำเร็จ! (มีคนเหลือ)`, html: `เหลือพนักงานไม่ได้ลงเว็บ <b>${unassignedPool.length} คน</b>${reasonHtml}${pinSummary}` });
        } else if (pinSummary) {
            Swal.fire({ icon: 'success', title: `จัดตำแหน่งหลักสำเร็จ!`, html: `กรุณากดปุ่มสายฟ้า (จัดตำแหน่งรองด่วน) เพื่อจับคู่เวลาพักครับ${pinSummary}` });
        } else {
            Swal.fire({ icon: 'success', title: `จัดตำแหน่งหลักสำเร็จ!`, text: 'กรุณากดปุ่มสายฟ้า (จัดตำแหน่งรองด่วน) เพื่อจับคู่เวลาพักครับ', timer: 2500, showConfirmButton: false });
        }
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

window.renderRosterGrid = async function(rosterData) {
    const cardGrid = document.getElementById('dutyResultGrid'); 
    const matrixGrid = document.getElementById('dutyMatrixGrid'); 
    
    if(!cardGrid) return;
    
    if (currentDutyDept === 'ODQL' || currentDutyDept === 'TRAINER_OD') {
        cardGrid.classList.add('hidden');
        if (matrixGrid) matrixGrid.classList.remove('hidden');
        
        if (typeof window.renderTrainerOdMatrix === 'function') {
            window.renderTrainerOdMatrix(rosterData); 
        }
        return; 
    } 
    else {
        cardGrid.classList.remove('hidden');
        if (matrixGrid) matrixGrid.classList.add('hidden');
    }

    cardGrid.innerHTML = '';
    let finalGridHtml = '';

    currentRosterData = rosterData;
    // ในโหมดตัวอย่าง ตัดสิทธิ์แก้ไขทั้งหมด เพราะยังไม่มีตารางจริงให้แก้
    const isAdmin = window.isDutyAdmin() && !window.isRosterPreview;

    if (window.isRosterPreview) {
        finalGridHtml += `
        <div class="col-span-full bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed border-amber-400 dark:border-amber-700 rounded-2xl p-3 flex items-center gap-3">
            <span class="material-icons text-amber-500 text-2xl shrink-0">push_pin</span>
            <div class="flex-1 min-w-0">
                <div class="font-black text-sm text-amber-800 dark:text-amber-300">ภาพตัวอย่าง — ยังไม่ได้จัดเวรวันนี้</div>
                <div class="text-[11px] text-amber-700 dark:text-amber-400/80 mt-0.5">
                    ที่เห็นคือคนที่ถูกล็อก "อยู่ต่อ" ไว้ล่วงหน้า ยังไม่ได้บันทึกลงระบบ —
                    กด <b>"สุ่มจัดหน้าที่"</b> เพื่อจัดคนที่เหลือให้ครบ แล้วชื่อเหล่านี้จะถูกวางที่เดิมให้อัตโนมัติ
                </div>
            </div>
        </div>`;
    }

    let trainerReports = {};
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
    const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : '';
    const subFilter = document.getElementById('trainerDeptFilter') ? document.getElementById('trainerDeptFilter').value : 'ALL';

    if (window.isTrainerDept() && targetDate) {
        const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        try {
            let reportDataVal = null;
            const { data: reportData } = await appDB.from('settings').select('value').eq('key', reportKey);
            if (reportData && reportData.length > 0) reportDataVal = reportData[0].value;
            if (reportDataVal) trainerReports = JSON.parse(reportDataVal);
        } catch(e) {}
    }

    window.currentStandbyData = {};
    let standbyData = {};
    sortedTeams.forEach(t => standbyData[t] = []);
    
    for (const primaryTeam in rosterData) {
        if (!rosterData[primaryTeam]) continue;
        rosterData[primaryTeam].forEach(u => {
            if (u.secondary_team && sortedTeams.includes(u.secondary_team) && !u.username.includes('ขาดคน')) {
                standbyData[u.secondary_team].push({
                    name:       u.username,
                    fromTeam:   primaryTeam,
                });
            }
        });
    }
    window.currentStandbyData = standbyData; 

    // 🕘 [ป้ายเมื่อวาน] ดึงตารางเวรของ "เมื่อวาน" (แผนกเดียวกัน กะเดียวกัน) มาทำแผนที่ ชื่อ → เว็บ
    // เพื่อโชว์ป้าย "เมื่อวานทำ <เว็บ>" ต่อท้ายชื่อพนักงาน — cache ตาม key กันยิงซ้ำทุกครั้งที่วาด
    let yesterdayTeamOf = {};
    if (targetDate) {
        try {
            const yd = new Date(targetDate + 'T00:00:00');
            yd.setDate(yd.getDate() - 1);
            const ydStr = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
            const ydKey = `duty_roster_${currentDutyDept}_${ydStr}_${shiftFilter}`;
            if (window._ydRosterCache && window._ydRosterCache.key === ydKey) {
                yesterdayTeamOf = window._ydRosterCache.map;
            } else {
                const { data: ydData } = await appDB.from('settings').select('value').eq('key', ydKey).maybeSingle();
                if (ydData && ydData.value) {
                    const ydRoster = JSON.parse(ydData.value);
                    for (const t in ydRoster) {
                        (ydRoster[t] || []).forEach(u => {
                            if (u && u.username && !String(u.username).includes('ขาดคน')) {
                                // เก็บทั้งงานหลัก และงานรอง (สแตนด์บายช่วย) ของเมื่อวาน
                                yesterdayTeamOf[u.username] = { main: t, sec: u.secondary_team || null };
                            }
                        });
                    }
                }
                window._ydRosterCache = { key: ydKey, map: yesterdayTeamOf };
            }
        } catch (e) { console.error('โหลดตารางเมื่อวานไม่สำเร็จ:', e); }
    }

    sortedTeams.forEach(team => {
        let assignees = rosterData[team] || [];
        // card เว็บแสดงเสมอ แม้จะไม่มีพนักงาน
        
        if (window.isTrainerDept()) {
        }
        
        const rolesForThisTeam = customDutyRoles[team] || [];
        const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
        let rolesTags = rolesForThisTeam.map(r => `<span class="${colorClass.lightBg} ${colorClass.lightText} px-1.5 py-0.5 rounded text-[9px] mr-1 mb-1 font-bold inline-block border ${colorClass.border} opacity-90">${r}</span>`).join('');
        
        let namesHtml = assignees.map(a => {
            const isMissing = a.username.includes('ขาดคน');
            const canDrag = !isMissing && a.id && isAdmin;
            const dragAttrs = canDrag ? `draggable="true" ondragstart="handleDragStart(event, '${a.id}', '${a.username}', '${team}')"` : '';
            const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default';

            // 🌟 NEW: สร้างป้ายโชว์เวลากินข้าว (อัปเดตให้ดึงมาทั้งหมด 2 ช่วง และปรับขนาดใหญ่ขึ้น)
            let breakTimeHtml = '';
            if (!isMissing) {
                const mySchedules = (window.currentDutySchedules || []).filter(s => s.staff_name === a.username);
                
                if (mySchedules && mySchedules.length > 0) {
                    const timeSlotsText = mySchedules.map(s => s.time_slot).sort((t1, t2) => t1.localeCompare(t2)).join(', ');
                    
                    // ปรับ text-[10px] เป็น text-xs (ใหญ่ขึ้น), เพิ่มช่องว่าง gap-1.5, ขยายไอคอนเป็น text-[14px], ปรับ Padding px-2.5 py-1
                    breakTimeHtml = `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800/50 w-fit shadow-sm cursor-default"><span class="material-icons text-[14px]">restaurant</span> พัก: ${timeSlotsText}</div>`;
                } else {
                    breakTimeHtml = `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-md border border-red-200 dark:border-red-800/50 w-fit shadow-sm"><span class="material-icons text-[14px]">warning</span> ยังไม่ลงเวลา</div>`;
                }
            }
            // 🌟 -----------------------------------

            let secHtml = '';
            if (a.secondary_team && !isMissing) {
                const secTeamColors = TEAM_COLORS[a.secondary_team] || TEAM_COLORS['DEFAULT'];
                const actionClick = isAdmin ? `onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')"` : '';
                const hoverFx = isAdmin ? 'hover:border-transparent hover:shadow-md cursor-pointer' : 'border-gray-200 dark:border-slate-600';

                secHtml = `
                <div ${actionClick} title="${isAdmin ? 'คลิกเพื่อเปลี่ยนงานรอง' : 'นี่คืองานรองของคุณ'}" class="mt-2.5 flex flex-col w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 shadow-inner ${hoverFx} overflow-hidden group/sec">
                    <div class="flex items-stretch">
                        <div class="w-1.5 ${secTeamColors.bg} ${secTeamColors.border} border-r shadow-inner"></div>
                        <div class="flex-1 p-2 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5">
                                <span class="material-icons text-[14px] text-gray-400 group-hover/sec:text-indigo-500 transition">transfer_within_a_station</span>
                                <span class="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">สแตนด์บายช่วย :</span>
                            </div>
                            <span class="text-[11px] font-black ${secTeamColors.text} ${secTeamColors.bg} px-2.5 py-0.5 rounded-full shadow-sm border ${secTeamColors.border} flex items-center gap-1">
                                ${a.secondary_team}
                                ${isAdmin ? '<span class="material-icons text-[10px] opacity-70 ml-0.5">edit</span>' : ''}
                            </span>
                        </div>
                    </div>
                </div>`;
            } else if (!isMissing && isAdmin) {
                secHtml = `
                <div onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')" class="mt-2.5 flex items-center justify-center gap-1.5 w-full bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-400 hover:text-indigo-500 border border-dashed border-gray-300 dark:border-slate-600 hover:border-indigo-400 py-2 rounded-lg text-[9.5px] font-bold transition cursor-pointer group/add shadow-inner">
                    <span class="material-icons text-[14px] group-hover/add:rotate-90 transition-transform">add_task</span>
                    แจกงานรองให้พนักงาน
                </div>`;
            }
            const odTaskHtml = '';   // (ป้ายแจกโปร/เคส TG ถูกถอดออก)
            // 📌 ป้าย/ปุ่ม "อยู่ต่ออีกกี่วัน"
            // ใช้สิทธิ์ของฟีเจอร์นี้โดยเฉพาะ ไม่ใช่ isAdmin ที่ถูกตัดในโหมดตัวอย่าง
            // เพราะการแก้/ยกเลิกการล็อกไม่ได้ไปแตะตารางเวร ทำได้ตลอด
            const stayPinHtml = isMissing ? '' : window.renderStayPinHtml(a, team, window.canManageStayPin());

            // 🤝 ถ้าคนนี้ถูกจัดไปช่วยเว็บอื่น ให้ขึ้นบนการ์ดว่าไปช่วยใคร ช่วงไหน
            let supportHtml = '';
            if (!isMissing && a.id) {
                // คนเดียวอาจถูกจัดไปช่วยหลายเว็บคนละช่วง — โชว์ให้ครบทุกอัน
                supportHtml = window.getSupportForUser(a.id).map(sup => {
                    const c = TEAM_COLORS[sup.target] || TEAM_COLORS['DEFAULT'];
                    return `<div title="ไปประจำเว็บ ${sup.target} ในช่วงเวลานี้"
                        class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-300 px-2.5 py-1 rounded-md border border-cyan-300 dark:border-cyan-800/50 w-fit shadow-sm">
                        <span class="material-icons text-[14px]">support_agent</span>
                        ช่วย <span class="${c.lightBg} ${c.lightText} px-1.5 rounded font-black">${sup.target}</span>
                        ${minToTime(sup.start)}–${minToTime(sup.end)}
                    </div>`;
                }).join('');
            }

            return `
            <div class="duty-user-card flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm shrink-0 group ${cursorClass}" data-name="${(a.username || '').toLowerCase()}" ${dragAttrs}>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="material-icons text-green-500 text-[18px] pointer-events-none drop-shadow-sm">${isMissing ? 'warning' : 'check_circle'}</span>
                        <span class="font-black text-slate-800 dark:text-gray-100 text-sm pointer-events-none truncate tracking-wide">${a.username}</span>
                        ${(() => {
                            const yInfo = !isMissing ? yesterdayTeamOf[a.username] : null;
                            if (!yInfo) return '';
                            // รองรับข้อมูลเก่าที่เก็บเป็น string เฉยๆ
                            const yMain = (typeof yInfo === 'string') ? yInfo : yInfo.main;
                            const ySec  = (typeof yInfo === 'string') ? null : yInfo.sec;
                            if (!yMain && !ySec) return '';
                            let html = '';
                            if (yMain) {
                                const yc = TEAM_COLORS[yMain] || TEAM_COLORS['DEFAULT'];
                                html += `<span title="เมื่อวานงานหลักเว็บ ${yMain}" class="flex items-center gap-1 ${yc.bg} ${yc.text} border ${yc.border} text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm pointer-events-none shrink-0"><span class="material-icons text-[11px]">history</span>เมื่อวานทำ ${yMain}</span>`;
                            }
                            if (ySec) {
                                const sc = TEAM_COLORS[ySec] || TEAM_COLORS['DEFAULT'];
                                html += `<span title="เมื่อวานงานรอง (สแตนด์บายช่วย) เว็บ ${ySec}" class="flex items-center gap-1 ${sc.lightBg} ${sc.lightText} border ${sc.border} text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm pointer-events-none shrink-0 opacity-90"><span class="material-icons text-[11px]">directions_walk</span>รองเมื่อวาน ${ySec}</span>`;
                            }
                            return html;
                        })()}
                    </div>
                </div>
                ${stayPinHtml}
                ${supportHtml}
                ${breakTimeHtml}
                ${odTaskHtml}
                ${secHtml}
            </div>`;
        }).join('');

        let trainerReportHtml = '';
        if (window.isTrainerDept()) {
            const tr = trainerReports[team] || { missed: 0, checker: '-', score: '-', mistakes: [] };
            const scoreNum = parseInt(tr.score);
            let scoreColor = 'text-gray-500';
            if(scoreNum >= 8) scoreColor = 'text-green-600';
            else if(scoreNum >= 5) scoreColor = 'text-amber-500';
            else if(scoreNum > 0) scoreColor = 'text-red-600';
            const missedColor = parseInt(tr.missed) > 0 ? 'text-red-500 font-bold' : 'text-green-600';
            
            let behaviorHtml = '<span class="text-gray-400 mt-0.5 block">- ไม่มี -</span>';
            if (tr.mistakes && tr.mistakes.length > 0) {
                behaviorHtml = tr.mistakes.map(m => `
                    <div class="mt-1 p-1.5 bg-red-50 dark:bg-red-900/30 rounded border border-red-100 dark:border-red-800 text-[10px]">
                        <span class="font-bold text-red-600">${m.empName}</span>: <span class="text-slate-600 dark:text-slate-300">${m.note || '-'}</span>
                        <div class="flex gap-1 mt-1 overflow-x-auto">
                            ${m.images && m.images.length > 0 ? m.images.map(img => `<img src="${img}" class="h-10 w-auto rounded shadow-sm border border-red-200 cursor-pointer" onclick="window.open('${img}','_blank')">`).join('') : ''}
                        </div>
                    </div>
                `).join('');
            } else if (tr.bad_behavior && tr.bad_behavior !== '-') { 
                behaviorHtml = `<span class="text-red-600 bg-red-50 p-1 rounded font-bold block mt-0.5 break-words">${tr.bad_behavior}</span>`;
            }

            const isTrainerStaff = (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || (currentUser.department && currentUser.department.startsWith('TRAINER')));
            const btnLogData = (isAdmin || isTrainerStaff) ? `<button onclick="openTrainerReportModal('${team}')" class="text-[9px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded shadow transition font-bold border border-amber-600">📝 ประเมิน</button>` : '';

            trainerReportHtml = `
            <div class="mt-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700/50 p-2 flex flex-col gap-1.5 shrink-0">
                <div class="flex justify-between items-center mb-1 border-b border-amber-200/50 pb-1">
                    <span class="text-[10px] font-extrabold text-amber-800 dark:text-amber-400 flex items-center gap-1"><span class="material-icons text-[12px]">assignment</span> สรุปรายงานดูแลเว็บ</span>
                    ${btnLogData}
                </div>
                <div class="text-[10px] text-slate-700 dark:text-slate-300 leading-tight bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-600 space-y-1">
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">👮 คนเช็คชื่อ:</span> <span class="text-blue-600 font-bold">${tr.checker || '-'}</span>
                    </div>
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">🚨 แชทหลุด:</span> <span class="${missedColor}">${tr.missed} แชท</span>
                    </div>
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">⭐ คะแนนรวม:</span> <span class="font-extrabold text-[12px] ${scoreColor}">${tr.score !== '-' ? tr.score + '/10' : '-'}</span>
                    </div>
                    <div class="pt-1">
                        <span class="font-bold text-red-500 flex items-center">⚠️ พฤติกรรมไม่ดี:</span>
                        ${behaviorHtml}
                    </div>
                </div>
            </div>`;
        }

        const primaryCount = assignees.filter(u => !u.username.includes('ขาดคน')).length;
        const standbyList = standbyData[team] || [];
        const standbyCount = standbyList.length;

        // 🍽️ [กติกาพัก] เตือนถ้าช่วงไหนพักพร้อมกันเกินเพดาน — กติกาใหม่: แยกกลุ่มหลัก/รอง (หลักชนรองได้)
        let breakWarnHtml = '';
        if (typeof window.breakCapByRule === 'function') {
            const mainMembers = assignees.filter(u => u.id && !u.username.includes('ขาดคน')).map(u => u.username);
            const secMembers = standbyList.map(s => s.name).filter(n => n && !mainMembers.includes(n));
            const groups = [
                { label: 'หลัก', members: mainMembers, cap: mainMembers.length ? window.breakCapByRule(mainMembers.length) : 0 },
                { label: 'รอง',  members: secMembers,  cap: secMembers.length ? window.breakCapByRule(secMembers.length) : 0 }
            ];
            const warnLines = [];
            groups.forEach(g => {
                if (g.members.length === 0) return;
                const perSlot = {};
                (window.currentDutySchedules || []).forEach(sc => {
                    if (!g.members.includes(sc.staff_name)) return;
                    String(sc.time_slot || '').split(',').map(x => x.trim()).filter(Boolean).forEach(slot => {
                        (perSlot[slot] = perSlot[slot] || new Set()).add(sc.staff_name);
                    });
                });
                Object.entries(perSlot).filter(([, set]) => set.size > g.cap)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .forEach(([slot, set]) => warnLines.push(`<div class="ml-4 font-normal">[${g.label}] ${slot} → ${set.size}/${g.cap}: ${[...set].join(', ')}</div>`));
            });
            if (warnLines.length > 0) {
                breakWarnHtml = `<div class="mx-2 mt-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-600 dark:text-red-300 shrink-0">
                    <div class="flex items-center gap-1"><span class="material-icons text-[13px]">warning</span> พักพร้อมกันเกินเพดาน (หลัก ${mainMembers.length} คน พักได้ ${groups[0].cap} · รอง ${secMembers.length} คน พักได้ ${groups[1].cap})</div>
                    ${warnLines.join('')}
                </div>`;
            }
        }

        finalGridHtml += `
            <div class="duty-site-card bg-slate-50 dark:bg-slate-900 border-2 ${colorClass.border} rounded-2xl shadow-md flex flex-col h-[500px] overflow-hidden w-full">
                <div class="flex justify-between items-center ${colorClass.bg} ${colorClass.text} p-3 shadow-sm shrink-0">
                    <div class="flex items-center flex-wrap gap-2 w-full">
                        <h4 class="font-black text-base pointer-events-none tracking-wide">${team}</h4>
                        <div class="flex items-center gap-2 ml-auto">
                            <div class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shadow-inner whitespace-nowrap border border-white/30 flex items-center gap-1" style="color: inherit;">
                                <span class="opacity-80">หลัก</span><span class="text-xs font-black bg-black/20 px-1 rounded-md">${primaryCount}</span>
                            </div>
                            <button onclick="viewStandbyList('${team}')" title="คลิกดูรายชื่อสแตนด์บาย" class="cursor-pointer text-[10px] font-extrabold bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 px-2 py-0.5 rounded-lg shadow-md whitespace-nowrap transition hover:from-amber-200 hover:to-yellow-400 hover:scale-105 border border-amber-600 flex items-center gap-1 active:scale-95">
                                <span>รอง</span><span class="text-xs font-black bg-white/40 px-1 rounded-md">${standbyCount}</span><span class="material-icons text-[11px] opacity-70">touch_app</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    ${rolesTags || ''}
                </div>
                ${breakWarnHtml}
                <div class="flex flex-col gap-2.5 flex-1 p-2 overflow-y-auto custom-scrollbar content-start drop-zone" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${team}')">
                    ${namesHtml || `
                        <div class="flex flex-col items-center justify-center h-full py-6 pointer-events-none select-none opacity-40">
                            <span class="material-icons text-3xl text-gray-400 mb-1">person_off</span>
                            <span class="text-xs font-bold text-gray-400">ไม่มีพนักงาน</span>
                            <span class="text-[10px] text-gray-400 mt-0.5">ลากคนมาวางได้เลย</span>
                        </div>`}
                </div>
                ${trainerReportHtml}
            </div>
        `;
    });

   cardGrid.innerHTML = finalGridHtml;
};

window.selectSecOption = function(el, val) {
    document.querySelectorAll('.sec-opt').forEach(opt => {
        opt.className = opt.className.replace(/ring-2 ring-(blue|red)-500 bg-(blue|red)-50 dark:bg-(blue|red)-900\/(20|30) shadow-md/g, '');
        if(!opt.className.includes('bg-gray-50') && !opt.className.includes('bg-white')) {
            if(opt.innerText.includes('ปลดงาน')) opt.classList.add('bg-gray-50', 'dark:bg-slate-800');
            else opt.classList.add('bg-white', 'dark:bg-slate-800');
        }
    });
    if(val === 'none') el.className += ' ring-2 ring-red-500 bg-red-50 dark:bg-red-900/30';
    else el.className += ' ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md';
    document.getElementById('swal-sec-val').value = val;
};

window.changeSecondaryTeam = async function(primaryTeam, userId, username) {
    if (window.blockIfPreview()) return;   // โหมดตัวอย่าง: ห้ามเขียนตารางลง DB
    const uidStr = String(userId);
    const access = dutyAccessMatrix[uidStr] || dutyAccessMatrix[Number(userId)] || [];
    let possibleSecondary = access.filter(t => t !== primaryTeam && sortedTeams.includes(t));

    if (possibleSecondary.length === 0) {
        return Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์เข้าเว็บอื่น', text: `${username} ไม่มีสิทธิ์หลังบ้านเว็บไหนเลย (นอกจากเว็บหลัก) จึงแจกงานรองไม่ได้ กรุณาไปเพิ่มสิทธิ์ในหน้าตั้งค่าก่อนครับ`, confirmButtonColor: '#3b82f6' });
    }

    let currentUserData = currentRosterData[primaryTeam].find(u => String(u.id) === String(userId));
    let currentSec = currentUserData ? currentUserData.secondary_team : null;

    let htmlContent = `<div class="mt-4 flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto custom-scrollbar p-1">`;
    const noneActive = !currentSec ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20';
    htmlContent += `
        <div onclick="selectSecOption(this, 'none')" class="sec-opt p-3 rounded-xl border border-gray-200 dark:border-slate-600 cursor-pointer transition-all flex items-center justify-between group ${noneActive}">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 flex items-center justify-center group-hover:scale-110 transition"><span class="material-icons text-lg">block</span></div>
                <div class="text-left"><div class="font-bold text-slate-700 dark:text-gray-200 text-sm">ปลดงานรองออก</div><div class="text-[10px] text-gray-500 dark:text-gray-400">ไม่ต้องสแตนด์บายช่วยเว็บอื่น</div></div>
            </div>
        </div>
    `;

    possibleSecondary.forEach(t => {
        const isActive = currentSec === t ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md' : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20';
        const teamColor = TEAM_COLORS[t] || TEAM_COLORS['DEFAULT'];
        htmlContent += `
            <div onclick="selectSecOption(this, '${t}')" class="sec-opt p-3 rounded-xl border border-gray-200 dark:border-slate-600 cursor-pointer transition-all flex items-center justify-between group overflow-hidden relative ${isActive}">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 ${teamColor.bg}"></div>
                <div class="flex items-center gap-3 pl-3 z-10">
                    <div class="w-10 h-10 rounded-full ${teamColor.lightBg} ${teamColor.lightText} flex items-center justify-center font-bold text-sm shadow-inner group-hover:scale-110 transition">${t.substring(0,2)}</div>
                    <div class="text-left"><div class="font-black text-slate-800 dark:text-white text-base">${t}</div><div class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><span class="material-icons text-[12px] text-blue-500">support_agent</span> สแตนด์บายช่วยแชท</div></div>
                </div>
            </div>
        `;
    });
    
    htmlContent += `</div><input type="hidden" id="swal-sec-val" value="${currentSec || 'none'}">`;

    const { isConfirmed } = await Swal.fire({
        title: `<div class="text-xl font-black mb-1">สแตนด์บายช่วย (${username})</div>`, html: `<div class="text-xs text-gray-500 mb-2">กดเลือกการ์ดด้านล่างเพื่อกำหนดงานรอง</div>${htmlContent}`,
        showCancelButton: true, confirmButtonText: 'บันทึกงานรอง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#3b82f6', cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
        preConfirm: () => document.getElementById('swal-sec-val').value
    });

    if (isConfirmed) {
        const selectedSec = document.getElementById('swal-sec-val').value;
        let userIndex = currentRosterData[primaryTeam].findIndex(u => String(u.id) === String(userId));

        if(userIndex > -1) {
            const prevSec = currentRosterData[primaryTeam][userIndex].secondary_team || null;
            const newSec = selectedSec === 'none' ? null : selectedSec;
            currentRosterData[primaryTeam][userIndex].secondary_team = newSec;
            const targetDate = document.getElementById('dutyDate').value; const shiftFilter = document.getElementById('dutyShiftSelect').value;
            const saveKey = getDutySaveKey(targetDate, shiftFilter);

            Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen:()=>Swal.showLoading()});
            window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);

            // 🟢 บันทึก log การเปลี่ยนงานรอง (สแตนด์บาย)
            let logDetail;
            if (!prevSec && newSec) logDetail = `แจกงานรองให้ ${username} (เว็บหลัก: ${primaryTeam}) → สแตนด์บายช่วย [${newSec}]`;
            else if (prevSec && !newSec) logDetail = `ปลดงานรอง ${username} (ออกจากการสแตนด์บายช่วย [${prevSec}])`;
            else if (prevSec !== newSec) logDetail = `เปลี่ยนงานรอง ${username}: [${prevSec}] → [${newSec}]`;
            if (logDetail) {
                await appDB.from('system_logs').insert([{
                    action_type: 'ย้ายหน้าที่',
                    performed_by: currentUser.username,
                    target_details: `${logDetail} (กะ: ${shiftFilter}, วันที่: ${targetDate})`
                }]);
            }

            window.renderRosterGrid(currentRosterData);
            if(appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
            Swal.fire({icon: 'success', title: 'อัปเดตงานรองแล้ว!', timer: 1200, showConfirmButton: false});
        }
    }
};

window.viewStandbyList = function(team) {
    const list = window.currentStandbyData[team] || [];
    if (list.length === 0) {
        return Swal.fire({ icon: 'info', title: `ทีม ${team}`, text: 'ยังไม่มีพนักงานถูกสั่งให้มาสแตนด์บายช่วยเว็บนี้ครับ', confirmButtonColor: '#3b82f6', customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' } });
    }

    const teamColor = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
    const namesHtml = list.map((item, i) => {
        let breakTimeHtml = '';
        const mySchedules = (window.currentDutySchedules || []).filter(s => s.staff_name === item.name);
        
        if (mySchedules && mySchedules.length > 0) {
            const timeSlotsText = mySchedules.map(s => s.time_slot).sort((t1, t2) => t1.localeCompare(t2)).join(', ');
            // 🌟 ปรับขนาดป้ายเวลาพักให้ใหญ่ขึ้น (text-xs = 12px, px-2.5 py-1)
            breakTimeHtml = `<span class="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-sky-200 dark:border-sky-800/50 shadow-sm"><span class="material-icons text-[14px]">restaurant</span> พัก: ${timeSlotsText}</span>`;
        } else {
            breakTimeHtml = `<span class="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-red-200 dark:border-red-800/50 shadow-sm animate-pulse"><span class="material-icons text-[14px]">warning</span> ยังไม่ลงเวลา</span>`;
        }

        return `
        <div class="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm flex items-center justify-between group hover:border-amber-400 transition mb-2.5">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shadow-inner shrink-0">${i + 1}</div>
                <div class="text-left flex flex-col gap-1.5">
                    <div class="font-black text-slate-800 dark:text-white text-[15px] uppercase tracking-wide">${item.name}</div>
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">จากเว็บหลัก: <span class="font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50">${item.fromTeam}</span></div>
                        ${breakTimeHtml}
                    </div>
                </div>
            </div>
            <span class="material-icons text-amber-400 text-2xl opacity-40 group-hover:scale-110 transition shrink-0 ml-2">support_agent</span>
        </div>
        `;
    }).join('');

    Swal.fire({
        title: `<div class="flex flex-col items-center gap-1.5"><span class="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">ทีมสแตนด์บายช่วย</span><span class="text-3xl font-black ${teamColor.text} ${teamColor.bg} px-5 py-1.5 rounded-xl shadow-md border-2 ${teamColor.border}">${team}</span></div>`,
        html: `<div class="flex flex-col mt-4 max-h-[55vh] overflow-y-auto custom-scrollbar p-1">${namesHtml}</div>`,
        confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#64748b',
        width: '500px', // 🌟 ขยายขนาดหน้าต่างให้กว้างขึ้น เพื่อให้ข้อความไม่เบียดกัน
        customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl' }
    });
};

window.filterDutyResult = function() {
    const term = document.getElementById('dutySearchInput').value.toLowerCase();
    
    // 🟢 1. จัดการค้นหาในรูปแบบ การ์ด (Card) ของพนักงาน AM / OD ปกติ
    const siteCards = document.querySelectorAll('.duty-site-card');
    
    siteCards.forEach(card => {
        const userCards = card.querySelectorAll('.duty-user-card');
        let cardHasMatch = false;

        userCards.forEach(uCard => {
            const name = uCard.dataset.name;
            if(name && name.includes(term)) { 
                // ถ้าค้นหาเจอ ให้แสดงกล่องพนักงานนั้น และไฮไลต์สี
                uCard.style.display = 'flex';
                if(term !== '') {
                    uCard.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50'); 
                    cardHasMatch = true; 
                } else {
                    uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'); 
                }
            } else { 
                // ถ้าค้นหาไม่เจอ ให้ซ่อนกล่องพนักงานคนนั้นทิ้งไปเลย จะได้ไม่รกตา
                uCard.style.display = term === '' ? 'flex' : 'none'; 
                uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'); 
            }
        });

        // ถ้าในเว็บนั้นไม่มีคนที่เราค้นหาเลย ก็ซ่อนการ์ดเว็บนั้นทิ้งไปเลย
        if(term === '') {
            card.style.display = 'flex'; 
        } else { 
            card.style.display = cardHasMatch ? 'flex' : 'none'; 
        }
    });

    // 🟢 2. จัดการค้นหาในรูปแบบ ตาราง (Matrix) ของผู้สอน OD
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (matrixGrid && !matrixGrid.classList.contains('hidden')) {
        const trs = matrixGrid.querySelectorAll('tbody tr');
        let currentShiftDisplay = null;
        let visibleCountInShift = 0;

        trs.forEach(tr => {
            const nameCell = tr.querySelector('td:nth-child(2) span, td:nth-child(1) span'); 
            if (!nameCell) return;
            
            const name = nameCell.innerText.toLowerCase();
            const shiftCell = tr.querySelector('td[rowspan]');

            // อัปเดตกะปัจจุบันที่กำลังประมวลผลอยู่
            if (shiftCell) {
                currentShiftDisplay = shiftCell;
                visibleCountInShift = 0; // เริ่มนับคนในกะใหม่
            }

            if (term === '' || name.includes(term)) {
                tr.style.display = 'table-row';
                visibleCountInShift++;
                
                // ไฮไลต์ชื่อถ้าค้นหา
                if (term !== '') nameCell.parentElement.classList.add('bg-amber-100', 'rounded', 'px-1');
                else nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
            } else {
                tr.style.display = 'none';
                nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
            }

            // จัดการอัปเดต rowspan ของกะ ให้พอดีกับจำนวนคนที่แสดงอยู่ (จะได้ไม่โบ๋)
            if (shiftCell) {
                shiftCell.rowSpan = 1; // ตั้งค่าเริ่มต้น
            } else if (currentShiftDisplay && tr.style.display !== 'none') {
                 currentShiftDisplay.rowSpan = visibleCountInShift;
                 currentShiftDisplay.parentElement.style.display = 'table-row'; // ให้แน่ใจว่าแถวแม่ของกะแสดงอยู่
            }
            
            // ถ้ากะนั้นไม่มีคนถูกค้นหาเจอเลย ก็ซ่อนแถวที่มีชื่อกะทิ้งไปเลย
            if (currentShiftDisplay && visibleCountInShift === 0 && tr.style.display === 'none' && !tr.querySelector('td[rowspan]')) {
                currentShiftDisplay.parentElement.style.display = 'none';
            }
        });
    }
}

window.searchDutyMyself = function() {
    const searchInput = document.getElementById('dutySearchInput');
    if(currentUser && currentUser.username) {
        searchInput.value = currentUser.username; window.filterDutyResult();
    }
}
