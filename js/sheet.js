// ==========================================
// 📊 ระบบตารางงานรวม (SHEETS MANAGER)
// ==========================================

window.GLOBAL_SHEETS = [];
window.currentActiveTabId = null;
let recentTabs = JSON.parse(localStorage.getItem('sheet_recent_tabs') || '[]');

// ==========================================
// 🟢 1. โหลดข้อมูล & สร้าง UI
// ==========================================
window.initSheetApp = async function() {
    const btnManage = document.getElementById('btnManageSheet');
    if (btnManage) {
        if (window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.role === 'manager')) {
            btnManage.classList.remove('hidden');
        } else {
            btnManage.classList.add('hidden');
        }
    }
    loadCalcSettings();
    await fetchSheets();
};

window.fetchSheets = async function() {
    try {
        if (typeof appDB === 'undefined') return;
        const { data, error } = await appDB.from('external_sheets').select('*').order('id', { ascending: true });
        if (error) throw error;
        
        window.GLOBAL_SHEETS = data || [];
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
        .filter(s => s.group_name !== 'วันหยุด / เปลี่ยนกะ' && s.group_name !== 'แก้ไขข้อมูล')
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
            .filter(s => s.group_name !== 'วันหยุด / เปลี่ยนกะ' && s.group_name !== 'แก้ไขข้อมูล' && s.group_name !== 'งาน OD')
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
// 🟢 3. ระบบจัดการแท็บ และเปิด iFrame
// ==========================================
window.renderRecentTabs = function() {
    const container = document.getElementById('recentTabsContainer');
    if (!container) return;
    
    if (recentTabs.length === 0) { 
        container.classList.add('hidden'); 
        return; 
    }
    container.classList.remove('hidden');

    let html = recentTabs.map(tab => {
        const isViewerVisible = !document.getElementById('sheetViewer').classList.contains('hidden');
        const isActive = (String(window.currentActiveTabId) === String(tab.id)) && isViewerVisible;
        const activeClass = isActive ? 'bg-white text-blue-700 font-black' : 'bg-gray-300 text-gray-600 hover:bg-gray-200 font-bold opacity-80';
        const urlToCheck = tab.sheet_id || tab.url || '';
        const icon = (urlToCheck.startsWith('http') || urlToCheck.startsWith('www')) ? 'link' : 'table_chart';
        const tName = tab.name || tab.title || 'ไม่มีชื่อ';

        return window.renderTemplate('tpl-sheet-recent-tab', {
            id: tab.id,
            activeClass: activeClass,
            icon: icon,
            title: tName
        });
    }).join('');

    if (recentTabs.length > 1) { 
        html += `<button onclick="clearAllTabs()" class="ml-2 px-2 pb-2 text-[10px] text-red-500 hover:text-red-400 underline shrink-0">ล้างทั้งหมด</button>`; 
    }
    container.innerHTML = html;
};

window.openSheetById = function(id) {
    const tab = recentTabs.find(t => String(t.id) === String(id)) || window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if(tab) openSheet(tab);
};

window.addToRecentTabs = function(sheet) {
    recentTabs = recentTabs.filter(t => t.id !== sheet.id);
    recentTabs.unshift(sheet);
    if (recentTabs.length > 10) recentTabs.pop();
    window.safeSetItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    renderRecentTabs();
};

window.closeTab = function(e, id) {
    e.stopPropagation();
    recentTabs = recentTabs.filter(t => String(t.id) !== String(id));
    window.safeSetItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    
    if (recentTabs.length === 0) {
        closeSheet(); 
    } else {
        if (String(window.currentActiveTabId) === String(id)) {
            openSheet(recentTabs[0]); 
        } else {
            renderRecentTabs(); 
        }
    }
};

window.clearAllTabs = function() {
    recentTabs = [];
    window.safeSetItem('sheet_recent_tabs', '[]');
    renderRecentTabs();
    closeSheet();
};

window.openSheet = function(sheet) {
    window.currentActiveTabId = sheet.id;
    
    document.getElementById('sheetMenu').classList.add('hidden');
    const viewer = document.getElementById('sheetViewer');
    viewer.classList.remove('hidden');
    viewer.classList.add('flex');
    
    const gName = sheet.group_name || sheet.category || 'ทั่วไป';
    const sName = sheet.name || sheet.title || 'ไม่มีชื่อ';
    document.getElementById('sheetTitle').innerHTML = `<span class="text-gray-500">${gName}</span> <span class="material-icons text-[10px] mx-1 text-gray-600">arrow_forward_ios</span> <span class="text-white font-bold text-sm">${sName}</span>`;
    
    document.getElementById('sheetLoading').classList.remove('hidden');
    addToRecentTabs(sheet);

    let url = sheet.sheet_id || sheet.url || '';

    // 📝 หน้าข้อความที่สร้างในระบบ → ไม่ใช้ iframe โหลดทันที
    const frameEl = document.getElementById('sheetFrame');
    const noteEl = document.getElementById('noteViewer');
    if (url === 'NOTE') {
        if (frameEl) { frameEl.src = 'about:blank'; frameEl.classList.add('hidden'); }
        if (noteEl) { noteEl.classList.remove('hidden'); noteEl.classList.add('flex'); }
        const btnNT = document.getElementById('btnOpenNewTab'); if (btnNT) btnNT.classList.add('hidden');
        window.openNoteSheet(sheet);
        return;
    }
    if (frameEl) frameEl.classList.remove('hidden');
    if (noteEl) { noteEl.classList.add('hidden'); noteEl.classList.remove('flex'); }
    const btnNT2 = document.getElementById('btnOpenNewTab'); if (btnNT2) btnNT2.classList.remove('hidden');
    
    if (url.startsWith('http') || url.startsWith('www')) {
        url = url.startsWith('www') ? 'https://' + url : url;
    } 
    else if (url.length > 20 && !url.includes('/')) {
        url = `https://docs.google.com/spreadsheets/d/${url}/edit?rm=minimal&single=true&widget=true&headers=false`;
        if(sheet.gid) url += `&gid=${sheet.gid}`;
    }
    if (!url) url = 'about:blank';
    
    const btnNewTab = document.getElementById('btnOpenNewTab');
    if (btnNewTab) btnNewTab.onclick = () => window.open(url, '_blank');
    
    const frame = document.getElementById('sheetFrame');
    if(frame) {
        frame.onload = function() { window.hideSheetLoading(); };
        frame.src = url;
    }
};

window.closeSheet = function() {
    if (window._noteEditing) window.noteEditExit(false);
    const frame = document.getElementById('sheetFrame');
    if(frame) frame.src = 'about:blank';
    document.getElementById('sheetViewer')?.classList.add('hidden');
    document.getElementById('sheetViewer')?.classList.remove('flex');
    document.getElementById('sheetMenu')?.classList.remove('hidden');
    window.currentActiveTabId = null;
    renderRecentTabs();
};

window.hideSheetLoading = function() {
    document.getElementById('sheetLoading')?.classList.add('hidden');
};

// ==========================================
// 📝 หน้าข้อความที่สร้างในระบบ (ตารางแพทเทิร์น/หมายเหตุ) — เก็บใน settings key sheet_note_<id>
// โมเดล v3 (ตารางเต็ม): note = { v:3, rows:[[cell,...]], cols:[px,...] }
//   cell = { t, bg, fg, b, a('c'|'r'|null), fs(px), bd:{t,b,l,r}, bc, cs, rs, h }
//   cs/rs = ผสานไปทางขวา/ลง กี่ช่อง (เฉพาะช่อง "ต้นทาง")  h = true คือช่องที่ถูกผสานทับ (ไม่วาด)
//   เส้นตาราง: เส้นแต่ละด้านเป็น "ขอบร่วม" — ตั้งด้านขวาของช่อง A = ตั้งด้านซ้ายของช่อง B ด้วย
// รูปแบบเก่า (v1 คอลัมน์+แถว / v2 colspan) ถูกแปลงเป็น v3 ตอนเปิดอัตโนมัติ
// ==========================================
window._noteCache = {};
window._currentNote = null;
window._pendingRich = null;
window.NOTE_DEF_BC = '#000000';   // สีเส้นเริ่มต้น = ดำ
window.NOTE_DEF_FS = 14;

const _nCell = (o) => ({ t: '', bg: null, fg: null, b: false, a: null, fs: null, bd: { t: true, b: true, l: true, r: true }, bc: null, cs: 1, rs: 1, h: false, ...(o || {}) });

// ---------- แปลงรูปแบบเก่า → v3 ----------
window.noteToV3 = function(note) {
    if (!note) return { v: 3, rows: [], cols: [] };
    if (note.v === 3) return note;
    let rowsV2;
    if (note.v === 2) rowsV2 = note.rows || [];
    else rowsV2 = [ (note.columns || []).map(c => ({ t: c, bg: '#fce5cd', b: true, a: 'c', cs: 1 })), ...(note.rows || []).map(r => r.map(c => ({ t: c, cs: 1 }))) ];
    const width = Math.max(0, ...rowsV2.map(r => r.reduce((a, c) => a + (c.cs || 1), 0)));
    const rows = rowsV2.map(r => {
        const out = [];
        r.forEach(c => { out.push(_nCell({ t: c.t, bg: c.bg || null, fg: c.fg || null, b: !!c.b, a: c.a || null, bd: c.bd ? { ...c.bd } : undefined, bc: c.bc || null, cs: c.cs || 1, rs: 1 })); for (let k = 1; k < (c.cs || 1); k++) out.push(_nCell({ h: true })); });
        while (out.length < width) out.push(_nCell());
        return out;
    });
    const cols = (note.cols || []).slice(0, width); while (cols.length < width) cols.push(160);
    return { v: 3, rows, cols };
};

// ---------- วาง/พิมพ์ ----------
window.parseNoteText = function(text, firstRowHeader) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    const sep = lines.some(l => l.includes('\t')) ? '\t' : (lines.some(l => l.includes('|')) ? '|' : null);
    const rows = lines.map(l => (sep ? l.split(sep) : [l]).map(c => c.trim()));
    const width = Math.max(1, ...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < width) r.push(''); });
    let columns = [];
    if (firstRowHeader && rows.length > 0) columns = rows.shift();
    else columns = Array.from({ length: width }, (_, i) => `คอลัมน์ ${i + 1}`);
    return window.noteToV3({ columns, rows });
};
// แปลง HTML จาก clipboard ของ Google Sheet → v3 (สี/ตัวหนา/จัดกลาง/ขนาด/ผสานทั้งแนวนอนและแนวตั้ง)
window.parseNoteHtml = function(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table'); if (!table) return null;
        const normBg = (c) => { if (!c) return null; c = c.trim().toLowerCase(); if (['transparent','inherit','initial','#ffffff','#fff','white','rgb(255, 255, 255)'].includes(c)) return null; return c; };
        const normFg = (c) => { if (!c) return null; c = c.trim().toLowerCase(); if (['transparent','inherit','initial'].includes(c)) return null; return c; };
        const cols = [...table.querySelectorAll('colgroup col')].map(c => parseInt(c.getAttribute('width') || c.style.width || '0') || 0);
        const grid = []; // grid[r][x]
        const trs = [...table.querySelectorAll('tr')];
        trs.forEach((tr, r) => {
            grid[r] = grid[r] || [];
            let x = 0;
            [...tr.children].filter(el => /^T[DH]$/.test(el.tagName)).forEach(td => {
                while (grid[r][x]) x++;   // ข้ามช่องที่ถูก rowspan จากข้างบน
                const st = td.getAttribute('style') || '';
                const get = (prop) => { const m = st.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i')); return m ? m[1] : null; };
                const clone = td.cloneNode(true); clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                const ta = (get('text-align') || '').toLowerCase();
                const fsm = (get('font-size') || '').match(/([\d.]+)(pt|px)?/);
                let fs = null; if (fsm) { fs = parseFloat(fsm[1]); if ((fsm[2] || 'pt') === 'pt') fs = Math.round(fs * 1.333); if (fs === window.NOTE_DEF_FS) fs = null; }
                const cs = Math.max(1, parseInt(td.getAttribute('colspan') || '1')), rs = Math.max(1, parseInt(td.getAttribute('rowspan') || '1'));
                const cell = _nCell({
                    t: String(clone.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim(),
                    bg: normBg(get('background-color') || get('background')), fg: normFg(get('color')),
                    b: /font-weight\s*:\s*(bold|[6-9]00)/i.test(st) || !!td.querySelector('b,strong') || td.tagName === 'TH',
                    a: ta === 'center' ? 'c' : (ta === 'right' ? 'r' : null), fs, cs, rs
                });
                for (let dy = 0; dy < rs; dy++) for (let dx = 0; dx < cs; dx++) {
                    grid[r + dy] = grid[r + dy] || [];
                    grid[r + dy][x + dx] = (dy === 0 && dx === 0) ? cell : _nCell({ h: true });
                }
                x += cs;
            });
        });
        const width = Math.max(0, ...grid.map(r => r.length));
        const rows = grid.map(r => { const out = []; for (let x = 0; x < width; x++) out.push(r[x] || _nCell()); return out; });
        return window.trimNoteGrid({ v: 3, rows, cols: cols.slice(0, width) });
    } catch (e) { console.warn('parseNoteHtml', e); return null; }
};
// ตัดคอลัมน์/แถวที่ว่างทั้งหมด (ช่องผสานที่คร่อมอยู่จะถูกย่อขนาดตาม)
window.trimNoteGrid = function(note) {
    note = window.noteToV3(note);
    const rows = note.rows.map(r => r.map(c => ({ ...c, bd: { ...(c.bd || { t: true, b: true, l: true, r: true }) } })));
    const H = rows.length, W = Math.max(0, ...rows.map(r => r.length));
    // หา "ต้นทาง" ของแต่ละช่อง
    const anchor = (r, x) => { for (let rr = r; rr >= 0; rr--) for (let xx = x; xx >= 0; xx--) { const c = rows[rr][xx]; if (c && !c.h && rr + (c.rs || 1) > r && xx + (c.cs || 1) > x) return { r: rr, x: xx, c }; } return null; };
    const colHas = Array.from({ length: W }, (_, x) => rows.some((r, ri) => { const a = anchor(ri, x); return a && a.c.t && a.x === x; }));
    const rowHas = rows.map((r, ri) => r.some((c, x) => { const a = anchor(ri, x); return a && a.c.t && a.r === ri; }));
    // ลบคอลัมน์ว่าง (จากขวาไปซ้าย)
    for (let x = W - 1; x >= 0; x--) {
        if (colHas[x]) continue;
        rows.forEach((r, ri) => { const a = anchor(ri, x); if (a && a.x < x) { if (a.r === ri && a.x === x) {} else if (a.r === ri) rows[a.r][a.x].cs--; } });
        rows.forEach(r => r.splice(x, 1));
        if (note.cols) note.cols.splice(x, 1);
    }
    for (let ri = H - 1; ri >= 0; ri--) {
        if (rowHas[ri]) continue;
        const W2 = rows[0] ? rows[0].length : 0;
        for (let x = 0; x < W2; x++) { const a = anchor(ri, x); if (a && a.r < ri && a.x === x) rows[a.r][a.x].rs--; }
        rows.splice(ri, 1);
    }
    // rs/cs ที่ลดแล้วต้องไม่ต่ำกว่า 1
    rows.forEach(r => r.forEach(c => { c.cs = Math.max(1, c.cs || 1); c.rs = Math.max(1, c.rs || 1); }));
    const width = rows[0] ? rows[0].length : 0;
    const cols = (note.cols || []).slice(0, width); while (cols.length < width) cols.push(160);
    return { v: 3, rows, cols };
};
window.noteToText = function(note) {
    note = window.noteToV3(note);
    return note.rows.map(r => r.filter(c => !c.h).map(c => c.t).join('\t')).join('\n');
};
window.previewNote = function() {
    const el = document.getElementById('notePreview'); if (!el) return;
    if (window._pendingRich) {
        const n = window._pendingRich;
        el.innerHTML = `<span class="text-emerald-400">✅ รับตารางจาก Google Sheet พร้อมสี/ผสานช่องแล้ว</span> — ${n.cols.length} คอลัมน์ × ${n.rows.length} แถว <span class="text-slate-500">— ถ้าแก้ข้อความในช่องนี้ สีจะหายไป (แก้ต่อได้ในหน้าหลังบันทึก)</span>`;
        return;
    }
    const n = window.parseNoteText(document.getElementById('newSheetNote').value, document.getElementById('newSheetNoteHeader').checked);
    el.innerText = n.rows.length ? `ตัวอย่าง: ${n.cols.length} คอลัมน์ × ${n.rows.length} แถว` : '';
};
document.addEventListener('paste', e => {
    const ta = e.target; if (!ta || ta.id !== 'newSheetNote') return;
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (html && /<t(able|d|r)\b/i.test(html)) {
        const rich = window.parseNoteHtml(html);
        if (rich && rich.rows.length) { e.preventDefault(); window._pendingRich = rich; ta.value = window.noteToText(rich); window.previewNote(); }
    }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'newSheetNote') { window._pendingRich = null; window.previewNote(); } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'newSheetNoteHeader') window.previewNote(); });
window.setSheetType = function(type) {
    document.getElementById('newSheetType').value = type;
    const isNote = type === 'note';
    document.getElementById('noteEditorBox').classList.toggle('hidden', !isNote);
    document.getElementById('linkEditorBox').classList.toggle('hidden', isNote);
    const on = 'flex-1 py-2.5 rounded-xl text-sm font-bold border transition bg-purple-600 border-purple-400 text-white';
    const off = 'flex-1 py-2.5 rounded-xl text-sm font-bold border transition bg-slate-800 border-slate-600 text-slate-400 hover:text-white';
    document.getElementById('sheetTypeBtn_link').className = isNote ? off : on;
    document.getElementById('sheetTypeBtn_note').className = isNote ? on : off;
};

// ---------- เปิดดู ----------
window.openNoteSheet = async function(sheet) {
    const wrap = document.getElementById('noteTableWrap');
    const search = document.getElementById('noteSearch'); if (search) search.value = '';
    document.getElementById('sheetLoading')?.classList.add('hidden');
    let note = window._noteCache[sheet.id];
    if (!note) {
        wrap.innerHTML = '<div class="text-center text-slate-500 py-10"><span class="material-icons animate-spin">sync</span></div>';
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle();
            note = data && data.value ? JSON.parse(data.value) : { v: 3, rows: [], cols: [] };
        } catch (e) { note = { v: 3, rows: [], cols: [] }; }
        note = window.noteToV3(note);
        window._noteCache[sheet.id] = note;
    }
    window._currentNote = note;
    window._currentNoteSheetId = sheet.id;
    window.noteEditExit(false);
    window.renderNoteTable();
};

// สไตล์ช่อง (ใช้ทั้งดูและแก้)
window._noteCellStyle = function(c, editing) {
    const st = [`background:${c.bg || '#ffffff'}`, `color:${c.fg || '#111827'}`, `font-size:${c.fs || window.NOTE_DEF_FS}px`];
    if (c.a === 'c') st.push('text-align:center'); else if (c.a === 'r') st.push('text-align:right');
    const bd = c.bd || { t: true, b: true, l: true, r: true }; const col = c.bc || window.NOTE_DEF_BC;
    const off = editing ? '1px dashed rgba(148,163,184,.45)' : '1px hidden transparent';
    ['t', 'r', 'b', 'l'].forEach(side => st.push(`border-${{ t: 'top', r: 'right', b: 'bottom', l: 'left' }[side]}:${bd[side] ? `1px solid ${col}` : off}`));
    return st.join(';');
};
const _nColName = (x) => { let n = x + 1, out = ''; while (n > 0) { const m = (n - 1) % 26; out = String.fromCharCode(65 + m) + out; n = Math.floor((n - 1) / 26); } return out; };
const _nHdrCls = 'bg-[#f8f9fa] text-[#5f6368] text-[11px] font-bold text-center border border-[#c0c0c0] select-none';
const _nEsc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

window.renderNoteTable = function() {
    const wrap = document.getElementById('noteTableWrap'); const note = window._currentNote; if (!wrap || !note) return;
    const term = (document.getElementById('noteSearch')?.value || '').toLowerCase().trim();
    const hi = (txt) => { const e = _nEsc(txt); if (!term) return e; return e.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="bg-yellow-300 rounded px-0.5">${m}</mark>`); };
    const rows = note.rows || [];
    if (rows.length === 0) { wrap.innerHTML = '<div class="text-center text-slate-500 py-16"><span class="material-icons text-4xl opacity-40">table_chart</span><p class="mt-2 text-sm">ยังไม่มีเนื้อหา — กด "แก้ไขหน้านี้" หรือวางจาก Google Sheet ใน "จัดการชีท"</p></div>'; return; }
    // ค้นหา: ซ่อนแถวที่ไม่ตรง (ถ้าค้นอยู่จะไม่ใช้ rowspan ข้ามแถวที่ซ่อน)
    const keep = rows.map(r => !term || r.some(c => !c.h && String(c.t).toLowerCase().includes(term)));
    const cnt = document.getElementById('noteCount'); if (cnt) cnt.innerText = `${keep.filter(Boolean).length}/${rows.length} แถว`;
    const cols = note.cols || []; const rowH = note.rowH || [];
    const colgroup = `<colgroup><col style="width:42px">${cols.map(w => `<col style="width:${Math.max(60, Math.round((w || 100) * 1.15))}px">`).join('')}<col style="width:36px"></colgroup>`;
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block min-w-full">
        <table class="border-collapse" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:fixed">
            ${colgroup}
            <thead class="sticky top-0 z-10"><tr><th class="${_nHdrCls} h-6"></th>${cols.map((_, x) => `<th class="${_nHdrCls} h-6">${_nColName(x)}</th>`).join('')}<th class="${_nHdrCls}"></th></tr></thead>
            <tbody>${rows.map((r, ri) => keep[ri] ? `<tr style="${rowH[ri] ? `height:${rowH[ri]}px` : ''}"><td class="${_nHdrCls} align-middle">${ri + 1}</td>${r.map(c => c.h ? '' : `<td colspan="${c.cs || 1}" rowspan="${term ? 1 : (c.rs || 1)}" ${c.t ? `onclick="copyNoteCell(this)" data-v="${_nEsc(c.t)}" title="คลิกเพื่อก๊อปปี้"` : ''} class="px-3 py-2.5 align-middle whitespace-pre-wrap leading-snug ${c.b ? 'font-bold' : ''} ${c.t ? 'cursor-copy hover:outline hover:outline-2 hover:outline-purple-500 hover:-outline-offset-2' : ''}" style="${window._noteCellStyle(c, false)}">${hi(c.t)}</td>`).join('')}<td class="border border-[#cbd5e1] text-center align-middle bg-slate-50"><button onclick="copyNoteRow(this)" title="ก๊อปทั้งแถว" class="text-slate-400 hover:text-purple-600 p-1"><span class="material-icons text-[15px]">content_copy</span></button></td></tr>` : '').join('')}
            </tbody>
        </table></div>`;
};
window._copyText = async function(text, el) {
    try { await navigator.clipboard.writeText(text); } catch (e) { if (typeof fallbackCopyText === 'function') fallbackCopyText(text); }
    if (el) { const old = el.style.background; el.style.background = '#bbf7d0'; setTimeout(() => el.style.background = old, 450); }
    Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'ก๊อปปี้แล้ว' });
};
window.copyNoteCell = function(td) { window._copyText(td.dataset.v || td.innerText, td); };
window.copyNoteRow = function(btn) { const tr = btn.closest('tr'); window._copyText([...tr.querySelectorAll('td[data-v]')].map(td => td.dataset.v).join('\t'), tr); };

// ==========================================
// 🛠️ แก้ไขในหน้า — เลือกช่องแบบลากคลุม, ผสานทั้งแนวนอน/แนวตั้ง, เส้นขอบร่วม, ขนาดตัวอักษร
// ==========================================
window._noteEdit = null; window._noteUndo = []; window._noteSel = null; window._noteEditing = false; window._noteDrag = null;
const _nClone = (n) => JSON.parse(JSON.stringify(n));
// ต้นทางของช่อง (r,x) — ถ้าช่องถูกผสานทับ คืนช่องที่ผสานมันอยู่
const _nAnchor = (note, r, x) => {
    const c = note.rows[r] && note.rows[r][x]; if (!c) return null;
    if (!c.h) return { r, x, c };
    for (let rr = r; rr >= 0; rr--) for (let xx = x; xx >= 0; xx--) { const a = note.rows[rr][xx]; if (a && !a.h && rr + (a.rs || 1) > r && xx + (a.cs || 1) > x) return { r: rr, x: xx, c: a }; }
    return null;
};
// ช่องต้นทางทั้งหมดในกรอบเลือก
const _nSelCells = () => {
    const sel = window._noteSel, note = window._noteEdit; if (!sel || !note) return [];
    const seen = new Set(), out = [];
    for (let r = sel.r1; r <= sel.r2; r++) for (let x = sel.x1; x <= sel.x2; x++) { const a = _nAnchor(note, r, x); if (!a) continue; const k = `${a.r}:${a.x}`; if (seen.has(k)) continue; seen.add(k); out.push({ r: a.r, x: a.x, c: a.c, x2: a.x + (a.c.cs || 1) - 1, r2: a.r + (a.c.rs || 1) - 1 }); }
    return out;
};
// ตั้งเส้นขอบแบบ "ขอบร่วม": ด้านนั้นของช่องนี้ + ด้านตรงข้ามของช่องข้างเคียง
const _nSetEdge = (note, o, side, on, color) => {
    const set = (cell, s) => { cell.bd = { ...(cell.bd || { t: true, b: true, l: true, r: true }), [s]: on }; if (color !== undefined && on) cell.bc = color; };
    set(o.c, side);
    const opp = { t: 'b', b: 't', l: 'r', r: 'l' }[side];
    const nbs = [];
    if (side === 't' && o.r > 0) for (let x = o.x; x <= o.x2; x++) nbs.push(_nAnchor(note, o.r - 1, x));
    if (side === 'b' && o.r2 < note.rows.length - 1) for (let x = o.x; x <= o.x2; x++) nbs.push(_nAnchor(note, o.r2 + 1, x));
    if (side === 'l' && o.x > 0) for (let r = o.r; r <= o.r2; r++) nbs.push(_nAnchor(note, r, o.x - 1));
    if (side === 'r' && o.x2 < note.rows[0].length - 1) for (let r = o.r; r <= o.r2; r++) nbs.push(_nAnchor(note, r, o.x2 + 1));
    const done = new Set(); nbs.forEach(a => { if (!a) return; const k = `${a.r}:${a.x}`; if (done.has(k)) return; done.add(k); set(a.c, opp); });
};

window.noteEditStart = function() {
    if (!window._currentNote) return;
    window._noteEdit = _nClone(window.noteToV3(window._currentNote));
    if (window._noteEdit.rows.length === 0) { window._noteEdit.rows = [[_nCell(), _nCell(), _nCell()], [_nCell(), _nCell(), _nCell()]]; window._noteEdit.cols = [160, 200, 300]; }
    window._noteUndo = []; window._noteSel = null; window._noteEditing = true;
    document.getElementById('noteToolbar').classList.remove('hidden'); document.getElementById('noteToolbar').classList.add('flex');
    document.getElementById('btnNoteEdit').classList.add('hidden');
    document.getElementById('noteHint')?.classList.add('hidden');
    const srch = document.getElementById('noteSearch'); if (srch) { srch.value = ''; srch.disabled = true; }
    window.renderNoteEditor();
};
window.noteEditExit = function(rerender) {
    window._noteEditing = false; window._noteEdit = null; window._noteSel = null;
    const tb = document.getElementById('noteToolbar'); if (tb) { tb.classList.add('hidden'); tb.classList.remove('flex'); }
    const srch = document.getElementById('noteSearch'); if (srch) srch.disabled = false;
    document.getElementById('noteHint')?.classList.remove('hidden');
    const canEdit = window.currentUser && ['admin', 'manager'].includes(window.currentUser.role);
    document.getElementById('btnNoteEdit')?.classList.toggle('hidden', !canEdit);
    if (rerender) window.renderNoteTable();
};
window.noteEditCancel = async function() {
    const ok = await Swal.fire({ icon: 'question', title: 'ยกเลิกการแก้ไข?', text: 'สิ่งที่แก้ไว้จะหายไป', showCancelButton: true, confirmButtonText: 'ยกเลิกการแก้ไข', cancelButtonText: 'แก้ต่อ', confirmButtonColor: '#ef4444' });
    if (ok.isConfirmed) window.noteEditExit(true);
};
window.noteEditSave = async function() {
    window._noteSyncText();
    const note = window._noteEdit; const id = window._currentNoteSheetId; if (!note || !id) return;
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        window.clearSettingCache();
        const { error } = await appDB.from('settings').upsert([{ key: `sheet_note_${id}`, value: JSON.stringify(note) }]);
        if (error) throw error;
        window._noteCache[id] = note; window._currentNote = note;
        try { await appDB.from('system_logs').insert([{ action_type: 'แก้ไขชีท', performed_by: currentUser.username, target_details: `แก้ไขหน้าข้อความ #${id} (${note.rows.length} แถว)` }]); } catch (e) {}
        window.noteEditExit(true);
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};
window._noteSyncText = function() {
    if (!window._noteEdit) return;
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => { const c = window._noteEdit.rows[+td.dataset.r] && window._noteEdit.rows[+td.dataset.r][+td.dataset.x]; if (c) c.t = td.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, ''); });
};
const _nSnap = () => { window._noteSyncText(); window._noteUndo.push(_nClone(window._noteEdit)); if (window._noteUndo.length > 50) window._noteUndo.shift(); };

window.renderNoteEditor = function() {
    const wrap = document.getElementById('noteTableWrap'); const note = window._noteEdit; if (!wrap || !note) return;
    const cols = note.cols || []; const rowH = note.rowH || [];
    const colgroup = `<colgroup><col style="width:42px">${cols.map(w => `<col style="width:${Math.max(60, Math.round((w || 100) * 1.15))}px">`).join('')}</colgroup>`;
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.x}`));
    const selCols = new Set(), selRows = new Set();
    if (window._noteSel) { for (let x = window._noteSel.x1; x <= window._noteSel.x2; x++) selCols.add(x); for (let r = window._noteSel.r1; r <= window._noteSel.r2; r++) selRows.add(r); }
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block min-w-full select-none">
        <table id="noteEditTable" class="border-collapse" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:fixed">
            ${colgroup}
            <thead class="sticky top-0 z-10"><tr><th class="${_nHdrCls} h-6" onmousedown="noteSelectAll()" title="เลือกทั้งหมด"></th>${cols.map((_, x) => `<th class="${_nHdrCls} h-6 relative cursor-pointer ${selCols.has(x) ? 'bg-[#d3e3fd] text-[#1a73e8]' : ''}" onmousedown="noteSelectCol(event,${x})">${_nColName(x)}<div class="nt-col-rs" onmousedown="noteResizeStart(event,'col',${x})" title="ลากเพื่อปรับความกว้าง"></div></th>`).join('')}</tr></thead>
            <tbody>${note.rows.map((r, ri) => `<tr style="${rowH[ri] ? `height:${rowH[ri]}px` : ''}"><td class="${_nHdrCls} align-middle relative cursor-pointer ${selRows.has(ri) ? 'bg-[#d3e3fd] text-[#1a73e8]' : ''}" onmousedown="noteSelectRow(event,${ri})">${ri + 1}<div class="nt-row-rs" onmousedown="noteResizeStart(event,'row',${ri})" title="ลากเพื่อปรับความสูง"></div></td>${r.map((c, x) => c.h ? '' : `<td data-r="${ri}" data-x="${x}" colspan="${c.cs || 1}" rowspan="${c.rs || 1}" contenteditable="true" spellcheck="false"
                    onmousedown="noteCellDown(event,this)" onmouseenter="noteCellEnter(event,this)" onfocus="noteCellFocus(this)"
                    class="px-3 py-2.5 align-middle whitespace-pre-wrap leading-snug outline-none ${c.b ? 'font-bold' : ''} ${selSet.has(`${ri}:${x}`) ? 'note-sel' : ''}"
                    style="${window._noteCellStyle(c, true)}">${_nEsc(c.t)}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table></div>`;
    window._noteUpdateSelInfo();
    // แสดงขนาดตัวอักษรของช่องที่เลือกใน dropdown
    const fsSel = document.getElementById('noteFontSize'); const first = _nSelCells()[0];
    if (fsSel) fsSel.value = String((first && first.c.fs) || window.NOTE_DEF_FS);
};
window._noteUpdateSelInfo = function() {
    const info = document.getElementById('noteSelInfo'); const sel = window._noteSel; if (!info) return;
    if (!sel) { info.innerText = 'คลิกช่อง · ลากเมาส์คลุมหลายช่อง · Shift+คลิก ขยายการเลือก'; return; }
    const n = _nSelCells().length;
    info.innerText = n > 1 ? `เลือก ${n} ช่อง` : `แถว ${sel.r1 + 1} · คอลัมน์ ${sel.x1 + 1}`;
};
window._notePaintSel = function() {
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.x}`));
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => td.classList.toggle('note-sel', selSet.has(`${td.dataset.r}:${td.dataset.x}`)));
    window._noteUpdateSelInfo();
    const fsSel = document.getElementById('noteFontSize'); const first = _nSelCells()[0];
    if (fsSel) fsSel.value = String((first && first.c.fs) || window.NOTE_DEF_FS);
};
const _tdRect = (td) => { const r = +td.dataset.r, x1 = +td.dataset.x; return { r, r2: r + (parseInt(td.getAttribute('rowspan')) || 1) - 1, x1, x2: x1 + (parseInt(td.getAttribute('colspan')) || 1) - 1 }; };
const _nExpandSel = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r2, b.r2), x1: Math.min(a.x1, b.x1), x2: Math.max(a.x2, b.x2) });
window.noteCellDown = function(e, td) {
    if (e.button !== 0) return;
    const t = _tdRect(td);
    if (e.shiftKey && window._noteSel) { e.preventDefault(); const s0 = window._noteSel; window._noteSel = _nExpandSel({ r: s0.r1, r2: s0.r2, x1: s0.x1, x2: s0.x2 }, t); window._notePaintSel(); return; }
    window._noteSel = { r1: t.r, r2: t.r2, x1: t.x1, x2: t.x2 };
    window._noteDrag = { start: t, td };
    window._notePaintSel();
};
window.noteCellEnter = function(e, td) {
    const d = window._noteDrag; if (!d || !(e.buttons & 1) || td === d.td) return;
    try { window.getSelection().removeAllRanges(); } catch (_) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window._noteSel = _nExpandSel(d.start, _tdRect(td)); window._notePaintSel();
};
document.addEventListener('mouseup', () => { window._noteDrag = null; });
window.noteCellFocus = function(td) {
    const t = _tdRect(td); const s0 = window._noteSel;
    if (!s0 || t.r < s0.r1 || t.r > s0.r2 || t.x2 < s0.x1 || t.x1 > s0.x2) { window._noteSel = { r1: t.r, r2: t.r2, x1: t.x1, x2: t.x2 }; window._notePaintSel(); }
};
window.noteSelectCol = function(e, x) { if (e.target.classList.contains('nt-col-rs')) return; e.preventDefault(); const H = window._noteEdit.rows.length; const s0 = window._noteSel; window._noteSel = (e.shiftKey && s0) ? { r1: 0, r2: H - 1, x1: Math.min(s0.x1, x), x2: Math.max(s0.x2, x) } : { r1: 0, r2: H - 1, x1: x, x2: x }; window.renderNoteEditor(); };
window.noteSelectRow = function(e, r) { if (e.target.classList.contains('nt-row-rs')) return; e.preventDefault(); const W = window._noteEdit.rows[0].length; const s0 = window._noteSel; window._noteSel = (e.shiftKey && s0) ? { r1: Math.min(s0.r1, r), r2: Math.max(s0.r2, r), x1: 0, x2: W - 1 } : { r1: r, r2: r, x1: 0, x2: W - 1 }; window.renderNoteEditor(); };
window.noteSelectAll = function() { const n = window._noteEdit; window._noteSel = { r1: 0, r2: n.rows.length - 1, x1: 0, x2: n.rows[0].length - 1 }; window.renderNoteEditor(); };
// ลากปรับความกว้างคอลัมน์ / ความสูงแถว
window._noteRs = null;
window.noteResizeStart = function(e, kind, idx) {
    e.preventDefault(); e.stopPropagation();
    const note = window._noteEdit; if (!note) return;
    const table = document.getElementById('noteEditTable');
    const startPx = e.clientX, startPy = e.clientY;
    let startVal;
    if (kind === 'col') startVal = table.querySelectorAll('colgroup col')[idx + 1].getBoundingClientRect().width;
    else { const tr = table.querySelectorAll('tbody tr')[idx]; startVal = tr.getBoundingClientRect().height; }
    window._noteRs = { kind, idx, startPx, startPy, startVal };
    document.body.style.cursor = kind === 'col' ? 'col-resize' : 'row-resize';
    const move = (ev) => {
        const rs = window._noteRs; if (!rs) return;
        if (rs.kind === 'col') { const w = Math.max(40, Math.round(rs.startVal + (ev.clientX - rs.startPx))); table.querySelectorAll('colgroup col')[rs.idx + 1].style.width = w + 'px'; rs.cur = w; }
        else { const h = Math.max(24, Math.round(rs.startVal + (ev.clientY - rs.startPy))); table.querySelectorAll('tbody tr')[rs.idx].style.height = h + 'px'; rs.cur = h; }
    };
    const up = () => {
        const rs = window._noteRs; window._noteRs = null; document.body.style.cursor = '';
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        if (!rs || rs.cur == null) return;
        _nSnap();
        if (rs.kind === 'col') note.cols[rs.idx] = Math.round(rs.cur / 1.15);   // เก็บเป็นหน่วยเดิมของชีท (วาดคูณ 1.15)
        else { note.rowH = note.rowH || []; note.rowH[rs.idx] = rs.cur; }
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
};
const _nToast = (m) => Swal.mixin({ toast: true, position: 'top', timer: 1800, showConfirmButton: false }).fire({ icon: 'info', title: m });

window.noteCmd = async function(cmd, val) {
    const note = window._noteEdit; if (!note) return;
    if (cmd === 'undo') { if (!window._noteUndo.length) return; window._noteEdit = window._noteUndo.pop(); window._noteSel = null; window.renderNoteEditor(); return; }
    if (cmd === 'trimEmpty') { _nSnap(); const t = window.trimNoteGrid(note); note.rows = t.rows; note.cols = t.cols; window._noteSel = null; window.renderNoteEditor(); return; }
    const sel = window._noteSel; if (!sel) { _nToast('คลิกเลือกช่องก่อน'); return; }
    _nSnap();
    const cells = _nSelCells(); const each = (fn) => cells.forEach(o => fn(o.c, o));
    const bdOf = (c) => c.bd || { t: true, b: true, l: true, r: true };
    const abort = () => { window._noteUndo.pop(); };
    const W = note.rows[0].length, H = note.rows.length;
    switch (cmd) {
        case 'bold': { const allB = cells.every(o => o.c.b); each(c => c.b = !allB); break; }
        case 'fg': each(c => c.fg = val); break;
        case 'bg': each(c => c.bg = val); break;
        case 'align': each(c => c.a = val === 'l' ? null : val); break;
        case 'fontSize': { const n = parseInt(val); each(c => c.fs = (!n || n === window.NOTE_DEF_FS) ? null : n); break; }
        case 'border': {
            const color = window._noteBorderColor || undefined;
            if (val === 'all') each((c, o) => ['t', 'b', 'l', 'r'].forEach(s => _nSetEdge(note, o, s, true, color)));
            else if (val === 'none') each((c, o) => ['t', 'b', 'l', 'r'].forEach(s => _nSetEdge(note, o, s, false)));
            else if (val === 'outer') each((c, o) => { _nSetEdge(note, o, 't', o.r === sel.r1, color); _nSetEdge(note, o, 'b', o.r2 >= sel.r2, color); _nSetEdge(note, o, 'l', o.x === sel.x1, color); _nSetEdge(note, o, 'r', o.x2 >= sel.x2, color); });
            else if (val === 'inner') each((c, o) => { _nSetEdge(note, o, 't', o.r !== sel.r1, color); _nSetEdge(note, o, 'b', o.r2 < sel.r2, color); _nSetEdge(note, o, 'l', o.x !== sel.x1, color); _nSetEdge(note, o, 'r', o.x2 < sel.x2, color); });
            else { const allOn = cells.every(o => bdOf(o.c)[val]); each((c, o) => _nSetEdge(note, o, val, !allOn, color)); }
            document.getElementById('noteBorderMenu')?.classList.add('hidden'); break;
        }
        case 'borderColor': { window._noteBorderColor = val; each(c => c.bc = val); document.getElementById('noteBorderMenu')?.classList.add('hidden'); break; }
        case 'merge': {
            if (cells.length < 2 && !(cells[0] && (cells[0].c.cs > 1 || cells[0].c.rs > 1))) { abort(); _nToast('ลากคลุมอย่างน้อย 2 ช่องก่อน'); return; }
            // ขยายกรอบให้ครอบช่องผสานเดิมทั้งหมด
            let r1 = sel.r1, r2 = sel.r2, x1 = sel.x1, x2 = sel.x2;
            cells.forEach(o => { r1 = Math.min(r1, o.r); r2 = Math.max(r2, o.r2); x1 = Math.min(x1, o.x); x2 = Math.max(x2, o.x2); });
            const texts = []; const base = _nAnchor(note, r1, x1).c;
            for (let r = r1; r <= r2; r++) for (let x = x1; x <= x2; x++) { const c = note.rows[r][x]; if (!c.h && c.t) texts.push(c.t); }
            for (let r = r1; r <= r2; r++) for (let x = x1; x <= x2; x++) note.rows[r][x] = (r === r1 && x === x1) ? { ...base, t: texts.join(' '), cs: x2 - x1 + 1, rs: r2 - r1 + 1, h: false } : _nCell({ h: true });
            window._noteSel = { r1, r2, x1, x2 }; break;
        }
        case 'unmerge': {
            let did = false;
            cells.forEach(o => { const c = o.c; if ((c.cs || 1) === 1 && (c.rs || 1) === 1) return; const cs = c.cs || 1, rs = c.rs || 1; for (let r = o.r; r < o.r + rs; r++) for (let x = o.x; x < o.x + cs; x++) if (!(r === o.r && x === o.x)) note.rows[r][x] = _nCell({ bg: c.bg, fg: c.fg, b: c.b, a: c.a, fs: c.fs, bd: { ...bdOf(c) }, bc: c.bc }); c.cs = 1; c.rs = 1; did = true; });
            if (!did) { abort(); return; }
            break;
        }
        case 'rowAbove': case 'rowBelow': {
            const at = cmd === 'rowAbove' ? sel.r1 : sel.r2 + 1;
            const newRow = Array.from({ length: W }, () => _nCell());
            // ช่องผสานที่คร่อมตำแหน่งแทรก → ขยาย rs และให้ช่องใหม่เป็น h
            for (let x = 0; x < W; x++) { const a = at < H ? _nAnchor(note, at, x) : null; if (a && a.r < at) { a.c.rs++; newRow[x] = _nCell({ h: true }); } }
            note.rows.splice(at, 0, newRow); if (note.rowH) note.rowH.splice(at, 0, undefined); window._noteSel = null; break;
        }
        case 'rowDel': {
            const n = sel.r2 - sel.r1 + 1; if (H - n < 1) { abort(); return; }
            for (let r = sel.r2; r >= sel.r1; r--) {
                for (let x = 0; x < W; x++) { const c = note.rows[r][x]; const a = _nAnchor(note, r, x); if (!a) continue;
                    if (a.r < r) { a.c.rs--; }                                   // แถวนี้อยู่ใต้ช่องผสาน → หดช่องนั้น
                    else if (a.r === r && (c.rs || 1) > 1) { const nc = { ...c, rs: c.rs - 1 }; note.rows[r + 1][x] = nc; for (let xx = x + 1; xx < x + (c.cs || 1); xx++) note.rows[r + 1][xx] = _nCell({ h: true }); } }   // ย้ายต้นทางลงแถวถัดไป
                note.rows.splice(r, 1); if (note.rowH) note.rowH.splice(r, 1);
            }
            window._noteSel = null; break;
        }
        case 'colLeft': case 'colRight': {
            const at = cmd === 'colLeft' ? sel.x1 : sel.x2 + 1;
            note.rows.forEach((row, r) => { const a = at < W ? _nAnchor(note, r, at) : null; const cell = (a && a.x < at) ? _nCell({ h: true }) : _nCell(); if (a && a.x < at && a.r === r) a.c.cs++; row.splice(at, 0, cell); });
            note.cols.splice(at, 0, 160); window._noteSel = null; break;
        }
        case 'colDel': {
            const n = sel.x2 - sel.x1 + 1; if (W - n < 1) { abort(); return; }
            for (let x = sel.x2; x >= sel.x1; x--) {
                note.rows.forEach((row, r) => { const c = row[x]; const a = _nAnchor(note, r, x); if (!a) return;
                    if (a.x < x) { if (a.r === r) a.c.cs--; }
                    else if (a.x === x && a.r === r && (c.cs || 1) > 1) { const nc = { ...c, cs: c.cs - 1 }; row[x + 1] = nc; for (let rr = r + 1; rr < r + (c.rs || 1); rr++) note.rows[rr][x + 1] = _nCell({ h: true }); } });
                note.rows.forEach(row => row.splice(x, 1)); note.cols.splice(x, 1);
            }
            window._noteSel = null; break;
        }
        case 'colWidth': {
            const { value } = await Swal.fire({ title: `ความกว้างคอลัมน์ ${sel.x1 + 1}${sel.x2 > sel.x1 ? '-' + (sel.x2 + 1) : ''} (px)`, input: 'number', inputValue: note.cols[sel.x1] || 160, inputAttributes: { min: 60, max: 900 } });
            if (!value) { abort(); return; }
            for (let x = sel.x1; x <= sel.x2; x++) note.cols[x] = parseInt(value); break;
        }
    }
    window.renderNoteEditor();
};
document.addEventListener('mousedown', e => { const m = document.getElementById('noteBorderMenu'); if (m && !m.classList.contains('hidden') && !e.target.closest('#noteBorderMenuWrap')) m.classList.add('hidden'); });
document.addEventListener('keydown', e => {
    if (!window._noteEditing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); window.noteCmd('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); window.noteCmd('undo'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); window.noteEditSave(); }
});

// ==========================================
// 🟢 4. ระบบแอดมิน (เพิ่ม/ลบ/แก้ไข)
// ==========================================
window.showSheetAdmin = function() {
    document.getElementById('sheetAdminModal').classList.remove('hidden');
    document.getElementById('sheetAdminModal').classList.add('flex');
    renderAdminSheetList();
};

window.closeSheetAdmin = function() {
    document.getElementById('sheetAdminModal').classList.add('hidden');
    document.getElementById('sheetAdminModal').classList.remove('flex');
};

window.renderAdminSheetList = function() {
    const list = document.getElementById('adminSheetList');
    if(!list) return;
    const colorMap = { 'blue': '#3b82f6', 'green': '#10b981', 'red': '#ef4444', 'yellow': '#f59e0b', 'purple': '#8b5cf6', 'gray': '#64748b' };
    
    list.innerHTML = window.GLOBAL_SHEETS.map(s => {
        let bg = s.color;
        if(bg && !bg.startsWith('#')) bg = colorMap[bg] || '#8b5cf6';
        if(!bg) bg = '#8b5cf6';
        
        return window.renderTemplate('tpl-sheet-admin-item', {
            id: s.id,
            bg: bg,
            groupName: s.group_name || s.category || 'ทั่วไป',
            title: s.name || s.title
        });
    }).join('');
};

window.startEdit = function(id) {
    const sheet = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if(!sheet) return;

    document.getElementById('editSheetId').value = sheet.id;
    document.getElementById('newSheetName').value = sheet.name || sheet.title;
    // 📝 ถ้าเป็นหน้าข้อความ โหลดเนื้อหามาใส่ช่องแก้ไข
    if ((sheet.sheet_id || '') === 'NOTE') {
        window.setSheetType('note');
        const fill = (note) => { note = window.noteToV3(note); window._pendingRich = note; document.getElementById('newSheetNote').value = window.noteToText(note); document.getElementById('newSheetNoteHeader').checked = true; window.previewNote(); };
        if (window._noteCache[sheet.id]) fill(window._noteCache[sheet.id]);
        else appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle().then(({ data }) => { const n = window.noteToV3(data && data.value ? JSON.parse(data.value) : { v: 3, rows: [], cols: [] }); window._noteCache[sheet.id] = n; fill(n); });
    } else {
        window.setSheetType('link');
        document.getElementById('newSheetNote').value = '';
    }
    document.getElementById('newSheetGroup').value = sheet.group_name || sheet.category || '';
    document.getElementById('newSheetCover').value = sheet.cover_url || sheet.bg_image || '';
    
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    const coverContainer = document.getElementById('currentSheetCoverContainer');
    const coverImg = document.getElementById('currentSheetCoverImg');
    if(coverContainer && coverImg) {
        if(sheet.cover_url || sheet.bg_image) { coverImg.src = sheet.cover_url || sheet.bg_image; coverContainer.classList.remove('hidden'); } 
        else { coverContainer.classList.add('hidden'); }
    }
    
    let sheetId = sheet.sheet_id || sheet.url || '';
    if (sheetId && !sheetId.startsWith('http')) {
        let fullUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
        if(sheet.gid) fullUrl += `#gid=${sheet.gid}`;
        document.getElementById('newSheetUrl').value = fullUrl;
    } else { document.getElementById('newSheetUrl').value = sheetId; }

    const colorMap = { 'blue': '#3b82f6', 'green': '#22c55e', 'red': '#ef4444', 'yellow': '#eab308', 'purple': '#a855f7', 'gray': '#6b7280' };
    let hexColor = sheet.color;
    if (hexColor && !hexColor.startsWith('#')) hexColor = colorMap[hexColor] || '#3b82f6';
    document.getElementById('newSheetColor').value = hexColor;

    document.getElementById('formTitle').innerText = `✏️ กำลังแก้ไข: ${sheet.name || sheet.title}`;
    document.getElementById('formTitle').className = "text-sm font-bold text-orange-600";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerHTML = `<span class="material-icons">save</span> บันทึกการแก้ไข`;
    btn.classList.replace('bg-green-600', 'bg-orange-500'); 
    btn.classList.replace('hover:bg-green-500', 'hover:bg-orange-600');
    document.getElementById('btnCancelEdit').classList.remove('hidden');
};

window.cancelEdit = function() {
    window._pendingRich = null;
    if (document.getElementById('newSheetType')) { window.setSheetType('link'); document.getElementById('newSheetNote').value = ''; const pv = document.getElementById('notePreview'); if (pv) pv.innerText = ''; }
    ['editSheetId','newSheetName','newSheetGroup','newSheetUrl','newSheetCover'].forEach(id => document.getElementById(id).value = '');
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    if(document.getElementById('currentSheetCoverContainer')) document.getElementById('currentSheetCoverContainer').classList.add('hidden');
    document.getElementById('newSheetColor').value = '#3b82f6';
    
    document.getElementById('formTitle').innerHTML = `<span class="material-icons text-[18px]">add_circle</span> เพิ่มรายการใหม่`;
    document.getElementById('formTitle').className = "text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerHTML = `<span class="material-icons">save</span> บันทึกข้อมูล`;
    btn.classList.replace('bg-orange-500', 'bg-green-600'); 
    btn.classList.replace('hover:bg-orange-600', 'hover:bg-green-500');
    document.getElementById('btnCancelEdit').classList.add('hidden');
};

window.saveSheetData = async function() {
    const id = document.getElementById('editSheetId').value;
    const name = document.getElementById('newSheetName').value.trim();
    const group = document.getElementById('newSheetGroup').value.trim() || 'ทั่วไป';
    const url = document.getElementById('newSheetUrl').value.trim();
    const color = document.getElementById('newSheetColor').value;
    
    const coverFileInput = document.getElementById('newSheetCoverFile');
    let finalCoverUrl = document.getElementById('newSheetCover').value.trim(); 
    
    const sheetType = (document.getElementById('newSheetType') || {}).value || 'link';
    let noteData = null;
    if (sheetType === 'note') {
        noteData = window._pendingRich || window.parseNoteText(document.getElementById('newSheetNote').value, document.getElementById('newSheetNoteHeader').checked);
        if (!name) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อเรียก', 'warning');
        noteData = window.noteToV3(noteData);
        if (!noteData.rows || noteData.rows.length === 0) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาวางเนื้อหาตารางอย่างน้อย 1 แถว', 'warning');
    } else
    if(!name || !url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อและลิงก์', 'warning');
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        if (coverFileInput && coverFileInput.files && coverFileInput.files.length > 0) {
            Swal.update({text: `กำลังอัปโหลดรูปภาพหน้าปก...`});
            
            if (id) {
                const sheetToEdit = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
                if (sheetToEdit && sheetToEdit.cover_url && sheetToEdit.cover_url.includes('supabase.co') && sheetToEdit.cover_url.includes('files/covers/')) {
                    const oldPath = 'files/covers/' + sheetToEdit.cover_url.split('files/covers/')[1].split('?')[0];
                    await appDB.storage.from('staff_images').remove([oldPath]);
                }
            }

            const coverFile = coverFileInput.files[0];
            const coverName = `sheet_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}.${coverFile.name.split('.').pop()}`;

            const { error: coverError } = await appDB.storage.from('staff_images').upload(`files/covers/${coverName}`, coverFile, { cacheControl: '3600', upsert: false });
            if (coverError) throw new Error('อัปโหลดรูปปกไม่สำเร็จ: ' + coverError.message);
            const { data: coverUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/covers/${coverName}`);
            finalCoverUrl = coverUrlData.publicUrl;
        }

        let sheetId = url; let gid = null;
        if (sheetType === 'note') { sheetId = 'NOTE'; }
        else {
            const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if(idMatch) {
                sheetId = idMatch[1];
                const gidMatch = url.match(/[?&#]gid=([0-9]+)/); 
                if (gidMatch) gid = gidMatch[1];
            }
        }
        
        const payload = { name: name, group_name: group, sheet_id: sheetId, gid: gid, color: color, cover_url: finalCoverUrl };

        let savedId = id;
        if (id) {
            const { error } = await appDB.from('external_sheets').update(payload).eq('id', id);
            if(error) throw error;
        } else {
            const { data: ins, error } = await appDB.from('external_sheets').insert([payload]).select('id').single();
            if(error) throw error;
            savedId = ins.id;
        }
        // 📝 เนื้อหาหน้าข้อความ → settings
        if (sheetType === 'note' && savedId) {
            window.clearSettingCache();
            const { error: nErr } = await appDB.from('settings').upsert([{ key: `sheet_note_${savedId}`, value: JSON.stringify(noteData) }]);
            if (nErr) throw nErr;
            window._noteCache[savedId] = noteData;
        }
        Swal.fire({icon: 'success', title: id ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มรายการสำเร็จ', showConfirmButton: false, timer: 1000});
        
        window.cancelEdit();
        await fetchSheets();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

window.deleteSheet = async function(id) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "ลบแล้วกู้คืนไม่ได้นะ", icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก' });
    if (!result.isConfirmed) return;

    Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
    try {
        try { await appDB.from('settings').delete().eq('key', `sheet_note_${id}`); delete window._noteCache[id]; } catch (e) {}
        const { error } = await appDB.from('external_sheets').delete().eq('id', id);
        if (error) throw error;
        Swal.fire({icon: 'success', title: 'ลบเรียบร้อย', showConfirmButton: false, timer: 1000});
        await fetchSheets();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// =========================================
// 🌟 ระบบหน่วงเวลาช่องค้นหา (พิมพ์เสร็จค่อยหา)
// =========================================
let sheetSearchTimeout = null;
window.onSheetSearch = function() {
    clearTimeout(sheetSearchTimeout);
    sheetSearchTimeout = setTimeout(() => {
        renderSheetMenu(); // สั่งวาดตารางเมื่อหยุดพิมพ์ไปแล้ว 300ms
    }, 300); 
};
