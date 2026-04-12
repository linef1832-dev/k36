// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System) V28 (อัปเดตระบบวันที่กระทำความผิด)
// ==========================================
let globalFines = [];
let globalFineRules = [];
let globalFineNotes = []; 
let finesSubscription = null;

window.subscribeFinesChanges = function(isAdmin) {
    if (finesSubscription) return;

    finesSubscription = appDB.channel('fines-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fines' }, (payload) => {
            const newFine = payload.new;

            if (isAdmin || currentUser.username === newFine.user_name) {
                const isExist = globalFines.some(f => String(f.id) === String(newFine.id));
                if (!isExist) {
                    globalFines.unshift(newFine);
                    renderFineTable(isAdmin);

                    if (!isAdmin && currentUser.username === newFine.user_name) {
                        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 6000 })
                            .fire({ icon: 'warning', title: '🚨 คุณได้รับใบปรับใหม่!' });
                    }
                }
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'fines' }, (payload) => {
            const deletedId = payload.old.id;
            const isExist = globalFines.some(f => String(f.id) === String(deletedId));
            
            if (isExist) {
                globalFines = globalFines.filter(f => String(f.id) !== String(deletedId));
                renderFineTable(isAdmin);
            }
        })
        .subscribe();
};

const defaultNotes = [
    "โทรไม่รับสาย / ติดต่อไม่ได้",
    "แชทไม่ตอบเกินเวลา",
    "ทำงานผิดพลาด / ไม่ตรวจสอบ",
    "ไม่แจ้งล่วงหน้า",
    "ไม่เห็นหน้าจอ / กล้องมืด",
    "เตือนแล้วแต่ไม่ปรับปรุง"
];

const okvipRules = [
    "[ออนไลน์] บทที่2 ข้อที่1 ไม่ได้เข้าเช็คชื่อ",
    "[ออนไลน์] บทที่ 2 ข้อที่ 4 โทรติดต่อกัน 3 ครั้ง ไม่มีการรับสาย",
    "[ออนไลน์] บทที่ 2 ข้อที่ 3 ออกจากหน้างานโดยไม่แจ้งให้คนเบื้องบนทราบ",
    "[ออนไลน์] บทที่ 3 ข้อ 1 พฤติกรรมไม่เหมาะสม",
    "[ออนไลน์] บทที่ 3 ข้อ 2 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[ออนไลน์] บทที่ 3 ข้อที่ 4 ไม่ทำงานตามกระบวนการ",
    "[ออฟฟิศ] บทที่ 3 ข้อ 7 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[ออฟฟิศ] บทที่ 3 ข้อที่ 9 ไม่ทำงานตามกระบวนการ",
    "[ออฟฟิศ] บทที่ 3 ข้อที่ 2 พฤติกรรมที่ส่งผลกระทบต่องาน",
    "[WFH] บทที่ 2 ข้อที่ 1.1 มาทำงานเกินเวลาปกติ",
    "[WFH] บทที่ 3 ข้อที่1 ระหว่างเวลางานทำเรื่องไม่เกี่ยวกับงาน",
    "[WFH] บทที่ 3 ข้อที่ 6 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[WFH] บทที่ 3 ข้อที่ 8 ไม่ทำตามขั้นตอน"
];

window.initFineApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    const tabsContainer = document.getElementById('fineTabsContainer');
    
    if (isAdmin) {
        if(adminControls) adminControls.classList.remove('hidden');
        if(tabsContainer) tabsContainer.classList.remove('hidden'); 
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-12');
            tableContainer.classList.add('lg:col-span-8');
        }
        const sub = document.getElementById('fineSubtitle');
        if(sub) sub.innerText = "ออกใบปรับและดูประวัติทั้งหมด";
        const title = document.getElementById('tableFineTitle');
        if(title) title.innerHTML = '<span class="material-icons text-blue-500">list_alt</span> รายการใบปรับทั้งหมดในระบบ';
        
        populateEmpSelect(); 
    } else {
        if(adminControls) adminControls.classList.add('hidden');
        if(tabsContainer) tabsContainer.classList.add('hidden'); 
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-8');
            tableContainer.classList.add('lg:col-span-12');
        }
        const sub = document.getElementById('fineSubtitle');
        if(sub) sub.innerText = "ดูประวัติใบปรับของคุณ";
        const title = document.getElementById('tableFineTitle');
        if(title) title.innerHTML = '<span class="material-icons text-blue-500">list_alt</span> ใบปรับของฉัน';
    }

    switchFineTab('issue');
    
    // 🌟 ตั้งค่า Default วันที่กระทำผิดให้เป็นวันนี้
    const offDateInput = document.getElementById('fineOffenseDate');
    if (offDateInput && !offDateInput.value) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        offDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
    }

    await loadFineRules();
    await loadFineNotes(); 
    await fetchFinesData(isAdmin);
    subscribeFinesChanges(isAdmin);
};

window.switchFineTab = function(tabName) {
    const issueTab = document.getElementById('fineContent_issue');
    const rulesTab = document.getElementById('fineContent_rules');
    const statsTab = document.getElementById('fineContent_stats'); // เพิ่มหน้าต่าง Stats
    const btnIssue = document.getElementById('tabFineIssue');
    const btnRules = document.getElementById('tabFineRules');
    const btnStats = document.getElementById('tabFineStats'); // เพิ่มปุ่ม Stats

    // 1. ซ่อนทุกอย่างและรีเซ็ตสีปุ่มให้เป็นสีเทาก่อน
    const inactiveBtnClass = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    
    if(issueTab) { issueTab.classList.add('hidden'); issueTab.classList.remove('grid'); }
    if(rulesTab) { rulesTab.classList.add('hidden'); rulesTab.classList.remove('block'); }
    if(statsTab) { statsTab.classList.add('hidden'); statsTab.classList.remove('block'); }
    
    if(btnIssue) btnIssue.className = inactiveBtnClass;
    if(btnRules) btnRules.className = inactiveBtnClass;
    if(btnStats) btnStats.className = inactiveBtnClass;

    // 2. เปิดโชว์เฉพาะหน้าที่เลือก และเปลี่ยนสีปุ่ม
    if (tabName === 'issue') {
        if(issueTab) { issueTab.classList.remove('hidden'); issueTab.classList.add('grid'); }
        if(btnIssue) btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-red-500 text-white shadow-md flex items-center gap-1 border border-red-400";
    } else if (tabName === 'rules') {
        if(rulesTab) { rulesTab.classList.remove('hidden'); rulesTab.classList.add('block'); }
        if(btnRules) btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-amber-500 text-slate-900 shadow-md flex items-center gap-1 border border-amber-400";
    } else if (tabName === 'stats') {
        if(statsTab) { statsTab.classList.remove('hidden'); statsTab.classList.add('block'); }
        if(btnStats) btnStats.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)] flex items-center gap-1 border border-rose-400";
        
        // เมื่อเปิดหน้าสถิติ ให้รันฟังก์ชันจัดเรียงเดือนและข้อมูลสถิติ
        if(typeof renderFineStatsMonthOptions === 'function') renderFineStatsMonthOptions();
        if(typeof renderFineStats === 'function') renderFineStats();
    }
};

// --- ฟังก์ชันเตรียมตัวเลือกเดือน สำหรับหน้าสถิติ ---
window.renderFineStatsMonthOptions = function() {
    const select = document.getElementById('fineStatsMonth');
    if (!select || select.options.length > 1) return; // ถ้าเคยโหลดไปแล้วไม่ต้องโหลดซ้ำ

    const months = new Set();
    globalFines.forEach(f => {
        // อิงจากวันที่ทำผิด หรือวันที่ออกใบปรับ
        const d = f.offense_date ? new Date(f.offense_date) : new Date(f.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${y}-${m}`);
    });

    const sortedMonths = Array.from(months).sort().reverse(); // เรียงจากล่าสุดไปเก่าสุด
    const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

    let html = '<option value="all">รวมทุกเดือน (All Time)</option>';
    sortedMonths.forEach(ym => {
        const [y, m] = ym.split('-');
        html += `<option value="${ym}">${thaiMonths[parseInt(m)-1]} ${parseInt(y)+543}</option>`;
    });
    select.innerHTML = html;

    // ตั้งค่า Default เป็นเดือนปัจจุบัน (ถ้ามีข้อมูลเดือนนี้)
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (sortedMonths.includes(currentYM)) {
        select.value = currentYM;
    }
};

// --- ฟังก์ชันคำนวณและวาดกล่อง Leaderboard สถิติ ---
window.renderFineStats = function() {
    const container = document.getElementById('fineStatsLeaderboard');
    if (!container) return;

    const monthFilter = document.getElementById('fineStatsMonth') ? document.getElementById('fineStatsMonth').value : 'all';
    const deptFilter = document.getElementById('fineStatsDept') ? document.getElementById('fineStatsDept').value : 'ALL';
    const shiftFilter = document.getElementById('fineStatsShift') ? document.getElementById('fineStatsShift').value : 'ALL';

    // 1. กรองเดือน แผนก และกะ
    let filteredFines = globalFines.filter(f => {
        // กรองเดือน
        if (monthFilter !== 'all') {
            const d = f.offense_date ? new Date(f.offense_date) : new Date(f.created_at);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym !== monthFilter) return false;
        }

        // กรองแผนก และ กะ
        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            let dbUser = null;
            if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
                dbUser = GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(f.user_name).toLowerCase());
            }
            
            if (!dbUser) return false; // ถ้าหาคนในระบบไม่เจอ ให้ข้ามไปถ้ามีการกรองกะ/แผนก

            let uDept = dbUser.department || 'AM';
            let isTrainer = dbUser.role === 'trainer' || uDept === 'TRAINER';
            if (isTrainer) uDept = 'TRAINER';

            if (deptFilter !== 'ALL' && uDept !== deptFilter) return false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) return false;
        }

        return true;
    });

    if (filteredFines.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 font-bold bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">ไม่มีประวัติโดนปรับในเงื่อนไขที่เลือกครับ 🎉</div>';
        return;
    }

    // 2. รวมยอดของพนักงานแต่ละคน (นับจำนวนครั้ง และรวมจำนวนเงิน)
    const statsMap = {};
    filteredFines.forEach(f => {
        const name = f.user_name;
        if (!statsMap[name]) {
            statsMap[name] = { count: 0, amount: 0 };
        }
        statsMap[name].count++;
        // ถ้าเป็นการปรับเงิน (ไม่ใช่หักค่าแรง=-1) ค่อยบวกเงิน
        if (f.amount > 0) {
            statsMap[name].amount += Number(f.amount);
        }
    });

    // 3. แปลงเป็น Array แล้วจัดอันดับ (เรียงจาก จำนวนเงินมากไปน้อย -> ถ้าเงินเท่ากันเรียงจำนวนครั้ง)
    const sortedStats = Object.keys(statsMap).map(name => ({
        name: name,
        count: statsMap[name].count,
        amount: statsMap[name].amount
    })).sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return b.count - a.count;
    });

    // 4. วาดการ์ดแสดงผล
    container.innerHTML = sortedStats.map((stat, index) => {
        const rank = index + 1;
        let medalClass = 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-slate-600';
        
        // ให้สีพิเศษสำหรับ Top 3
        if (rank === 1) medalClass = 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
        else if (rank === 2) medalClass = 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 border border-gray-400 shadow-md';
        else if (rank === 3) medalClass = 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-50 border border-orange-500 shadow-md';

        return window.renderTemplate('tpl-fine-stats-card', {
            rank: rank,
            medalClass: medalClass,
            name: stat.name,
            count: stat.count,
            amount: stat.amount.toLocaleString('en-US')
        });
    }).join('');
    
    // (Optional) สั่งให้ซ่อน/โชว์ Dropdown แผนกกับกะ สำหรับแอดมินเท่านั้น
    const isAdmin = typeof currentUser !== 'undefined' && (currentUser.role === 'manager' || currentUser.role === 'admin' || (typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false));
    document.querySelectorAll('.admin-col').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
};

function populateEmpSelect() {
    const dropdown = document.getElementById('fineEmpDropdown');
    if (!dropdown || typeof GLOBAL_USER_LIST === 'undefined') return;
    
    const sortedUsers = [...GLOBAL_USER_LIST].sort((a, b) => a.username.localeCompare(b.username));
    dropdown.innerHTML = sortedUsers.map(u => {
        return window.renderTemplate('tpl-fine-emp-item', {
            username: u.username,
            dept: u.department || 'AM'
        });
    }).join('');
}

window.showEmpDropdown = function() {
    const dd = document.getElementById('fineEmpDropdown');
    if(dd) dd.classList.remove('hidden');
}

window.filterEmpDropdown = function() {
    const input = document.getElementById('fineEmpInput');
    if(!input) return;
    const term = input.value.toLowerCase();
    const items = document.querySelectorAll('.fine-emp-item');
    items.forEach(item => {
        const nameEl = item.querySelector('.font-bold');
        if(!nameEl) return;
        const name = nameEl.innerText.toLowerCase();
        if(name.includes(term)) item.style.display = 'flex';
        else item.style.display = 'none';
    });
}

window.selectFineEmp = function(name) {
    const input = document.getElementById('fineEmpInput');
    const dd = document.getElementById('fineEmpDropdown');
    if(input) input.value = name;
    if(dd) dd.classList.add('hidden');
}

document.addEventListener('click', function(e) {
    const input = document.getElementById('fineEmpInput');
    const dropdown = document.getElementById('fineEmpDropdown');
    if (input && dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ===============================================
// 🌟 1. การจัดการ หมายเหตุสำเร็จรูป (Notes) + Edit
// ===============================================
async function loadFineNotes() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_notes_data').single();
        if (data && data.value) {
            globalFineNotes = JSON.parse(data.value);
        } else {
            globalFineNotes = defaultNotes;
            await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
        }
        renderNotesDropdown();
    } catch(e) { 
        globalFineNotes = defaultNotes; 
        renderNotesDropdown(); 
    }
}

function renderNotesDropdown() {
    const noteSelect = document.getElementById('fineNoteSelect');
    if (noteSelect) {
        noteSelect.innerHTML = '<option value="">-- เลือกหมายเหตุสำเร็จรูป (ไม่บังคับ) --</option>' + 
            globalFineNotes.map(n => `<option value="${n}">${n}</option>`).join('');
    }

    const listDiv = document.getElementById('fineNotesListFull');
    if (listDiv) {
        if (globalFineNotes.length === 0) {
            listDiv.innerHTML = `<div class="col-span-full text-center py-4 text-gray-500 text-sm">ยังไม่มีหมายเหตุสำเร็จรูปในระบบ</div>`;
            return;
        }

        listDiv.innerHTML = globalFineNotes.map((n, idx) => {
            return window.renderTemplate('tpl-fine-note-item', {
                noteText: n,
                index: idx
            });
        }).join('');
    }
}

window.addFineNotePage = async function() {
    const input = document.getElementById('newNoteInputPage');
    if(!input) return;
    const val = input.value.trim();
    if(!val) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์ข้อความหมายเหตุก่อนครับ', 'warning');
    
    Swal.fire({title: 'กำลังเพิ่ม...', didOpen: () => Swal.showLoading()});
    globalFineNotes.push(val); 
    input.value = '';
    
    await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
    renderNotesDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

window.editFineNotePage = async function(idx) {
    const currentNote = globalFineNotes[idx];
    
    const { value: newNote } = await Swal.fire({
        title: '<span class="text-amber-500">แก้ไขข้อความหมายเหตุ</span>',
        input: 'text',
        inputValue: currentNote,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        inputValidator: (value) => {
            if (!value.trim()) return 'กรุณากรอกข้อความ!';
        },
        customClass: { 
            popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl',
            input: 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl'
        }
    });

    if (newNote && newNote.trim() !== currentNote) {
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        globalFineNotes[idx] = newNote.trim();
        await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
        renderNotesDropdown();
        Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false});
    }
};

window.removeFineNotePage = async function(idx) {
    const res = await Swal.fire({
        title: 'ลบหมายเหตุข้อนี้?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'ยกเลิก',
        confirmButtonText: 'ลบทิ้ง'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        globalFineNotes.splice(idx, 1);
        await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
        renderNotesDropdown();
        Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
    }
}

// ===============================================
// 🌟 2. การจัดการกฎ (Accordion UI + Dropdown Auto Fill + Amount Type)
// ===============================================
async function loadFineRules() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_rules_data').single();
        if (data && data.value) {
            globalFineRules = JSON.parse(data.value);
            if (globalFineRules.length < 5) {
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

window.toggleFineAmountInput = function() {
    const typeSelect = document.getElementById('finePenaltyType');
    const amtInput = document.getElementById('fineAmount');
    if(!typeSelect || !amtInput) return;

    if (typeSelect.value === 'nowage') {
        amtInput.value = '';
        amtInput.disabled = true;
        amtInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-slate-800');
    } else {
        amtInput.disabled = false;
        amtInput.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-slate-800');
    }
};

window.filterRulesByCategory = function() {
    const catSelect = document.getElementById('fineCategorySelect');
    const ruleSelect = document.getElementById('fineRuleSelect');
    const amountInput = document.getElementById('fineAmount');
    
    if(amountInput) amountInput.value = '';

    if (!catSelect || !ruleSelect) return;
    
    const cat = catSelect.value;
    if (!cat) {
        ruleSelect.innerHTML = '<option value="">-- เลือกหมวดหมู่ทางซ้ายก่อน --</option>';
        ruleSelect.disabled = true;
        return;
    }

    ruleSelect.disabled = false;
    let filteredRules = [];
    
    globalFineRules.forEach(r => {
        if (cat === 'ออนไลน์' && r.includes('[ออนไลน์]')) filteredRules.push(r);
        else if (cat === 'WFH' && r.includes('[WFH]')) filteredRules.push(r);
        else if (cat === 'ออฟฟิศ' && r.includes('[ออฟฟิศ]')) filteredRules.push(r);
        else if (cat === 'อื่นๆ' && !r.includes('[ออนไลน์]') && !r.includes('[WFH]') && !r.includes('[ออฟฟิศ]')) filteredRules.push(r);
    });

    if (filteredRules.length === 0) {
        ruleSelect.innerHTML = '<option value="">-- ไม่มีกฎในหมวดนี้ --</option>';
        ruleSelect.disabled = true;
        return;
    }

    ruleSelect.innerHTML = '<option value="">-- เลือกหัวข้อที่ผิด --</option>' + filteredRules.map(r => `<option value="${r}">${r}</option>`).join('');

    ruleSelect.onchange = function() {
        const typeSelect = document.getElementById('finePenaltyType');
        const amtInput = document.getElementById('fineAmount');
        if (!typeSelect || !amtInput) return;

        if (this.value) {
            if (this.value.includes('ไม่ได้ค่าแรง')) {
                typeSelect.value = 'nowage';
                window.toggleFineAmountInput();
            } else {
                typeSelect.value = 'money';
                window.toggleFineAmountInput();
                
                const match = this.value.match(/ปรับ\s*([\d,]+)/);
                if (match && match[1].replace(/,/g, '').length >= 3) {
                    amtInput.value = parseInt(match[1].replace(/,/g, ''), 10);
                } else {
                    amtInput.value = ''; 
                }
            }
        } else {
            typeSelect.value = 'money';
            amtInput.value = '';
            window.toggleFineAmountInput();
        }
    };
}

window.toggleRuleGroup = function(groupId, btn) {
    const groupDiv = document.getElementById(groupId);
    if(!groupDiv) return;
    const icon = btn.querySelector('.material-icons:last-child');
    if (groupDiv.classList.contains('hidden')) {
        groupDiv.classList.remove('hidden');
        groupDiv.classList.add('flex');
        if(icon) icon.style.transform = 'rotate(0deg)';
    } else {
        groupDiv.classList.add('hidden');
        groupDiv.classList.remove('flex');
        if(icon) icon.style.transform = 'rotate(-90deg)';
    }
}

function renderRulesDropdown() {
    const catSelect = document.getElementById('fineCategorySelect');
    if (catSelect) {
        catSelect.value = "";
        window.filterRulesByCategory(); 
    }

    const listDivFull = document.getElementById('fineRulesListFull');
    const countSpan = document.getElementById('ruleCount');

    if (listDivFull) {
        if(countSpan) countSpan.innerText = globalFineRules.length;
        
        if (globalFineRules.length === 0) {
            listDivFull.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold bg-slate-100 dark:bg-slate-900 rounded-xl">ไม่มีหัวข้อกฎหมายในระบบ</div>`;
            return;
        }

        const groups = { 'ออนไลน์': [], 'WFH': [], 'ออฟฟิศ': [], 'อื่นๆ': [] };
        globalFineRules.forEach((r, idx) => {
            if (r.includes('[ออนไลน์]')) groups['ออนไลน์'].push({ text: r, index: idx });
            else if (r.includes('[WFH]')) groups['WFH'].push({ text: r, index: idx });
            else if (r.includes('[ออฟฟิศ]')) groups['ออฟฟิศ'].push({ text: r, index: idx });
            else groups['อื่นๆ'].push({ text: r, index: idx });
        });

        let html = '';
        const buildGroupHtml = (title, items, icon, colorClass) => {
            if (items.length === 0) return '';
            const groupId = 'group_' + title;
            
            let itemsHtml = items.map((item, i) => {
                return window.renderTemplate('tpl-fine-rule-item', {
                    badgeClass: colorClass.badge,
                    indexDisplay: i + 1,
                    text: item.text,
                    rawIndex: item.index
                });
            }).join('');

            return window.renderTemplate('tpl-fine-rule-group', {
                groupId: groupId,
                headerClass: colorClass.header,
                icon: icon,
                title: title,
                count: items.length,
                itemsHtml: itemsHtml
            });
        };

        html += buildGroupHtml('ออนไลน์', groups['ออนไลน์'], 'language', { header: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' });
        html += buildGroupHtml('WFH', groups['WFH'], 'home_work', { header: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' });
        html += buildGroupHtml('ออฟฟิศ', groups['ออฟฟิศ'], 'domain', { header: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' });
        html += buildGroupHtml('อื่นๆ', groups['อื่นๆ'], 'list', { header: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700', badge: 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400' });

        listDivFull.innerHTML = html;
    }
}

window.addFineRulePage = async function() {
    const catInput = document.getElementById('newRuleCategory');
    const textInput = document.getElementById('newRuleInputPage');
    const amtInput = document.getElementById('newRuleAmount');

    const category = catInput ? catInput.value : 'อื่นๆ';
    const textVal = textInput ? textInput.value.trim() : '';
    const amtVal = amtInput ? amtInput.value.trim() : '';

    if(!textVal) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์รายละเอียดความผิดก่อนครับ', 'warning');
    
    let finalRuleString = `[${category}] ${textVal}`;

    if (amtVal && parseInt(amtVal) > 0) {
        const formattedAmt = parseInt(amtVal).toLocaleString('en-US');
        finalRuleString += ` (ปรับ ${formattedAmt})`;
    }
    
    Swal.fire({title: 'กำลังเพิ่มกฎ...', didOpen: () => Swal.showLoading()});
    globalFineRules.push(finalRuleString); 
    
    if(textInput) textInput.value = '';
    if(amtInput) amtInput.value = '';
    
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
    renderRulesDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

window.editFineRulePage = async function(idx) {
    const currentRule = globalFineRules[idx];
    
    let currentCategory = 'อื่นๆ';
    let currentDetail = currentRule;
    let currentAmount = '';

    const catMatch = currentRule.match(/^\[(.*?)\]\s*/);
    if (catMatch) {
        currentCategory = catMatch[1].trim(); 
        currentDetail = currentDetail.replace(catMatch[0], ''); 
    }

    const amtMatch = currentDetail.match(/\s*\(ปรับ\s*([\d,]+)\)$/);
    if (amtMatch) {
        currentAmount = amtMatch[1].replace(/,/g, '');
        currentDetail = currentDetail.replace(amtMatch[0], ''); 
    }
    
    const htmlForm = window.renderTemplate('tpl-fine-edit-rule-form', {
        selOnline: currentCategory === 'ออนไลน์' ? 'selected="selected"' : '',
        selWFH: currentCategory === 'WFH' ? 'selected="selected"' : '',
        selOffice: currentCategory === 'ออฟฟิศ' ? 'selected="selected"' : '',
        selOther: currentCategory === 'อื่นๆ' ? 'selected="selected"' : '',
        currentDetail: currentDetail,
        currentAmount: currentAmount
    });

    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: '<div class="text-xl font-black text-amber-500 flex items-center justify-center gap-2"><span class="material-icons">edit</span> แก้ไขหัวข้อกฎ</div>',
        html: htmlForm,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl' },
        
        didOpen: () => {
            const catSelect = document.getElementById('editRuleCategory');
            if (catSelect) {
                catSelect.value = currentCategory;
            }
        },

        preConfirm: () => {
            const cat = document.getElementById('editRuleCategory').value;
            const detail = document.getElementById('editRuleDetail').value.trim();
            const amt = document.getElementById('editRuleAmount').value.trim();
            if (!detail) {
                Swal.showValidationMessage('กรุณากรอกรายละเอียดความผิด!');
                return false;
            }
            return { cat, detail, amt };
        }
    });

    if (isConfirmed && parsedData) {
        let finalRuleString = `[${parsedData.cat}] ${parsedData.detail}`;
        if (parsedData.amt && parseInt(parsedData.amt) > 0) {
            const formattedAmt = parseInt(parsedData.amt).toLocaleString('en-US');
            finalRuleString += ` (ปรับ ${formattedAmt})`;
        }

        if (finalRuleString !== currentRule) {
            Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
            globalFineRules[idx] = finalRuleString;
            await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
            renderRulesDropdown(); 
            Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    }
};

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

window.restoreOKVIPRules = async function() {
    const res = await Swal.fire({
        title: 'คืนค่าเริ่มต้น?',
        text: `คุณต้องการโหลดกฎตั้งต้นของ "OKVIP" ชุดใหม่เข้ามาทับกฎเดิมใช่หรือไม่? (กฎที่คุณสร้างเองจะหายไปทั้งหมด)`,
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
            const imgPreview = document.getElementById('fineImgPreview');
            const previewBox = document.getElementById('fineImgPreviewBox');
            const pasteArea = document.getElementById('finePasteArea');
            if(imgPreview) imgPreview.src = e.target.result;
            if(previewBox) previewBox.classList.remove('hidden');
            if(pasteArea) pasteArea.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearFineImg = function(e) {
    if(e) e.preventDefault(); 
    const fileInput = document.getElementById('fineImageInput');
    const imgPreview = document.getElementById('fineImgPreview');
    const previewBox = document.getElementById('fineImgPreviewBox');
    const pasteArea = document.getElementById('finePasteArea');
    
    if(fileInput) fileInput.value = '';
    if(imgPreview) imgPreview.src = '';
    if(previewBox) previewBox.classList.add('hidden');
    if(pasteArea) pasteArea.classList.remove('hidden');
};

window.viewFineImage = function(url) {
    const expImg = document.getElementById('fineExpandedImg');
    const modal = document.getElementById('fineImageModal');
    if(expImg) expImg.src = url;
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

document.addEventListener('paste', function(e) {
    const fileInput = document.getElementById('fineImageInput');
    const fineApp = document.getElementById('fineContent_issue');
    
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
    const empInput = document.getElementById('fineEmpInput');
    const ruleSelect = document.getElementById('fineRuleSelect');
    
    if(!empInput || !ruleSelect) return;
    
    const empName = empInput.value.trim();
    const ruleText = ruleSelect.value;
    
    const noteSelect = document.getElementById('fineNoteSelect') ? document.getElementById('fineNoteSelect').value : '';
    const noteInput = document.getElementById('fineNoteInput') ? document.getElementById('fineNoteInput').value.trim() : '';
    
    // 🌟 ดึงค่าจากช่อง "วันที่กระทำผิด"
    const offenseDateInput = document.getElementById('fineOffenseDate');
    const offenseDateVal = offenseDateInput ? offenseDateInput.value : null;
    
    let finalNote = noteSelect;
    if (noteInput) {
        if (finalNote) {
            if (finalNote.includes(' นาที')) {
                finalNote = finalNote.replace(' นาที', ` ${noteInput} นาที`);
            } else if (finalNote.includes(' ครั้ง')) {
                finalNote = finalNote.replace(' ครั้ง', ` ${noteInput} ครั้ง`);
            } else if (finalNote.includes(' วัน')) {
                finalNote = finalNote.replace(' วัน', ` ${noteInput} วัน`);
            } else if (finalNote.includes('...')) {
                finalNote = finalNote.replace('...', noteInput);
            } else {
                finalNote = `${finalNote} ${noteInput}`;
            }
            finalNote = finalNote.replace(/\s+/g, ' '); 
        } else {
            finalNote = noteInput;
        }
    }
    
    if (finalNote) {
        finalNote = finalNote.trim();
        while (finalNote.startsWith('(') && finalNote.endsWith(')')) {
            finalNote = finalNote.substring(1, finalNote.length - 1).trim();
        }
    }
    
    const penaltyTypeEl = document.getElementById('finePenaltyType');
    const amountEl = document.getElementById('fineAmount');
    const penaltyType = penaltyTypeEl ? penaltyTypeEl.value : 'money';
    let amountToSave = 0;
    
    if (penaltyType === 'nowage') {
        amountToSave = -1;
    } else {
        amountToSave = amountEl ? (parseInt(amountEl.value) || 0) : 0;
    }
    
    const fileInput = document.getElementById('fineImageInput');

    if(!empName || !ruleText) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและหัวข้อกฎให้ครบถ้วน', 'warning');

    Swal.fire({title: 'กำลังบันทึกใบปรับ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let imageUrl = '';
    try {
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            Swal.update({text: 'กำลังอัปโหลดหลักฐาน...'});
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `fine_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`fines/${fileName}`, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ');
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`fines/${fileName}`);
            imageUrl = publicUrlData.publicUrl;
        }
        
        let targetId = null;
        if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST) {
             const tUser = GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(empName).toLowerCase());
             if (tUser) targetId = tUser.id;
        }

        const { error: dbError } = await appDB.from('fines').insert([{
            user_id: targetId, 
            user_name: empName, 
            rule_text: ruleText,
            note: finalNote, 
            amount: amountToSave, 
            evidence_url: imageUrl,
            issued_by: currentUser.username,
            offense_date: offenseDateVal // 🌟 บันทึกวันที่กระทำความผิด
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'ออกใบปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        if(empInput) empInput.value = '';
        const catSelect = document.getElementById('fineCategorySelect');
        if(catSelect) catSelect.value = '';
        window.filterRulesByCategory(); 
        
        if (document.getElementById('fineNoteSelect')) document.getElementById('fineNoteSelect').value = '';
        if (document.getElementById('fineNoteInput')) document.getElementById('fineNoteInput').value = '';
        if (penaltyTypeEl) {
            penaltyTypeEl.value = 'money';
            window.toggleFineAmountInput();
        }
        if(amountEl) amountEl.value = '';
        clearFineImg();
        
        // 🌟 รีเซ็ตวันที่กลับมาเป็นวันนี้
        if (offenseDateInput) {
            const today = new Date();
            const offset = today.getTimezoneOffset() * 60000;
            offenseDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
        }

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
        if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
            await fetchUsers(true);
        }

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
    
    document.querySelectorAll('.admin-col').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    
    const tbody = document.getElementById('fineTableBody');
    const searchInput = document.getElementById('fineSearchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    
    // 🌟 ดึงค่าจาก Dropdown Filter แผนกและกะ
    const deptFilter = document.getElementById('fineDeptFilter') ? document.getElementById('fineDeptFilter').value : 'ALL';
    const shiftFilter = document.getElementById('fineShiftFilter') ? document.getElementById('fineShiftFilter').value : 'ALL';
    
    if(!tbody) return;

    // 🌟 ประมวลผลการกรองข้อมูลแบบผสม (ค้นหา + แผนก + กะ)
    const filtered = globalFines.filter(f => {
        // 1. ตรวจสอบการค้นหาข้อความ
        const matchTerm = (f.user_name && f.user_name.toLowerCase().includes(term)) || 
                          (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
                          (f.note && f.note.toLowerCase().includes(term));
        
        let matchDept = true;
        let matchShift = true;

        // 2. ตรวจสอบ Filter ว่าผู้ใช้ถูกจัดให้อยู่แผนก/กะ ไหน (อิงตาม GLOBAL_USER_LIST)
        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST && GLOBAL_USER_LIST.length > 0) {
                const dbUser = GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(f.user_name).toLowerCase());
                if (dbUser) {
                    let uDept = dbUser.department || 'AM';
                    if (dbUser.role === 'trainer' || uDept === 'TRAINER') uDept = 'TRAINER';
                    let uShift = dbUser.allowed_shift || 'UNKNOWN';

                    if (deptFilter !== 'ALL' && uDept !== deptFilter) matchDept = false;
                    if (shiftFilter !== 'ALL' && uShift !== shiftFilter) matchShift = false;
                } else {
                    // ถ้าในระบบไม่มีประวัติคนนี้ ให้หลุดกรองไปเลย
                    matchDept = false;
                    matchShift = false;
                }
            }
        }

        return matchTerm && matchDept && matchShift;
    });

    let totalAmount = 0;
    filtered.forEach(f => {
        if (f.amount > 0) totalAmount += Number(f.amount);
    });
    
    const totalAmountEl = document.getElementById('fineTotalAmount');
    if (totalAmountEl) {
        totalAmountEl.innerText = `฿${totalAmount.toLocaleString('en-US')}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">ไม่พบประวัติใบปรับตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(f => {
        const d = new Date(f.created_at);
        const issueDateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        
        let offenseDateStr = '-';
        if (f.offense_date) {
            const od = new Date(f.offense_date);
            offenseDateStr = od.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
        } else {
            offenseDateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        
        let amountDisplay = '';
        if (f.amount === -1) {
            amountDisplay = window.renderTemplate('tpl-fine-history-amount-nowage');
        } else if (f.amount > 0) {
            amountDisplay = window.renderTemplate('tpl-fine-history-amount-badge', { amount: f.amount.toLocaleString('en-US') });
        } else {
            amountDisplay = '<span class="text-gray-400">-</span>';
        }
        
        const imgDisplay = f.evidence_url ? window.renderTemplate('tpl-fine-history-img-btn', { url: f.evidence_url }) : window.renderTemplate('tpl-fine-history-img-none');

        let noteHtml = '';
        if (f.note && f.note.trim() !== '') {
            let cleanNoteForTable = f.note.trim();
            while (cleanNoteForTable.startsWith('(') && cleanNoteForTable.endsWith(')')) {
                cleanNoteForTable = cleanNoteForTable.substring(1, cleanNoteForTable.length - 1).trim();
            }
            noteHtml = window.renderTemplate('tpl-fine-history-note', { note: cleanNoteForTable });
        }

        let displayName = f.user_name;
        let deptBadgeHtml = '';

        if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST && GLOBAL_USER_LIST.length > 0) {
            const dbUser = GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(f.user_name).toLowerCase());
            
            if (dbUser) {
                let dept = dbUser.department || 'AM';
                let isTrainer = dbUser.role === 'trainer' || dept === 'TRAINER';
                
                let deptColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50';
                let deptName = 'AM';
                
                if (isTrainer) {
                    deptColor = 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/50';
                    deptName = 'ผู้สอน';
                } else if (dept === 'OD') {
                    deptColor = 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-800/50';
                    deptName = 'OD';
                }
                
                deptBadgeHtml += window.renderTemplate('tpl-fine-history-dept-badge', { deptColor, deptName });

                if (dbUser.allowed_shift) {
                    let sName = dbUser.allowed_shift.replace('กะ', '');
                    let sColor = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700';
                    
                    if (sName === 'เช้า') sColor = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800/50';
                    else if (sName === 'กลาง') sColor = 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800/50';
                    else if (sName === 'ดึก') sColor = 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/50';
                    else if (sName === 'all' || sName === 'อิสระ') { sName = 'อิสระ'; sColor = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/50'; }
                    
                    deptBadgeHtml += window.renderTemplate('tpl-fine-history-dept-badge', { deptColor: sColor, deptName: sName });
                }
            } else {
                deptBadgeHtml += window.renderTemplate('tpl-fine-history-dept-badge', { deptColor: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700', deptName: 'ไม่มีในระบบ' });
            }
        } else {
             deptBadgeHtml += window.renderTemplate('tpl-fine-history-dept-badge', { deptColor: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700', deptName: 'กำลังโหลด..' });
        }

        displayName = window.renderTemplate('tpl-fine-history-emp-display', { empName: f.user_name, deptBadgeHtml: deptBadgeHtml });

        let rawRule = f.rule_text || '';
        let cleanRule = rawRule.replace(/\s*\([^)]*(ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*\)/gi, '').trim();

        let ruleDisplay = cleanRule;
        const catMatch = cleanRule.match(/^\s*\[([^\]]+)\]\s*(.*)/);
        
        if (catMatch) {
            const cat = catMatch[1].trim();
            const detail = catMatch[2].trim();
            let catColor = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';

            if (cat === 'ออนไลน์') catColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50';
            else if (cat === 'WFH') catColor = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50';
            else if (cat === 'ออฟฟิศ') catColor = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50';

            ruleDisplay = window.renderTemplate('tpl-fine-history-rule-cat', { catColor, catName: cat, ruleDetail: detail });
        } else {
            ruleDisplay = window.renderTemplate('tpl-fine-history-rule-normal', { ruleDetail: cleanRule });
        }

        return window.renderTemplate('tpl-fine-history-row', {
            id: f.id,
            issueDateStr: issueDateStr,   
            offenseDateStr: offenseDateStr, 
            usernameDisplay: displayName,
            ruleText: ruleDisplay,
            noteHtml: noteHtml,
            amountDisplay: amountDisplay,
            imgDisplay: imgDisplay,
            issuedBy: f.issued_by || 'ไม่ระบุ'
        });
    }).join('');
    
    document.querySelectorAll('.admin-col').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
};

// =========================================
// 🌟 ฟังก์ชันสร้างข้อความสำหรับคัดลอก (Copy Text)
// =========================================
window.generateFineText = function() {
    const empInput = document.getElementById('fineEmpInput');
    const ruleSelect = document.getElementById('fineRuleSelect');
    
    if (!empInput || !ruleSelect) return;

    let empName = empInput.value.trim();
    const targetUser = (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST) ? GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(empName).toLowerCase()) : null;
    if (targetUser) empName = targetUser.username; 
    
    const ruleText = ruleSelect.value;
    
    if (!empName || !ruleText) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและหัวข้อกฎหมายก่อนครับ', 'warning');
    }

    const noteSelect = document.getElementById('fineNoteSelect') ? document.getElementById('fineNoteSelect').value : '';
    const noteInput = document.getElementById('fineNoteInput') ? document.getElementById('fineNoteInput').value.trim() : '';
    
    // 🌟 ดึงวันที่ทำผิดมาใส่ในข้อความ
    const offenseDateVal = document.getElementById('fineOffenseDate') ? document.getElementById('fineOffenseDate').value : '';
    let offenseDisplay = '';
    if (offenseDateVal) {
        const [y, m, d] = offenseDateVal.split('-');
        offenseDisplay = ` (เหตุเกิดวันที่ ${d}/${m}/${y})`;
    }
    
    let finalNote = noteSelect;
    if (noteInput) {
        if (finalNote) {
            if (finalNote.includes(' นาที')) {
                finalNote = finalNote.replace(' นาที', ` ${noteInput} นาที`);
            } else if (finalNote.includes(' ครั้ง')) {
                finalNote = finalNote.replace(' ครั้ง', ` ${noteInput} ครั้ง`);
            } else if (finalNote.includes(' วัน')) {
                finalNote = finalNote.replace(' วัน', ` ${noteInput} วัน`);
            } else if (finalNote.includes('...')) {
                finalNote = finalNote.replace('...', noteInput);
            } else {
                finalNote = `${finalNote} ${noteInput}`;
            }
            finalNote = finalNote.replace(/\s+/g, ' '); 
        } else {
            finalNote = noteInput;
        }
    }

    if (finalNote) {
        finalNote = finalNote.trim();
        while (finalNote.startsWith('(') && finalNote.endsWith(')')) {
            finalNote = finalNote.substring(1, finalNote.length - 1).trim();
        }
    }

    let cleanRule = ruleText.replace(/^\s*\[.*?\]\s*/, ''); 
    cleanRule = cleanRule.replace(/\s*\([^)]*(ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*\)/gi, '').trim();

    // 🌟 ประกอบร่างข้อความโดยใส่ offenseDisplay
    let resultText = `ปรับ ${empName} ${cleanRule}${offenseDisplay}`;
    
    if (finalNote) {
        resultText += ` (${finalNote})`;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    resultText += ` ${dd}/${mm}/${yyyy}`;

    const resultBox = document.getElementById('fineTextResultBox');
    const textArea = document.getElementById('fineTextResult');
    if (resultBox && textArea) {
        textArea.value = resultText;
        resultBox.classList.remove('hidden');
    }
};

window.copyFineText = function() {
    const textArea = document.getElementById('fineTextResult');
    if (!textArea || !textArea.value) return;
    
    navigator.clipboard.writeText(textArea.value).then(() => {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'คัดลอกข้อความแล้ว!' });
    }).catch(err => {
        Swal.fire('Error', 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ', 'error');
    });
};
