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

    // 🏠 [เร็วขึ้น] วาด "วันนี้ของฉัน" ทันทีตั้งแต่ต้น (ขนานกับการโหลดตาราง) ไม่ต้องรอขั้นอื่น
    if (typeof window.renderMyToday === 'function') window.renderMyToday();
    // โหลดข้อมูลรอบเวลาก่อน แล้วค่อย fetchData
    if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
    if (typeof fetchData === 'function') fetchData();

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
            if (key === 'head_contacts' || key.startsWith('open_time_') || key.startsWith('close_time_')) {
                if (typeof SETTINGS !== 'undefined' && key !== 'head_contacts') SETTINGS[key] = payload.new ? payload.new.value : undefined;
                if (key === 'head_contacts') window._headContactsAt = 0;   // ล้าง cache
                window._myTodayRefresh();   // 🏠 รายชื่อหัวหน้า/เวลากะเปลี่ยน
            }
            if (key.startsWith('quota_') || key.startsWith('mincover_')) {   // (เหลือไว้เผื่อค่าเก่า)
                if (typeof SETTINGS !== 'undefined') SETTINGS[key] = payload.new ? payload.new.value : undefined;
                if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
            } else if (key.startsWith('duty_roster_') || key.startsWith('duty_od_rooms_')) {
                if (typeof _rosterCache !== 'undefined') delete _rosterCache[key];
                window._myTodayRefresh();   // 🏠 หัวหน้าจัดเวร/ย้ายเว็บ/เปลี่ยนห้อง OD → งานของฉันเปลี่ยน
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
            // 🏠 พักของฉันเปลี่ยน (ตัวเอง/แอดมินลบ) → อัปเดตแผงวันนี้ของฉัน
            window._myTodayRefresh();
        })
        // 🏠 [realtime วันนี้ของฉัน] วันหยุดของฉันถูกจอง/ยกเลิก/อนุมัติ → อัปเดตทันที
        // 🔄 สลับกะเปลี่ยน (สร้าง/แก้/ยกเลิก) → อัปเดตแผง
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tasks' }, () => { window._myTodayRefresh(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => {
            const uid = String((payload.new && payload.new.user_id) || (payload.old && payload.old.user_id) || '');
            // 🩹 ตอน DELETE สัญญาณส่งมาแค่ id ไม่มี user_id → บอกไม่ได้ว่าของใคร → วาดใหม่เสมอ (ถูกมาก)
            if (!uid || (window.currentUser && uid === String(window.currentUser.id))) window._myTodayRefresh();
        })
        .subscribe();

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
    const _btp = document.getElementById('breakTablePage');
    if (_btp) { _btp.classList.add('hidden'); _btp.classList.remove('flex'); }

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
    const btp = document.getElementById('breakTablePage');
    if (btp) { btp.classList.add('hidden'); btp.classList.remove('flex'); }
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

// 🏠 อัปเดต "วันนี้ของฉัน" แบบหน่วง 400ms (หลาย event ติดกันจะวาดครั้งเดียว) และเฉพาะตอนแผงอยู่บนจอ
window._myTodayTimer = null;
window._myTodayRefresh = function() {
    if (!document.getElementById('myTodayPanel')) return;
    clearTimeout(window._myTodayTimer);
    window._myTodayTimer = setTimeout(() => { if (typeof window.renderMyToday === 'function') window.renderMyToday(); }, 150);
};

// ⏱️ สถานะกะ (อยู่ในกะ/ก่อนเข้ากะ) ขึ้นกับเวลา → เช็คใหม่ทุก 1 นาที (เฉพาะตอนแผงอยู่บนจอ)
if (!window._myTodayClock) window._myTodayClock = setInterval(() => { if (document.getElementById('myTodayPanel')) window._myTodayRefresh(); }, 60000);

// 📅 เปลี่ยนวันที่ของแผงวันนี้ของฉัน (ว่าง = กลับวันนี้)
window.myTodaySetDate = function(v) { window._myTodayDate = v || ''; if (typeof window.renderMyToday === 'function') window.renderMyToday(); };
window.myTodayShift = function(n) {
    const cur = window._myTodayDate || (document.getElementById('myTodayDate') || {}).value || new Date().toISOString().slice(0, 10);
    const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() + n);
    window.myTodaySetDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
};

window._myTodayBusy = false; window._myTodayPending = false;
window.renderMyToday = async function() {
    // ⚡ [กันยิงซ้ำ] ถูกเรียกซ้อนกันหลายจุด → วาดครั้งเดียว ที่เหลือรวมเป็นอีก 1 รอบหลังเสร็จ
    if (window._myTodayBusy) { window._myTodayPending = true; return; }
    window._myTodayBusy = true;
    try { await window._renderMyTodayNow(); }
    finally {
        window._myTodayBusy = false;
        if (window._myTodayPending) { window._myTodayPending = false; setTimeout(() => window.renderMyToday(), 50); }
    }
};
window._renderMyTodayNow = async function() {
    const box = document.getElementById('myTodayPanel');
    if (!box || !window.currentUser) return;
    const me = window.currentUser;
    const dateEl = document.getElementById('wDate');
    const t = new Date();
    const todayIso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    // 📅 วันที่ของแผงนี้เลือกได้เอง (window._myTodayDate) — แยกจากวันที่ฟอร์มลงพักด้านซ้าย
    const dateVal = window._myTodayDate || (dateEl && dateEl.value) || todayIso;
    const isToday = dateVal === todayIso;
    const myDep = me.department || 'AM';
    const myShift = ['กะเช้า','กะกลาง','กะดึก'].includes(me.allowed_shift) ? me.allowed_shift : (document.querySelector('input[name="shift"]:checked')?.value || '');

    // ── ดึงข้อมูลพร้อมกัน: เว็บที่ทำวันนี้ / พักของฉัน / วันหยุดที่จอง ──
    const _yd = new Date(dateVal + 'T00:00:00'); _yd.setDate(_yd.getDate() - 1);
    const ydate = `${_yd.getFullYear()}-${String(_yd.getMonth()+1).padStart(2,'0')}-${String(_yd.getDate()).padStart(2,'0')}`;
    const shiftsToLoad = myShift ? [myShift] : ['กะเช้า','กะกลาง','กะดึก'];
    // วันนี้ + เมื่อวาน (ไว้บอกว่าเมื่อวานทำเว็บไหน)
    const rosterKeys = [...shiftsToLoad.map(s => `duty_roster_${myDep}_${dateVal}_${s}`), ...shiftsToLoad.map(s => `duty_roster_${myDep}_${ydate}_${s}`)];
    // 🎧 [OD] ผังห้อง Discord ของวัน/กะ (settings: duty_od_rooms_{วันที่}_{กะ} = { เว็บ: "ห้อง 1", ... })
    const roomKeys = myDep === 'OD' ? (myShift ? [`duty_od_rooms_${dateVal}_${myShift}`] : ['กะเช้า','กะกลาง','กะดึก'].map(s => `duty_od_rooms_${dateVal}_${s}`)) : [];
    let rosterRows = [], myBreaks = [], myLeaves = [], mySwaps = [];
    try {
        const _swEnd = new Date(dateVal + 'T00:00:00'); _swEnd.setDate(_swEnd.getDate() + 60);
        const [r1, r2, r3, r4] = await Promise.all([
            appDB.from('settings').select('key, value').in('key', [...rosterKeys, ...roomKeys]),
            appDB.from('schedules').select('id, shift_name, time_slot, team').eq('work_date', dateVal).eq('staff_name', me.username),
            appDB.from('leave_requests').select('leave_date, reason').eq('user_id', me.id).gte('leave_date', dateVal.slice(0, 8) + '01').order('leave_date', { ascending: true }).limit(20),   // ทั้งเดือนนี้ + ที่จองล่วงหน้า
            // 🔄 สลับกะของฉัน: ตั้งแต่วันที่ดู ไปอีก 60 วัน (จากหน้าสลับกะ)
            appDB.from('scheduled_tasks').select('payload, scheduled_for, status').eq('task_type', 'individual_shift_update').gte('scheduled_for', dateVal + 'T00:00:00').lte('scheduled_for', _swEnd.toISOString().slice(0,10) + 'T23:59:59').order('scheduled_for', { ascending: true })
        ]);
        rosterRows = r1.data || []; myBreaks = r2.data || []; myLeaves = r3.data || [];
        mySwaps = (r4.data || []).map(t => { let pl = t.payload; if (typeof pl === 'string') { try { pl = JSON.parse(pl); } catch (e) { pl = {}; } } return { ...t, pl: pl || {} }; })
            .filter(t => t.pl && String(t.pl.user_id) === String(me.id) && t.status !== 'cancelled');
    } catch (e) { console.warn('renderMyToday:', e); }

    // เว็บที่ได้รับมอบหมาย (หลัก/รอง) จากตารางเวร
    const jobs = [], jobsY = [];   // วันนี้ / เมื่อวาน
    const roomMaps = {};   // shift -> { team: room }
    rosterRows.filter(r => r.key.startsWith('duty_od_rooms_')).forEach(r => { try { roomMaps[r.key.split('_').pop()] = JSON.parse(r.value || '{}'); } catch (e) {} });
    rosterRows.filter(r => r.key.startsWith('duty_roster_')).forEach(row => {
        let roster = {}; try { roster = JSON.parse(row.value || '{}'); } catch (e) {}
        const parts = row.key.split('_');            // duty_roster_{dept}_{date}_{shift}
        const dateOfKey = parts[3], shiftOfKey = parts[4] || parts.pop();
        const target = dateOfKey === dateVal ? jobs : (dateOfKey === ydate ? jobsY : null);
        if (!target) return;
        const roomOf = (t) => (dateOfKey === dateVal ? (roomMaps[shiftOfKey] || {})[t] : '') || '';
        for (const team in roster) (roster[team] || []).forEach(u => {
            if (!u || String(u.username || '').toLowerCase() !== String(me.username).toLowerCase()) return;
            target.push({ team, role: 'หลัก', shift: shiftOfKey, room: roomOf(team) });
            if (u.secondary_team) target.push({ team: u.secondary_team, role: 'รอง', shift: shiftOfKey, room: roomOf(u.secondary_team) });
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
    // 🔄 วันที่ดูมีสลับกะไหม (target_shift ไม่ใช่ 'คงเดิม') → กะจริงของวันนั้น
    const swapToday = mySwaps.find(t => String(t.scheduled_for || '').slice(0, 10) === dateVal && t.pl.target_shift && t.pl.target_shift !== 'คงเดิม');
    const effShift = swapToday ? swapToday.pl.target_shift : myShift;
    const sbE = _mtShiftBadge(effShift), shE = _mtShiftHours(effShift), stE = effShift ? _mtShiftStatus(effShift) : null;
    const shiftVal = effShift ? `${sbE[2]} ${_mtEsc(effShift)} <span style="font-size:11px;font-weight:700;color:${sbE[1]};background:${sbE[1]}22;padding:2px 7px;border-radius:6px;margin-left:4px">${shE.open}–${shE.close}</span>${swapToday ? ` <span style="font-size:11px;font-weight:800;color:#fb923c;background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.45);padding:2px 8px;border-radius:999px;margin-left:4px">🔄 สลับกะ</span>` : ''}` : 'ไม่มีกะ';
    const shiftSub = (stE ? `<span style="color:${stE.color};font-weight:700">● ${stE.label}</span>` : '') + (swapToday ? ` <span style="color:#94a3b8">· วันนี้สลับจาก <b style="color:#cbd5e1">${_mtEsc(swapToday.pl.from_shift || swapToday.pl.original_shift || myShift || '-')}</b> → <b style="color:#fdba74">${_mtEsc(swapToday.pl.target_shift)}</b>${swapToday.pl.display_desc ? ` (${_mtEsc(swapToday.pl.display_desc)})` : ''}</span>` : '');
    // 2) งานของฉัน
    // 🎧 [OD] ห้องเป็นของ "คน" ตามเว็บหลัก (ไม่ใช่ของแต่ละเว็บ) → โชว์ป้ายเดียวจากงานหลัก
    const mainJob = jobs.find(j => j.role === 'หลัก');
    const roomBadge = (myDep === 'OD' && jobs.length)
        ? (mainJob && mainJob.room
            ? `<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;padding:3px 12px;border-radius:999px;font-size:13px;background:#22c55e;color:#052e16;font-weight:900"><span class="material-icons" style="font-size:14px">headset</span>เข้า ${_mtEsc(mainJob.room)}</span>`
            : `<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;padding:3px 10px;border-radius:999px;font-size:11.5px;color:#94a3b8;background:rgba(148,163,184,.12)"><span class="material-icons" style="font-size:13px">headset_off</span>ยังไม่จัดห้อง</span>`)
        : '';
    const _jobChip = (j, dim) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:${dim?'1px 8px':'3px 10px'};border-radius:8px;font-size:${dim?'11.5px':'13px'};${dim?'opacity:.7;':''}background:${j.role==='หลัก'?'rgba(96,165,250,.18)':'rgba(251,191,36,.15)'};color:${j.role==='หลัก'?'#93c5fd':'#fcd34d'};border:1px solid ${j.role==='หลัก'?'rgba(96,165,250,.4)':'rgba(251,191,36,.4)'}">${_mtEsc(j.team)} <span style="font-size:10px;opacity:.8">(${j.role})</span></span>`;
    const jobsVal = jobs.length ? jobs.map(j => _jobChip(j, false)).join('') : 'ยังไม่มีงานที่ได้รับมอบหมาย';
    // 🎧 ห้อง Discord (OD) — บรรทัดแยก ไม่ปนกับชิปงาน จะได้ไม่ดูเหมือนเป็นเว็บอีกอัน
    const roomLine = (myDep === 'OD' && jobs.length)
        ? `<div style="margin-top:8px"><span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(34,197,94,.10);border:1px dashed rgba(34,197,94,.45)"><span class="material-icons" style="font-size:15px;color:#22c55e">headset_mic</span><span style="font-size:11.5px;color:#94a3b8">Discord</span>${(mainJob && mainJob.room) ? `<b style="color:#4ade80;font-size:13.5px">${_mtEsc(mainJob.room)}</b>` : `<span style="color:#94a3b8;font-size:12px">ยังไม่จัดห้อง</span>`}</span></div>`
        : '';
    // 🕘 เมื่อวานทำอะไร (หลัก/รอง)
    const yLine = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:8px"><span style="font-size:11px;color:#64748b;margin-right:4px"><span class="material-icons" style="font-size:12px;vertical-align:-2px">history</span> เมื่อวาน (${_mtFmt(ydate).replace(/^\S+\s/, '')}):</span>${jobsY.length ? jobsY.map(j => _jobChip(j, true)).join('') : '<span style="font-size:11px;color:#64748b">ไม่มีข้อมูล</span>'}</div>`;
    const jobsSub = (jobs.length ? '' : 'หัวหน้ายังไม่ได้จัดเวรวันนี้ หรือคุณไม่อยู่ในตาราง') + roomLine + yLine;
    // 3) พักวันนี้
    // 🗑️ แต่ละช่วงมีปุ่ม ✕ ลบได้จากตรงนี้ (ใช้ delSch เดิม: เช็คเวลา + ยืนยัน + รีเฟรชฟอร์มให้) แล้วลงใหม่ที่ฟอร์มซ้ายได้เลย
    const brVal = myBreaks.length
        ? myBreaks.map(b => `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 6px 2px 0;padding:3px 4px 3px 10px;border-radius:8px;font-size:13px;font-family:monospace;background:rgba(52,211,153,.14);color:#6ee7b7;border:1px solid rgba(52,211,153,.35)">${_mtEsc(b.time_slot)}<button type="button" onclick="if(typeof delSch==='function') delSch(${b.id}, '${_mtEsc(b.shift_name)}')" title="ลบช่วงนี้ แล้วลงใหม่ได้" style="border:none;background:rgba(239,68,68,.18);color:#f87171;width:20px;height:20px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;line-height:1">✕</button></span>`).join('')
        : 'ยังไม่ได้เลือกเวลาพัก';
    const brSub = remain > 0
        ? `ยังเลือกได้อีก <b style="color:#fbbf24">${remain}</b> จาก ${dailyLimit} รอบ${isToday ? ` · <a href="javascript:void(0)" onclick="document.getElementById('btnSave')?.scrollIntoView({behavior:'smooth',block:'center'})" style="color:#60a5fa;font-weight:700;text-decoration:underline">ลงเวลาพักที่ฟอร์มด้านซ้าย →</a>` : ' <span style="color:#64748b">(ฟอร์มด้านซ้ายลงของวันปัจจุบันเท่านั้น)</span>'}`
        : `ครบ ${dailyLimit} รอบแล้ววันนี้ ✅ · กด ✕ ที่ช่วงที่ต้องการเพื่อลบแล้วลงใหม่`;
    // 4) วันหยุดที่จอง
    // 🎨 ประเภทวันหยุด: ชื่อ + สี ตรงกับปุ่มในหน้าตารางวันหยุด (leave.html)
    const LV_TYPES = {
        X:  { name: 'หยุดปกติ',      bg: '#ef4444', fg: '#fff' },
        XX: { name: 'สลับกะ',        bg: '#facc15', fg: '#713f12' },
        X4: { name: 'ลาครึ่งวัน',    bg: '#ec4899', fg: '#fff' },
        KL: { name: 'ลากิจ/ลาป่วย',  bg: '#22c55e', fg: '#fff' },
        TX: { name: 'สลับวันหยุด',   bg: '#3b82f6', fg: '#fff' },
        PN: { name: 'พักร้อน',       bg: '#92400e', fg: '#fff' },
        KP: { name: 'ขาดงาน',        bg: '#a16207', fg: '#fff' }
    };
    const _lvChip = (l) => {
        const iso = String(l.leave_date || '').slice(0, 10);
        const code = String(l.reason || 'X').toUpperCase();
        const t = LV_TYPES[code] || { name: code, bg: '#64748b', fg: '#fff' };
        const state = iso < dateVal ? 'past' : (iso === dateVal ? 'today' : 'next');
        const dim = state === 'past';
        return `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 8px 3px 0;padding:4px 10px 4px 6px;border-radius:9px;font-size:12.5px;background:rgba(15,23,42,.7);border:1px solid ${dim ? 'rgba(148,163,184,.25)' : t.bg + '88'};${dim ? 'opacity:.55;' : ''}${state === 'today' ? 'box-shadow:0 0 0 2px ' + t.bg + '66;' : ''}" title="${state==='past'?'ผ่านมาแล้ว':state==='today'?'วันนี้':'ยังไม่ถึง'}">
            <span style="background:${t.bg};color:${t.fg};font-weight:900;font-size:11px;padding:2px 7px;border-radius:6px;letter-spacing:.3px">${_mtEsc(code)}</span>
            <span style="color:${dim ? '#94a3b8' : '#f1f5f9'};font-weight:700;${dim ? 'text-decoration:line-through' : ''}">${_mtFmt(iso)}</span>
            <span style="color:${dim ? '#64748b' : t.bg};font-size:11px;font-weight:700">${t.name}</span>${state==='today'?'<b style="font-size:10px;color:#fff;background:'+t.bg+';padding:1px 6px;border-radius:5px">วันนี้</b>':''}
        </span>`;
    };
    const lvPast = myLeaves.filter(l => String(l.leave_date).slice(0,10) < dateVal).length;
    const lvNext = myLeaves.length - lvPast;
    const lvVal = myLeaves.length ? myLeaves.map(_lvChip).join('') : 'ยังไม่ได้จองวันหยุด';
    const lvSub = myLeaves.length
        ? `เดือนนี้ ${myLeaves.length} วัน · ผ่านแล้ว ${lvPast} · ยังไม่ถึง ${lvNext} · <a href="javascript:void(0)" onclick="showPage('leave')" style="color:#60a5fa;font-weight:700;text-decoration:underline">ดู/จองเพิ่ม</a>`
        : `ไปจองได้ที่เมนู <a href="javascript:void(0)" onclick="showPage('leave')" style="color:#60a5fa;font-weight:700;text-decoration:underline">วันหยุด</a>`;

    // ── การ์ดสลับกะ (จากหน้าสลับกะ) ──
    const swapChip = (t) => {
        const d = String(t.scheduled_for || '').slice(0, 10);
        const isD = d === dateVal;
        const to = t.pl.target_shift || '-', from = t.pl.from_shift || t.pl.original_shift || '';
        const stay = to === 'คงเดิม';
        const b = _mtShiftBadge(stay ? from : to);
        return `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 8px 3px 0;padding:4px 10px;border-radius:9px;font-size:12.5px;background:rgba(15,23,42,.7);border:1px solid ${isD ? '#fb923c' : 'rgba(251,146,60,.35)'};${isD ? 'box-shadow:0 0 0 2px rgba(251,146,60,.35);' : ''}">
            <span style="color:#f1f5f9;font-weight:700">${_mtFmt(d)}</span>
            ${stay ? `<span style="color:#94a3b8;font-size:11px">คงเดิม (${_mtEsc(from)})</span>` : `<span style="color:#94a3b8;font-size:11px">${_mtEsc(from || '?')}</span><span style="color:#fb923c;font-weight:900">→</span><span style="background:${b[1]};color:#0f172a;font-weight:900;font-size:11px;padding:1px 7px;border-radius:5px">${_mtEsc(to)}</span>`}
            ${t.pl.display_desc ? `<span style="color:#64748b;font-size:10.5px">${_mtEsc(t.pl.display_desc)}</span>` : ''}${isD ? '<b style="font-size:10px;color:#fff;background:#fb923c;padding:1px 6px;border-radius:5px">วันนี้</b>' : ''}
        </span>`;
    };
    const swVal = mySwaps.length ? mySwaps.map(swapChip).join('') : 'ไม่มีการสลับกะ';
    const swSub = mySwaps.length ? `มี ${mySwaps.length} รายการใน 60 วันข้างหน้า · <a href="javascript:void(0)" onclick="showPage('swap')" style="color:#60a5fa;font-weight:700;text-decoration:underline">ดูหน้าสลับกะ</a>` : `ถ้ามีสลับกะจะขึ้นที่นี่ · <a href="javascript:void(0)" onclick="showPage('swap')" style="color:#60a5fa;font-weight:700;text-decoration:underline">หน้าสลับกะ</a>`;

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
    // 🧱 จัดเป็นคอลัมน์ซ้าย-ขวา (แต่ละแผนก 1 คอลัมน์) — จอแคบพับเป็นคอลัมน์เดียวเอง
    const groupCol = (g) => `
        <div style="min-width:0;background:rgba(15,23,42,.45);border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:4px 10px 6px">
            <div style="margin:6px 0 4px;padding:6px 10px;border-radius:9px;background:${g.d === myDep ? 'rgba(96,165,250,.14)' : 'rgba(148,163,184,.08)'};border-left:3px solid ${g.d === myDep ? '#60a5fa' : (g.d === 'ทุกแผนก' ? '#fbbf24' : '#64748b')};font-size:12px;font-weight:800;color:${g.d === myDep ? '#93c5fd' : '#cbd5e1'};display:flex;justify-content:space-between;align-items:center">
                <span>${groupTitle(g.d)}${g.d === myDep ? ' <span style="font-size:10px;font-weight:600;opacity:.8">(แผนกของคุณ)</span>' : ''}</span><span style="font-size:10px;font-weight:600;opacity:.7">${g.items.length} คน</span>
            </div>${g.items.map(renderOne).join('')}
        </div>`;
    const headRows = groups.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:6px">${groups.map(groupCol).join('')}</div>`
        : `<div style="padding:16px;color:#64748b;font-size:12px;text-align:center">ยังไม่ได้ตั้งค่าหัวหน้า — แอดมินตั้งได้ที่ ตั้งค่าระบบ → ติดต่อหัวหน้า</div>`;

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
                <div style="font-size:22px;font-weight:900;color:#f1f5f9">${isToday ? 'วันนี้' : 'วันที่เลือก'}</div>
                <div style="font-size:12.5px;color:#94a3b8;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="material-icons" style="font-size:15px">calendar_month</span>${_mtFmt(dateVal)} <span style="color:#475569">|</span> <span style="background:rgba(148,163,184,.12);padding:1px 8px;border-radius:5px;color:#cbd5e1;font-weight:700">${_mtEsc(myDep)}</span>${me.team ? `<span style="background:rgba(96,165,250,.14);padding:1px 8px;border-radius:5px;color:#93c5fd;font-weight:700">${_mtEsc(me.team)}</span>` : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
                <button onclick="myTodayShift(-1)" title="วันก่อน" style="width:32px;height:34px;border-radius:9px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6);color:#cbd5e1;cursor:pointer"><span class="material-icons" style="font-size:16px">chevron_left</span></button>
                <input type="date" id="myTodayDate" value="${dateVal}" onchange="myTodaySetDate(this.value)" style="background:rgba(15,23,42,.6);border:1px solid rgba(148,163,184,.25);color:#e2e8f0;border-radius:9px;padding:6px 10px;font-size:12.5px;font-weight:700;min-width:140px">
                <button onclick="myTodayShift(1)" title="วันถัดไป" style="width:32px;height:34px;border-radius:9px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6);color:#cbd5e1;cursor:pointer"><span class="material-icons" style="font-size:16px">chevron_right</span></button>
                ${isToday ? '' : `<button onclick="myTodaySetDate('')" style="padding:7px 10px;border-radius:9px;border:1px solid rgba(232,193,90,.45);background:rgba(232,193,90,.12);color:#E8C15A;font-size:12px;font-weight:800;cursor:pointer">วันนี้</button>`}
            </div>
        </div>
        ${wrap(`วันนี้ของฉัน <span style="font-size:11px;font-weight:600;color:#64748b;margin-left:4px">${_mtEsc(me.username)}</span>`, 'person', `
            ${card('work', '#818cf8', 'งานของฉัน (เว็บที่รับผิดชอบ)', jobsVal, jobsSub)}
            ${card('restaurant', '#34d399', 'เวลาพักวันนี้', brVal, brSub)}
            ${card('event_available', '#f472b6', 'วันหยุดเดือนนี้ + ที่จองล่วงหน้า', lvVal, lvSub)}
            ${card('swap_horiz', '#fb923c', 'สลับกะ', swVal, swSub)}
        `, effShift ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:${sbE[1]}22;border:1px solid ${sbE[1]}66;color:#f1f5f9;font-weight:800;font-size:13px">${sbE[2]} ${_mtEsc(effShift)} <span style="font-size:11px;color:${sbE[1]};font-family:monospace">${shE.open}–${shE.close}</span></span>
                ${stE ? `<span style="font-size:11px;font-weight:800;color:${stE.color};background:${stE.bg};padding:4px 9px;border-radius:999px">● ${stE.label}</span>` : ''}
                ${swapToday ? `<span title="วันนี้สลับจาก ${_mtEsc(swapToday.pl.from_shift || swapToday.pl.original_shift || myShift || '-')} → ${_mtEsc(swapToday.pl.target_shift)}" style="font-size:11px;font-weight:800;color:#fb923c;background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.45);padding:4px 9px;border-radius:999px">🔄 สลับกะ</span>` : ''}
            </div>` : `<span style="font-size:11px;color:#64748b">ไม่มีกะ</span>`)}
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

window._headContactsAt = 0;
window.loadHeadContacts = async function(force) {
    // ⚡ cache 60 วิ (realtime จะล้างให้เมื่อแอดมินแก้)
    if (!force && window._headContactsAt && Date.now() - window._headContactsAt < 60000) return window._headContacts;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'head_contacts').maybeSingle();
        window._headContacts = (data && data.value) ? JSON.parse(data.value) : [];
    } catch (e) { window._headContacts = []; }
    if (!Array.isArray(window._headContacts)) window._headContacts = [];
    window._headContactsAt = Date.now();
    return window._headContacts;
};

window.renderHeadContactsEditor = async function() {
    const box = document.getElementById('headContactsEditor'); if (!box) return;
    box.innerHTML = '<div class="text-center text-gray-500 text-xs py-6">กำลังโหลด...</div>';
    await window.loadHeadContacts(true);
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

// ════════════════════════════════════════════════════════════════════
// 🧹 [ชั่วคราว] ย่อรูปเก่าใน Storage (bucket staff_images) — ทำครบแล้วถอดปุ่มออกได้
//   - ไล่ทุกโฟลเดอร์ที่ใช้: root(แกลเลอรี่) / files / files/covers / fines / logos / sop
//   - ข้าม: ไม่ใช่รูป, thumb_*, รูปที่ ≤ 250KB อยู่แล้ว, สลิป (คนละ bucket ไม่แตะ)
//   - โหลด → ย่อ (compressImageFile) → อัปทับ path เดิม (ลิงก์ไม่เปลี่ยน)
//   - ทำทีละชุด 20 รูป กด "หยุด" ได้ กด "ทำต่อ" จะข้ามที่ทำแล้วเอง (ดูจากขนาด)
// ════════════════════════════════════════════════════════════════════
window._shrinkStop = false;
window.shrinkOldImages = async function() {
    if (!['manager', 'admin'].includes((window.currentUser || {}).role)) return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะแอดมิน', 'error');
    const log = document.getElementById('shrinkOldLog'), btn = document.getElementById('shrinkOldBtn'), stopBtn = document.getElementById('shrinkOldStop');
    const say = (m, cls) => { if (!log) return; log.classList.remove('hidden'); const d = document.createElement('div'); d.textContent = m; if (cls) d.style.color = cls; log.appendChild(d); log.scrollTop = log.scrollHeight; };
    const BUCKET = 'staff_images', FOLDERS = ['', 'files', 'files/covers', 'fines', 'logos', 'sop'], MIN = 250 * 1024, BATCH = 20;
    const OPTS = { '': { maxDim: 1920, quality: 0.85 }, 'files': { maxDim: 2000, quality: 0.85 }, 'files/covers': { maxDim: 1400, quality: 0.8 }, 'fines': { maxDim: 1600, quality: 0.85 }, 'logos': { maxDim: 900, quality: 0.85 }, 'sop': { maxDim: 1600, quality: 0.85 } };
    window._shrinkStop = false; btn.disabled = true; stopBtn.classList.remove('hidden');
    if (log) log.innerHTML = '';
    // 🩹 [กันย่อซ้ำ] จำรูปที่ "ย่อสำเร็จแล้ว" ไว้ในเครื่อง — รอบต่อไปข้ามเลย (ไม่ดูแค่ขนาด เพราะบางรูปย่อแล้วยังเกิน 250KB)
    const DONE_KEY = 'k36_shrink_done_v1';
    let doneSet = new Set(); try { doneSet = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch (e) {}
    const markDone = (path) => { doneSet.add(path); try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneSet])); } catch (e) {} };
    say('🔎 กำลังไล่ดูรายชื่อรูปทั้งหมด...' + (doneSet.size ? ` (เคยทำแล้ว ${doneSet.size} รูป จะข้าม)` : ''));
    // ── list ทุกโฟลเดอร์ (แบ่งหน้า 1000/รอบ) ──
    const targets = [];
    for (const folder of FOLDERS) {
        let offset = 0;
        while (true) {
            const { data, error } = await appDB.storage.from(BUCKET).list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
            if (error) { say(`⚠️ list ${folder || '/'} ไม่ได้: ${error.message}`, '#f87171'); break; }
            (data || []).forEach(o => {
                if (!o.id || !o.metadata) return;                     // โฟลเดอร์
                const size = o.metadata.size || 0, mime = String(o.metadata.mimetype || '');
                if (!mime.startsWith('image/') || mime === 'image/gif' || mime === 'image/svg+xml') return;
                if (o.name.startsWith('thumb_')) return;
                if (size <= MIN) return;                                // เล็กอยู่แล้ว
                const path = (folder ? folder + '/' : '') + o.name;
                if (doneSet.has(path)) return;                          // ✅ ย่อไปแล้ว (จำไว้ในเครื่อง) — ไม่ย่อซ้ำ
                targets.push({ path, size, folder, mime });
            });
            if (!data || data.length < 1000) break;
            offset += 1000;
        }
    }
    const totalMB = targets.reduce((a, t) => a + t.size, 0) / 1024 / 1024;
    say(`📋 พบรูปที่ควรย่อ ${targets.length} รูป รวม ${totalMB.toFixed(1)} MB (ข้ามรูปที่เล็กอยู่แล้ว)`);
    if (!targets.length) { say('✅ ไม่มีรูปเก่าที่ต้องย่อแล้ว — ถอดปุ่มนี้ออกได้เลย', '#4ade80'); btn.disabled = false; stopBtn.classList.add('hidden'); return; }
    let done = 0, saved = 0, fail = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
        if (window._shrinkStop) { say(`⏸️ หยุดตามคำสั่ง — ทำไปแล้ว ${done}/${targets.length} กด "ทำต่อ" เพื่อทำต่อจากตรงนี้`, '#fbbf24'); break; }
        const chunk = targets.slice(i, i + BATCH);
        await Promise.all(chunk.map(async t => {
            try {
                const { data: blob, error: dErr } = await appDB.storage.from(BUCKET).download(t.path);
                if (dErr || !blob) throw new Error(dErr ? dErr.message : 'download ว่าง');
                const file = new File([blob], t.path.split('/').pop(), { type: t.mime });
                const small = await window.compressImageFile(file, OPTS[t.folder] || { maxDim: 1600, quality: 0.85 });
                if (small === file || small.size >= t.size * 0.95) { done++; markDone(t.path); return; }   // ย่อไม่ลง → ปล่อยไว้ + จดว่าดูแล้ว
                const { error: uErr } = await appDB.storage.from(BUCKET).upload(t.path, small, { upsert: true, cacheControl: '3600', contentType: small.type });
                if (uErr) throw new Error(uErr.message);
                done++; saved += (t.size - small.size); markDone(t.path);
                say(`✔ ${t.path}  ${(t.size/1024).toFixed(0)}KB → ${(small.size/1024).toFixed(0)}KB`);
            } catch (e) { fail++; say(`✖ ${t.path}: ${e.message}`, '#f87171'); }
        }));
        say(`— ${Math.min(i + BATCH, targets.length)}/${targets.length} · ประหยัดแล้ว ${(saved/1024/1024).toFixed(1)} MB${fail ? ' · พลาด ' + fail : ''}`, '#93c5fd');
    }
    if (!window._shrinkStop) say(`🎉 เสร็จ: ย่อ ${done} รูป ประหยัด ${(saved/1024/1024).toFixed(1)} MB${fail ? ' (พลาด ' + fail + ' รูป — กด "ทำต่อ" จะลองเฉพาะรูปที่พลาด)' : ' — ครบแล้ว ถอดปุ่มออกได้'}`, '#4ade80');
    btn.disabled = false; stopBtn.classList.add('hidden');
};
