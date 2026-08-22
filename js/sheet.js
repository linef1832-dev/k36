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
// 📝 3.5 หน้าข้อความที่สร้างในระบบ (ตารางแพทเทิร์น/หมายเหตุ) — เก็บใน settings key sheet_note_<id>
// ==========================================
window._noteCache = {};
window._currentNote = null;

// ---------- รูปแบบข้อมูล ----------
// v1 (พิมพ์เอง): { columns:[..], rows:[[..]] }
// v2 (วางจาก Google Sheet): { v:2, rows:[[ {t:'ข้อความ', bg:'#fce5cd', fg:'#000', b:true, cs:3} ... ]] }  ← เก็บสี/ตัวหนา/ผสานช่องตามชีทจริง
window._pendingRich = null;   // ตารางที่จับได้จากการวาง (HTML) รอบันทึก

window.parseNoteText = function(text, firstRowHeader) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    const sep = lines.some(l => l.includes('\t')) ? '\t' : (lines.some(l => l.includes('|')) ? '|' : null);
    const rows = lines.map(l => (sep ? l.split(sep) : [l]).map(c => c.trim()));
    const width = Math.max(1, ...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < width) r.push(''); });
    let columns = [];
    if (firstRowHeader && rows.length > 0) columns = rows.shift();
    else columns = Array.from({ length: width }, (_, i) => `คอลัมน์ ${i + 1}`);
    return { columns, rows };
};

// แปลง HTML ที่ Google Sheet ใส่มาใน clipboard → v2 (เก็บสีพื้น/สีตัวอักษร/ตัวหนา/ผสานช่อง) + ตัดคอลัมน์/แถวว่างทิ้ง
window.parseNoteHtml = function(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table'); if (!table) return null;
        const norm = (c) => {
            if (!c) return null;
            c = c.trim().toLowerCase();
            if (c === 'transparent' || c === 'inherit' || c === 'initial') return null;
            if (c === '#ffffff' || c === '#fff' || c === 'white' || c === 'rgb(255, 255, 255)') return null;
            if (c === '#000000' || c === '#000' || c === 'black' || c === 'rgb(0, 0, 0)') return null;
            return c;
        };
        // ความกว้างคอลัมน์จากชีท (px)
        const cols = [...table.querySelectorAll('colgroup col')].map(c => parseInt(c.getAttribute('width') || c.style.width || '0') || 0);
        const rows = [];
        table.querySelectorAll('tr').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td,th').forEach(td => {
                const st = td.getAttribute('style') || '';
                const get = (prop) => { const m = st.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i')); return m ? m[1] : null; };
                // ข้อความ: แปลง <br> เป็นขึ้นบรรทัด
                const clone = td.cloneNode(true); clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                const inner = clone.textContent || '';
                const ta = (get('text-align') || '').toLowerCase();
                cells.push({
                    t: String(inner).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim(),
                    bg: norm(get('background-color') || get('background')),
                    fg: (() => { const c = (get('color') || '').trim().toLowerCase(); return (!c || c === 'inherit' || c === 'initial' || c === 'transparent') ? null : c; })(),   // เก็บสีตัวอักษรทุกสี (ขาวบนพื้นสีก็ต้องอยู่)
                    b: /font-weight\s*:\s*(bold|[6-9]00)/i.test(st) || !!td.querySelector('b,strong') || td.tagName === 'TH',
                    a: ta === 'center' ? 'c' : (ta === 'right' ? 'r' : null),
                    cs: Math.max(1, parseInt(td.getAttribute('colspan') || '1')),
                });
            });
            rows.push(cells);
        });
        return window.trimNoteGrid({ v: 2, rows, cols });
    } catch (e) { return null; }
};

// ตัดคอลัมน์/แถวที่ไม่มีข้อความเลย (เช่น คอลัมน์ A ว่าง หรือคอลัมน์ท้ายๆ ที่ก๊อปเกินมา)
window.trimNoteGrid = function(note) {
    const rows = (note.rows || []).map(r => r.map(c => typeof c === 'string' ? { t: c, cs: 1 } : c));
    // ขยาย colspan เป็นช่องจริงก่อน เพื่อรู้ว่าคอลัมน์ไหนว่างจริง
    const expanded = rows.map(r => { const out = []; r.forEach(c => { out.push({ ...c, _head: true }); for (let k = 1; k < (c.cs || 1); k++) out.push({ ...c, t: '', _head: false }); }); return out; });
    const width = Math.max(0, ...expanded.map(r => r.length));
    const keepCol = [];
    for (let x = 0; x < width; x++) keepCol.push(expanded.some(r => r[x] && r[x].t));
    const result = [];
    expanded.forEach(r => {
        if (!r.some(c => c && c.t)) return;          // แถวว่าง
        const cells = [];
        for (let x = 0; x < width; x++) {
            if (!keepCol[x]) continue;
            const c = r[x] || { t: '', cs: 1, _head: true };
            if (c._head || !cells.length) cells.push({ t: c.t, bg: c.bg || null, fg: c.fg || null, b: !!c.b, a: c.a || null, bd: c.bd, bc: c.bc, cs: 1 });
            else cells[cells.length - 1].cs++;      // ช่องที่ถูกผสานต่อจากช่องก่อนหน้า
        }
        result.push(cells);
    });
    const cols = (note.cols || []).filter((_, x) => keepCol[x]);
    return { v: 2, rows: result, cols };
};

window.noteToText = function(note) {
    if (!note) return '';
    if (note.v === 2) return (note.rows || []).map(r => r.map(c => c.t).join('\t')).join('\n');
    const all = [note.columns, ...(note.rows || [])];
    return all.map(r => (r || []).join('\t')).join('\n');
};
window.previewNote = function() {
    const el = document.getElementById('notePreview'); if (!el) return;
    if (window._pendingRich) {
        const n = window._pendingRich;
        const w = Math.max(0, ...n.rows.map(r => r.reduce((a, c) => a + (c.cs || 1), 0)));
        el.innerHTML = `<span class="text-emerald-400">✅ รับตารางจาก Google Sheet พร้อมสี/ผสานช่องแล้ว</span> — ${w} คอลัมน์ × ${n.rows.length} แถว (ตัดคอลัมน์ว่างออกให้แล้ว) <span class="text-slate-500">— ถ้าแก้ข้อความในช่องนี้ สีจะหายไป ให้วางใหม่แทน</span>`;
        return;
    }
    const n = window.parseNoteText(document.getElementById('newSheetNote').value, document.getElementById('newSheetNoteHeader').checked);
    el.innerText = n.rows.length ? `ตัวอย่าง: ${n.columns.length} คอลัมน์ × ${n.rows.length} แถว — หัวตาราง: ${n.columns.join(' | ')}` : '';
};

// ดักตอน "วาง" ลงช่องเนื้อหา — ถ้ามี HTML (วางจาก Google Sheet) เก็บสีไว้ด้วย
document.addEventListener('paste', e => {
    const ta = e.target; if (!ta || ta.id !== 'newSheetNote') return;
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (html && /<t(able|d|r)\b/i.test(html)) {
        const rich = window.parseNoteHtml(html);
        if (rich && rich.rows.length) {
            e.preventDefault();
            window._pendingRich = rich;
            ta.value = window.noteToText(rich);
            window.previewNote();
        }
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
window.openNoteSheet = async function(sheet) {
    const wrap = document.getElementById('noteTableWrap');
    const search = document.getElementById('noteSearch'); if (search) search.value = '';
    document.getElementById('sheetLoading')?.classList.add('hidden');
    let note = window._noteCache[sheet.id];
    if (!note) {
        wrap.innerHTML = '<div class="text-center text-slate-500 py-10"><span class="material-icons animate-spin">sync</span></div>';
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle();
            note = data && data.value ? JSON.parse(data.value) : { columns: [], rows: [] };
        } catch (e) { note = { columns: [], rows: [] }; }
        window._noteCache[sheet.id] = note;
    }
    window._currentNote = note;
    window._currentNoteSheetId = sheet.id;
    window.noteEditExit(false);
    const canEdit = window.currentUser && ['admin', 'manager'].includes(window.currentUser.role);
    document.getElementById('btnNoteEdit')?.classList.toggle('hidden', !canEdit);
    window.renderNoteTable();
};
window.renderNoteTable = function() {
    const wrap = document.getElementById('noteTableWrap');
    const note = window._currentNote;
    if (!wrap || !note) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const term = (document.getElementById('noteSearch')?.value || '').toLowerCase().trim();
    const hi = (txt) => { const e = esc(txt); if (!term) return e; return e.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="bg-yellow-300 rounded px-0.5">${m}</mark>`); };

    let rows, cols = [];
    if (note.v === 2) { rows = note.rows || []; cols = note.cols || []; }
    else rows = [ (note.columns || []).map(c => ({ t: c, bg: '#fce5cd', b: true, a: 'c', cs: 1 })), ...(note.rows || []).map(r => r.map(c => ({ t: c, cs: 1 }))) ];
    if (rows.length === 0) { wrap.innerHTML = '<div class="text-center text-slate-500 py-16"><span class="material-icons text-4xl opacity-40">table_chart</span><p class="mt-2 text-sm">ยังไม่มีเนื้อหา — แอดมินแก้ไขได้ที่ "จัดการชีท"</p></div>'; return; }

    const shown = rows.filter(r => !term || r.some(c => String(c.t).toLowerCase().includes(term)));
    const cnt = document.getElementById('noteCount'); if (cnt) cnt.innerText = `${shown.length}/${rows.length} แถว`;

    // ความกว้างคอลัมน์: ใช้ของชีท (ขยาย 1.15 เท่าให้อ่านง่าย) ถ้าไม่มีให้เบราว์เซอร์จัดเอง
    const colgroup = cols.length ? `<colgroup>${cols.map(w => `<col style="width:${Math.max(90, Math.round((w || 100) * 1.15))}px">`).join('')}<col style="width:36px"></colgroup>` : '';
    const cellHtml = (c) => {
        const styles = [];
        styles.push(`background:${c.bg || '#ffffff'}`);
        styles.push(`color:${c.fg || '#111827'}`);
        if (c.a === 'c') styles.push('text-align:center'); else if (c.a === 'r') styles.push('text-align:right');
        styles.push(window._noteBorderStyle(c, false));
        const cls = `px-3 py-2.5 align-middle whitespace-pre-wrap leading-snug ${c.b ? 'font-bold' : ''} ${c.t ? 'cursor-copy hover:outline hover:outline-2 hover:outline-purple-500 hover:-outline-offset-2' : ''}`;
        return `<td colspan="${c.cs || 1}" ${c.t ? `onclick="copyNoteCell(this)" data-v="${esc(c.t)}" title="คลิกเพื่อก๊อปปี้"` : ''} class="${cls}" style="${styles.join(';')}">${hi(c.t)}</td>`;
    };
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block min-w-full">
        <table class="border-collapse text-[14px]" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:${cols.length ? 'fixed' : 'auto'};${cols.length ? '' : 'width:100%'}">
            ${colgroup}
            <tbody>
                ${shown.map(r => `<tr>${r.map(cellHtml).join('')}<td class="border border-[#cbd5e1] text-center align-middle bg-slate-50"><button onclick="copyNoteRow(this)" title="ก๊อปทั้งแถว" class="text-slate-400 hover:text-purple-600 p-1"><span class="material-icons text-[15px]">content_copy</span></button></td></tr>`).join('')}
            </tbody>
        </table>
        </div>`;
};
window._copyText = async function(text, el) {
    try { await navigator.clipboard.writeText(text); } catch (e) { if (typeof fallbackCopyText === 'function') fallbackCopyText(text); }
    if (el) { const old = el.style.background; el.style.background = '#bbf7d0'; setTimeout(() => el.style.background = old, 450); }
    Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'ก๊อปปี้แล้ว' });
};
window.copyNoteCell = function(td) { window._copyText(td.dataset.v || td.innerText, td); };
window.copyNoteRow = function(btn) {
    const tr = btn.closest('tr');
    const cells = [...tr.querySelectorAll('td[data-v]')].map(td => td.dataset.v);
    window._copyText(cells.join('\t'), tr);
};

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
        const fill = (note) => { window._pendingRich = (note && note.v === 2) ? note : null; document.getElementById('newSheetNote').value = window.noteToText(note); document.getElementById('newSheetNoteHeader').checked = true; window.previewNote(); };
        if (window._noteCache[sheet.id]) fill(window._noteCache[sheet.id]);
        else appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle().then(({ data }) => { const n = data && data.value ? JSON.parse(data.value) : { columns: [], rows: [] }; window._noteCache[sheet.id] = n; fill(n); });
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


// ==========================================
// 🛠️ แก้ไขหน้าข้อความในหน้าเลย — แถบเครื่องมือคล้าย Google Sheet
// โมเดล: note.rows[r][c] = { t, bg, fg, b, a, cs }  (cs = ผสานไปทางขวากี่ช่อง)
// ==========================================
// เส้นตาราง: cell.bd = { t,b,l,r } (true=มีเส้น) ไม่ระบุ = มีทุกด้าน; cell.bc = สีเส้น
window._noteBorderStyle = function(c, editing) {
    const bd = c.bd || { t: true, b: true, l: true, r: true };
    const col = c.bc || '#cbd5e1';
    const off = editing ? '1px dashed rgba(148,163,184,.45)' : '1px hidden transparent';   // hidden = ชนะเส้นของช่องข้างเคียงใน border-collapse
    return ['t', 'r', 'b', 'l'].map(side => `border-${{ t: 'top', r: 'right', b: 'bottom', l: 'left' }[side]}:${bd[side] ? `1px solid ${col}` : off}`).join(';');
};
window._noteEdit = null;          // สำเนาที่กำลังแก้
window._noteUndo = [];
window._noteSel = null;           // { r, c1, c2 } ช่องที่เลือก (แถวเดียว)
window._noteEditing = false;

const _nClone = (n) => JSON.parse(JSON.stringify(n));
const _nToV2 = (note) => {
    if (note.v === 2) return _nClone(note);
    return { v: 2, rows: [ (note.columns || []).map(c => ({ t: c, bg: '#fce5cd', b: true, a: 'c', cs: 1 })), ...(note.rows || []).map(r => r.map(c => ({ t: c, cs: 1 }))) ], cols: [] };
};
const _nWidth = (rows) => Math.max(0, ...rows.map(r => r.reduce((a, c) => a + (c.cs || 1), 0)));
// ทำให้ทุกแถวกว้างเท่ากัน
const _nNormalize = (note) => {
    const w = _nWidth(note.rows);
    note.rows.forEach(r => { let cur = r.reduce((a, c) => a + (c.cs || 1), 0); while (cur < w) { r.push({ t: '', cs: 1 }); cur++; } });
    if (!note.cols) note.cols = [];
    while (note.cols.length < w) note.cols.push(note.cols.length ? note.cols[note.cols.length - 1] : 160);
    note.cols.length = w;
};
// ช่องที่ c ครอบคลุมคอลัมน์ภาพ x → คืน index ของ cell และ offset
const _nCellAt = (row, x) => { let pos = 0; for (let i = 0; i < row.length; i++) { const cs = row[i].cs || 1; if (x < pos + cs) return { i, start: pos }; pos += cs; } return null; };

window.noteEditStart = function() {
    if (!window._currentNote) return;
    window._noteEdit = _nToV2(window._currentNote); _nNormalize(window._noteEdit);
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
    const note = window._noteEdit; const id = window._currentNoteSheetId;
    if (!note || !id) return;
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
// ดึงข้อความจากช่องที่พิมพ์ (contenteditable) กลับเข้าโมเดล
window._noteSyncText = function() {
    if (!window._noteEdit) return;
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => {
        const r = +td.dataset.r, c = +td.dataset.c;
        const cell = window._noteEdit.rows[r] && window._noteEdit.rows[r][c];
        if (cell) cell.t = td.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
    });
};
const _nSnap = () => { window._noteSyncText(); window._noteUndo.push(_nClone(window._noteEdit)); if (window._noteUndo.length > 50) window._noteUndo.shift(); };

// ---------- การเลือกช่อง: สี่เหลี่ยม {r1,r2,x1,x2} เป็น "คอลัมน์ภาพ" (รองรับช่องผสาน) ----------
const _nX = (row, i) => { let x = 0; for (let k = 0; k < i; k++) x += row[k].cs || 1; return x; };
// คืนรายการช่องที่อยู่ในกรอบเลือก: [{r, i, cell, x1, x2}]
const _nSelCells = () => {
    const sel = window._noteSel, note = window._noteEdit; if (!sel || !note) return [];
    const out = [];
    for (let r = sel.r1; r <= sel.r2; r++) {
        const row = note.rows[r]; if (!row) continue;
        let x = 0;
        row.forEach((cell, i) => { const cs = cell.cs || 1; const a = x, b = x + cs - 1; if (b >= sel.x1 && a <= sel.x2) out.push({ r, i, cell, x1: a, x2: b }); x += cs; });
    }
    return out;
};
window._noteDrag = null;

window.renderNoteEditor = function() {
    const wrap = document.getElementById('noteTableWrap'); const note = window._noteEdit; if (!wrap || !note) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cols = note.cols || [];
    const colgroup = `<colgroup>${cols.map(w => `<col style="width:${Math.max(90, Math.round((w || 100) * 1.15))}px">`).join('')}</colgroup>`;
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.i}`));
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block min-w-full select-none">
        <table id="noteEditTable" class="border-collapse text-[14px]" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:fixed">
            ${colgroup}
            <tbody>${note.rows.map((r, ri) => { let x = 0; return `<tr>${r.map((c, ci) => {
                const st = [`background:${c.bg || '#ffffff'}`, `color:${c.fg || '#111827'}`, window._noteBorderStyle(c, true)];
                if (c.a === 'c') st.push('text-align:center'); else if (c.a === 'r') st.push('text-align:right');
                const isSel = selSet.has(`${ri}:${ci}`);
                const html = `<td data-r="${ri}" data-c="${ci}" data-x="${x}" colspan="${c.cs || 1}" contenteditable="true" spellcheck="false"
                    onmousedown="noteCellDown(event,this)" onmouseenter="noteCellEnter(event,this)" onfocus="noteCellFocus(this)"
                    class="px-3 py-2.5 align-middle whitespace-pre-wrap leading-snug outline-none ${c.b ? 'font-bold' : ''} ${isSel ? 'note-sel' : ''}"
                    style="${st.join(';')}">${esc(c.t)}</td>`;
                x += c.cs || 1; return html; }).join('')}</tr>`; }).join('')}
            </tbody>
        </table></div>`;
    window._noteUpdateSelInfo();
};
window._noteUpdateSelInfo = function() {
    const info = document.getElementById('noteSelInfo'); const sel = window._noteSel; if (!info) return;
    if (!sel) { info.innerText = 'คลิกช่อง · ลากเมาส์คลุมหลายช่อง · Shift+คลิก ขยายการเลือก'; return; }
    const n = _nSelCells().length;
    info.innerText = n > 1 ? `เลือก ${n} ช่อง (แถว ${sel.r1 + 1}${sel.r2 > sel.r1 ? '-' + (sel.r2 + 1) : ''})` : `แถว ${sel.r1 + 1} · คอลัมน์ ${sel.x1 + 1}`;
};
window._notePaintSel = function() {
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.i}`));
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => td.classList.toggle('note-sel', selSet.has(`${td.dataset.r}:${td.dataset.c}`)));
    window._noteUpdateSelInfo();
};
const _tdRect = (td) => { const r = +td.dataset.r, x1 = +td.dataset.x, x2 = x1 + (parseInt(td.getAttribute('colspan')) || 1) - 1; return { r, x1, x2 }; };
window.noteCellDown = function(e, td) {
    if (e.button !== 0) return;
    const t = _tdRect(td);
    if (e.shiftKey && window._noteSel) {
        e.preventDefault();
        const s0 = window._noteSel;
        window._noteSel = { r1: Math.min(s0.r1, t.r), r2: Math.max(s0.r2, t.r), x1: Math.min(s0.x1, t.x1), x2: Math.max(s0.x2, t.x2) };
        window._notePaintSel(); return;
    }
    window._noteSel = { r1: t.r, r2: t.r, x1: t.x1, x2: t.x2 };
    window._noteDrag = { start: t, td };
    window._notePaintSel();
};
window.noteCellEnter = function(e, td) {
    const d = window._noteDrag; if (!d || !(e.buttons & 1)) return;
    if (td === d.td) return;
    // ออกจากช่องเริ่มต้น = โหมดเลือกหลายช่อง → ยกเลิกการลากเลือกข้อความ
    try { window.getSelection().removeAllRanges(); } catch (_) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const t = _tdRect(td), s0 = d.start;
    window._noteSel = { r1: Math.min(s0.r, t.r), r2: Math.max(s0.r, t.r), x1: Math.min(s0.x1, t.x1), x2: Math.max(s0.x2, t.x2) };
    window._notePaintSel();
};
document.addEventListener('mouseup', () => { window._noteDrag = null; });
window.noteCellFocus = function(td) {
    const t = _tdRect(td); const s0 = window._noteSel;
    if (!s0 || t.r < s0.r1 || t.r > s0.r2 || t.x2 < s0.x1 || t.x1 > s0.x2) { window._noteSel = { r1: t.r, r2: t.r, x1: t.x1, x2: t.x2 }; window._notePaintSel(); }
};

window.noteCmd = async function(cmd, val) {
    const note = window._noteEdit; if (!note) return;
    if (cmd === 'undo') { if (!window._noteUndo.length) return; window._noteEdit = window._noteUndo.pop(); window._noteSel = null; window.renderNoteEditor(); return; }
    if (cmd === 'trimEmpty') { _nSnap(); const t = window.trimNoteGrid(note); note.rows = t.rows; note.cols = t.cols; window._noteSel = null; _nNormalize(note); window.renderNoteEditor(); return; }
    const sel = window._noteSel;
    if (!sel) { Swal.mixin({ toast: true, position: 'top', timer: 1500, showConfirmButton: false }).fire({ icon: 'info', title: 'คลิกเลือกช่องก่อน' }); return; }
    _nSnap();
    const cells = _nSelCells();
    const each = (fn) => cells.forEach(o => fn(o.cell, o));
    const bdOf = (c) => c.bd || { t: true, b: true, l: true, r: true };
    const abort = () => { window._noteUndo.pop(); };
    switch (cmd) {
        case 'bold': { const allB = cells.every(o => o.cell.b); each(c => c.b = !allB); break; }
        case 'fg': each(c => c.fg = val); break;
        case 'bg': each(c => c.bg = val); break;
        case 'align': each(c => c.a = val === 'l' ? null : val); break;
        case 'border': {
            if (val === 'all') each(c => c.bd = { t: true, b: true, l: true, r: true });
            else if (val === 'none') each(c => c.bd = { t: false, b: false, l: false, r: false });
            else if (val === 'outer') each((c, o) => c.bd = { ...bdOf(c), t: o.r === sel.r1, b: o.r === sel.r2, l: o.x1 <= sel.x1, r: o.x2 >= sel.x2 });
            else if (val === 'inner') each((c, o) => c.bd = { ...bdOf(c), t: o.r !== sel.r1, b: o.r !== sel.r2, l: o.x1 > sel.x1, r: o.x2 < sel.x2 });
            else { const allOn = cells.every(o => bdOf(o.cell)[val]); each(c => c.bd = { ...bdOf(c), [val]: !allOn }); }
            document.getElementById('noteBorderMenu')?.classList.add('hidden'); break;
        }
        case 'borderColor': each(c => c.bc = val); document.getElementById('noteBorderMenu')?.classList.add('hidden'); break;
        case 'merge': {
            // รวมทีละแถวตามกรอบที่เลือก (โมเดลรองรับการผสานแนวนอน)
            let did = false;
            for (let r = sel.r1; r <= sel.r2; r++) {
                const row = note.rows[r]; const idx = cells.filter(o => o.r === r).map(o => o.i);
                if (idx.length < 2) continue;
                const a = Math.min(...idx), b = Math.max(...idx);
                const merged = { ...row[a], cs: 0, t: [] };
                for (let c = a; c <= b; c++) { merged.cs += row[c].cs || 1; if (row[c].t) merged.t.push(row[c].t); }
                merged.t = merged.t.join(' '); row.splice(a, b - a + 1, merged); did = true;
            }
            if (!did) { abort(); Swal.mixin({ toast: true, position: 'top', timer: 1800, showConfirmButton: false }).fire({ icon: 'info', title: 'ลากเลือกอย่างน้อย 2 ช่องในแถวเดียวกันก่อน' }); return; }
            break;
        }
        case 'unmerge': {
            let did = false;
            cells.slice().reverse().forEach(o => { const c = o.cell, n = c.cs || 1; if (n <= 1) return; c.cs = 1; const extra = []; for (let k = 1; k < n; k++) extra.push({ t: '', bg: c.bg, fg: c.fg, b: c.b, a: c.a, bd: c.bd, bc: c.bc, cs: 1 }); note.rows[o.r].splice(o.i + 1, 0, ...extra); did = true; });
            if (!did) { abort(); return; }
            break;
        }
        case 'rowAbove': case 'rowBelow': { const w = _nWidth(note.rows); const at = cmd === 'rowAbove' ? sel.r1 : sel.r2 + 1; note.rows.splice(at, 0, Array.from({ length: w }, () => ({ t: '', cs: 1 }))); window._noteSel = null; break; }
        case 'rowDel': { const n = sel.r2 - sel.r1 + 1; if (note.rows.length - n < 1) { abort(); return; } note.rows.splice(sel.r1, n); window._noteSel = null; break; }
        case 'colLeft': case 'colRight': {
            const insertX = cmd === 'colLeft' ? sel.x1 : sel.x2 + 1;
            note.rows.forEach(r => {
                const hit = _nCellAt(r, insertX);
                if (!hit) { r.push({ t: '', cs: 1 }); return; }
                if (hit.start < insertX) r[hit.i].cs = (r[hit.i].cs || 1) + 1; else r.splice(hit.i, 0, { t: '', cs: 1 });
            });
            note.cols.splice(insertX, 0, 160); window._noteSel = null; break;
        }
        case 'colDel': {
            const n = sel.x2 - sel.x1 + 1; if (_nWidth(note.rows) - n < 1) { abort(); return; }
            for (let k = 0; k < n; k++) { note.rows.forEach(r => { const hit = _nCellAt(r, sel.x1); if (!hit) return; if ((r[hit.i].cs || 1) > 1) r[hit.i].cs--; else r.splice(hit.i, 1); }); note.cols.splice(sel.x1, 1); }
            window._noteSel = null; break;
        }
        case 'colWidth': {
            const { value } = await Swal.fire({ title: `ความกว้างคอลัมน์ ${sel.x1 + 1}${sel.x2 > sel.x1 ? '-' + (sel.x2 + 1) : ''} (px)`, input: 'number', inputValue: note.cols[sel.x1] || 160, inputAttributes: { min: 60, max: 900 } });
            if (!value) { abort(); return; }
            for (let x = sel.x1; x <= sel.x2; x++) note.cols[x] = parseInt(value); break;
        }
    }
    _nNormalize(note);
    window.renderNoteEditor();
};
document.addEventListener('mousedown', e => { const m = document.getElementById('noteBorderMenu'); if (m && !m.classList.contains('hidden') && !e.target.closest('#noteBorderMenuWrap')) m.classList.add('hidden'); });
// คีย์ลัด
document.addEventListener('keydown', e => {
    if (!window._noteEditing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); window.noteCmd('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); window.noteCmd('undo'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); window.noteEditSave(); }
});
