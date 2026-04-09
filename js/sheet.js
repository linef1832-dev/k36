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
    localStorage.setItem('pinned_sheets', JSON.stringify(pinned));
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
    localStorage.setItem('calc_saved_team', team); 
    
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
            localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
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
        localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
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
    localStorage.setItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    renderRecentTabs();
};

window.closeTab = function(e, id) {
    e.stopPropagation();
    recentTabs = recentTabs.filter(t => String(t.id) !== String(id));
    localStorage.setItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    
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
    localStorage.setItem('sheet_recent_tabs', '[]');
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
        const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if(idMatch) {
            sheetId = idMatch[1];
            const gidMatch = url.match(/[?&#]gid=([0-9]+)/); 
            if (gidMatch) gid = gidMatch[1];
        } 
        
        const payload = { name: name, group_name: group, sheet_id: sheetId, gid: gid, color: color, cover_url: finalCoverUrl };

        if (id) {
            const { error } = await appDB.from('external_sheets').update(payload).eq('id', id);
            if(error) throw error;
            Swal.fire({icon: 'success', title: 'แก้ไขข้อมูลสำเร็จ', showConfirmButton: false, timer: 1000});
        } else {
            const { error } = await appDB.from('external_sheets').insert([payload]);
            if(error) throw error;
            Swal.fire({icon: 'success', title: 'เพิ่มรายการสำเร็จ', showConfirmButton: false, timer: 1000});
        }
        
        window.cancelEdit();
        await fetchSheets();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

window.deleteSheet = async function(id) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "ลบแล้วกู้คืนไม่ได้นะ", icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก' });
    if (!result.isConfirmed) return;

    Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
    try {
        const { error } = await appDB.from('external_sheets').delete().eq('id', id);
        if (error) throw error;
        Swal.fire({icon: 'success', title: 'ลบเรียบร้อย', showConfirmButton: false, timer: 1000});
        await fetchSheets();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};
