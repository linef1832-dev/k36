window.initDashboard = async function() {
    // ลองดึงจาก sessionStorage ก่อนเลย ไม่ต้องรอ
    if (!window.currentUser) {
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser) {
            window.currentUser = JSON.parse(savedUser);
        } else {
            // fallback: รอสั้นๆ เผื่อกำลังโหลดอยู่
            let retry = 0;
            while (!window.currentUser && retry < 10) {
                await new Promise(r => setTimeout(r, 100));
                retry++;
            }
            if (!window.currentUser) return;
        }
    }

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

    // โหลดข้อมูลรอบเวลาและตารางลงเวลา เพื่อเติมข้อมูลในหน้าจอที่สร้างใหม่
    if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
    if (typeof fetchData === 'function') fetchData();

    // 🌟 เรียกใช้งานระบบ Realtime
    if (typeof subscribeDashboardChanges === 'function') subscribeDashboardChanges();

    // 💬 เริ่มระบบแชทสด
    if (typeof window.initLiveChat === 'function') window.initLiveChat();
};

window.updateDashboardUserInfo = function() {
    if (!window.currentUser) return;
    if(document.getElementById('uName')) document.getElementById('uName').innerText = window.currentUser.username || 'Unknown';
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

window.refreshTimeSlots = async function() {
    const shiftEl = document.querySelector('input[name="shift"]:checked');
    const slotSelect = document.getElementById('tSlot');
    const dateVal = document.getElementById('wDate');
    const teamSelect = document.getElementById('dailyTeam');

    if (!slotSelect) return;
    if (!shiftEl || !dateVal || !dateVal.value) {
        slotSelect.innerHTML = '<option value="">-- กรุณาเลือกกะ/วันทีก่อน --</option>';
        return;
    }

    const shiftName = shiftEl.value;
    const myDep = window.currentUser?.department || 'AM';

    // 🌟 NEW V2: แสดงทุกเว็บใน Dropdown แต่ทำเครื่องหมาย ⭐ เว็บที่ถูกจัดเวร
    if (teamSelect && !['manager', 'admin'].includes(currentUser.role)) {
        const rosterKey = `duty_roster_${myDep}_${dateVal.value}_${shiftName}`;
        let assignedTeams = [];
        try {
            const { data: rosterData } = await appDB.from('settings').select('value').eq('key', rosterKey).maybeSingle();
            if (rosterData && rosterData.value) {
                const roster = JSON.parse(rosterData.value);
                for (const team in roster) {
                    (roster[team] || []).forEach(u => {
                        if (String(u.id) === String(currentUser.id)) {
                            if (!assignedTeams.includes(team)) assignedTeams.push(team);
                            if (u.secondary_team && !assignedTeams.includes(u.secondary_team)) assignedTeams.push(u.secondary_team);
                        }
                    });
                }
            }
        } catch(e) { console.error(e); }

        // เก็บไว้ใช้อ้างอิง
        window._myAssignedTeams = assignedTeams;

        // วาด Dropdown ใหม่ — ทุกเว็บ + ⭐ ทีมที่ถูกจัด
        const oldVal = teamSelect.value;
        const sortedTeams = [...TEAM_LIST].sort((a,b) => a.localeCompare(b));
        let html = '';
        sortedTeams.forEach(t => {
            const isAssigned = assignedTeams.includes(t);
            const label = isAssigned ? `⭐ ${t} (หน้าที่ของคุณ)` : t;
            html += `<option value="${t}">${label}</option>`;
        });
        teamSelect.innerHTML = html;

        // ตั้งค่าเริ่มต้น: คงค่าเดิม → หรือทีมที่ถูกจัด → หรือทีมแรก
        if (oldVal && sortedTeams.includes(oldVal)) {
            teamSelect.value = oldVal;
        } else if (assignedTeams.length > 0) {
            teamSelect.value = assignedTeams[0];
        }
    }

    // 🌟 1. ดึงข้อมูล "เว็บ/ทีม" ที่พนักงานกำลังเลือกอยู่จาก Dropdown
    const selectedTeam = teamSelect ? teamSelect.value : (window.currentUser?.team || '');

    // 💡 [เพิ่มใหม่] ให้ระบบ "จดจำ" ค่าที่พนักงานกำลังเลือกค้างไว้ก่อน
    const previousSelectedSlot = slotSelect.value;

    const loadingIcon = document.getElementById('slotLoading');
    if(loadingIcon) loadingIcon.classList.remove('hidden');

    try {
        // 🌟 2. เพิ่มการดึงคอลัมน์ 'team' มาจากฐานข้อมูลด้วย
        const { data: bookings } = await appDB.from('schedules')
            .select('time_slot, department, team')
            .eq('work_date', dateVal.value)
            .eq('shift_name', shiftName);

        const periods = (typeof SHIFT_GROUPS !== 'undefined' ? SHIFT_GROUPS[shiftName] : {}) || {};

        let html = '<option value="">-- เลือกช่วงเวลา --</option>';

        for (const [periodName, times] of Object.entries(periods)) {
            html += `<optgroup label="--- ${periodName} ---">`;

            times.forEach(time => {
                const myDep = window.currentUser?.department || 'AM';

                // 🌟 3. กรองให้นับเฉพาะคนที่จองใน "เว็บเดียวกัน" เท่านั้น! (b.team === selectedTeam)
                const count = bookings ? bookings.filter(b =>
                    b.time_slot === time &&
                    (b.department || 'AM') === myDep &&
                    b.team === selectedTeam
                ).length : 0;

                const suffix = shiftName.replace('กะ', '');
                let maxQuota = 50; // ค่าเริ่มต้นกันเหนียว
                if(typeof SETTINGS !== 'undefined') {
                    // 🌟 สร้าง Key ค้นหาให้ตรงกับฐานข้อมูล (เช่น quota_team_Jun88_AM_เช้า)
                    const teamQuotaKey = `quota_team_${selectedTeam}_${myDep}_${suffix}`;

                    // 🌟 เช็คว่ามีโควตาทีมนี้ตั้งไว้ไหม ถ้ามีให้ใช้ตัวเลขของทีมนั้นเลย!
                    if (SETTINGS[teamQuotaKey] !== undefined && SETTINGS[teamQuotaKey] !== '') {
                        maxQuota = parseInt(SETTINGS[teamQuotaKey]);
                    } else {
                        // แต่ถ้าไม่ได้ตั้งโควตาทีมไว้ ค่อยดึงโควตารวมแผนกมาใช้แทน
                        maxQuota = myDep === 'OD' ? parseInt(SETTINGS[`quota_od_${suffix}`] || 5) : parseInt(SETTINGS[`quota_total_${suffix}`] || 50);
                    }
                }

                const isFull = count >= maxQuota;
                const statusText = isFull ? '(เต็มแล้ว)' : `(ว่าง: ${maxQuota - count})`;

                html += `<option value="${time}" data-period="${periodName}" ${isFull ? 'disabled class="text-gray-400 bg-gray-100 dark:bg-slate-800"' : 'class="text-blue-600 font-bold dark:text-blue-400"'}>
                            ${time} ${statusText}
                         </option>`;
            });

            html += `</optgroup>`;
        }
        slotSelect.innerHTML = html;

        // 💡 [เพิ่มใหม่] พอกระดานรีเฟรชยอดเสร็จปุ๊บ ก็ยัดค่าเดิมที่จำไว้กลับไปให้ทันที (ถ้าช่องนั้นยังไม่เต็ม)
        if (previousSelectedSlot) {
            const optionToCheck = slotSelect.querySelector(`option[value="${previousSelectedSlot}"]`);
            if (optionToCheck && !optionToCheck.disabled) {
                slotSelect.value = previousSelectedSlot;
            }
        }

    } catch (e) {
        console.error("Refresh Slots Error:", e);
    } finally {
        if(loadingIcon) loadingIcon.classList.add('hidden');
    }

    // 🌟 สั่งอัปเดตตัวเลขแจ้งเตือนคนยังไม่ลงข้าว
    if (typeof updateMissingLunchBadge === 'function') updateMissingLunchBadge();
};

window.openAdminPanel = async function() {
    if (!document.getElementById('adminPanel')) {
        if(typeof showPage === 'function') await showPage('dashboard');
    }

    // ไม่ใช้ setTimeout แล้ว เพื่อให้ตอบสนองทันที
    if(document.getElementById('mainContentArea')) document.getElementById('mainContentArea').classList.add('hidden');
    if(document.getElementById('adminPanel')) {
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('flex');
    }
    switchAdminTab('settings');
};

window.switchAdminTab = function(tab) {
    const tabs = ['settings', 'users', 'perms', 'info'];

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

window.fetchLogs = async function() {
    const dateVal = document.getElementById('logDate') ? document.getElementById('logDate').value : '';
    const actionVal = document.getElementById('logAction') ? document.getElementById('logAction').value : '';
    const userVal = document.getElementById('logUser') ? document.getElementById('logUser').value.toLowerCase() : '';

    // ดึงตาราง system_logs จาก Supabase
    let query = appDB.from('system_logs').select('*').order('log_date', {ascending: false});

    if(dateVal) {
        query = query.gte('log_date', dateVal + 'T00:00:00').lte('log_date', dateVal + 'T23:59:59');
    } else {
        query = query.limit(100); // ถ้าไม่เลือกวัน ให้ดึงล่าสุด 100 รายการ
    }

    if(actionVal) query = query.eq('action_type', actionVal);

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
            return (!userVal || log.performed_by.toLowerCase().includes(userVal));
        });

        if(filtered.length === 0) { box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติที่ค้นหา</td></tr>`; return; }

        let logsHtml = '';

        filtered.forEach(log => {
            const time = new Date(log.log_date).toLocaleString('th-TH');
            const badgeColor = log.action_type === 'ลงเวลา' ? 'bg-green-900/50 text-green-400 border-green-700' : (log.action_type.includes('ลบ') ? 'bg-red-900/50 text-red-400 border-red-700' : 'bg-blue-900/50 text-blue-400 border-blue-700');

            logsHtml += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="px-4 py-3 text-xs text-gray-400">${time}</td>
                <td class="px-4 py-3 font-bold text-white">${log.performed_by}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-[10px] font-bold border ${badgeColor}">${log.action_type}</span></td>
                <td class="px-4 py-3 text-xs text-gray-300">${log.target_details}</td>
            </tr>`;
        });

        box.innerHTML = logsHtml;

    } else {
        box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติ</td></tr>`;
    }
};

let dashboardSubscription = null;

window.subscribeDashboardChanges = function() {
    if (dashboardSubscription) {
        try { appDB.removeChannel(dashboardSubscription); } catch (e) {}
        dashboardSubscription = null;
    }

    dashboardSubscription = appDB.channel('dashboard-schedules')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
            const mainContent = document.getElementById('mainContentArea');
            if (mainContent && !mainContent.classList.contains('hidden')) {

                const dateEl = document.getElementById('wDate');
                const dateVal = dateEl ? dateEl.value : '';

                // ข้ามถ้าไม่ใช่วันที่กำลังดูอยู่
                if (payload.eventType !== 'DELETE' && payload.new.work_date !== dateVal) return;

                // 🌟 อัปเดตข้อมูลแบบแทรกแถว (ไม่ต้องเรียก fetchData() ให้หมุนๆ แล้ว)
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

window.undoClearSchedules = async function() {
    const backupStr = sessionStorage.getItem('temp_schedule_backup');
    if (!backupStr) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลให้กู้คืนแล้วครับ', 'error');

    const backupData = JSON.parse(backupStr);
    const confirm = await Swal.fire({
        title: 'ยืนยันการกู้คืน?',
        text: `คุณต้องการกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ ที่เพิ่งลบทิ้งไปใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, นำข้อมูลกลับมา!',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
    });

    if (confirm.isConfirmed) {
        Swal.fire({title: 'กำลังกู้คืนข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            const { error } = await appDB.from('schedules').insert(backupData);
            if (error) throw error;

            sessionStorage.removeItem('temp_schedule_backup');
            document.getElementById('undoScheduleBtn')?.classList.add('hidden');

            if (typeof logAction === 'function') await logAction('กู้คืนข้อมูล', `แอดมินกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ`);

            Swal.fire('กู้คืนสำเร็จ!', 'ข้อมูลกลับมาอยู่ที่เดิมเรียบร้อยแล้วครับ', 'success');

            if (typeof fetchData === 'function') fetchData();

        } catch(e) {
            console.error(e);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถกู้คืนได้: ' + e.message, 'error');
        }
    }
};

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

        let htmlChunk = `
            <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm mb-3">
                <div class="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="font-black ${colorClass} flex items-center gap-1">${shiftName}</span>
                    <span class="text-[10px] font-bold ${colorClass.replace('text-', 'bg-').replace('-500', '-100')} ${colorClass.replace('text-', 'dark:bg-').replace('-500', '-900/30')} px-2 py-0.5 rounded shadow-inner border border-current opacity-80">${list.length} คน</span>
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

window.updateMissingLunchBadge = async function() {
    const badge = document.getElementById('missingLunchBadge');
    const btn = document.getElementById('btnCheckMissingLunch');

    if (!badge || !btn || btn.classList.contains('hidden')) return;

    const dateVal = document.getElementById('wDate').value;
    if (!dateVal) return;

    try {
        if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) return;

        const { data: schedules } = await appDB.from('schedules').select('staff_name').eq('work_date', dateVal);
        const bookingCounts = {};
        if (schedules) schedules.forEach(s => { bookingCounts[s.staff_name] = (bookingCounts[s.staff_name] || 0) + 1; });

        const { data: leaves } = await appDB.from('leave_requests').select('user_name').eq('leave_date', dateVal);
        const onLeaveNames = (leaves || []).map(l => l.user_name);

        const currentShiftEl = document.querySelector('input[name="shift"]:checked');
        const targetShift = currentShiftEl ? currentShiftEl.value : (window.currentUser?.allowed_shift || 'กะเช้า');

        const dailyQuota = (typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit) ? parseInt(SETTINGS.daily_limit) : 2;
        let missingCount = 0;

        GLOBAL_USER_LIST.forEach(u => {
            if (['admin', 'manager', 'trainer'].includes(u.role) || u.department === 'TRAINER' || u.department === 'NEW') return;
            if (onLeaveNames.includes(u.username)) return;

            if (u.allowed_shift !== targetShift) return;

            const userBookedTimes = bookingCounts[u.username] || 0;
            if (userBookedTimes < dailyQuota) missingCount++;
        });

        if (missingCount > 0) {
            badge.innerText = missingCount;
            badge.classList.remove('hidden');
            badge.classList.add('animate-pulse');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('animate-pulse');
        }
    } catch (e) {
        console.error("Badge Update Error:", e);
    }
};

// ==========================================
// 💬 ระบบแชทสด (Live Chat) - Modal Version
// ==========================================

window._chatSubscription = null;
window._chatMessages     = [];
window._chatUnreadCount  = 0;

// ── เปิด Modal ──────────────────────────
window.openChatModal = function() {
    const modal = document.getElementById('chatModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // reset unread
    window._chatUnreadCount = 0;
    const badge = document.getElementById('chatUnreadBadge');
    if (badge) badge.classList.add('hidden');
    // scroll ลงล่าง
    const box = document.getElementById('chatMessagesBox');
    if (box) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
    // focus input
    setTimeout(() => { const inp = document.getElementById('chatInput'); if(inp) inp.focus(); }, 100);
};

// ── ปิด Modal ───────────────────────────
window.closeChatModal = function() {
    const modal = document.getElementById('chatModal');
    if (modal) modal.classList.add('hidden');
};

// ── โหลดข้อความล่าสุด 50 รายการ ──────
async function fetchChatMessages() {
    if (!appDB) return;
    try {
        const { data, error } = await appDB
            .from('live_chat')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        window._chatMessages = (data || []).reverse();
        renderChatMessages();
    } catch (e) { console.error('fetchChatMessages:', e); }
}

// ── วาดข้อความ ──────────────────────────
function renderChatMessages() {
    const inner = document.getElementById('chatMsgsInner');
    const empty = document.getElementById('chatEmptyState');
    if (!inner) return;

    const msgs = window._chatMessages || [];
    if (msgs.length === 0) {
        inner.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const myName    = (window.currentUser || {}).username || '';

    inner.innerHTML = msgs.map(m => {
        const isMe      = m.username === myName;
        const isManager = ['admin', 'manager'].includes(m.role || '');
        const ts        = new Date(m.created_at);
        const timeStr   = ts.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const roleBadge = isManager
            ? `<span class="text-[10px] font-black text-yellow-400 bg-yellow-900/40 px-1.5 py-0.5 rounded-md">⭐ หัวหน้า</span>`
            : '';

        if (isMe) return `
            <div class="flex justify-end mb-1">
                <div class="max-w-[75%] flex flex-col items-end gap-0.5">
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <span>${timeStr}</span>
                        <span class="font-bold text-blue-400">${m.username}</span>
                        ${roleBadge}
                    </div>
                    <div class="bg-blue-600 text-white text-sm px-3 py-2 rounded-2xl rounded-tr-sm break-words">${escChat(m.message)}</div>
                </div>
            </div>`;

        return `
            <div class="flex justify-start mb-1">
                <div class="max-w-[75%] flex flex-col items-start gap-0.5">
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                        ${roleBadge}
                        <span class="font-bold ${isManager ? 'text-yellow-300' : 'text-emerald-400'}">${m.username}</span>
                        <span>${timeStr}</span>
                    </div>
                    <div class="${isManager ? 'bg-yellow-900/40 border border-yellow-700/50' : 'bg-slate-700'} text-white text-sm px-3 py-2 rounded-2xl rounded-tl-sm break-words">${escChat(m.message)}</div>
                </div>
            </div>`;
    }).join('');

    const box = document.getElementById('chatMessagesBox');
    if (box) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function escChat(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ส่งข้อความ ──────────────────────────
window.sendChatMessage = async function() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    input.value    = '';
    input.disabled = true;
    try {
        const user = window.currentUser || {};
        const { error } = await appDB.from('live_chat').insert([{
            username:   user.username   || 'Unknown',
            role:       user.role       || 'user',
            department: user.department || '-',
            message:    msg
        }]);
        if (error) throw error;
    } catch (e) {
        Swal.fire('Error', 'ส่งข้อความไม่สำเร็จ: ' + e.message, 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
};

// ── Realtime Subscribe ───────────────────
function subscribeLiveChat() {
    if (!appDB) return;
    if (window._chatSubscription) {
        try { appDB.removeChannel(window._chatSubscription); } catch(e) {}
    }

    window._chatSubscription = appDB.channel('live-chat-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat' }, (payload) => {
            const m = payload.new;
            if (!m) return;
            if ((window._chatMessages || []).some(x => x.id === m.id)) return;
            window._chatMessages = [...(window._chatMessages || []), m].slice(-50);
            renderChatMessages();

            // แจ้งเตือนถ้า modal ปิดอยู่ และไม่ใช่ข้อความตัวเอง
            const modal  = document.getElementById('chatModal');
            const isOpen = modal && !modal.classList.contains('hidden');
            const myName = (window.currentUser || {}).username || '';
            if (!isOpen && m.username !== myName) {
                window._chatUnreadCount = (window._chatUnreadCount || 0) + 1;
                const badge = document.getElementById('chatUnreadBadge');
                if (badge) {
                    badge.innerText = window._chatUnreadCount > 9 ? '9+' : window._chatUnreadCount;
                    badge.classList.remove('hidden');
                }
            }
        })
        .subscribe();

    if (typeof window.registerPageSubscription === 'function') {
        window.registerPageSubscription(window._chatSubscription);
    }
}

// ── Init (เรียกจาก initDashboard) ───────
window.initLiveChat = async function() {
    window._chatMessages    = [];
    window._chatUnreadCount = 0;
    await fetchChatMessages();
    subscribeLiveChat();
};
