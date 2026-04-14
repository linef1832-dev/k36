// ==========================================
// 📚 ระบบคลังความรู้ (Knowledge Base)
// ==========================================
let globalKBData = [];
let currentKbId = null;
let globalKBCategories = [];

window.initKbApp = async function() {
    // เช็คสิทธิ์ว่ามีปุ่มแอดมินไหม
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('kb_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const adminControls = document.getElementById('kbAdminControls');
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    
    currentKbId = null;
    document.getElementById('kbReaderContent').innerHTML = `
        <div class="text-center text-gray-400 dark:text-gray-600 mt-[15vh] flex flex-col items-center select-none">
            <span class="material-icons text-[100px] mb-6 opacity-30 group-hover:opacity-50 transition">chrome_reader_mode</span>
            <h2 class="text-2xl font-black text-gray-500">เลือกบทความเพื่อเริ่มอ่าน</h2>
            <p class="text-sm mt-2 font-bold">คลิกที่รายการด้านซ้ายมือเพื่อเปิดดูเนื้อหา</p>
        </div>
    `;

    await kb_loadCategories();
    await kb_fetchData();
};

// 🌟 โหลดหมวดหมู่ทั้งหมดจากฐานข้อมูล
window.kb_loadCategories = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'kb_categories').single();
        if (data && data.value) {
            globalKBCategories = JSON.parse(data.value);
        } else {
            // ค่าเริ่มต้น ถ้ายังไม่เคยสร้างหมวดหมู่เลย
            globalKBCategories = [
                { id: 'คู่มือการทำงาน', name: '📘 คู่มือการทำงาน' },
                { id: 'สคริปต์ตอบแชท', name: '💬 สคริปต์ตอบแชท' },
                { id: 'กฎระเบียบ', name: '⚖️ กฎระเบียบ' },
                { id: 'ไอทีและระบบ', name: '💻 ไอทีและระบบ' }
            ];
            await appDB.from('settings').upsert([{ key: 'kb_categories', value: JSON.stringify(globalKBCategories) }]);
        }
        kb_renderCategoryDropdowns();
    } catch(e) {
        console.error("Load Categories Error:", e);
    }
};

// 🌟 ยัดหมวดหมู่ใส่ Dropdown ค้นหา
window.kb_renderCategoryDropdowns = function() {
    const filterSelect = document.getElementById('kbCategory');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let html = '<option value="ALL">📂 ทุกหมวดหมู่</option>';
        globalKBCategories.forEach(c => html += `<option value="${c.id}">${c.name}</option>`);
        filterSelect.innerHTML = html;
        if (currentVal && (currentVal === 'ALL' || globalKBCategories.some(c => c.id === currentVal))) {
            filterSelect.value = currentVal;
        } else {
            filterSelect.value = 'ALL';
        }
    }
};

// 🌟 เปิดหน้าจัดการหมวดหมู่
window.kb_manageCategories = function() {
    window.renderManageCatHtml = function() {
        if (globalKBCategories.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ไม่มีหมวดหมู่</div>';
        return globalKBCategories.map((c, idx) => `
            <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-2 shadow-sm">
                <span class="text-slate-800 dark:text-white font-bold text-sm">${c.name}</span>
                <button onclick="kb_deleteCategory(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="ลบหมวดหมู่"><span class="material-icons text-[16px]">delete</span></button>
            </div>
        `).join('');
    };

    Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">category</span> จัดการหมวดหมู่</div>',
        html: `
            <div class="text-left mt-4">
                <div class="flex gap-2 mb-4">
                    <input type="text" id="newKbCatName" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ (เช่น 💡 ไอเดียใหม่)..." class="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-amber-500 shadow-inner font-bold">
                    <button onclick="kb_addCategory()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-3 rounded-xl font-bold shadow-md transition active:scale-95 flex items-center gap-1 border border-amber-500"><span class="material-icons text-sm">add</span> เพิ่ม</button>
                </div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-slate-700 pb-1">หมวดหมู่ที่มีอยู่</div>
                <div id="kbCatListContainer" class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                    ${window.renderManageCatHtml()}
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

// 🌟 กดเพิ่มหมวดหมู่ใหม่
window.kb_addCategory = async function() {
    const input = document.getElementById('newKbCatName');
    const val = input.value.trim();
    if (!val) return;

    // ลบ Emoji ออกเพื่อเอามาตั้งเป็น ID (เพื่อความปลอดภัยในการ Filter)
    const id = val.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim() || val;

    if (globalKBCategories.some(c => c.id === id || c.name === val)) {
        Swal.showValidationMessage('มีหมวดหมู่นี้ในระบบแล้วครับ');
        return;
    }
    
    Swal.resetValidationMessage();
    const btn = document.querySelector('.swal2-html-container button');
    if(btn) btn.innerHTML = '<span class="material-icons animate-spin text-sm">sync</span>';

    globalKBCategories.push({ id: id, name: val });
    input.value = '';
    
    document.getElementById('kbCatListContainer').innerHTML = window.renderManageCatHtml();
    
    await appDB.from('settings').upsert([{ key: 'kb_categories', value: JSON.stringify(globalKBCategories) }]);
    kb_renderCategoryDropdowns();
    
    if(btn) btn.innerHTML = '<span class="material-icons text-sm">add</span> เพิ่ม';
};

// 🌟 กดลบหมวดหมู่
window.kb_deleteCategory = async function(idx) {
    const cat = globalKBCategories[idx];
    const confirm = await Swal.fire({
        title: 'ยืนยันลบหมวดหมู่?',
        text: `ต้องการลบหมวด "${cat.name}" ใช่หรือไม่? (บทความเก่าในหมวดนี้ยังอยู่ แต่จะไม่แสดงในตัวกรอง)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง',
        cancelButtonText: 'ยกเลิก'
    });

    if (confirm.isConfirmed) {
        globalKBCategories.splice(idx, 1);
        document.getElementById('kbCatListContainer').innerHTML = window.renderManageCatHtml();
        await appDB.from('settings').upsert([{ key: 'kb_categories', value: JSON.stringify(globalKBCategories) }]);
        kb_renderCategoryDropdowns();
    }
};


window.kb_fetchData = async function() {
    const container = document.getElementById('kbListContainer');
    if(container) container.innerHTML = '<div class="text-center text-gray-500 py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลด...</div>';

    try {
        const { data, error } = await appDB.from('knowledge_base').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        globalKBData = data || [];
        kb_renderList();
    } catch(e) {
        console.error("KB Fetch Error:", e);
        if(container) container.innerHTML = '<div class="text-center text-red-500 py-10">โหลดข้อมูลไม่สำเร็จ</div>';
    }
};

window.kb_renderList = function() {
    const term = document.getElementById('kbSearch') ? document.getElementById('kbSearch').value.toLowerCase() : '';
    const cat = document.getElementById('kbCategory') ? document.getElementById('kbCategory').value : 'ALL';
    const container = document.getElementById('kbListContainer');
    if (!container) return;

    let filtered = globalKBData.filter(item => {
        const matchSearch = item.title.toLowerCase().includes(term) || item.content.toLowerCase().includes(term);
        const matchCat = (cat === 'ALL' || item.category === cat);
        return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-10 font-bold text-sm bg-gray-100 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">ไม่พบข้อมูลที่ค้นหา</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        let icon = 'article'; let iconColor = 'text-gray-500 dark:text-gray-400';
        
        if(item.category.includes('คู่มือ')) { icon = 'menu_book'; iconColor = 'text-blue-500 dark:text-blue-400'; }
        else if(item.category.includes('สคริปต์')) { icon = 'chat'; iconColor = 'text-emerald-500 dark:text-emerald-400'; }
        else if(item.category.includes('กฎ')) { icon = 'gavel'; iconColor = 'text-amber-500 dark:text-amber-400'; }
        else if(item.category.includes('ไอที') || item.category.includes('ระบบ')) { icon = 'computer'; iconColor = 'text-purple-500 dark:text-purple-400'; }
        else if(item.category.includes('ประกาศ')) { icon = 'campaign'; iconColor = 'text-orange-500 dark:text-orange-400'; }
        else if(item.category.includes('โบนัส')) { icon = 'redeem'; iconColor = 'text-rose-500 dark:text-rose-400'; }

        let displayCat = item.category;
        const matchedCat = globalKBCategories.find(c => c.id === item.category);
        if (matchedCat) displayCat = matchedCat.name;

        // 🌟 เปลี่ยนไอคอนให้แสดงว่าเป็นไฟล์ PDF หรือ รูปภาพ
        let fileBadge = '';
        if (item.image_urls && item.image_urls !== '[]') {
            try {
                const arr = JSON.parse(item.image_urls);
                if (arr.length > 0) {
                    const hasPdf = arr.some(u => u.toLowerCase().includes('.pdf'));
                    const iconName = hasPdf ? 'picture_as_pdf' : 'image';
                    const iconColorClass = hasPdf ? 'text-red-400' : 'text-sky-500';
                    fileBadge = `<span class="material-icons text-[12px] ${iconColorClass}" title="มีไฟล์ประกอบ">${iconName}</span>`;
                }
            } catch(e) {}
        }

        const date = new Date(item.created_at).toLocaleDateString('th-TH');
        
        const isActive = currentKbId === item.id;
        const activeBg = isActive ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 hover:bg-white dark:hover:bg-slate-800';

        return `
            <div onclick="kb_readArticle('${item.id}')" class="cursor-pointer p-3.5 rounded-xl border ${activeBg} transition flex gap-3 group shadow-sm">
                <div class="mt-1 shrink-0"><span class="material-icons ${iconColor} text-[22px] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-slate-600 group-hover:scale-110 transition">${icon}</span></div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-slate-800 dark:text-white font-bold text-sm truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">${item.title}</h4>
                    <div class="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-gray-500">
                        <span class="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-600 shadow-sm flex items-center gap-1">${displayCat} ${fileBadge}</span>
                        <span class="flex items-center gap-0.5"><span class="material-icons text-[12px]">calendar_today</span> ${date}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

window.kb_readArticle = function(id) {
    currentKbId = id;
    kb_renderList(); 
    
    const item = globalKBData.find(x => x.id === id);
    const reader = document.getElementById('kbReaderContent');
    if(!item || !reader) return;

    const dateStr = new Date(item.created_at).toLocaleString('th-TH');
    const formattedContent = item.content.replace(/\n/g, '<br/>');
    
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('kb_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const deleteBtn = isAdmin ? `<button onclick="kb_deleteArticle('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm shrink-0" title="ลบบทความนี้"><span class="material-icons">delete</span></button>` : '';

    let displayCat = item.category;
    const matchedCat = globalKBCategories.find(c => c.id === item.category);
    if (matchedCat) displayCat = matchedCat.name;

    // 🌟 ระบบแสดงผล แยกตามประเภทไฟล์ (PDF กางออก / รูปภาพโชว์ปกติ)
    let mediaHtml = '';
    if (item.image_urls && item.image_urls !== '[]') {
        try {
            const urls = JSON.parse(item.image_urls);
            if (urls && urls.length > 0) {
                mediaHtml = '<div class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 flex flex-col gap-6">';
                urls.forEach(url => {
                    // เช็คว่าเป็นไฟล์ PDF ไหม
                    if (url.toLowerCase().includes('.pdf')) {
                        mediaHtml += `<div class="w-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700">
                                          <iframe src="${url}" class="w-full h-[70vh] min-h-[600px] border-0" title="PDF Document"></iframe>
                                      </div>`;
                    } else {
                        // ถ้าเป็นรูปภาพ
                        mediaHtml += `<a href="${url}" target="_blank" class="block group relative rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition overflow-hidden bg-white dark:bg-slate-900 w-fit">
                                          <img src="${url}" class="max-h-96 w-auto object-contain transition duration-300 group-hover:scale-105 cursor-zoom-in">
                                       </a>`;
                    }
                });
                mediaHtml += '</div>';
            }
        } catch(e) {}
    }

    reader.innerHTML = `
        <div class="fade-in">
            <div class="flex justify-between items-start mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
                <div>
                    <span class="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full text-[11px] font-black border border-amber-200 dark:border-amber-500/50 shadow-sm mb-3 inline-block">${displayCat}</span>
                    <h1 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">${item.title}</h1>
                    <div class="flex items-center gap-4 mt-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                        <span class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700"><span class="material-icons text-[14px]">edit_document</span> ผู้เขียน: ${item.author_name}</span>
                        <span class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700"><span class="material-icons text-[14px]">schedule</span> อัปเดต: ${dateStr}</span>
                    </div>
                </div>
                ${deleteBtn}
            </div>
            <div class="text-slate-700 dark:text-gray-300 text-sm md:text-base leading-relaxed space-y-4 whitespace-pre-wrap font-medium">${formattedContent}</div>
            ${mediaHtml}
            <div class="h-10"></div>
        </div>
    `;
};

window.previewKbImages = function(input) {
    const previewBox = document.getElementById('kb-img-preview-box');
    if (!previewBox) return;
    previewBox.innerHTML = '';
    
    if (input.files && input.files.length > 0) {
        previewBox.classList.remove('hidden');
        Array.from(input.files).forEach(file => {
            // 🌟 พรีวิวสำหรับไฟล์ PDF
            if (file.type === 'application/pdf') {
                previewBox.innerHTML += `
                    <div class="relative flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm h-16 w-16 shrink-0">
                        <span class="material-icons text-red-500 text-3xl">picture_as_pdf</span>
                        <span class="absolute bottom-0.5 right-1 text-[9px] font-black text-gray-400">PDF</span>
                    </div>`;
            } else {
            // พรีวิวสำหรับรูปภาพปกติ
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewBox.innerHTML += `<div class="relative shrink-0"><img src="${e.target.result}" class="h-16 w-auto object-cover rounded-lg shadow-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800"></div>`;
                }
                reader.readAsDataURL(file);
            }
        });
    } else {
        previewBox.classList.add('hidden');
    }
};

window.kb_openAddModal = function() {
    let catOptionsHtml = globalKBCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    Swal.fire({
        title: '<span class="text-amber-500 font-black"><span class="material-icons align-middle text-2xl">post_add</span> เขียนบทความใหม่</span>',
        html: `
            <div class="text-left mt-4 space-y-4">
                <div>
                    <label class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">หมวดหมู่</label>
                    <select id="swal-kb-cat" class="w-full bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-amber-500 font-bold cursor-pointer shadow-inner">
                        ${catOptionsHtml}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">หัวข้อเรื่อง</label>
                    <input id="swal-kb-title" class="w-full bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-amber-500 shadow-inner font-bold" placeholder="เช่น วิธีกดรับงาน, กฎการลางาน...">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">เนื้อหาบทความ (เว้นว่างไว้ได้หากต้องการแนบแค่ไฟล์เอกสาร)</label>
                    <textarea id="swal-kb-content" rows="10" class="w-full bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-amber-500 custom-scrollbar shadow-inner" placeholder="พิมพ์เนื้อหาที่นี่..."></textarea>
                </div>
                <div>
                    <label class="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block mb-1 flex items-center gap-1"><span class="material-icons text-[14px]">attach_file</span> แนบไฟล์ประกอบ (รูปภาพ หรือ ไฟล์ PDF)</label>
                    <input type="file" id="swal-kb-images" multiple accept="image/*,application/pdf" class="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none text-sm transition shadow-inner file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-sky-500 file:text-white hover:file:bg-sky-600 cursor-pointer" onchange="previewKbImages(this)">
                    <div id="kb-img-preview-box" class="hidden mt-2 flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-xl border border-gray-200 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar shadow-inner"></div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'บันทึกบทความ', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b', cancelButtonColor: '#64748b', width: '700px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-600 shadow-2xl' },
        preConfirm: () => {
            const cat = document.getElementById('swal-kb-cat').value;
            const title = document.getElementById('swal-kb-title').value.trim();
            const content = document.getElementById('swal-kb-content').value.trim();
            const imgInput = document.getElementById('swal-kb-images');
            
            // เช็คว่าต้องมีหัวข้อ และต้องมี เนื้อหา หรือ ไฟล์แนบ อย่างใดอย่างหนึ่ง
            if (!title) { Swal.showValidationMessage('กรุณาใส่หัวข้อเรื่อง'); return false; }
            if (!content && (!imgInput.files || imgInput.files.length === 0)) { Swal.showValidationMessage('กรุณาพิมพ์เนื้อหา หรือ แนบไฟล์ประกอบอย่างน้อย 1 ไฟล์'); return false; }
            
            return { category: cat, title: title, content: content, files: imgInput ? imgInput.files : [] };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังบันทึก...', html: 'โปรดรอสักครู่...', didOpen: () => Swal.showLoading()});
            try {
                const author = (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Admin';
                
                let uploadedUrls = [];
                const files = result.value.files;
                
                if (files && files.length > 0) {
                    Swal.update({ html: `กำลังอัปโหลดไฟล์ ${files.length} รายการ...` });
                    
                    const uploadPromises = Array.from(files).map(async (file, index) => {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `kb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}.${fileExt}`;
                        
                        const { error: uploadError } = await appDB.storage
                            .from('staff_images') 
                            .upload(`knowledge_base/${fileName}`, file, { cacheControl: '3600', upsert: false });

                        if (uploadError) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`);
                        
                        const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`knowledge_base/${fileName}`);
                        return publicUrlData.publicUrl;
                    });
                    
                    uploadedUrls = await Promise.all(uploadPromises);
                }

                const { error } = await appDB.from('knowledge_base').insert([{ 
                    category: result.value.category, 
                    title: result.value.title, 
                    content: result.value.content || ' ', // ป้องกัน content ว่างเปล่าถ้าอัปโหลดแค่ไฟล์
                    author_name: author,
                    image_urls: JSON.stringify(uploadedUrls)
                }]);
                
                if(error) throw error;
                Swal.fire({icon: 'success', title: 'สำเร็จ', text: 'บันทึกบทความเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false});
                kb_fetchData(); 
            } catch (e) { Swal.fire('Error', 'ไม่สามารถบันทึกได้: ' + e.message, 'error'); }
        }
    });
};

window.kb_deleteArticle = async function(id) {
    const confirm = await Swal.fire({ title: 'ยืนยันการลบ?', text: "หากลบแล้วจะไม่สามารถกู้คืนได้ (รวมถึงรูปภาพและไฟล์ประกอบ)", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonText: 'ยกเลิก', confirmButtonText: 'ลบทิ้งเลย!' });
    if(confirm.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        try {
            await appDB.from('knowledge_base').delete().eq('id', id);
            currentKbId = null;
            document.getElementById('kbReaderContent').innerHTML = `<div class="text-center text-gray-400 dark:text-gray-600 mt-[15vh] flex flex-col items-center select-none"><span class="material-icons text-[100px] mb-6 opacity-30 group-hover:opacity-50 transition">chrome_reader_mode</span><h2 class="text-2xl font-black text-gray-500">เลือกบทความเพื่อเริ่มอ่าน</h2></div>`;
            kb_fetchData();
            Swal.fire({ icon: 'success', title: 'ลบเรียบร้อย', showConfirmButton: false, timer: 1500 });
        } catch(e) { Swal.fire('Error', 'ลบไม่สำเร็จ: ' + e.message, 'error'); }
    }
};
