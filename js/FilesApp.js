// ==========================================
// 📁 คลังไฟล์ และ โปรแกรม (FILES APP)
// ==========================================
let globalAppFiles = [];
let globalFilesDownloads = {}; // { fileId: count }
let globalFilesLogs = [];      // [{ file_id, file_title, user, ts }]
let filesActiveCategory = 'ALL';

// 1. เริ่มระบบ
window.initFilesApp = async function() {
    const hasPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('files_manage') : false;
    const isAdmin = hasPerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const adminControls = document.getElementById('filesAdminControls');
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    filesActiveCategory = 'ALL';
    await fetchFilesData();
};

// 2. ดึงข้อมูลทั้งหมด
window.fetchFilesData = async function() {
    const grid = document.getElementById('filesGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-20"><span class="material-icons animate-spin text-emerald-500 text-5xl mb-2">sync</span><br><span class="text-gray-400 font-bold">กำลังโหลดไฟล์...</span></div>';

    try {
        const [filesRes, dlRes, logRes] = await Promise.all([
            appDB.from('settings').select('value').eq('key', 'app_files_data').single(),
            appDB.from('settings').select('value').eq('key', 'app_files_downloads').single(),
            appDB.from('settings').select('value').eq('key', 'app_files_logs').single()
        ]);
        globalAppFiles   = (filesRes.data?.value) ? JSON.parse(filesRes.data.value) : [];
        globalFilesDownloads = (dlRes.data?.value) ? JSON.parse(dlRes.data.value) : {};
        globalFilesLogs  = (logRes.data?.value) ? JSON.parse(logRes.data.value) : [];
    } catch(e) {
        console.error("Fetch files error:", e);
        globalAppFiles = []; globalFilesDownloads = {}; globalFilesLogs = [];
    }
    renderCategoryTabs();
    renderFilesGrid();
};

// 3. สร้างแท็บหมวดหมู่
window.renderCategoryTabs = function() {
    const container = document.getElementById('filesCategoryTabs');
    if(!container) return;

    const cats = ['ALL', ...new Set(globalAppFiles.map(f => f.category || 'อื่นๆ'))];
    const catIcons = { 'ALL':'apps', 'โปรแกรม':'terminal', 'VPN':'vpn_key', 'Discord':'forum', 'Telegram':'near_me', 'เอกสาร':'description', 'อื่นๆ':'more_horiz' };

    container.innerHTML = cats.map(c => {
        const count = c === 'ALL' ? globalAppFiles.length : globalAppFiles.filter(f => (f.category||'อื่นๆ') === c).length;
        const icon = catIcons[c] || 'label';
        const isActive = filesActiveCategory === c;
        return `<button onclick="setFilesCategory('${c}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${
            isActive
            ? 'bg-emerald-600 text-white border-emerald-500 shadow'
            : 'bg-slate-800 text-gray-400 border-slate-700 hover:text-white hover:border-slate-500'
        }">
            <span class="material-icons text-[14px]">${icon}</span>
            ${c === 'ALL' ? 'ทั้งหมด' : c}
            <span class="${isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-gray-400'} px-1.5 py-0.5 rounded text-[10px] font-black">${count}</span>
        </button>`;
    }).join('');
};

window.setFilesCategory = function(cat) {
    filesActiveCategory = cat;
    renderCategoryTabs();
    renderFilesGrid();
};

// 4. วาดการ์ดไฟล์
window.renderFilesGrid = function() {
    const grid = document.getElementById('filesGrid');
    if(!grid) return;

    const term = document.getElementById('searchFilesInput')?.value.toLowerCase() || '';
    const hasPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('files_manage') : false;
    const isAdmin = hasPerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    let filtered = globalAppFiles.filter(f => {
        const matchSearch = f.title.toLowerCase().includes(term) || (f.desc && f.desc.toLowerCase().includes(term));
        const matchCat = filesActiveCategory === 'ALL' || (f.category || 'อื่นๆ') === filesActiveCategory;
        return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-24 text-gray-400"><span class="material-icons text-7xl mb-3 opacity-20">folder_off</span><span class="font-bold text-lg">ไม่พบไฟล์ที่ค้นหา</span></div>`;
        return;
    }

    grid.innerHTML = filtered.map(f => {
        let icon = 'description';
        let iconColor = 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
        let firstUrl = Array.isArray(f.url) && f.url.length > 0 ? (typeof f.url[0] === 'object' ? (f.url[0].url || '') : (f.url[0] || '')) : (typeof f.url === 'string' ? f.url : '');
        const urlLower = String(firstUrl).toLowerCase();

        if (urlLower.includes('.zip') || urlLower.includes('.rar') || (Array.isArray(f.url) && f.url.length > 1)) {
            icon = 'folder_zip'; iconColor = 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';
        } else if (urlLower.includes('.exe') || urlLower.includes('.msi') || urlLower.includes('.apk')) {
            icon = 'terminal'; iconColor = 'text-red-500 bg-red-100 dark:bg-red-900/30';
        } else if (urlLower.includes('drive.google')) {
            icon = 'add_to_drive'; iconColor = 'text-green-500 bg-green-100 dark:bg-green-900/30';
        }

        const imageOrIconHtml = (f.cover_url && f.cover_url.trim() !== '') ?
            `<img src="${f.cover_url}" class="w-14 h-14 rounded-2xl object-cover shadow-md border border-gray-200 dark:border-slate-600 shrink-0 bg-white" alt="cover">` :
            `<div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${iconColor}"><span class="material-icons text-3xl">${icon}</span></div>`;

        // badge ใหม่/อัปเดต
        const ts = f.updated_at || f.created_at || 0;
        const isNew = (now - ts) < sevenDays;
        const isUpdated = f.updated_at && f.updated_at !== f.created_at && (now - f.updated_at) < sevenDays;
        const newBadge = isUpdated
            ? `<span class="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded shadow">อัปเดต</span>`
            : isNew
            ? `<span class="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow">ใหม่</span>`
            : '';

        // download count
        const dlCount = globalFilesDownloads[f.id] || 0;
        const dlBadge = `<span class="text-[10px] text-gray-500 flex items-center gap-0.5"><span class="material-icons text-[12px]">download</span>${dlCount} ครั้ง</span>`;

        // category badge
        const catBadge = f.category ? `<span class="text-[9px] bg-slate-700 text-gray-400 px-1.5 py-0.5 rounded">${f.category}</span>` : '';

        const adminBtns = isAdmin ? `
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                <button onclick="editFileLink('${f.id}')" class="text-gray-400 hover:text-amber-500 p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">edit</span></button>
                <button onclick="deleteFileLink('${f.id}')" class="text-gray-400 hover:text-red-500 p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">delete</span></button>
            </div>` : '';

        return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all group relative flex flex-col h-full transform hover:-translate-y-1">
            ${adminBtns}
            <div class="flex items-start gap-4 mb-3">
                ${imageOrIconHtml}
                <div class="flex-1 min-w-0 pr-6 pt-1">
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <h4 class="font-black text-slate-800 dark:text-white text-base truncate leading-tight" title="${f.title}">${f.title}</h4>
                        ${newBadge}
                    </div>
                    <p class="text-[11px] font-bold text-gray-500 line-clamp-2 leading-snug">${f.desc || 'ไม่มีคำอธิบาย'}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        ${catBadge}
                        ${dlBadge}
                    </div>
                </div>
            </div>
            <div class="mt-auto pt-2">
                <button onclick="forceDownloadFile('${f.id}')" class="w-full bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition group/btn">
                    <span class="material-icons text-[18px] group-hover/btn:translate-y-0.5 transition-transform">download</span> ดาวน์โหลด
                </button>
            </div>
        </div>`;
    }).join('');
};

// 5. เพิ่มไฟล์
window.openAddFileModal = function() {
    document.getElementById('fileModal').classList.remove('hidden');
    ['fileEditId','fileTitle','fileDesc','fileExternalUrl','fileInput','fileCoverInput'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    const catEl = document.getElementById('fileCategory');
    if(catEl) catEl.value = '';
    document.getElementById('currentFileUrl')?.classList.add('hidden');
    document.getElementById('currentCoverContainer')?.classList.add('hidden');
    document.getElementById('fileModalTitle').innerHTML = '<span class="material-icons">add_box</span> เพิ่มไฟล์ใหม่';
    document.getElementById('fileSubmitBtn').innerText = 'บันทึกไฟล์';
    document.getElementById('fileSubmitBtn').className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl shadow-lg transition transform active:scale-95 mt-4 text-base border border-emerald-400";
};

// 6. แก้ไขไฟล์
window.editFileLink = function(id) {
    const f = globalAppFiles.find(x => String(x.id) === String(id));
    if(!f) return Swal.fire('Error', 'ไม่พบข้อมูลไฟล์', 'error');

    document.getElementById('fileModal').classList.remove('hidden');
    document.getElementById('fileEditId').value = f.id;
    document.getElementById('fileTitle').value = f.title;
    document.getElementById('fileDesc').value = f.desc || '';
    const catEl = document.getElementById('fileCategory');
    if(catEl) catEl.value = f.category || '';

    const extUrlInput = document.getElementById('fileExternalUrl');
    let urls = Array.isArray(f.url) ? f.url : [f.url];
    let firstUrlStr = '';
    if (urls.length > 0 && urls[0]) {
        firstUrlStr = typeof urls[0] === 'object' ? (urls[0].url || '') : String(urls[0]);
    }
    if (firstUrlStr && !firstUrlStr.includes('supabase.co')) {
        extUrlInput.value = firstUrlStr;
    } else {
        extUrlInput.value = '';
    }
    if(document.getElementById('fileInput')) document.getElementById('fileInput').value = '';
    if(document.getElementById('fileCoverInput')) document.getElementById('fileCoverInput').value = '';

    const urlEl = document.getElementById('currentFileUrl');
    if (urlEl && firstUrlStr.includes('supabase.co')) {
        urlEl.innerText = `มีไฟล์เดิมอยู่แล้ว: ${urls.length} ไฟล์`;
        urlEl.classList.remove('hidden');
    } else {
        if (urlEl) urlEl.classList.add('hidden');
    }

    const coverContainer = document.getElementById('currentCoverContainer');
    const coverImg = document.getElementById('currentFileCover');
    if(coverContainer && coverImg) {
        if(f.cover_url) { coverImg.src = f.cover_url; coverContainer.classList.remove('hidden'); }
        else coverContainer.classList.add('hidden');
    }

    document.getElementById('fileModalTitle').innerHTML = '<span class="material-icons text-amber-400">edit</span> แก้ไขข้อมูลไฟล์';
    document.getElementById('fileSubmitBtn').innerText = 'บันทึกการแก้ไข';
    document.getElementById('fileSubmitBtn').className = "w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3.5 rounded-xl shadow-lg transition transform active:scale-95 mt-4 text-base border border-amber-300";
};

// 7. บันทึก
window.saveFileData = async function(e) {
    e.preventDefault();
    const id = document.getElementById('fileEditId').value;
    const title = document.getElementById('fileTitle').value.trim();
    const desc = document.getElementById('fileDesc').value.trim();
    const category = document.getElementById('fileCategory')?.value.trim() || '';
    const externalUrl = document.getElementById('fileExternalUrl').value.trim();
    const fileInput = document.getElementById('fileInput');
    const coverInput = document.getElementById('fileCoverInput');

    if(!title) return;
    if (!id && !externalUrl && (!fileInput.files || fileInput.files.length === 0)) {
        return Swal.fire('เตือน', 'กรุณาวางลิงก์ดาวน์โหลด หรือ เลือกไฟล์อัปโหลดอย่างน้อย 1 รายการครับ', 'warning');
    }

    Swal.fire({ title: 'กำลังอัปโหลด...', text: 'ระบบกำลังส่งไฟล์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let finalFileUrls = [];
    let finalCoverUrl = '';

    try {
        if (externalUrl) {
            finalFileUrls = [externalUrl];
        } else if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const uploadPromises = Array.from(fileInput.files).map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `app_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}.${fileExt}`;
                const { error: uploadError } = await appDB.storage.from('staff_images').upload(`files/${fileName}`, file, { cacheControl: '3600', upsert: false });
                if (uploadError) throw new Error(`อัปโหลดไฟล์ ${file.name} ไม่สำเร็จ`);
                const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/${fileName}`);
                return { url: publicUrlData.publicUrl, originalName: file.name };
            });
            finalFileUrls = await Promise.all(uploadPromises);
        } else if (id) {
            const existingFile = globalAppFiles.find(x => String(x.id) === String(id));
            if (existingFile?.url) finalFileUrls = Array.isArray(existingFile.url) ? existingFile.url : [existingFile.url];
        }

        if (coverInput && coverInput.files && coverInput.files.length > 0) {
            const coverFile = coverInput.files[0];
            const coverExt = coverFile.name.split('.').pop();
            const coverName = `cover_${Date.now()}_${Math.floor(Math.random() * 1000)}.${coverExt}`;
            const { error: coverError } = await appDB.storage.from('staff_images').upload(`files/covers/${coverName}`, coverFile, { cacheControl: '3600', upsert: false });
            if (coverError) throw new Error('อัปโหลดรูปปกไม่สำเร็จ: ' + coverError.message);
            const { data: coverUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/covers/${coverName}`);
            finalCoverUrl = coverUrlData.publicUrl;
        } else if (id) {
            const existingFile = globalAppFiles.find(x => String(x.id) === String(id));
            finalCoverUrl = existingFile ? (existingFile.cover_url || '') : '';
        }

        if (id) {
            const index = globalAppFiles.findIndex(x => String(x.id) === String(id));
            if(index !== -1) globalAppFiles[index] = { ...globalAppFiles[index], title, url: finalFileUrls, cover_url: finalCoverUrl, desc, category, updated_at: Date.now() };
        } else {
            globalAppFiles.unshift({ id: 'file_' + Date.now(), title, url: finalFileUrls, cover_url: finalCoverUrl, desc, category, created_at: Date.now() });
        }

        await appDB.from('settings').upsert([{ key: 'app_files_data', value: JSON.stringify(globalAppFiles) }]);
        document.getElementById('fileModal').classList.add('hidden');
        renderCategoryTabs();
        renderFilesGrid();
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

// 8. ลบ
window.deleteFileLink = async function(id) {
    Swal.fire({
        title: 'ลบไฟล์นี้?', text: "ลบแล้วจะไม่สามารถกู้คืนได้", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#475569', confirmButtonText: 'ลบทิ้งเลย'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
            try {
                globalAppFiles = globalAppFiles.filter(f => String(f.id) !== String(id));
                await appDB.from('settings').upsert([{ key: 'app_files_data', value: JSON.stringify(globalAppFiles) }]);
                renderCategoryTabs();
                renderFilesGrid();
                Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false});
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// 9. ดาวน์โหลด + บันทึก log + นับ
window.forceDownloadFile = async function(id) {
    const f = globalAppFiles.find(x => String(x.id) === String(id));
    if(!f || !f.url) return Swal.fire('Error', 'ไม่มีลิงก์สำหรับดาวน์โหลด', 'error');

    // บันทึก download count
    globalFilesDownloads[id] = (globalFilesDownloads[id] || 0) + 1;

    // บันทึก log ว่าใครโหลด
    const logEntry = {
        file_id: id,
        file_title: f.title,
        user: currentUser?.username || 'unknown',
        ts: Date.now()
    };
    globalFilesLogs.unshift(logEntry);
    if (globalFilesLogs.length > 500) globalFilesLogs = globalFilesLogs.slice(0, 500);

    // save ขึ้น db (silent)
    Promise.all([
        appDB.from('settings').upsert([{ key: 'app_files_downloads', value: JSON.stringify(globalFilesDownloads) }]),
        appDB.from('settings').upsert([{ key: 'app_files_logs', value: JSON.stringify(globalFilesLogs) }])
    ]).catch(e => console.error('log error:', e));

    // อัปเดต UI badge ทันที
    renderFilesGrid();

    let urls = Array.isArray(f.url) ? f.url : [f.url];
    if (urls.length === 0 || !urls[0]) return Swal.fire('Error', 'ไม่มีข้อมูลไฟล์', 'error');

    if (urls.length === 1) {
        let fileData = urls[0];
        let singleUrl = typeof fileData === 'string' ? fileData : fileData.url;
        let defaultName = `${f.title}.${singleUrl.split('.').pop().split('?')[0] || 'file'}`;
        let originalName = typeof fileData === 'string' ? defaultName : (fileData.originalName || defaultName);

        if (singleUrl.includes('drive.google') || !singleUrl.includes('supabase.co')) {
            window.open(singleUrl, '_blank'); return;
        }
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true }).fire({ icon: 'success', title: 'เริ่มดาวน์โหลดแล้ว' });
        let finalUrl = singleUrl;
        if (finalUrl.includes('supabase.co/storage/v1/object/public/')) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + `download=${encodeURIComponent(originalName)}`;
        }
        const a = document.createElement('a');
        a.href = finalUrl; a.download = originalName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
        let htmlButtons = '';
        urls.forEach((fileData, i) => {
            let singleUrl = typeof fileData === 'string' ? fileData : fileData.url;
            let defaultName = `${f.title}_part${i+1}.${singleUrl.split('.').pop().split('?')[0] || 'file'}`;
            let originalName = typeof fileData === 'string' ? defaultName : (fileData.originalName || defaultName);
            let finalUrl = singleUrl;
            if (finalUrl.includes('supabase.co/storage/v1/object/public/')) {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + `download=${encodeURIComponent(originalName)}`;
            }
            htmlButtons += `
                <a href="${finalUrl}" download="${originalName}"
                   onclick="this.classList.replace('bg-slate-700','bg-emerald-600'); this.querySelector('.material-icons').innerText='check_circle';"
                   class="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-600 text-white p-3.5 rounded-xl transition shadow-md border border-slate-600 cursor-pointer group">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <span class="bg-slate-900 px-2 py-1 rounded text-[10px] font-mono">ไฟล์ที่ ${i+1}</span>
                        <span class="font-bold text-sm truncate">${originalName}</span>
                    </div>
                    <span class="material-icons text-gray-400 shrink-0">download</span>
                </a>`;
        });
        Swal.fire({
            title: `<div class="text-xl font-black text-emerald-400">รายการนี้มี ${urls.length} ไฟล์</div>`,
            html: `<p class="text-xs text-gray-400 mb-4">กรุณากดปุ่มด้านล่างเพื่อดาวน์โหลดทีละไฟล์</p><div class="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1 text-left">${htmlButtons}</div>`,
            showConfirmButton: false, showCloseButton: true,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
        });
    }
};

// 10. ประวัติดาวน์โหลด (admin)
window.openFilesDownloadLog = function() {
    if (globalFilesLogs.length === 0) {
        return Swal.fire('ยังไม่มีประวัติ', 'ยังไม่มีใครดาวน์โหลดไฟล์', 'info');
    }

    // สรุปยอดดาวน์โหลดต่อไฟล์
    const summary = {};
    globalFilesLogs.forEach(log => {
        if(!summary[log.file_title]) summary[log.file_title] = 0;
        summary[log.file_title]++;
    });
    const topFiles = Object.entries(summary).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const topHtml = topFiles.map(([ title, count ], i) => `
        <div class="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-xl border border-slate-700 mb-1.5">
            <div class="flex items-center gap-2">
                <span class="text-xs font-black ${i===0?'text-amber-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-500'}">#${i+1}</span>
                <span class="text-sm font-bold text-white truncate">${title}</span>
            </div>
            <span class="text-emerald-400 font-black text-sm">${count} ครั้ง</span>
        </div>`).join('');

    const logHtml = globalFilesLogs.slice(0, 100).map(log => {
        const d = new Date(log.ts);
        const timeStr = d.toLocaleString('th-TH', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        return `
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 hover:bg-slate-700/30 transition">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="material-icons text-emerald-400 text-[16px]">download</span>
                <span class="text-sm text-white font-bold truncate">${log.file_title}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-2">
                <span class="text-xs font-bold text-sky-400 bg-sky-900/30 px-2 py-0.5 rounded">${log.user}</span>
                <span class="text-[10px] text-gray-500">${timeStr}</span>
            </div>
        </div>`;
    }).join('');

    Swal.fire({
        html: `
        <div class="text-left">
            <div class="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                <span class="material-icons text-amber-400">leaderboard</span>
                <span class="text-white font-black text-lg">ไฟล์ยอดนิยม</span>
            </div>
            <div class="mb-5">${topHtml}</div>
            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
                <span class="material-icons text-emerald-400">history</span>
                <span class="text-white font-black">ประวัติล่าสุด 100 รายการ</span>
            </div>
            <div class="max-h-[45vh] overflow-y-auto custom-scrollbar">${logHtml}</div>
        </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        width: '600px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
    });
};
