// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System)
// ==========================================
let globalFines = [];
let globalFineRules = [];

window.initFineApp = async function() {
    // 1. ตรวจสอบสิทธิ์
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    // === 🌟 ดึงรายชื่อพนักงานก่อนถ้ายังไม่มี ===
    if (isAdmin && typeof fetchUsers === 'function' && (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }
    // ====================================================

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    
    if (isAdmin) {
        adminControls.classList.remove('hidden');
        tableContainer.classList.remove('lg:col-span-12');
        tableContainer.classList.add('lg:col-span-8');
        document.getElementById('fineSubtitle').innerText = "ออกใบปรับและดูประวัติทั้งหมด";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> รายการใบปรับทั้งหมดในระบบ';
        document.getElementById('thEmpName').style.display = '';
        document.getElementById('thAction').style.display = '';
        
        // เอารายชื่อใส่ Datalist (สำหรับช่องค้นหาชื่อ)
        populateEmpSelect(); 
    } else {
        adminControls.classList.add('hidden');
        tableContainer.classList.remove('lg:col-span-8');
        tableContainer.classList.add('lg:col-span-12');
        document.getElementById('fineSubtitle').innerText = "ดูประวัติใบปรับของคุณ";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> ใบปรับของฉัน';
        document.getElementById('thEmpName').style.display = 'none';
        document.getElementById('thAction').style.display = 'none';
    }

    // 2. ดึงข้อมูลกฎและใบปรับ
    await loadFineRules();
    await fetchFinesData(isAdmin);
};

// -----------------------------------------
// ดึงรายชื่อพนักงานใส่ Datalist (แบบพิมพ์ค้นหาได้)
// -----------------------------------------
function populateEmpSelect() {
    const datalist = document.getElementById('fineEmpList');
    if (!datalist || !GLOBAL_USER_LIST) return;
    
    const sortedUsers = [...GLOBAL_USER_LIST].sort((a, b) => a.username.localeCompare(b.username));
    datalist.innerHTML = sortedUsers.map(u => `<option value="${u.username}">${u.username} (${u.department || 'AM'})</option>`).join('');
}

// -----------------------------------------
// จัดการหัวข้อกฎ (ดึง / เพิ่ม / ลบ)
// -----------------------------------------
async function loadFineRules() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_rules_data').single();
        globalFineRules = (data && data.value) ? JSON.parse(data.value) : ['ขาดงานไม่แจ้ง', 'แต่งกายผิดระเบียบ'];
        renderRulesDropdown();
    } catch(e) { globalFineRules = ['ขาดงานไม่แจ้ง', 'แต่งกายผิดระเบียบ']; renderRulesDropdown(); }
}

function renderRulesDropdown() {
    const select = document.getElementById('fineRuleSelect');
    if (select) select.innerHTML = '<option value="">-- เลือกหัวข้อที่ผิด --</option>' + globalFineRules.map(r => `<option value="${r}">${r}</option>`).join('');
    
    const listDiv = document.getElementById('fineRulesList');
    if (listDiv) {
        listDiv.innerHTML = globalFineRules.map((r, idx) => `
            <div class="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-gray-200 dark:border-slate-700">
                <span class="text-sm font-bold text-slate-700 dark:text-gray-200">${r}</span>
                <button onclick="removeFineRule(${idx})" class="text-red-400 hover:text-red-600"><span class="material-icons text-sm">delete</span></button>
            </div>`).join('');
    }
}

window.openManageFineRulesModal = function() {
    const modal = document.getElementById('fineRulesModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderRulesDropdown();
}

window.addFineRule = async function() {
    const input = document.getElementById('newRuleInput');
    const val = input.value.trim();
    if(!val) return;
    globalFineRules.push(val);
    input.value = '';
    renderRulesDropdown();
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
}

window.removeFineRule = async function(idx) {
    globalFineRules.splice(idx, 1);
    renderRulesDropdown();
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
}

// -----------------------------------------
// จัดการรูปภาพ
// -----------------------------------------
window.previewFineImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('fineImgPreview').src = e.target.result;
            document.getElementById('fineImgPreviewBox').classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearFineImg = function() {
    document.getElementById('fineImageInput').value = '';
    document.getElementById('fineImgPreview').src = '';
    document.getElementById('fineImgPreviewBox').classList.add('hidden');
};

window.viewFineImage = function(url) {
    document.getElementById('fineExpandedImg').src = url;
    const modal = document.getElementById('fineImageModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// -----------------------------------------
// บันทึกใบปรับ
// -----------------------------------------
window.submitFine = async function(e) {
    e.preventDefault();
    // รับค่าจาก Input (ไม่ใช่ Select แล้ว)
    const empName = document.getElementById('fineEmpInput').value.trim();
    const ruleText = document.getElementById('fineRuleSelect').value;
    const noteText = document.getElementById('fineNote').value.trim(); // รับค่าหมายเหตุ
    const amount = document.getElementById('fineAmount').value || 0;
    const fileInput = document.getElementById('fineImageInput');

    if(!empName || !ruleText) return;

    // เช็คว่าพิมพ์ชื่อถูกคนไหม (ต้องตรงกับในระบบ)
    const targetUser = GLOBAL_USER_LIST.find(u => u.username === empName);
    if (!targetUser) {
        return Swal.fire('ไม่พบพนักงาน', 'โปรดตรวจสอบชื่อพนักงานที่พิมพ์อีกครั้ง (ต้องพิมพ์ให้ตรงเป๊ะหรือเลือกจากรายชื่อที่โผล่ขึ้นมา)', 'warning');
    }
    const targetId = targetUser.id;

    Swal.fire({title: 'กำลังบันทึกใบปรับ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let imageUrl = '';
    try {
        // อัปโหลดรูป (ถ้ามี) ไปที่ Bucket 'staff_images' 
        if (fileInput.files && fileInput.files.length > 0) {
            Swal.update({text: 'กำลังอัปโหลดหลักฐาน...'});
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `fine_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`fines/${fileName}`, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ');
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`fines/${fileName}`);
            imageUrl = publicUrlData.publicUrl;
        }

        // เซฟลง DB
        const { error: dbError } = await appDB.from('fines').insert([{
            user_id: targetId,
            user_name: empName,
            rule_text: ruleText,
            note: noteText, // บันทึกหมายเหตุลงฐานข้อมูล
            amount: amount,
            evidence_url: imageUrl,
            issued_by: currentUser.username
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'ออกใบปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        // เคลียร์ฟอร์ม
        document.getElementById('fineEmpInput').value = '';
        document.getElementById('fineRuleSelect').value = '';
        document.getElementById('fineNote').value = '';
        document.getElementById('fineAmount').value = '';
        clearFineImg();
        
        // โหลดข้อมูลตารางใหม่
        fetchFinesData(true);

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

// -----------------------------------------
// ดึงข้อมูลและวาดตาราง
// -----------------------------------------
window.fetchFinesData = async function(isAdmin) {
    const tbody = document.getElementById('fineTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><span class="material-icons animate-spin text-red-500">sync</span> โหลดข้อมูล...</td></tr>';

    try {
        let query = appDB.from('fines').select('*').order('created_at', { ascending: false });
        // ถ้าเป็นพนักงาน ให้ดึงเฉพาะชื่อตัวเอง
        if (!isAdmin) {
            query = query.eq('user_name', currentUser.username);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineTable(isAdmin);

    } catch (e) {
        // ถ้ายังไม่ได้สร้างตาราง fines ใน Supabase มันจะมาเข้าตรงนี้
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">เกิดข้อผิดพลาด หรือยังไม่ได้สร้าง Table 'fines' ใน Supabase<br><span class="text-xs text-gray-500">${e.message}</span></td></tr>`;
    }
};

window.renderFineTable = function(isAdminOverride) {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = isAdminOverride !== undefined ? isAdminOverride : (hasManagePerm || currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const tbody = document.getElementById('fineTableBody');
    const term = document.getElementById('fineSearchInput') ? document.getElementById('fineSearchInput').value.toLowerCase() : '';
    
    const filtered = globalFines.filter(f => 
        (f.user_name && f.user_name.toLowerCase().includes(term)) || 
        (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
        (f.note && f.note.toLowerCase().includes(term)) // ให้ค้นหาจากหมายเหตุได้ด้วย
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">ไม่พบประวัติใบปรับ</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(f => {
        const d = new Date(f.created_at);
        const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        
        const amountDisplay = f.amount > 0 ? `<span class="font-mono text-red-500 font-bold">฿${f.amount}</span>` : '<span class="text-gray-400">-</span>';
        
        const imgDisplay = f.evidence_url ? 
            `<button onclick="viewFineImage('${f.evidence_url}')" class="bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 transition shadow-sm"><span class="material-icons text-blue-500 text-lg block">image</span></button>` : 
            '<span class="text-gray-400 text-[10px]">- ไม่มีรูป -</span>';

        const delBtn = isAdmin ? `<button onclick="deleteFine(${f.id})" class="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 p-1.5 rounded-lg transition"><span class="material-icons text-sm block">delete</span></button>` : '';
        const empCol = isAdmin ? `<td class="p-3 font-bold text-slate-800 dark:text-white pt-4">${f.user_name}</td>` : '';
        const actionCol = isAdmin ? `<td class="p-3 text-center pt-3">${delBtn}</td>` : '';

        // 🌟 ส่วนแสดงผลหัวข้อกฎ + หมายเหตุสีเหลือง (ถ้ามี)
        let ruleDisplay = `<span class="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800/50">${f.rule_text}</span>`;
        if (f.note && f.note.trim() !== '') {
            ruleDisplay += `<div class="text-[10px] text-yellow-600 dark:text-yellow-500 mt-1.5 font-bold flex items-start gap-1"><span class="material-icons text-[12px] mt-0.5">info</span><span class="whitespace-normal break-words max-w-[200px]">${f.note}</span></div>`;
        }

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border-b border-gray-100 dark:border-slate-700/50 align-top">
            <td class="p-3 text-xs text-gray-500 pt-4">${dateStr}</td>
            ${empCol}
            <td class="p-3 text-xs font-bold leading-relaxed">${ruleDisplay}</td>
            <td class="p-3 text-center pt-4">${amountDisplay}</td>
            <td class="p-3 text-center pt-3">${imgDisplay}</td>
            ${actionCol}
        </tr>`;
    }).join('');
};

window.deleteFine = async function(id) {
    const res = await Swal.fire({title: 'ลบรายการนี้?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้ง'});
    if(res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        await appDB.from('fines').delete().eq('id', id);
        fetchFinesData(true);
        Swal.fire('ลบสำเร็จ', '', 'success');
    }
}
