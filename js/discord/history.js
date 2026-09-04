// ════════════════════════════════════════════════════════════════════
// 📦 discord/history.js — ส่วนที่ 2/5 ของหน้า Discord (แยกมาจาก discord.js เดิม)
// เนื้อหา: ประวัติเข้า-ออกห้อง (แบ่งหน้า/ค้นหา), จัดการฐานข้อมูล, เตะคน, ลบประวัติเก่า
// ⚠️ ลำดับโหลด (กำหนดใน PAGE_SCRIPTS ของ global.js): discord/core → history → message → breaktrack → tts
// ตัวแปร/ฟังก์ชันแชร์ข้ามไฟล์กันได้ตามปกติ (top-level scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ==============================================================
// 🌟 ตัวแปรสำหรับควบคุมการแบ่งหน้า (Pagination)
// ==============================================================
window.dsCurrentPage = 1;
window.dsRowsPerPage = 50; // โหลดทีละ 50 บรรทัด
window.dsTotalPages = 1;

// ==============================================================
// 🌟 ฟังก์ชันดึงประวัติการเข้า-ออกห้อง (แบบแบ่งหน้า + ค้นหาจากฐานข้อมูล)
// ==============================================================
// 🔔 [FIX] realtime ประวัติเข้า-ออกห้อง — เดิมเรียก ds_subscribeVoiceLogs() แต่ "ไม่เคยมีฟังก์ชันนี้" รายการใหม่เลยไม่ขึ้นจนกว่าจะกดรีเฟรชเอง
window._dsVoiceLogSub = null;
window.ds_subscribeVoiceLogs = function() {
    if (window._dsVoiceLogSub) return;
    try {
        window._dsVoiceLogSub = appDB.channel('discord-voice-logs-live')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discord_voice_logs' }, () => {
                const tab = document.getElementById('ds_voiceLogBody');
                if (!tab) return;
                // ดูวันนี้ + หน้าแรกอยู่ → โหลดใหม่ (กันรัว: หน่วง 800ms)
                const dateInput = document.getElementById('voiceLogDate');
                const today = new Date(); const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                if (dateInput && dateInput.value && dateInput.value !== todayStr) return;
                clearTimeout(window._dsVoiceLogTimer);
                window._dsVoiceLogTimer = setTimeout(() => window.ds_fetchVoiceLogs(true, 1), 800);
            })
            .subscribe();
        if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window._dsVoiceLogSub);
        // ถ้าหน้าเปลี่ยน subscription ถูกถอด → ให้สร้างใหม่ได้รอบหน้า
        const orig = window._dsVoiceLogSub.unsubscribe && window._dsVoiceLogSub.unsubscribe.bind(window._dsVoiceLogSub);
        if (orig) window._dsVoiceLogSub.unsubscribe = function() { window._dsVoiceLogSub = null; return orig.apply(this, arguments); };
    } catch (e) { console.warn('voice log realtime', e); }
};

window.ds_fetchVoiceLogs = async function(forceRefresh = false, page = window.dsCurrentPage) {
    if (typeof ds_subscribeVoiceLogs === 'function') ds_subscribeVoiceLogs();

    // อัปเดตหน้าปัจจุบัน
    window.dsCurrentPage = page;

    const dateInput = document.getElementById('voiceLogDate');
    let targetDate = dateInput ? dateInput.value : '';
    
    if (!targetDate) {
        const today = new Date();
        targetDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        if (dateInput) dateInput.value = targetDate;
    }

    // 🌟 อ่านค่าจากช่องค้นหาชื่อ
    const searchInput = document.getElementById('dsLogSearch'); 
    const searchText = searchInput ? searchInput.value.trim() : '';

    const tbody = document.getElementById('ds_voiceLogBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-gray-400"><span class="material-icons animate-spin text-4xl mb-2 text-fuchsia-500">sync</span><br>กำลังดึงข้อมูลหน้า ${page}...</td></tr>`;

    try {
        // [FIX] เดิมใช้ +00:00 (UTC) ทำให้ "วันนี้" เลื่อนไป 7 ชม. — รายการช่วง 00:00-06:59 ของวันไปโผล่วันก่อน และตอนใกล้เที่ยงคืนรายการล่าสุดหาย
        const startOfDay = `${targetDate}T00:00:00+07:00`;
        const endOfDay = `${targetDate}T23:59:59.999+07:00`;

        // 🌟 1. ดึงแบบ Server-Side แบ่งหน้า เพื่อทะลุขีดจำกัด 1000 รายการของระบบ
        let query = appDB.from('discord_voice_logs')
            .select('id, user_name, action_type, room_name, created_at', { count: 'exact' })
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false });

        // 🌟 2. ถ้ามีการพิมพ์ชื่อ ให้ค้นหาจากฐานข้อมูลโดยตรง (หาเจอ 100% แม้ชื่อจะตกไปอยู่หน้าหลังๆ)
        if (searchText) {
            query = query.ilike('user_name', `%${searchText}%`);
        }

        // 🌟 3. คำนวณจุดเริ่มต้นและสิ้นสุด (ดึงทีละ 50 บรรทัด)
        const from = (window.dsCurrentPage - 1) * window.dsRowsPerPage;
        const to = from + window.dsRowsPerPage - 1;
        
        // ใส่ Range ลงไปใน Query จะทำให้ได้ข้อมูลครบและทะลุ 1000 ได้ชัวร์ๆ
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        // 🌟 4. คำนวณจำนวนหน้า (Pagination) จากยอดรวมจริงๆ ในระบบ (count)
        window.dsTotalPages = Math.ceil((count || 0) / window.dsRowsPerPage) || 1;

        // ดักจับกรณีค้นหาจนหน้าปัจจุบันเกินจำนวนหน้าทั้งหมด
        if (window.dsCurrentPage > window.dsTotalPages) {
            window.dsCurrentPage = 1;
            return ds_fetchVoiceLogs(forceRefresh, 1);
        }

        window.dsGlobalVoiceLogs = data.map(row => ({
            id: row.id,
            name: row.user_name,
            action: row.action_type,
            room: row.room_name,
            time: row.created_at
        }));

        // วาดตาราง 50 บรรทัด
        if (typeof ds_renderVoiceLogs === 'function') ds_renderVoiceLogs();

        // 🌟 วาดปุ่มเปลี่ยนหน้า (ส่ง count ที่แท้จริงไปให้)
        ds_renderPaginationControls(count);

        if (forceRefresh === true && !searchText) {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            Toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลเรียบร้อย' });
        }

    } catch (e) {
        console.error("Fetch Voice Logs Error:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500 font-bold">ไม่สามารถดึงข้อมูลได้: ${e.message}</td></tr>`;
    }
};

window.ds_renderVoiceLogs = function() {
    const term = document.getElementById('dsLogSearch') ? document.getElementById('dsLogSearch').value.toLowerCase() : '';
    const dateFilter = document.getElementById('voiceLogDate').value;
    const lateFilter = document.getElementById('voiceLogLateFilter').value;
    const shiftFilter = document.getElementById('voiceLogShiftFilter') ? document.getElementById('voiceLogShiftFilter').value : 'ALL';
    const tbody = document.getElementById('ds_voiceLogBody');
    
    let filtered = window.dsGlobalVoiceLogs || [];

    // การกรอง Shift และสาย ย้ายมาทำฝั่ง Frontend เหมือนเดิม (เฉพาะหน้าปัจจุบัน)
    if (shiftFilter !== 'ALL') {
        filtered = filtered.filter(log => {
            const dbUser = getDbUserFromDiscordName(log.name);
            if (dbUser && dbUser.allowed_shift === shiftFilter) return true;
            if (log.name.includes(shiftFilter)) return true;
            return false;
        });
    }

    let finalHtml = '';
    
    filtered.forEach(log => {
        let d = new Date(log.time);
        
        // 🌟 แก้ปัญหาเวลาแสดงผล: หักลบ 7 ชั่วโมงที่บราวเซอร์บวกเพิ่มซ้ำซ้อนออก
        d = new Date(d.getTime() - (7 * 60 * 60 * 1000));
        
        // 🌟 1. ดึงวันที่ (รูปแบบ 09/04/2569)
        const datePart = d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' });
        // 🌟 2. ดึงเวลา (รูปแบบ 15:38:51)
        const timePart = d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // 🌟 3. เอามาจับมัดรวมกัน จัดให้วันที่เป็นตัวหนังสือเล็กๆ สีเทาๆ
        const timeStr = `${timePart} <span class="text-[9px] text-gray-600 ml-1">(${datePart})</span>`;
        
        let badge = ''; let lateBadge = ''; let rowClass = 'hover:bg-slate-700/50'; let isLate = false;
        const dbUser = getDbUserFromDiscordName(log.name);

        if(log.action === 'เข้าห้อง') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-emerald-500/50 whitespace-nowrap shadow-sm">เข้าห้อง</span>';
            
            let targetShift = dbUser ? dbUser.allowed_shift : null;
            if (!targetShift) {
                if (log.name.includes('กะเช้า')) targetShift = 'กะเช้า';
                else if (log.name.includes('กะกลาง')) targetShift = 'กะกลาง';
                else if (log.name.includes('กะดึก')) targetShift = 'กะดึก';
            }
            
            if (targetShift && targetShift !== 'all') {
                const shiftPrefix = targetShift.replace('กะ', '');
                let expectedStart = null; 
                if (shiftPrefix === 'เช้า') expectedStart = '08:00'; 
                else if (shiftPrefix === 'กลาง') expectedStart = '11:00'; 
                else if (shiftPrefix === 'ดึก') expectedStart = '20:00'; 

                if (typeof SETTINGS !== 'undefined' && SETTINGS['open_time_' + shiftPrefix]) {
                    expectedStart = SETTINGS['open_time_' + shiftPrefix];
                }
                
                if (expectedStart) {
                    const [h, m] = expectedStart.split(':').map(Number);
                    let expectedTime = new Date(d); 
                    expectedTime.setHours(h, m, 0, 0);

                    if (h >= 18 && d.getHours() < 12) {
                        expectedTime.setDate(expectedTime.getDate() - 1);
                    }

                    if (d > expectedTime && (d - expectedTime) > 60000) {
                        const diffMins = Math.floor((d - expectedTime) / 60000);
                        if (diffMins <= 720) { 
                            lateBadge = `<span class="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold shadow-md whitespace-nowrap">มาสาย ${diffMins} นาที</span>`;
                            isLate = true;
                        }
                    }
                }
            }
        }
        else if(log.action.includes('ออกดิส') || log.action.includes('ออกห้อง')) {
            badge = '<span class="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-500/50 whitespace-nowrap shadow-sm">ออกดิสคอร์ด</span>';
            rowClass = 'bg-red-900/10 hover:bg-red-900/30'; 
        }
        else {
            badge = '<span class="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-blue-500/50 whitespace-nowrap shadow-sm">ย้ายไป</span>';
        }

        if (lateFilter === 'late' && !isLate) return; 
        if (lateFilter === 'leave' && !log.action.includes('ออกดิส') && !log.action.includes('ออกห้อง')) return;

        let displayShift = dbUser ? dbUser.allowed_shift : '';
        if (!displayShift) {
             if (log.name.includes('กะเช้า')) displayShift = 'กะเช้า';
             else if (log.name.includes('กะกลาง')) displayShift = 'กะกลาง';
             else if (log.name.includes('กะดึก')) displayShift = 'กะดึก';
        }
        const shiftTag = displayShift ? `<span class="text-[9px] text-gray-500 ml-1 whitespace-nowrap">(${displayShift})</span>` : '';

        finalHtml += window.renderTemplate('tpl-ds-voice-log-row', {
            rowClass: rowClass,
            timeStr: timeStr,
            name: log.name,
            shiftTag: shiftTag,
            lateBadge: lateBadge,
            badge: badge,
            room: log.room
        });
    });

    if (finalHtml === '') {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold">ไม่พบประวัติในหน้านี้</td></tr>';
    } else {
        tbody.innerHTML = finalHtml;
    }
};

// ==============================================================
// 🌟 ฟังก์ชันสร้างปุ่มเปลี่ยนหน้า (Pagination UI)
// ==============================================================
window.ds_renderPaginationControls = function(totalItems) {
    let paginationDiv = document.getElementById('ds_paginationContainer');
    
    // ถ้ายังไม่มีแถบเปลี่ยนหน้า ให้สร้างต่อท้ายตาราง
    if (!paginationDiv) {
        const tableContainer = document.getElementById('ds_voiceLogBody').closest('.overflow-x-auto') || document.getElementById('ds_voiceLogBody').closest('table').parentElement;
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'ds_paginationContainer';
        paginationDiv.className = 'flex flex-col sm:flex-row justify-between items-center mt-4 p-3 bg-[#151f32] rounded-xl border border-slate-700/80 shadow-md gap-3';
        tableContainer.parentElement.appendChild(paginationDiv);
    }

    if (totalItems === 0) {
        paginationDiv.innerHTML = `<div class="text-xs text-gray-500 w-full text-center font-bold">ไม่มีประวัติในเงื่อนไขนี้</div>`;
        return;
    }

    const startItem = (window.dsCurrentPage - 1) * window.dsRowsPerPage + 1;
    const endItem = Math.min(window.dsCurrentPage * window.dsRowsPerPage, totalItems);

    paginationDiv.innerHTML = `
        <div class="text-xs text-gray-400 font-bold">
            แสดง <span class="text-fuchsia-400">${startItem} - ${endItem}</span> จากทั้งหมด <span class="text-white">${totalItems}</span> รายการ
        </div>
        <div class="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
            <button onclick="ds_fetchVoiceLogs(false, 1)" ${window.dsCurrentPage === 1 ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-gray-300 p-1 rounded transition"'} title="หน้าแรก"><span class="material-icons text-sm">keyboard_double_arrow_left</span></button>
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsCurrentPage - 1})" ${window.dsCurrentPage === 1 ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-fuchsia-400 p-1 rounded transition"'} title="ก่อนหน้า"><span class="material-icons text-sm">chevron_left</span></button>
            
            <span class="text-[11px] font-bold text-white px-3 border-x border-slate-700/50">หน้า ${window.dsCurrentPage} / ${window.dsTotalPages}</span>
            
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsCurrentPage + 1})" ${window.dsCurrentPage === window.dsTotalPages ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-fuchsia-400 p-1 rounded transition"'} title="ถัดไป"><span class="material-icons text-sm">chevron_right</span></button>
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsTotalPages})" ${window.dsCurrentPage === window.dsTotalPages ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-gray-300 p-1 rounded transition"'} title="หน้าสุดท้าย"><span class="material-icons text-sm">keyboard_double_arrow_right</span></button>
        </div>
    `;
};

window.ds_fetchActionLogs = async function() {
    try {
        document.getElementById('ds_actionLogBody').innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500"><span class="material-icons animate-spin">sync</span></td></tr>';
        const res = await fetch(DISCORD_API_URL + '/api/action-logs');
        if(res.ok) {
            let data = await res.json();
            window.dsGlobalActionLogs = data; 
            ds_renderActionLogs();
        }
    } catch(e) {}
};

window.ds_renderActionLogs = function() {
    const term = document.getElementById('actionLogSearch') ? document.getElementById('actionLogSearch').value.toLowerCase() : '';
    const dateFilter = document.getElementById('actionLogDate') ? document.getElementById('actionLogDate').value : '';
    const tbody = document.getElementById('ds_actionLogBody');
    
    if (!window.dsGlobalActionLogs || window.dsGlobalActionLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 font-bold">ไม่พบประวัติการใช้งาน</td></tr>';
        return;
    }

    let filtered = window.dsGlobalActionLogs.filter(log => 
        log.user.toLowerCase().includes(term) || 
        log.action.toLowerCase().includes(term) || 
        log.detail.toLowerCase().includes(term)
    );

    if (dateFilter) {
        filtered = filtered.filter(log => {
            // 🌟 จุดที่แก้ไข: รวมตัวแปร d ให้เหลือตัวเดียว แล้วหักลบเวลา 7 ชั่วโมง
            let d = new Date(log.time);
            d = new Date(d.getTime() - (7 * 60 * 60 * 1000)); 
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === dateFilter;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 font-bold">ไม่พบข้อมูลในเงื่อนไขที่ค้นหา</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        let d = new Date(log.time);
        
        // 🌟 หักลบ 7 ชั่วโมงให้ตรงกับประเทศไทย (GMT+7)
        d = new Date(d.getTime() - (7 * 60 * 60 * 1000));
        const timeStr = d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        
        return window.renderTemplate('tpl-ds-action-log-row', {
            timeStr: timeStr,
            user: log.user,
            action: log.action,
            detail: log.detail
        });
    }).join('');
};

window.ds_logAction = async function(actionName, detailStr) {
    try {
        const userName = (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Unknown Admin';
        await fetch(DISCORD_API_URL + '/api/action-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userName, action: actionName, detail: detailStr })
        });
    } catch(e) {}
};

// ==========================================
// 🟢 อัปเดต Dropdown และ ระบบจัดการฐานข้อมูลดิสคอร์ด (Manage)
// ==========================================

window.updateAllFilters = function() {
    const groupNames = Object.keys(extStaffGroups || {}).sort();
    
    const f1 = document.getElementById('groupFilter'); 
    if(f1) f1.innerHTML = '<option value="ALL">-- ทุกกลุ่ม --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f2 = document.getElementById('filterStaffGroup'); 
    if(f2) f2.innerHTML = '<option value="ALL">-- ดูทุกกลุ่ม --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f3 = document.getElementById('filterTransferGroup'); 
    if(f3) f3.innerHTML = '<option value="ALL">ทุกกลุ่ม</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f4 = document.getElementById('transferToGroup'); 
    if(f4) f4.innerHTML = '<option value="">-- เลือกกลุ่มปลายทาง --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
};

window.renderManagerList = function() { dsDebounce('mgrList', _doRenderManagerList, 200); };

window._doRenderManagerList = function() {
    const container = document.getElementById('manageStaffList');
    if(!container) return;
    const search = document.getElementById('searchMgrStaff').value.toLowerCase();
    const group = document.getElementById('filterStaffGroup').value;
    const deptFilter = document.getElementById('filterStaffDept').value;
    const shiftFilter = document.getElementById('filterStaffShift').value;
    
    // 🌟 [NEW] อ่านสถานะ checkbox "เฉพาะกลุ่มผิด" และ "เฉพาะ Discord ซ้ำ"
    const onlyMismatchCb = document.getElementById('mgrOnlyMismatchCb');
    const onlyMismatch = onlyMismatchCb ? onlyMismatchCb.checked : false;
    const onlyDuplicateCb = document.getElementById('mgrOnlyDuplicateCb');
    const onlyDuplicate = onlyDuplicateCb ? onlyDuplicateCb.checked : false;

    // 🌟 [PERF] สร้าง cache ครั้งเดียว ใช้ตลอด render (ลดเวลา 200+ staff จาก ~2s เหลือ ~50ms)
    const cache = buildMgrCache();
    const { dbUserMap, duplicateSet, mismatchMap } = cache;

    const filtered = extStaffList.filter(s => {
        const matchName = s.name.toLowerCase().includes(search);
        const matchGroup = group === 'ALL' || (extStaffGroups[group] && extStaffGroups[group].includes(s.id));
        let matchDept = true; let matchShift = true;
        
        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            const dbUser = dbUserMap[s.id]; // 🌟 ใช้ cache
            if (!dbUser) return false;
            if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
        }
        
        // 🌟 ใช้ Set lookup O(1)
        if (onlyMismatch && !mismatchMap[s.id]) return false;
        if (onlyDuplicate && !duplicateSet.has(s.id)) return false;
        
        return matchName && matchGroup && matchDept && matchShift;
    });

    // 🌟 [NEW] ใส่ Toolbar (ส่ง cache ที่คำนวณมาแล้ว เพื่อไม่ต้องคำนวณซ้ำ)
    injectMismatchToolbar(cache);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8 text-sm">ไม่พบรายชื่อ</div>';
        return;
    }

    container.innerHTML = filtered.map(s => {
        const dbUser = dbUserMap[s.id]; // 🌟 ใช้ cache
        let tagHtml = dbUser ? `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-700/50 ml-2 shadow-sm">${dbUser.department || 'AM'} | ${dbUser.allowed_shift.replace('กะ','')}</span>` : `<span class="bg-slate-700 text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold ml-2">ไม่พบในระบบลงเวลา</span>`;
        
        // 🌟 ใช้ Set lookup O(1)
        if (duplicateSet.has(s.id)) {
            tagHtml += `<button onclick="openDuplicateModal()" 
                class="ml-2 inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-purple-400"
                title="มี Discord ซ้ำกับชื่อนี้ - กดเพื่อดูรายการ">
                <span class="material-icons text-[12px]">people_alt</span> ซ้ำ
            </button>`;
        }
        
        // 🌟 ใช้ map lookup O(1)
        const mismatch = mismatchMap[s.id];
        if (mismatch) {
            tagHtml += `<button onclick="autoFixStaffGroup('${s.id}')" 
                class="ml-2 inline-flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-rose-400 animate-pulse"
                title="กลุ่ม Discord ไม่ตรงกับฐานข้อมูล - กดเพื่อย้ายอัตโนมัติ">
                <span class="material-icons text-[12px]">warning</span> กลุ่มผิด → ${mismatch.expectedGroup}
            </button>`;
        }
        
        // 🌟 [NEW] วาดกลุ่มที่อยู่ — ถ้ากลุ่มผิด ให้แสดงเป็นสีแดง
        let groupsIn = [];
        for(let g in extStaffGroups) { if(extStaffGroups[g].includes(s.id)) groupsIn.push(g); }
        const wrongSet = mismatch ? new Set(mismatch.wrongGroups) : new Set();
        const gTags = groupsIn.map(g => {
            const isWrong = wrongSet.has(g);
            const cls = isWrong 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 px-1.5 py-0.5 rounded text-[9px] mr-1 font-bold'
                : 'bg-slate-700 text-gray-300 px-1.5 py-0.5 rounded text-[9px] mr-1';
            return `<span class="${cls}">${isWrong ? '⚠ ' : ''}${g}</span>`;
        }).join('');
        
        return window.renderTemplate('tpl-ds-manager-row', {
            id: s.id,
            name: s.name,
            tagHtml: tagHtml,
            gTags: gTags || '- ไม่มีกลุ่ม -'
        });
    }).join('');
};

window.renderGroupList = function() {
    const container = document.getElementById('groupList');
    if(!container) return;
    
    let html = '';
    for(let g in extStaffGroups) {
        const count = extStaffGroups[g].length;
        
        let colorClass = 'text-emerald-400 border-slate-600 hover:border-emerald-500';
        let bgClass = 'bg-slate-800 hover:bg-slate-700/50';
        
        if (g.startsWith('AM') || g.startsWith('AMQL')) {
            colorClass = 'text-blue-400 border-blue-900/50 hover:border-blue-400';
            bgClass = 'bg-[#0f172a] hover:bg-[#1e293b]';
        } else if (g.startsWith('OD')) {
            colorClass = 'text-pink-400 border-pink-900/50 hover:border-pink-400';
            bgClass = 'bg-[#2b1b2e]/60 hover:bg-[#2b1b2e]';
        } else if (g.includes('ไม่พบ') || g.includes('อิสระ')) {
            colorClass = 'text-gray-400 border-gray-700 hover:border-gray-500';
            bgClass = 'bg-slate-900/50 hover:bg-slate-800';
        }

        html += window.renderTemplate('tpl-ds-group-row', {
            bgClass: bgClass,
            colorClass: colorClass,
            g: g,
            count: count
        });
    }
    container.innerHTML = html || '<div class="text-center text-gray-500 py-4 text-xs">ไม่มีกลุ่ม</div>';
};

window.openGroupManagerModal = function(groupName) {
    window.renderModalMemberList = function(gName) {
        const memberIds = extStaffGroups[gName] || [];
        if (memberIds.length === 0) return '<div class="text-center text-gray-500 py-6 text-sm">ยังไม่มีสมาชิกในกลุ่มนี้</div>';

        const members = memberIds.map(id => {
            const staff = extStaffList.find(s => s.id === id);
            return { id: id, name: staff ? staff.name : 'Unknown User' };
        }).sort((a,b) => a.name.localeCompare(b.name));

        return members.map((m, idx) => `
            <div class="flex justify-between items-center p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-sm mb-2 hover:bg-slate-700/50 transition">
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-gray-400 border border-slate-600 shadow-inner">${idx + 1}</div>
                    <span class="font-bold text-sm text-white tracking-wide">${m.name}</span>
                </div>
                <button onclick="removeUserFromGroup('${gName}', '${m.id}')" class="text-red-400 hover:text-white transition p-1.5 bg-slate-900 hover:bg-red-500 rounded-lg border border-slate-700" title="นำออกจากกลุ่ม"><span class="material-icons text-[16px]">person_remove</span></button>
            </div>
        `).join('');
    };

    const allUsersOptions = extStaffList
        .filter(s => !(extStaffGroups[groupName] || []).includes(s.id))
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(s => `<option value="${s.id}">${dsEsc(s.name)}</option>`)
        .join('');

    let headerColor = 'text-emerald-400';
    if(groupName.startsWith('AM') || groupName.startsWith('AMQL')) headerColor = 'text-blue-400';
    else if(groupName.startsWith('OD')) headerColor = 'text-pink-400';

    Swal.fire({
        html: `
            <div class="text-left mt-2">
                <div class="flex justify-between items-center mb-5 pb-4 border-b border-slate-700">
                    <div class="text-xl font-black ${headerColor}">${groupName}</div>
                    <span class="bg-slate-700 text-gray-300 text-xs px-3 py-1.5 rounded-full font-bold shadow-inner" id="modalMemberCount">${(extStaffGroups[groupName]||[]).length} คน</span>
                </div>

                <div class="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-5 shadow-inner">
                    <label class="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2"><span class="material-icons text-[16px]">person_add</span> เพิ่มพนักงานเข้ากลุ่ม</label>
                    <div class="flex gap-2">
                        <select id="addMemberSelect" class="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500 font-bold cursor-pointer">
                            <option value="">-- เลือกจากรายชื่อ --</option>
                            ${allUsersOptions}
                        </select>
                        <button onclick="addUserToGroup('${groupName}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-bold transition shadow-md whitespace-nowrap flex items-center gap-1 active:scale-95">
                            <span class="material-icons text-[16px]">add_circle</span> เพิ่ม
                        </button>
                    </div>
                </div>

                <div class="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">รายชื่อสมาชิกปัจจุบัน</div>
                <div class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2" id="modalMemberList">
                    ${window.renderModalMemberList(groupName)}
                </div>
                
                <div class="mt-4 pt-4 border-t border-slate-700 flex justify-start">
                    <button onclick="renameGroup('${groupName}'); Swal.close();" class="text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 transition flex items-center gap-1">
                        <span class="material-icons text-[14px]">edit</span> เปลี่ยนชื่อกลุ่ม
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '500px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-600 shadow-2xl' }
    });
};

window.addUserToGroup = async function(groupName) {
    if (!window.dsRequire('ds_manage')) return;

    const select = document.getElementById('addMemberSelect');
    const staffId = select.value;
    if(!staffId) return;

    const btn = select.nextElementSibling;
    btn.innerHTML = '<span class="material-icons animate-spin">sync</span>';
    btn.disabled = true;

    try {
        const res = await fetch(DISCORD_API_URL + '/api/groups/assign', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupName: groupName, staffIds: [staffId] })
        });
        
        if(res.ok) {
            if(!extStaffGroups[groupName]) extStaffGroups[groupName] = [];
            extStaffGroups[groupName].push(staffId);
            
            document.getElementById('modalMemberList').innerHTML = window.renderModalMemberList(groupName);
            document.getElementById('modalMemberCount').innerText = `${extStaffGroups[groupName].length} คน`;
            
            select.querySelector(`option[value="${staffId}"]`).remove();
            select.value = '';
            
            renderGroupList(); 
        }
    } catch(e) { console.error(e); } 
    finally {
        btn.innerHTML = '<span class="material-icons text-[16px]">add_circle</span> เพิ่ม';
        btn.disabled = false;
    }
};

window.removeUserFromGroup = async function(groupName, staffId) {
    if (!window.dsRequire('ds_manage')) return;

    const listContainer = document.getElementById('modalMemberList');
    listContainer.style.opacity = '0.5';

    try {
        const res = await fetch(DISCORD_API_URL + '/api/groups/remove-member', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupName: groupName, staffId: staffId })
        });

        if(res.ok) {
            extStaffGroups[groupName] = extStaffGroups[groupName].filter(id => id !== staffId);
            
            listContainer.innerHTML = window.renderModalMemberList(groupName);
            document.getElementById('modalMemberCount').innerText = `${extStaffGroups[groupName].length} คน`;
            
            const staff = extStaffList.find(s => s.id === staffId);
            if(staff) {
                const select = document.getElementById('addMemberSelect');
                select.innerHTML += `<option value="${staff.id}">${dsEsc(staff.name)}</option>`;
            }
            
            renderGroupList(); 
        }
    } catch(e) { console.error(e); } 
    finally {
        listContainer.style.opacity = '1';
    }
};

// ==========================================
// 🟢 ฟังก์ชันสำหรับเตะคนออกจากเซิร์ฟเวอร์ดิสคอร์ด
// ==========================================
window.spy_kickUser = async function(uid, name) {
    if (!window.dsRequire('ds_spy')) return;

    const confirm = await Swal.fire({
        title: 'ยืนยันการเตะ?',
        text: `คุณแน่ใจหรือไม่ที่จะเตะ "${name}" ออกจากเซิร์ฟเวอร์ดิสคอร์ด? (ต้องส่งคำเชิญใหม่หากต้องการให้เข้ามาอีก)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'ใช่, เตะออกเลย!',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({title: 'กำลังดำเนินการ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/kick-user`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: uid })
        });
        const r = await res.json();
        
        if (r.success) {
            Swal.fire('สำเร็จ', `เตะ ${name} ออกจากเซิร์ฟเวอร์แล้ว`, 'success');
            ds_logAction('Kick User', `เตะพนักงาน ${name} ออกจากเซิร์ฟเวอร์ดิสคอร์ด`);
            ds_fetchSpy(); // รีเฟรชตารางใหม่
        } else {
            Swal.fire('เกิดข้อผิดพลาด', r.error || 'ไม่สามารถเตะผู้ใช้นี้ได้', 'error');
        }
    } catch(e) {
        Swal.fire('ล้มเหลว', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์บอทได้', 'error');
    }
};

// ==============================================================
// 🌟 ฟังก์ชันลบประวัติย้ายห้องที่เก่ากว่า 7 วัน (เก็บเข้า/ออก/สาย ไว้)
// ==============================================================
window.ds_clearOldMoveLogs = async function() {
    if (!window.dsRequire('ds_log')) return;

    const res = await Swal.fire({
        title: 'ล้างประวัติการ "ย้ายห้อง"?',
        text: "ระบบจะลบประวัติการย้ายห้องที่เก่ากว่า 7 วันทิ้งเพื่อลดพื้นที่ (ระบบจะยังเก็บประวัติ 'เข้าห้อง', 'ออกห้อง' และสถิติ 'มาสาย' ไว้ตามปกติครับ)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบทิ้งเลย'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังตรวจสอบและลบข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            // คำนวณวันที่ย้อนหลัง 7 วัน
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            const cutoffDateStr = cutoffDate.toISOString();

            // สั่งลบเฉพาะที่มีคำว่า "ย้าย" ในตาราง และเวลาเก่ากว่า 7 วัน
            const { error } = await appDB.from('discord_voice_logs')
                .delete()
                .like('action_type', '%ย้าย%')
                .lt('created_at', cutoffDateStr);

            if (error) throw error;

            Swal.fire({
                icon: 'success', 
                title: 'ลบสำเร็จ!', 
                text: 'เคลียร์ประวัติการย้ายห้องที่เก่ากว่า 7 วันเรียบร้อยแล้วครับ', 
                timer: 2000, 
                showConfirmButton: false
            });
            
            // รีเฟรชตารางหน้า 1 ใหม่
            ds_fetchVoiceLogs(true, 1);
            
            // บันทึกประวัติการทำงานของแอดมินไว้ด้วย
            if (typeof ds_logAction === 'function') {
                ds_logAction('ล้างประวัติดิสคอร์ด', 'ลบประวัติย้ายห้องที่เก่ากว่า 7 วันทิ้ง');
            }

        } catch (e) {
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
    }
};
