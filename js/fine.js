// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System) V2 (Tabs Layout)
// ==========================================
let globalFines = [];
let globalFineRules = [];

// 📜 สรุปกฎระเบียบจากเอกสาร OKVIP
const okvipRules = [
    "บทที่ 2: มาทำงานสาย / กลับก่อนเวลา",
    "บทที่ 2: ไม่สแกนบัตรเข้า-ออกงาน / ขาดงาน",
    "บทที่ 2: ออกจากหน้างานชั่วคราวเกินเวลา / ไม่อยู่หน้างาน",
    "บทที่ 3: พกอุปกรณ์ส่วนตัว / เล่นมือถือในเวลาทำงาน",
    "บทที่ 3: ดูวิดีโอ / ช้อปปิ้ง / เล่นเกม / นอนหลับเวลางาน",
    "บทที่ 3: ลบประวัติแชท / ใช้อุปกรณ์ทำงานเรื่องส่วนตัว",
    "บทที่ 3: ไม่ปฏิบัติตามคำสั่ง / ทำงานด้วยอารมณ์ / ก้าวร้าว",
    "บทที่ 3: ดื่มแอลกอฮอล์ / ทานอาหารในสำนักงาน",
    "บทที่ 3: ทำงานล่าช้า / ไม่ตั้งใจ / ละเลยงาน",
    "บทที่ 3: ไม่รายงานข้อมูล / ปิดบัง / ทำข้อมูลปลอม",
    "บทที่ 3: รับไฟล์หรือลิงก์จากคนแปลกหน้า",
    "บทที่ 4: ทะเลาะวิวาท / ก่อเรื่อง / เสียงดัง",
    "บทที่ 4: ทำผิดกฎหอพัก (พาคนนอกเข้า / เข้าห้องผิดเพศ)",
    "บทที่ 5: ทุจริต / ปลอมแปลงข้อมูล / ขโมยทรัพย์สิน",
    "บทที่ 5: พูดจาไม่สุภาพ / ดูหมิ่น / ยุยงสร้างความขัดแย้ง"
];

window.initFineApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    if (isAdmin && typeof fetchUsers === 'function' && (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    const tabsContainer = document.getElementById('fineTabsContainer');
    
    if (isAdmin) {
        adminControls.classList.remove('hidden');
        tabsContainer.classList.remove('hidden'); // โชว์ปุ่ม Tab ให้ Admin
        tableContainer.classList.remove('lg:col-span-12');
        tableContainer.classList.add('lg:col-span-8');
        document.getElementById('fineSubtitle').innerText = "ออกใบปรับและดูประวัติทั้งหมด";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> รายการใบปรับทั้งหมดในระบบ';
        document.getElementById('thEmpName').style.display = '';
        document.getElementById('thAction').style.display = '';
        
        populateEmpSelect(); 
    } else {
        adminControls.classList.add('hidden');
        tabsContainer.classList.add('hidden'); // ซ่อนปุ่ม Tab สำหรับพนักงาน
        tableContainer.classList.remove('lg:col-span-8');
        tableContainer.classList.add('lg:col-span-12');
        document.getElementById('fineSubtitle').innerText = "ดูประวัติใบปรับของคุณ";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> ใบปรับของฉัน';
        document.getElementById('thEmpName').style.display = 'none';
        document.getElementById('thAction').style.display = 'none';
    }

    // เซ็ตให้เริ่มที่หน้าแรกเสมอ
    switchFineTab('issue');
    await loadFineRules();
    await fetchFinesData(isAdmin);
};

// -----------------------------------------
// 🔄 ระบบเปลี่ยนหน้า (Tab System)
// -----------------------------------------
window.switchFineTab = function(tabName) {
    const issueTab = document.getElementById('fineContent_issue');
    const rulesTab = document.getElementById('fineContent_rules');
    const btnIssue = document.getElementById('tabFineIssue');
    const btnRules = document.getElementById('tabFineRules');

    if (tabName === 'issue') {
        issueTab.classList.remove('hidden');
        issueTab.classList.add('grid');
        rulesTab.classList.add('hidden');
        rulesTab.classList.remove('block');

        btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-red-500 text-white shadow-md flex items-center gap-1 border border-red-400";
        btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    } else {
        issueTab.classList.add('hidden');
        issueTab.classList.remove('grid');
        rulesTab.classList.remove('hidden');
        rulesTab.classList.add('block');

        btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-amber-500 text-slate-900 shadow-md flex items-center gap-1 border border-amber-400";
        btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    }
};

// -----------------------------------------
// ระบบค้นหาพนักงาน (Custom Dropdown)
// -----------------------------------------
function populateEmpSelect() {
    const dropdown = document.getElementById('fineEmpDropdown');
    if (!dropdown || !GLOBAL_USER_LIST) return;
    
    const sortedUsers = [...GLOBAL_USER_LIST].sort((a, b) => a.username.localeCompare(b.username));
    dropdown.innerHTML = sortedUsers.map(u => `
        <div class="fine-emp-item cursor-pointer px-4 py-2.5 hover:bg-red-50 dark:hover:bg-slate-700/80 border-b border-gray-100 dark:border-slate-700/50 last:border-0 transition flex justify-between items-center" onclick="selectFineEmp('${u.username}')">
            <div class="font-bold text-slate-800 dark:text-white text-sm">${u.username}</div>
            <div class="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-900 px-2 py-0.5 rounded border dark:border-slate-600">${u.department || 'AM'}</div>
        </div>
    `).join('');
}

window.showEmpDropdown = function() {
    document.getElementById('fineEmpDropdown').classList.remove('hidden');
}

window.filterEmpDropdown = function() {
    const term = document.getElementById('fineEmpInput').value.toLowerCase();
    const items = document.querySelectorAll('.fine-emp-item');
    items.forEach(item => {
        const name = item.querySelector('.font-bold').innerText.toLowerCase();
        if(name.includes(term)) item.style.display = 'flex';
        else item.style.display = 'none';
    });
}

window.selectFineEmp = function(name) {
    document.getElementById('fineEmpInput').value = name;
    document.getElementById('fineEmpDropdown').classList.add('hidden');
}

document.addEventListener('click', function(e) {
    const input = document.getElementById('fineEmpInput');
    const dropdown = document.getElementById('fineEmpDropdown');
    if (input && dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// -----------------------------------------
// จัดการหัวข้อกฎ (แสดง 2 หน้า)
// -----------------------------------------
async function loadFineRules() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_rules_data').single();
        
        if (data && data.value) {
            globalFineRules = JSON.parse(data.value);
            if (globalFineRules.length <= 2 && globalFineRules.includes('ขาดงานไม่แจ้ง')) {
                globalFineRules = okvipRules;
                await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
            }
        } else {
            globalFineRules = okvipRules;
            await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        }
        renderRulesDropdown();
    } catch(e) { 
        globalFineRules = okvipRules; 
        renderRulesDropdown(); 
    }
}

// 🌟 อัปเดตฟังก์ชันให้วาดทั้ง Dropdown หน้าแรก และ List ในหน้าที่สอง
function renderRulesDropdown() {
    // 1. Dropdown ในหน้าออกใบปรับ
    const select = document.getElementById('fineRuleSelect');
    if (select) select.innerHTML = '<option value="">-- เลือกหัวข้อที่ผิด --</option>' + globalFineRules.map(r => `<option value="${r}">${r}</option>`).join('');
    
    // 2. List เต็มๆ ในหน้า จัดการกฎ
    const listDivFull = document.getElementById('fineRulesListFull');
    const countSpan = document.getElementById('ruleCount');
    
    if (listDivFull) {
        if(countSpan) countSpan.innerText = globalFineRules.length;
        
        if (globalFineRules.length === 0) {
            listDivFull.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 font-bold bg-slate-100 dark:bg-slate-900 rounded-xl">ไม่มีหัวข้อกฎหมายในระบบ</div>`;
            return;
        }

        listDivFull.innerHTML = globalFineRules.map((r, idx) => `
            <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition hover:border-amber-400 group">
                <div class="flex items-center gap-3 pr-2">
                    <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">${idx+1}</div>
                    <span class="text-sm font-bold text-slate-700 dark:text-gray-200">${r}</span>
                </div>
                <button onclick="removeFineRulePage(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 p-2 rounded-lg border border-gray-200 dark:border-slate-600 transition shadow-sm opacity-50 group-hover:opacity-100 shrink-0" title="ลบกฎข้อนี้">
                    <span class="material-icons text-[18px] block">delete_sweep</span>
                </button>
            </div>`).join('');
    }
}

// 🌟 เพิ่มกฎจากหน้า 2
window.addFineRulePage = async function() {
    const input = document.getElementById('newRuleInputPage');
    const val = input.value.trim();
    if(!val) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์หัวข้อกฎก่อนครับ', 'warning');
    
    Swal.fire({title: 'กำลังเพิ่มกฎ...', didOpen: () => Swal.showLoading()});
    globalFineRules.unshift(val); 
    input.value = '';
    
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
    renderRulesDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

// 🌟 ลบกฎจากหน้า 2
window.removeFineRulePage = async function(idx) {
    const res = await Swal.fire({
        title: 'ลบกฎข้อนี้?',
        text: `คุณต้องการลบ "${globalFineRules[idx]}" ออกจากระบบใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        globalFineRules.splice(idx, 1);
        await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        renderRulesDropdown();
        Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
    }
}

// 🌟 ปุ่มคืนค่ากฎ OKVIP
window.restoreOKVIPRules = async function() {
    const res = await Swal.fire({
        title: 'คืนค่าเริ่มต้น?',
        text: `ระบบจะล้างกฎที่คุณพิมพ์เองทั้งหมด และโหลดกฎตั้งต้นของ "OKVIP" เข้ามาแทน คุณแน่ใจหรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, คืนค่าเลย'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังดึงข้อมูล OKVIP...', didOpen: () => Swal.showLoading()});
        globalFineRules = [...okvipRules];
        await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        renderRulesDropdown();
        Swal.fire({icon: 'success', title: 'คืนค่าสำเร็จ!', text: 'ระบบอัปเดตเป็นกฎของ OKVIP ให้เรียบร้อยครับ', timer: 2000, showConfirmButton: false});
    }
}


// -----------------------------------------
// จัดการรูปภาพ & ระบบ Ctrl+V
// -----------------------------------------
window.previewFineImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('fineImgPreview').src = e.target.result;
            document.getElementById('fineImgPreviewBox').classList.remove('hidden');
            document.getElementById('finePasteArea').classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearFineImg = function(e) {
    if(e) e.preventDefault(); 
    document.getElementById('fineImageInput').value = '';
    document.getElementById('fineImgPreview').src = '';
    document.getElementById('fineImgPreviewBox').classList.add('hidden');
    document.getElementById('finePasteArea').classList.remove('hidden');
};

window.viewFineImage = function(url) {
    document.getElementById('fineExpandedImg').src = url;
    const modal = document.getElementById('fineImageModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

document.addEventListener('paste', function(e) {
    const fileInput = document.getElementById('fineImageInput');
    const fineApp = document.getElementById('fineContent_issue');
    
    // เช็คว่าอยู่ในหน้าจอแรก (issue)
    if (!fileInput || !fineApp || fineApp.classList.contains('hidden')) return;

    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            let blob = item.getAsFile();
            const file = new File([blob], "pasted_image.png", { type: item.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            window.previewFineImg(fileInput); 
            break; 
        }
    }
});

// -----------------------------------------
// บันทึกใบปรับ
// -----------------------------------------
window.submitFine = async function(e) {
    e.preventDefault();
    const empName = document.getElementById('fineEmpInput').value.trim();
    const ruleText = document.getElementById('fineRuleSelect').value;
    const noteText = document.getElementById('fineNote').value.trim(); 
    const amount = document.getElementById('fineAmount').value || 0;
    const fileInput = document.getElementById('fineImageInput');

    if(!empName || !ruleText) return;

    const targetUser = GLOBAL_USER_LIST.find(u => u.username === empName);
    if (!targetUser) {
        return Swal.fire('ไม่พบพนักงาน', 'โปรดตรวจสอบชื่อพนักงานที่พิมพ์อีกครั้ง', 'warning');
    }
    const targetId = targetUser.id;

    Swal.fire({title: 'กำลังบันทึกใบปรับ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let imageUrl = '';
    try {
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

        const { error: dbError } = await appDB.from('fines').insert([{
            user_id: targetId,
            user_name: empName,
            rule_text: ruleText,
            note: noteText,
            amount: amount,
            evidence_url: imageUrl,
            issued_by: currentUser.username
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'ออกใบปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        document.getElementById('fineEmpInput').value = '';
        document.getElementById('fineRuleSelect').value = '';
        document.getElementById('fineNote').value = '';
        document.getElementById('fineAmount').value = '';
        clearFineImg();
        
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
        if (!isAdmin) {
            query = query.eq('user_name', currentUser.username);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineTable(isAdmin);

    } catch (e) {
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
        (f.note && f.note.toLowerCase().includes(term))
    );

    let totalAmount = 0;
    filtered.forEach(f => {
        totalAmount += Number(f.amount) || 0;
    });
    
    const totalAmountEl = document.getElementById('fineTotalAmount');
    if (totalAmountEl) {
        totalAmountEl.innerText = `฿${totalAmount.toLocaleString('en-US')}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">ไม่พบประวัติใบปรับ</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(f => {
        const d = new Date(f.created_at);
        const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        
        const amountDisplay = f.amount > 0 ? `<span class="font-mono text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/50">฿${f.amount}</span>` : '<span class="text-gray-400">-</span>';
        
        const imgDisplay = f.evidence_url ? 
            `<button onclick="viewFineImage('${f.evidence_url}')" class="bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 transition shadow-sm" title="คลิกดูหลักฐาน"><span class="material-icons text-blue-500 text-lg block">image</span></button>` : 
            '<span class="text-gray-400 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">- ไม่มีรูป -</span>';

        const delBtn = isAdmin ? `<button onclick="deleteFine(${f.id})" class="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 p-1.5 rounded-lg transition"><span class="material-icons text-sm block">delete</span></button>` : '';
        const empCol = isAdmin ? `<td class="p-4 font-black text-slate-800 dark:text-white pt-5">${f.user_name}</td>` : '';
        const actionCol = isAdmin ? `<td class="p-4 text-center pt-4">${delBtn}</td>` : '';

        let ruleDisplay = `<span class="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800/50 shadow-sm inline-block">${f.rule_text}</span>`;
        if (f.note && f.note.trim() !== '') {
            ruleDisplay += `<div class="mt-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600/50 text-yellow-700 dark:text-yellow-400 p-2 rounded-lg text-xs font-bold flex items-start gap-1.5 w-fit max-w-[300px] shadow-sm"><span class="material-icons text-[16px] shrink-0 mt-0.5 text-yellow-500">info</span><span class="whitespace-normal break-words leading-snug">${f.note}</span></div>`;
        }

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border-b border-gray-100 dark:border-slate-700/50 align-top group">
            <td class="p-4 text-xs text-gray-500 pt-5 font-mono">${dateStr}</td>
            ${empCol}
            <td class="p-4 text-xs font-bold pt-4 pb-4">${ruleDisplay}</td>
            <td class="p-4 text-center pt-5">${amountDisplay}</td>
            <td class="p-4 text-center pt-4">${imgDisplay}</td>
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
