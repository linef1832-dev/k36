// ==========================================
// 🛠️ ควบคุมระบบหน้า Dashboard & Admin Panel
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

// ==========================================
// 🕒 ฟังก์ชันดึงรอบเวลาจากที่แอดมินตั้งค่าไว้ มาให้พนักงานเลือก (อัปเดตใหม่)
// ==========================================
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
        // 1. ดึงข้อมูลการจองของวันนี้มาเช็คที่ว่าง
        const { data: bookings } = await appDB.from('schedules')
            .select('time_slot, department')
            .eq('work_date', dateVal)
            .eq('shift_name', shiftName);
        
        // 2. ดึงรอบเวลาจาก SHIFT_GROUPS (ที่แอดมินเพิ่งเพิ่ม/แก้ไขมา)
        const periods = SHIFT_GROUPS[shiftName] || {};
        
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
