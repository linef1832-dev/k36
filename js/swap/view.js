// ════════════════════════════════════════════════════════════════════
// 📦 swap/view.js — ส่วนที่ 2/4 ของระบบสลับกะ (แยกจาก swap.js เดิม 1,633 บรรทัด)
// เนื้อหา: ตัวกรอง, ดึงตารางมาแสดง (แบ่งกลุ่มตามวัน), ค้นหา, ลบ/กู้คืน, แท็บ/ปุ่มของหน้าออกแบบใหม่
// ⚠️ ลำดับโหลด: swap/core → swap/view → swap/admin → swap/extras (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
const _swEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _swCanManage = () => canPerm('swap_manage') || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));

// ==========================================
// 🗂️ แท็บหลัก: ตารางสลับกะ / สร้างตารางใหม่
// ==========================================
window.swapSetMainTab = function(tab) {
    if (tab === 'create' && !_swCanManage()) tab = 'list';
    window._swTab = tab;
    document.querySelectorAll('#swMainTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const list = document.getElementById('staffSwapView'), create = document.getElementById('adminSwapControls');
    if (list) list.style.display = tab === 'list' ? '' : 'none';
    if (create) create.style.display = tab === 'create' ? 'block' : 'none';
    const body = document.getElementById('autoSwapModalBody'); if (body) body.scrollTop = 0;
};
// สถานะ: รอสลับ / สำเร็จแล้ว (ปุ่มแคปซูล → ใส่ค่าใน select เดิมที่ระบบใช้อยู่)
window.swapSetStatus = function(v) {
    const sel = document.getElementById('swapStatusFilter'); if (!sel) return;
    sel.value = v;
    document.querySelectorAll('.sw-seg-status .sw-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.status === v));
    window.fetchPublicSwapSchedule();
};
// รูปแบบการสลับ: การ์ดเลือก → ใส่ค่าใน select เดิม (swapShiftPair)
window.swapPickPair = function(v) {
    const sel = document.getElementById('swapShiftPair'); if (!sel) return;
    if (sel.value !== v) { sel.value = v; if (typeof clearExcludeStaff === 'function') clearExcludeStaff(); }
    window.swapSyncPairUI();
};
window.swapSyncPairUI = function() {
    const v = (document.getElementById('swapShiftPair') || {}).value || 'M_N';
    document.querySelectorAll('#swPairs .sw-pair').forEach(b => b.classList.toggle('on', b.dataset.pair === v));
};
// ให้ปุ่มบนจอตรงกับค่าจริงเสมอ (เช่นกลับเข้าหน้านี้จากภาพที่จำไว้)
window.swapSyncUI = function() {
    ['AM', 'OD', 'AMQL', 'ODQL'].forEach(d => { const b = document.getElementById(`btnSwapDept${d}`); if (b) b.classList.toggle('active', d === activeSwapDeptFilter); });
    const st = (document.getElementById('swapStatusFilter') || {}).value || 'pending';
    document.querySelectorAll('.sw-seg-status .sw-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.status === st));
    document.querySelectorAll('.swap-filter-btn').forEach(b => b.classList.toggle('on', b.id === `btnFilterSwap${activeSwapTypeFilter}`));
    window.swapSyncPairUI();
    const tabBtn = document.getElementById('swTabCreate'); if (tabBtn) tabBtn.style.display = _swCanManage() ? '' : 'none';
    window.swapSetMainTab(window._swTab || 'list');
};

// ==========================================
// 👁️ ตัวกรองหน้าสลับกะ (Filter)
// ==========================================
window.setSwapTypeFilter = function(type) {
    activeSwapTypeFilter = type;
    document.querySelectorAll('.swap-filter-btn').forEach(btn => btn.classList.toggle('on', btn.id === `btnFilterSwap${type}`));
    window.filterSwapSchedule(); 
};

window.setSwapDeptFilter = function(dept) {
    activeSwapDeptFilter = dept;
    // [แก้] เดิมไล่แค่ AM/OD/TRAINER → กดผู้สอน AM/OD แล้วปุ่มไม่ติดสถานะเลือก
    ['AM', 'OD', 'AMQL', 'ODQL'].forEach(d => {
        const btn = document.getElementById(`btnSwapDept${d}`);
        if (btn) btn.classList.toggle('active', d === dept);
    });

    const deptSelect = document.getElementById('swapDeptSelect');
    if (deptSelect && deptSelect.value !== dept) { deptSelect.value = dept; if(typeof clearExcludeStaff === 'function') clearExcludeStaff(); }
    
    window.fetchPublicSwapSchedule(); 
    if(typeof checkSwapBackup === 'function') window.checkSwapBackup(); 
};

// ==========================================
// 📊 ดึงตารางสลับกะมาแสดง (แบ่งกลุ่มตามวันที่สลับ)
// ==========================================
window.fetchPublicSwapSchedule = async function() {
    const box = document.getElementById('publicSwapList');
    if (!box) return;
    box.innerHTML = `<div class="sw-empty"><span class="material-icons sw-spin">sync</span>กำลังดึงข้อมูลตารางสลับกะ…</div>`;

    try {
        const statusFilterEl = document.getElementById('swapStatusFilter');
        const statusMode = statusFilterEl ? statusFilterEl.value : 'pending';
        let statusesToFetch = statusMode === 'pending' ? ['pending', 'info_only'] : ['completed'];

        let query = appDB.from('scheduled_tasks').select('id, task_type, payload, scheduled_for, status, created_at').eq('task_type', 'individual_shift_update').in('status', statusesToFetch);
        if (statusMode === 'pending') query = query.order('status', { ascending: false }).order('scheduled_for', { ascending: true });
        else query = query.order('scheduled_for', { ascending: false }).limit(200);

        const { data, error } = await query;
        if (error) throw error;

        let countMorning = 0; let countNight = 0; let countSame = 0; let validDataCount = 0;
        const groups = new Map();   // key → { title, icon, items[] }
        const canManageSwap = _swCanManage();

        if (data && data.length > 0) {
            const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];
            window._swapScheduleTasks = Object.fromEntries(data.map(t => [t.id, t]));

            data.forEach(task => {
                let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}
                const userName = String(p.user_name || 'ไม่ทราบชื่อ'); 
                const targetShift = String(p.target_shift || '');
                let origShift = String(p.original_shift || ''); 

                const dbUser = safeUserList.find(u => u.username === userName);
                const userDept = dbUser ? (dbUser.department || 'AM') : 'AM';

                if (activeSwapDeptFilter !== 'ALL') {
                    if (activeSwapDeptFilter === 'TRAINER') { if (userDept === 'AM' || userDept === 'OD') return; } 
                    else { if (userDept !== activeSwapDeptFilter) return; }
                }

                validDataCount++; 
                if (!origShift && (task.status === 'info_only' || targetShift === 'คงเดิม')) {
                    if (p.display_desc && p.display_desc.includes('เช้า')) origShift = 'กะเช้า';
                    if (p.display_desc && p.display_desc.includes('ดึก')) origShift = 'กะดึก';
                }
                
                let dateStr = '-';
                if (task.scheduled_for) dateStr = new Date(task.scheduled_for).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

                // ขั้นตอน (จาก display_desc "A → B → C") → แสดงเป็นลำดับขั้นอ่านง่าย
                // สีตามความหมายของแต่ละขั้น (แบบเดิม): ไปดึก = ส้ม(เช้าวันสุดท้าย) → ม่วง(เริ่มดึก)
                //                                      ไปเช้า = ม่วง(ดึกคืนสุดท้าย) → เหลือง(หยุดพัก) → เขียว(เริ่มเช้า)
                const steps = (txt, colors) => {
                    const sep = txt.includes(' → ') ? ' → ' : ' | ';
                    const parts = txt.split(sep).map(x => x.trim()).filter(Boolean);
                    return parts.map((part, i) => {
                        const c = (i === parts.length - 1) ? colors[colors.length - 1] : (colors[i] || colors[colors.length - 2] || colors[0]);
                        return `<span class="sw-st sw-c-${c}${i === parts.length - 1 ? ' last' : ''}">${_swEsc(part)}</span>`;
                    }).join('<span class="material-icons sw-arrow">arrow_forward</span>');
                };

                let icon = '', kind = '', actionTitle = '', detailHtml = '';
                let swapTypeForFilter = 'same'; 

                if (task.status === 'info_only' || targetShift === 'คงเดิม') {
                    if (origShift === 'กะเช้า') { icon = 'wb_sunny'; actionTitle = 'อยู่เช้าต่อ (ไม่ได้สลับ)'; kind = 'same sw-k-same-m'; }
                    else if (origShift === 'กะดึก') { icon = 'dark_mode'; actionTitle = 'อยู่ดึกต่อ (ไม่ได้สลับ)'; kind = 'same sw-k-same-n'; }
                    else { icon = 'person_off'; actionTitle = 'อยู่กะเดิม (ไม่ได้สลับ)'; kind = 'same'; }
                    detailHtml = `<span class="sw-st-plain">${_swEsc(p.display_desc || 'อยู่กะเดิมในรอบนี้')}</span>`;
                    swapTypeForFilter = 'same'; countSame++; 
                } 
                else if (targetShift === 'กะดึก') {
                    icon = 'dark_mode'; kind = 'night'; actionTitle = 'สลับไปดึก';
                    detailHtml = p.display_desc ? steps(p.display_desc, ['o', 'p']) : `<span class="sw-st sw-c-p last">เริ่มเข้าดึก ${_swEsc(dateStr)}</span>`;
                    swapTypeForFilter = 'night'; countNight++;
                }
                else if (targetShift === 'กะเช้า') {
                    icon = 'wb_sunny'; kind = 'morning'; actionTitle = 'สลับไปเช้า';
                    detailHtml = p.display_desc ? steps(p.display_desc, ['p', 'y', 'g']) : `<span class="sw-st sw-c-g last">เริ่มเข้าเช้า ${_swEsc(dateStr)}</span>`;
                    swapTypeForFilter = 'morning'; countMorning++;
                }

                let completedBadge = '';
                if (task.status === 'completed') {
                    kind = 'done';
                    completedBadge = `<span class="sw-done"><span class="material-icons">check_circle</span>สำเร็จแล้ว</span>`;
                }

                const isMe = userName === ((typeof currentUser !== 'undefined' && currentUser && currentUser.username) || '');
                const adminDelete = canManageSwap ? `<button onclick="deleteTask(${task.id}); setTimeout(fetchPublicSwapSchedule, 500);" class="sw-del" title="${task.status === 'completed' ? 'ลบประวัตินี้' : 'ยกเลิกคิวนี้'}"><span class="material-icons">delete</span></button>` : '';

                // ป้ายแผนก: เดิมผู้สอนทุกแบบขึ้น "AMQL" (ODQL ก็ขึ้น AMQL) → ขึ้นตามจริง
                const displayDeptBadge = (userDept === 'AM' || userDept === 'OD' || userDept === 'AMQL' || userDept === 'ODQL') ? userDept : 'ผู้สอน';

                const canEditSaved = canManageSwap && task.status !== 'completed';
                const userNameHtml = canEditSaved
                    ? `<span onclick="openSavedSwapMenu(${task.id})" class="sw-link" title="คลิกเพื่อจัดการ">${_swEsc(userName)}</span>`
                    : _swEsc(userName);

                const html = window.renderTemplate('tpl-swap-schedule-item', {
                    kind: kind,
                    myHighlight: isMe ? 'sw-me' : '',
                    safeSearchName: _swEsc(userName.toLowerCase()),
                    swapTypeForFilter: swapTypeForFilter,
                    userDept: _swEsc(userDept),
                    completedBadge: completedBadge,
                    adminDelete: adminDelete,
                    icon: icon,
                    userNameHtml: userNameHtml,
                    displayDeptBadge: _swEsc(displayDeptBadge),
                    isMeBadge: isMe ? '<span class="sw-me-badge">คุณ</span>' : '',
                    actionTitle: actionTitle,
                    detailHtml: detailHtml
                });

                // กลุ่ม: คนที่สลับ → ตามวันที่สลับ / คนที่อยู่กะเดิม → กลุ่มเดียวท้ายสุด
                const same = swapTypeForFilter === 'same' && task.status !== 'completed';
                const dKey = task.scheduled_for ? String(task.scheduled_for).slice(0, 10) : 'none';
                const key = same ? '~same' : dKey;
                if (!groups.has(key)) {
                    let title = 'ไม่ระบุวันที่';
                    if (same) title = 'อยู่กะเดิม · ไม่ได้สลับรอบนี้';
                    else if (dKey !== 'none') title = new Date(dKey + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    groups.set(key, { title, icon: same ? 'person_off' : 'event', items: [] });
                }
                groups.get(key).items.push(html);
            });
        }

        if (validDataCount === 0) {
            const noDataMsg = statusMode === 'pending' ? 'ไม่มีกำหนดการสลับกะในช่วงนี้' : 'ยังไม่มีประวัติการสลับกะที่สำเร็จแล้ว';
            box.innerHTML = `<div class="sw-empty"><span class="material-icons">${statusMode === 'pending' ? 'event_available' : 'history'}</span>${noDataMsg}</div>`;
        } else {
            const ordered = [...groups.entries()].sort((a, b) => (a[0] === '~same') - (b[0] === '~same'));   // กลุ่มอยู่กะเดิมไว้ท้าย
            box.innerHTML = ordered.map(([, g]) => `<section class="sw-group">
                <div class="sw-group-h"><span class="sw-group-date"><span class="material-icons">${g.icon}</span>${_swEsc(g.title)}</span><span class="sw-group-n">${g.items.length} คน</span></div>
                <div class="sw-grid">${g.items.join('')}</div>
            </section>`).join('');
        }

        if (canManageSwap) {
            const set = (id, n) => { const el = document.getElementById(id); if (el) el.innerText = n; };
            set('statSwapMorning', countMorning); set('statSwapNight', countNight); set('statSwapSame', countSame);
            set('statSwapAll', countMorning + countNight + countSame);
        }

        window.filterSwapSchedule();
    } catch (err) {
        box.innerHTML = `<div class="sw-empty err"><span class="material-icons">error_outline</span>เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    }
}

// ==========================================
// 🔍 ฟังก์ชันค้นหา & กรอง
// ==========================================
window.filterSwapSchedule = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (!input) return;
    const filterText = input.value.toLowerCase().trim();
    const items = document.querySelectorAll('.swap-item');
    
    let foundCount = 0;
    items.forEach(item => {
        const name = item.dataset.name || ''; const type = item.dataset.swaptype || ''; const dept = item.dataset.dept || 'AM'; 
        
        const matchName = name.includes(filterText);
        const matchType = (activeSwapTypeFilter === 'all') || (type === activeSwapTypeFilter);
        let matchDept = false;
        if (activeSwapDeptFilter === 'TRAINER') matchDept = (dept !== 'AM' && dept !== 'OD'); 
        else matchDept = (dept === activeSwapDeptFilter);

        if (matchName && matchType && matchDept) { item.style.display = 'flex'; foundCount++; } 
        else { item.style.display = 'none'; }
    });

    // กลุ่มวันที่ไม่มีใครเหลือหลังกรอง → ซ่อนทั้งกลุ่ม + อัปเดตจำนวนคนที่หัวกลุ่ม
    document.querySelectorAll('#publicSwapList .sw-group').forEach(g => {
        const n = [...g.querySelectorAll('.swap-item')].filter(it => it.style.display !== 'none').length;
        g.style.display = n ? '' : 'none';
        const c = g.querySelector('.sw-group-n'); if (c) c.textContent = n + ' คน';
    });

    const box = document.getElementById('publicSwapList');
    let noResultMsg = document.getElementById('noSwapResult');
    
    if (items.length && foundCount === 0) {
        if (!noResultMsg) box.insertAdjacentHTML('beforeend', `<div id="noSwapResult" class="sw-empty"><span class="material-icons">search_off</span>ไม่พบรายชื่อตามเงื่อนไขที่ค้นหา</div>`);
        else noResultMsg.style.display = '';
    } else if (noResultMsg) { noResultMsg.style.display = 'none'; }
}

window.filterSwapToMyself = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (input && currentUser && currentUser.username) {
        input.value = currentUser.username; filterSwapSchedule(); 
    }
}

window.highlightSwapPreview = function() {
    const input = document.getElementById('searchSwapPreview');
    if (!input) return;
    const term = input.value.toLowerCase().trim();
    const tags = document.querySelectorAll('#planDaysContainer span[draggable="true"]');

    tags.forEach(tag => {
        const name = tag.innerText.toLowerCase();
        if (term === '') {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else if (name.includes(term)) {
            tag.classList.add('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '0.2';
        }
    });
};

// ==========================================
// 🗑️ ลบ และ กู้คืน ตารางสลับกะ
// ==========================================
window.checkSwapBackup = function() {
    const btn = document.getElementById('btnRestoreSwap');
    if (!btn) return;
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (backupData && JSON.parse(backupData).length > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
};

// 🟨 หาวันที่ลง XX ของงานสลับกะ 1 รายการ (กติกาเดียวกับตอนสร้าง: ดึก→เช้า ลง XX วันก่อนเข้าเช้า, เช้า→ดึก ลง XX วันที่สลับ)
function _swapTaskXXDate(task) {
    let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload; } catch (e) {}
    if (!p || !p.user_id || !task.scheduled_for || p.target_shift === 'คงเดิม') return null;
    const swapDate = String(task.scheduled_for).split('T')[0];
    const offset = p.target_shift === 'กะเช้า' ? -1 : 0;
    return { user_id: p.user_id, user_name: p.user_name, leave_date: getSafeDateStr(swapDate, offset) };
}

window.deleteAllSwapSchedules = async function() {
    const isGlobalAdmin = canPerm('swap_manage');
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) return;
    
    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;

    Swal.fire({
        title: `ล้างตารางสลับกะ ${deptName}?`, text: `ข้อมูลการสลับกะจะถูกลบ (สามารถกดกู้คืนได้ภายหลัง)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ใช่, ลบทิ้งเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังลบข้อมูล...', didOpen: () => Swal.showLoading() });
            try {
                const { data } = await appDB.from('scheduled_tasks').select('id, task_type, payload, scheduled_for, status').eq('task_type', 'individual_shift_update');
                if (data && data.length > 0) {
                    const idsToDelete = []; const tasksToBackup = [];
                    const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];

                    data.forEach(task => {
                        let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload; } catch(e){}
                        const dbUser = safeUserList.find(u => u.username === p.user_name);
                        const uDept = dbUser ? (dbUser.department || 'AM') : 'AM';
                        
                        let isMatch = false;
                        if (activeSwapDeptFilter === 'TRAINER') isMatch = (uDept !== 'AM' && uDept !== 'OD');
                        else isMatch = (uDept === activeSwapDeptFilter);

                        if (isMatch) { idsToDelete.push(task.id); tasksToBackup.push(task); }
                    });

                    if (idsToDelete.length > 0) {
                        window.safeSetItem(`backup_swap_${activeSwapDeptFilter}`, JSON.stringify(tasksToBackup));
                        await appDB.from('scheduled_tasks').delete().in('id', idsToDelete);

                        // 🟨 [FIX] ลบวันหยุด XX ที่ตารางสลับกะชุดนี้ลงไว้ด้วย — เดิมลบแต่งาน ทำให้ XX เหลืองค้างในตารางวันหยุด
                        const xxRows = tasksToBackup.map(_swapTaskXXDate).filter(Boolean);
                        for (const x of xxRows) {
                            await appDB.from('leave_requests').delete().eq('user_id', x.user_id).eq('leave_date', x.leave_date).eq('reason', 'XX');
                        }
                    }
                }
                
                if(typeof logAction === 'function') await logAction('Auto Swap Delete', `ลบตารางสลับกะเฉพาะแผนก ${deptName} แล้ว`);

                Swal.fire('ลบสำเร็จ', `เคลียร์ข้อมูลของแผนก ${deptName} เรียบร้อย`, 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); if (typeof fetchLeaveData === 'function') fetchLeaveData();
            } catch (err) { Swal.fire('Error', 'ไม่สามารถลบข้อมูลได้', 'error'); }
        }
    });
}

window.restoreDeletedSwapSchedules = async function() {
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (!backupData) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลที่สามารถกู้คืนได้ในขณะนี้', 'error');

    let tasksToRestore = [];
    try { tasksToRestore = JSON.parse(backupData); } catch(e) { return Swal.fire('Error', 'ข้อมูลสำรองเสียหาย', 'error'); }
    if (tasksToRestore.length === 0) return Swal.fire('ไม่พบข้อมูล', 'ข้อมูลสำรองว่างเปล่า', 'error');

    Swal.fire({
        title: 'กู้คืนข้อมูล?', text: `ระบบจะนำตารางสลับกะที่เพิ่งลบไป ${tasksToRestore.length} รายการ กลับมาใช้งานอีกครั้ง`, icon: 'question',
        showCancelButton: true, confirmButtonColor: '#10b981', confirmButtonText: 'กู้คืนเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังกู้คืน...', didOpen: () => Swal.showLoading()});
            try {
                const insertPayload = tasksToRestore.map(t => { const { id, created_at, ...rest } = t; return rest; });
                const { error } = await appDB.from('scheduled_tasks').insert(insertPayload);
                if (error) throw error;

                // 🟨 [FIX] กู้ XX กลับมาด้วย (ลบไปตอนล้างตาราง) — เฉพาะงานที่ยังไม่ผ่านไปแล้ว
                const xxRows = tasksToRestore.filter(t => t.status === 'pending').map(_swapTaskXXDate).filter(Boolean);
                if (xxRows.length) {
                    for (const x of xxRows) await appDB.from('leave_requests').delete().eq('user_id', x.user_id).eq('leave_date', x.leave_date).eq('reason', 'XX');
                    await appDB.from('leave_requests').insert(xxRows.map(x => ({ ...x, reason: 'XX', status: 'approved' })));
                }

                localStorage.removeItem(`backup_swap_${activeSwapDeptFilter}`);
                
                if(typeof logAction === 'function') {
                    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;
                    await logAction('Auto Swap Restore', `กู้คืนตารางสลับกะแผนก ${deptName}`);
                }

                Swal.fire('กู้คืนสำเร็จ', 'ข้อมูลสลับกะกลับมาเรียบร้อยแล้ว', 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); if (typeof fetchLeaveData === 'function') fetchLeaveData();
            } catch (err) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการกู้คืน', 'error'); }
        }
    });
};

// ==========================================
