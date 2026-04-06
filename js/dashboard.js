// ========================================================================
// 🟢 ไฟล์: js/dashboard.js (ควบคุมการทำงานหน้าลงเวลา และ Admin Panel)
// ========================================================================

// 1. ฟังก์ชันเริ่มต้นตอนเปิดหน้า Dashboard
window.initDashboard = async function() {
    if (!currentUser) return;
    
    // อัปเดตข้อมูลพนักงานที่แถบด้านบน
    updateDashboardUserInfo();
    
    // ดึงรายชื่อทีมเข้า Dropdown
    populateTeamSelects();
    
    // 🟢 บังคับเซ็ตวันที่ให้เป็น "วันนี้" เสมอทันทีที่โหลด
    const dInput = document.getElementById('wDate');
    if (dInput) {
        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dInput.value = localDate;
        const displayDate = document.getElementById('displayDate');
        if (displayDate) displayDate.innerText = new Date(localDate).toLocaleDateString('th-TH');
    }

    // 🟢 สร้างปุ่มและ "บังคับเลือกกะให้อัตโนมัติ" ตามสิทธิ์
    renderShiftButtons(currentUser.allowed_shift);
    
    // เช็คระบบ "จำทีมนี้ไว้ตลอด"
    const savedTeam = localStorage.getItem(`last_team_${currentUser.username}`);
    const teamSelect = document.getElementById('dailyTeam');
    if (teamSelect) {
        if (savedTeam) {
            teamSelect.value = savedTeam;
            const rememberCb = document.getElementById('rememberTeam');
            if(rememberCb) rememberCb.checked = true;
        } else if (currentUser.team) {
            teamSelect.value = currentUser.team;
        }
    }

    // โหลดข้อมูลรอบเวลาและตารางลงเวลาทันที
    if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
    if (typeof fetchData === 'function') fetchData();
};

// 2. อัปเดตป้ายข้อมูลส่วนตัวพนักงาน
function updateDashboardUserInfo() {
    if(document.getElementById('uName')) document.getElementById('uName').innerText = currentUser.username || 'Unknown';
    if(document.getElementById('checkTypeDisplay')) document.getElementById('checkTypeDisplay').innerText = (currentUser.check_type === 'shift') ? 'เช็คโควตากะ' : 'เช็คโควตาทีม';
    if(document.getElementById('quotaDisplay')) document.getElementById('quotaDisplay').innerText = currentUser.department || 'AM';
    
    // อัปเดตตัวเลขสรุปกฎระเบียบ
    if(document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = SETTINGS.period_limit || 1;
    if(document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = SETTINGS.daily_limit || 2;
}

// 3. นำรายชื่อทีม (TEAM_LIST) มาใส่ใน Dropdown ให้ครบ
window.populateTeamSelects = function() {
    const dt = document.getElementById('dailyTeam');
    const tf = document.getElementById('tableTeamFilter');
    const nt = document.getElementById('newTeam');
    const mt = document.getElementById('moveTargetTeam');
    
    let html = ''; 
    let fHtml = '<option value="all">-- ทุกเว็บ --</option>';
    let ntHtml = '<option value="">- ไม่ระบุทีม -</option>';
    
    // เรียงชื่อทีม A-Z ให้สวยงาม
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
    
    // ตั้งค่าทีมเริ่มต้นให้ตรงกับพนักงาน
    if(dt && currentUser && currentUser.team) dt.value = currentUser.team;
};

// 4. สร้างปุ่มเลือกกะ (และติ๊กให้อัตโนมัติ)
window.renderShiftButtons = function(allowedShift) {
    const container = document.getElementById('shiftContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const shifts = ['กะเช้า', 'กะกลาง', 'กะดึก'];
    let hasChecked = false; // ตัวแปรเช็คว่าติ๊กเลือกไปหรือยัง
    
    shifts.forEach((s, index) => {
        let isDisabled = false;
        let bgClass = 'bg-white dark:bg-slate-800';
        let textClass = 'text-gray-700 dark:text-gray-300';
        let borderClass = 'border-gray-200 dark:border-slate-600';
        
        // ล็อกปุ่มถ้าไม่มีสิทธิ์
        if (allowedShift !== 'all' && allowedShift !== s && !['manager', 'admin'].includes(currentUser.role)) {
            isDisabled = true;
            bgClass = 'bg-gray-100 dark:bg-slate-900 opacity-50 cursor-not-allowed';
        } else {
            bgClass = 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer';
        }
        
        // 🟢 ระบบ Auto-Select: เลือกกะให้อัตโนมัติตามสิทธิ์
        let isChecked = false;
        if (!isDisabled && !hasChecked) {
            if (allowedShift === 'all' || ['manager', 'admin'].includes(currentUser.role)) {
                if (index === 0) { isChecked = true; hasChecked = true; } // แอดมิน เลือกเช้าไว้ก่อน
            } else if (allowedShift === s) {
                isChecked = true; hasChecked = true; // พนักงาน เลือกกะตัวเอง
            }
        }
        
        let icon = s === 'กะเช้า' ? 'wb_sunny' : (s === 'กะกลาง' ? 'cloud' : 'dark_mode');
        let color = s === 'กะเช้า' ? 'text-orange-500' : (s === 'กะกลาง' ? 'text-blue-500' : 'text-purple-500');

        container.innerHTML += `
            <label class="relative flex flex-col items-center p-3 rounded-xl border-2 ${borderClass} ${bgClass} transition shadow-sm">
                <input type="radio" name="shift" value="${s}" class="peer hidden" onchange="refreshTimeSlots()" ${isDisabled ? 'disabled' : ''} ${isChecked ? 'checked' : ''}>
                <span class="material-icons ${color} mb-1 peer-checked:scale-125 transition-transform">${icon}</span>
                <span class="font-bold ${textClass} text-sm">${s}</span>
                <div class="absolute inset-0 border-2 border-transparent peer-checked:border-blue-500 rounded-xl pointer-events-none transition-colors"></div>
                <div class="absolute top-2 right-2 w-3 h-3 rounded-full bg-blue-500 opacity-0 peer-checked:opacity-100 transition-opacity"></div>
            </label>
        `;
    });
};

// 5. 🕒 ฟังก์ชันดึงรอบเวลาจากที่แอดมินตั้งค่าไว้ มาให้พนักงานเลือก
window.refreshTimeSlots = async function() {
    const shiftEl = document.querySelector('input[name="shift"]:checked');
    const slotSelect = document.getElementById('tSlot');
    const dateVal = document.getElementById('wDate').value;
    
    if (!slotSelect) return;
    if (!shiftEl || !dateVal) {
        slotSelect.innerHTML = '<option value="">-- กรุณาเลือกกะก่อน --</option>';
        return;
    }

    const shiftName = shiftEl.value;
    const loadingIcon = document.getElementById('slotLoading');
    if(loadingIcon) loadingIcon.classList.remove('hidden');

    try {
        // ดึงข้อมูลการจองของวันนี้มาเช็คที่ว่าง
        const { data: bookings } = await appDB.from('schedules')
            .select('time_slot, department')
            .eq('work_date', dateVal)
            .eq('shift_name', shiftName);
        
        // ดึงรอบเวลาจาก SHIFT_GROUPS (ที่แอดมินตั้งไว้)
        const periods = (typeof SHIFT_GROUPS !== 'undefined' ? SHIFT_GROUPS[shiftName] : {}) || {};
        
        let html = '<option value="">-- เลือกช่วงเวลา --</option>';
        
        // วนลูปสร้างตัวเลือกตาม "ช่วงที่ 1, 2, 3"
        for (const [periodName, times] of Object.entries(periods)) {
            html += `<optgroup label="--- ${periodName} ---">`;
            
            times.forEach(time => {
                // คำนวณที่ว่างตามแผนก (AM หรือ OD)
                const myDep = currentUser.department || 'AM';
                const count = bookings ? bookings.filter(b => b.time_slot === time && (b.department || 'AM') === myDep).length : 0;
                
                // ดึงโควตาสูงสุดจาก Settings
                const suffix = shiftName.replace('กะ', '');
                const maxQuota = myDep === 'OD' ? parseInt(SETTINGS[`quota_od_${suffix}`] || 5) : parseInt(SETTINGS[`quota_total_${suffix}`] || 50);
                
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

// ==========================================
// 🛠️ ควบคุมระบบหน้าจอแอดมิน (Admin Panel)
// ==========================================

window.openAdminPanel = async function() {
    // ถ้าไม่ได้อยู่หน้า dashboard ให้โหลดหน้า dashboard ก่อน
    if (!document.getElementById('adminPanel')) {
        await showPage('dashboard');
        // รอให้ระบบโหลดหน้าเสร็จแป๊บนึง ค่อยสลับกล่อง
        setTimeout(() => {
            document.getElementById('mainContentArea').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            document.getElementById('adminPanel').classList.add('flex');
            switchAdminTab('settings'); // เปิดแท็บแรกเสมอ
        }, 300);
    } else {
        // ถ้าอยู่หน้า dashboard อยู่แล้ว สลับกล่องได้เลย
        document.getElementById('mainContentArea').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('flex');
        switchAdminTab('settings');
    }
};

window.switchAdminTab = function(tab) {
    const tabs = ['settings', 'users', 'perms', 'info'];
    
    tabs.forEach(t => {
        const btn = document.getElementById('btnAdminTab_' + t);
        const view = document.getElementById('adminView_' + t);
        
        // สลับสีปุ่ม
        if (btn) {
            if (t === tab) {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-black transition flex items-center gap-2 bg-amber-500 text-slate-900 shadow-md';
            } else {
                btn.className = 'whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
            }
        }
        
        // สลับกล่องเนื้อหา
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
};
