// ════════════════════════════════════════════════════════════════════
// 📦 fine/records.js — ส่วนที่ 3/4 ของระบบใบปรับ (แยกจาก fine.js เดิม 1,782 บรรทัด)
// เนื้อหา: บันทึกใบปรับ, ดึงข้อมูลและวาดตาราง
// ⚠️ ลำดับโหลด: fine/core → fine/rules → fine/records → fine/tools (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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
    
    // 🌟 ส่วนคำนวณค่าปรับ (รวมค่าปรับปกติ + ค่าปรับเปอร์เซ็นต์)
    let baseFineAmount = 0;
    let percentFineAmount = 0;
    let amountToSave = 0;
    
    if (penaltyType === 'nowage') {
        amountToSave = -1; // -1 แปลว่าไม่ได้ค่าแรง (ไม่เอามาบวกกับเปอร์เซ็นต์)
    } else {
        baseFineAmount = amountEl ? (parseInt(amountEl.value) || 0) : 0;
        
        // เช็คว่ามีการกดใช้งาน "คิดค่าปรับเพิ่มเติม (แบบ %)" หรือไม่
        const isPercentChecked = document.getElementById('fineUsePercent') ? document.getElementById('fineUsePercent').checked : false;
        if (isPercentChecked && typeof window.calculatePercentTotal === 'function') {
            percentFineAmount = window.calculatePercentTotal(); // ดึงยอดที่คำนวณไว้แล้วมาใช้
        }
        
        amountToSave = baseFineAmount + percentFineAmount; // บวกรวมยอดเพื่อบันทึก
    }
    
    // 🌟 ถ้ายอดเปอร์เซ็นต์ > 0 ให้เขียนอธิบายลงไปใน "หมายเหตุ" ด้วย
    if (percentFineAmount > 0) {
        const baseVol = document.getElementById('finePercentBaseAmount').value;
        const rateVal = document.getElementById('finePercentRate').value;
        const percentNoteStr = `[+ปรับ ${rateVal}% จากยอด ${parseInt(baseVol).toLocaleString('en-US')} = ${percentFineAmount.toLocaleString('en-US')} บาท]`;
        
        if (finalNote) {
            finalNote = `${finalNote} ${percentNoteStr}`;
        } else {
            finalNote = percentNoteStr;
        }
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
            offense_date: offenseDateVal 
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'ออกใบปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        // --- รีเซ็ตหน้าฟอร์มให้กลับเป็นเหมือนเดิม ---
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
        
        if (offenseDateInput) {
            const today = new Date();
            const offset = today.getTimezoneOffset() * 60000;
            offenseDateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
        }

        // 🌟 รีเซ็ตช่องเปอร์เซ็นต์
        const chkPercent = document.getElementById('fineUsePercent');
        if (chkPercent) {
            chkPercent.checked = false;
            window.togglePercentCalc();
        }

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};
// -----------------------------------------
// ดึงข้อมูลและวาดตาราง
// -----------------------------------------
window.fetchFinesData = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    const hasStatsPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_stats') : false;

    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isAdmin || hasViewAllPerm;
    const canViewStats = isAdmin || hasStatsPerm; // 🌟 เช็คสิทธิ์หน้าสถิติ

    const tbody = document.getElementById('fineTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10"><span class="material-icons animate-spin text-red-500">sync</span> โหลดข้อมูล...</td></tr>';

    try {
        if (typeof fetchUsers === 'function' && (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0)) {
            await fetchUsers(true);
        }

        let query = appDB.from('fines').select('*').order('created_at', { ascending: false });
        
        // 🌟 หัวใจสำคัญ: ถ้าไม่มีสิทธิ์ดูทั้งหมด และ ไม่มีสิทธิ์ดูสถิติ ถึงจะถูกล็อกให้ดึงจาก DB แค่ของตัวเอง
        if (!canViewAll && !canViewStats) {
            query = query.eq('user_name', currentUser.username);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineTable();
        
        // 🌟 สั่งให้หน้าสถิติอัปเดตข้อมูลด้วยทันทีหลังจากดึงเสร็จ
        if (typeof renderFineStats === 'function') renderFineStats();

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-500">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
    }
};

window.renderFineTable = function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const hasViewAllPerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_view_all') : false;
    
    const isAdmin = hasManagePerm || currentUser.role === 'manager' || currentUser.role === 'admin';
    const canViewAll = isAdmin || hasViewAllPerm;
    
    const tbody = document.getElementById('fineTableBody');
    const searchInput = document.getElementById('fineSearchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    
    const dateFilter = document.getElementById('fineDateFilter') ? document.getElementById('fineDateFilter').value : '';
    const deptFilter = document.getElementById('fineDeptFilter') ? document.getElementById('fineDeptFilter').value : 'ALL';
    const shiftFilter = document.getElementById('fineShiftFilter') ? document.getElementById('fineShiftFilter').value : 'ALL';
    
    if(!tbody) return;

    // 🌟 [เพิ่มโค้ดตรงนี้] 1. สร้าง Dictionary เก็บพนักงานไว้ก่อน
    const userDict = {};
    if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
        GLOBAL_USER_LIST.forEach(u => {
            if(u.username) userDict[String(u.username).toLowerCase()] = u;
        });
    }

    let baseData = globalFines;
    if (!canViewAll) {
        baseData = globalFines.filter(f => f.user_name === currentUser.username);
    }

    const filtered = baseData.filter(f => {
        const matchTerm = (f.user_name && f.user_name.toLowerCase().includes(term)) || 
                          (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
                          (f.note && f.note.toLowerCase().includes(term));
        
        let matchDept = true;
        let matchShift = true;
        let matchDate = true; 

        if (dateFilter && canViewAll) {
            let fDate = f.offense_date ? f.offense_date.split('T')[0] : f.created_at.split('T')[0];
            if (fDate !== dateFilter) matchDate = false;
        }

        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            // 🌟 [แก้โค้ดตรงนี้] 2. เรียกใช้จาก Dictionary ตอนทำการ Filter
            const dbUser = userDict[String(f.user_name).toLowerCase()];
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

        return matchTerm && matchDept && matchShift && matchDate;
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
    } else {
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
                const percentMatch = f.note ? f.note.match(/\[\+ปรับ.*?=\s*([\d,]+)\s*บาท\]/) : null;
                
                if (percentMatch) {
                    const percentAmt = parseInt(percentMatch[1].replace(/,/g, ''));
                    const baseAmt = f.amount - percentAmt;
                    
                    amountDisplay = `<div class="flex flex-col items-center gap-1.5">`;
                    if (baseAmt > 0) {
                        amountDisplay += `<span class="font-mono text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/50 whitespace-nowrap shadow-sm" title="ค่าปรับปกติ">฿${baseAmt.toLocaleString('en-US')}</span>`;
                    }
                    amountDisplay += `<span class="font-mono text-xs text-white font-bold bg-rose-500 px-2 py-1 rounded border border-rose-600 whitespace-nowrap shadow-md" title="บวกเพิ่มจาก % ความเสียหาย">+฿${percentAmt.toLocaleString('en-US')}</span>`;
                    amountDisplay += `</div>`;
                } else {
                    amountDisplay = window.renderTemplate('tpl-fine-history-amount-badge', { amount: f.amount.toLocaleString('en-US') });
                }
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

            // 🌟 [แก้โค้ดตรงนี้] 3. เรียกใช้จาก Dictionary ตอนจะวาดหน้าจอ (เร็วขึ้นมากๆ)
            const dbUser = userDict[String(f.user_name).toLowerCase()];
            
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

            displayName = window.renderTemplate('tpl-fine-history-emp-display', { empName: f.user_name, deptBadgeHtml: deptBadgeHtml });

            let rawRule = f.rule_text || '';
            let cleanRule = rawRule.replace(/\s*\([^)]*(ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*\)/gi, '').trim();

            const hasPercent = f.note && f.note.includes('[+ปรับ');

            let countBadge = '';
            if (hasPercent) {
                const offenseCount = globalFines.filter(past => 
                    String(past.user_name).toLowerCase() === String(f.user_name).toLowerCase() && 
                    past.rule_text === f.rule_text && 
                    new Date(past.created_at) <= new Date(f.created_at)
                ).length;

                countBadge = `<span class="bg-rose-500 text-white px-2 py-0.5 rounded border border-rose-600 text-[10px] font-black shadow-sm whitespace-nowrap">ครั้งที่ ${offenseCount}</span>`;
            }

            let ruleDisplay = cleanRule;
            const catMatch = cleanRule.match(/^\s*\[([^\]]+)\]\s*(.*)/);
            
            if (catMatch) {
                const cat = catMatch[1].trim();
                const detail = catMatch[2].trim();
                let catColor = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';

                if (cat === 'ออนไลน์') catColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50';
                else if (cat === 'WFH') catColor = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50';
                else if (cat === 'ออฟฟิศ') catColor = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50';

                ruleDisplay = `
                    <div class="flex items-start md:items-center gap-2 flex-col md:flex-row flex-wrap">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[10px] px-2 py-0.5 rounded border ${catColor} shadow-sm font-black whitespace-nowrap">${cat}</span>
                            ${countBadge}
                        </div>
                        <span class="text-red-600 dark:text-red-400 leading-snug">${detail}</span>
                    </div>
                `;
            } else {
                ruleDisplay = `
                    <div class="flex items-start gap-2 flex-col md:flex-row flex-wrap">
                        ${countBadge ? `<div class="flex items-center gap-1.5">${countBadge}</div>` : ''}
                        <span class="text-red-600 dark:text-red-400 leading-snug">${cleanRule}</span>
                    </div>
                `;
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
    }

    document.querySelectorAll('.admin-col').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    document.querySelectorAll('.view-all-col').forEach(el => {
        if (canViewAll) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
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

// =========================================