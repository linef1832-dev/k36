// ==========================================
// 📚 ระบบคลังความรู้ (Knowledge Base) - JS Only
// ==========================================
let globalKBData = [];
let currentKbId = null;
let globalKBCategories = [];

window.initKbApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('kb_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const adminControls = document.getElementById('kbAdminControls');
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    
    currentKbId = null;
    document.getElementById('kbReaderContent').innerHTML = window.renderTemplate('tpl-kb-empty');

    await kb_loadCategories();
    await kb_fetchData();
};

window.kb_loadCategories = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'kb_categories').single();
        if (data && data.value) {
            globalKBCategories = JSON.parse(data.value);
        } else {
            globalKBCategories = [
                { id: 'คู่มือการทำงาน', name: '📘 คู่มือการทำงาน' },
                { id: 'สคริปต์ตอบแชท', name: '💬 สคริปต์ตอบแชท' },
                { id: 'กฎระเบียบ', name: '⚖️ กฎระเบียบ' },
                { id: 'ไอทีและระบบ', name: '💻 ไอทีและระบบ' }
            ];
            await appDB.from('settings').upsert([{ key: 'kb_categories', value: JSON.stringify(globalKBCategories) }]);
        }
        kb_renderCategoryDropdowns();
    } catch(e) { console.error(e); }
};

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

window.kb_manageCategories = function() {
    window.renderManageCatHtml = function() {
        if (globalKBCategories.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ไม่มีหมวดหมู่</div>';
        return globalKBCategories.map((c, idx) => window.renderTemplate('tpl-kb-manage-cat-item', { catName: c.name, index: idx })).join('');
    };

    const htmlContent = window.renderTemplate('tpl-kb-manage-cat', { catListHtml: window.renderManageCatHtml() });

    Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">category</span> จัดการหมวดหมู่</div>',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

window.kb_addCategory = async function() {
    const input = document.getElementById('newKbCatName');
    const val = input.value.trim();
    if (!val) return;

    const id = val.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim() || val;

    if (globalKBCategories.some(c => c.id === id || c.name === val)) {
        Swal.showValidationMessage('มีหมวดหมู่นี้ในระบบแล้วครับ'); return;
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

window.kb_deleteCategory = async function(idx) {
    const cat = globalKBCategories[idx];
    const confirm = await Swal.fire({
        title: 'ยืนยันลบหมวดหมู่?',
        text: `ต้องการลบหมวด "${cat.name}" ใช่หรือไม่?`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
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

        let displayCat = globalKBCategories.find(c => c.id === item.category)?.name || item.category;

        let fileBadge = '';
        if (item.image_urls && item.image_urls !== '[]') {
            try {
                const arr = JSON.parse(item.image_urls);
                if (arr.length > 0) {
                    const hasPdf = arr.some(obj => { const url = typeof obj === 'string' ? obj : obj.url; return url.toLowerCase().includes('.pdf'); });
                    const iconName = hasPdf ? 'picture_as_pdf' : 'image';
                    const iconColorClass = hasPdf ? 'text-red-400' : 'text-sky-500';
                    fileBadge = `<span class="material-icons text-[12px] ${iconColorClass}" title="มีไฟล์ประกอบ">${iconName}</span>`;
                }
            } catch(e) {}
        }

        const date = new Date(item.created_at).toLocaleDateString('th-TH');
        const activeBg = currentKbId === item.id ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 hover:bg-white dark:hover:bg-slate-800';

        return window.renderTemplate('tpl-kb-list-item', { id: item.id, activeBg, iconColor, icon, title: item.title, displayCat, fileBadge, date });
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
    let displayCat = globalKBCategories.find(c => c.id === item.category)?.name || item.category;

    let mediaHtml = '';
    if (item.image_urls && item.image_urls !== '[]') {
        try {
            const urls = JSON.parse(item.image_urls);
            if (urls && urls.length > 0) {
                urls.forEach(obj => {
                    let url = typeof obj === 'string' ? obj : obj.url;
                    let caption = typeof obj === 'string' ? '' : (obj.caption || '');
                    let captionHtml = caption ? window.renderTemplate('tpl-kb-caption', { caption }) : '';

                    if (url.toLowerCase().includes('.pdf')) {
                        mediaHtml += window.renderTemplate('tpl-kb-media-pdf', { url, captionHtml });
                    } else {
                        mediaHtml += window.renderTemplate('tpl-kb-media-img', { url, captionHtml });
                    }
                });
            }
        } catch(e) {}
    }

    reader.innerHTML = window.renderTemplate('tpl-kb-read', { displayCat, title: item.title, author_name: item.author_name, dateStr, deleteBtn, formattedContent, mediaHtml });
};

window.previewKbImages = function(input) {
    const previewBox = document.getElementById('kb-img-preview-box');
    if (!previewBox) return;
    previewBox.innerHTML = '';
    
    if (input.files && input.files.length > 0) {
        previewBox.classList.remove('hidden');
        previewBox.className = 'mt-2 flex flex-col gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-xl border border-gray-200 dark:border-slate-700 max-h-64 overflow-y-auto custom-scrollbar shadow-inner block';
        
        Array.from(input.files).forEach((file, index) => {
            const itemDiv = document.createElement('div');
            
            if (file.type === 'application/pdf') {
                itemDiv.innerHTML = window.renderTemplate('tpl-kb-preview-pdf', { index, fileName: file.name });
                previewBox.appendChild(itemDiv.firstElementChild);
            } else {
                itemDiv.innerHTML = window.renderTemplate('tpl-kb-preview-img', { index, fileName: file.name });
                previewBox.appendChild(itemDiv.firstElementChild);
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgEl = document.getElementById(`kb-preview-img-${index}`);
                    if(imgEl) imgEl.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    } else {
        previewBox.classList.add('hidden');
    }
};

window.kb_openAddModal = function() {
    const catOptionsHtml = globalKBCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const formHtml = window.renderTemplate('tpl-kb-add-form', { catOptionsHtml });

    Swal.fire({
        title: '<span class="text-amber-500 font-black"><span class="material-icons align-middle text-2xl">post_add</span> เขียนบทความใหม่</span>',
        html: formHtml,
        showCancelButton: true, confirmButtonText: 'บันทึกบทความ', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b', cancelButtonColor: '#64748b', width: '700px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const cat = document.getElementById('swal-kb-cat').value;
            const title = document.getElementById('swal-kb-title').value.trim();
            const content = document.getElementById('swal-kb-content').value.trim();
            const imgInput = document.getElementById('swal-kb-images');
            
            if (!title) { Swal.showValidationMessage('กรุณาใส่หัวข้อเรื่อง'); return false; }
            if (!content && (!imgInput.files || imgInput.files.length === 0)) { Swal.showValidationMessage('กรุณาพิมพ์เนื้อหา หรือ แนบไฟล์ประกอบอย่างน้อย 1 ไฟล์'); return false; }
            
            let captions = [];
            if (imgInput && imgInput.files && imgInput.files.length > 0) {
                for(let i = 0; i < imgInput.files.length; i++) {
                    let capInput = document.getElementById('kb-img-cap-' + i);
                    captions.push(capInput ? capInput.value.trim() : '');
                }
            }

            return { category: cat, title: title, content: content, files: imgInput ? imgInput.files : [], captions: captions };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังบันทึก...', html: 'โปรดรอสักครู่...', didOpen: () => Swal.showLoading()});
            try {
                const author = (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Admin';
                let uploadedItems = [];
                const files = result.value.files;
                
                if (files && files.length > 0) {
                    Swal.update({ html: `กำลังอัปโหลดไฟล์ ${files.length} รายการ...` });
                    const uploadPromises = Array.from(files).map(async (file, index) => {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `kb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}.${fileExt}`;
                        
                        const { error: uploadError } = await appDB.storage.from('staff_images').upload(`knowledge_base/${fileName}`, file, { cacheControl: '3600', upsert: false });
                        if (uploadError) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`);
                        
                        const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`knowledge_base/${fileName}`);
                        return { url: publicUrlData.publicUrl, caption: result.value.captions[index] || '' };
                    });
                    uploadedItems = await Promise.all(uploadPromises);
                }

                const { error } = await appDB.from('knowledge_base').insert([{ category: result.value.category, title: result.value.title, content: result.value.content || ' ', author_name: author, image_urls: JSON.stringify(uploadedItems) }]);
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
            document.getElementById('kbReaderContent').innerHTML = window.renderTemplate('tpl-kb-empty');
            kb_fetchData();
            Swal.fire({ icon: 'success', title: 'ลบเรียบร้อย', showConfirmButton: false, timer: 1500 });
        } catch(e) { Swal.fire('Error', 'ลบไม่สำเร็จ: ' + e.message, 'error'); }
    }
};
