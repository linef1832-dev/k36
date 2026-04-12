// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System) V29 (เพิ่มสิทธิ์ดูสถิติทั้งหมด)
// ==========================================
let globalFines = [];
let globalFineRules = [];
let globalFineNotes = []; 
let finesSubscription = null;

window.subscribeFinesChanges = function() {
    if (finesSubscription) return;

    // 🌟 ตรวจสอบสิทธิ์ว่ามีสิทธิ์ดูทั้งหมดหรือไม่
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;

    finesSubscription = appDB.channel('fines-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fines' }, (payload) => {
            const newFine = payload.new;

            // 🌟 ถ้าเป็นคนที่ดูทั้งหมดได้ หรือ เป็นใบปรับของตัวเอง
            if (canViewAll || currentUser.username === newFine.user_name) {
                const isExist = globalFines.some(f => String(f.id) === String(newFine.id));
                if (!isExist) {
                    globalFines.unshift(newFine);
                    renderFineTable(); // รีเฟรชตาราง

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
    // 🌟 ดึงสิทธิ์มาเช็ค
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;

    if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    const tabsContainer = document.getElementById('fineTabsContainer');
    
    // ควบคุมฟอร์มออกใบปรับ (เฉพาะคนมีสิทธิ์ Manage)
    if (isAdmin) {
        if(adminControls) adminControls.classList.remove('hidden');
        if(tabsContainer) tabsContainer.classList.remove('hidden'); 
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-12');
            tableContainer.classList.add('lg:col-span-8');
        }
        populateEmpSelect(); 
    } else {
        if(adminControls) adminControls.classList.add('hidden');
        if(tabsContainer) tabsContainer.classList.add('hidden'); 
        if(tableContainer) {
            tableContainer.classList.remove('lg:col-span-8');
            tableContainer.classList.add('lg:col-span-12');
        }
    }

    // ควบคุมข้อความและ Title
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

    switchFineTab('issue');
    
    const offDateInput = document.getElementById('fineOffenseDate');
    if (offDateInput && !offDateInput.value) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        offDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
    }

    await loadFineRules();
    await loadFineNotes(); 
    await fetchFinesData(); // ไม่ต้องส่งพารามิเตอร์แล้ว เพราะให้มันไปเช็คสิทธิ์เองข้างใน
    subscribeFinesChanges();
};

window.fetchFinesData = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;

    const tbody = document.getElementById('fineTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10"><span class="material-icons animate-spin text-red-500">sync</span> โหลดข้อมูล...</td></tr>';

    try {
        if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
            await fetchUsers(true);
        }

        let query = appDB.from('fines').select('*').order('created_at', { ascending: false });
        
        // 🌟 ถ้าดูทั้งหมดไม่ได้ ให้ค้นหาเฉพาะชื่อตัวเอง
        if (!canViewAll) {
            query = query.eq('user_name', currentUser.username);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineTable();

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-500">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
    }
};

window.renderFineTable = function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    
    const isAdmin = hasManagePerm || currentUser.role === 'manager' || currentUser.role === 'admin';
    const canViewAll = isAdmin || hasViewAllPerm;
    
    // จัดการการซ่อน/โชว์ คอลัมน์ที่เฉพาะ Admin หรือ View All
    document.querySelectorAll('.admin-col').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    document.querySelectorAll('.view-all-col').forEach(el => {
        if (canViewAll) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    
    const tbody = document.getElementById('fineTableBody');
    const searchInput = document.getElementById('fineSearchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    
    const deptFilter = document.getElementById('fineDeptFilter') ? document.getElementById('fineDeptFilter').value : 'ALL';
    const shiftFilter = document.getElementById('fineShiftFilter') ? document.getElementById('fineShiftFilter').value : 'ALL';
    
    if(!tbody) return;

    const filtered = globalFines.filter(f => {
        const matchTerm = (f.user_name && f.user_name.toLowerCase().includes(term)) || 
                          (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
                          (f.note && f.note.toLowerCase().includes(term));
        
        let matchDept = true;
        let matchShift = true;

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
};

// ... โค้ดส่วนหลังจากนี้ (deleteFine, generateFineText ฯลฯ) ปล่อยไว้เหมือนเดิมครับ
    
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
