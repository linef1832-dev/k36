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
        id: 'page_usdt_calc', name: 'คำนวณ USDT / THB', icon: 'currency_exchange', theme: 'emerald',
        items: [
            {id: 'usdt_calc', name: 'เข้าหน้าคำนวณ USDT', isSub: false}
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

// ฟังก์ชันคลิกพื้นที่ว่างแล้วให้ป๊อปอัปปิด
document.addEventListener('click', function(e) {
    if (!e.target.closest('.perm-cell') && !e.target.closest('.swal2-container')) {
        document.querySelectorAll('.perm-popup').forEach(el => el.classList.add('hidden'));
    }
});

// ฟังก์ชันเปิด/ปิด ป๊อปอัปสิทธิ์เมนู
window.togglePermPopup = function(key) {
    const popup = document.getElementById('popup_' + key);
    const isHidden = popup.classList.contains('hidden');
    document.querySelectorAll('.perm-popup').forEach(p => p.classList.add('hidden'));
    if (isHidden) popup.classList.remove('hidden');
};

// ตัวแปรเก็บว่าแต่ละบรรทัดเลือก Role อะไรอยู่
window.permRowSelections = window.permRowSelections || {
    'AM': 'STAFF',
    'OD': 'STAFF',
    'AMQL': 'TRAINER'
};

window.changePermRowRole = function(dept, newRole) {
    window.permRowSelections[dept] = newRole;
    renderPermsTable();
};

window.renderPermsTable = function() {
    try {
        if (typeof SETTINGS['dept_menu_rules'] === 'string') MENU_PERMS = JSON.parse(SETTINGS['dept_menu_rules']);
        else if (SETTINGS['dept_menu_rules']) MENU_PERMS = SETTINGS['dept_menu_rules'];
        else MENU_PERMS = {};
    } catch(e) { MENU_PERMS = {}; }

    const tbody = document.getElementById('permTableBody');
    if(!tbody) return;

    // 🌟 1. ดึงชื่อแผนกจากฐานข้อมูล (DB)
    const depts = typeof window.getSystemDepts === 'function' ? window.getSystemDepts() : ['AM', 'OD', 'AMQL'];
    
    let bodyHtml = '';

    // 🌟 2. ดึงชื่อ Role จากฐานข้อมูล (DB) และรายชื่อพนักงาน
    let dbRoles = [];
    try { dbRoles = JSON.parse(SETTINGS['custom_roles'] || '[]'); } catch(e) {}
    let allSystemRoles = [...new Set(['staff', 'trainer', 'manager', ...dbRoles])];

    if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach(u => {
            if (u.role && !allSystemRoles.includes(u.role.toLowerCase())) {
                allSystemRoles.push(u.role.toLowerCase());
            }
        });
    }

    const colorClasses = {
        'blue': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        'rose': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        'pink': 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        'amber': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        'green': 'text-green-400 bg-green-500/10 border-green-500/20',
        'orange': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        'indigo': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        'sky': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        'emerald': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        'purple': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        'red': 'text-red-400 bg-red-500/10 border-red-500/20',
        'teal': 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    };

    const themeHexColors = {
        'blue': '#3b82f6', 'rose': '#f43f5e', 'pink': '#ec4899', 'amber': '#f59e0b',
        'green': '#22c55e', 'orange': '#f97316', 'indigo': '#6366f1', 'sky': '#0ea5e9',
        'emerald': '#10b981', 'purple': '#a855f7', 'red': '#ef4444', 'teal': '#14b8a6',
    };

    depts.forEach(dept => {
        const role = window.permRowSelections[dept] || 'STAFF';
        const key = `${dept}_${role}`;
        const activePerms = MENU_PERMS[key] || [];

        // 🌟 สร้าง Dropdown ของ Role รอไว้
        let dynamicRoleOpts = '';
        allSystemRoles.forEach(r => {
            let rUpper = r.toUpperCase();
            dynamicRoleOpts += `<option value="${rUpper}" ${role === rUpper ? 'selected' : ''} class="bg-slate-800 text-white font-bold">${rUpper}</option>`;
        });
        
        let badgesHtml = '<div class="grid grid-cols-2 xl:grid-cols-3 gap-3 w-full content-start items-start">';
        let activeCount = 0;

        PERM_GROUPS.forEach(g => {
            const activeItemsInGroup = g.items.filter(i => activePerms.includes(i.id));
            if (activeItemsInGroup.length > 0) {
                activeCount++;
                const themeClass = colorClasses[g.theme] || colorClasses['blue'];
                const iconColor = themeClass.split(' ')[0]; 

                let itemsHtml = '';
                activeItemsInGroup.forEach(item => {
                    if (item.isSub) {
                        itemsHtml += `<span class="bg-slate-700/50 text-gray-300 border border-slate-600/50 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shadow-sm mt-1">${item.name}</span>`;
                    } else {
                        itemsHtml += `<span class="${themeClass} border px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-sm mt-1">${item.name}</span>`;
                    }
                });

                badgesHtml += `
                    <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-3 flex flex-col shadow-inner hover:border-slate-500 transition h-fit">
                        <div class="flex items-center gap-2 border-b border-slate-700/50 pb-2 mb-1">
                            <span class="material-icons text-[16px] ${iconColor}">${g.icon}</span>
                            <span class="font-bold text-white text-[11px] truncate">${g.name}</span>
                        </div>
                        <div class="flex flex-wrap gap-1 content-start">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            }
        });
        badgesHtml += '</div>';
        if (activeCount === 0) {
            badgesHtml = `<div class="flex flex-col items-center justify-center py-6 text-gray-500 w-full"><span class="material-icons text-4xl mb-2 opacity-30">admin_panel_settings</span><span class="text-sm font-bold">คลิกที่นี่เพื่อกำหนดสิทธิ์การเข้าถึง</span></div>`;
        }

        let popupContentHtml = `
            <div id="popup_${key}" class="perm-popup absolute top-full left-0 mt-2 bg-[#0f172a] border border-slate-600 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[950px] z-[99] hidden cursor-default overflow-hidden flex-col">
                
                <div class="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 p-5 flex justify-between items-center shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-500/20 text-blue-400 p-2 rounded-xl shadow-inner border border-blue-500/30"><span class="material-icons text-xl block">tune</span></div>
                        <div>
                            <h4 class="text-white font-black text-lg leading-tight tracking-wide">จัดการสิทธิ์ <span class="text-blue-400">(${dept})</span></h4>
                            <p class="text-[10px] text-gray-400 mt-0.5">ระบุการเข้าถึงหน้าเว็บและเครื่องมือต่างๆ สำหรับ ${role}</p>
                        </div>
                    </div>
                    <button onclick="togglePermPopup('${key}')" class="text-gray-400 hover:text-white bg-slate-700/50 hover:bg-red-500 rounded-full w-8 h-8 flex items-center justify-center transition border border-slate-600 shadow-sm"><span class="material-icons text-[16px]">close</span></button>
                </div>

                <div class="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-900/50">
                    <div class="grid grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        `;
        
        PERM_GROUPS.forEach(g => {
            const themeClass = colorClasses[g.theme] || colorClasses['blue'];
            const themeColorHex = themeHexColors[g.theme] || '#3b82f6';
            const iconColor = themeClass.split(' ')[0];
            
            popupContentHtml += `
                <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm hover:border-slate-500 transition">
                    <div class="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                        <span class="material-icons text-[18px] ${iconColor}">${g.icon}</span>
                        <span class="font-bold text-white text-[11px] tracking-wide">${g.name}</span>
                    </div>
                    <div class="p-3 bg-slate-800/80 flex flex-col gap-0.5">
            `;
            
            g.items.forEach(item => {
                const isCheckedAttr = activePerms.includes(item.id) ? 'checked' : '';
                const bgOpacity = activePerms.includes(item.id) ? '1' : '0';
                const borderColor = activePerms.includes(item.id) ? 'transparent' : '';
                const marginLeft = item.isSub ? 'ml-6 pl-2 border-l-2 border-slate-600/50' : 'font-bold bg-slate-700/30 rounded-lg p-1 mb-1';
                const textStyle = item.isSub ? 'text-gray-400 text-[10px]' : 'text-gray-200 text-[11px]';
                
                popupContentHtml += `
                    <label class="relative flex items-center gap-3 ${textStyle} cursor-pointer hover:bg-slate-700 p-2 rounded-lg transition ${marginLeft} group">
                        <input type="checkbox" class="perm-cb absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                               data-key="${key}" data-menu="${item.id}" ${isCheckedAttr}
                               onchange="
                                  this.nextElementSibling.style.borderColor = this.checked ? 'transparent' : '';
                                  this.nextElementSibling.querySelector('.check-bg').style.opacity = this.checked ? '1' : '0';
                                  this.nextElementSibling.querySelector('.check-icon').style.opacity = this.checked ? '1' : '0';
                                  this.nextElementSibling.querySelector('.check-icon').style.transform = this.checked ? 'scale(1)' : 'scale(0.5)';
                               ">
                        <div class="relative w-4 h-4 shrink-0 rounded border-2 border-slate-500 bg-slate-900 transition-all flex items-center justify-center shadow-inner" style="border-color: ${borderColor};">
                            <div class="check-bg absolute inset-0 rounded transition-opacity duration-200" style="background-color: ${themeColorHex}; opacity: ${bgOpacity};"></div>
                            <span class="check-icon material-icons text-[12px] text-white font-bold z-10 transition-all duration-200" style="opacity: ${bgOpacity}; transform: scale(${bgOpacity === '1' ? '1' : '0.5'});">check</span>
                        </div>
                        <span class="flex-1 select-none leading-none group-hover:text-white transition-colors pt-0.5 z-10">${item.name}</span>
                    </label>`;
            });
            popupContentHtml += `</div></div>`;
        });
        
        popupContentHtml += `
                    </div>
                </div>
                <div class="bg-slate-800 border-t border-slate-700 p-5 flex justify-between items-center shrink-0">
                    <span class="text-[10px] text-gray-500 flex items-center gap-1"><span class="material-icons text-[14px]">info</span> กดติ๊กถูกเพื่อเปิดสิทธิ์การใช้งานให้เมนูนั้นๆ</span>
                    <div class="flex gap-2">
                        <button onclick="togglePermPopup('${key}')" class="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-slate-700 transition border border-slate-600 shadow-sm">ยกเลิก</button>
                        <button onclick="saveMenuPerms()" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1 border border-blue-400 active:scale-95"><span class="material-icons text-[16px]">save</span> บันทึกสิทธิ์</button>
                    </div>
                </div>
            </div>`;

        let roleColor = role === 'TRAINER' ? 'bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-700' : (role === 'MANAGER' ? 'bg-red-900/30 text-red-400 border-red-700' : 'bg-purple-900/30 text-purple-400 border-purple-700');
        let iconColor = role === 'TRAINER' ? 'text-fuchsia-400' : (role === 'MANAGER' ? 'text-red-400' : 'text-purple-400');

        // 🌟 สร้างกลุ่มปุ่มจัดการ (แก้ไขได้ทุกแผนก, ลบได้เฉพาะแผนกที่สร้างเอง)
        let deptActionBtns = `
        <div class="absolute -top-3 -right-3 flex gap-1 z-30">
            <button onclick="renameAnyDept('${dept}')" class="bg-amber-500 hover:bg-amber-400 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition active:scale-95" title="เปลี่ยนชื่อแผนก"><span class="material-icons text-[12px]">edit</span></button>
            ${!['AM', 'OD', 'AMQL'].includes(dept) ? `<button onclick="deleteCustomPermDept('${dept}')" class="bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition active:scale-95" title="ลบแผนก"><span class="material-icons text-[12px]">close</span></button>` : ''}
        </div>`;

        bodyHtml += `
        <tr class="hover:bg-slate-800/30 transition border-b border-slate-700/50">
            <td class="px-6 py-5 border-r border-slate-700 align-top">
                <div class="relative bg-slate-900 border border-slate-600 px-3 py-3 rounded-xl font-black text-white shadow-inner text-sm w-32 text-center tracking-wider">
                    ${dept}
                    ${deptActionBtns}
                </div>
            </td>
            
            <td class="px-6 py-5 border-r border-slate-700 align-top">
                <div class="relative w-32">
                    <select onchange="changePermRowRole('${dept}', this.value)" class="${roleColor} border px-3 py-3 rounded-xl font-black text-[11px] shadow-sm w-full outline-none cursor-pointer appearance-none focus:ring-2 focus:ring-purple-500 transition relative z-10 text-center tracking-wide">
                        ${dynamicRoleOpts}
                    </select>
                    <span class="material-icons text-[14px] opacity-70 absolute right-2.5 top-3 pointer-events-none z-20 ${iconColor}">expand_more</span>
                </div>
            </td>
            
            <td class="px-6 py-5 border-r border-slate-700 align-top relative perm-cell" style="overflow: visible;">
                <div onclick="togglePermPopup('${key}')" class="bg-slate-900/30 border border-slate-700 p-4 rounded-2xl min-h-[60px] cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/50 transition shadow-inner">
                    ${badgesHtml}
                </div>
                ${popupContentHtml}
            </td>

            <td class="px-6 py-5 text-center align-middle bg-slate-900/20">
                <button onclick="saveMenuPerms()" class="bg-emerald-600/10 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition shadow mx-auto group">
                    <span class="material-icons text-xl group-hover:scale-110 transition-transform">save</span>
                    <span class="text-[9px] font-bold mt-1">บันทึก</span>
                </button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = bodyHtml;
};

window.saveMenuPerms = async function() {
    if (!window.sysRequireAdmin()) return;

    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    
    // คัดลอกสิทธิ์เดิมมาทั้งหมด เพื่อป้องกันการบันทึกทับข้อมูลของแผนกที่ไม่ได้โชว์อยู่
    let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
    
    // หากุญแจ (key) ที่กำลังเปิดให้แก้อยู่ตอนนี้
    const visibleKeys = new Set();
    document.querySelectorAll('.perm-cb').forEach(cb => {
        visibleKeys.add(cb.getAttribute('data-key'));
    });
    
    // ล้างเฉพาะค่าของ key ที่กำลังแก้อยู่
    visibleKeys.forEach(k => { newPerms[k] = []; });

    // วนลูปอ่านค่าที่ติ๊กถูก แล้วเอามาใส่เข้าไปใหม่
    document.querySelectorAll('.perm-cb:checked').forEach(cb => {
        const key = cb.getAttribute('data-key');
        const menu = cb.getAttribute('data-menu');
        newPerms[key].push(menu);
    });

    MENU_PERMS = newPerms;
    SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
    window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));
    
    await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: 'อัปเดตสิทธิ์การมองเห็นเมนูเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false});
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
    
    const uRole = uRoleLower === 'trainer' ? 'TRAINER' : 'STAFF';
    const key = `${uDept}_${uRole}`;
    
    const userPerms = perms[key] || [];
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
// 🟢 ระบบเพิ่มรอบเวลาเอง (ดึงข้อมูลเก่า + ค่าเริ่มต้น)
// =========================================================

window.applyCustomTimeSlots = function() {
    try {
        let rawData = SETTINGS['custom_time_slots'] || SETTINGS['shift_time_slots'] || SETTINGS['manual_time_slots'];
        
        if (!rawData) {
            // 💡 ถ้าในฐานข้อมูลไม่มี ให้ดึงเวลาตั้งต้น (Default) ของระบบเก่ามาใช้เลย
            const defaultTimeSlots = {
                'กะเช้า': {
                    'ช่วงที่ 1': ['08:00-08:30', '08:30-09:00', '09:00-09:30', '09:30-10:00'],
                    'ช่วงที่ 2': ['12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00'],
                    'ช่วงที่ 3': ['16:00-16:30', '16:30-17:00']
                },
                'กะกลาง': {
                    'ช่วงที่ 1': ['12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00'],
                    'ช่วงที่ 2': ['16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00'],
                    'ช่วงที่ 3': ['20:00-20:30', '20:30-21:00', '21:00-21:30']
                },
                'กะดึก': {
                    'ช่วงที่ 1': ['20:00-20:30', '20:30-21:00', '21:00-21:30', '21:30-22:00'],
                    'ช่วงที่ 2': ['00:00-00:30', '00:30-01:00', '01:00-01:30', '01:30-02:00'],
                    'ช่วงที่ 3': ['04:00-04:30', '04:30-05:00', '05:00-05:30', '05:30-06:00']
                }
            };
            SHIFT_GROUPS = defaultTimeSlots;
        } else {
            SHIFT_GROUPS = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        }
    } catch(e) { console.error('Error applying custom time slots:', e); }
};

window.renderManualTimeSlots = function() {
    const container = document.getElementById('manualTimeSlotsContainer');
    if (!container) return;

    let html = '';
    let count = 0;

    // ดึงค่าจาก SHIFT_GROUPS มาวาดลงตาราง
    for (const [shift, periods] of Object.entries(SHIFT_GROUPS)) {
        for (const [period, slots] of Object.entries(periods)) {
            slots.forEach(slot => {
                let sName = shift.replace('กะ', '');
                let pName = period.replace('ช่วงที่ ', 'P');
                let colorClass = sName === 'เช้า' ? 'text-orange-400' : (sName === 'กลาง' ? 'text-blue-400' : 'text-purple-400');
                
                html += `
                <div class="flex justify-between items-center bg-slate-800 p-2 rounded-lg border border-slate-600/50 shadow-sm mb-1.5">
                    <div class="flex items-center gap-2 text-[10px] font-bold ${colorClass}">
                        <span class="w-12">${sName} ${pName}</span>
                        <span class="text-gray-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700 tracking-wider shadow-inner">${slot}</span>
                    </div>
                    <button type="button" onclick="deleteManualTimeSlot('${shift}', '${period}', '${slot}')" class="text-red-400 hover:text-red-500 hover:bg-red-900/30 p-1 rounded transition" title="ลบเวลา">
                        <span class="material-icons text-[14px]">delete</span>
                    </button>
                </div>`;
                count++;
            });
        }
    }

    if (count === 0) {
        container.innerHTML = '<div class="text-center text-gray-600 text-xs py-4">ยังไม่มีการตั้งค่า</div>';
    } else {
        container.innerHTML = html;
    }
};

window.addManualTimeSlot = async function() {
    if (!window.sysRequireAdmin()) return;

    const shiftSelect = document.getElementById('newTimeShift').value; 
    const periodSelect = document.getElementById('newTimePeriod').value; 
    const start = document.getElementById('newTimeStart').value;
    const end = document.getElementById('newTimeEnd').value;

    if (!start || !end) return Swal.fire('เตือน', 'กรุณาระบุเวลาให้ครบ', 'warning');
    if (start >= end) return Swal.fire('เตือน', 'เวลาเริ่มต้องน้อยกว่าเวลาจบ', 'warning');

    const timeSlot = `${start}-${end}`;

    if (!SHIFT_GROUPS[shiftSelect]) SHIFT_GROUPS[shiftSelect] = {};
    if (!SHIFT_GROUPS[shiftSelect][periodSelect]) SHIFT_GROUPS[shiftSelect][periodSelect] = [];
    
    if (SHIFT_GROUPS[shiftSelect][periodSelect].includes(timeSlot)) {
        return Swal.fire('เตือน', 'มีรอบเวลานี้อยู่แล้ว', 'warning');
    }

    SHIFT_GROUPS[shiftSelect][periodSelect].push(timeSlot);
    SHIFT_GROUPS[shiftSelect][periodSelect].sort();

    SETTINGS['custom_time_slots'] = JSON.stringify(SHIFT_GROUPS);
    
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(SHIFT_GROUPS) }]);
    
    renderManualTimeSlots();
    
    document.getElementById('newTimeStart').value = '';
    document.getElementById('newTimeEnd').value = '';
    
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
};

window.deleteManualTimeSlot = async function(shift, period, timeSlot) {
    if (!window.sysRequireAdmin()) return;

    if (SHIFT_GROUPS[shift] && SHIFT_GROUPS[shift][period]) {
        SHIFT_GROUPS[shift][period] = SHIFT_GROUPS[shift][period].filter(t => t !== timeSlot);
        if (SHIFT_GROUPS[shift][period].length === 0) delete SHIFT_GROUPS[shift][period];
        if (Object.keys(SHIFT_GROUPS[shift]).length === 0) delete SHIFT_GROUPS[shift];
    }

    SETTINGS['custom_time_slots'] = JSON.stringify(SHIFT_GROUPS);
    
    Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(SHIFT_GROUPS) }]);
    
    renderManualTimeSlots();
    Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
};

// ==========================================