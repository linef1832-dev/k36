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
            {id: 'dashboard_view_all_shifts', name: 'ลงเวลาได้ทุกกะ (เห็นทั้ง 3 กะ)', isSub: true}
        ]
    },
    {
        id: 'page_breaktable', name: 'ตารางลงเวลาพัก (ใครลงกินข้าว)', icon: 'table_view', theme: 'cyan',
        items: [
            {id: 'breaktable', name: 'เข้าหน้าตารางลงเวลาพัก', isSub: false},
            {id: 'breaktable_export', name: 'โหลด Excel ทั้งวัน', isSub: true}
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
            {id: 'gallery_delete', name: 'ลบรูปภาพ', isSub: true}
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
        {id: 'sop_manage', name: 'เพิ่ม/แก้/ลบ กฎ', isSub: true}
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
            {id: 'slip_check', name: 'เข้าหน้าตรวจสอบสลิป', isSub: false}
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
            {id: 'telegram', name: 'เข้าหน้ากลุ่มงาน (Telegram)', isSub: false}
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
            {id: 'admin_logs', name: 'ประวัติระบบ (ปุ่มซ้ายล่าง)', isSub: true}
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
window.permUI = window.permUI || { dept: null, role: null, draft: [], dirty: false };

function _permReadMenuPerms() {
    try {
        if (typeof SETTINGS['dept_menu_rules'] === 'string') MENU_PERMS = JSON.parse(SETTINGS['dept_menu_rules']);
        else if (SETTINGS['dept_menu_rules']) MENU_PERMS = SETTINGS['dept_menu_rules'];
        else MENU_PERMS = {};
    } catch(e) { MENU_PERMS = {}; }
}

function _permAllRoles() {
    let dbRoles = [];
    try { dbRoles = JSON.parse(SETTINGS['custom_roles'] || '[]'); } catch(e) {}
    let all = [...new Set(['staff', 'trainer', 'manager', ...dbRoles])];
    if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach(u => {
            if (u.role && !all.includes(u.role.toLowerCase())) all.push(u.role.toLowerCase());
        });
    }
    return all.map(r => r.toUpperCase());
}

function _permSaveSel() {
    try { window.safeSetItem('perm_ui_sel', JSON.stringify({ dept: permUI.dept, role: permUI.role })); } catch(e) {}
}

// สลับแผนก/Role — ถ้ามีของแก้ค้างยังไม่บันทึก จะถามก่อน กันงานหาย
window.permSwitch = async function(dept, role) {
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
    window.permUI.role = role;
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
        html: `เอาสิทธิ์ทั้งหมดของ <b class="text-blue-400">${srcKey.replace('_', ' · ')}</b> (${srcPerms.length} รายการ)<br>มาทับชุด <b class="text-emerald-400">${permUI.dept} · ${permUI.role}</b> ที่เปิดอยู่`,
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
    let total = 0;
    PERM_GROUPS.forEach(g => {
        const n = g.items.filter(i => d.includes(i.id)).length;
        total += n;
        const badge = document.getElementById('permCnt_' + g.id);
        if (badge) {
            badge.textContent = n + '/' + g.items.length;
            badge.className = 'text-[10px] font-black px-2 py-0.5 rounded-lg border ' +
                (n > 0 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-gray-500 border-slate-600 bg-slate-800');
        }
    });
    const totalEl = document.getElementById('permTotalCnt');
    if (totalEl) totalEl.textContent = total;
    const dirtyEl = document.getElementById('permDirtyHint');
    if (dirtyEl) dirtyEl.style.display = window.permUI.dirty ? 'flex' : 'none';
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

        let itemsHtml = '';
        g.items.forEach(item => {
            const on = d.includes(item.id);
            const mainCls = item.isSub
                ? 'perm-row perm-row-sub'
                : 'perm-row perm-row-main';
            itemsHtml += `
                <label class="${mainCls}">
                    <span class="perm-row-name">${item.name}</span>
                    <input type="checkbox" id="permCb_${item.id}" class="perm-sw-input" ${on ? 'checked' : ''}
                           onchange="permToggleItem('${item.id}', this.checked)">
                    <span class="perm-sw" style="--sw:${hex};"></span>
                </label>`;
        });

        html += `
            <div class="perm-group-card bg-slate-800/70 rounded-2xl border border-slate-700 overflow-hidden shadow-sm hover:border-slate-500 transition" data-search="${searchText}">
                <div class="px-4 py-3 border-b border-slate-700 flex items-center gap-2 bg-slate-900/50">
                    <span class="material-icons text-[18px]" style="color:${hex}">${g.icon}</span>
                    <span class="font-bold text-white text-[11px] flex-1 truncate">${g.name}</span>
                    <span id="permCnt_${g.id}" class="text-[10px] font-black px-2 py-0.5 rounded-lg border ${n > 0 ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-gray-500 border-slate-600 bg-slate-800'}">${n}/${g.items.length}</span>
                </div>
                <div class="px-3 pt-2 flex gap-1.5">
                    <button type="button" onclick="permGroupSetAll('${g.id}', true)" class="text-[9px] font-bold text-emerald-400 hover:text-white hover:bg-emerald-600 border border-emerald-600/40 rounded-md px-2 py-0.5 transition">เปิดทั้งหมด</button>
                    <button type="button" onclick="permGroupSetAll('${g.id}', false)" class="text-[9px] font-bold text-gray-400 hover:text-white hover:bg-slate-600 border border-slate-600 rounded-md px-2 py-0.5 transition">ล้าง</button>
                </div>
                <div class="p-3 flex flex-col gap-0.5">${itemsHtml}</div>
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
    const roles = _permAllRoles();

    // กู้ค่าที่เคยเลือกไว้ (จำข้ามการรีเฟรช)
    if (!permUI.dept) {
        try {
            const saved = JSON.parse(localStorage.getItem('perm_ui_sel') || '{}');
            if (saved.dept) permUI.dept = saved.dept;
            if (saved.role) permUI.role = saved.role;
        } catch(e) {}
    }
    if (!depts.includes(permUI.dept)) permUI.dept = depts[0] || 'AM';
    if (!roles.includes(permUI.role)) permUI.role = roles.includes('STAFF') ? 'STAFF' : (roles[0] || 'STAFF');

    const key = `${permUI.dept}_${permUI.role}`;
    permUI.draft = [...(MENU_PERMS[key] || [])];
    permUI.dirty = false;

    // ชิปเลือกแผนก (พร้อมปุ่มแก้ชื่อ/ลบ)
    let deptChips = '';
    depts.forEach(dept => {
        const active = dept === permUI.dept;
        deptChips += `
            <div class="perm-chip ${active ? 'perm-chip-active' : ''}" onclick="permSwitch('${dept}', permUI.role)">
                <span class="font-black tracking-wider text-[12px]">${dept}</span>
                <span class="perm-chip-tools">
                    <button type="button" onclick="event.stopPropagation(); renameAnyDept('${dept}')" title="เปลี่ยนชื่อแผนก"><span class="material-icons text-[12px]">edit</span></button>
                    ${!['AM','OD','AMQL'].includes(dept) ? `<button type="button" class="perm-tool-del" onclick="event.stopPropagation(); deleteCustomPermDept('${dept}')" title="ลบแผนก"><span class="material-icons text-[12px]">close</span></button>` : ''}
                </span>
            </div>`;
    });

    // เม็ดเลือก Role
    const rolePillColor = { 'STAFF': '#a855f7', 'TRAINER': '#d946ef', 'MANAGER': '#ef4444' };
    let rolePills = '';
    roles.forEach(r => {
        const active = r === permUI.role;
        const c = rolePillColor[r] || '#0ea5e9';
        rolePills += `
            <button type="button" onclick="permSwitch(permUI.dept, '${r}')"
                class="perm-pill ${active ? 'perm-pill-active' : ''}" style="--pc:${c};">
                ${r}${(MENU_PERMS[permUI.dept + '_' + r] || []).length > 0 ? '<span class="perm-pill-dot"></span>' : ''}
            </button>`;
    });

    // ตัวเลือก "คัดลอกจาก" — โชว์เฉพาะชุดที่มีสิทธิ์ตั้งไว้แล้ว
    let copyOpts = '<option value="">📋 คัดลอกสิทธิ์จากชุดอื่น...</option>';
    Object.keys(MENU_PERMS).sort().forEach(k => {
        if (k !== key && Array.isArray(MENU_PERMS[k]) && MENU_PERMS[k].length > 0) {
            copyOpts += `<option value="${k}">${k.replace('_', ' · ')} (${MENU_PERMS[k].length} รายการ)</option>`;
        }
    });

    root.innerHTML = `
    <style>
        .perm-chip{position:relative;display:inline-flex;align-items:center;gap:6px;background:#0f172a;border:1px solid #334155;color:#94a3b8;border-radius:14px;padding:10px 14px;cursor:pointer;transition:all .15s;user-select:none;}
        .perm-chip:hover{border-color:#64748b;color:#fff;}
        .perm-chip-active{background:linear-gradient(135deg,#1d4ed8,#3b82f6);border-color:#60a5fa;color:#fff;box-shadow:0 4px 14px rgba(59,130,246,.35);}
        .perm-chip-tools{display:inline-flex;gap:4px;margin-left:2px;}
        .perm-chip-tools button{width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.12);display:inline-flex;align-items:center;justify-content:center;color:inherit;transition:background .15s;}
        .perm-chip-tools button:hover{background:#f59e0b;color:#fff;}
        .perm-chip-tools .perm-tool-del:hover{background:#ef4444;}
        .perm-pill{position:relative;border:1px solid #334155;background:#0f172a;color:#94a3b8;border-radius:12px;padding:8px 16px;font-size:11px;font-weight:900;letter-spacing:.05em;cursor:pointer;transition:all .15s;}
        .perm-pill:hover{border-color:var(--pc);color:#fff;}
        .perm-pill-active{background:var(--pc);border-color:var(--pc);color:#fff;box-shadow:0 4px 14px color-mix(in srgb,var(--pc) 40%,transparent);}
        .perm-pill-dot{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:#10b981;border:2px solid #151f32;}
        .perm-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;cursor:pointer;transition:background .12s;}
        .perm-row:hover{background:rgba(51,65,85,.5);}
        .perm-row-main{background:rgba(51,65,85,.28);font-weight:700;margin-bottom:2px;}
        .perm-row-main .perm-row-name{color:#e2e8f0;font-size:11px;}
        .perm-row-sub{margin-left:14px;border-left:2px solid rgba(100,116,139,.35);border-radius:0 10px 10px 0;}
        .perm-row-sub .perm-row-name{color:#94a3b8;font-size:10px;}
        .perm-row-name{flex:1;line-height:1.3;}
        .perm-sw-input{display:none;}
        .perm-sw{width:34px;height:19px;border-radius:99px;background:#334155;position:relative;flex-shrink:0;transition:background .18s;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);}
        .perm-sw::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#94a3b8;transition:all .18s;}
        .perm-sw-input:checked + .perm-sw{background:var(--sw);}
        .perm-sw-input:checked + .perm-sw::after{left:17px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);}
        .perm-savebar{position:sticky;bottom:10px;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(15,23,42,.92);backdrop-filter:blur(8px);border:1px solid #334155;border-radius:18px;padding:12px 18px;box-shadow:0 -8px 30px rgba(0,0,0,.45);margin-top:14px;}
        .perm-toolbar input[type=text]{background:#0f172a;border:1px solid #334155;color:#fff;border-radius:12px;padding:8px 12px;font-size:12px;outline:none;width:220px;transition:border .15s;}
        .perm-toolbar input[type=text]:focus{border-color:#3b82f6;}
        .perm-toolbar select{background:#0f172a;border:1px solid #334155;color:#94a3b8;border-radius:12px;padding:8px 10px;font-size:11px;font-weight:700;outline:none;cursor:pointer;}
    </style>

    <div class="flex flex-col gap-4">
        <div>
            <div class="text-[10px] text-gray-500 font-bold mb-1.5 tracking-widest uppercase">1) เลือกแผนก</div>
            <div class="flex flex-wrap items-center gap-2">${deptChips}</div>
        </div>
        <div>
            <div class="text-[10px] text-gray-500 font-bold mb-1.5 tracking-widest uppercase">2) เลือก Role <span class="normal-case text-gray-600">(จุดเขียว = ชุดนั้นมีสิทธิ์ตั้งไว้แล้ว)</span></div>
            <div class="flex flex-wrap items-center gap-2">${rolePills}</div>
        </div>

        <div class="perm-toolbar flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-4">
            <span class="text-[11px] font-black text-white bg-slate-800 border border-slate-600 rounded-xl px-3 py-2">กำลังตั้งค่า: <span class="text-blue-400">${permUI.dept}</span> · <span class="text-emerald-400">${permUI.role}</span></span>
            <input type="text" placeholder="🔍 ค้นหาเมนู เช่น วันหยุด, Discord..." oninput="permFilter(this.value)">
            <select id="permCopySelect" onchange="permCopyFrom(this.value)">${copyOpts}</select>
            <span class="text-[11px] text-gray-400 ml-auto">เปิดอยู่ <span id="permTotalCnt" class="text-emerald-400 font-black">${permUI.draft.length}</span> รายการ</span>
        </div>

        <div id="permGroupsGrid" class="grid grid-cols-2 xl:grid-cols-3 gap-3 items-start"></div>

        <div class="perm-savebar">
            <div class="flex items-center gap-2 text-[11px]">
                <span id="permDirtyHint" style="display:none;" class="items-center gap-1.5 text-amber-400 font-bold"><span class="material-icons text-[15px]">warning</span> มีการแก้ไขที่ยังไม่บันทึก</span>
                <span class="text-gray-500">การตั้งค่านี้มีผลกับชุด <b class="text-gray-300">${permUI.dept} · ${permUI.role}</b> เท่านั้น</span>
            </div>
            <button onclick="saveMenuPerms()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl text-sm font-black shadow-lg transition flex items-center gap-2 border border-emerald-400 active:scale-95">
                <span class="material-icons text-[18px]">save</span> บันทึกสิทธิ์
            </button>
        </div>
    </div>`;

    _permRenderGroups();
};

// บันทึก — เซฟเฉพาะชุด (แผนก·Role) ที่เปิดแก้อยู่ ชุดอื่นไม่ถูกแตะเลย
window.saveMenuPerms = async function() {
    if (!window.sysRequireAdmin()) return;

    _permReadMenuPerms();   // ดึงค่าปัจจุบันสุดจาก SETTINGS กันเขียนทับชุดอื่น
    const key = `${permUI.dept}_${permUI.role}`;
    MENU_PERMS[key] = [...permUI.draft];

    SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
    window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));

    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);

    window.permUI.dirty = false;
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: `อัปเดตสิทธิ์ของ ${permUI.dept} · ${permUI.role} เรียบร้อย`, timer: 1500, showConfirmButton: false});
    renderPermsTable();
};

window.hasUserPerm = function(menuId) {
    if (!window.currentUser || !window.currentUser.id) return false;
    
    // 🌟 คืนค่าบรรทัดนี้กลับมา: เพื่อให้ Admin และ Manager มองเห็นทุกเมนูและกดได้ทุกปุ่มเสมอ
    const uRoleLower = (window.currentUser.role || '').toLowerCase().trim();
    if (uRoleLower === 'admin' || uRoleLower === 'manager') return true;
    
    let perms = {};
    try { perms = typeof SETTINGS['dept_menu_rules'] === 'string' ? JSON.parse(SETTINGS['dept_menu_rules']) : (SETTINGS['dept_menu_rules'] || {}); } catch(e) {}
    
    let uDept = window.currentUser.department || 'AM';
    if (uDept === 'SPECIAL') uDept = 'AM'; // 🌟 เพิ่มบรรทัดนี้: ให้กลุ่มพิเศษดึงสิทธิ์เมนู AM มาใช้
    
    // 🆕 ใช้ Role จริงของพนักงาน (รองรับ Role ที่สร้างเอง เช่น SUPERVISOR)
    // ถ้า Role นั้นยังไม่เคยตั้งสิทธิ์ไว้เลย ให้ถอยไปใช้ชุด STAFF ของแผนกแทน (พฤติกรรมเดิม จะได้ไม่มีใครเมนูหายกะทันหัน)
    const uRole = uRoleLower ? uRoleLower.toUpperCase() : 'STAFF';
    let userPerms = perms[`${uDept}_${uRole}`];
    if (!Array.isArray(userPerms)) userPerms = perms[`${uDept}_STAFF`] || [];
    return userPerms.includes(menuId);
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

    const userRole = (user.role || '').toLowerCase().trim();
    
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
                    if (hasAnyDiscordPerm || ['admin', 'manager'].includes(userRole)) shouldShow = true;
                }

                if (onClickAttr.includes("toggleSubMenu('menu-admin'") || onClickAttr.includes("openAdminPanel()")) {
                    if (window.hasUserPerm('admin') || ['admin', 'manager'].includes(userRole)) shouldShow = true;
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
            const canSeeLogs = ['admin', 'manager'].includes(userRole) || window.hasUserPerm('admin_logs');
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
    if (typeof appDB !== 'undefined' && !['admin', 'manager'].includes(userRole)) {
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

// รวมข้อมูลทุกทรง (แบน/มีช่วงซ้อน) ให้เป็น กะ → [เวลา เรียง ไม่ซ้ำ]
function _flattenShiftSlots(deptObj) {
    const out = {};
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s||'')); return m ? (+m[1])*60+(+m[2]) : 9999; };
    for (const [shift, val] of Object.entries(deptObj || {})) {
        let arr = [];
        if (Array.isArray(val)) arr = val;                                         // ทรงใหม่อยู่แล้ว
        else if (val && typeof val === 'object') Object.values(val).forEach(a => { if (Array.isArray(a)) arr = arr.concat(a); });   // ทรงเก่ามีช่วง → เทรวม
        arr = [...new Set(arr)].sort((a, b) => toMin(a) - toMin(b));
        if (arr.length) out[shift] = arr;
    }
    return out;
}

window.applyCustomTimeSlots = function() {
    try {
        let rawData = SETTINGS['custom_time_slots'] || SETTINGS['shift_time_slots'] || SETTINGS['manual_time_slots'];

        // 💡 ค่าเริ่มต้นชุดใหม่ (ตามประกาศรอบพักเบรค) — ใช้เมื่อฐานข้อมูลยังไม่มีค่า
        // กติกาโดยดีไซน์: ชั่วโมงแรกหลังเข้างาน และชั่วโมงสุดท้ายก่อนเลิกงาน ไม่มีรอบให้ลง
        const defaultTimeSlots = {
            'กะเช้า': [   // 08:00-20:00
                '09:00-09:30', '09:30-10:00',
                '12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00',
                '16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00', '18:00-18:30'
            ],
            'กะกลาง': [   // 11:00-23:00
                '12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00',
                '16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00', '18:00-18:30',
                '21:00-21:30', '21:30-22:00'
            ],
            'กะดึก': [    // 20:00-08:00
                '21:00-21:30', '21:30-22:00', '22:00-22:30', '22:30-23:00', '23:00-23:30',
                '02:00-02:30', '02:30-03:00', '03:00-03:30', '03:30-04:00',
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
        SHIFT_GROUPS = window.SHIFT_GROUPS_ALL[window._slotsViewerDept()] || {};
    } catch(e) { console.error('Error applying custom time slots:', e); }
};

window.renderManualTimeSlots = function() {
    const container = document.getElementById('manualTimeSlotsContainer');
    if (!container) return;

    let html = '', count = 0;
    for (const dep of ['AM', 'OD']) {
        const groups = (window.SHIFT_GROUPS_ALL && window.SHIFT_GROUPS_ALL[dep]) || {};
        let depHtml = '';
        for (const [shift, slots] of Object.entries(groups)) {
            (slots || []).forEach(slot => {
                const sName = shift.replace('กะ', '');
                const colorClass = sName === 'เช้า' ? 'text-orange-400' : (sName === 'กลาง' ? 'text-blue-400' : 'text-purple-400');
                depHtml += `
                <div class="flex justify-between items-center bg-slate-800 p-2 rounded-lg border border-slate-600/50 shadow-sm mb-1.5">
                    <div class="flex items-center gap-2 text-[10px] font-bold ${colorClass}">
                        <span class="w-12">${sName}</span>
                        <span class="text-gray-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700 tracking-wider shadow-inner">${slot}</span>
                    </div>
                    <button type="button" onclick="deleteManualTimeSlot('${dep}', '${shift}', '${slot}')" class="text-red-400 hover:text-red-500 hover:bg-red-900/30 p-1 rounded transition" title="ลบเวลา">
                        <span class="material-icons text-[14px]">delete</span>
                    </button>
                </div>`;
                count++;
            });
        }
        if (depHtml) {
            const depColor = dep === 'AM' ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-pink-300 border-pink-500/40 bg-pink-500/10';
            html += `<div class="text-[10px] font-black ${depColor} border rounded-lg px-2 py-1 mb-1.5 mt-2 inline-block">แผนก ${dep}</div>` + depHtml;
        }
    }
    container.innerHTML = count === 0 ? '<div class="text-center text-gray-600 text-xs py-4">ยังไม่มีการตั้งค่า</div>' : html;
};

window.addManualTimeSlot = async function() {
    if (!window.sysRequireAdmin()) return;

    const depEl = document.getElementById('newTimeDept');
    const dep = (depEl && depEl.value === 'OD') ? 'OD' : 'AM';
    const shiftSelect = document.getElementById('newTimeShift').value;
    const start = document.getElementById('newTimeStart').value;
    const end = document.getElementById('newTimeEnd').value;

    if (!start || !end) return Swal.fire('เตือน', 'กรุณาระบุเวลาให้ครบ', 'warning');
    if (start >= end) return Swal.fire('เตือน', 'เวลาเริ่มต้องน้อยกว่าเวลาจบ', 'warning');

    const timeSlot = `${start}-${end}`;
    const G = window.SHIFT_GROUPS_ALL[dep] = window.SHIFT_GROUPS_ALL[dep] || {};
    if (!Array.isArray(G[shiftSelect])) G[shiftSelect] = [];
    if (G[shiftSelect].includes(timeSlot)) return Swal.fire('เตือน', `แผนก ${dep} มีรอบเวลานี้อยู่แล้ว`, 'warning');

    G[shiftSelect].push(timeSlot);
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s); return m ? (+m[1])*60+(+m[2]) : 9999; };
    G[shiftSelect].sort((a, b) => toMin(a) - toMin(b));

    SETTINGS['custom_time_slots'] = JSON.stringify(window.SHIFT_GROUPS_ALL);
    SHIFT_GROUPS = window.SHIFT_GROUPS_ALL[window._slotsViewerDept()] || {};

    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(window.SHIFT_GROUPS_ALL) }]);

    renderManualTimeSlots();
    document.getElementById('newTimeStart').value = '';
    document.getElementById('newTimeEnd').value = '';
    Swal.fire({icon: 'success', title: `เพิ่มให้แผนก ${dep} สำเร็จ`, timer: 1200, showConfirmButton: false});
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
