// ════════════════════════════════════════════════════════════════════
// 📦 sheet/core.js — ส่วนที่ 1/4 ของตารางงานรวม (ชีต) (แยกจาก sheet.js เดิม 1,616 บรรทัด)
// เนื้อหา: โหลดชีต, ระบบชีตส่วนตัว, เมนูการ์ด, เครื่องคิดเลข
// ⚠️ ลำดับโหลด: sheet/core → sheet/note_view → sheet/note_edit → sheet/admin (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 📊 ระบบตารางงานรวม (SHEETS MANAGER)
// ==========================================

window.GLOBAL_SHEETS = [];
window.currentActiveTabId = null;
let recentTabs = JSON.parse(localStorage.getItem('sheet_recent_tabs') || '[]');

// ==========================================
// 👤 [ชีตส่วนตัว] ระบบชีตของใครของมัน
// - external_sheets มีคอลัมน์ owner (null = ชีตส่วนกลาง, มีชื่อ = ชีตส่วนตัวของ user นั้น)
// - พนักงานทุกคนสร้าง/แก้/ลบ "ชีตของตัวเอง" ได้ผ่านปุ่ม "+ ชีตของฉัน"
// - ปุ่ม "จัดการชีท" (ชีตส่วนกลาง) ยังเป็นของ manager/admin เหมือนเดิม
// ==========================================
window.MY_SHEET_GROUP = 'ชีตของฉัน';
window._sheetPersonalMode = false;   // true = modal กำลังทำงานกับชีตส่วนตัว

window.sheetMe = function() {
    return (window.currentUser && window.currentUser.username) ? String(window.currentUser.username) : '';
};
window.sheetIsMgr = function() {
    const r = window.currentUser && window.currentUser.role ? String(window.currentUser.role).toLowerCase().trim() : '';
    return r === 'admin' || r === 'manager';
};
// แก้/ลบชีตนี้ได้ไหม: ชีตส่วนกลาง → เฉพาะ mgr | ชีตส่วนตัว → เจ้าของเท่านั้น (mgr แก้ของคนอื่นไม่ได้ เพราะของใครของมัน)
window.sheetCanTouch = function(sheet) {
    if (!sheet) return false;
    if (sheet.owner) return sheet.owner === window.sheetMe();
    return window.sheetIsMgr();
};

// ==========================================
// 🟢 1. โหลดข้อมูล & สร้าง UI
// ==========================================
window.initSheetApp = async function() {
    // ปุ่ม "จัดการชีท" (ชีตส่วนกลาง) — เฉพาะ manager/admin
    const adminControls = document.getElementById('sheetAdminControls');
    if (adminControls) adminControls.classList.toggle('hidden', !window.sheetIsMgr());
    // ปุ่ม "+ ชีตของฉัน" — ทุกคนเห็น
    const myBtn = document.getElementById('btnMySheets');
    if (myBtn) myBtn.classList.remove('hidden');
    loadCalcSettings();
    await fetchSheets();
};

window.fetchSheets = async function(force) {
    try {
        if (typeof appDB === 'undefined') return;
        // 🗃️ cache 60 วิ: เข้าๆ ออกๆ หน้านี้บ่อยๆ ไม่ต้องยิง DB ทุกรอบ (บันทึก/ลบชีตจะล้าง cache ให้เอง)
        let data = (!force && window.dbCache) ? window.dbCache.get('ext_sheets') : undefined;
        if (data === undefined) {
            const res = await appDB.from('external_sheets').select('*').order('id', { ascending: true });
            if (res.error) throw res.error;
            data = res.data || [];
            if (window.dbCache) window.dbCache.set('ext_sheets', data, 60000);
        }
        
        // 👤 ของใครของมัน: เก็บเฉพาะชีตส่วนกลาง (owner ว่าง) + ชีตที่ตัวเองเป็นเจ้าของ
        const me = window.sheetMe();
        window.GLOBAL_SHEETS = (data || []).filter(s => !s.owner || s.owner === me);
        renderSheetMenu();
        populateCalcTeamDropdown(); 
        if(typeof renderAdminSheetList === 'function') renderAdminSheetList();
        renderRecentTabs();
    } catch (err) { console.error('Fetch Sheets Error:', err); }
};

function populateCalcTeamDropdown() {
    const datalist = document.getElementById('calcTeamOptions');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    const teamNames = window.GLOBAL_SHEETS
        .filter(s => !s.owner && s.group_name !== 'วันหยุด / เปลี่ยนกะ' && s.group_name !== 'แก้ไขข้อมูล')
        .map(s => s.name || s.title)
        .filter(Boolean);
        
    const uniqueTeams = [...new Set(teamNames)];
    
    uniqueTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        datalist.appendChild(option);
    });
}

window.renderSheetMenu = function() {
    const container = document.getElementById('sheetGroupsContainer');
    const searchInput = document.getElementById('sheetSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if(!container) return;
    container.innerHTML = '';
    
    const pinnedIds = JSON.parse(localStorage.getItem('pinned_sheets') || '[]');
    const groups = {}; const pinnedSheets = [];

    window.GLOBAL_SHEETS.forEach(sheet => {
        if(searchTerm && !sheet.name.toLowerCase().includes(searchTerm) && !(sheet.group_name && sheet.group_name.toLowerCase().includes(searchTerm))) return;
        if (pinnedIds.includes(sheet.id)) pinnedSheets.push(sheet);
        const gName = sheet.group_name || 'ทั่วไป';
        if(!groups[gName]) groups[gName] = [];
        groups[gName].push(sheet);
    });

    if(Object.keys(groups).length === 0 && pinnedSheets.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500"><span class="material-icons text-6xl mb-4 opacity-20">search_off</span><p class="font-bold text-lg">ไม่พบตารางงานที่คุณค้นหา</p></div>`;
        return;
    }

    const createCard = (sheet, isPinned) => {
        const finalUrl = sheet.sheet_id || sheet.url || '';
        const isExternal = finalUrl.startsWith('http') || finalUrl.startsWith('www');
        const iconType = isExternal ? 'public' : 'grid_view';
        const starIcon = isPinned ? 'star' : 'star_outline';
        const starClass = isPinned ? 'text-amber-400 opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:scale-110';
        
        const isHex = sheet.color && sheet.color.startsWith('#');
        const themeColor = isHex ? sheet.color : '#3b82f6';
        const tName = sheet.name || sheet.title || 'ไม่มีชื่อ';

        if (sheet.cover_url && sheet.cover_url.trim() !== '') {
            return window.renderTemplate('tpl-sheet-card-img', {
                id: sheet.id,
                cover_url: sheet.cover_url,
                iconType: iconType,
                title: tName,
                starClass: starClass,
                starIcon: starIcon
            });
        } else {
            const colorStyles = {
                'blue':   { bar: 'from-blue-400 to-indigo-500', iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-500 dark:text-blue-400' },
                'green':  { bar: 'from-emerald-400 to-green-500', iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-500 dark:text-emerald-400' },
                'red':    { bar: 'from-rose-400 to-red-500', iconBg: 'bg-rose-50 dark:bg-rose-900/20', iconColor: 'text-rose-500 dark:text-rose-400' },
                'yellow': { bar: 'from-amber-300 to-orange-400', iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-500 dark:text-amber-400' },
                'purple': { bar: 'from-fuchsia-400 to-purple-500', iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', iconColor: 'text-fuchsia-500 dark:text-fuchsia-400' },
                'gray':   { bar: 'from-slate-400 to-gray-500', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-600 dark:text-slate-400' }
            };
            let style = colorStyles[sheet.color] || colorStyles['blue'];
            let topBar = `<div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${style.bar}"></div>`;
            let iconWrapper = `<div class="w-12 h-12 rounded-2xl ${style.iconBg} ${style.iconColor} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner"><span class="material-icons text-[26px]">${iconType}</span></div>`;

            if (isHex) {
                topBar = `<div class="absolute top-0 left-0 w-full h-1.5" style="background: linear-gradient(to right, ${themeColor}, ${themeColor}88);"></div>`;
                iconWrapper = `<div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner" style="background-color: ${themeColor}15; color: ${themeColor};"><span class="material-icons text-[26px]">${iconType}</span></div>`;
            }

            return window.renderTemplate('tpl-sheet-card-color', {
                id: sheet.id,
                topBar: topBar,
                iconWrapper: iconWrapper,
                title: tName,
                starClass: starClass,
                starIcon: starIcon
            });
        }
    };

    if (pinnedSheets.length > 0 && !searchTerm) {
        let pinHTML = `<div class="mb-10"><h2 class="text-sm font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2"><span class="material-icons text-base">push_pin</span> ปักหมุดแล้ว</h2><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">`;
        pinnedSheets.forEach(sheet => { pinHTML += createCard(sheet, true); });
        pinHTML += `</div></div>`;
        container.innerHTML += pinHTML;
    }

    // 👤 กลุ่ม "ชีตของฉัน" (ชีตส่วนตัว) ขึ้นบนสุดเสมอ — เห็นคนเดียว
    const myGroupKeys = Object.keys(groups).filter(g => (groups[g] || []).some(s => s.owner));
    myGroupKeys.forEach(gName => {
        const mySheets = groups[gName].filter(s => s.owner);
        groups[gName] = groups[gName].filter(s => !s.owner);
        if (groups[gName].length === 0) delete groups[gName];
        let gridHTML = `<div class="mb-10"><h2 class="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span class="material-icons text-base">person</span> ${gName === window.MY_SHEET_GROUP ? 'ชีตของฉัน' : gName} <span class="text-[10px] font-bold normal-case tracking-normal bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1"><span class="material-icons text-[12px]">lock</span> เห็นเฉพาะคุณ</span></h2><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">`;
        mySheets.forEach(sheet => { gridHTML += createCard(sheet, pinnedIds.includes(sheet.id)); });
        gridHTML += `</div></div>`;
        container.innerHTML += gridHTML;
    });

    const sortedGroupNames = Object.keys(groups).sort();
    for (const groupName of sortedGroupNames) {
        const sheets = groups[groupName];
        let gridHTML = `<div class="mb-10"><h2 class="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><span class="material-icons text-base">folder_open</span> ${groupName}</h2><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">`;
        sheets.forEach(sheet => { gridHTML += createCard(sheet, pinnedIds.includes(sheet.id)); });
        gridHTML += `</div></div>`;
        container.innerHTML += gridHTML;
    }
};

window.togglePin = function(e, id) {
    e.stopPropagation();
    let pinned = JSON.parse(localStorage.getItem('pinned_sheets') || '[]');
    if (pinned.includes(id)) pinned = pinned.filter(pid => pid !== id);
    else pinned.push(id);
    window.safeSetItem('pinned_sheets', JSON.stringify(pinned));
    renderSheetMenu();
};

// ==========================================
// 🟢 2. เครื่องคิดเลข (Calculator System)
// ==========================================
const CALC_STORAGE_KEY = 'calc_local_team_list';

window.initCalculator = async function() {
    const teamSelect = document.getElementById('calcTeamSelect');
    const deductInput = document.getElementById('calcDeductAmount');
    const saveBtn = document.getElementById('btnSaveCalc');
    const lockIcon = document.getElementById('calcLockIcon');
    const addBtn = document.getElementById('btnCalcAdd');
    const delBtn = document.getElementById('btnCalcDelete');

    let isAdmin = false;
    if (typeof window.currentUser !== 'undefined' && window.currentUser.role) {
        const role = window.currentUser.role.toLowerCase().trim();
        if (role === 'manager' || role === 'admin') isAdmin = true;
    }

    if (teamSelect) {
        teamSelect.innerHTML = '';
        const teamNames = window.GLOBAL_SHEETS
            .filter(s => !s.owner && s.group_name !== 'วันหยุด / เปลี่ยนกะ' && s.group_name !== 'แก้ไขข้อมูล' && s.group_name !== 'งาน OD')
            .map(s => s.name || s.title)
            .filter(Boolean);
            
        let uniqueTeams = [...new Set(teamNames)];
        const localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
        uniqueTeams = [...new Set([...uniqueTeams, ...localTeams])];

        if (uniqueTeams.length > 0) {
            uniqueTeams.forEach(t => { teamSelect.innerHTML += `<option value="${t}">${t}</option>`; });
        } else {
            teamSelect.innerHTML = `<option value="General">ทั่วไป</option>`;
        }
        
        const savedTeam = localStorage.getItem('calc_saved_team');
        if (savedTeam && uniqueTeams.includes(savedTeam)) {
            teamSelect.value = savedTeam;
        }
    }

    if (deductInput && saveBtn && lockIcon) {
        if (isAdmin) {
            deductInput.disabled = false;
            deductInput.className = "w-full p-3 rounded-lg border border-slate-600 bg-[#0f172a] text-white text-base font-black text-center outline-none focus:border-purple-500 shadow-inner";
            
            saveBtn.classList.remove('hidden');
            lockIcon.innerText = 'lock_open';
            lockIcon.classList.remove('text-red-400', 'opacity-50');
            lockIcon.classList.add('text-green-500', 'opacity-100');
            if(addBtn) addBtn.classList.remove('hidden');
            if(delBtn) delBtn.classList.remove('hidden');
        } else {
            deductInput.disabled = true;
            deductInput.className = "w-full p-3 rounded-lg border border-red-900/50 bg-red-950/50 text-rose-200 text-base font-black text-center outline-none shadow-inner opacity-100";
            
            saveBtn.classList.add('hidden');
            lockIcon.innerText = 'lock';
            lockIcon.classList.remove('text-green-500', 'opacity-100');
            lockIcon.classList.add('text-red-400', 'opacity-50');
            if(addBtn) addBtn.classList.add('hidden');
            if(delBtn) delBtn.classList.add('hidden');
        }
    }
    
    loadCalcSettings();
};

window.loadCalcSettings = async function() {
    const selectElem = document.getElementById('calcTeamSelect');
    if (!selectElem) return;
    
    const team = selectElem.value;
    window.safeSetItem('calc_saved_team', team); 
    
    let savedVal = 0;
    try {
        if (typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', `calc_deduct_${team}`).maybeSingle();
            if (data && data.value) savedVal = parseFloat(data.value);
        }
    } catch(e) {}
    
    const deductElem = document.getElementById('calcDeductAmount');
    if(deductElem) deductElem.value = savedVal;
    calculateMoney();
};

window.calculateMoney = function() {
    const inputElem = document.getElementById('calcInputAmount');
    const deductElem = document.getElementById('calcDeductAmount');
    const displayElem = document.getElementById('calcResultDisplay');

    if(!inputElem || !deductElem || !displayElem) return;

    const amount = parseFloat(inputElem.value) || 0;
    const deduct = parseFloat(deductElem.value) || 0;
    const result = amount - deduct;
    
    displayElem.innerText = result.toLocaleString('en-US');
    
    if (result < 0) { displayElem.className = "flex-1 bg-slate-950 text-rose-500 text-4xl font-black p-4 rounded-2xl text-right shadow-inner flex items-center justify-end overflow-hidden border border-rose-900/50"; }
    else if (result > 0) { displayElem.className = "flex-1 bg-slate-950 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-4xl font-black p-4 rounded-2xl text-right shadow-inner flex items-center justify-end overflow-hidden border border-emerald-900/50"; }
    else { displayElem.className = "flex-1 bg-slate-950 text-slate-500 text-4xl font-black p-4 rounded-2xl text-right shadow-inner flex items-center justify-end overflow-hidden border border-slate-800"; }
};

window.saveCalcSettings = async function() {
    const team = document.getElementById('calcTeamSelect').value;
    const deductVal = document.getElementById('calcDeductAmount').value;
    
    if(typeof appDB !== 'undefined') {
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        const { error } = await appDB.from('settings').upsert([{ key: `calc_deduct_${team}`, value: deductVal }]);
        if (!error) {
            Swal.fire({ icon: 'success', title: 'บันทึกค่าหักแล้ว', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            calculateMoney();
        } else {
            Swal.fire('ข้อผิดพลาด', 'บันทึกไม่สำเร็จ', 'error');
        }
    }
};

window.addNewCalcTeam = async function() {
    const { value: newTeam } = await Swal.fire({ title: 'เพิ่มชื่อเว็บ/ทีม', input: 'text', inputPlaceholder: 'พิมพ์ชื่อเว็บตรงนี้...', showCancelButton: true });
    if (newTeam) {
        let localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
        if(!localTeams.includes(newTeam)) {
            localTeams.push(newTeam);
            window.safeSetItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
            await initCalculator();
            document.getElementById('calcTeamSelect').value = newTeam;
            loadCalcSettings();
        }
    }
};

window.deleteCalcTeam = async function() {
    const team = document.getElementById('calcTeamSelect').value;
    if(!team) return;
    
    const result = await Swal.fire({ title: `ลบ ${team}?`, text: "คุณต้องการลบรายชื่อนี้ออกจากเครื่องคิดเลขใช่หรือไม่?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if(result.isConfirmed) {
        let localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
        localTeams = localTeams.filter(t => t !== team);
        window.safeSetItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
        await initCalculator();
    }
};

window.copyCalcResult = function() {
    const amount = parseFloat(document.getElementById('calcInputAmount').value) || 0;
    const deduct = parseFloat(document.getElementById('calcDeductAmount').value) || 0;
    const result = amount - deduct;
    const textToCopy = result.toString(); 

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            Swal.fire({ icon: 'success', title: 'คัดลอก: ' + textToCopy, toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
        }).catch(err => {
            fallbackCopyText(textToCopy); 
        });
    } else {
        fallbackCopyText(textToCopy);
    }
};

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) Swal.fire({ icon: 'success', title: 'คัดลอก: ' + text, toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
        else Swal.fire({ icon: 'error', title: 'คัดลอกไม่สำเร็จ', toast: true });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'คัดลอกไม่สำเร็จ', toast: true });
    }
    document.body.removeChild(textArea);
}

const oldFetchSheets = window.fetchSheets;
window.fetchSheets = async function() {
    await oldFetchSheets();
    if(typeof initCalculator === 'function') await initCalculator();
};

// ==========================================