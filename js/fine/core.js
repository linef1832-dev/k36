// ════════════════════════════════════════════════════════════════════
// 📦 fine/core.js — ส่วนที่ 1/4 ของระบบใบปรับ (แยกจาก fine.js เดิม 1,782 บรรทัด)
// เนื้อหา: ระบบหลัก: init, สิทธิ์, ฟอร์มออกใบปรับ
// ⚠️ ลำดับโหลด: fine/core → fine/rules → fine/records → fine/tools (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System) V29 (รองรับระบบสถิติ + สิทธิ์ดูทั้งหมด)
// ==========================================
let globalFines = [];
let globalFineRules = [];
let globalFineNotes = []; 
let finesSubscription = null;

window.subscribeFinesChanges = function() {
    if (finesSubscription) {
        try { appDB.removeChannel(finesSubscription); } catch (e) {}
        finesSubscription = null;
    }

    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;

    finesSubscription = appDB.channel('fines-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fines' }, (payload) => {
            const newFine = payload.new;

            if (canViewAll || currentUser.username === newFine.user_name) {
                const isExist = globalFines.some(f => String(f.id) === String(newFine.id));
                if (!isExist) {
                    globalFines.unshift(newFine);
                    renderFineTable();

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
                renderFineTable();
            }
        })
        .subscribe();

    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(finesSubscription);
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
    "[ออนไลน์] บทที่ 2 ข้อที่ 1 ไม่ได้เข้าเช็คชื่อ",
    "[ออนไลน์] บทที่ 2 ข้อที่ 4 โทรติดต่อกัน 3 ครั้ง ไม่มีการรับสาย",
    "[ออนไลน์] บทที่ 2 ข้อที่ 3 ออกจากหน้างานโดยไม่แจ้งให้คนเบื้องบนทราบ",
    "[ออนไลน์] บทที่ 3 ข้อที่ 1 พฤติกรรมไม่เหมาะสม",
    "[ออนไลน์] บทที่ 3 ข้อที่ 2 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[ออนไลน์] บทที่ 3 ข้อที่ 4 ไม่ทำงานตามกระบวนการ",
    "[ออฟฟิศ] บทที่ 3 ข้อที่ 7 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[ออฟฟิศ] บทที่ 3 ข้อที่ 9 ไม่ทำงานตามกระบวนการ",
    "[ออฟฟิศ] บทที่ 3 ข้อที่ 2 พฤติกรรมที่ส่งผลกระทบต่องาน",
    "[WFH] บทที่ 2 ข้อที่ 1.1 มาทำงานเกินเวลาปกติ",
    "[WFH] บทที่ 3 ข้อที่ 1 ระหว่างเวลางานทำเรื่องไม่เกี่ยวกับงาน",
    "[WFH] บทที่ 3 ข้อที่ 6 ไม่ตั้งใจทำงาน ทำงานไม่รอบคอบ",
    "[WFH] บทที่ 3 ข้อที่ 8 ไม่ทำตามขั้นตอน"
];

window.initFineApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const hasStatsPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_stats') : false;
    
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;
    const canViewStats = isAdmin || hasStatsPerm;

    if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    const tabsContainer = document.getElementById('fineTabsContainer');
    
    const btnRules = document.getElementById('tabFineRules');
    const btnStats = document.getElementById('tabFineStats');
    const btnIssue = document.getElementById('tabFineIssue');

    if (btnRules) {
        if (isAdmin) { btnRules.classList.remove('hidden'); btnRules.style.display = ''; }
        else { btnRules.classList.add('hidden'); btnRules.style.display = 'none'; }
    }

    if (btnStats) {
        if (canViewStats) { btnStats.classList.remove('hidden'); btnStats.style.display = ''; }
        else { btnStats.classList.add('hidden'); btnStats.style.display = 'none'; }
    }
    
    if (isAdmin || canViewStats) {
        if(tabsContainer) tabsContainer.classList.remove('hidden'); 
    } else {
        if(tabsContainer) tabsContainer.classList.add('hidden'); 
    }

    if (isAdmin) {
        if(adminControls) adminControls.classList.remove('hidden');
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-12');
            tableContainer.classList.add('lg:col-span-8');
        }
        populateEmpSelect(); 
    } else {
        if(adminControls) adminControls.classList.add('hidden');
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-8');
            tableContainer.classList.add('lg:col-span-12');
        }
    }

    if (canViewAll) {
        const sub = document.getElementById('fineSubtitle');
        if(sub) sub.innerText = isAdmin ? "ออกใบปรับและดูประวัติทั้งหมด" : "ดูประวัติและสถิติใบปรับทั้งหมดในระบบ";
        const title = document.getElementById('tableFineTitle');
        if(title) title.innerHTML = '<span class="material-icons text-blue-500">list_alt</span> รายการใบปรับทั้งหมดในระบบ';
    } else {
        const sub = document.getElementById('fineSubtitle');
        if(sub) sub.innerText = "ตรวจสอบรายการใบปรับของคุณ";
        const title = document.getElementById('tableFineTitle');
        if(title) title.innerHTML = '<span class="material-icons text-blue-500">list_alt</span> ใบปรับของฉัน';
    }

    if (btnIssue) {
        btnIssue.innerHTML = isAdmin ? '<span class="material-icons text-sm">post_add</span> ออกใบปรับ & ประวัติ' : '<span class="material-icons text-sm">list_alt</span> ประวัติใบปรับ';
    }

   switchFineTab('issue');
    
    const offDateInput = document.getElementById('fineOffenseDate');
    if (offDateInput && !offDateInput.value) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        offDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
    }

    // 🌟 บังคับเซ็ตช่อง Filter ให้เป็นวันนี้ (เฉพาะคนที่มีสิทธิ์ดูทั้งหมดเท่านั้น)
    const filterDateInput = document.getElementById('fineDateFilter');
    if (filterDateInput && !filterDateInput.value) {
        if (canViewAll) {
            const today = new Date();
            const offset = today.getTimezoneOffset() * 60000;
            filterDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
        } else {
            filterDateInput.value = ''; // พนักงานทั่วไปให้เป็นค่าว่างเพื่อดูประวัติได้ทุกวัน
        }
    }

    // 🚀 ดึง 3 ชุดข้อมูลขนานกัน (rules + notes + fines) เพราะอิสระต่อกัน
    await Promise.all([loadFineRules(), loadFineNotes(), fetchFinesData()]);
    subscribeFinesChanges();
};

window.switchFineTab = function(tabName) {
    const issueTab = document.getElementById('fineContent_issue');
    const rulesTab = document.getElementById('fineContent_rules');
    const statsTab = document.getElementById('fineContent_stats'); 
    const btnIssue = document.getElementById('tabFineIssue');
    const btnRules = document.getElementById('tabFineRules');
    const btnStats = document.getElementById('tabFineStats'); 

    const inactiveBtnClass = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    
    if(issueTab) { issueTab.classList.add('hidden'); issueTab.classList.remove('grid'); }
    if(rulesTab) { rulesTab.classList.add('hidden'); rulesTab.classList.remove('block'); }
    if(statsTab) { statsTab.classList.add('hidden'); statsTab.classList.remove('block'); }
    
    if(btnIssue) btnIssue.className = inactiveBtnClass;
    if(btnRules) btnRules.className = inactiveBtnClass;
    if(btnStats) btnStats.className = inactiveBtnClass;

    if (tabName === 'issue') {
        if(issueTab) { issueTab.classList.remove('hidden'); issueTab.classList.add('grid'); }
        if(btnIssue) btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-red-500 text-white shadow-md flex items-center gap-1 border border-red-400";
    } else if (tabName === 'rules') {
        if(rulesTab) { rulesTab.classList.remove('hidden'); rulesTab.classList.add('block'); }
        if(btnRules) btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-amber-500 text-slate-900 shadow-md flex items-center gap-1 border border-amber-400";
    } else if (tabName === 'stats') {
        if(statsTab) { statsTab.classList.remove('hidden'); statsTab.classList.add('block'); }
        if(btnStats) btnStats.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)] flex items-center gap-1 border border-rose-400";
        
        if(typeof renderFineStatsMonthOptions === 'function') renderFineStatsMonthOptions();
        if(typeof renderFineStats === 'function') renderFineStats();
    }
};

window.renderFineStatsMonthOptions = function() {
    const select = document.getElementById('fineStatsMonth');
    if (!select || select.options.length > 1) return; 

    const months = new Set();
    globalFines.forEach(f => {
        const d = f.offense_date ? new Date(f.offense_date) : new Date(f.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${y}-${m}`);
    });

    const sortedMonths = Array.from(months).sort().reverse(); 
    const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

    let html = '<option value="all">รวมทุกเดือน (All Time)</option>';
    sortedMonths.forEach(ym => {
        const [y, m] = ym.split('-');
        html += `<option value="${ym}">${thaiMonths[parseInt(m)-1]} ${parseInt(y)+543}</option>`;
    });
    select.innerHTML = html;

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (sortedMonths.includes(currentYM)) {
        select.value = currentYM;
    }
};

window.renderFineStats = function() {
    const container = document.getElementById('fineStatsLeaderboard');
    if (!container) return;

    const monthFilter = document.getElementById('fineStatsMonth') ? document.getElementById('fineStatsMonth').value : 'all';
    const deptFilter = document.getElementById('fineStatsDept') ? document.getElementById('fineStatsDept').value : 'ALL';
    const shiftFilter = document.getElementById('fineStatsShift') ? document.getElementById('fineStatsShift').value : 'ALL';

    // 🌟 [เพิ่มโค้ดตรงนี้] 1. สร้าง Dictionary เก็บข้อมูลพนักงานไว้ก่อนเริ่มลูป
    const userDict = {};
    if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
        GLOBAL_USER_LIST.forEach(u => {
            if(u.username) userDict[String(u.username).toLowerCase()] = u;
        });
    }

    let filteredFines = globalFines.filter(f => {
        if (monthFilter !== 'all') {
            const d = f.offense_date ? new Date(f.offense_date) : new Date(f.created_at);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym !== monthFilter) return false;
        }

        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            // 🌟 [แก้โค้ดตรงนี้] 2. ดึงข้อมูลจาก Dictionary แทนการใช้ GLOBAL_USER_LIST.find()
            let dbUser = userDict[String(f.user_name).toLowerCase()];
            
            if (!dbUser) return false; 

            let uDept = dbUser.department || 'AM';
            let isTrainer = dbUser.role === 'trainer' || uDept === 'TRAINER';
            if (isTrainer) uDept = 'TRAINER';

            if (deptFilter !== 'ALL' && uDept !== deptFilter) return false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) return false;
        }
        return true;
    });

    let totalAmountForStats = 0; 

    if (filteredFines.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 font-bold bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">ไม่มีประวัติโดนปรับในเงื่อนไขที่เลือกครับ 🎉</div>';
        
        if(document.getElementById('fineStatsTotalAmount')) {
            document.getElementById('fineStatsTotalAmount').innerHTML = '';
        }
        return;
    }

    const statsMap = {};
    filteredFines.forEach(f => {
        const name = f.user_name;
        if (!statsMap[name]) {
            statsMap[name] = { count: 0, amount: 0 };
        }
        statsMap[name].count++;
        if (f.amount > 0) {
            statsMap[name].amount += Number(f.amount);
            totalAmountForStats += Number(f.amount); 
        }
    });

    const statsTotalEl = document.getElementById('fineStatsTotalAmount');
    if (statsTotalEl) {
        statsTotalEl.innerHTML = `<div class="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm ml-4 uppercase tracking-wider flex items-center gap-2">ยอดรวมค่าปรับ: <span class="font-mono text-base font-black">฿${totalAmountForStats.toLocaleString('en-US')}</span></div>`;
    }

    const sortedStats = Object.keys(statsMap).map(name => ({
        name: name,
        count: statsMap[name].count,
        amount: statsMap[name].amount
    })).sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return b.count - a.count;
    });

    container.innerHTML = sortedStats.map((stat, index) => {
        const rank = index + 1;
        let medalClass = 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-slate-600';
        
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
    
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
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