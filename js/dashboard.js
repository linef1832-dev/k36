// ========================================================================
// 🟢 ไฟล์: js/dashboard.js (ควบคุมการทำงานหน้าลงเวลา และ Admin Panel)
// ========================================================================

window.initDashboard = async function() {
    // 1. รอระบบโหลดข้อมูล user (เผื่อเน็ตช้า)
    let retry = 0;
    while (!window.currentUser && retry < 10) {
        await new Promise(r => setTimeout(r, 200));
        retry++;
    }
    
    if (!window.currentUser) {
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser) window.currentUser = JSON.parse(savedUser);
        else return;
    }
    
    // อัปเดตข้อมูลพนักงานที่แถบด้านบน
    if (typeof updateDashboardUserInfo === 'function') updateDashboardUserInfo();
    
    // ดึงรายชื่อทีมเข้า Dropdown
    if (typeof populateTeamSelects === 'function') populateTeamSelects();
    
    // 🟢 บังคับเซ็ตวันที่ให้เป็น "วันนี้" เสมอ
    const dInput = document.getElementById('wDate');
    if (dInput) {
        const today = new Date();
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
    const isAdmin = ['manager', 'admin'].includes(userRole);
    
    shifts.forEach((s, index) => {
        // 🌟 จุดสำคัญ: ถ้าไม่ใช่แอดมิน และกะนี้ไม่ใช่กะของพนักงานคนนี้ ให้ "ข้าม (return)" ไปเลย (คือไม่สร้างปุ่มนี้ขึ้นมา)
        if (!isAdmin && shiftRight !== 'all' && shiftRight !== s) {
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
                <input type="radio" name="shift" value="${s}" class="peer hidden" onchange="refreshTimeSlots()" ${isChecked ? 'checked' : ''}>
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
    
    // 🌟 1. ดึงข้อมูล "เว็บ/ทีม" ที่พนักงานกำลังเลือกอยู่จาก Dropdown
    const teamSelect = document.getElementById('dailyTeam');
    const selectedTeam = teamSelect ? teamSelect.value : (window.currentUser?.team || '');
    
    if (!slotSelect) return;
    if (!shiftEl || !dateVal || !dateVal.value) {
        slotSelect.innerHTML = '<option value="">-- กรุณาเลือกกะ/วันทีก่อน --</option>';
        return;
    }

    const shiftName = shiftEl.value;
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
    } catch (e) {
        console.error("Refresh Slots Error:", e);
    } finally {
        if(loadingIcon) loadingIcon.classList.add('hidden');
    }
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
    
    // 1. จัดการปุ่มเมนูด้านบน (เปลี่ยนสี)
    tabs.forEach(t => {
        const btn = document.getElementById('btnAdminTab_' + t);
        if (btn) {
            if (t === tab) {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-black transition flex items-center gap-2 bg-amber-500 text-slate-900 shadow-md';
            } else {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
            }
        }
    });

    // 2. จัดการการแสดงผลของเนื้อหา (ใช้ requestAnimationFrame เพื่อไม่ให้ขวาง UI Thread)
    requestAnimationFrame(() => {
        tabs.forEach(t => {
            const view = document.getElementById('adminView_' + t);
            if (view) {
                if (t === tab) {
                    view.classList.remove('hidden');
                    view.classList.add('flex');
                } else {
                    view.classList.add('hidden');
                    view.classList.remove('flex');
                }
            }
        });
    });
};

// ========================================================================
// 🟢 ตัวสั่งการให้ระบบเริ่มทำงานอัตโนมัติเมื่อไฟล์โหลดเสร็จ (ตัวที่หายไป!)
// ========================================================================
setTimeout(() => {
    if (document.getElementById('shiftContainer') || document.getElementById('wDate')) {
        window.initDashboard();
    }
}, 500);
// ========================================================================
// 🟢 1. ฟังก์ชันดึงประวัติระบบ (Audit Logs) [Optimized โหลดลื่นขึ้น]
// ========================================================================
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
        
        // 🌟 แก้ไข: สร้างตัวแปรเก็บ HTML ไว้ก่อน ไม่สั่งเขียนลงหน้าจอซ้ำๆ
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

        // 🌟 สั่งเขียนลงหน้าจอทีเดียวจบ
        box.innerHTML = logsHtml;

    } else {
        box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติ</td></tr>`;
    }
};

// ========================================================================
// 🟢 2. ระบบช่วยโหลดตารางอัตโนมัติ เวลาสลับเมนูไปมา (กันตารางหาย)
// ========================================================================
const dashboardObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            const wDate = document.getElementById('wDate');
            // ถ้าตรวจพบว่าหน้า Dashboard เพิ่งถูกโหลดมาใหม่ และยังไม่ได้โหลดข้อมูล
            if (wDate && !wDate.dataset.initialized) {
                wDate.dataset.initialized = 'true';
                if (typeof window.initDashboard === 'function') {
                    window.initDashboard(); // สั่งให้ดึงตารางใหม่ทันที
                }
            }
        }
    });
});
// เริ่มดักจับการเปลี่ยนแปลงบนหน้าเว็บ
dashboardObserver.observe(document.body, { childList: true, subtree: true });

// ========================================================================
// 🟢 ระบบ Realtime สำหรับหน้าลงเวลาทำงาน (ดักฟังการจองของคนอื่น)
// ========================================================================
let dashboardSubscription = null;

window.subscribeDashboardChanges = function() {
    if (dashboardSubscription) return; // ถ้าเคยเปิดฟังแล้ว ไม่ต้องเปิดซ้ำ
    
    // ดักฟังการเปลี่ยนแปลงในตาราง 'schedules' (ตารางที่เก็บข้อมูลการจองเวลา)
    dashboardSubscription = appDB.channel('dashboard-schedules')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
            
            // เช็คว่าพนักงานกำลังเปิดหน้า "ลงเวลา" ดูอยู่หรือไม่ (ไม่ได้เปิดหน้าอื่นทิ้งไว้)
            // เช็คผ่าน ID ของหน้าจอหลัก ถ้าไม่ได้ซ่อนอยู่ แปลว่าดูอยู่
            const mainContent = document.getElementById('mainContentArea');
            if (mainContent && !mainContent.classList.contains('hidden')) {
                // ถ้ามีการเปลี่ยนแปลงเกิดขึ้น ให้รีเฟรช Dropdown รอบเวลา และตารางยอดรวมทันที
                if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
                if (typeof fetchData === 'function') fetchData();
            }
            
        }).subscribe();
};

// ========================================================================
// 🟢 ดักจับเวลาพนักงานกดเปลี่ยนวันที่ในปฏิทิน ให้บังคับโหลดข้อมูลตารางใหม่
// ========================================================================
setTimeout(() => {
    const dInput = document.getElementById('wDate');
    if (dInput) {
        dInput.addEventListener('change', () => {
            // เมื่อเปลี่ยนวันที่ ต้องดึงข้อมูลของวันนั้นๆ ใหม่เสมอ
            if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
            if (typeof fetchData === 'function') fetchData();
        });
    }
}, 1000);

// ========================================================================
// 🟢 ดักจับเวลาพนักงานกดเปลี่ยน "เว็บ/ทีม" ให้รีเฟรชยอดใหม่ตามเว็บนั้นๆ ทันที
// ========================================================================
setTimeout(() => {
    const teamInput = document.getElementById('dailyTeam');
    if (teamInput) {
        teamInput.addEventListener('change', () => {
            if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
        });
    }
}, 1000);

// ========================================================================
// 🟢 ฟังก์ชันกู้คืนข้อมูล (กรณีแอดมินมือลั่นล้างกระดาน)
// ========================================================================
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

    // 🌟 ท่อนที่หายไปอยู่ตรงนี้ครับ!
    if (confirm.isConfirmed) {
        Swal.fire({title: 'กำลังกู้คืนข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            // โยนข้อมูลที่ก๊อปปี้ไว้ กลับเข้าไปในฐานข้อมูล
            const { error } = await appDB.from('schedules').insert(backupData);
            if (error) throw error;

            // กู้คืนเสร็จ ล้างกระเป๋า และซ่อนปุ่ม
            sessionStorage.removeItem('temp_schedule_backup');
            document.getElementById('undoScheduleBtn')?.classList.add('hidden');

            if (typeof logAction === 'function') await logAction('กู้คืนข้อมูล', `แอดมินกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ`);

            Swal.fire('กู้คืนสำเร็จ!', 'ข้อมูลกลับมาอยู่ที่เดิมเรียบร้อยแล้วครับ', 'success');

            // สั่งให้ตารางรีเฟรชตัวเอง
            if (typeof fetchData === 'function') fetchData();

        } catch(e) {
            console.error(e);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถกู้คืนได้: ' + e.message, 'error');
        }
    }
};
