window.initDashboard = async function() {
    // ลองดึงจาก sessionStorage ก่อนเลย ไม่ต้องรอ
    if (!window.currentUser || !window.currentUser.id) {
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser) {
            window.currentUser = JSON.parse(savedUser);
        } else {
            // fallback: รอสั้นๆ เผื่อกำลังโหลดอยู่
            let retry = 0;
            while ((!window.currentUser || !window.currentUser.id) && retry < 10) {
                await new Promise(r => setTimeout(r, 100));
                retry++;
            }
            if (!window.currentUser || !window.currentUser.id) return;
        }
    }

    // 🔄 ดึงข้อมูลตัวเองสดจาก DB ก่อน (เผื่อแอดมินเปลี่ยนกะ/แผนกไประหว่างที่ปิดหน้า)
    if (typeof window.refreshCurrentUserFromDB === 'function') await window.refreshCurrentUserFromDB();

    // อัปเดตข้อมูลพนักงานที่แถบด้านบน
    if (typeof updateDashboardUserInfo === 'function') updateDashboardUserInfo();

    // 🌟🌟🌟 ควบคุมการโชว์ปุ่มเช็คคนยังไม่ลงข้าว 🌟🌟🌟
    const btnCheckMissing = document.getElementById('btnCheckMissingLunch');
    if (btnCheckMissing) {
        const uRole = (window.currentUser.role || '').toLowerCase();
        const uDept = (window.currentUser.department || '');
        // ให้เช็คสิทธิ์ว่ามีสิทธิ์เข้ามาดูเมนูจัดการลางาน หรือจัดการเวรไหม ถ้ามีก็ให้กดดูได้เลย
if (window.hasUserPerm('admin') || window.hasUserPerm('leave_manage_am')) {
    btnCheckMissing.classList.remove('hidden');
}
    }

    // ดึงรายชื่อทีมเข้า Dropdown
    if (typeof populateTeamSelects === 'function') populateTeamSelects();

    // 🟢 บังคับเซ็ตวันที่ให้เป็น "วันนี้" เสมอ (ปรับให้กะดึกข้ามวัน)
    const dInput = document.getElementById('wDate');
    if (dInput) {
        const today = new Date();
        const currentHour = today.getHours(); // ดึงเวลาชั่วโมงปัจจุบัน (0-23)

        // ถ้านาฬิกาอยู่ระหว่างเที่ยงคืน (00:00) ถึงก่อน 8 โมงเช้า (07:59)
        // ให้ปฏิทินถอยกลับไปแสดงเป็นวันที่ของ "เมื่อวาน" อัตโนมัติ
        if (currentHour >= 0 && currentHour < 8) {
            today.setDate(today.getDate() - 1);
        }

        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dInput.value = localDate;
        const displayDate = document.getElementById('displayDate');
        if (displayDate) displayDate.innerText = new Date(localDate).toLocaleDateString('th-TH');
    }

    // 🟢 สร้างปุ่มและ "บังคับเลือกกะให้อัตโนมัติ" ตามสิทธิ์
    if (typeof renderShiftButtons === 'function') renderShiftButtons(window.currentUser.allowed_shift);

    // เช็คระบบ "จำทีมนี้ไว้ตลอด"
    const savedTeam = localStorage.getItem(`last_team_${window.currentUser.username}`);
    const teamSelect = document.getElementById('dailyTeam');
    if (teamSelect) {
        if (savedTeam) {
            teamSelect.value = savedTeam;
            const rememberCb = document.getElementById('rememberTeam');
            if(rememberCb) rememberCb.checked = true;
        } else if (window.currentUser.team) {
            teamSelect.value = window.currentUser.team;
        }
    }

    // โหลดข้อมูลรอบเวลาก่อน แล้วค่อย fetchData
    if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
    if (typeof fetchData === 'function') fetchData();
    // 🏠 [หน้าหลักแบบใหม่] วาดวันนี้ของฉัน + ตารางรวมเปิดไว้ให้แอดมิน/หัวหน้า หรือตามที่เคยเลือกไว้
    try {
        const pref = localStorage.getItem('k36_show_full_table');
        const isBoss = ['manager','admin'].includes((window.currentUser||{}).role);
        if (typeof window.toggleFullTable === 'function') window.toggleFullTable(pref === null ? isBoss : pref === '1');
        if (typeof window.renderMyToday === 'function') window.renderMyToday();
    } catch (e) {}

    // 🌟 เรียกใช้งานระบบ Realtime
    if (typeof subscribeDashboardChanges === 'function') subscribeDashboardChanges();

    // 💬 เริ่มระบบแชทสด
};

window.updateDashboardUserInfo = function() {
    if (!window.currentUser || !window.currentUser.id) return;
    if(document.getElementById('uName')) {
        document.getElementById('uName').innerText = window.currentUser.username || 'Unknown';
    }
    const _uTagEl = document.getElementById('uTagBadge');
    if(_uTagEl) {
        const _tag = window.currentUser.tag;
        _uTagEl.innerHTML = (window.getTagBadge && _tag) ? window.getTagBadge(_tag, currentUser?.department) : '';
    }
    if(document.getElementById('checkTypeDisplay')) document.getElementById('checkTypeDisplay').innerText = (window.currentUser.check_type === 'shift') ? 'เช็คโควตากะ' : 'เช็คโควตาทีม';
    if(document.getElementById('quotaDisplay')) document.getElementById('quotaDisplay').innerText = window.currentUser.department || 'AM';

    if(typeof SETTINGS !== 'undefined') {
        if(document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = SETTINGS.period_limit || 1;
        if(document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = SETTINGS.daily_limit || 2;
    }
};

window.populateTeamSelects = function() {
    const dt = document.getElementById('dailyTeam');
    const tf = document.getElementById('tableTeamFilter');
    const nt = document.getElementById('newTeam');
    const mt = document.getElementById('moveTargetTeam');

    let html = '';
    let fHtml = '<option value="all">-- ทุกเว็บ --</option>';
    let ntHtml = '<option value="">- ไม่ระบุทีม -</option>';

    const sortedTeams = [...(typeof TEAM_LIST !== 'undefined' ? TEAM_LIST : [])].sort((a,b) => a.localeCompare(b));

    sortedTeams.forEach(t => {
        html += `<option value="${t}">${t}</option>`;
        fHtml += `<option value="${t}">${t}</option>`;
        ntHtml += `<option value="${t}">${t}</option>`;
    });

    if(dt) dt.innerHTML = html;
    if(tf) tf.innerHTML = fHtml;
    if(nt) nt.innerHTML = ntHtml;
    if(mt) mt.innerHTML = ntHtml;

    if(dt && window.currentUser && window.currentUser.team) dt.value = window.currentUser.team;
};

window.renderShiftButtons = function(allowedShift) {
    const container = document.getElementById('shiftContainer');
    if (!container) return;
    container.innerHTML = '';

    const shifts = ['กะเช้า', 'กะกลาง', 'กะดึก'];
    let hasChecked = false;

    const userRole = window.currentUser?.role || 'staff';
    const shiftRight = allowedShift || 'all';
    const isAdmin = window.hasUserPerm('ds_manage') || window.hasUserPerm('admin');
    // 🟢 มีสิทธิ์ "ลงเวลาได้ทุกกะ" → ไม่ถูกล็อกแค่กะของตัวเอง
    const canViewAllShifts = isAdmin || window.hasUserPerm('dashboard_view_all_shifts');

    shifts.forEach((s, index) => {
        // 🌟 จุดสำคัญ: ถ้าไม่มีสิทธิ์เห็นทุกกะ และกะนี้ไม่ใช่กะของพนักงานคนนี้ ให้ "ข้าม (return)" ไปเลย
        if (!canViewAllShifts && shiftRight !== 'all' && shiftRight !== s) {
            return;
        }

        let bgClass = 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer';
        let textClass = 'text-gray-700 dark:text-gray-300';
        let borderClass = 'border-gray-200 dark:border-slate-600';

        let isChecked = false;
        if (!hasChecked) {
            if (shiftRight === 'all' || isAdmin) {
                if (index === 0) { isChecked = true; hasChecked = true; }
            } else if (shiftRight === s) {
                isChecked = true; hasChecked = true;
            }
        }

        let icon = s === 'กะเช้า' ? 'wb_sunny' : (s === 'กะกลาง' ? 'cloud' : 'dark_mode');
        let color = s === 'กะเช้า' ? 'text-orange-500' : (s === 'กะกลาง' ? 'text-blue-500' : 'text-purple-500');

        container.innerHTML += `
            <label class="relative flex flex-col items-center p-3 rounded-xl border-2 ${borderClass} ${bgClass} transition shadow-sm">
                <input type="radio" name="shift" value="${s}" class="peer hidden" onchange="refreshTimeSlots(); if(typeof fetchData==='function') fetchData();" ${isChecked ? 'checked' : ''}>
                <span class="material-icons ${color} mb-1 peer-checked:scale-125 transition-transform">${icon}</span>
                <span class="font-bold ${textClass} text-sm">${s}</span>
                <div class="absolute inset-0 border-2 border-transparent peer-checked:border-blue-500 rounded-xl pointer-events-none transition-colors"></div>
                <div class="absolute top-2 right-2 w-3 h-3 rounded-full bg-blue-500 opacity-0 peer-checked:opacity-100 transition-opacity"></div>
            </label>
        `;
    });
};

// debounce timer สำหรับ refreshTimeSlots
let _refreshSlotsTimer = null;
let _refreshSlotsPending = null;   // คำขอที่รออยู่ในรอบ debounce — ผู้เรียกทุกคนใช้ก้อนเดียวกัน

// [FIX] เดิม: clearTimeout ไปฆ่า timer ที่เป็นตัว resolve ของ promise รอบก่อนเอง
// promise นั้นจึงไม่มีวัน resolve → ใครที่ await ค้างถาวร
// (initDashboard ค้างจน fetchData() กับ subscribeDashboardChanges() ไม่ถูกเรียก)
// ตอนนี้รวมคำขอที่ถี่ ๆ เป็นรอบเดียวเหมือนเดิม แต่ผู้เรียกทุกคนได้ผลของรอบที่รันจริง
window.refreshTimeSlots = function() {
    if (!_refreshSlotsPending) {
        let _res;
        const _p = new Promise(r => { _res = r; });
        _refreshSlotsPending = { promise: _p, resolve: _res };
    }
    const _shared = _refreshSlotsPending;
    clearTimeout(_refreshSlotsTimer);
    _refreshSlotsTimer = setTimeout(() => {
        _refreshSlotsPending = null;
        _shared.resolve(_doRefreshTimeSlots().catch(e => { console.error("Refresh Slots Error:", e); }));
    }, 80);
    return _shared.promise;
};

async function _doRefreshTimeSlots() {

    const shiftEl    = document.querySelector('input[name="shift"]:checked');
    const slotSelect = document.getElementById('tSlot');
    const dateEl     = document.getElementById('wDate');
    const teamSelect = document.getElementById('dailyTeam');

    if (!slotSelect) return;
    if (!shiftEl || !dateEl || !dateEl.value) {
        slotSelect.innerHTML = '<option value="">-- กรุณาเลือกกะ/วันทีก่อน --</option>';
        return;
    }

    const shiftName = shiftEl.value;
    const myDep     = window.currentUser?.department || 'AM';
    const dateVal   = dateEl.value;
    const now       = Date.now();

    // ── Roster (⭐ ทีมที่ถูกจัด) — cache 90 วิ ──
    if (teamSelect && !['manager', 'admin'].includes(currentUser.role)) {
        const rosterKey = `duty_roster_${myDep}_${dateVal}_${shiftName}`;
        let assignedTeams = [];
        let coverageMap = null;

        // ใช้ cache ถ้ายัง fresh
        if (_rosterCache[rosterKey] && (now - _rosterCache[rosterKey].ts) < _SLOT_TTL) {
            assignedTeams = _rosterCache[rosterKey].data;
            coverageMap = _rosterCache[rosterKey].covMap || null;
        } else {
            try {
                const { data: rosterData } = await appDB.from('settings').select('value').eq('key', rosterKey).maybeSingle();
                if (rosterData && rosterData.value) {
                    const roster = JSON.parse(rosterData.value);
                    await window.loadBreakMinRemainCfg();   // ⚙️ โหลดค่า "ต้องเหลือเฝ้ากี่คน" (cache ในตัว)
                    coverageMap = window.buildCoverageMap(roster, myDep, shiftName);
                    for (const team in roster) {
                        (roster[team] || []).forEach(u => {
                            if (String(u.id) === String(currentUser.id)) {
                                if (!assignedTeams.includes(team)) assignedTeams.push(team);
                                if (u.secondary_team && !assignedTeams.includes(u.secondary_team)) assignedTeams.push(u.secondary_team);
                            }
                        });
                    }
                }
                _rosterCache[rosterKey] = { data: assignedTeams, covMap: coverageMap, ts: now };
            } catch(e) { console.error(e); }
        }

        window._myAssignedTeams = assignedTeams;
        window._myCoverageMap = coverageMap;

        const oldVal = teamSelect.value;
        const sortedTeams = [...TEAM_LIST].sort((a,b) => a.localeCompare(b));
        let tHtml = '';
        sortedTeams.forEach(t => {
            const isAssigned = assignedTeams.includes(t);
            tHtml += `<option value="${t}">${isAssigned ? `⭐ ${t} (หน้าที่ของคุณ)` : t}</option>`;
        });
        teamSelect.innerHTML = tHtml;

        if (oldVal && sortedTeams.includes(oldVal)) teamSelect.value = oldVal;
        else if (assignedTeams.length > 0) teamSelect.value = assignedTeams[0];
    }

    const selectedTeam = teamSelect ? teamSelect.value : (window.currentUser?.team || '');
    const previousSelectedSlot = slotSelect.value;

    const loadingIcon = document.getElementById('slotLoading');
    if (loadingIcon) loadingIcon.classList.remove('hidden');

    try {
        // ── Slot bookings — cache 90 วิ ──
        const slotCacheKey = `${dateVal}|${shiftName}`;
        let bookings;
        if (_slotCache[slotCacheKey] && (now - _slotCache[slotCacheKey].ts) < _SLOT_TTL) {
            bookings = _slotCache[slotCacheKey].data;
        } else {
            const { data } = await appDB.from('schedules')
                .select('time_slot, department, team, staff_name')
                .eq('work_date', dateVal)
                .eq('shift_name', shiftName);
            bookings = data;
            _slotCache[slotCacheKey] = { data: bookings, ts: now };
        }

        const periods = (typeof SHIFT_GROUPS !== 'undefined' ? SHIFT_GROUPS[shiftName] : {}) || {};
        let html = '<option value="">-- เลือกช่วงเวลา --</option>';

        for (const [periodName, times] of Object.entries(periods)) {
            html += `<optgroup label="--- ${periodName} ---">`;
            times.forEach(time => {
                // 🍽️ [กติกาพัก] เพดานพักต่อเว็บ — อัตโนมัติจากตารางหน้าที่ (หลัก+รอง) + คนที่พักช่วงนี้
                const slotB = (bookings || []).filter(b => b.time_slot === time);
                let isFull = false, statusText = '';
                if (window._myCoverageMap && currentUser.check_type !== 'shift') {
                    const cov = window.checkCoverage(currentUser.username, window._myCoverageMap, slotB);
                    if (!cov.ok) {
                        isFull = true;
                        statusText = `(${cov.problems.map(pb => `${pb.team} เต็ม ${pb.used}/${pb.cap}`).join(', ')})`;
                    } else if (cov.canLeave === Infinity) {
                        statusText = `(ลงแล้ว ${slotB.filter(b => (b.department || 'AM') === myDep).length})`;   // ไม่อยู่ในตารางหน้าที่ → ไม่จำกัด
                    } else {
                        statusText = `(ว่าง: ${cov.canLeave})`;
                    }
                } else {
                    // ยังไม่ได้จัดหน้าที่วันนี้ / ผู้จัดการ → ไม่จำกัด แสดงแค่จำนวนที่ลงแล้ว
                    statusText = `(ลงแล้ว ${slotB.filter(b => (b.department || 'AM') === myDep).length})`;
                }
                html += `<option value="${time}" data-period="${periodName}" ${isFull ? 'disabled class="text-gray-400 bg-gray-100 dark:bg-slate-800"' : 'class="text-blue-600 font-bold dark:text-blue-400"'}>${time} ${statusText}</option>`;
            });
            html += '</optgroup>';
        }
        slotSelect.innerHTML = html;

        if (previousSelectedSlot) {
            const opt = slotSelect.querySelector(`option[value="${previousSelectedSlot}"]`);
            if (opt && !opt.disabled) slotSelect.value = previousSelectedSlot;
        }

    } catch (e) {
        console.error("Refresh Slots Error:", e);
    } finally {
        if (loadingIcon) loadingIcon.classList.add('hidden');
    }
};


// (ลบ openAdminPanel / undoClearSchedules ออกจากไฟล์นี้ — มีตัวเต็มอยู่ใน system_core.js อยู่แล้ว
//  เดิมไฟล์นี้โหลดทีหลังเลย "เขียนทับ" ตัวเต็ม ทำให้การเช็คสิทธิ์แท็บแอดมินและด่านเช็ค admin ไม่เคยทำงาน)
window.switchAdminTab = function(tab) {
    const tabs = ['settings', 'users', 'perms', 'quotalog', 'contacts'];

    tabs.forEach(t => {
        // 1. จัดการปุ่มเมนูด้านบน (เปลี่ยนสี)
        const btn = document.getElementById('btnAdminTab_' + t);
        if (btn) {
            if (t === tab) {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-black transition flex items-center gap-2 bg-amber-500 text-slate-900 shadow-md';
            } else {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
            }
        }

        // 2. จัดการหน้าต่างเนื้อหา (เปิด/ปิด)
        const view = document.getElementById('adminView_' + t);
        if (view) {
            if (t === tab) {
                view.classList.remove('hidden');
                view.classList.add('flex'); // ใช้ flex เพื่อแสดงผล
            } else {
                view.classList.add('hidden');
                view.classList.remove('flex'); // ลบ flex ออกเพื่อซ่อน
            }
        }
    });

    // 🕘 แท็บประวัติโควตา/หน้าที่ → โหลดใหม่ทุกครั้งที่เปิด
    if (tab === 'quotalog' && typeof window.renderQuotaHistory === 'function') window.renderQuotaHistory();
    if (tab === 'contacts' && typeof window.renderHeadContactsEditor === 'function') window.renderHeadContactsEditor();

    // 🌟 เพิ่มโค้ดตรงนี้: บังคับวาดตารางรายชื่อใหม่เสมอเมื่อกดเข้าแท็บ "จัดการพนักงาน"
    if (tab === 'users') {
        if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) {
            if (typeof fetchUsers === 'function') fetchUsers();
        } else {
            if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
            if (typeof fastRecalculateStats === 'function') window.fastRecalculateStats();
        }
    }
};

// 🆕 [ค้นหาแบบพิมพ์แล้วขึ้นเลย] หน่วง 300ms กันยิง DB ทุกตัวอักษร
window._fetchLogsTimer = null;
window.debounceFetchLogs = function() {
    clearTimeout(window._fetchLogsTimer);
    window._fetchLogsTimer = setTimeout(() => { if (typeof fetchLogs === 'function') fetchLogs(); }, 300);
};

window.fetchLogs = async function() {
    const dateVal = document.getElementById('logDate') ? document.getElementById('logDate').value : '';
    const actionVal = document.getElementById('logAction') ? document.getElementById('logAction').value : '';
    const userVal = document.getElementById('logUser') ? document.getElementById('logUser').value.toLowerCase() : '';
    const teamVal = document.getElementById('logTeam') ? document.getElementById('logTeam').value : '';   // 🆕 กรองเว็บ
    const deptVal = document.getElementById('logDept') ? document.getElementById('logDept').value : '';   // 🆕 กรองแผนก

    // ดึงตาราง system_logs จาก Supabase
    let query = appDB.from('system_logs').select('*').order('log_date', {ascending: false});

    if(dateVal) {
        query = query.gte('log_date', dateVal + 'T00:00:00').lte('log_date', dateVal + 'T23:59:59');
    } else {
        query = query.limit(100); // ถ้าไม่เลือกวัน ให้ดึงล่าสุด 100 รายการ
    }

    if(actionVal) query = query.eq('action_type', actionVal);
    // 🆕 กรองเว็บ — log ไม่มีคอลัมน์เว็บแยก แต่รายละเอียดมีชื่อเว็บในวงเล็บเสมอ เช่น "(PG688)" → กรองจากข้อความ
    if(teamVal) query = query.ilike('target_details', `%${teamVal}%`);
    // 🆕 กรองแผนก — รายละเอียดมีแผนกในวงเล็บเหลี่ยมเสมอ เช่น "[OD]" → กรองจากข้อความ (ใส่วงเล็บด้วย กันไปชนกับคำอื่น)
    if(deptVal) query = query.ilike('target_details', `%[${deptVal}]%`);

    const { data, error } = await query;
    const box = document.getElementById('logTableBody');
    if(!box) return;
    box.innerHTML = '';

    if (error) {
        box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-400">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`;
        return;
    }

    if(data && data.length > 0) {
        const filtered = data.filter(log => {
            return (!userVal || (log.performed_by || '').toLowerCase().includes(userVal));
        });

        if(filtered.length === 0) { box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติที่ค้นหา</td></tr>`; return; }

        let logsHtml = '';

        filtered.forEach(log => {
            const time = new Date(log.log_date).toLocaleString('th-TH');
            const badgeColor = log.action_type === 'ลงเวลา' ? 'bg-green-900/50 text-green-400 border-green-700' : ((log.action_type || '').includes('ลบ') ? 'bg-red-900/50 text-red-400 border-red-700' : 'bg-blue-900/50 text-blue-400 border-blue-700');

            logsHtml += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="px-4 py-3 text-xs text-gray-400">${time}</td>
                <td class="px-4 py-3 font-bold text-white">${log.performed_by || '-'}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-[10px] font-bold border ${badgeColor}">${log.action_type || '-'}</span></td>
                <td class="px-4 py-3 text-xs text-gray-300">${log.target_details || ''}</td>
            </tr>`;
        });

        box.innerHTML = logsHtml;

    } else {
        box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติ</td></tr>`;
    }
};

let dashboardSubscription = null;

// Cache สำหรับ roster และ slot bookings — TTL 90 วินาที
const _rosterCache = {};  // key → { data, ts }
const _slotCache   = {};  // "date|shift" → { data, ts }
const _SLOT_TTL    = 90 * 1000;

window.subscribeDashboardChanges = function() {
    if (dashboardSubscription) {
        try { appDB.removeChannel(dashboardSubscription); } catch (e) {}
        dashboardSubscription = null;
    }

    dashboardSubscription = appDB.channel('dashboard-schedules')
        // 🔁 โควตาพัก / ตารางหน้าที่ เปลี่ยน (จากหน้าจัดหน้าที่) → โหลดค่าใหม่ให้ dropdown "ว่าง" ตรงกับจริง
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
            const key = (payload.new && payload.new.key) || (payload.old && payload.old.key) || '';
            if (!key) return;
            if (key.startsWith('quota_') || key.startsWith('mincover_')) {   // (เหลือไว้เผื่อค่าเก่า)
                if (typeof SETTINGS !== 'undefined') SETTINGS[key] = payload.new ? payload.new.value : undefined;
                if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
            } else if (key.startsWith('duty_roster_')) {
                if (typeof _rosterCache !== 'undefined') delete _rosterCache[key];
                if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
            } else if (key === 'break_min_remain') {
                // 🔴 [Realtime] หัวหน้าแก้ค่า "เฝ้า≥" → โหลดค่าใหม่ + วาด dropdown ซ้ำทันที พนักงานไม่ต้องรีเฟรช
                window.loadBreakMinRemainCfg && window.loadBreakMinRemainCfg(true).then(() => {
                    if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
                });
            } else if (key === 'custom_time_slots') {
                // 🔴 [Realtime] หัวหน้าแก้รอบเวลา (AM/OD) → ใช้ชุดใหม่ทันที
                if (typeof SETTINGS !== 'undefined') SETTINGS[key] = payload.new ? payload.new.value : undefined;
                if (typeof window.applyCustomTimeSlots === 'function') window.applyCustomTimeSlots();
                if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
                if (window._lastSummaryData && typeof updateTableSummary === 'function') updateTableSummary(window._lastSummaryData);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
            const mainContent = document.getElementById('mainContentArea');
            if (mainContent && !mainContent.classList.contains('hidden')) {

                const dateEl = document.getElementById('wDate');
                const dateVal = dateEl ? dateEl.value : '';

                // ข้ามถ้าไม่ใช่วันที่กำลังดูอยู่
                if (payload.eventType !== 'DELETE' && payload.new.work_date !== dateVal) return;

                // 🌟 อัปเดตข้อมูลแบบแทรกแถว (ไม่ต้องเรียก fetchData() ให้หมุนๆ แล้ว)
                // ล้าง slot cache เมื่อมีการเปลี่ยนแปลงจาก realtime
                const _rtDate  = payload.new?.work_date || payload.old?.work_date;
                const _rtShift = payload.new?.shift_name || payload.old?.shift_name;
                if (_rtDate && _rtShift) {
                    const _rtKey = `${_rtDate}|${_rtShift}`;
                    if (_slotCache[_rtKey]) delete _slotCache[_rtKey];
                } else if (payload.eventType === 'DELETE') {
                    // 🔴 [FIX เรียลไทม์ตอนลบ] DELETE ส่งข้อมูลมาแค่ id (ไม่มีวัน/กะ) → ล้าง cache ทั้งหมด
                    // ไม่งั้นตัวเลข "ว่าง: X" ใน dropdown จะค้างเก่าจนกว่า cache หมดอายุ/รีเฟรช
                    for (const k in _slotCache) delete _slotCache[k];
                }

                if (payload.eventType === 'INSERT') {
                    const isExist = globalScheduleData.some(item => String(item.id) === String(payload.new.id));
                    if (!isExist) globalScheduleData.push(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    globalScheduleData = globalScheduleData.filter(item => String(item.id) !== String(payload.old.id));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = globalScheduleData.findIndex(item => String(item.id) === String(payload.new.id));
                    if (idx > -1) globalScheduleData[idx] = payload.new;
                }

                // เรียงเวลาใหม่
                globalScheduleData.sort((a, b) => {
                    const pA = getPeriodForTime(a.shift_name, a.time_slot);
                    const pB = getPeriodForTime(b.shift_name, b.time_slot);
                    const pOrder = {'ช่วงที่ 1': 1, 'ช่วงที่ 2': 2, 'ช่วงที่ 3': 3};
                    if (pOrder[pA] !== pOrder[pB]) return (pOrder[pA] || 99) - (pOrder[pB] || 99);

                    const timeA = a.time_slot || "";
                    const timeB = b.time_slot || "";
                    return timeA.localeCompare(timeB);
                });

                // กรองข้อมูลตามสิทธิ์แอดมิน/พนักงาน
                let dataToRender = globalScheduleData;
                const tableTeam = document.getElementById('tableTeamFilter') ? document.getElementById('tableTeamFilter').value : 'all';
                if (tableTeam !== 'all') dataToRender = dataToRender.filter(item => item.team === tableTeam);

                if (typeof currentUser !== 'undefined' && !['manager', 'admin'].includes(currentUser.role)) {
                    if (['กะเช้า', 'กะกลาง', 'กะดึก'].includes(currentUser.allowed_shift)) {
                        dataToRender = dataToRender.filter(item => item.shift_name === currentUser.allowed_shift);
                    }
                }

                const deptFilterForSummary = document.getElementById('summaryDeptFilter') ? document.getElementById('summaryDeptFilter').value : 'all';
                let dataForSummary = dataToRender;
                if (deptFilterForSummary !== 'all') {
                    dataForSummary = dataToRender.filter(i => (i.department || 'AM') === deptFilterForSummary);
                }

                clearTimeout(window.realtimeRenderTimer);
                window.realtimeRenderTimer = setTimeout(() => {
                    if(typeof updateTableSummary === 'function') updateTableSummary(dataForSummary);
                    if(typeof renderTableRows === 'function') renderTableRows(dataToRender);
                    if(typeof refreshTimeSlots === 'function') refreshTimeSlots();
                }, 200);
            }
        }).subscribe();

    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(dashboardSubscription);
};

setTimeout(() => {
    const dInput = document.getElementById('wDate');
    if (dInput) {
        dInput.addEventListener('change', () => {
            if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
            if (typeof fetchData === 'function') fetchData();
        });
    }
}, 1000);

setTimeout(() => {
    const teamInput = document.getElementById('dailyTeam');
    if (teamInput) {
        teamInput.addEventListener('change', () => {
            if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
        });
    }
}, 1000);


window.openLogsPage = async function() {
    if (!document.getElementById('logsPage')) {
        if(typeof showPage === 'function') await showPage('dashboard');
        if(typeof initDashboard === 'function') initDashboard();
    }

    const mainContent = document.getElementById('mainContentArea');
    if (mainContent) mainContent.classList.add('hidden');

    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        adminPanel.classList.add('hidden');
        adminPanel.classList.remove('flex');
    }

    const logsPage = document.getElementById('logsPage');
    if (logsPage) {
        logsPage.classList.remove('hidden');
        logsPage.classList.add('flex');
        // 🆕 เติมรายชื่อเว็บลง dropdown (เติมครั้งเดียว)
        const teamSel = document.getElementById('logTeam');
        if (teamSel && teamSel.options.length <= 1 && typeof TEAM_LIST !== 'undefined') {
            [...TEAM_LIST].sort((a, b) => a.localeCompare(b)).forEach(t => {
                const o = document.createElement('option'); o.value = t; o.textContent = t; teamSel.appendChild(o);
            });
        }
        // 🆕 เปิดหน้ามาให้วันที่เป็น "วันนี้" เลย (ถ้ายังไม่ได้เลือกวันไว้) — ไม่ต้องมานั่งเลือกเอง
        const logDateEl = document.getElementById('logDate');
        if (logDateEl && !logDateEl.value) {
            const t = new Date();
            logDateEl.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        }
        if(typeof fetchLogs === 'function') fetchLogs();
    }
};

window.backToDashboard = function() {
    const logsPage = document.getElementById('logsPage');
    if (logsPage) {
        logsPage.classList.add('hidden');
        logsPage.classList.remove('flex');
    }

    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        adminPanel.classList.add('hidden');
        adminPanel.classList.remove('flex');
    }

    const mainContent = document.getElementById('mainContentArea');
    if (mainContent) {
        mainContent.classList.remove('hidden');
    }

    if(typeof initDashboard === 'function') initDashboard();
};

window.tempMissingStaffData = {};

window.renderMissingList = function() {
    const shiftFilter = document.getElementById('missingShiftFilter').value;
    const deptFilter = document.getElementById('missingDeptFilter').value;
    const container = document.getElementById('missingListContainer');
    if(!container) return;

    let html = '';
    let totalCount = 0;

    const renderList = (shiftName, listKey, colorClass) => {
        let list = window.tempMissingStaffData[listKey] || [];

        if (deptFilter !== 'all') {
            list = list.filter(s => s.dept === deptFilter);
        }

        if (list.length === 0) return '';

        totalCount += list.length;
        // สีพื้นป้ายจำนวนคน: เดิมปั้นชื่อคลาสด้วย .replace() ตอน runtime ซึ่ง Tailwind ไม่ compile ให้ → ใช้ inline style แทน
        const badgeBg = { 'text-orange-500':'rgba(249,115,22,.14)', 'text-blue-500':'rgba(59,130,246,.14)', 'text-purple-500':'rgba(168,85,247,.14)' }[colorClass] || 'rgba(100,116,139,.14)';

        let htmlChunk = `
            <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm mb-3">
                <div class="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="font-black ${colorClass} flex items-center gap-1">${shiftName}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded shadow-inner border border-current opacity-80" style="background:${badgeBg}">${list.length} คน</span>
                </div>
                <div class="flex flex-wrap gap-2">
        `;
        list.forEach(staff => {
            const deptColor = staff.dept === 'OD' ? 'text-pink-600 bg-pink-100 dark:bg-pink-900/30 border-pink-200' : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200';

            const missingBadgeHtml = `<span class="text-[9px] font-black text-red-500 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-1 rounded shadow-sm">ขาด ${staff.missingAmount}</span>`;

            htmlChunk += `<div class="text-xs font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition hover:scale-105 cursor-default hover:border-indigo-400">
                ${staff.name}
                ${missingBadgeHtml}
                <span class="text-[9px] font-black ${deptColor} border px-1 rounded shadow-sm">${staff.dept}</span>
            </div>`;
        });
        htmlChunk += `</div></div>`;
        return htmlChunk;
    };

    if (shiftFilter === 'all' || shiftFilter === 'กะเช้า') html += renderList('☀️ กะเช้า', 'กะเช้า', 'text-orange-500');
    if (shiftFilter === 'all' || shiftFilter === 'กะกลาง') html += renderList('🌤️ กะกลาง', 'กะกลาง', 'text-blue-500');
    if (shiftFilter === 'all' || shiftFilter === 'กะดึก') html += renderList('🌙 กะดึก', 'กะดึก', 'text-purple-500');

    if (html === '') {
        html = '<div class="text-center py-10 text-gray-500 text-sm font-bold bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 mt-2">ไม่พบรายชื่อในเงื่อนไขที่เลือก</div>';
    }

    container.innerHTML = html;

    const countEl = document.getElementById('missingTotalCount');
    if (countEl) countEl.innerText = totalCount;
};

window.checkMissingLunch = async function() {
    const dateVal = document.getElementById('wDate').value;
    if (!dateVal) return Swal.fire('เตือน', 'กรุณาเลือกวันที่ต้องการตรวจสอบก่อนครับ', 'warning');

    Swal.fire({title: 'กำลังสแกนยอดการลงเวลา...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
            if (typeof fetchUsers === 'function') await fetchUsers(true);
        }

        const { data: schedules } = await appDB.from('schedules').select('staff_name').eq('work_date', dateVal);

        const bookingCounts = {};
        if (schedules) {
            schedules.forEach(s => {
                bookingCounts[s.staff_name] = (bookingCounts[s.staff_name] || 0) + 1;
            });
        }

        const { data: leaves } = await appDB.from('leave_requests').select('user_name').eq('leave_date', dateVal);
        const onLeaveNames = (leaves || []).map(l => l.user_name);

        window.tempMissingStaffData = { 'กะเช้า': [], 'กะกลาง': [], 'กะดึก': [] };
        let missingCount = 0;

        const dailyQuota = (typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit) ? parseInt(SETTINGS.daily_limit) : 2;

        GLOBAL_USER_LIST.forEach(u => {
            if (u.role === 'admin' || u.role === 'manager' || u.role === 'trainer') return;
            if (u.department === 'TRAINER' || u.department === 'NEW') return;
            if (!['กะเช้า', 'กะกลาง', 'กะดึก'].includes(u.allowed_shift)) return;

            if (onLeaveNames.includes(u.username)) return;

            const userBookedTimes = bookingCounts[u.username] || 0;

            if (userBookedTimes < dailyQuota) {
                const missingAmt = dailyQuota - userBookedTimes;
                window.tempMissingStaffData[u.allowed_shift].push({
                    name: u.username,
                    dept: u.department || 'AM',
                    missingAmount: missingAmt
                });
                missingCount++;
            }
        });

        if (missingCount === 0) {
            return Swal.fire({ icon: 'success', title: 'ครบทุกคน!', text: 'พนักงานในกะทุกคนลงเวลาครบตามโควตา หรือลาหยุดเรียบร้อยแล้วครับ 🎉', confirmButtonColor: '#3b82f6' });
        }

        const currentShiftEl = document.querySelector('input[name="shift"]:checked');
        const defaultShift = currentShiftEl ? currentShiftEl.value : 'all';

        Swal.fire({
            title: `<div class="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3"><span class="material-icons text-indigo-500 text-3xl">person_search</span> รายชื่อคนที่ยังไม่ลงเวลา (หรือลงไม่ครบ)</div>`,
            html: `
                <div class="text-xs text-gray-500 dark:text-gray-400 text-left mb-3">ระบบคัดกรองพนักงานที่ยังลงเวลา <span class="text-red-500 font-bold underline">ไม่ครบ ${dailyQuota} ครั้ง</span> (รวมที่แสดง: <span id="missingTotalCount" class="text-indigo-500 font-bold">${missingCount}</span> คน)</div>
                <div class="flex gap-2 mb-3 border-b border-gray-100 dark:border-slate-700 pb-3">
                    <select id="missingShiftFilter" onchange="renderMissingList()" class="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-xs font-bold outline-none cursor-pointer shadow-inner focus:border-indigo-500 transition">
                        <option value="all">🌐 ทุกกะ</option>
                        <option value="กะเช้า" ${defaultShift === 'กะเช้า' ? 'selected' : ''}>☀️ กะเช้า</option>
                        <option value="กะกลาง" ${defaultShift === 'กะกลาง' ? 'selected' : ''}>🌤️ กะกลาง</option>
                        <option value="กะดึก" ${defaultShift === 'กะดึก' ? 'selected' : ''}>🌙 กะดึก</option>
                    </select>
                    <select id="missingDeptFilter" onchange="renderMissingList()" class="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-xs font-bold outline-none cursor-pointer shadow-inner focus:border-indigo-500 transition">
                        <option value="all">🏢 ทุกแผนก</option>
                        <option value="AM">เฉพาะ AM</option>
                        <option value="OD">เฉพาะ OD</option>
                    </select>
                </div>
                <div id="missingListContainer" class="text-left max-h-[45vh] overflow-y-auto custom-scrollbar pr-2 pb-2"></div>
            `,
            showCloseButton: true,
            showConfirmButton: false,
            width: '600px',
            customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-[2rem] border border-slate-700 shadow-2xl' },
            didOpen: () => {
                window.renderMissingList();
            }
        });

    } catch (e) {
        console.error("Missing Lunch Error:", e);
        Swal.fire('ข้อผิดพลาด', 'ดึงข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    }
};


// (ลบระบบแชทสด/กล่องข้อความพนักงานออกทั้งชุดแล้ว — เลิกใช้งาน)

// 🔄 [ปุ่มรีเฟรชมือ] กดแล้วดึงตารางกะ + ยอดว่างล่าสุดทันที ไม่ต้องรีโหลดหน้า
// หมายเหตุ: dashboard นี้มี realtime อัตโนมัติอยู่แล้ว (subscribeDashboardChanges)
// ปุ่มนี้ไว้เผื่อกรณีอยากดึงซ้ำมือ/subscription หลุดชั่วคราว
window._manualRefreshBusy = false;
window.manualRefreshDashboard = async function() {
    if (window._manualRefreshBusy) return;
    window._manualRefreshBusy = true;
    const icon = document.getElementById('manualRefreshIcon');
    const btn = document.getElementById('btnManualRefreshDashboard');
    if (icon) icon.classList.add('animate-spin');
    if (btn) btn.style.pointerEvents = 'none';
    try {
        if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
        if (typeof fetchData === 'function') await fetchData();
        if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตข้อมูลล่าสุดแล้ว', showConfirmButton: false, timer: 1400 });
        }
    } catch (e) {
        console.error('manualRefreshDashboard error:', e);
    } finally {
        if (icon) icon.classList.remove('animate-spin');
        if (btn) btn.style.pointerEvents = '';
        window._manualRefreshBusy = false;
    }
};

// ════════════════════════════════════════════════════════════════════
// 🏠 [หน้าหลักแบบใหม่] "วันนี้ของฉัน" — เห็นของตัวเองก่อน: กะ / เว็บที่ทำ / พัก / วันหยุด + ติดต่อหัวหน้า
// ตารางรวม (ใครลงกินข้าว) ซ่อนไว้หลังปุ่ม ฟอร์มลงเวลาพักคอลัมน์ซ้ายไม่แตะ ทำงานเหมือนเดิม
// ════════════════════════════════════════════════════════════════════
const _MT_TH_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const _MT_TH_MON  = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const _mtFmt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return iso || '-'; const d = new Date(+m[1], +m[2]-1, +m[3]); return `${_MT_TH_DAYS[d.getDay()]} ${d.getDate()} ${_MT_TH_MON[d.getMonth()]} ${d.getFullYear()+543}`; };
const _mtEsc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
const _mtMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? (+m[1])*60 + (+m[2]) : null; };

// เวลาเปิด-ปิดของกะ จากตั้งค่าระบบ (open_time_เช้า / close_time_เช้า ...) ถ้าไม่มี ใช้ค่าเริ่มต้น
function _mtShiftHours(shift) {
    const suf = String(shift || '').replace('กะ', '');
    const def = { 'เช้า': ['08:00','20:00'], 'กลาง': ['11:00','23:00'], 'ดึก': ['20:00','08:00'] }[suf] || [null, null];
    const S = (typeof SETTINGS !== 'undefined' && SETTINGS) ? SETTINGS : {};
    return { open: S[`open_time_${suf}`] || def[0], close: S[`close_time_${suf}`] || def[1] };
}
// สถานะ: อยู่ในกะ / ก่อนเข้ากะ / นอกกะ
function _mtShiftStatus(shift) {
    const { open, close } = _mtShiftHours(shift);
    const o = _mtMin(open), c = _mtMin(close);
    if (o === null || c === null) return { label: '-', color: '#64748b', bg: 'rgba(100,116,139,.15)' };
    const now = new Date(); const n = now.getHours()*60 + now.getMinutes();
    const inShift = (o <= c) ? (n >= o && n < c) : (n >= o || n < c);
    if (inShift) return { label: 'อยู่ในกะ', color: '#34d399', bg: 'rgba(52,211,153,.15)' };
    if (o <= c ? n < o : (n >= c && n < o)) return { label: 'ก่อนเข้ากะ', color: '#fbbf24', bg: 'rgba(251,191,36,.15)' };
    return { label: 'นอกกะ', color: '#94a3b8', bg: 'rgba(148,163,184,.15)' };
}
const _mtShiftBadge = (shift) => ({ 'กะเช้า': ['D','#fbbf24','☀️'], 'กะกลาง': ['M','#60a5fa','🌤️'], 'กะดึก': ['N','#a78bfa','🌙'] }[shift] || ['-','#94a3b8','']);

window.renderMyToday = async function() {
    const box = document.getElementById('myTodayPanel');
    if (!box || !window.currentUser) return;
    const me = window.currentUser;
    const dateEl = document.getElementById('wDate');
    const t = new Date();
    const dateVal = (dateEl && dateEl.value) || `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    const myDep = me.department || 'AM';
    const myShift = ['กะเช้า','กะกลาง','กะดึก'].includes(me.allowed_shift) ? me.allowed_shift : (document.querySelector('input[name="shift"]:checked')?.value || '');

    // ── ดึงข้อมูลพร้อมกัน: เว็บที่ทำวันนี้ / พักของฉัน / วันหยุดที่จอง ──
    const rosterKeys = myShift ? [`duty_roster_${myDep}_${dateVal}_${myShift}`] : ['กะเช้า','กะกลาง','กะดึก'].map(s => `duty_roster_${myDep}_${dateVal}_${s}`);
    let rosterRows = [], myBreaks = [], myLeaves = [];
    try {
        const [r1, r2, r3] = await Promise.all([
            appDB.from('settings').select('key, value').in('key', rosterKeys),
            appDB.from('schedules').select('shift_name, time_slot, team').eq('work_date', dateVal).eq('staff_name', me.username),
            appDB.from('leave_requests').select('leave_date, reason').eq('user_id', me.id).gte('leave_date', dateVal).order('leave_date', { ascending: true }).limit(6)
        ]);
        rosterRows = r1.data || []; myBreaks = r2.data || []; myLeaves = r3.data || [];
    } catch (e) { console.warn('renderMyToday:', e); }

    // เว็บที่ได้รับมอบหมาย (หลัก/รอง) จากตารางเวร
    const jobs = [];
    rosterRows.forEach(row => {
        let roster = {}; try { roster = JSON.parse(row.value || '{}'); } catch (e) {}
        const shiftOfKey = row.key.split('_').pop();
        for (const team in roster) (roster[team] || []).forEach(u => {
            if (!u || String(u.username || '').toLowerCase() !== String(me.username).toLowerCase()) return;
            jobs.push({ team, role: 'หลัก', shift: shiftOfKey });
            if (u.secondary_team) jobs.push({ team: u.secondary_team, role: 'รอง', shift: shiftOfKey });
        });
    });

    const dailyLimit = parseInt((typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit) || 2);
    const remain = Math.max(0, dailyLimit - myBreaks.length);
    const sb = _mtShiftBadge(myShift);
    const sh = _mtShiftHours(myShift);
    const st = myShift ? _mtShiftStatus(myShift) : null;

    const card = (icon, iconColor, label, valueHtml, subHtml) => `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 4px;border-bottom:1px solid rgba(148,163,184,.12)">
            <div style="width:44px;height:44px;border-radius:12px;background:${iconColor}22;border:1px solid ${iconColor}55;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span class="material-icons" style="font-size:22px;color:${iconColor}">${icon}</span></div>
            <div style="min-width:0;flex:1">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">${label}</div>
                <div style="font-size:15px;font-weight:800;color:#f1f5f9;line-height:1.35">${valueHtml}</div>
                ${subHtml ? `<div style="font-size:11.5px;color:#94a3b8;margin-top:4px">${subHtml}</div>` : ''}
            </div>
        </div>`;

    // 1) กะของฉัน
    const shiftVal = myShift ? `${sb[2]} ${_mtEsc(myShift)} <span style="font-size:11px;font-weight:700;color:${sb[1]};background:${sb[1]}22;padding:2px 7px;border-radius:6px;margin-left:4px">${sh.open}–${sh.close}</span>` : 'ไม่มีกะ';
    const shiftSub = st ? `<span style="color:${st.color};font-weight:700">● ${st.label}</span>` : '';
    // 2) งานของฉัน
    const jobsVal = jobs.length ? jobs.map(j => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:8px;font-size:13px;background:${j.role==='หลัก'?'rgba(96,165,250,.18)':'rgba(251,191,36,.15)'};color:${j.role==='หลัก'?'#93c5fd':'#fcd34d'};border:1px solid ${j.role==='หลัก'?'rgba(96,165,250,.4)':'rgba(251,191,36,.4)'}">${_mtEsc(j.team)} <span style="font-size:10px;opacity:.8">(${j.role})</span></span>`).join('') : 'ยังไม่มีงานที่ได้รับมอบหมาย';
    const jobsSub = jobs.length ? '' : 'หัวหน้ายังไม่ได้จัดเวรวันนี้ หรือคุณไม่อยู่ในตาราง';
    // 3) พักวันนี้
    const brVal = myBreaks.length
        ? myBreaks.map(b => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:8px;font-size:13px;font-family:monospace;background:rgba(52,211,153,.14);color:#6ee7b7;border:1px solid rgba(52,211,153,.35)">${_mtEsc(b.time_slot)}</span>`).join('')
        : 'ยังไม่ได้เลือกเวลาพัก';
    const brSub = remain > 0
        ? `ยังเลือกได้อีก <b style="color:#fbbf24">${remain}</b> จาก ${dailyLimit} รอบ · <a href="javascript:void(0)" onclick="document.getElementById('btnSave')?.scrollIntoView({behavior:'smooth',block:'center'})" style="color:#60a5fa;font-weight:700;text-decoration:underline">ลงเวลาพักที่ฟอร์มด้านซ้าย →</a>`
        : `ครบ ${dailyLimit} รอบแล้ววันนี้ ✅`;
    // 4) วันหยุดที่จอง
    const lvVal = myLeaves.length
        ? myLeaves.map(l => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:8px;font-size:12.5px;background:rgba(244,114,182,.14);color:#f9a8d4;border:1px solid rgba(244,114,182,.35)">${_mtFmt(l.leave_date)} <span style="font-size:10px;opacity:.85">(${_mtEsc(l.reason || '-')})</span></span>`).join('')
        : 'ยังไม่ได้จองวันหยุด';
    const lvSub = myLeaves.length ? `วันหยุดที่จองไว้ล่วงหน้า ${myLeaves.length} วัน` : `ไปจองได้ที่เมนู <a href="javascript:void(0)" onclick="showPage('leave')" style="color:#60a5fa;font-weight:700;text-decoration:underline">วันหยุด</a>`;

    // ── ติดต่อหัวหน้า: ใช้รายชื่อที่แอดมินตั้งค่าไว้ (ตั้งค่าระบบ → ติดต่อหัวหน้า) ก่อน
    //    ถ้ายังไม่ได้ตั้ง → ดึง manager/admin จากรายชื่อพนักงานอัตโนมัติ (แบบเดิม) ──
    const configured = await window.loadHeadContacts();
    let heads;
    if (configured.length) {
        heads = configured.map(c => ({ username: c.name, department: c.dept || 'AM', role: null, label: c.label || 'หัวหน้า', allowed_shift: c.shift || '', telegram_id: c.telegram, discord_id: c.discord, note: c.note }));
    } else {
        const all = window.GLOBAL_USER_LIST || [];
        heads = all.filter(u => ['manager','admin'].includes(u.role)).map(u => ({ ...u, department: u.role === 'admin' ? 'ทุกแผนก' : (u.department || 'AM') }));
    }
    // 🗂️ จัดกลุ่มตามแผนก: แผนกตัวเองขึ้นก่อน → แผนกอื่น → ผู้จัดการ (ทุกแผนก) ปิดท้าย
    const groupOrder = [myDep, ...['AM','OD'].filter(d => d !== myDep), 'ทุกแผนก'];
    const groupTitle = (d) => d === 'ทุกแผนก' ? '⭐ ผู้จัดการ / ดูแลทุกแผนก' : `👥 หัวหน้า ${d}`;
    const renderOne = (u) => {
        const b = _mtShiftBadge(u.allowed_shift); const h = _mtShiftHours(u.allowed_shift); const s = ['กะเช้า','กะกลาง','กะดึก'].includes(u.allowed_shift) ? _mtShiftStatus(u.allowed_shift) : null;
        const ini = _mtEsc(String(u.username || '?').substring(0,2).toUpperCase());
        const tg = window._tgLink(u.telegram_id);
        const label = u.label || (u.role === 'admin' ? 'ADMIN' : 'หัวหน้า');
        return `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 4px;border-bottom:1px solid rgba(148,163,184,.1)">
            <div style="width:40px;height:40px;border-radius:50%;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#cbd5e1;flex-shrink:0">${ini}</div>
            <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-weight:800;color:#f1f5f9;font-size:14px">${_mtEsc(u.username)}</span>
                    <span style="font-size:10px;color:#94a3b8;background:rgba(148,163,184,.12);padding:1px 7px;border-radius:5px">${_mtEsc(u.department || '-')}</span>
                    <span style="font-size:10px;color:#c084fc;background:rgba(192,132,252,.12);padding:1px 7px;border-radius:5px">${_mtEsc(label)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
                    ${s ? `<span style="font-size:11px;font-weight:700;color:${s.color};background:${s.bg};padding:2px 8px;border-radius:6px">${s.label}</span>` : ''}
                    ${['กะเช้า','กะกลาง','กะดึก'].includes(u.allowed_shift) ? `<span style="font-size:11px;font-weight:900;color:#0f172a;background:${b[1]};padding:1px 6px;border-radius:5px">${b[0]}</span><span style="font-size:12px;color:#cbd5e1;font-family:monospace">${h.open}–${h.close}</span>` : `<span style="font-size:11px;color:#64748b">ทุกกะ</span>`}
                </div>
                ${u.note ? `<div style="font-size:11.5px;color:#94a3b8;margin-top:5px">${_mtEsc(u.note)}</div>` : ''}
                <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;font-size:12px">
                    ${tg ? `<a href="${_mtEsc(tg)}" target="_blank" style="color:#38bdf8;text-decoration:none;display:inline-flex;align-items:center;gap:4px"><span class="material-icons" style="font-size:14px">send</span>${_mtEsc(String(u.telegram_id).startsWith('@') ? u.telegram_id : 'Telegram')}</a>` : `<span style="color:#475569">ไม่มี Telegram</span>`}
                    ${u.discord_id ? `<span style="color:#a78bfa;display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="กดเพื่อก็อป Discord" onclick="navigator.clipboard&&navigator.clipboard.writeText('${_mtEsc(u.discord_id)}');Swal.fire({toast:true,position:'top-end',icon:'success',title:'ก็อป Discord แล้ว',showConfirmButton:false,timer:1500})"><span class="material-icons" style="font-size:14px">content_copy</span>${_mtEsc(u.discord_id)}</span>` : ''}
                </div>
            </div>
        </div>`;
    };
    const groups = groupOrder.map(d => ({ d, items: heads.filter(u => (u.department || 'AM') === d) })).filter(g => g.items.length);
    // แผนกที่ไม่อยู่ในรายการมาตรฐาน (เผื่อมีแผนกเพิ่ม) ต่อท้าย
    heads.filter(u => !groupOrder.includes(u.department || 'AM')).forEach(u => { let g = groups.find(x => x.d === u.department); if (!g) { g = { d: u.department, items: [] }; groups.splice(groups.length - (groups.some(x=>x.d==='ทุกแผนก')?1:0), 0, g); } g.items.push(u); });
    const headRows = groups.map(g => `
        <div style="margin-top:10px;padding:6px 10px;border-radius:9px;background:${g.d === myDep ? 'rgba(96,165,250,.14)' : 'rgba(148,163,184,.08)'};border-left:3px solid ${g.d === myDep ? '#60a5fa' : (g.d === 'ทุกแผนก' ? '#fbbf24' : '#64748b')};font-size:12px;font-weight:800;color:${g.d === myDep ? '#93c5fd' : '#cbd5e1'};display:flex;justify-content:space-between;align-items:center">
            <span>${groupTitle(g.d)}${g.d === myDep ? ' <span style="font-size:10px;font-weight:600;opacity:.8">(แผนกของคุณ)</span>' : ''}</span><span style="font-size:10px;font-weight:600;opacity:.7">${g.items.length} คน</span>
        </div>${g.items.map(renderOne).join('')}`).join('')
        || `<div style="padding:16px;color:#64748b;font-size:12px;text-align:center">ยังไม่ได้ตั้งค่าหัวหน้า — แอดมินตั้งได้ที่ ตั้งค่าระบบ → ติดต่อหัวหน้า</div>`;

    const wrap = (title, icon, bodyHtml, rightHtml) => `
        <div style="background:linear-gradient(165deg,#0f172a,#0b1120);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.3)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px;font-weight:900;font-size:15px;color:#f1f5f9"><span class="material-icons" style="font-size:19px;color:#60a5fa">${icon}</span>${title}</div>
                ${rightHtml || ''}
            </div>
            ${bodyHtml}
        </div>`;

    box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:2px 4px">
            <div>
                <div style="font-size:22px;font-weight:900;color:#f1f5f9">วันนี้</div>
                <div style="font-size:12.5px;color:#94a3b8;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="material-icons" style="font-size:15px">calendar_month</span>${_mtFmt(dateVal)} <span style="color:#475569">|</span> <span style="background:rgba(148,163,184,.12);padding:1px 8px;border-radius:5px;color:#cbd5e1;font-weight:700">${_mtEsc(myDep)}</span>${me.team ? `<span style="background:rgba(96,165,250,.14);padding:1px 8px;border-radius:5px;color:#93c5fd;font-weight:700">${_mtEsc(me.team)}</span>` : ''}</div>
            </div>
            <button onclick="renderMyToday()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6);color:#cbd5e1;font-size:12px;font-weight:700;cursor:pointer"><span class="material-icons" style="font-size:15px">refresh</span>รีเฟรช</button>
        </div>
        ${wrap('วันนี้ของฉัน', 'person', `
            <div style="font-size:11px;color:#64748b;margin-bottom:2px">${_mtEsc(me.username)}</div>
            ${card('schedule', '#60a5fa', 'กะของฉันวันนี้', shiftVal, shiftSub)}
            ${card('work', '#818cf8', 'งานของฉัน (เว็บที่รับผิดชอบ)', jobsVal, jobsSub)}
            ${card('restaurant', '#34d399', 'เวลาพักวันนี้', brVal, brSub)}
            ${card('event_available', '#f472b6', 'วันหยุดที่จองไว้', lvVal, lvSub)}
        `)}
        ${wrap('ช่องทางติดต่อหัวหน้า', 'support_agent', headRows + `<div style="font-size:11px;color:#64748b;padding-top:10px">หากมีปัญหาหรือติดขัด ติดต่อหัวหน้าก่อนเป็นอันดับแรก</div>`, `<span style="font-size:11px;color:#94a3b8">ทั้งหมด ${heads.length} คน</span>`)}
    `;
};

// 📋 เปิด/ปิดตารางรวม (จำค่าไว้ในเครื่อง)
window.toggleFullTable = function(force) {
    const sec = document.getElementById('timeTableSection');
    const icon = document.getElementById('toggleFullTableIcon');
    const label = document.getElementById('toggleFullTableLabel');
    if (!sec) return;
    const show = (typeof force === 'boolean') ? force : sec.classList.contains('hidden');
    sec.classList.toggle('hidden', !show);
    if (icon) icon.textContent = show ? 'expand_less' : 'expand_more';
    if (label) label.textContent = show ? 'ซ่อนตารางลงเวลาทั้งหมด' : 'ดูตารางลงเวลาทั้งหมด (ใครลงกินข้าวกี่โมง)';
    try { localStorage.setItem('k36_show_full_table', show ? '1' : '0'); } catch (e) {}
};

// ════════════════════════════════════════════════════════════════════
// 🎧 [ตั้งค่า] ช่องทางติดต่อหัวหน้า — เก็บใน settings key 'head_contacts' (JSON array)
// แต่ละคน: { name, dept, label, shift, telegram, discord, note }
// ════════════════════════════════════════════════════════════════════
window._headContacts = [];

window.loadHeadContacts = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'head_contacts').maybeSingle();
        window._headContacts = (data && data.value) ? JSON.parse(data.value) : [];
    } catch (e) { window._headContacts = []; }
    if (!Array.isArray(window._headContacts)) window._headContacts = [];
    return window._headContacts;
};

window.renderHeadContactsEditor = async function() {
    const box = document.getElementById('headContactsEditor'); if (!box) return;
    box.innerHTML = '<div class="text-center text-gray-500 text-xs py-6">กำลังโหลด...</div>';
    await window.loadHeadContacts();
    const list = window._headContacts;
    const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
    const depts = ['AM', 'OD', 'ทุกแผนก'];
    const shifts = ['', 'กะเช้า', 'กะกลาง', 'กะดึก'];
    if (!list.length) {
        box.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 border border-dashed border-slate-700 rounded-xl">ยังไม่มีรายชื่อ — กด "เพิ่มคน" เพื่อเริ่ม<br><span class="text-[10px]">(ถ้าไม่ตั้ง ระบบจะดึงแอดมิน/หัวหน้าจากรายชื่อพนักงานให้อัตโนมัติ)</span></div>`;
        return;
    }
    box.innerHTML = `
        <div class="grid text-[10px] text-gray-500 font-bold px-2" style="grid-template-columns:34px 1.2fr .8fr .9fr .9fr 1.2fr 1fr 1.2fr 70px;gap:6px">
            <div>#</div><div>ชื่อที่แสดง</div><div>แผนก</div><div>ตำแหน่ง/ป้าย</div><div>กะ</div><div>Telegram (@ หรือลิงก์)</div><div>Discord ID</div><div>หมายเหตุ</div><div></div>
        </div>` +
        list.map((c, i) => `
        <div class="grid items-center bg-slate-900/60 border border-slate-700 rounded-xl px-2 py-2" style="grid-template-columns:34px 1.2fr .8fr .9fr .9fr 1.2fr 1fr 1.2fr 70px;gap:6px">
            <div class="text-xs text-gray-500 font-bold text-center">${i + 1}</div>
            <input data-f="name" data-i="${i}" value="${esc(c.name || '')}" placeholder="ชื่อ" class="hc-in">
            <select data-f="dept" data-i="${i}" class="hc-in">${depts.map(d => `<option value="${d}" ${(c.dept || 'AM') === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
            <input data-f="label" data-i="${i}" value="${esc(c.label || 'หัวหน้า')}" placeholder="เช่น หัวหน้า AM" class="hc-in">
            <select data-f="shift" data-i="${i}" class="hc-in">${shifts.map(sv => `<option value="${sv}" ${(c.shift || '') === sv ? 'selected' : ''}>${sv || 'ทุกกะ'}</option>`).join('')}</select>
            <input data-f="telegram" data-i="${i}" value="${esc(c.telegram || '')}" placeholder="@username" class="hc-in">
            <input data-f="discord" data-i="${i}" value="${esc(c.discord || '')}" placeholder="Discord ID / ชื่อ" class="hc-in">
            <input data-f="note" data-i="${i}" value="${esc(c.note || '')}" placeholder="เช่น ติดต่อเรื่องเวร" class="hc-in">
            <div class="flex gap-1 justify-end">
                <button onclick="moveHeadContact(${i},-1)" class="text-gray-400 hover:text-white p-1" title="เลื่อนขึ้น"><span class="material-icons text-sm">arrow_upward</span></button>
                <button onclick="moveHeadContact(${i},1)" class="text-gray-400 hover:text-white p-1" title="เลื่อนลง"><span class="material-icons text-sm">arrow_downward</span></button>
                <button onclick="removeHeadContact(${i})" class="text-red-400 hover:text-red-300 p-1" title="ลบ"><span class="material-icons text-sm">delete</span></button>
            </div>
        </div>`).join('') +
        `<style>.hc-in{background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:7px 9px;font-size:12px;outline:none;min-width:0;width:100%}.hc-in:focus{border-color:#fbbf24}</style>`;
    box.querySelectorAll('.hc-in').forEach(el => el.addEventListener('input', () => {
        const i = +el.dataset.i, f = el.dataset.f; if (window._headContacts[i]) window._headContacts[i][f] = el.value;
    }));
    box.querySelectorAll('select.hc-in').forEach(el => el.addEventListener('change', () => {
        const i = +el.dataset.i, f = el.dataset.f; if (window._headContacts[i]) window._headContacts[i][f] = el.value;
    }));
};

window.addHeadContactRow = function() {
    window._headContacts.push({ name: '', dept: (window.currentUser && window.currentUser.department) || 'AM', label: 'หัวหน้า', shift: '', telegram: '', discord: '', note: '' });
    window._renderHeadContactsFromMemory();
};
window.removeHeadContact = function(i) { window._headContacts.splice(i, 1); window._renderHeadContactsFromMemory(); };
window.moveHeadContact = function(i, d) {
    const j = i + d; const L = window._headContacts;
    if (j < 0 || j >= L.length) return;
    [L[i], L[j]] = [L[j], L[i]]; window._renderHeadContactsFromMemory();
};
// วาดใหม่จากข้อมูลในหน่วยความจำ (ไม่โหลดจาก DB ทับของที่กำลังแก้)
window._renderHeadContactsFromMemory = function() {
    const keep = window._headContacts; const orig = window.loadHeadContacts;
    window.loadHeadContacts = async () => keep;
    window.renderHeadContactsEditor().finally(() => { window.loadHeadContacts = orig; });
};

window.saveHeadContacts = async function() {
    const list = (window._headContacts || []).map(c => ({
        name: String(c.name || '').trim(), dept: c.dept || 'AM', label: String(c.label || '').trim() || 'หัวหน้า', shift: c.shift || '',
        telegram: String(c.telegram || '').trim(), discord: String(c.discord || '').trim(), note: String(c.note || '').trim()
    })).filter(c => c.name);
    try {
        await appDB.from('settings').upsert({ key: 'head_contacts', value: JSON.stringify(list) }, { onConflict: 'key' });
        window._headContacts = list;
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `บันทึกแล้ว (${list.length} คน)`, showConfirmButton: false, timer: 2000 });
        window._renderHeadContactsFromMemory();
        if (typeof window.renderMyToday === 'function') window.renderMyToday();
    } catch (e) { Swal.fire('บันทึกไม่สำเร็จ', e.message, 'error'); }
};

// ลิงก์ Telegram จากค่าที่ตั้ง: @name / name / t.me/name / ตัวเลข id
window._tgLink = function(v) {
    v = String(v || '').trim(); if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\d+$/.test(v)) return `tg://user?id=${v}`;
    return `https://t.me/${v.replace(/^@/, '').replace(/^t\.me\//i, '')}`;
};
