// ==========================================
// 🟢 ฟังก์ชันเช็คสิทธิ์ (โชว์ปุ่มแอดมิน) ตอนเปิดหน้า
// ==========================================
window.initSheetApp = async function() {
    const btnManage = document.getElementById('btnManageSheet');
    if (btnManage) {
        if (window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.role === 'manager')) {
            btnManage.classList.remove('hidden'); // ถ้าเป็นแอดมินให้โชว์ปุ่มจัดการชีท
        } else {
            btnManage.classList.add('hidden'); // พนักงานทั่วไปซ่อนปุ่ม
        }
    }
};

// ==========================================
// 📊 ตารางงานรวม (SHEETS MANAGER)
// ==========================================
let recentTabs = JSON.parse(localStorage.getItem('sheet_recent_tabs') || '[]');

window.renderRecentTabs = function() {
    const container = document.getElementById('recentTabsContainer');
    if (!container) return;
    const isSheetAppOpen = document.getElementById('sheetApp') && !document.getElementById('sheetApp').classList.contains('hidden');
    
    if (recentTabs.length === 0 || !isSheetAppOpen) { 
        container.classList.add('hidden'); 
        return; 
    }
    container.classList.remove('hidden');

    let html = recentTabs.map(tab => {
        const currentTitleEl = document.getElementById('sheetTitle');
        const currentTitle = currentTitleEl ? currentTitleEl.innerText : '';
        const isViewerVisible = document.getElementById('sheetViewer') && !document.getElementById('sheetViewer').classList.contains('hidden');
        const isActive = currentTitle.includes(tab.name) && isViewerVisible;
        const activeClass = isActive ? 'bg-white text-blue-700 border-t-2 border-blue-600 rounded-t-lg shadow-sm' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 rounded-t-lg opacity-80';
        const icon = (tab.sheet_id && tab.sheet_id.startsWith('http')) ? 'link' : 'table_chart';

        return `<div onclick='openSheet(${JSON.stringify(tab)})' class="${activeClass} px-3 py-1.5 min-w-[120px] max-w-[200px] flex items-center justify-between gap-2 cursor-pointer transition select-none group border-x border-t border-gray-300/50"><div class="flex items-center gap-1 overflow-hidden"><span class="material-icons text-xs">${icon}</span><span class="text-xs font-bold truncate">${tab.name}</span></div><button onclick="closeTab(event, ${tab.id})" class="text-gray-400 hover:text-red-500 rounded-full p-0.5 hover:bg-gray-100/50"><span class="material-icons text-[14px] font-bold">close</span></button></div>`;
    }).join('');

    if (recentTabs.length > 1) { html += `<button onclick="clearAllTabs()" class="ml-2 px-2 text-[10px] text-red-500 hover:text-red-700 underline shrink-0">ล้างทั้งหมด</button>`; }
    container.innerHTML = html;
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
    recentTabs = recentTabs.filter(t => t.id !== id);
    localStorage.setItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    if (recentTabs.length === 0) closeSheet();
    renderRecentTabs();
};

window.clearAllTabs = function() {
    recentTabs = [];
    localStorage.setItem('sheet_recent_tabs', '[]');
    renderRecentTabs();
    closeSheet();
};

window.openSheet = function(sheet) {
    document.getElementById('sheetMenu').classList.add('hidden');
    document.getElementById('sheetViewer').classList.remove('hidden');
    document.getElementById('sheetTitle').innerHTML = `<span class="text-gray-500">${sheet.group_name}</span> <span class="material-icons text-xs mx-1">arrow_forward_ios</span> <span class="text-white">${sheet.name}</span>`;
    document.getElementById('sheetLoading').classList.remove('hidden');
    
    addToRecentTabs(sheet);

    let url = '';
    // จัดการแปลงลิงก์ให้ถูกต้อง
    if (sheet.sheet_id.startsWith('http') || sheet.sheet_id.startsWith('www')) {
        url = sheet.sheet_id.startsWith('www') ? 'https://' + sheet.sheet_id : sheet.sheet_id;
    } else {
        url = `${SHEET_BASE}/${sheet.sheet_id}/edit?rm=minimal&single=true&widget=true&headers=false`;
        if(sheet.gid) url += `&gid=${sheet.gid}`;
    }
    
    // ผูกลิงก์กับปุ่ม "เปิดแท็บใหม่"
    const btnNewTab = document.getElementById('btnOpenNewTab');
    if (btnNewTab) {
        btnNewTab.onclick = () => window.open(url, '_blank');
    }
    
    const frame = document.getElementById('sheetFrame');
    frame.onload = function() { window.hideSheetLoading(); };
    frame.src = url;
};

window.closeSheet = function() {
    const frame = document.getElementById('sheetFrame');
    if(frame) frame.src = 'about:blank';
    document.getElementById('sheetViewer')?.classList.add('hidden');
    document.getElementById('sheetMenu')?.classList.remove('hidden');
};

window.hideSheetLoading = function() {
    document.getElementById('sheetLoading')?.classList.add('hidden');
};

window.showSheetAdmin = function() {
    document.getElementById('sheetAdminModal').classList.remove('hidden');
    if(typeof renderAdminSheetList === 'function') renderAdminSheetList();
};

window.closeSheetAdmin = function() {
    document.getElementById('sheetAdminModal').classList.add('hidden');
};

window.renderAdminSheetList = function() {
    const list = document.getElementById('adminSheetList');
    if(!list) return;
    const colorMap = { 'blue': '#3b82f6', 'green': '#10b981', 'red': '#ef4444', 'yellow': '#f59e0b', 'purple': '#8b5cf6', 'gray': '#64748b' };
    
    list.innerHTML = GLOBAL_SHEETS.map(s => {
        let bg = s.color;
        if(bg && !bg.startsWith('#')) bg = colorMap[bg] || '#8b5cf6';
        if(!bg) bg = '#8b5cf6';
        
        return `
        <div class="flex justify-between items-center bg-slate-800 p-3 border border-slate-700 rounded-2xl shadow-sm hover:border-purple-500/50 transition group hover:shadow-lg">
            <div class="overflow-hidden mr-2 flex items-center gap-4">
                <div class="w-2.5 h-10 rounded-full shrink-0 shadow-inner" style="background-color: ${bg}"></div>
                <div class="truncate">
                    <div class="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-0.5">${s.group_name}</div>
                    <div class="text-white font-bold text-sm truncate">${s.name}</div>
                </div>
            </div>
            <div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="startEdit(${s.id})" class="text-amber-400 hover:bg-amber-400/10 p-2 rounded-xl transition" title="แก้ไข"><span class="material-icons text-sm">edit</span></button>
                <button onclick="deleteSheet(${s.id})" class="text-red-400 hover:bg-red-400/10 p-2 rounded-xl transition" title="ลบ"><span class="material-icons text-sm">delete</span></button>
            </div>
        </div>`;
    }).join('');
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
        
        const payload = { name, group_name: group, sheet_id: sheetId, gid, color, cover_url: finalCoverUrl };

        if (id) {
            const { error } = await appDB.from('external_sheets').update(payload).eq('id', id);
            if(error) throw error;
            Swal.fire('เรียบร้อย', 'แก้ไขข้อมูลสำเร็จ', 'success');
        } else {
            const { error } = await appDB.from('external_sheets').insert([payload]);
            if(error) throw error;
            Swal.fire('เรียบร้อย', 'เพิ่มรายการสำเร็จ', 'success');
        }
        
        window.cancelEdit();
        if(typeof fetchSheets === 'function') await fetchSheets();
        window.renderAdminSheetList();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

window.startEdit = function(id) {
    const sheet = GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if(!sheet) return;

    document.getElementById('editSheetId').value = sheet.id;
    document.getElementById('newSheetName').value = sheet.name;
    document.getElementById('newSheetGroup').value = sheet.group_name;
    document.getElementById('newSheetCover').value = sheet.cover_url || '';
    
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    const coverContainer = document.getElementById('currentSheetCoverContainer');
    const coverImg = document.getElementById('currentSheetCoverImg');
    if(coverContainer && coverImg) {
        if(sheet.cover_url) { coverImg.src = sheet.cover_url; coverContainer.classList.remove('hidden'); } 
        else { coverContainer.classList.add('hidden'); }
    }
    
    if (!sheet.sheet_id.startsWith('http')) {
        let fullUrl = `https://docs.google.com/spreadsheets/d/${sheet.sheet_id}`;
        if(sheet.gid) fullUrl += `#gid=${sheet.gid}`;
        document.getElementById('newSheetUrl').value = fullUrl;
    } else { document.getElementById('newSheetUrl').value = sheet.sheet_id; }

    const colorMap = { 'blue': '#3b82f6', 'green': '#22c55e', 'red': '#ef4444', 'yellow': '#eab308', 'purple': '#a855f7', 'gray': '#6b7280' };
    let hexColor = sheet.color;
    if (hexColor && !hexColor.startsWith('#')) hexColor = colorMap[hexColor] || '#3b82f6';
    document.getElementById('newSheetColor').value = hexColor;

    document.getElementById('formTitle').innerText = `✏️ กำลังแก้ไข: ${sheet.name}`;
    document.getElementById('formTitle').className = "text-sm font-bold text-orange-600";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerText = "บันทึกการแก้ไข"; btn.classList.replace('bg-green-600', 'bg-orange-500'); btn.classList.replace('hover:bg-green-700', 'hover:bg-orange-600');
    document.getElementById('btnCancelEdit').classList.remove('hidden');
};

window.cancelEdit = function() {
    ['editSheetId','newSheetName','newSheetGroup','newSheetUrl','newSheetCover'].forEach(id => document.getElementById(id).value = '');
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    if(document.getElementById('currentSheetCoverContainer')) document.getElementById('currentSheetCoverContainer').classList.add('hidden');
    document.getElementById('newSheetColor').value = '#3b82f6';
    
    document.getElementById('formTitle').innerText = "เพิ่มรายการใหม่";
    document.getElementById('formTitle').className = "text-sm font-bold text-blue-600";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerText = "บันทึก"; btn.classList.replace('bg-orange-500', 'bg-green-600'); btn.classList.replace('hover:bg-orange-600', 'hover:bg-green-700');
    document.getElementById('btnCancelEdit').classList.add('hidden');
};

window.togglePin = function(e, id) {
    e.stopPropagation();
    let pinned = JSON.parse(localStorage.getItem('pinned_sheets') || '[]');
    if (pinned.includes(id)) pinned = pinned.filter(pid => pid !== id);
    else pinned.push(id);
    localStorage.setItem('pinned_sheets', JSON.stringify(pinned));
    if(typeof renderSheetMenu === 'function') renderSheetMenu();
};

window.renderSheetMenu = function() {
    const container = document.getElementById('sheetGroupsContainer');
    const searchInput = document.getElementById('sheetSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if(!container) return;
    container.innerHTML = '';
    
    const pinnedIds = JSON.parse(localStorage.getItem('pinned_sheets') || '[]');
    const groups = {}; const pinnedSheets = [];

    GLOBAL_SHEETS.forEach(sheet => {
        if(searchTerm && !sheet.name.toLowerCase().includes(searchTerm) && !sheet.group_name.toLowerCase().includes(searchTerm)) return;
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
        const isExternal = sheet.sheet_id.startsWith('http');
        const iconType = isExternal ? 'public' : 'grid_view';
        const starIcon = isPinned ? 'star' : 'star_outline';
        const starClass = isPinned ? 'text-amber-400 opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:scale-110';
        
        let cardHtml = '';
        const isHex = sheet.color && sheet.color.startsWith('#');
        const themeColor = isHex ? sheet.color : '#3b82f6';

        if (sheet.cover_url && sheet.cover_url.trim() !== '') {
            cardHtml = `
            <div class="relative group cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-xl rounded-2xl h-36 overflow-hidden bg-slate-900 border border-slate-700/50" onclick='openSheet(${JSON.stringify(sheet)})'>
                <img src="${sheet.cover_url}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-50 group-hover:opacity-30" loading="lazy" onerror="this.style.display='none'">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent"></div>
                <div class="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
                    <div class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-2 shadow-lg group-hover:bg-white/20 transition"><span class="material-icons text-2xl text-white drop-shadow-md">${iconType}</span></div>
                    <span class="font-bold text-sm text-center leading-tight text-white drop-shadow-lg line-clamp-2 px-2">${sheet.name}</span>
                </div>
                <button onclick="togglePin(event, ${sheet.id})" class="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-all duration-300 ${starClass} bg-black/20 backdrop-blur-md hover:bg-white/90"><span class="material-icons text-xl leading-none block">${starIcon}</span></button>
            </div>`;
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

            cardHtml = `
            <div class="relative group cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-xl rounded-2xl h-36 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col items-center justify-center p-4" onclick='openSheet(${JSON.stringify(sheet)})'>
                ${topBar}
                ${iconWrapper}
                <span class="font-extrabold text-sm text-center leading-tight text-slate-700 dark:text-slate-200 line-clamp-2 px-1">${sheet.name}</span>
                <button onclick="togglePin(event, ${sheet.id})" class="absolute top-2 right-2 z-20 p-1.5 rounded-full transition-all duration-300 ${starClass} bg-slate-50 dark:bg-slate-900 hover:bg-white border border-transparent hover:border-amber-200 hover:shadow-sm"><span class="material-icons text-lg leading-none block">${starIcon}</span></button>
            </div>`;
        }
        return cardHtml;
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
