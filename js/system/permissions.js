// ════════════════════════════════════════════════════════════════════
// 📦 system/permissions.js — ส่วนที่ 3/4 ของระบบแกนกลาง (จัดการพนักงาน/สิทธิ์/ตั้งค่า) (แยกจาก system_core.js เดิม 3,170 บรรทัด)
// เนื้อหา: ระบบสิทธิ์เมนูทั้งหมด, ซ่อน/โชว์เมนูซ้ายตามสิทธิ์, เพิ่มรอบเวลาเอง
// ⚠️ ลำดับโหลด: system/users → system/manage → system/permissions → system/admin
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🟢 ระบบสิทธิ์เมนู (ดีไซน์พรีเมียม & มืออาชีพ)
// =========================================================
let MENU_PERMS = {};

const PERM_GROUPS = [
    {
        id: 'page_dashboard', name: 'หน้าหลักลงเวลา', icon: 'home', theme: 'blue',
        items: [
            {id: 'dashboard', name: 'เข้าหน้าหลักลงเวลา', isSub: false},
            {id: 'dashboard_view_all_shifts', name: 'ลงเวลาได้ทุกกะ (เห็นทั้ง 3 กะ)', isSub: true},
            {id: 'dashboard_bypass_rules', name: 'ลงเวลาได้ไม่ติดเงื่อนไข (ไม่สนเวลาเปิด/ไม่สนตารางเวร)', isSub: true}
        ]
    },
    {
        id: 'page_breaktable', name: 'ตารางลงเวลาพัก (ใครลงกินข้าว)', icon: 'table_view', theme: 'cyan',
        items: [
            {id: 'breaktable', name: 'เข้าหน้าตารางลงเวลาพัก', isSub: false},
            {id: 'breaktable_export', name: 'โหลด Excel ทั้งวัน', isSub: true},
            {id: 'schedule_delete_any', name: 'ลบรายการลงพักของคนอื่น', isSub: true}
        ]
    },
    {
        id: 'page_break_audit', name: 'ตรวจเวลาลุกจากที่นั่ง (Telegram)', icon: 'timer', theme: 'amber',
        items: [
            {id: 'break_audit', name: 'เข้าหน้าตรวจเวลาลุกจากที่นั่ง', isSub: false},
            {id: 'break_audit_export', name: 'โหลด CSV สรุปรายวัน', isSub: true}
        ]
    },
    {
        id: 'page_leave', name: 'หน้าวันหยุด / ลางาน', icon: 'event_busy', theme: 'rose',
        items: [
            {id: 'leave', name: 'เข้าหน้าตารางวันหยุด', isSub: false},
            {id: 'leave_request', name: 'กดจอง/ยกเลิก', isSub: true},
            {id: 'leave_history', name: 'ดูประวัติ', isSub: true},
            {id: 'leave_export', name: 'โหลด Excel', isSub: true},
            {id: 'leave_view_any_month', name: 'ดูข้ามเดือน (ไม่ถูกล็อกเดือน)', isSub: true},
            {id: 'leave_am', name: '[ดูหน้า] แท็บ AM', isSub: true},
            {id: 'leave_od', name: '[ดูหน้า] แท็บ OD', isSub: true},
            {id: 'leave_new', name: '[ดูหน้า] พนักงานใหม่', isSub: true},
            {id: 'leave_trainer', name: '[ดูหน้า] ผู้สอน', isSub: true},
            {id: 'leave_manage_am', name: '⚙️ จัดการ AM', isSub: true},
            {id: 'leave_manage_od', name: '⚙️ จัดการ OD', isSub: true},
            {id: 'leave_manage_new', name: '⚙️ จัดการ พนง.ใหม่', isSub: true},
            {id: 'leave_manage_trainer', name: '⚙️ จัดการ ผู้สอน', isSub: true}
        ]
    },
    {
        id: 'page_gallery', name: 'คลังรูปภาพ', icon: 'photo_library', theme: 'pink',
        items: [
            {id: 'gallery', name: 'เข้าหน้าคลังรูปภาพ', isSub: false},
            {id: 'gallery_tab_bonus', name: 'ดูแท็บ "โบนัสไทม์"', isSub: true},
            {id: 'gallery_tab_reach', name: 'ดูแท็บ "รีชเมนู"', isSub: true},
            {id: 'gallery_tab_card',  name: 'ดูแท็บ "การ์ดเมนู"', isSub: true},
            {id: 'gallery_tab_logo',  name: 'ดูแท็บ "LOGO"', isSub: true},
            {id: 'gallery_upload', name: 'อัปโหลดรูปภาพ', isSub: true},
            {id: 'gallery_delete', name: 'ลบรูปภาพ', isSub: true},
            {id: 'gallery_rename', name: 'เปลี่ยนชื่อรูป', isSub: true}
        ]
    },
    {
        id: 'page_logo_editor', name: 'แต่งรูป / เปลี่ยนโลโก้', icon: 'photo_filter', theme: 'fuchsia',
        items: [
            {id: 'logo_editor', name: 'เข้าหน้าแต่งรูป', isSub: false},
            {id: 'logo_editor_erase', name: 'ลบโลโก้เดิม (เติมพื้นที่)', isSub: true},
            {id: 'logo_editor_add_logo', name: 'ใส่โลโก้ใหม่', isSub: true},
            {id: 'logo_editor_download', name: 'ดาวน์โหลดรูปที่แต่ง', isSub: true}
        ]
    },
    {
        id: 'page_password', name: 'รหัสผ่าน', icon: 'vpn_key', theme: 'amber',
        items: [
            {id: 'password', name: 'เข้าหน้าจัดการรหัสผ่าน', isSub: false},
            {id: 'password_view_all', name: 'ดูรหัสผ่านของพนักงานทุกคน', isSub: true}
        ]
    },
    {
    id: 'page_sop', name: 'คู่มือการทำงาน (OD)', icon: 'rule_folder', theme: 'rose',
    items: [
        {id: 'sop', name: 'เข้าหน้าคู่มือ SOP', isSub: false},
        {id: 'sop_manage', name: 'เพิ่ม/แก้/ลบ กฎ', isSub: true},
        {id: 'sop_send_tg', name: 'ส่งกฎเข้า Telegram', isSub: true}
    ]
    },
    {
        id: 'page_sheet', name: 'ตารางงาน (Sheets)', icon: 'table_view', theme: 'emerald',
        items: [
            {id: 'sheet', name: 'เข้าตารางงาน (Sheets)', isSub: false},
            {id: 'sheet_manage', name: 'เพิ่ม/แก้/ลบ ลิงก์', isSub: true}
        ]
    },
    {
        id: 'page_withdrawal_report', name: 'รับเคส Telegram', icon: 'receipt_long', theme: 'emerald',
        items: [
            {id: 'withdrawal_report',         name: 'เข้าหน้ารับเคส Telegram', isSub: false},
            {id: 'withdrawal_report_stats',   name: 'ดูแท็บ สถิติ',            isSub: true},
            {id: 'withdrawal_report_summary', name: 'ดูแท็บ สรุปรวม',          isSub: true},
            {id: 'withdrawal_report_log',     name: 'ดูแท็บ Log',              isSub: true},
            {id: 'withdrawal_report_bot',     name: 'ดูแท็บ บอท (ตั้งค่า)',    isSub: true},
        ]
    },
    {
        id: 'page_swap', name: 'สลับกะการทำงาน', icon: 'swap_horiz', theme: 'orange',
        items: [
            {id: 'swap', name: 'เข้าหน้าสลับกะการทำงาน', isSub: false},
            {id: 'swap_manage', name: 'แอดมินจัดการสลับกะ', isSub: true}
        ]
    },
    {
        id: 'page_slip_check', name: 'ตรวจสอบสลิป', icon: 'qr_code_scanner', theme: 'blue',
        items: [
            {id: 'slip_check', name: 'เข้าหน้าตรวจสอบสลิป', isSub: false},
            {id: 'slip_check_delete', name: 'ลบประวัติสลิป', isSub: true}
        ]
    },
    {
        id: 'page_duty', name: 'จัดหน้าที่ / เวร', icon: 'assignment_ind', theme: 'indigo',
        items: [
            {id: 'duty', name: 'เข้าหน้าจัดหน้าที่ / เวร', isSub: false},
            {id: 'duty_manage_am', name: '⚙️ จัดการของ AM', isSub: true},
            {id: 'duty_manage_od', name: '⚙️ จัดการของ OD', isSub: true},
            {id: 'duty_manage_amql', name: '⚙️ จัดการของผู้สอน AM', isSub: true},
            {id: 'duty_manage_odql', name: '⚙️ จัดการของผู้สอน OD', isSub: true},
            {id: 'duty_manage', name: 'สุ่มเวร & ตั้งค่าหัวข้อ (รวม)', isSub: true},
            {id: 'duty_stay_pin', name: '📌 ล็อกให้อยู่เว็บเดิมข้ามวัน', isSub: true}
        ]
    },
    {
        id: 'page_telegram', name: 'กลุ่มงาน (Telegram)', icon: 'near_me', theme: 'sky',
        items: [
            {id: 'telegram', name: 'เข้าหน้ากลุ่มงาน (Telegram)', isSub: false},
            {id: 'telegram_manage', name: 'จัดการลิงก์กลุ่มงาน (ปุ่มแอดมิน)', isSub: true}
        ]
    },
    {
        id: 'page_files', name: 'คลังไฟล์ / โปรแกรม', icon: 'folder_zip', theme: 'teal',
        items: [
            {id: 'files', name: 'เข้าหน้าคลังไฟล์ / โปรแกรม', isSub: false},
            {id: 'files_manage', name: 'แอดมินคลังไฟล์', isSub: true}
        ]
    },
    {
        id: 'page_od_config', name: 'OD Form Bot (ตั้งค่าส่วนขยาย)', icon: 'extension', theme: 'indigo',
        items: [
            {id: 'od_config', name: 'เข้าหน้าตั้งค่า OD Form Bot', isSub: false},
        ]
    },
    {
        id: 'page_summary', name: 'สรุปยอดทำรายการ', icon: 'query_stats', theme: 'purple',
        items: [
            {id: 'summary', name: 'เข้าหน้าสรุปยอดทำรายการ', isSub: false}
        ]
    },
    {
        id: 'page_fine', name: 'ระบบใบปรับ', icon: 'gavel', theme: 'red',
        items: [
            {id: 'fine', name: 'เข้าระบบใบปรับพนักงาน', isSub: false},
            {id: 'fine_manage', name: 'ออกใบปรับ / จัดการกฎ', isSub: true},
            {id: 'fine_view_all', name: 'ดูตารางของทุกคน', isSub: true},
            {id: 'fine_stats', name: 'ดูหน้าสถิติ', isSub: true}
        ]
    },
    {
        id: 'page_kbiz', name: 'จัดการบอท K BIZ', icon: 'smart_toy', theme: 'emerald',
        items: [
            {id: 'kbiz', name: 'เข้าหน้าจัดการบอท K BIZ', isSub: false}
        ]
    },
    {
        id: 'page_ip_check', name: 'ตรวจสอบ IP พนักงาน', icon: 'public', theme: 'cyan',
        items: [
            {id: 'ip_check', name: 'เข้าหน้าตรวจสอบ IP พนักงาน', isSub: false},
            {id: 'ip_view',  name: 'ดู IP พนักงานคนอื่น', isSub: true}
        ]
    },
    {
        id: 'page_discord', name: 'เครื่องมือ DISCORD', icon: 'discord', theme: 'indigo',
        items: [
            {id: 'discord', name: 'เข้าหน้าต่างระบบ DISCORD', isSub: false},
            {id: 'ds_spy', name: 'Spy Monitor', isSub: true},
            {id: 'ds_move', name: 'ย้ายห้อง', isSub: true},
            {id: 'ds_checkin', name: 'เช็คชื่อ', isSub: true},
            {id: 'ds_manage', name: 'ฐานข้อมูล DS', isSub: true},
            {id: 'ds_log', name: 'ดูประวัติ DS', isSub: true},
            {id: 'ds_sendmsg', name: 'ส่งข้อความ', isSub: true}
        ]
    },
        {
        id: 'page_admin', name: 'เครื่องมือผู้จัดการ', icon: 'manage_accounts', theme: 'red',
        items: [
            {id: 'admin', name: 'เข้าเครื่องมือผู้จัดการ (Admin)', isSub: false},
            {id: 'ip_allow', name: 'ตั้งค่า IP ที่อนุญาต', isSub: false},
            {id: 'admin_settings', name: 'ตั้งค่าระบบ', isSub: true},
            {id: 'admin_users', name: 'จัดการพนักงาน', isSub: true},
            {id: 'admin_perms', name: 'สิทธิ์เมนู', isSub: true},
            {id: 'admin_info', name: 'ประวัติจัดหน้าที่', isSub: true},
            {id: 'admin_logs', name: 'ประวัติระบบ (ปุ่มซ้ายล่าง)', isSub: true},
            {id: 'bell', name: 'เข้าหน้ากระดิ่งเรียกพนักงาน', isSub: false},
            {id: 'bell_ring', name: 'กดเรียกกระดิ่ง', isSub: true},
            {id: 'bell_history', name: 'ดูประวัติ + ดาวน์โหลด CSV', isSub: true},
            {id: 'bell_app_update', name: 'อัปโหลดเวอร์ชันใหม่ของแอปพนักงาน', isSub: true},
            {id: 'bell_sound', name: 'เปลี่ยนเสียงเตือนกระดิ่ง', isSub: true}
        ]
    }
];

// =========================================================
// 🟢 หน้าตั้งค่าสิทธิ์ โฉมใหม่ (V2) — เลิกใช้ป๊อปอัปลอย
// วิธีใช้: เลือกแผนก (แถวบน) → เลือก Role (แถวสอง) → เปิด/ปิดสวิตช์ → กดบันทึก (ปุ่มเดียว แถบล่าง)
// ข้อมูลเก็บรูปเดิมเป๊ะ: MENU_PERMS["แผนก_ROLE"] = [รายชื่อเมนู] — สิทธิ์เก่าที่เคยตั้งไว้ใช้ได้ต่อทันที
// =========================================================
const PERM_THEME_HEX = {
    'blue':'#3b82f6','rose':'#f43f5e','pink':'#ec4899','amber':'#f59e0b','green':'#22c55e',
    'orange':'#f97316','indigo':'#6366f1','sky':'#0ea5e9','emerald':'#10b981','purple':'#a855f7',
    'red':'#ef4444','teal':'#14b8a6','cyan':'#06b6d4','fuchsia':'#d946ef'
};

// สถานะหน้าจอ: แผนก/Role ที่เลือกอยู่ + ฉบับร่างที่กำลังแก้ (ยังไม่บันทึก)
window.permUI = window.permUI || { dept: null, draft: [], dirty: false };

function _permReadMenuPerms() {
    try {
        if (typeof SETTINGS['dept_menu_rules'] === 'string') MENU_PERMS = JSON.parse(SETTINGS['dept_menu_rules']);
        else if (SETTINGS['dept_menu_rules']) MENU_PERMS = SETTINGS['dept_menu_rules'];
        else MENU_PERMS = {};
    } catch(e) { MENU_PERMS = {}; }
}


function _permSaveSel() {
    try { window.safeSetItem('perm_ui_sel', JSON.stringify({ dept: permUI.dept })); } catch(e) {}
}

// สลับแผนก/Role — ถ้ามีของแก้ค้างยังไม่บันทึก จะถามก่อน กันงานหาย
window.permSwitch = async function(dept) {
    if (window.permUI.dirty) {
        const r = await Swal.fire({
            title: 'ยังไม่ได้บันทึก',
            text: 'สิทธิ์ชุดนี้มีการแก้ไขค้างอยู่ ถ้าสลับไปชุดอื่นตอนนี้ ที่แก้ไว้จะหายนะ',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'สลับเลย (ทิ้งที่แก้)', cancelButtonText: 'อยู่ก่อน เดี๋ยวกดบันทึก',
            confirmButtonColor: '#ef4444'
        });
        if (!r.isConfirmed) return;
    }
    window.permUI.dept = dept;
    window.permUI.dirty = false;
    _permSaveSel();
    renderPermsTable();
};

// เปิด/ปิดสวิตช์ 1 ตัว — อัปเดตฉบับร่าง + ตัวนับ ไม่วาดหน้าใหม่ (จอไม่กระตุก)
window.permToggleItem = function(itemId, checked) {
    const d = window.permUI.draft;
    if (checked) { if (!d.includes(itemId)) d.push(itemId); }
    else { const i = d.indexOf(itemId); if (i > -1) d.splice(i, 1); }
    window.permUI.dirty = true;
    _permRefreshCounts();
};

// ปุ่ม "ทั้งหมด/ล้าง" รายหมวด
window.permGroupSetAll = function(groupId, on) {
    const g = PERM_GROUPS.find(x => x.id === groupId);
    if (!g) return;
    g.items.forEach(item => {
        const cb = document.getElementById('permCb_' + item.id);
        if (cb) cb.checked = !!on;
        const d = window.permUI.draft;
        if (on) { if (!d.includes(item.id)) d.push(item.id); }
        else { const i = d.indexOf(item.id); if (i > -1) d.splice(i, 1); }
    });
    window.permUI.dirty = true;
    _permRefreshCounts();
};

// คัดลอกสิทธิ์จากชุดอื่นมาใส่ชุดที่กำลังแก้ (เช่น ก๊อปของ AM_STAFF มาเป็นฐานให้ ODQL_TRAINER)
window.permCopyFrom = async function(srcKey) {
    if (!srcKey) return;
    const srcPerms = MENU_PERMS[srcKey] || [];
    const r = await Swal.fire({
        title: 'คัดลอกสิทธิ์?',
        html: `เอาสิทธิ์ทั้งหมดของ <b class="text-blue-400">${srcKey.replace('_', ' · ')}</b> (${srcPerms.length} รายการ)<br>มาทับชุด <b class="text-emerald-400">${permUI.dept}</b> ที่เปิดอยู่`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'คัดลอกเลย', cancelButtonText: 'ยกเลิก'
    });
    document.getElementById('permCopySelect').value = '';
    if (!r.isConfirmed) return;
    window.permUI.draft = [...srcPerms];
    window.permUI.dirty = true;
    _permRenderGroups();
    _permRefreshCounts();
};

// ช่องค้นหา — พิมพ์แล้วซ่อนหมวดที่ไม่เกี่ยว
window.permFilter = function(q) {
    q = (q || '').toLowerCase().trim();
    document.querySelectorAll('.perm-group-card').forEach(card => {
        card.style.display = (!q || (card.getAttribute('data-search') || '').includes(q)) ? '' : 'none';
    });
};

// อัปเดตตัวเลขนับ + แถบ "ยังไม่บันทึก" (ไม่วาดหน้าใหม่)
function _permRefreshCounts() {
    const d = window.permUI.draft;
    let total = 0, all = 0;
    PERM_GROUPS.forEach(g => {
        const n = g.items.filter(i => d.includes(i.id)).length;
        total += n; all += g.items.length;
        const badge = document.getElementById('permCnt_' + g.id);
        if (badge) {
            badge.textContent = n + '/' + g.items.length;
            badge.className = 'pm-cnt' + (n === g.items.length ? ' full' : (n > 0 ? ' some' : ''));
        }
    });
    const totalEl = document.getElementById('permTotalCnt');
    if (totalEl) totalEl.textContent = total;
    const bar = document.getElementById('permTotalBar');
    if (bar) bar.style.width = (all ? Math.round(total / all * 100) : 0) + '%';
    const dirtyEl = document.getElementById('permDirtyHint');
    if (dirtyEl) dirtyEl.style.display = window.permUI.dirty ? 'flex' : 'none';
    const saveBtn = document.getElementById('permSaveBtn');
    if (saveBtn) saveBtn.classList.toggle('dirty', !!window.permUI.dirty);
}

// วาดเฉพาะกริดการ์ดหมวดสิทธิ์
function _permRenderGroups() {
    const grid = document.getElementById('permGroupsGrid');
    if (!grid) return;
    const d = window.permUI.draft;
    let html = '';

    PERM_GROUPS.forEach(g => {
        const hex = PERM_THEME_HEX[g.theme] || PERM_THEME_HEX['blue'];
        const searchText = (g.name + ' ' + g.items.map(i => i.name).join(' ')).toLowerCase();
        const n = g.items.filter(i => d.includes(i.id)).length;
        const cntCls = 'pm-cnt' + (n === g.items.length ? ' full' : (n > 0 ? ' some' : ''));

        let itemsHtml = '';
        g.items.forEach(item => {
            const on = d.includes(item.id);
            itemsHtml += `
                <label class="perm-row ${item.isSub ? 'perm-row-sub' : 'perm-row-main'}">
                    <span class="perm-row-name">${item.name}</span>
                    <input type="checkbox" id="permCb_${item.id}" class="perm-sw-input" ${on ? 'checked' : ''}
                           onchange="permToggleItem('${item.id}', this.checked)">
                    <span class="perm-sw"></span>
                </label>`;
        });

        html += `
            <div class="perm-group-card" data-search="${searchText}" style="--gc:${hex}">
                <div class="pm-gh">
                    <span class="pm-gi"><span class="material-icons">${g.icon}</span></span>
                    <span class="pm-gn">${g.name}</span>
                    <span id="permCnt_${g.id}" class="${cntCls}">${n}/${g.items.length}</span>
                </div>
                <div class="pm-gb">${itemsHtml}</div>
                <div class="pm-gf">
                    <button type="button" onclick="permGroupSetAll('${g.id}', true)" class="pm-link on"><span class="material-icons">done_all</span>เปิดทั้งหมวด</button>
                    <button type="button" onclick="permGroupSetAll('${g.id}', false)" class="pm-link"><span class="material-icons">remove_done</span>ปิดทั้งหมวด</button>
                </div>
            </div>`;
    });
    grid.innerHTML = html;
}

// 🌟 ฟังก์ชันหลัก — ชื่อเดิม (renderPermsTable) เพื่อให้ไฟล์อื่นที่เรียกอยู่ใช้ได้โดยไม่ต้องแก้
window.renderPermsTable = function() {
    _permReadMenuPerms();
    const root = document.getElementById('permBuilderRoot');
    if (!root) return;

    const depts = typeof window.getSystemDepts === 'function' ? window.getSystemDepts() : ['AM', 'OD', 'AMQL'];

    // กู้ค่าที่เคยเลือกไว้ (จำข้ามการรีเฟรช)
    if (!permUI.dept) {
        try {
            const saved = JSON.parse(localStorage.getItem('perm_ui_sel') || '{}');
            if (saved.dept) permUI.dept = saved.dept;
        } catch(e) {}
    }
    if (!depts.includes(permUI.dept)) permUI.dept = depts[0] || 'AM';

    // 🔑 สิทธิ์ผูกกับ "แผนก" อย่างเดียว — ตำแหน่ง (role) ไม่เกี่ยวแล้ว
    const key = permUI.dept;
    permUI.draft = [...(MENU_PERMS[key] || [])];
    permUI.dirty = false;

    // รายการแผนก (ซ้าย) — บอกจำนวนสิทธิ์ที่เปิดของแต่ละแผนกด้วย
    const allItems = PERM_GROUPS.reduce((n, g) => n + g.items.length, 0);
    let deptList = '';
    depts.forEach(dept => {
        const active = dept === permUI.dept;
        const cnt = (MENU_PERMS[dept] || []).length;
        deptList += `
            <div class="pm-dept ${active ? 'active' : ''}" onclick="permSwitch('${dept}')" title="ตั้งสิทธิ์ของแผนก ${dept}">
                <span class="pm-dn">${dept}</span>
                <span class="pm-dc">${cnt}</span>
                <span class="pm-dt">
                    <button type="button" onclick="event.stopPropagation(); renameAnyDept('${dept}')" title="เปลี่ยนชื่อแผนก"><span class="material-icons">edit</span></button>
                    ${!['AM','OD','AMQL'].includes(dept) ? `<button type="button" class="del" onclick="event.stopPropagation(); deleteCustomPermDept('${dept}')" title="ลบแผนก"><span class="material-icons">delete_outline</span></button>` : ''}
                </span>
            </div>`;
    });

    // ตัวเลือก "คัดลอกจาก" — โชว์เฉพาะชุดที่มีสิทธิ์ตั้งไว้แล้ว
    let copyOpts = '<option value="">คัดลอกสิทธิ์จากแผนกอื่น…</option>';
    Object.keys(MENU_PERMS).sort().forEach(k => {
        if (k !== key && Array.isArray(MENU_PERMS[k]) && MENU_PERMS[k].length > 0) {
            copyOpts += `<option value="${k}">${k.replace('_', ' · ')} (${MENU_PERMS[k].length} รายการ)</option>`;
        }
    });
    const pct = allItems ? Math.round(permUI.draft.length / allItems * 100) : 0;

    root.innerHTML = `
    <style>
        #permBuilderRoot .pm-wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}
        /* แผนก */
        #permBuilderRoot .pm-side{position:sticky;top:8px;display:flex;flex-direction:column;gap:4px;padding:8px;border-radius:14px;background:var(--k-panel2);border:1px solid var(--k-line)}
        #permBuilderRoot .pm-side-h{font-size:11px;font-weight:800;color:var(--k-mute);padding:4px 6px 6px}
        #permBuilderRoot .pm-dept{display:flex;align-items:center;gap:8px;height:40px;padding:0 8px 0 12px;border-radius:10px;cursor:pointer;color:var(--k-tx2);border:1px solid transparent;transition:background .15s,border-color .15s}
        #permBuilderRoot .pm-dept:hover{background:var(--k-btn-h)}
        #permBuilderRoot .pm-dept.active{background:var(--k-gold);color:var(--k-gold-ink);box-shadow:0 4px 12px rgba(232,193,90,.25)}
        #permBuilderRoot .pm-dn{font-size:13px;font-weight:900;letter-spacing:.03em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        #permBuilderRoot .pm-dc{font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--k-btn);border:1px solid var(--k-line2);color:var(--k-mute);font-variant-numeric:tabular-nums}
        #permBuilderRoot .pm-dept.active .pm-dc{background:rgba(27,20,6,.12);border-color:rgba(27,20,6,.2);color:var(--k-gold-ink)}
        #permBuilderRoot .pm-dt{display:flex;gap:2px;opacity:0;transition:opacity .15s}
        #permBuilderRoot .pm-dept:hover .pm-dt,#permBuilderRoot .pm-dept.active .pm-dt{opacity:1}
        #permBuilderRoot .pm-dt button{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:inherit;background:transparent;border:0;cursor:pointer}
        #permBuilderRoot .pm-dt button:hover{background:rgba(127,127,127,.18)}
        #permBuilderRoot .pm-dt button.del:hover{background:#ef4444;color:#fff}
        #permBuilderRoot .pm-dt .material-icons{font-size:15px}
        #permBuilderRoot .pm-add{display:flex;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid var(--k-line)}
        #permBuilderRoot .pm-add input{flex:1;min-width:0;height:34px;padding:0 10px;border-radius:9px;background:var(--k-field);border:1px solid var(--k-line2);color:var(--k-tx);font-size:12.5px;font-weight:700;outline:none}
        #permBuilderRoot .pm-add input:focus{border-color:var(--k-gold)}
        #permBuilderRoot .pm-add button{width:34px;height:34px;flex:none;border-radius:9px;border:1px solid var(--k-line3);background:var(--k-btn);color:var(--k-gold-tx);cursor:pointer;display:flex;align-items:center;justify-content:center}
        #permBuilderRoot .pm-add button:hover{background:var(--k-btn-h)}
        /* แถบบนฝั่งขวา */
        #permBuilderRoot .pm-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
        #permBuilderRoot .pm-now{display:flex;flex-direction:column;gap:5px;min-width:200px;margin-right:auto}
        #permBuilderRoot .pm-now b{font-size:15px;font-weight:900;color:var(--k-tx-strong)}
        #permBuilderRoot .pm-now b span{color:var(--k-gold-tx)}
        #permBuilderRoot .pm-meter{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--k-mute)}
        #permBuilderRoot .pm-meter i{display:block;width:140px;height:5px;border-radius:5px;background:var(--k-line);overflow:hidden}
        #permBuilderRoot .pm-meter i em{display:block;height:100%;background:var(--k-gold);border-radius:5px;transition:width .2s}
        #permBuilderRoot .pm-in{height:36px;padding:0 11px;border-radius:10px;background:var(--k-field);border:1px solid var(--k-line2);color:var(--k-tx);font-size:12.5px;font-weight:700;outline:none}
        #permBuilderRoot .pm-in:focus{border-color:var(--k-gold);box-shadow:0 0 0 3px rgba(232,193,90,.15)}
        #permBuilderRoot .pm-search{position:relative}
        #permBuilderRoot .pm-search .material-icons{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--k-mute);pointer-events:none}
        #permBuilderRoot .pm-search .pm-in{padding-left:32px;width:220px}
        /* การ์ดหมวด — เรียงแบบคอลัมน์ ไม่มีช่องว่างโหว่ */
        #permBuilderRoot #permGroupsGrid{column-count:2;column-gap:12px}
        @media (min-width:1500px){ #permBuilderRoot #permGroupsGrid{column-count:3} }
        #permBuilderRoot .perm-group-card{break-inside:avoid;margin-bottom:12px;border-radius:14px;background:var(--k-card);border:1px solid var(--k-line);overflow:hidden}
        #permBuilderRoot .pm-gh{display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid var(--k-line)}
        #permBuilderRoot .pm-gi{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;background:color-mix(in srgb,var(--gc) 15%,transparent);color:var(--gc)}
        #permBuilderRoot .pm-gi .material-icons{font-size:17px}
        #permBuilderRoot .pm-gn{flex:1;min-width:0;font-size:13px;font-weight:900;color:var(--k-tx-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #permBuilderRoot .pm-cnt{font-size:10.5px;font-weight:900;padding:1px 8px;border-radius:999px;background:var(--k-btn);border:1px solid var(--k-line2);color:var(--k-mute);font-variant-numeric:tabular-nums}
        #permBuilderRoot .pm-cnt.some{color:var(--k-gold-tx);border-color:rgba(232,193,90,.45);background:rgba(232,193,90,.1)}
        #permBuilderRoot .pm-cnt.full{color:var(--k-green-tx);border-color:var(--k-green-line);background:var(--k-green-bg)}
        #permBuilderRoot .pm-gb{padding:6px}
        #permBuilderRoot .perm-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:9px;cursor:pointer;transition:background .12s}
        #permBuilderRoot .perm-row:hover{background:var(--k-btn-h)}
        #permBuilderRoot .perm-row-name{flex:1;line-height:1.35;font-size:12.5px;color:var(--k-tx2)}
        #permBuilderRoot .perm-row-main{background:var(--k-panel2);margin-bottom:2px}
        #permBuilderRoot .perm-row-main .perm-row-name{font-weight:800;color:var(--k-tx-strong)}
        #permBuilderRoot .perm-row-sub{margin-left:12px;padding-left:12px;border-left:2px solid var(--k-line);border-radius:0 9px 9px 0}
        /* ปิด "เข้าหน้า" แล้ว สิทธิ์ย่อยจางลง — บอกว่ายังไม่มีผลจนกว่าจะเปิดหน้า */
        #permBuilderRoot .perm-group-card:has(.perm-row-main .perm-sw-input:not(:checked)) .perm-row-sub{opacity:.5}
        #permBuilderRoot .perm-sw-input{display:none}
        #permBuilderRoot .perm-sw{width:36px;height:20px;border-radius:99px;background:var(--k-line2);position:relative;flex-shrink:0;transition:background .18s}
        #permBuilderRoot .perm-sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .18s}
        #permBuilderRoot .perm-sw-input:checked + .perm-sw{background:#16a34a}
        #permBuilderRoot .perm-sw-input:checked + .perm-sw::after{left:18px}
        #permBuilderRoot .pm-gf{display:flex;gap:4px;padding:6px 10px 10px}
        #permBuilderRoot .pm-link{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px;border-radius:7px;font-size:11px;font-weight:800;color:var(--k-mute);background:transparent;border:1px solid var(--k-line);cursor:pointer}
        #permBuilderRoot .pm-link .material-icons{font-size:14px}
        #permBuilderRoot .pm-link:hover{background:var(--k-btn-h);color:var(--k-tx-strong)}
        #permBuilderRoot .pm-link.on:hover{color:var(--k-green-tx);border-color:var(--k-green-line)}
        /* แถบบันทึก */
        #permBuilderRoot .perm-savebar{position:sticky;bottom:10px;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:6px;padding:10px 12px 10px 16px;border-radius:14px;background:color-mix(in srgb,var(--k-panel) 92%,transparent);backdrop-filter:blur(8px);border:1px solid var(--k-line2);box-shadow:var(--k-shadow)}
        #permBuilderRoot .pm-sv-l{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--k-mute)}
        #permBuilderRoot .pm-sv-l b{color:var(--k-tx-strong)}
        #permBuilderRoot #permDirtyHint{align-items:center;gap:5px;font-weight:800;color:var(--k-amber-tx)}
        #permBuilderRoot #permSaveBtn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 20px;border-radius:11px;border:1px solid var(--k-gold);background:var(--k-gold);color:var(--k-gold-ink);font-size:13.5px;font-weight:900;cursor:pointer;transition:box-shadow .2s,transform .08s}
        #permBuilderRoot #permSaveBtn:active{transform:scale(.97)}
        #permBuilderRoot #permSaveBtn.dirty{box-shadow:0 0 0 3px rgba(232,193,90,.25),0 0 18px rgba(232,193,90,.35)}
        @media (max-width:1100px){ #permBuilderRoot .pm-wrap{grid-template-columns:1fr} #permBuilderRoot .pm-side{position:static;flex-direction:row;flex-wrap:wrap} #permBuilderRoot .pm-side-h{width:100%} #permBuilderRoot .pm-add{width:100%} #permBuilderRoot #permGroupsGrid{column-count:1} }
    </style>

    <div class="pm-wrap">
        <aside class="pm-side">
            <div class="pm-side-h">① เลือกแผนก <span style="font-weight:600">(ตัวเลข = สิทธิ์ที่เปิด)</span></div>
            ${deptList}
            <div class="pm-add">
                <input type="text" id="newDeptInput" placeholder="ชื่อแผนกใหม่" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomPermDept();}">
                <button type="button" onclick="addCustomPermDept()" title="เพิ่มแผนก"><span class="material-icons">add</span></button>
            </div>
        </aside>

        <div style="min-width:0">
            <div class="pm-top">
                <div class="pm-now">
                    <b>② สิทธิ์ของแผนก <span>${permUI.dept}</span></b>
                    <div class="pm-meter"><i><em id="permTotalBar" style="width:${pct}%"></em></i> เปิดอยู่ <b id="permTotalCnt" style="color:var(--k-tx-strong)">${permUI.draft.length}</b> / ${allItems} รายการ</div>
                </div>
                <div class="pm-search"><span class="material-icons">search</span><input type="text" class="pm-in" placeholder="ค้นหาเมนู เช่น วันหยุด, Discord" oninput="permFilter(this.value)"></div>
                <select id="permCopySelect" class="pm-in" onchange="permCopyFrom(this.value)" title="เอาสิทธิ์ของแผนกอื่นมาเป็นฐาน แล้วค่อยปรับ">${copyOpts}</select>
            </div>

            <div id="permGroupsGrid"></div>

            <div class="perm-savebar">
                <div class="pm-sv-l">
                    <span id="permDirtyHint" style="display:none;"><span class="material-icons" style="font-size:16px">edit_note</span> ยังไม่ได้บันทึก</span>
                    <span>③ มีผลกับ <b>ทุกคนในแผนก ${permUI.dept}</b></span>
                </div>
                <button id="permSaveBtn" onclick="saveMenuPerms()"><span class="material-icons" style="font-size:18px">save</span> บันทึกสิทธิ์</button>
            </div>
        </div>
    </div>`;

    _permRenderGroups();
};

// บันทึก — เซฟเฉพาะชุด (แผนก·Role) ที่เปิดแก้อยู่ ชุดอื่นไม่ถูกแตะเลย
window.saveMenuPerms = async function() {
    if (!window.sysRequireAdmin()) return;

    _permReadMenuPerms();   // ดึงค่าปัจจุบันสุดจาก SETTINGS กันเขียนทับชุดอื่น
    const key = permUI.dept;
    MENU_PERMS[key] = [...permUI.draft];

    SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
    window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));

    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);

    window.permUI.dirty = false;
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: `อัปเดตสิทธิ์ของแผนก ${permUI.dept} เรียบร้อย`, timer: 1500, showConfirmButton: false});
    renderPermsTable();
};

window.hasUserPerm = function(menuId) {
    if (!window.currentUser || !window.currentUser.id) return false;

    let perms = {};
    try { perms = typeof SETTINGS['dept_menu_rules'] === 'string' ? JSON.parse(SETTINGS['dept_menu_rules']) : (SETTINGS['dept_menu_rules'] || {}); } catch(e) {}

    // 🎯 สิทธิ์มาจาก "แผนก" อย่างเดียว — ตำแหน่งงานไม่เกี่ยวกับสิทธิ์
    //    ตั้งที่เดียวคือหน้าสิทธิ์เมนู เลือกแผนกแล้วติ๊ก
    let uDept = (window.currentUser.department || 'AM').trim();
    if (uDept === 'SPECIAL') uDept = 'AM';
    let set = perms[uDept];
    if (!Array.isArray(set)) set = perms['AM'] || [];   // แผนกที่ยังไม่ได้ตั้งสิทธิ์ = ใช้ชุดของ AM

    return set.includes(menuId);
};

// ฟังก์ชันสำหรับปุ่มกดเพิ่มทีมผ่านหน้าเว็บ

// =========================================================
// 🟢 ระบบบังคับซ่อน/โชว์ เมนูด้านซ้าย (Sidebar) (V.8.1 แก้ไขกระพริบ + ซิงค์สิทธิ์เบื้องหลัง)
// =========================================================
window.applySidebarPermissions = async function() {
    let user = window.currentUser;
    if (!user || !user.id) {
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser) { user = JSON.parse(savedUser); window.currentUser = user; }
        else return; 
    }

    // (role ไม่ใช้คุมสิทธิ์แล้ว)
    
    // ฟังก์ชันย่อยสำหรับวาดเมนู
    const executeMenuUpdate = () => {
        const allMenuBtns = document.querySelectorAll('#menu-list button');
        const logsBtn = document.querySelector('button[onclick="openLogsPage()"]');

        allMenuBtns.forEach(btn => {
            const onClickAttr = btn.getAttribute('onclick') || '';
            let shouldShow = false;

            if (onClickAttr.includes('dashboard') || onClickAttr.includes('password')) {
                shouldShow = true;
            } else {
                PERM_GROUPS.forEach(group => {
                    group.items.forEach(item => {
                        if (item.isSub) return; 
                        if (onClickAttr.includes(`showPage('${item.id}')`) || onClickAttr.includes(`showPage("${item.id}")`)) {
                            if (window.hasUserPerm(item.id)) shouldShow = true;
                        }
                    });
                });

                const discordGroup = PERM_GROUPS.find(g => g.id === 'page_discord');
                if (discordGroup && onClickAttr.includes("toggleSubMenu('menu-discord'")) {
                    const hasAnyDiscordPerm = discordGroup.items.some(i => window.hasUserPerm(i.id));
                    if (hasAnyDiscordPerm) shouldShow = true;
                }

                if (onClickAttr.includes("toggleSubMenu('menu-admin'") || onClickAttr.includes("openAdminPanel()")) {
                    if (window.hasUserPerm('admin')) shouldShow = true;
                }
            }

            if (shouldShow) {
                btn.classList.remove('hidden');
                btn.style.removeProperty('display');
            } else {
                btn.classList.add('hidden');
                btn.style.setProperty('display', 'none', 'important');
            }
        });

        const menuDiscord = document.getElementById('menu-discord');
        const discordBtn = Array.from(document.querySelectorAll('#menu-list button')).find(b => (b.getAttribute('onclick')||'').includes("toggleSubMenu('menu-discord'"));
        if (menuDiscord && discordBtn && discordBtn.classList.contains('hidden')) menuDiscord.classList.add('hidden');
        
        const menuAdmin = document.getElementById('menu-admin');
        const adminBtn = Array.from(document.querySelectorAll('#menu-list button')).find(b => (b.getAttribute('onclick')||'').includes("toggleSubMenu('menu-admin'"));
        if (menuAdmin && adminBtn && adminBtn.classList.contains('hidden')) menuAdmin.classList.add('hidden');

        if (logsBtn) {
            const canSeeLogs = window.hasUserPerm('admin_logs');
            if (canSeeLogs) {
                logsBtn.classList.remove('hidden');
                logsBtn.style.removeProperty('display');
            } else {
                logsBtn.classList.add('hidden');
                logsBtn.style.setProperty('display', 'none', 'important');
            }
        }

        // 🗂️ [หมวดเมนู] ซ่อนหัวหมวดที่ปุ่มข้างในถูกซ่อนหมด (พนักงานสิทธิ์น้อยจะไม่เห็นหัวลอยเปล่า ๆ)
        document.querySelectorAll('#menu-list .menu-section-header').forEach(h => {
            let el = h.nextElementSibling;
            let hasVisible = false;
            while (el && !el.classList.contains('menu-section-header')) {
                if (el.tagName === 'BUTTON' && !el.classList.contains('hidden') && el.style.display !== 'none') { hasVisible = true; break; }
                el = el.nextElementSibling;
            }
            h.style.display = hasVisible ? '' : 'none';
        });
    };

    // 🌟 1. ดึงสิทธิ์จากความจำเครื่อง (Cache) มาโชว์เมนูทันที (ภาพไม่กระพริบ)
    const cachedRules = localStorage.getItem('cached_menu_rules');
    if (cachedRules && !SETTINGS['dept_menu_rules']) {
        SETTINGS['dept_menu_rules'] = cachedRules;
    }
    executeMenuUpdate();

    // 🌟 2. วิ่งไปเช็คฐานข้อมูลเงียบๆ (ถ้ามีการเปลี่ยนสิทธิ์ใหม่ เมนูจะอัปเดตให้อัตโนมัติ)

    if (typeof appDB !== 'undefined') {
        appDB.from('settings').select('value').eq('key', 'dept_menu_rules').single().then(({data}) => {
            if (data && data.value && data.value !== cachedRules) {
                SETTINGS['dept_menu_rules'] = data.value;
                window.safeSetItem('cached_menu_rules', data.value);
                executeMenuUpdate(); 
            }
        }).catch(e => console.log(e));
    }
};

// 🌟 เปลี่ยนมาใช้ MutationObserver แทน setTimeout 
// เพื่อให้ทันทีที่เมนูด้านซ้ายโหลดขึ้นมาปุ๊บ ระบบจะรีบจัดแจงซ่อน/โชว์ให้เสร็จปั๊บ 
// ป้องกันปัญหาเมนูกระพริบแวบๆ ตอนกด F5 ได้เนียนตาที่สุดครับ
const sidebarObserver = new MutationObserver((mutations) => {
    const menuList = document.getElementById('menu-list');
    if (menuList && menuList.children.length > 0) {
        applySidebarPermissions();
        // พอจัดเมนูเสร็จรอบแรกก็หยุดจับตาดูเลย เพื่อไม่ให้เปลืองแรงเครื่อง
        sidebarObserver.disconnect(); 
    }
});

// เริ่มจับตาดูการเปลี่ยนแปลงของร่างกายเว็บ (body)
if (document.body) {
    sidebarObserver.observe(document.body, { childList: true, subtree: true });
}

// แปะไว้กันเหนียว เผื่อกรณีไฟล์โหลดเร็วมากๆ จน Observer ทำงานไม่ทัน
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    applySidebarPermissions();
} else {
    document.addEventListener('DOMContentLoaded', applySidebarPermissions);
}

// =========================================================
// 🟢 ระบบรอบเวลา (โครงใหม่: ไม่มี "ช่วง" แล้ว) — กะ → [รายการเวลา] ตรงๆ
// เก็บใน settings 'custom_time_slots' รูป { AM: {กะ:[...]}, OD: {กะ:[...]} }
// ของเก่า (มีช่วงซ้อน หรือไม่แยกแผนก) → แปลงให้อัตโนมัติ รวมทุกช่วงเป็นรายการเดียว ไม่มีข้อมูลหาย
// =========================================================
window.SHIFT_GROUPS_ALL = { AM: {}, OD: {} };
window._slotsViewerDept = function() {
    const d = (window.currentUser && window.currentUser.department) || 'AM';
    return d === 'OD' ? 'OD' : 'AM';   // แผนกอื่นๆ นับเป็น AM
};

// 🕐 เรียงเวลา "ตามลำดับของกะ" — นับจากเวลาเข้ากะเป็นจุดเริ่ม (กะดึก: 21:00 ขึ้นก่อน แล้วข้ามเที่ยงคืนไล่ถึงเช้า)
window.sortSlotsByShift = function(shift, arr) {
    const suf = String(shift || '').replace('กะ', '');
    const defOpen = { 'เช้า': '08:00', 'กลาง': '11:00', 'ดึก': '20:00' }[suf] || '00:00';
    const S = (typeof SETTINGS !== 'undefined' && SETTINGS) ? SETTINGS : {};
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : 9999; };
    const open = toMin(S[`open_time_${suf}`] || defOpen);
    const key = sl => ((toMin(sl) - open) + 1440) % 1440;   // ระยะห่างจากเวลาเข้ากะ
    return [...arr].sort((a, b) => key(a) - key(b));
};

// รวมข้อมูลทุกทรง (แบน/มีช่วงซ้อน) ให้เป็น กะ → [เวลา เรียงตามลำดับกะ ไม่ซ้ำ]
function _flattenShiftSlots(deptObj) {
    const out = {};
    for (const [shift, val] of Object.entries(deptObj || {})) {
        let arr = [];
        if (Array.isArray(val)) arr = val;                                         // ทรงใหม่อยู่แล้ว
        else if (val && typeof val === 'object') Object.values(val).forEach(a => { if (Array.isArray(a)) arr = arr.concat(a); });   // ทรงเก่ามีช่วง → เทรวม
        arr = window.sortSlotsByShift(shift, [...new Set(arr)]);
        if (arr.length) out[shift] = arr;
    }
    return out;
}

window.applyCustomTimeSlots = function() {
    try {
        let rawData = SETTINGS['custom_time_slots'] || SETTINGS['shift_time_slots'] || SETTINGS['manual_time_slots'];

        // 💡 ค่าเริ่มต้น = ชุดตามประกาศ "รอบการพักเบรคของพนักงาน" (ล็อกตายตัว)
        const defaultTimeSlots = {
            'กะเช้า': [
                // 💡 รอบเช้า 09.00-11.00
                '09:00-09:30', '09:30-10:00',
                // 💡 รอบเช้า 12.00-14.00
                '12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00',
                // 💡 รอบเช้า 16.00-18.30
                '16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00', '18:00-18:30'
            ],
            'กะกลาง': [
                // (ประกาศไม่ได้ระบุกะกลาง — ใช้หลักเดียวกัน ปรับได้ที่เครื่องมือเพิ่มรอบเวลา)
                '12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00',
                '16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00', '18:00-18:30',
                '21:00-21:30', '21:30-22:00'
            ],
            'กะดึก': [
                // 🌙 รอบดึก 21.00-23.30
                '21:00-21:30', '21:30-22:00', '22:00-22:30', '22:30-23:00', '23:00-23:30',
                // 🌙 รอบดึก 02.00-04.00
                '02:00-02:30', '02:30-03:00', '03:00-03:30', '03:30-04:00',
                // 🌙 รอบดึก 05.00-07.00
                '05:00-05:30', '05:30-06:00', '06:00-06:30', '06:30-07:00'
            ]
        };

        let parsed = rawData ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) : null;
        if (!parsed) parsed = defaultTimeSlots;

        if (parsed.AM || parsed.OD) {
            window.SHIFT_GROUPS_ALL = { AM: _flattenShiftSlots(parsed.AM || {}), OD: _flattenShiftSlots(parsed.OD || {}) };
        } else {
            const flat = _flattenShiftSlots(parsed);
            window.SHIFT_GROUPS_ALL = { AM: flat, OD: JSON.parse(JSON.stringify(flat)) };
        }
        // 🛡️ ถ้าข้อมูลที่เก็บไว้ว่างเปล่า (เช่น เพิ่งกดรีเซ็ต) → ใช้ชุดอัตโนมัติ
        for (const dep of ['AM', 'OD']) {
            if (!Object.keys(window.SHIFT_GROUPS_ALL[dep] || {}).length) {
                window.SHIFT_GROUPS_ALL[dep] = JSON.parse(JSON.stringify(defaultTimeSlots));
            }
        }
        SHIFT_GROUPS = window.SHIFT_GROUPS_ALL[window._slotsViewerDept()] || {};
    } catch(e) { console.error('Error applying custom time slots:', e); }
};

window.renderManualTimeSlots = function() {
    const container = document.getElementById('manualTimeSlotsContainer');
    if (!container) return;

    // 🎯 โชว์เฉพาะแผนกที่เลือกอยู่ในฟอร์มด้านบน — เลือก OD รายการก็เป็นของ OD ทันที
    const depEl = document.getElementById('newTimeDept');
    const dep = (depEl && depEl.value === 'OD') ? 'OD' : 'AM';
    const selShift = (document.getElementById('newTimeShift') || {}).value || '';
    const groups = (window.SHIFT_GROUPS_ALL && window.SHIFT_GROUPS_ALL[dep]) || {};

    const SHIFT_ORDER = ['กะเช้า', 'กะกลาง', 'กะดึก'];
    const shiftMeta = {
        'กะเช้า': { icon: '☀️', color: 'text-orange-400', border: 'rgba(251,146,60,.4)' },
        'กะกลาง': { icon: '⛅', color: 'text-blue-400',   border: 'rgba(96,165,250,.4)' },
        'กะดึก':  { icon: '🌙', color: 'text-purple-400', border: 'rgba(192,132,252,.4)' }
    };
    const depColor = dep === 'AM' ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-pink-300 border-pink-500/40 bg-pink-500/10';

    let html = `<div class="text-[10px] font-black ${depColor} border rounded-lg px-2 py-1 mb-2 inline-block">กำลังดู: แผนก ${dep}</div>`;
    let count = 0;
    const shifts = Object.keys(groups).sort((a, b) => (SHIFT_ORDER.indexOf(a) + 1 || 99) - (SHIFT_ORDER.indexOf(b) + 1 || 99));
    for (const shift of shifts) {
        const slots = groups[shift] || [];
        if (!slots.length) continue;
        const m = shiftMeta[shift] || { icon: '⏰', color: 'text-gray-300', border: 'rgba(148,163,184,.4)' };
        const isSel = shift === selShift;
        html += `<div class="text-[10px] font-bold ${m.color} mt-2 mb-1 flex items-center gap-1.5">${m.icon} ${shift} <span class="text-gray-600 font-normal">(${slots.length} รอบ)</span>${isSel ? '<span style="font-size:9px;background:rgba(59,130,246,.2);border:1px solid rgba(96,165,250,.5);color:light-dark(#0352aa,#93c5fd);border-radius:99px;padding:1px 7px;font-weight:800">กำลังเพิ่มกะนี้</span>' : ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;${isSel ? 'padding:6px;border:1px dashed ' + m.border + ';border-radius:10px;' : ''}">`;
        slots.forEach(slot => {
            html += `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--k-panel2);border:1px solid var(--k-line2);border-radius:8px;padding:3px 4px 3px 9px">
                <span class="text-gray-300 font-mono text-[10.5px] font-bold tracking-wider">${slot}</span>
                <button type="button" onclick="deleteManualTimeSlot('${dep}', '${shift}', '${slot}')" class="text-red-400 hover:text-white hover:bg-red-600 rounded transition" style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;line-height:1" title="ลบเวลานี้">✕</button>
            </span>`;
            count++;
        });
        html += `</div>`;
    }
    container.innerHTML = count === 0
        ? html + `<div class="text-center text-gray-600 text-xs py-4">แผนก ${dep} ยังไม่มีรอบเวลา — เพิ่มจากฟอร์มด้านบนได้เลย</div>`
        : html;
};

window.addManualTimeSlot = async function() {
    if (!window.sysRequireAdmin()) return;

    const depEl = document.getElementById('newTimeDept');
    const dep = (depEl && depEl.value === 'OD') ? 'OD' : 'AM';
    const shiftSelect = document.getElementById('newTimeShift').value;
    const start = document.getElementById('newTimeStart').value;
    const end = document.getElementById('newTimeEnd').value;

    if (!start || !end) return Swal.fire('เตือน', 'กรุณาระบุเวลาให้ครบ', 'warning');
    // 🌙 รองรับรอบคร่อมเที่ยงคืน (กะดึกทำงาน 20:00-08:00) เช่น 23:30-00:00 ถือว่าถูกต้อง
    if (start === end) return Swal.fire('เตือน', 'เวลาเริ่มกับเวลาจบต้องไม่เท่ากัน', 'warning');

    const timeSlot = `${start}-${end}`;
    const G = window.SHIFT_GROUPS_ALL[dep] = window.SHIFT_GROUPS_ALL[dep] || {};
    if (!Array.isArray(G[shiftSelect])) G[shiftSelect] = [];
    if (G[shiftSelect].includes(timeSlot)) return Swal.fire('เตือน', `แผนก ${dep} มีรอบเวลานี้อยู่แล้ว`, 'warning');

    G[shiftSelect].push(timeSlot);
    G[shiftSelect] = window.sortSlotsByShift(shiftSelect, G[shiftSelect]);   // เรียงตามลำดับกะ (ดึก: 21:00 ก่อน)

    SETTINGS['custom_time_slots'] = JSON.stringify(window.SHIFT_GROUPS_ALL);
    SHIFT_GROUPS = window.SHIFT_GROUPS_ALL[window._slotsViewerDept()] || {};

    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(window.SHIFT_GROUPS_ALL) }]);

    renderManualTimeSlots();
    document.getElementById('newTimeStart').value = '';
    document.getElementById('newTimeEnd').value = '';
    Swal.fire({icon: 'success', title: `เพิ่มให้แผนก ${dep} สำเร็จ`, timer: 1200, showConfirmButton: false});
};

// ♻️ รีเซ็ตรอบเวลาทั้งระบบเป็น "อัตโนมัติตามเวลากะ" — ลบชุดที่ตั้งเองทิ้ง ทุกเครื่องได้ชุดใหม่ทันที
window.resetTimeSlotsAuto = async function() {
    if (!window.sysRequireAdmin()) return;
    const r = await Swal.fire({
        title: 'รีเซ็ตรอบเวลาเป็นชุดมาตรฐาน?',
        html: 'รอบเวลาที่เพิ่มเองทั้งหมด (AM และ OD) จะถูกลบ<br>กลับไปใช้ <b class="text-emerald-400">ชุดตามประกาศรอบพักเบรค</b> (เช้า 09-10, 12-14, 16-18:30 · ดึก 21-23:30, 02-04, 05-07)',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'รีเซ็ตเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#059669'
    });
    if (!r.isConfirmed) return;
    Swal.fire({title: 'กำลังรีเซ็ต...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').delete().eq('key', 'custom_time_slots');
    delete SETTINGS['custom_time_slots'];
    window.applyCustomTimeSlots();
    if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
    renderManualTimeSlots();
    Swal.fire({icon: 'success', title: 'รีเซ็ตแล้ว', text: 'ทุกกะใช้รอบตามประกาศแล้ว', timer: 1800, showConfirmButton: false});
};

window.deleteManualTimeSlot = async function(dep, shift, timeSlot) {
    if (!window.sysRequireAdmin()) return;

    const G = (window.SHIFT_GROUPS_ALL && window.SHIFT_GROUPS_ALL[dep]) || null;
    if (G && Array.isArray(G[shift])) {
        G[shift] = G[shift].filter(t => t !== timeSlot);
        if (G[shift].length === 0) delete G[shift];
    }

    SETTINGS['custom_time_slots'] = JSON.stringify(window.SHIFT_GROUPS_ALL);
    SHIFT_GROUPS = window.SHIFT_GROUPS_ALL[window._slotsViewerDept()] || {};

    Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(window.SHIFT_GROUPS_ALL) }]);

    renderManualTimeSlots();
    Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
};

// ==========================================
