// ==========================================
// 📁 3. คลังไฟล์ และ โปรแกรม (FILES APP)
// ==========================================
let globalAppFiles = [];

// 1. เริ่มระบบคลังไฟล์
window.initFilesApp = async function() {
    // เช็คสิทธิ์แบบปลอดภัย (ถ้ามีฟังก์ชัน hasUserPerm ให้ใช้ ถ้าไม่มีให้ดูจาก role)
    const hasPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('files_manage') : false;
    const isAdmin = hasPerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const adminControls = document.getElementById('filesAdminControls');
    
    // โชว์ปุ่ม "เพิ่มไฟล์ใหม่" สำหรับแอดมิน
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    await fetchFilesData();
};

// 2. ดึงข้อมูลไฟล์
window.fetchFilesData = async function() {
    const grid = document.getElementById('filesGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-20"><span class="material-icons animate-spin text-emerald-500 text-5xl mb-2">sync</span><br><span class="text-gray-400 font-bold">กำลังโหลดไฟล์...</span></div>';
    
    try {
        const _filesVal = await window.getSettingCached('app_files_data');
        globalAppFiles = _filesVal ? JSON.parse(_filesVal) : [];
    } catch(e) { 
        console.error("Fetch files error:", e);
        globalAppFiles = []; 
    }
    renderFilesGrid();
};

// 3. วาดตาราง (ใช้ระบบ Template)
window.renderFilesGrid = function() {
    const grid = document.getElementById('filesGrid');
    if(!grid) return;
    
    const term = document.getElementById('searchFilesInput') ? document.getElementById('searchFilesInput').value.toLowerCase() : '';
    const hasPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('files_manage') : false;
    const isAdmin = hasPerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    const filtered = globalAppFiles.filter(f => f.title.toLowerCase().includes(term) || (f.desc && f.desc.toLowerCase().includes(term)));

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-24 text-gray-400"><span class="material-icons text-7xl mb-3 opacity-20">folder_off</span><span class="font-bold text-lg">ไม่พบไฟล์ที่ค้นหา</span></div>`;
        return;
    }

    grid.innerHTML = filtered.map(f => {
        // กำหนดไอคอนให้เข้ากับประเภทของไฟล์อัตโนมัติ
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

        // จัดการรูปหน้าปก
        const imageOrIconHtml = (f.cover_url && f.cover_url.trim() !== '') ? 
            `<img src="${f.cover_url}" class="w-14 h-14 rounded-2xl object-cover shadow-md border border-gray-200 dark:border-slate-600 shrink-0 bg-white" alt="cover">` : 
            `<div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${iconColor}"><span class="material-icons text-3xl">${icon}</span></div>`;
        
        const adminBtns = isAdmin ? `
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                <button onclick="editFileLink('${f.id}')" class="text-gray-400 hover:text-amber-500 p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">edit</span></button>
                <button onclick="deleteFileLink('${f.id}')" class="text-gray-400 hover:text-red-500 p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm transition"><span class="material-icons text-[16px]">delete</span></button>
            </div>` : '';

        // ส่งข้อมูลเข้าฟังก์ชัน renderTemplate ที่เราทำไว้ใน global.js
        return window.renderTemplate('tpl-file-card', {
            adminBtns: adminBtns,
            imageOrIconHtml: imageOrIconHtml,
            title: f.title,
            desc: f.desc || 'ไม่มีคำอธิบาย',
            id: f.id
        });
    }).join('');
};

// 4. ป๊อปอัปเพิ่มไฟล์
window.openAddFileModal = function() {
    document.getElementById('fileModal').classList.remove('hidden');
    ['fileEditId','fileTitle','fileDesc','fileExternalUrl','fileInput','fileCoverInput'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    document.getElementById('currentFileUrl')?.classList.add('hidden'); 
    document.getElementById('currentCoverContainer')?.classList.add('hidden'); 
    document.getElementById('fileModalTitle').innerHTML = '<span class="material-icons">add_box</span> เพิ่มไฟล์ใหม่';
    document.getElementById('fileSubmitBtn').innerText = 'บันทึกไฟล์';
    document.getElementById('fileSubmitBtn').className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl shadow-lg transition transform active:scale-95 mt-4 text-base border border-emerald-400";
};

// 5. ป๊อปอัปแก้ไขไฟล์
window.editFileLink = function(id) {
    const f = globalAppFiles.find(x => String(x.id) === String(id));
    if(!f) return Swal.fire('Error', 'ไม่พบข้อมูลไฟล์', 'error');
    
    document.getElementById('fileModal').classList.remove('hidden');
    document.getElementById('fileEditId').value = f.id;
    document.getElementById('fileTitle').value = f.title;
    document.getElementById('fileDesc').value = f.desc || '';
    
    const extUrlInput = document.getElementById('fileExternalUrl');
    let urls = Array.isArray(f.url) ? f.url : [f.url];
    
    // แปลงโครงสร้างให้เป็น String เสมอ
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
        if(f.cover_url) {
            coverImg.src = f.cover_url;
            coverContainer.classList.remove('hidden');
        } else {
            coverContainer.classList.add('hidden');
        }
    }

    document.getElementById('fileModalTitle').innerHTML = '<span class="material-icons text-amber-400">edit</span> แก้ไขข้อมูลไฟล์';
    document.getElementById('fileSubmitBtn').innerText = 'บันทึกการแก้ไข';
    document.getElementById('fileSubmitBtn').className = "w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3.5 rounded-xl shadow-lg transition transform active:scale-95 mt-4 text-base border border-amber-300";
};

// 6. บันทึกไฟล์ขึ้น Supabase Storage
window.saveFileData = async function(e) {
    e.preventDefault();
    const id = document.getElementById('fileEditId').value;
    const title = document.getElementById('fileTitle').value.trim();
    const desc = document.getElementById('fileDesc').value.trim();
    const externalUrl = document.getElementById('fileExternalUrl').value.trim();
    const fileInput = document.getElementById('fileInput');
    const coverInput = document.getElementById('fileCoverInput');
    
    if(!title) return;
    
    if (!id && !externalUrl && (!fileInput.files || fileInput.files.length === 0)) {
        return Swal.fire('เตือน', 'กรุณาวางลิงก์ดาวน์โหลด หรือ เลือกไฟล์อัปโหลดอย่างน้อย 1 รายการครับ', 'warning');
    }

    Swal.fire({
        title: 'กำลังอัปโหลด...', 
        text: 'ระบบกำลังส่งไฟล์ขึ้นเซิร์ฟเวอร์แบบรวดเร็ว...',
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading()
    });

    let finalFileUrls = []; 
    let finalCoverUrl = '';

    try {
        if (externalUrl) {
            finalFileUrls = [externalUrl];
        } 
        else if (fileInput && fileInput.files && fileInput.files.length > 0) {
            Swal.update({ text: `กำลังส่งไฟล์ทั้ง ${fileInput.files.length} รายการขึ้นเซิร์ฟเวอร์...` });
            
            // อัปโหลดหลายๆ ไฟล์พร้อมกัน
            const uploadPromises = Array.from(fileInput.files).map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `app_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}.${fileExt}`;

                const { error: uploadError } = await appDB.storage
                    .from('staff_images') 
                    .upload(`files/${fileName}`, file, { cacheControl: '3600', upsert: false });

                if (uploadError) throw new Error(`อัปโหลดไฟล์ ${file.name} ไม่สำเร็จ`);
                const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/${fileName}`);
                
                return { url: publicUrlData.publicUrl, originalName: file.name };
            });

            finalFileUrls = await Promise.all(uploadPromises);
        } 
        else if (id && !externalUrl) {
            const existingFile = globalAppFiles.find(x => String(x.id) === String(id));
            if (existingFile && existingFile.url) {
                finalFileUrls = Array.isArray(existingFile.url) ? existingFile.url : [existingFile.url];
            }
        }

        // จัดการรูปหน้าปก
        if (coverInput && coverInput.files && coverInput.files.length > 0) {
            Swal.update({ text: 'กำลังอัปโหลดรูปปก...' });
            const coverFile = coverInput.files[0];
            const coverExt = coverFile.name.split('.').pop();
            const coverName = `cover_${Date.now()}_${Math.floor(Math.random() * 1000)}.${coverExt}`;

            const { error: coverError } = await appDB.storage
                .from('staff_images') 
                .upload(`files/covers/${coverName}`, coverFile, { cacheControl: '3600', upsert: false });

            if (coverError) throw new Error('อัปโหลดรูปปกไม่สำเร็จ: ' + coverError.message);
            const { data: coverUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/covers/${coverName}`);
            finalCoverUrl = coverUrlData.publicUrl;
        } else if (id) {
            const existingFile = globalAppFiles.find(x => String(x.id) === String(id));
            finalCoverUrl = existingFile ? (existingFile.cover_url || '') : '';
        }

        // เซฟลง Database
        if (id) {
            const index = globalAppFiles.findIndex(x => String(x.id) === String(id));
            if(index !== -1) globalAppFiles[index] = { id, title, url: finalFileUrls, cover_url: finalCoverUrl, desc, updated_at: Date.now() };
        } else {
            globalAppFiles.unshift({ id: 'file_' + Date.now(), title, url: finalFileUrls, cover_url: finalCoverUrl, desc, created_at: Date.now() });
        }

        await appDB.from('settings').upsert([{ key: 'app_files_data', value: JSON.stringify(globalAppFiles) }]);
        
        document.getElementById('fileModal').classList.add('hidden');
        renderFilesGrid();
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false});

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

// 7. ลบไฟล์
window.deleteFileLink = async function(id) {
    Swal.fire({
        title: 'ลบไฟล์นี้?',
        text: "ลบแล้วจะไม่สามารถกู้คืนได้ (ไฟล์ผี 404 ให้ลบทิ้งตรงนี้เลยครับ)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#475569',
        confirmButtonText: 'ลบทิ้งเลย'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
            try {
                globalAppFiles = globalAppFiles.filter(f => String(f.id) !== String(id));
                await appDB.from('settings').upsert([{ key: 'app_files_data', value: JSON.stringify(globalAppFiles) }]);
                renderFilesGrid();
                Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1500, showConfirmButton: false});
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// 8. ฟังก์ชันสั่งโหลดไฟล์
window.forceDownloadFile = async function(id) {
    const f = globalAppFiles.find(x => String(x.id) === String(id));
    if(!f || !f.url) return Swal.fire('Error', 'ไม่มีลิงก์สำหรับดาวน์โหลด', 'error');

    let urls = Array.isArray(f.url) ? f.url : [f.url];
    if (urls.length === 0 || !urls[0]) return Swal.fire('Error', 'ไม่มีข้อมูลไฟล์', 'error');

    // กรณี 1: มีไฟล์เดียว หรือ เป็นลิงก์ Google Drive
    if (urls.length === 1) {
        let fileData = urls[0];
        let singleUrl = typeof fileData === 'string' ? fileData : fileData.url;
        
        let defaultName = `${f.title}.${singleUrl.split('.').pop().split('?')[0] || 'file'}`;
        let originalName = typeof fileData === 'string' ? defaultName : (fileData.originalName || defaultName);

        if (singleUrl.includes('drive.google') || !singleUrl.includes('supabase.co')) {
            window.open(singleUrl, '_blank');
            return;
        }

        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true }).fire({ icon: 'success', title: 'เริ่มดาวน์โหลดแล้ว ดูที่มุมขวาบน' });
        
        let finalUrl = singleUrl;
        if (finalUrl.includes('supabase.co/storage/v1/object/public/')) {
            const encodedName = encodeURIComponent(originalName);
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + `download=${encodedName}`;
        }

        const a = document.createElement('a');
        a.href = finalUrl;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } 
    // กรณี 2: มีหลายไฟล์
    else {
        let htmlButtons = '';
        
        urls.forEach((fileData, i) => {
            let singleUrl = typeof fileData === 'string' ? fileData : fileData.url;
            let defaultName = `${f.title}_part${i+1}.${singleUrl.split('.').pop().split('?')[0] || 'file'}`;
            let originalName = typeof fileData === 'string' ? defaultName : (fileData.originalName || defaultName);

            let finalUrl = singleUrl;
            if (finalUrl.includes('supabase.co/storage/v1/object/public/')) {
                const encodedName = encodeURIComponent(originalName);
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + `download=${encodedName}`;
            }

            htmlButtons += `
                <a href="${finalUrl}" download="${originalName}" 
                   onclick="this.classList.replace('bg-slate-700', 'bg-emerald-600'); this.querySelector('.material-icons').innerText='check_circle'; this.querySelector('.material-icons').classList.replace('text-gray-400', 'text-white');" 
                   class="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-600 text-white p-3.5 rounded-xl transition shadow-md border border-slate-600 cursor-pointer group">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <span class="bg-slate-900 px-2 py-1 rounded text-[10px] font-mono group-hover:text-emerald-400 transition">ไฟล์ที่ ${i+1}</span>
                        <span class="font-bold text-sm truncate">${originalName}</span>
                    </div>
                    <span class="material-icons text-gray-400 shrink-0 transition">download</span>
                </a>
            `;
        });

        Swal.fire({
            title: `<div class="text-xl font-black text-emerald-400">รายการนี้มี ${urls.length} ไฟล์</div>`,
            html: `
                <p class="text-xs text-gray-400 mb-4 leading-relaxed">
                    ระบบป้องกันการดาวน์โหลดพร้อมกันของเบราว์เซอร์ทำงาน<br>
                    <span class="text-amber-400 font-bold">กรุณากดปุ่มด้านล่างเพื่อดาวน์โหลดทีละไฟล์ครับ 👇</span>
                </p>
                <div class="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 text-left">
                    ${htmlButtons}
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
        });
    }
};
