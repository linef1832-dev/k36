// ════════════════════════════════════════════════════════════════════
// 📦 system/users.js — ส่วนที่ 1/4 ของระบบแกนกลาง (จัดการพนักงาน/สิทธิ์/ตั้งค่า) (แยกจาก system_core.js เดิม 3,170 บรรทัด)
// เนื้อหา: แกนผู้ใช้: โหลด/เพิ่ม/แก้/ลบพนักงาน, sync ข้อมูล, ตั้งค่าหลักของระบบ
// ⚠️ ลำดับโหลด: system/users → system/manage → system/permissions → system/admin
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🔒 [FIX] เช็คสิทธิ์ "ในฟังก์ชัน" ของหน้าจัดการระบบ — เดิมเช็คแค่ซ่อนเมนู
// ใครเปิด F12 ก็เรียก updateUserRole(...,'admin') ยกสิทธิ์ตัวเองได้ / ลบพนักงานได้
// เกณฑ์เดียวกับเมนู "จัดการระบบ": admin, manager หรือมีสิทธิ์ 'admin' ในตารางสิทธิ์
window.sysIsAdmin = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    const r = String(currentUser.role || '').toLowerCase();
    if (r === 'admin' || r === 'manager') return true;
    return typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin');
};
window.sysRequireAdmin = function() {
    if (window.sysIsAdmin()) return true;
    Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบเท่านั้นครับ', 'error');
    return false;
};

let userCurrentPage = 1;
let userRowsPerPage = 5; // เปลี่ยนค่าเริ่มต้นเป็น 5 คน
let allowedViewMonth = ''; 
let allowedStartDay = 0;   
let allowedEndDay = 31;   

let SETTINGS = { 
    quota_total_เช้า: 50, quota_total_กลาง: 50, quota_total_ดึก: 50,
    open_time_เช้า: '00:00', close_time_เช้า: '23:59',
    open_time_กลาง: '00:00', close_time_กลาง: '23:59',
    open_time_ดึก: '00:00', close_time_ดึก: '23:59',
    daily_limit: 2,
    period_limit: 1
};
let SHIFT_GROUPS = {};
let currentSpecificTimeFilter = null; 
let globalScheduleData = [];
let globalAssignmentMap = {}; // 🌟 NEW: { "username|shift" -> [allowedTeams] } สำหรับวันที่ปัจจุบัน
let globalRosterDeptShiftSet = new Set(); // 🌟 NEW: เก็บ "dept|shift" ที่มี roster ในวันนั้นๆ (เช่น "AM|กะเช้า")
let pendingSchedules = []; 

// 🌟 NEW: โหลดตารางจัดหน้าที่ของวันที่ระบุมาเก็บไว้เป็น Map ใช้ตอน render และเช็ค off-roster
async function loadAssignmentMapForDate(dateVal) {
    globalAssignmentMap = {};
    globalRosterDeptShiftSet = new Set();
    if (!dateVal) return;
    try {
        const { data: rosters } = await appDB.from('settings')
            .select('key, value')
            .like('key', `duty_roster_%_${dateVal}_%`);

        if (!rosters) return;
        rosters.forEach(r => {
            // key format: duty_roster_{dept}_{YYYY-MM-DD}_{shift}
            const parts = r.key.split('_');
            if (parts.length < 5) return;
            const dept = parts[2];
            const shift = parts[parts.length - 1];

            try {
                const roster = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                // ตรวจว่า roster มีคนอย่างน้อย 1 คนไหม — ถ้ามีถือว่ามีจัดเวรแล้ว
                let hasAnyone = false;
                for (const team in roster) {
                    (roster[team] || []).forEach(u => {
                        if (!u || !u.username) return;
                        hasAnyone = true;
                        const k = `${u.username}|${shift}`;
                        if (!globalAssignmentMap[k]) globalAssignmentMap[k] = [];
                        if (!globalAssignmentMap[k].includes(team)) globalAssignmentMap[k].push(team);
                        if (u.secondary_team && !globalAssignmentMap[k].includes(u.secondary_team)) {
                            globalAssignmentMap[k].push(u.secondary_team);
                        }
                    });
                }
                if (hasAnyone) globalRosterDeptShiftSet.add(`${dept}|${shift}`);
            } catch(e) { /* skip bad rows */ }
        });
    } catch(e) { console.error('loadAssignmentMap:', e); }
}

let GLOBAL_INDIV_TASKS = [];
let ACTIVE_SHIFTS_CONFIG = ['กะเช้า', 'กะกลาง', 'กะดึก']; 

const SHEET_BASE = "https://docs.google.com/spreadsheets/d"; 


async function addSheet() {
    if (!window.sysRequireAdmin()) return;

    const name = document.getElementById('newSheetName').value.trim();
    const group = document.getElementById('newSheetGroup').value.trim() || 'ทั่วไป';
    const url = document.getElementById('newSheetUrl').value.trim();
    const color = document.getElementById('newSheetColor').value;
    
    if(!name || !url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อและลิงก์', 'warning');
    
    let sheetId = url;
    let gid = null;

    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if(idMatch) {
        sheetId = idMatch[1];
        const gidMatch = url.match(/[?&#]gid=([0-9]+)/); 
        if (gidMatch) {
            gid = gidMatch[1];
        }
    } 
    
    const { error } = await appDB.from('external_sheets').insert([{
        name: name,
        group_name: group,
        sheet_id: sheetId,
        gid: gid, 
        color: color
    }]);
    
    if(error) return Swal.fire('Error', error.message, 'error');
    
    document.getElementById('newSheetName').value = '';
    document.getElementById('newSheetUrl').value = '';
    
    await fetchSheets();
    renderAdminSheetList();
    Swal.fire('สำเร็จ', 'เพิ่มรายการเรียบร้อย', 'success');
}

async function deleteSheet(id) {
    if (!window.sysRequireAdmin()) return;

    Swal.fire({
        title: 'ลบตาราง?', text: "ไม่สามารถกู้คืนได้", icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#d33'
    }).then(async (result) => {
        if(result.isConfirmed) {
            await appDB.from('external_sheets').delete().eq('id', id);
            await fetchSheets();
            renderAdminSheetList();
        }
    });
}

let userSubscription = null;
// 🔄 [FIX] ฟังการเปลี่ยนแปลงของ "ตัวเอง" จากแอดมิน (กะ / แผนก / ทีม / role / สิทธิ์) แล้วอัปเดตหน้าจอทันที ไม่ต้องออก-เข้าใหม่
// ⚠️ ฟังก์ชันนี้เคยเขียนไว้แต่ "ไม่มีใครเรียก" — ตอนนี้ถูกเรียกจาก global.js ตอนเริ่มระบบ
window.subscribeUserChanges = function subscribeUserChanges() {
    if (userSubscription) { try { appDB.removeChannel(userSubscription); } catch (e) {} }

    userSubscription = appDB.channel('user-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            const updatedUser = payload.new;
            if (!updatedUser) return;
            const idx = (window.GLOBAL_USER_LIST || []).findIndex(u => String(u.id) === String(updatedUser.id));
            if (idx !== -1) GLOBAL_USER_LIST[idx] = { ...GLOBAL_USER_LIST[idx], ...updatedUser };

            if (currentUser && String(currentUser.id) === String(updatedUser.id)) {
                window.applyCurrentUserUpdate(updatedUser, true);
            }
        })
        .subscribe();
};

// นำข้อมูล user ล่าสุดมาทับ currentUser แล้ววาดส่วนที่เกี่ยวข้องใหม่
// notify = true → เด้ง toast บอกว่าอะไรเปลี่ยน
window.applyCurrentUserUpdate = function(fresh, notify) {
    if (!fresh || !currentUser) return;
    const msgs = [];
    const fields = { allowed_shift: 'กะ', department: 'แผนก', team: 'ทีม', role: 'ตำแหน่ง', check_type: 'รูปแบบเช็ค' };
    Object.keys(fields).forEach(f => {
        if (fresh[f] !== undefined && String(currentUser[f] ?? '') !== String(fresh[f] ?? '')) {
            msgs.push(`${fields[f]} → "${fresh[f] || '-'}"`);
        }
    });
    Object.assign(currentUser, fresh);
    window.currentUser = currentUser;
    sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser));
    if (msgs.length === 0) return;

    // วาดใหม่เฉพาะส่วนที่ขึ้นกับข้อมูลพนักงาน
    try { if (typeof updateDashboardUserInfo === 'function') updateDashboardUserInfo(); } catch (e) {}
    try { if (typeof renderShiftButtons === 'function') renderShiftButtons(currentUser.allowed_shift); } catch (e) {}
    try { if (typeof populateTeamSelects === 'function') populateTeamSelects(); } catch (e) {}
    try { if (typeof applySidebarPermissions === 'function') applySidebarPermissions(); } catch (e) {}
    try { if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots(); } catch (e) {}
    try { if (typeof fetchData === 'function') fetchData(); } catch (e) {}

    if (notify) {
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 6000 })
            .fire({ icon: 'info', title: 'แอดมินเปลี่ยนข้อมูลของคุณ', text: msgs.join(' · ') });
    }
};

// ดึงข้อมูลตัวเองสดจาก DB (ใช้ตอนเปิด dashboard เผื่อ realtime หลุด)
window.refreshCurrentUserFromDB = async function() {
    try {
        if (!currentUser || !currentUser.id) return;
        const { data } = await appDB.from('users').select('*').eq('id', currentUser.id).maybeSingle();
        if (data) window.applyCurrentUserUpdate(data, false);
    } catch (e) {}
};

function handleDateChange() { document.getElementById('displayDate').innerText = new Date(document.getElementById('wDate').value).toLocaleDateString('th-TH'); refreshTimeSlots(); fetchData(); }
function handleTeamChange() { const team = document.getElementById('dailyTeam').value; const isRemember = document.getElementById('rememberTeam').checked; if (isRemember) window.safeSetItem(`last_team_${currentUser.username}`, team); refreshTimeSlots(); fetchData(); }
function toggleRememberTeam() { const isRemember = document.getElementById('rememberTeam').checked; if (isRemember) { const team = document.getElementById('dailyTeam').value; window.safeSetItem(`last_team_${currentUser.username}`, team); } else { localStorage.removeItem(`last_team_${currentUser.username}`); } }
function getPeriodForTime(shift, time) { const groups = SHIFT_GROUPS[shift]; if(!groups) return null; for(const [p, ts] of Object.entries(groups)) { if(ts.includes(time)) return p; } return null; }

function checkBookingTime(shiftName) {
    if(['manager', 'admin'].includes(currentUser.role)) return { allowed: true };
    
    const suffix = shiftName.replace('กะ', '');
    const openStr = SETTINGS[`open_time_${suffix}`];
    const closeStr = SETTINGS[`close_time_${suffix}`];
    
    if (!openStr || !closeStr) return { allowed: true };

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = openStr.split(':').map(Number);
    const [cH, cM] = closeStr.split(':').map(Number);
    const openMins = oH * 60 + oM;
    const closeMins = cH * 60 + cM;

    let isOpen = false;
    if (closeMins > openMins) {
        isOpen = (nowMins >= openMins && nowMins <= closeMins);
    } else {
        isOpen = (nowMins >= openMins || nowMins <= closeMins);
    }

    if (!isOpen) return { allowed: false, msg: `ขณะนี้อยู่นอกเวลาทำการของ ${shiftName} (${openStr} - ${closeStr})` };
    return { allowed: true };
}

window.saveData = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); 
    btn.disabled = true; 
    btn.innerHTML = '<span class="animate-spin material-icons">sync</span> กำลังบันทึก...';
    
    const shiftEl = document.querySelector('input[name="shift"]:checked');
    if(!shiftEl) { window.resetBtn(); return Swal.fire('เตือน', 'กรุณาเลือกกะ', 'warning'); }

    const sName = shiftEl.value;
    const timeCheck = window.checkBookingTime ? window.checkBookingTime(sName) : {allowed: true};
    if (!timeCheck.allowed) { window.resetBtn(); return Swal.fire('ปิดจอง', timeCheck.msg, 'error'); }

    const select = document.getElementById('tSlot');
    const dateVal = document.getElementById('wDate').value;
    const timeVal = select.value;
    
    // 🌟 --- โค้ดดักลงเวลาล่วงหน้า (ล็อกไม่ให้จองข้ามวัน) --- 🌟
    const todayObj = new Date();
    const currentHour = todayObj.getHours();

    const realTodayStr = new Date(todayObj.getTime() - (todayObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const realYesterdayStr = new Date(yesterdayObj.getTime() - (yesterdayObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const isStaff = !['manager', 'admin'].includes(currentUser.role);

    // 🌙 ค่าตั้งของกะดึก (ปรับเลขตรงนี้ได้ตามต้องการ)
    const NIGHT_START_HOUR = 20; // กะดึกเริ่มลงของวันนี้ได้ตั้งแต่ 20:00
    const NIGHT_END_HOUR = 8;    // ย้อนลงของเมื่อวานได้ถึงก่อน 08:00 (ของวันถัดไป)

    const isNightShiftStaff = (sName === 'กะดึก') || (currentUser.allowed_shift === 'กะดึก');

    // 🚨 ด่านที่ 1: บล็อกการลงของ "วันในอนาคต" สำหรับพนักงานทุกกะ (เด็ดขาด!)
    if (isStaff && dateVal > realTodayStr) {
        window.resetBtn();
        let blockTitle = 'ไม่ได้ห้ามลงล่วงหน้านะจ๊ะ';
        return Swal.fire(
            blockTitle,
            'ไม่สามารถลงเวลาของ "วันในอนาคต" ได้ครับ<br><span class="text-xs text-gray-500">กรุณาเลือกเฉพาะวันที่ทำงานของคุณเท่านั้น</span>',
            'error'
        );
    }

    // ด่านที่ 2: ตรรกะหลัก - แยกพิจารณาตามกะ และช่วงเวลาปัจจุบัน
    let isAllowedDate = false;
    let blockTitle = 'ไม่อนุญาต';
    let blockMsg = '';

    if (isNightShiftStaff) {
        // 🌙 พนักงานกะดึก - แยกเงื่อนไขตาม "ช่วงเวลาปัจจุบัน"
        if (currentHour >= NIGHT_START_HOUR) {
            // 🟢 ช่วง 20:00 - 23:59 (เริ่มกะคืนนี้) → ลงได้แค่ "วันนี้" เท่านั้น
            if (dateVal === realTodayStr) {
                isAllowedDate = true;
            } else if (dateVal === realYesterdayStr) {
                blockMsg = `กะของคุณเริ่มแล้ว กรุณาเลือกวันที่ <b>${realTodayStr}</b> (วันนี้)<br><span class="text-xs text-gray-500">เมื่อวานเป็นกะของพนักงานคนก่อน ไม่ใช่กะของคุณ</span>`;
            } else {
                blockMsg = `กรุณาเลือกวันที่ <b>${realTodayStr}</b> (วันนี้) เท่านั้น`;
            }
        } else if (currentHour < NIGHT_END_HOUR) {
            // 🟢 ช่วง 00:00 - 07:59 (กะคืนเก่าคร่อมเข้าวันใหม่) → ลงได้แค่ "เมื่อวาน" เท่านั้น
            // ⚠️ ห้ามลง "วันนี้" เพราะนั่นคือกะของคืนถัดไป (พนักงานคนใหม่)
            if (dateVal === realYesterdayStr) {
                isAllowedDate = true;
            } else if (dateVal === realTodayStr) {
                blockTitle = 'ไม่ได้ห้ามลงล่วงหน้านะจ๊ะ';
                blockMsg = `ตอนนี้กะของคุณคร่อมมาจากเมื่อวาน (${realYesterdayStr}) กรุณาเลือกวันที่ <b>${realYesterdayStr}</b> แทน<br><span class="text-xs text-gray-500">วันใหม่ (${realTodayStr}) ยังไม่ใช่กะของคุณ จะลงได้หลัง ${NIGHT_START_HOUR}:00 น. เป็นต้นไป</span>`;
            } else {
                blockMsg = `กรุณาเลือกวันที่ <b>${realYesterdayStr}</b> (วันที่กะของคุณเริ่ม)`;
            }
        } else {
            // 🔴 ช่วง 08:00 - 19:59 - นอกเวลากะดึก ห้ามลงทุกกรณี
            blockTitle = 'ยังไม่ถึงเวลากะดึก';
            blockMsg = `กะดึกเริ่มลงเวลาได้ตั้งแต่ <b>${NIGHT_START_HOUR}:00 น.</b> เป็นต้นไป<br><span class="text-xs text-gray-500">กรุณากลับมาใหม่อีกครั้งเมื่อถึงเวลากะของคุณ</span>`;
        }
    } else {
        // 🌞 กะอื่น (เช้า / กลาง) - ลงได้แค่ "วันนี้" เท่านั้น
        if (dateVal === realTodayStr) {
            isAllowedDate = true;
        } else if (dateVal === realYesterdayStr) {
            blockMsg = `กะของคุณไม่อนุญาตให้ย้อนลงเมื่อวาน<br><span class="text-xs text-gray-500">เฉพาะพนักงาน "กะดึก" เท่านั้นที่ย้อนได้ (เพราะคร่อมวัน)</span>`;
        } else {
            blockMsg = `ลงเวลาได้เฉพาะของ "วันนี้" (${realTodayStr}) เท่านั้น`;
        }
    }

    // 🛑 ด่านสุดท้าย: ถ้าไม่ผ่านเงื่อนไขใดๆ บล็อกพร้อมแจ้งเหตุผลที่ตรงเคส
    if (isStaff && !isAllowedDate) {
        window.resetBtn();
        return Swal.fire(blockTitle, blockMsg, 'error');
    }
    // 🌟 --------------------------------------------------- 🌟

    let activeTeam = TEAM_LIST[0];
    const dt = document.getElementById('dailyTeam');
    if(dt && dt.value) activeTeam = dt.value; else if(currentUser.team) activeTeam = currentUser.team;

    const myDep = currentUser.department || 'AM';

    // 🌟 NEW V2: เช็ค off-roster แต่ไม่บล็อก (แค่เก็บ flag ไว้เขียน log)
    let isOffRoster = false;
    let assignedTeamsStr = '';
    let coverageMap = null;   // 🍽️ ใช้เช็คคนคุมขั้นต่ำ
    if (!['manager', 'admin'].includes(currentUser.role)) {
        const rosterKey = `duty_roster_${myDep}_${dateVal}_${sName}`;
        const { data: rosterData } = await appDB.from('settings').select('value').eq('key', rosterKey).maybeSingle();

        if (rosterData && rosterData.value) {
            const roster = JSON.parse(rosterData.value);
            coverageMap = window.buildCoverageMap(roster);
            let allowedTeams = [];
            for (const team in roster) {
                (roster[team] || []).forEach(u => {
                    if (String(u.id) === String(currentUser.id)) {
                        if (!allowedTeams.includes(team)) allowedTeams.push(team);
                        if (u.secondary_team && !allowedTeams.includes(u.secondary_team)) allowedTeams.push(u.secondary_team);
                    }
                });
            }

            if (allowedTeams.length === 0) {
                // ไม่มีในตารางจัดหน้าที่เลย → flag แต่ปล่อยลงได้
                isOffRoster = true;
                assignedTeamsStr = '(ไม่มีในตารางจัดหน้าที่)';
            } else if (!allowedTeams.includes(activeTeam)) {
                // มีในตาราง แต่เลือกผิดเว็บ → flag
                isOffRoster = true;
                assignedTeamsStr = allowedTeams.join('/');
            }
        }
        // ถ้า rosterData ไม่มีเลย → ไม่ flag (ยังไม่ได้จัดเวร)
    }
    // 🌟 --------------------------------------------------- 🌟

    const { data: _mbRaw } = await appDB.from('schedules').select('*').eq('work_date', dateVal).eq('staff_name', currentUser.username);
    const myBookings = _mbRaw || [];
    const dailyLimit = parseInt(SETTINGS.daily_limit || 2);
    if (myBookings.length >= dailyLimit) { window.resetBtn(); return Swal.fire('ครบโควตา', `คุณลงครบ ${dailyLimit} รอบต่อวันแล้ว`, 'error'); }

    const _slotOpt = select.options[select.selectedIndex];
    if (!_slotOpt) { window.resetBtn(); return Swal.fire('เตือน', 'กรุณาเลือกช่วงเวลาก่อนบันทึก', 'warning'); }
    const targetPeriod = _slotOpt.dataset.period;
    const periodLimit = parseInt(SETTINGS.period_limit || 1);
    
    const checkPeriod = typeof getPeriodForTime === 'function' ? getPeriodForTime : () => targetPeriod; 
    const countInPeriod = myBookings.filter(b => b.shift_name === sName && checkPeriod(sName, b.time_slot) === targetPeriod).length;
    if (countInPeriod >= periodLimit) { window.resetBtn(); return Swal.fire('ซ้ำ!', `คุณลงช่วง "${targetPeriod}" ครบ ${periodLimit} ครั้งแล้ว`, 'error'); }

    const shiftSuffix = sName.replace('กะ','');
    const { data: slotBookings } = await appDB.from('schedules').select('*').eq('work_date', dateVal).eq('shift_name', sName).eq('time_slot', timeVal);

    // 🍽️ [กติกาพัก] เพดานพักต่อเว็บ (หลัก+รอง) อัตโนมัติจากตารางหน้าที่ — เช็คจาก DB สดเป็นด่านสุดท้าย
    if (currentUser.check_type !== 'shift' && coverageMap) {
        const cov = window.checkCoverage(currentUser.username, coverageMap, slotBookings);
        if (!cov.ok) {
            window.resetBtn();
            const lines = cov.problems.map(pb => `<b class="text-red-500">${pb.team}</b> มี ${pb.total} คน พักพร้อมกันได้ ${pb.cap} — ตอนนี้พักอยู่แล้ว <b>${pb.used}</b>`).join('<br>');
            return Swal.fire({ icon: 'error', title: `ช่วง ${timeVal} เต็มแล้ว`, html: `${lines}<br><br><span class="text-xs text-gray-500">เลือกช่วงอื่น หรือรอให้เพื่อนในเว็บกลับจากพักก่อน</span>` });
        }
    }

    const { error } = await appDB.from('schedules').insert([{ 
        work_date: dateVal, 
        staff_name: currentUser.username, 
        team: activeTeam, 
        shift_name: sName, 
        time_slot: timeVal,
        department: myDep 
    }]);
    
    if (error) { window.resetBtn(); Swal.fire('Error', error.message, 'error'); }
    else {
        if (typeof logAction === 'function') {
            if (isOffRoster) {
                await logAction('ลงผิดเว็บ',
                    `⚠️ ${currentUser.username} ลง "${activeTeam}" แต่หน้าที่จริง = "${assignedTeamsStr}" (${sName} ${timeVal}) [${myDep}]`
                );
            } else {
                await logAction('ลงเวลา', `ลงเวลา ${sName} ${timeVal} (${activeTeam}) [${myDep}]`);
            }
        }
        Swal.fire({ icon:'success', title:'บันทึกสำเร็จ', timer:800, showConfirmButton:false });
        if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
        if (typeof fetchData === 'function') await fetchData(); // โหลดใหม่ให้ขึ้น ⚠️
        window.resetBtn();
    }
};

window.resetBtn = function() { 
    const btn = document.getElementById('btnSave'); 
    if(btn) {
        btn.disabled = false; 
        btn.innerHTML = '<span class="material-icons">save</span> บันทึกข้อมูล'; 
    }
};

async function manualRefresh() { await fetchData(); const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true }); Toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลแล้ว' }); }

// 🌟 เพิ่มระบบหน่วงเวลาการค้นหาหน้า Dashboard (วางเพิ่มไว้ด้านบน)
let dashboardSearchTimer;

window.debounceDashboardSearch = function() {
    clearTimeout(dashboardSearchTimer);
    dashboardSearchTimer = setTimeout(() => {
        // ใช้ข้อมูลที่ดึงมาแล้ว (globalScheduleData) มากรองแทนการยิง DB ใหม่
        if (typeof renderTableRows === 'function' && globalScheduleData) {
            // ค้นหาแล้วผลลัพธ์ชุดใหม่ ต้องเริ่มที่หน้า 1 เสมอ
            window.resetSchedPage();
        }
    }, 300);
};

function filterTableBySpecificTime(time, shiftName) {
    currentSpecificTimeFilter = { time: time, shift: shiftName };
    document.getElementById('clearFilterBtn').classList.remove('hidden');
    window.resetSchedPage();
}

function clearSpecificTimeFilter() {
    currentSpecificTimeFilter = null;
    document.getElementById('clearFilterBtn').classList.add('hidden');
    window.resetSchedPage();
}

async function fetchData() {
    const dateEl = document.getElementById('wDate');
    const teamEl = document.getElementById('tableTeamFilter');
    
    // 🌟 ดัก Error: ถ้าไม่ได้อยู่หน้า Dashboard และไม่มีช่องให้ดึงค่า ให้หยุดการทำงานเลย
    if (!dateEl || !teamEl) return;

    const dateVal = dateEl.value;
    const tableTeam = teamEl.value;
    if(!dateVal) return;
    await loadAssignmentMapForDate(dateVal); // 🌟 NEW: โหลดตารางจัดหน้าที่ก่อน render

    updateTableSummary([]); 
    const tBody = document.getElementById('dataTableBody');
    if(tBody) tBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400"><span class="animate-spin material-icons text-3xl text-blue-500 mb-2">sync</span><br><b>กำลังดึงข้อมูล...</b></td></tr>`;

    let query = appDB.from('schedules').select('id, work_date, staff_name, team, shift_name, time_slot, department').eq('work_date', dateVal);
    if (tableTeam !== 'all') { query = query.eq('team', tableTeam); }
    const canViewAllShifts = ['manager', 'admin'].includes(currentUser.role) || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('dashboard_view_all_shifts'));
    if (!canViewAllShifts) {
        const userShift = currentUser.allowed_shift;
        if (['กะเช้า', 'กะกลาง', 'กะดึก'].includes(userShift)) {
            query = query.eq('shift_name', userShift);
        } else if (!userShift || userShift === 'all') {
            // 🌟 ถ้าเป็น 'all' หรือไม่ระบุ → กรองตามกะที่เลือกอยู่ในปุ่มกะ
            const checkedShift = document.querySelector('input[name="shift"]:checked');
            if (checkedShift && ['กะเช้า', 'กะกลาง', 'กะดึก'].includes(checkedShift.value)) {
                query = query.eq('shift_name', checkedShift.value);
            }
        }
    }

   const { data } = await query;
    if (data) {
        data.sort((a, b) => {
            const pA = getPeriodForTime(a.shift_name, a.time_slot); const pB = getPeriodForTime(b.shift_name, b.time_slot);
            const pOrder = {'ช่วงที่ 1': 1, 'ช่วงที่ 2': 2, 'ช่วงที่ 3': 3};
            if (pOrder[pA] !== pOrder[pB]) return pOrder[pA] - pOrder[pB];
            return a.time_slot.localeCompare(b.time_slot);
        });
        globalScheduleData = data; 
        
        // 🌟 เพิ่มระบบดึงค่าตัวกรองและส่งข้อมูลไปสรุปยอด
        const deptFilterForSummary = document.getElementById('summaryDeptFilter') ? document.getElementById('summaryDeptFilter').value : 'all';
        let dataForSummary = data;
        if (deptFilterForSummary !== 'all') {
            dataForSummary = data.filter(i => (i.department || 'AM') === deptFilterForSummary);
        }
        
        updateTableSummary(dataForSummary); 
        renderTableRows(data);
    }
}

// ── แบ่งหน้าตารางลงเวลา ──────────────────────────────────────
// ตารางนี้ยาวเป็นร้อยแถวเวลาคนลงเวลาครบทั้งกะ เลื่อนหาคนยาก
// จึงตัดเป็นหน้าละ 20 คน (ปรับได้) — ตัวแปรอยู่นอกฟังก์ชันเพราะ
// renderTableRows ถูกเรียกใหม่ทุกครั้งที่กรองหรือรีเฟรช
let schedRowsPerPage = 20;
let schedCurrentPage = 1;

// เปลี่ยนตัวกรองแล้วต้องเด้งกลับหน้า 1 ไม่งั้นค้างอยู่หน้า 5 ของผลลัพธ์เดิม
// แล้วจะเห็นตารางว่างทั้งที่มีข้อมูล
window.resetSchedPage = function() {
    schedCurrentPage = 1;
    if (typeof globalScheduleData !== 'undefined') renderTableRows(globalScheduleData);
};

window.goSchedPage = function(p) {
    schedCurrentPage = p;
    if (typeof globalScheduleData !== 'undefined') renderTableRows(globalScheduleData);
};

window.setSchedRowsPerPage = function(v) {
    schedRowsPerPage = (v === 'all') ? 'all' : parseInt(v);
    schedCurrentPage = 1;
    if (typeof globalScheduleData !== 'undefined') renderTableRows(globalScheduleData);
};

function renderSchedPagination(total, totalPages, from, to) {
    let box = document.getElementById('schedPaginationControls');
    if (!box) {
        const tbody = document.getElementById('dataTableBody');
        if (!tbody) return;
        const wrap = tbody.closest('table') ? tbody.closest('table').parentElement : null;
        if (!wrap) return;
        wrap.insertAdjacentHTML('afterend',
            `<div id="schedPaginationControls" class="px-4 pb-4 pt-1 flex flex-wrap justify-between items-center gap-3 text-sm text-gray-500 dark:text-gray-400"></div>`);
        box = document.getElementById('schedPaginationControls');
    }

    if (total === 0) { box.innerHTML = ''; return; }

    // โชว์เลขหน้าแบบมีจุดไข่ปลา ไม่งั้น 30 หน้าจะล้นออกนอกจอ
    const nums = [];
    const push = (p) => nums.push(
        `<button onclick="goSchedPage(${p})" class="min-w-[32px] h-8 px-2 rounded-lg font-bold transition ${
            p === schedCurrentPage
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
        }">${p}</button>`);
    const gap = () => nums.push(`<span class="px-1 text-gray-400">…</span>`);

    if (totalPages <= 7) {
        for (let p = 1; p <= totalPages; p++) push(p);
    } else {
        push(1);
        if (schedCurrentPage > 3) gap();
        for (let p = Math.max(2, schedCurrentPage - 1); p <= Math.min(totalPages - 1, schedCurrentPage + 1); p++) push(p);
        if (schedCurrentPage < totalPages - 2) gap();
        push(totalPages);
    }

    const navBtn = (label, page, disabled) =>
        `<button onclick="goSchedPage(${page})" ${disabled ? 'disabled' : ''}
            class="px-3 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 font-bold transition hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">${label}</button>`;

    box.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="font-bold">แสดง</span>
            <select onchange="setSchedRowsPerPage(this.value)" class="bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-700 dark:text-white rounded-lg px-2 py-1 outline-none font-bold cursor-pointer">
                ${[20, 50, 100].map(n => `<option value="${n}" ${schedRowsPerPage === n ? 'selected' : ''}>${n}</option>`).join('')}
                <option value="all" ${schedRowsPerPage === 'all' ? 'selected' : ''}>ทั้งหมด</option>
            </select>
            <span class="whitespace-nowrap">คน/หน้า · รายการที่ <b class="text-slate-700 dark:text-gray-200">${from}-${to}</b> จาก <b class="text-slate-700 dark:text-gray-200">${total}</b></span>
        </div>
        ${totalPages > 1 ? `
        <div class="flex items-center gap-1.5 flex-wrap">
            ${navBtn('◀', schedCurrentPage - 1, schedCurrentPage === 1)}
            ${nums.join('')}
            ${navBtn('▶', schedCurrentPage + 1, schedCurrentPage >= totalPages)}
        </div>` : ''}
    `;
}

function renderTableRows(data) {
    const periodEl = document.getElementById('periodFilter');
    const filterVal = periodEl ? periodEl.value : 'all';

    const searchEl = document.getElementById('tableSearch');
    const searchName = searchEl ? searchEl.value.toLowerCase() : '';

    const deptFilterEl = document.getElementById('tableDeptFilter');
    const deptFilterVal = deptFilterEl ? deptFilterEl.value : 'all';

    // ---- ให้เพิ่ม 2 บรรทัดนี้ต่อท้ายลงไป ----
    const shiftFilterEl = document.getElementById('tableShiftFilter');
    const shiftFilterVal = shiftFilterEl ? shiftFilterEl.value : 'all';
    const box = document.getElementById('dataTableBody'); 
    
    // 🌟 แก้ไขจุดที่ 1: ดัก Error ไว้ตรงนี้ ถ้าหาตารางไม่เจอ ให้หยุดทำงานไปเลย
    if (!box) return; 

    box.innerHTML = '';
    let filteredData = data;
    
    // กรองช่วงเวลา
    if (filterVal !== 'all') filteredData = filteredData.filter(item => getPeriodForTime(item.shift_name, item.time_slot) === filterVal);
    
    // กรองชื่อ
    if (searchName) filteredData = filteredData.filter(i => i.staff_name.toLowerCase().includes(searchName));
    
    // กรองแผนก
    if (deptFilterVal !== 'all') {
        filteredData = filteredData.filter(i => (i.department || 'AM') === deptFilterVal);
    }
    
    // 🌟 กรองกะ (ที่เพิ่มเข้ามาใหม่)
    if (typeof shiftFilterVal !== 'undefined' && shiftFilterVal !== 'all') {
        filteredData = filteredData.filter(i => i.shift_name === shiftFilterVal);
    }
    
    // กรองปุ่มเวลาย่อย
    if (currentSpecificTimeFilter) {
        filteredData = filteredData.filter(i => 
            i.time_slot === currentSpecificTimeFilter.time && 
            i.shift_name === currentSpecificTimeFilter.shift
        );
    }

    if(filteredData.length === 0) {
        box.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>`;
        renderSchedPagination(0, 0, 0, 0);
        return;
    }

    // ── ตัดเป็นหน้า ──
    const total = filteredData.length;
    const perPage = (schedRowsPerPage === 'all') ? total : schedRowsPerPage;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    // กันหน้าค้างเกินขอบ เช่น อยู่หน้า 5 แล้วกรองจนเหลือ 2 หน้า
    if (schedCurrentPage > totalPages) schedCurrentPage = totalPages;
    if (schedCurrentPage < 1) schedCurrentPage = 1;

    const from = (schedCurrentPage - 1) * perPage;
    const pageData = filteredData.slice(from, from + perPage);
    renderSchedPagination(total, totalPages, from + 1, from + pageData.length);

    let htmlContent = '';

    pageData.forEach(i => {
        const periodName = getPeriodForTime(i.shift_name, i.time_slot);
        
        let displayPeriod = periodName || '<span class="material-icons text-[12px] animate-spin">sync</span>';
        let pClass = 'text-gray-500 border-transparent'; 
        
        if (periodName === 'ช่วงที่ 1') pClass = 'text-green-600 dark:text-green-400 border-current'; 
        else if (periodName === 'ช่วงที่ 2') pClass = 'text-orange-500 dark:text-orange-400 border-current'; 
        else if (periodName === 'ช่วงที่ 3') pClass = 'text-purple-600 dark:text-purple-400 border-current';
        else if (!periodName) pClass = 'text-gray-400 border-gray-400/50 border-dashed bg-gray-100 dark:bg-slate-800';
        
        const canDelete = ['manager', 'admin'].includes(currentUser.role) || i.staff_name === currentUser.username;
        let delBtn = canDelete ? `<button onclick="delSch(${i.id}, '${i.shift_name}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 transition"><span class="material-icons text-lg">delete</span></button>` : '';
        
        const deptColor = (i.department === 'OD') ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700';

        htmlContent += `<tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-6 py-4 w-32 text-center"><div class="flex justify-center"><span class="${pClass} font-extrabold text-sm border px-2 py-0.5 rounded-full whitespace-nowrap flex items-center justify-center min-w-[60px] min-h-[28px]">${displayPeriod}</span></div></td>
            <td class="px-6 py-4 font-bold text-slate-700 dark:text-gray-200">${i.staff_name}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-1 flex-wrap">
                    <span class="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-bold">${i.team || '-'}</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${deptColor}">${i.department || 'AM'}</span>
                    ${(() => {
                        // 🌟 เช็ค off-roster ตอน render — ใช้ map ที่โหลดมาแล้ว
                        const assigned = globalAssignmentMap[`${i.staff_name}|${i.shift_name}`];
                        if (assigned) {
                            // มีในตาราง → เช็คว่าตรงเว็บไหม
                            if (assigned.includes(i.team)) return ''; // ตรง OK
                            return `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-500 text-white animate-pulse shadow-sm" title="ควรลง: ${assigned.join('/')}">⚠️ ผิดเว็บ! (ควร: ${assigned.join('/')})</span>`;
                        }
                        // ไม่มีใน map → เช็คว่ากะ+แผนกนี้มีจัดเวรไหม
                        const dept = i.department || 'AM';
                        const deptShiftKey = `${dept}|${i.shift_name}`;
                        if (globalRosterDeptShiftSet.has(deptShiftKey)) {
                            // มีจัดเวรในกะ+แผนกนี้ แต่คนนี้ไม่อยู่ใน roster → flag
                            return `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500 text-white animate-pulse shadow-sm" title="ไม่มีรายชื่อในตารางจัดหน้าที่กะนี้">⚠️ ไม่มีในตารางหน้าที่!</span>`;
                        }
                        // ยังไม่ได้จัดเวรในกะนี้ → ไม่ flag
                        return '';
                    })()}
                </div>
            </td>
            <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-slate-700 dark:bg-slate-600 dark:text-white" style="white-space:nowrap">${i.shift_name}</span></td>
            <td class="px-6 py-4 font-mono text-base text-slate-700 dark:text-gray-300" style="white-space:nowrap">${i.time_slot}</td>
            <td class="px-6 py-4 text-center">${delBtn}</td>
        </tr>`;
    });
    
    // 🌟 แก้ไขจุดที่ 2: เช็คอีกรอบให้ชัวร์ก่อนสั่งยัดข้อมูล
    if (box) box.innerHTML = htmlContent;
}

function updateTableSummary(data) {
    const container = document.getElementById('tableSummary'); 
    if(!container) return;
    container.innerHTML = '';
    const counts = {}; 
    
    data.forEach(item => { 
        const key = `${item.shift_name}|${item.time_slot}`; 
        counts[key] = (counts[key] || 0) + 1; 
    });
    
    let shiftsToShow = ACTIVE_SHIFTS_CONFIG;
    const canViewAllShifts = ['manager', 'admin'].includes(currentUser.role) || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('dashboard_view_all_shifts'));
    if (!canViewAllShifts) {
        const userShift = currentUser.allowed_shift;
        // 🌟 ถ้า allowed_shift เป็น 'all' หรือไม่ระบุ → ใช้กะที่กำลังเลือกอยู่ในปัจจุบันแทน (จากปุ่ม shift)
        if (!userShift || userShift === 'all') {
            const checkedShift = document.querySelector('input[name="shift"]:checked');
            if (checkedShift && ACTIVE_SHIFTS_CONFIG.includes(checkedShift.value)) {
                shiftsToShow = [checkedShift.value];
            }
        } else if (ACTIVE_SHIFTS_CONFIG.includes(userShift)) {
            // ถ้าระบุกะชัดเจน (กะเช้า/กะกลาง/กะดึก) → โชว์เฉพาะกะนั้น
            shiftsToShow = [userShift];
        }
    }

    const pColors = { 'ช่วงที่ 1': 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700', 'ช่วงที่ 2': 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700', 'ช่วงที่ 3': 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' };
    const pTextColors = { 'ช่วงที่ 1': 'text-green-700 dark:text-green-300', 'ช่วงที่ 2': 'text-orange-700 dark:text-orange-300', 'ช่วงที่ 3': 'text-purple-700 dark:text-purple-300' };
    
    let html = '<div class="flex flex-col gap-6 w-full">';
    
    shiftsToShow.forEach(shift => {
        if (!SHIFT_GROUPS[shift]) return; 
        
        const shiftSpecificData = data.filter(d => d.shift_name === shift);
        const uniquePeople = new Set(shiftSpecificData.map(item => item.staff_name));
        const shiftTotal = uniquePeople.size;

        html += `<div class="bg-white/50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
            <div class="font-bold text-sm text-blue-600 dark:text-blue-300 mb-3 border-b border-slate-300 dark:border-slate-500 pb-1 flex justify-between items-center">
                <span>${shift}</span>
                <span class="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs border border-blue-200 dark:border-blue-800 shadow-sm text-slate-600 dark:text-slate-300">
                    รวม <span class="text-blue-600 dark:text-blue-400 font-extrabold text-sm">${shiftTotal}</span> คน
                </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">`;
            
        for (const [periodName, timeSlots] of Object.entries(SHIFT_GROUPS[shift])) {
            const colClass = pColors[periodName] || 'bg-gray-50 dark:bg-gray-800'; 
            const textClass = pTextColors[periodName] || 'text-gray-500';
            html += `<div class="flex flex-col gap-2 p-2 rounded border ${colClass}"><span class="text-[11px] font-extrabold uppercase text-center ${textClass} mb-1">${periodName}</span>`;
            timeSlots.forEach(t => {
                const count = counts[`${shift}|${t}`] || 0; 
                const isActive = currentSpecificTimeFilter && currentSpecificTimeFilter.time === t && currentSpecificTimeFilter.shift === shift;
                const btnClass = count === 0 ? 'btn-slot-empty' : (isActive ? 'btn-slot-active' : 'btn-slot-filled');
                html += `<button onclick="filterTableBySpecificTime('${t}', '${shift}')" class="text-[12px] px-3 py-1.5 rounded border transition flex justify-between items-center shadow-sm w-full group ${btnClass}"><span class="font-mono">${t}</span><span class="font-bold text-[11px]">${count}</span></button>`;
            }); 
            html += `</div>`;
        } 
        html += `</div></div>`;
    }); 
    html += '</div>'; 
    container.innerHTML = html;
}

async function delSch(id, shiftName) {
    const timeCheck = checkBookingTime(shiftName);
    if (!timeCheck.allowed) { return Swal.fire('ลบไม่ได้', timeCheck.msg, 'error'); }

    const { data: item } = await appDB.from('schedules').select('*').eq('id', id).single();
    // 🔒 ลบได้เฉพาะ "ของตัวเอง" หรือเป็นแอดมิน (เกณฑ์เดียวกับที่โชว์ปุ่มถังขยะ)
    if (!item) return Swal.fire('ไม่พบรายการ', 'รายการนี้อาจถูกลบไปแล้ว', 'info');
    const isOwn = item.staff_name === currentUser.username;
    if (!isOwn && !window.sysIsAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'ลบได้เฉพาะรายการของตัวเองครับ', 'error');
    Swal.fire({ title: 'ยืนยันการลบ?', text: "ต้องการลบรายการนี้ใช่ไหม", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย!', cancelButtonText: 'ยกเลิก' }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const { error } = await appDB.from('schedules').delete().eq('id', id); 
            if(error) { Swal.fire('Error', error.message, 'error'); return; }
            if(item) await logAction('ลบรายการ', `ลบรายการของ ${item.staff_name} (${item.shift_name} ${item.time_slot})`);
            Swal.fire('ลบสำเร็จ!', '', 'success'); await refreshTimeSlots(); await fetchData(); 
        }
    })
}

async function logAction(action, detail) { await appDB.from('system_logs').insert([{ action_type: action, performed_by: currentUser.username, target_details: detail }]); }

// (ลบ fetchLogs ตัวสั้นออก — ตัวจริงที่ใช้อยู่คือ window.fetchLogs ใน dashboard.js ซึ่งทับตัวนี้อยู่แล้ว)

async function refreshAdminData() {
    const btn = document.querySelector('button[onclick="refreshAdminData()"] span');
    if(btn) btn.classList.add('animate-spin');

    const isAdmin = currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin');
    const tasks = [fetchUsers(), loadSettings()];
    if (isAdmin) tasks.push(fetchTasks(), fetchIndividualTasks());
    await Promise.all(tasks);

    if(typeof renderQuotaSettings === 'function') renderQuotaSettings();
    if(typeof populateTeamSelects === 'function') populateTeamSelects();
    if(typeof renderOperatingHours === 'function') renderOperatingHours();
    setTimeout(() => { if(btn) btn.classList.remove('animate-spin'); }, 800);
}

window.updateUserRole = async function(selectEl, id, newRole) {
    if (!window.sysRequireAdmin()) return;

    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if(user) user.role = newRole;

    selectEl.classList.remove('text-gray-400', 'text-red-400', 'text-fuchsia-400');
    if (newRole === 'manager' || newRole === 'admin') selectEl.classList.add('text-red-400');
    else if (newRole !== 'staff') selectEl.classList.add('text-fuchsia-400');
    else selectEl.classList.add('text-gray-400');

    appDB.from('users').update({ role: newRole }).eq('id', id).then(({error}) => {
        if (error) Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    });
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: `เปลี่ยนสิทธิ์เป็น ${newRole}` });
}
        
window.updateCheckType = async function(btn, id, currentType) { if (!window.sysRequireAdmin()) return; 
    const newType = currentType === 'shift' ? 'team' : 'shift';
    
    const { error } = await appDB.from('users').update({ check_type: newType }).eq('id', id);

    if (error) {
        return Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    }

    btn.innerText = newType === 'shift' ? 'เน้นกะ' : 'เน้นทีม';
    btn.className = `text-[10px] px-2 py-1 rounded-md font-bold hover:opacity-80 border shadow-inner transition ${newType === 'shift' ? 'bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-800/50' : 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50'}`;
    btn.setAttribute('onclick', `updateCheckType(this, ${id}, '${newType}')`);

    const user = GLOBAL_USER_LIST.find(u => u.id === id);
    if(user) user.check_type = newType;

    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: `เปลี่ยนเป็น${newType === 'shift' ? 'เน้นกะ' : 'เน้นทีม'}แล้ว` });
}

window.updateUserTeam = async function(id, currentTeam) {
    if (!window.sysRequireAdmin()) return;

    let options = {}; TEAM_LIST.forEach(t => options[t] = t); options[''] = 'อิสระ (ไม่สังกัดทีม)';
    const { value: team } = await Swal.fire({ 
        title: 'เปลี่ยนทีมสังกัด', 
        input: 'select', 
        inputOptions: options, 
        inputValue: currentTeam || '', 
        showCancelButton: true, 
        confirmButtonText: 'บันทึก', 
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
    });
    
    if (team !== undefined) { 
        Swal.fire({title: 'กำลังย้ายทีม...', didOpen: () => Swal.showLoading()});
        await appDB.from('users').update({ team: team || null }).eq('id', id); 
        fetchUsers(); 
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }); 
        Toast.fire({ icon: 'success', title: 'เปลี่ยนทีมเรียบร้อย' }); 
    }
}

window.updateUserShift = async function(selectEl, id, newShift) {
    if (!window.sysRequireAdmin()) return;

    selectEl.classList.remove('text-orange-400', 'text-blue-400', 'text-purple-400', 'text-gray-400');
    if(newShift === 'กะเช้า') selectEl.classList.add('text-orange-400');
    else if(newShift === 'กะกลาง') selectEl.classList.add('text-blue-400');
    else if(newShift === 'กะดึก') selectEl.classList.add('text-purple-400');
    else selectEl.classList.add('text-gray-400');

    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if(user) user.allowed_shift = newShift;
    if(typeof fastRecalculateStats === 'function') fastRecalculateStats();

    if (currentUser && String(currentUser.id) === String(id)) {
        currentUser.allowed_shift = newShift;
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser)); 
        
        if (typeof renderShiftButtons === 'function') {
            renderShiftButtons(newShift);
        }
        if (typeof fetchData === 'function') {
            fetchData();
        }
    }

    const { error } = await appDB.from('users').update({ allowed_shift: newShift }).eq('id', id);

    if (error) {
        console.error("Shift Update Error:", error);
        return Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกกะลงฐานข้อมูลได้', 'error');
    }
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: 'อัปเดตกะเรียบร้อย' });
};

function toggleSelectAll(source) { 
    document.querySelectorAll('.user-check').forEach(cb => cb.checked = source.checked); 
}
        
async function moveSelectedUsers() {
    if (!window.sysRequireAdmin()) return;

    const target = document.getElementById('moveTargetShift').value; 
    if(!target) return Swal.fire('!', 'เลือกกะปลายทางก่อน', 'warning');
    
    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); 
    if(ids.length === 0) return Swal.fire('!', 'เลือกพนักงานก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการย้ายกะ?',
        text: `ต้องการย้าย ${ids.length} คน ไปยัง "${target}" ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน ย้ายเลย!',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({ allowed_shift: target }).in('id', ids);
            await logAction('ย้ายกะ', `ย้าย ${ids.length} คน ไป ${target}`);
            fetchUsers(); 
            Swal.fire({ title: 'สำเร็จ!', text: 'ย้ายกะพนักงานเรียบร้อยแล้ว', icon: 'success', confirmButtonText: 'ตกลง' });
        }
    });
}

async function moveSelectedUsersTeam() {
    if (!window.sysRequireAdmin()) return;

    const target = document.getElementById('moveTargetTeam').value; if(!target) return Swal.fire('!', 'เลือกทีมปลายทางก่อน', 'warning');
    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); if(ids.length === 0) return Swal.fire('!', 'เลือกพนักงานก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการย้ายทีม?',
        text: `ต้องการย้าย ${ids.length} คน ไปยังทีม "${target}" ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน ย้ายเลย!',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({ team: target }).in('id', ids);
            await logAction('ย้ายทีม', `ย้าย ${ids.length} คน ไปทีม ${target}`);
            fetchUsers(); 
            Swal.fire({ title: 'สำเร็จ!', text: 'ย้ายทีมพนักงานเรียบร้อยแล้ว', icon: 'success', confirmButtonText: 'ตกลง' });
        }
    });
}

async function deleteSelectedUsers() {
    if (!window.sysRequireAdmin()) return;

    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); 
    if(ids.length === 0) return Swal.fire('!', 'เลือกรายชื่อก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบ ${ids.length} รายชื่อที่เลือกใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').delete().in('id', ids);
            await logAction('ลบพนักงาน', `ลบพนักงาน ${ids.length} คน`);
            fetchUsers(); 
            Swal.fire('ลบสำเร็จ', 'ลบรายชื่อเรียบร้อยแล้ว', 'success');
        }
    });
}

window.searchEmployee = function() {
    userCurrentPage = 1; 
    window.renderUserTableDirectly();
};

async function addScheduledTask() { if (!window.sysRequireAdmin()) return; 
    const f=document.getElementById('schFrom').value, t=document.getElementById('schTo').value, d=document.getElementById('schDate').value; 
    if(!d) return Swal.fire('!', 'กรุณาระบุวันเวลา', 'warning');
    await appDB.from('scheduled_tasks').insert([{task_type:'move_shift', payload:{from:f, to:t}, scheduled_for:new Date(d).toISOString()}]); 
    Swal.fire('OK','ตั้งเวลาย้ายกะแล้ว','success'); fetchTasks(); 
}

async function moveNowInstant() {
    if (!window.sysRequireAdmin()) return;

    const f=document.getElementById('schFrom').value, t=document.getElementById('schTo').value; if(f===t) return Swal.fire('!', 'กะต้นทางและปลายทางเหมือนกัน', 'warning');
    Swal.fire({ title: `ย้ายทันที?`, text: `ย้ายทุกคนจาก "${f}" ไป "${t}" เดี๋ยวนี้เลยไหม?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ย้ายเลย!', cancelButtonText: 'ยกเลิก' }).then(async (result) => {
        if(result.isConfirmed) {
            Swal.fire({title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({allowed_shift: t}).eq('allowed_shift', f);
            await logAction('ย้ายกะด่วน', `ย้ายทุกคนจาก ${f} ไป ${t} (Manual)`);
            fetchUsers(); Swal.fire('สำเร็จ', `ย้ายเรียบร้อยแล้ว`, 'success');
        }
    });
}

// =========================================================