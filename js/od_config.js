// ==========================================
// ⚙️ OD Form Bot Config Manager
// เก็บ config ใน Supabase settings key: 'od_form_config'
// ส่วนขยาย Chrome ดึงผ่าน Railway endpoint /config
// ==========================================

const OD_CFG_KEY = 'od_form_config';

let odCfgData = {
    webs:    [],   // [{ name, color }]
    promos:  {},   // { webName: [promo1, promo2, ...] }
    reasons: [],   // [string]
    server_url: 'https://od-form-bot-production.up.railway.app',
    chat_id: '',
};

// ── โหลด config จาก Supabase ──────────────────────────────────────
window.initOdConfig = async function() {
    // เช็คสิทธิ์
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');
    if (!isAdmin && !window.hasUserPerm('od_config')) {
        document.getElementById('odConfigApp').innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <span class="material-icons text-6xl mb-3 text-red-400">lock</span>
                <p class="font-bold text-lg text-white">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
                <p class="text-sm mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>`;
        return;
    }

    odCfg_showStatus('กำลังโหลดข้อมูล...', 'loading');

    try {
        const { data, error } = await appDB
            .from('settings')
            .select('value')
            .eq('key', OD_CFG_KEY)
            .maybeSingle();

        if (data && data.value) {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            odCfgData = { ...odCfgData, ...parsed };
        } else {
            // ครั้งแรก — ใช้ค่า default
            odCfgData = {
                webs: [
                    { name: 'Jun88', color: '#2481cc' }, { name: 'MK8',   color: '#888888' },
                    { name: 'F168',  color: '#e67e22' }, { name: 'PG688', color: '#9b59b6' },
                    { name: 'JL69',  color: '#f1c40f' }, { name: 'BT678', color: '#aaaaaa' },
                    { name: 'K188',  color: '#c9a84c' }, { name: 'VV72',  color: '#f1c40f' },
                    { name: 'NM9',   color: '#e74c3c' }, { name: 'TH26',  color: '#e67e22' },
                ],
                promos: {
                    'Jun88': ['KM68','LA100','FAK200','USDT','BN'],
                    'MK8':   ['KM28','LA20','FAK200','USDT','BN'],
                    'F168':  ['KM68','LA100','FAK200','USDT','BN'],
                    'PG688': ['KM28','FAK188','FAK200','USDT','BN'],
                    'JL69':  ['KM26','FAK188','FAK200','USDT','BN'],
                    'NM9':   ['KM26','FAK188','FAK200','USDT','BN'],
                    'BT678': ['KM28','FAK188','FAK200','USDT','BN'],
                    'VV72':  ['KM28','FAK188','FAK200','USDT','BN'],
                    'K188':  ['FREE28','FAK188','FAK200','USDT','BN'],
                    'TH26':  ['FREE28','FAK188','FAK200','USDT','BN'],
                },
                reasons: ['ตรวจพบหลายยูสเซอร์รับโปรโมชั่น'],
                server_url: 'https://od-form-bot-production.up.railway.app',
                chat_id: '',
            };
        }

        odCfg_renderAll();
        odCfg_showStatus('โหลดข้อมูลสำเร็จ', 'success');
        setTimeout(() => odCfg_hideStatus(), 2000);

    } catch(e) {
        odCfg_showStatus('โหลดไม่สำเร็จ: ' + e.message, 'error');
    }
};

// ── บันทึก config ลง Supabase ─────────────────────────────────────
window.odCfg_save = async function() {
    odCfg_showStatus('กำลังบันทึก...', 'loading');
    try {
        // เก็บค่าจาก input
        odCfgData.server_url = document.getElementById('odCfgServerUrl').value.trim();
        odCfgData.chat_id    = document.getElementById('odCfgChatId').value.trim();

        const { error } = await appDB.from('settings').upsert([{
            key: OD_CFG_KEY,
            value: JSON.stringify(odCfgData)
        }]);

        if (error) throw error;

        odCfg_showStatus('✅ บันทึกสำเร็จ! ส่วนขยายจะดึงค่าใหม่เมื่อเปิดครั้งถัดไป', 'success');
        odCfg_refreshPreview();
        setTimeout(() => odCfg_hideStatus(), 4000);

    } catch(e) {
        odCfg_showStatus('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
};

// ── Render ทั้งหมด ─────────────────────────────────────────────────
function odCfg_renderAll() {
    odCfg_renderWebs();
    odCfg_renderReasons();
    odCfg_renderPromoWebSel();
    odCfg_renderPromos();
    odCfg_refreshPreview();

    const su = document.getElementById('odCfgServerUrl');
    const ci = document.getElementById('odCfgChatId');
    if (su) su.value = odCfgData.server_url || '';
    if (ci) ci.value = odCfgData.chat_id || '';
}

// ── เว็บ ───────────────────────────────────────────────────────────
function odCfg_renderWebs() {
    const list = document.getElementById('odCfgWebList');
    if (!list) return;
    if (odCfgData.webs.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-xs text-center py-4">ยังไม่มีเว็บ</p>';
        return;
    }
    list.innerHTML = odCfgData.webs.map((w, i) => `
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <span class="w-3 h-3 rounded-full shrink-0" style="background:${w.color}"></span>
            <span class="flex-1 font-bold text-sm text-slate-800 dark:text-white">${w.name}</span>
            <input type="color" value="${w.color}" title="เปลี่ยนสี"
                onchange="odCfgData.webs[${i}].color=this.value; odCfg_renderWebs(); odCfg_renderPromoWebSel();"
                class="w-7 h-7 rounded border-none cursor-pointer p-0">
            <button onclick="odCfg_editWeb(${i})" class="text-sky-400 hover:text-sky-300 text-xs px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-900/20 transition">✏️</button>
            <button onclick="odCfg_delWeb(${i})" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-500/30 hover:bg-red-900/20 transition">🗑️</button>
        </div>`).join('');
}

window.odCfg_addWeb = async function() {
    const { value: name } = await Swal.fire({
        title: 'เพิ่มเว็บใหม่', input: 'text', inputPlaceholder: 'ชื่อเว็บ เช่น KK789',
        showCancelButton: true, confirmButtonText: 'เพิ่ม', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!name) return;
    odCfgData.webs.push({ name: name.trim().toUpperCase(), color: '#2481cc' });
    if (!odCfgData.promos[name]) odCfgData.promos[name] = [];
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

window.odCfg_editWeb = async function(i) {
    const { value: name } = await Swal.fire({
        title: 'แก้ไขชื่อเว็บ', input: 'text', inputValue: odCfgData.webs[i].name,
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!name) return;
    const old = odCfgData.webs[i].name;
    odCfgData.webs[i].name = name.trim().toUpperCase();
    if (odCfgData.promos[old]) { odCfgData.promos[odCfgData.webs[i].name] = odCfgData.promos[old]; delete odCfgData.promos[old]; }
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

window.odCfg_delWeb = async function(i) {
    const { isConfirmed } = await Swal.fire({
        title: `ลบเว็บ "${odCfgData.webs[i].name}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    delete odCfgData.promos[odCfgData.webs[i].name];
    odCfgData.webs.splice(i, 1);
    odCfg_renderWebs(); odCfg_renderPromoWebSel(); odCfg_refreshPreview();
};

// ── โปรแยกตามเว็บ ─────────────────────────────────────────────────
function odCfg_renderPromoWebSel() {
    const sel = document.getElementById('odCfgPromoWebSel');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- เลือกเว็บ --</option>';
    odCfgData.webs.forEach(w => {
        sel.innerHTML += `<option value="${w.name}" ${w.name===cur?'selected':''}>${w.name}</option>`;
    });
    odCfg_renderPromos();
}

window.odCfg_renderPromos = function() {
    const web  = document.getElementById('odCfgPromoWebSel')?.value;
    const list = document.getElementById('odCfgPromoList');
    if (!list) return;
    if (!web) { list.innerHTML = '<div class="text-gray-400 text-sm m-auto py-4">เลือกเว็บเพื่อดูรหัสโปร</div>'; return; }
    const promos = odCfgData.promos[web] || [];
    if (promos.length === 0) { list.innerHTML = '<div class="text-gray-400 text-sm py-4">ยังไม่มีรหัสโปรสำหรับเว็บนี้</div>'; return; }
    list.innerHTML = promos.map((p, i) => `
        <div class="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700/50 rounded-xl px-3 py-1.5">
            <span class="text-yellow-600 dark:text-yellow-400 font-bold text-sm">⭐ ${p}</span>
            <button onclick="odCfg_editPromo('${web}',${i})" class="text-xs text-sky-400 hover:text-sky-300 ml-1">✏️</button>
            <button onclick="odCfg_delPromo('${web}',${i})" class="text-xs text-red-400 hover:text-red-300">🗑️</button>
        </div>`).join('');
};

window.odCfg_addPromo = async function() {
    const web = document.getElementById('odCfgPromoWebSel')?.value;
    if (!web) return Swal.fire('เตือน', 'กรุณาเลือกเว็บก่อนครับ', 'warning');
    const { value } = await Swal.fire({
        title: `เพิ่มรหัสโปรให้ ${web}`, input: 'text', inputPlaceholder: 'เช่น KM28',
        showCancelButton: true, confirmButtonText: 'เพิ่ม',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    if (!odCfgData.promos[web]) odCfgData.promos[web] = [];
    odCfgData.promos[web].push(value.trim().toUpperCase());
    odCfg_renderPromos(); odCfg_refreshPreview();
};

window.odCfg_editPromo = async function(web, i) {
    const { value } = await Swal.fire({
        title: 'แก้ไขรหัสโปร', input: 'text', inputValue: odCfgData.promos[web][i],
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.promos[web][i] = value.trim().toUpperCase();
    odCfg_renderPromos(); odCfg_refreshPreview();
};

window.odCfg_delPromo = async function(web, i) {
    const { isConfirmed } = await Swal.fire({
        title: `ลบรหัส "${odCfgData.promos[web][i]}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.promos[web].splice(i, 1);
    odCfg_renderPromos(); odCfg_refreshPreview();
};

// ── สาเหตุ ─────────────────────────────────────────────────────────
function odCfg_renderReasons() {
    const list = document.getElementById('odCfgReasonList');
    if (!list) return;
    if (odCfgData.reasons.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-xs text-center py-4">ยังไม่มีสาเหตุ</p>';
        return;
    }
    list.innerHTML = odCfgData.reasons.map((r, i) => `
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <span class="flex-1 text-sm text-slate-800 dark:text-white">${r}</span>
            <button onclick="odCfg_editReason(${i})" class="text-sky-400 text-xs px-2 py-1 rounded border border-sky-500/30 hover:bg-sky-900/20 transition">✏️</button>
            <button onclick="odCfg_delReason(${i})" class="text-red-400 text-xs px-2 py-1 rounded border border-red-500/30 hover:bg-red-900/20 transition">🗑️</button>
        </div>`).join('');
}

window.odCfg_addReason = async function() {
    const { value } = await Swal.fire({
        title: 'เพิ่มสาเหตุใหม่', input: 'text', inputPlaceholder: 'พิมพ์สาเหตุ...',
        showCancelButton: true, confirmButtonText: 'เพิ่ม',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.reasons.push(value.trim());
    odCfg_renderReasons(); odCfg_refreshPreview();
};

window.odCfg_editReason = async function(i) {
    const { value } = await Swal.fire({
        title: 'แก้ไขสาเหตุ', input: 'text', inputValue: odCfgData.reasons[i],
        showCancelButton: true, confirmButtonText: 'บันทึก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!value) return;
    odCfgData.reasons[i] = value.trim();
    odCfg_renderReasons(); odCfg_refreshPreview();
};

window.odCfg_delReason = async function(i) {
    const { isConfirmed } = await Swal.fire({
        title: 'ลบสาเหตุนี้?', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#ef4444',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    });
    if (!isConfirmed) return;
    odCfgData.reasons.splice(i, 1);
    odCfg_renderReasons(); odCfg_refreshPreview();
};

// ── Preview JSON ───────────────────────────────────────────────────
window.odCfg_refreshPreview = function() {
    const el = document.getElementById('odCfgPreview');
    if (!el) return;
    const preview = {
        webs:    odCfgData.webs,
        promos:  odCfgData.promos,
        reasons: odCfgData.reasons,
        chat_id: odCfgData.chat_id,
    };
    el.textContent = JSON.stringify(preview, null, 2);
};

// ── Status bar ─────────────────────────────────────────────────────
function odCfg_showStatus(msg, type) {
    const el = document.getElementById('odCfgStatus');
    if (!el) return;
    el.classList.remove('hidden');
    const colors = {
        loading: 'bg-blue-900/50 text-blue-300 border border-blue-700',
        success: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
        error:   'bg-red-900/50 text-red-300 border border-red-700',
    };
    el.className = `mx-4 mt-3 p-3 rounded-xl text-sm font-bold text-center ${colors[type] || ''}`;
    el.textContent = msg;
}
function odCfg_hideStatus() {
    const el = document.getElementById('odCfgStatus');
    if (el) el.classList.add('hidden');
}
