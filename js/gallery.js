let currentGalleryData = [];
let currentGalleryMode = 'general';

// 🌟 ตัวช่วยดึง HTML Template และแทนที่ข้อมูล (เหมือนของหน้า Summary)
function getGalleryTpl(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return '';
    let html = tpl.innerHTML;
    for (const key in data) {
        const val = data[key] !== undefined && data[key] !== null ? data[key] : '';
        html = html.split(`{{${key}}}`).join(val);
    }
    return html;
}

window.initGalleryApp = function() {
    switchGalleryMode('general');

    const adminControls = document.getElementById('adminUploadControls');
    const bulkDeleteBtn = document.getElementById('btnBulkDelete'); 
    
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
    document.querySelectorAll('.gallery-check').forEach(cb => cb.checked = false);

    if (currentUser.role === 'manager' || currentUser.role === 'admin') {
        if(adminControls) adminControls.classList.remove('hidden');
    } else {
        if(adminControls) adminControls.classList.add('hidden');
    }

    const filterSelect = document.getElementById('galleryFilter');
    const uploadSelect = document.getElementById('uploadCategory');
    
    if (filterSelect && uploadSelect) {
        let optionsHTML = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`).join('');
        
        if(!filterSelect.innerHTML.includes(TEAM_LIST[0])) {
             filterSelect.innerHTML = `<option value="all">-- ทุกเว็บ --</option><option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
             uploadSelect.innerHTML = `<option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
        }
        
        const currentTeam = document.getElementById('dailyTeam') ? document.getElementById('dailyTeam').value : 'ทั่วไป';
        if(TEAM_LIST.includes(currentTeam)) {
            filterSelect.value = currentTeam;
            uploadSelect.value = currentTeam;
        } else {
            filterSelect.value = 'all';
        }
    }
    
    const searchInput = document.getElementById('gallerySearch');
    if(searchInput) searchInput.value = '';
}

window.switchGalleryMode = function(mode) {
    currentGalleryMode = mode;
    const btnGen = document.getElementById('tabGeneral');
    const btnBonus = document.getElementById('tabBonus');
    
    if (mode === 'general') {
        if(btnGen) btnGen.className = "flex-1 py-2 rounded-lg font-bold text-sm transition bg-blue-600 text-white shadow-lg border border-blue-400 transform scale-105";
        if(btnBonus) btnBonus.className = "flex-1 py-2 rounded-lg font-bold text-sm transition bg-slate-700 text-gray-400 hover:text-white border border-transparent";
    } else {
        if(btnGen) btnGen.className = "flex-1 py-2 rounded-lg font-bold text-sm transition bg-slate-700 text-gray-400 hover:text-white border border-transparent";
        if(btnBonus) btnBonus.className = "flex-1 py-2 rounded-lg font-bold text-sm transition bg-gradient-to-r from-yellow-600 to-amber-500 text-white shadow-lg border border-yellow-400 transform scale-105";
    }
    fetchGalleryImages();
}

window.syncUploadCategory = function() {
    const viewVal = document.getElementById('galleryFilter').value;
    const uploadSelect = document.getElementById('uploadCategory');
    if(viewVal !== 'all' && uploadSelect) {
        uploadSelect.value = viewVal;
    }
}

window.fetchGalleryImages = async function() {
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    const filterVal = document.getElementById('galleryFilter').value;
    const searchVal = document.getElementById('gallerySearch').value.toLowerCase();
    const countSpan = document.getElementById('galleryCount');
    
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center"><span class="material-icons animate-spin text-4xl mb-2">sync</span>กำลังโหลด...</div>';

    const { data, error } = await appDB.from('image_gallery').select('*').order('created_at', { ascending: false }).limit(1000);
    
    if (error || !data) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-400">โหลดไม่สำเร็จ</div>';
        return;
    }

    let filteredData = data.filter(img => {
        const cat = img.category || '';
        const isBonusImg = cat.endsWith('_BONUS'); 
        
        if (currentGalleryMode === 'general') {
            if (isBonusImg) return false;
        } else {
            if (!isBonusImg) return false;
        }

        if (filterVal !== 'all') {
            const targetCat = currentGalleryMode === 'bonus' ? `${filterVal}_BONUS` : filterVal;
            if (cat !== targetCat) return false;
        }

        if (searchVal && !img.name.toLowerCase().includes(searchVal)) return false;
        return true;
    });

    currentGalleryData = filteredData;
    if(countSpan) countSpan.innerText = filteredData.length;

    if (filteredData.length === 0) {
        const msg = currentGalleryMode === 'bonus' ? 'ยังไม่มีรูปโบนัสไทม์' : 'ไม่พบรูปภาพ';
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 pt-20">${msg}</div>`;
        return;
    }

    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const lastViewKey = `gallery_last_view_${currentUser.username}`;
    const lastViewedTime = new Date(localStorage.getItem(lastViewKey) || '2000-01-01T00:00:00');

    // 🌟 ดึงข้อมูลไปยัดใส่ Template ที่แยกไว้ใน HTML 🌟
    grid.innerHTML = filteredData.map(img => {
        const imgDate = new Date(img.created_at);
        const isNew = imgDate > lastViewedTime;
        
        const newBadge = isNew ? `<span class="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded shadow-lg font-bold animate-pulse z-30 border border-white/50">NEW</span>` : '';
        const adminCheckbox = isAdmin ? `<div class="absolute top-2 left-2 z-30" onclick="event.stopPropagation()"><input type="checkbox" class="gallery-check w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shadow-sm bg-white" value="${img.id}" onchange="updateBulkDeleteButton()"></div>` : '';

        let catColor = "bg-black/60 text-white border-white/20";
        let showCatName = img.category;
        
        if (showCatName.endsWith('_BONUS')) {
            showCatName = showCatName.replace('_BONUS', '');
            catColor = "bg-yellow-600/90 text-white border-yellow-300 shadow-yellow-500/50";
        }

        const catBadge = `<span class="absolute bottom-2 left-2 ${catColor} text-[10px] px-2 py-0.5 rounded border z-20 backdrop-blur-sm font-bold shadow-sm">${showCatName}</span>`;

        return getGalleryTpl('tpl-gallery-card', {
            url: img.url,
            name: img.name,
            newBadge: newBadge,
            adminCheckbox: adminCheckbox,
            catBadge: catBadge
        });
    }).join('');
    
    updateBulkDeleteButton();
}

window.handleImageUpload = async function(input) {
    const files = input.files;
    let category = document.getElementById('galleryFilter').value;
    if (category === 'all' || !category) category = 'ทั่วไป';
    if (currentGalleryMode === 'bonus') category += '_BONUS'; 
    
    const displayCategory = category.replace('_BONUS', '');
    const modeText = (category.endsWith('_BONUS')) ? '🎁 โบนัสไทม์ ' : '';
    
    if (!files || files.length === 0) return;

    Swal.fire({
        title: 'กำลังอัปโหลด...',
        text: `กำลังนำรูปไปใส่ในหมวด: ${modeText}${displayCategory}`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    let successCount = 0; let failCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        Swal.update({ text: `กำลังอัปโหลดไฟล์: ${file.name} (${i + 1}/${files.length})` });

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error(uploadError.message);

            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(fileName);

            const { error: dbError } = await appDB.from('image_gallery').insert([{
                name: file.name, url: publicUrlData.publicUrl, uploader: currentUser.username || 'unknown', category: category
            }]);

            if (dbError) throw new Error(dbError.message);
            successCount++;
        } catch (err) { failCount++; }
    }

    input.value = ''; 
    document.getElementById('galleryFilter').value = category.replace('_BONUS', '');
    fetchGalleryImages();

    if (failCount === 0) Swal.fire({ icon: 'success', title: 'เสร็จสิ้น', text: `อัปโหลด ${successCount} รูป เข้าหมวด ${modeText}${displayCategory} เรียบร้อย`, timer: 1500, showConfirmButton: false });
    else Swal.fire('แจ้งเตือน', `สำเร็จ ${successCount}, ล้มเหลว ${failCount}`, 'warning');
}

window.updateBulkDeleteButton = function() {
    const checkboxes = document.querySelectorAll('.gallery-check:checked');
    const btn = document.getElementById('btnBulkDelete');
    const countSpan = document.getElementById('selectedCount');
    if (btn) {
        if (checkboxes.length > 0) { btn.classList.remove('hidden'); countSpan.innerText = checkboxes.length; } 
        else { btn.classList.add('hidden'); }
    }
}

window.toggleSelectAllImages = function(source) {
    document.querySelectorAll('.gallery-check').forEach(cb => cb.checked = source.checked);
    updateBulkDeleteButton();
}

window.deleteSelectedImages = async function() {
    const ids = Array.from(document.querySelectorAll('.gallery-check:checked')).map(cb => cb.value);
    if (ids.length === 0) return;

    const result = await Swal.fire({ title: `ลบ ${ids.length} รูป?`, text: "ลบแล้วกู้คืนไม่ได้นะครับ", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
        const { error } = await appDB.from('image_gallery').delete().in('id', ids);
        if (error) Swal.fire('Error', error.message, 'error');
        else { fetchGalleryImages(); Swal.fire({ icon: 'success', title: 'ลบเรียบร้อย', timer: 1500, showConfirmButton: false }); }
    }
}

window.viewImageFull = function(url) { window.open(url, '_blank'); }

window.downloadGalleryUrl = async function(url, fileName) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName || `img_${Date.now()}.jpg`; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch(e) { window.open(url, '_blank'); }
}

window.downloadAllInFilter = async function() {
    if (!currentGalleryData || currentGalleryData.length === 0) return Swal.fire('ไม่มีรูป', '', 'warning');
    if (typeof JSZip === 'undefined') return Swal.fire('Error', 'ไม่พบระบบสร้างโฟลเดอร์ กรุณาแจ้งผู้ดูแลระบบ', 'error');

    let categoryName = document.getElementById('galleryFilter').value;
    let folderName = categoryName === 'all' ? 'รวมรูปภาพทั้งหมด' : categoryName;
    if (currentGalleryMode === 'bonus') folderName += '_BonusTime';

    const confirm = await Swal.fire({ title: `โหลด ${currentGalleryData.length} รูป?`, text: `ระบบจะรวบรวมไฟล์ใส่โฟลเดอร์ชื่อ "${folderName}.zip"`, icon: 'question', showCancelButton: true, confirmButtonText: 'เริ่มดาวน์โหลด', confirmButtonColor: '#2563eb' });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'กำลังเตรียมไฟล์...', text: 'กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        try {
            const zip = new JSZip();
            const imgFolder = zip.folder(folderName); 
            let count = 0;
            for (const img of currentGalleryData) {
                try {
                    const response = await fetch(img.url);
                    const blob = await response.blob();
                    const fileName = img.name || `image_${Date.now()}_${count}.jpg`;
                    imgFolder.file(fileName, blob);
                    count++;
                    Swal.update({ text: `กำลังดึงรูป... (${count}/${currentGalleryData.length})` });
                } catch (fetchErr) { console.error("ดึงรูปไม่สำเร็จ:", img.url, fetchErr); }
            }

            Swal.update({ text: `กำลังบีบอัดเป็นไฟล์ ZIP...` });
            const content = await zip.generateAsync({ type: "blob" });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${folderName}.zip`; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดเสร็จสิ้น!', timer: 1500, showConfirmButton: false });
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างไฟล์ ZIP ได้', 'error'); }
    }
};

// ==========================================
// 📋 ฟังก์ชันคัดลอกรูปภาพไปยัง Clipboard (แก้บั๊ก JPEG ไม่ให้ก๊อปปี้)
// ==========================================
window.copyImageToClipboard = async function(imageUrl) {
    Swal.fire({
        title: 'กำลังคัดลอกรูปภาพ...',
        text: 'กรุณารอสักครู่ ระบบกำลังแปลงไฟล์ให้รองรับการคัดลอก',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (!navigator.clipboard || !window.ClipboardItem) {
            throw new Error("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง (แนะนำให้ใช้ Chrome หรือ Edge)");
        }

        // 1. สร้าง Image Object เพื่อโหลดรูปมาเตรียมไว้
        const img = new Image();
        img.crossOrigin = "Anonymous"; // ป้องกันปัญหา CORS เวลาดึงรูปจากเซิร์ฟเวอร์อื่น
        img.src = imageUrl;

        // 2. รอให้รูปโหลดเสร็จสมบูรณ์
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("ไม่สามารถโหลดรูปภาพจากเซิร์ฟเวอร์ได้"));
        });

        // 3. สร้าง Canvas จำลองขึ้นมาเพื่อวาดรูป (เทคนิคแปลงไฟล์ภาพ)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // 4. สั่งให้ Canvas ส่งรูปออกมาเป็นไฟล์สกุล image/png เสมอ!
        canvas.toBlob(async (blob) => {
            try {
                // 5. นำไฟล์ PNG ที่ได้ ยัดลง Clipboard
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                
                Swal.fire({
                    icon: 'success', 
                    title: 'คัดลอกสำเร็จ!', 
                    text: 'นำไปกดวาง (Ctrl+V) ในช่องแชท Line OA ได้เลยครับ', 
                    timer: 2000, 
                    showConfirmButton: false
                });
            } catch (err) {
                console.error('Clipboard write failed:', err);
                Swal.fire('Error', 'ระบบปฏิเสธการคัดลอก: ' + err.message, 'error');
            }
        }, 'image/png'); // บังคับเป็น PNG ให้ Chrome ยอมรับ

    } catch (err) {
        console.error('Copy image failed:', err);
        Swal.fire('Error', 'คัดลอกรูปไม่สำเร็จ: ' + err.message, 'error');
    }
};

// เพิ่มฟังก์ชันนี้เข้าไป
window.filterGalleryImages = function() {
    clearTimeout(window.gallerySearchTimer);
    window.gallerySearchTimer = setTimeout(() => {
        // ให้ฟังก์ชันเดิมทำงานโดยไม่ต้องยิง DB ใหม่ถ้ามี currentGalleryData แล้ว
        fetchGalleryImages(true); 
    }, 300); // หน่วง 0.3 วินาที
};