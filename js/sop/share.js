// ════════════════════════════════════════════════════════════════════
// 📦 sop/share.js — ส่วนที่ 4/4 ของหน้าคู่มือ SOP (แยกจาก sop.js เดิม 3,451 บรรทัด)
// เนื้อหา: Export PDF, แจ้งเตือน Telegram, ส่งรายข้อลง TG, ระบบกลุ่ม/โฟลเดอร์
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): sop/core → sop/rules → sop/manage → sop/share
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ต้องโหลดหลัง core เสมอ
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 📄 V6: EXPORT PDF
// ==========================================
window.sop_exportPDF = async function() {
    // ถาม user ว่าจะ export อะไร
    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">picture_as_pdf</span> Export PDF</div>',
        html: `
            <div class="text-left space-y-3">
                <div class="text-sm text-slate-700 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3">
                    เลือกเนื้อหาที่จะส่งออกเป็น PDF
                </div>
                <div class="space-y-2">
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 hover:border-rose-500 transition has-[:checked]:bg-rose-200 dark:has-[:checked]:bg-rose-900/50 has-[:checked]:border-rose-500">
                        <input type="radio" name="exportMode" value="all" class="w-4 h-4 accent-rose-500" checked>
                        <div class="flex-1">
                            <div class="font-bold text-sm">ทั้งหมด</div>
                            <div class="text-xs text-gray-500">กติกาขั้นตอน + ขั้นตอนต่างๆ (SOP)</div>
                        </div>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 transition has-[:checked]:bg-orange-200 dark:has-[:checked]:bg-orange-900/50 has-[:checked]:border-orange-500">
                        <input type="radio" name="exportMode" value="rules" class="w-4 h-4 accent-orange-500">
                        <div class="flex-1">
                            <div class="font-bold text-sm">เฉพาะกติกาขั้นตอน</div>
                            <div class="text-xs text-gray-500">${(globalStandaloneRules || []).length} ข้อ</div>
                        </div>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 transition has-[:checked]:bg-blue-200 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-500">
                        <input type="radio" name="exportMode" value="sop" class="w-4 h-4 accent-blue-500">
                        <div class="flex-1">
                            <div class="font-bold text-sm">เฉพาะขั้นตอน (SOP)</div>
                            <div class="text-xs text-gray-500">${globalSOPData.length} กฎ</div>
                        </div>
                    </label>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">file_download</span> สร้าง PDF',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const m = document.querySelector('input[name="exportMode"]:checked');
            return m ? m.value : 'all';
        }
    });

    if (!result.isConfirmed) return;
    sop_doExportPDF(result.value);
};

window.sop_doExportPDF = function(mode) {
    // Build HTML แยกหน้าเปิด print dialog
    const dateStr = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
    const companyName = 'คู่มือการทำงาน (OD)';

    let body = '';

    // หน้าปก
    body += `
        <div class="page cover">
            <div class="cover-inner">
                <h1>${companyName}</h1>
                <h2>${mode === 'rules' ? 'กติกาขั้นตอน' : (mode === 'sop' ? 'ขั้นตอนต่างๆ (SOP)' : 'ฉบับเต็ม')}</h2>
                <div class="meta">สร้าง: ${dateStr}</div>
                <div class="meta">โดย: ${(currentUser && (currentUser.username || currentUser.name)) || 'admin'}</div>
            </div>
        </div>
    `;

    // กติกาขั้นตอน
    if (mode === 'all' || mode === 'rules') {
        body += `<div class="section-header"><h2>📜 กติกาขั้นตอน</h2></div>`;
        // จัดกลุ่มตาม category
        const groupedR = {};
        (globalStandaloneRules || []).forEach(r => {
            const c = r.category || '__uncat__';
            if (!groupedR[c]) groupedR[c] = [];
            groupedR[c].push(r);
        });
        const orderR = [];
        globalSOPCategories.forEach(c => { if (groupedR[c.id]) orderR.push(c.id); });
        Object.keys(groupedR).forEach(k => { if (!orderR.includes(k)) orderR.push(k); });

        if (orderR.length === 0) {
            body += `<div class="empty">ยังไม่มีกติกา</div>`;
        }

        orderR.forEach(catKey => {
            const catObj = globalSOPCategories.find(c => c.id === catKey);
            const catName = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
            const catColor = catObj?.color || '#64748b';

            body += `<div class="cat-block"><div class="cat-title" style="background:${catColor};">${catName} (${groupedR[catKey].length} ข้อ)</div>`;
            groupedR[catKey].forEach((r, i) => {
                const t = r.type || 'do';
                let typeLabel = 'ทำได้', typeColor = '#10b981';
                if (t === 'dont')      { typeLabel = 'ห้ามทำ';     typeColor = '#ef4444'; }
                else if (t === 'must') { typeLabel = 'ต้องทำ';     typeColor = '#f97316'; }
                else if (t === 'info') { typeLabel = 'หมายเหตุ';   typeColor = '#3b82f6'; }
                const usedColor = r.color || typeColor;

                const safeTitle = (r.title || '').replace(/</g, '&lt;');
                const safeText = (r.text || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const subgroupBadge = r.subgroup ? `<span class="subgroup">📁 ${r.subgroup.replace(/</g, '&lt;')}</span>` : '';

                let imgsHtml = '';
                if (Array.isArray(r.images) && r.images.length > 0) {
                    imgsHtml = '<div class="imgs">' + r.images.map(im => `<img src="${im.url}" />`).join('') + '</div>';
                }

                body += `
                    <div class="rule-item" style="border-left-color:${usedColor};">
                        <div class="rule-head">
                            <span class="type-badge" style="background:${usedColor};">${typeLabel}</span>
                            ${subgroupBadge}
                            <strong>${i + 1}. ${safeTitle}</strong>
                        </div>
                        ${safeText ? `<div class="rule-text">${safeText}</div>` : ''}
                        ${imgsHtml}
                    </div>
                `;
            });
            body += `</div>`;
        });
    }

    // SOP / ขั้นตอนต่างๆ
    if (mode === 'all' || mode === 'sop') {
        body += `<div class="section-header"><h2>📚 ขั้นตอนต่างๆ (SOP)</h2></div>`;

        const groupedS = {};
        (globalSOPData || []).forEach(s => {
            const c = s.category || '__uncat__';
            if (!groupedS[c]) groupedS[c] = [];
            groupedS[c].push(s);
        });
        const orderS = [];
        globalSOPCategories.forEach(c => { if (groupedS[c.id]) orderS.push(c.id); });
        Object.keys(groupedS).forEach(k => { if (!orderS.includes(k)) orderS.push(k); });

        if (orderS.length === 0) {
            body += `<div class="empty">ยังไม่มี SOP</div>`;
        }

        orderS.forEach(catKey => {
            const catObj = globalSOPCategories.find(c => c.id === catKey);
            const catName = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
            const catColor = catObj?.color || '#64748b';

            body += `<div class="cat-block"><div class="cat-title" style="background:${catColor};">${catName} (${groupedS[catKey].length} กฎ)</div>`;

            groupedS[catKey].forEach(item => {
                const safeTitle = (item.title || '').replace(/</g, '&lt;');
                const safeContent = (item.content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const safeExamples = (item.examples || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');

                let attHtml = '';
                if (Array.isArray(item.attachments) && item.attachments.length > 0) {
                    const imgs = item.attachments.filter(a => !(a.url || '').toLowerCase().includes('.pdf') && a.type !== 'pdf');
                    if (imgs.length > 0) attHtml = '<div class="imgs">' + imgs.map(a => `<img src="${a.url}" />`).join('') + '</div>';
                }

                body += `
                    <div class="sop-item">
                        <h3>${safeTitle}</h3>
                        ${safeContent ? `<div class="block-label">📋 รายละเอียด/ขั้นตอน</div><div class="block-body">${safeContent}</div>` : ''}
                        ${safeExamples ? `<div class="block-label">💡 ตัวอย่าง</div><div class="block-body">${safeExamples}</div>` : ''}
                        ${attHtml}
                    </div>
                `;
            });

            body += `</div>`;
        });
    }

    const fullHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${companyName} — ${dateStr}</title>
<style>
@page { size: A4; margin: 1.5cm; }
body { font-family: 'Sarabun','Tahoma',sans-serif; color:#0f172a; line-height:1.55; font-size:13px; margin:0; padding:0; }
.page { page-break-after: always; }
.cover { display:flex; align-items:center; justify-content:center; height:90vh; }
.cover-inner { text-align:center; padding:40px; border:4px double #e11d48; border-radius:20px; background: linear-gradient(135deg,#fff1f2,#fef3c7); }
.cover h1 { font-size:38px; color:#e11d48; margin:0 0 12px; }
.cover h2 { font-size:22px; color:#475569; font-weight:normal; margin:0 0 24px; }
.cover .meta { font-size:14px; color:#64748b; margin-top:8px; }
.section-header { background: linear-gradient(135deg,#e11d48,#f97316); color:#fff; padding:16px 24px; border-radius:14px; margin:24px 0 16px; }
.section-header h2 { margin:0; font-size:20px; }
.cat-block { margin-bottom:18px; page-break-inside: avoid; }
.cat-title { color:#fff; padding:10px 16px; border-radius:10px 10px 0 0; font-weight:bold; font-size:15px; }
.rule-item { padding:12px 14px; border-left:6px solid; border:1px solid #e5e7eb; border-left-width:6px; margin-bottom:6px; background:#fafafa; border-radius:0 8px 8px 0; page-break-inside: avoid; }
.rule-head { margin-bottom:6px; }
.type-badge { display:inline-block; color:#fff; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:8px; }
.subgroup { display:inline-block; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:10px; margin-right:8px; }
.rule-text { color:#334155; font-size:13px; padding-left:6px; margin-top:4px; }
.sop-item { padding:14px; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px; background:#fff; page-break-inside: avoid; }
.sop-item h3 { margin:0 0 10px; font-size:17px; color:#0f172a; border-bottom:2px solid #e11d48; padding-bottom:6px; }
.block-label { font-weight:bold; color:#475569; margin:8px 0 4px; font-size:12px; text-transform:uppercase; }
.block-body { color:#0f172a; padding:6px 10px; background:#f8fafc; border-radius:6px; }
.imgs { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.imgs img { max-width:48%; max-height:200px; border:1px solid #e5e7eb; border-radius:6px; }
.empty { padding:30px; text-align:center; color:#94a3b8; font-style:italic; }
@media print {
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
</head>
<body>
${body}
<script>
window.addEventListener('load', () => {
  setTimeout(() => window.print(), 600);
});
</script>
</body>
</html>
    `;

    const w = window.open('', '_blank');
    if (!w) {
        Swal.fire('ไม่สามารถเปิดหน้าต่างใหม่', 'กรุณาอนุญาต popup ในเบราเซอร์', 'error');
        return;
    }
    w.document.open();
    w.document.write(fullHtml);
    w.document.close();
};

// ==========================================
// 🔔 V6: TELEGRAM NOTIFICATION
// ==========================================

// โหลดการตั้งค่าจาก Supabase
window._sopTelegramConfig = { enabled: false, bot_token: '', chat_id: '' };

window.sop_loadTelegramConfig = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_telegram_config').single();
        if (data && data.value) {
            window._sopTelegramConfig = JSON.parse(data.value);
        }
    } catch (e) {
        console.warn('No telegram config yet');
    }
};

window.sop_saveTelegramConfig = async function() {
    if (!window.sopRequire(window.sopCanManage)) return;

    await appDB.from('settings').upsert([{ key: 'sop_telegram_config', value: JSON.stringify(window._sopTelegramConfig) }]);
};

window.sop_telegramSettings = async function() {
    if (!window.sopRequire(window.sopCanManage)) return;

    await sop_loadTelegramConfig();
    const cfg = window._sopTelegramConfig;

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-300 dark:border-cyan-700 rounded-xl p-3 text-sm">
                <div class="font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1 mb-2">
                    <span class="material-icons text-[16px]">info</span>วิธีตั้งค่า Telegram Bot
                </div>
                <ol class="text-xs text-slate-700 dark:text-gray-200 ml-4 space-y-1 list-decimal">
                    <li>เปิด Telegram → ค้นหา <b>@BotFather</b> → พิมพ์ <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">/newbot</code></li>
                    <li>ตั้งชื่อ bot → จะได้ <b>Bot Token</b> มา (ใส่ในช่องล่าง)</li>
                    <li>สร้างกลุ่ม Telegram → เพิ่ม bot เข้ากลุ่ม → ตั้งเป็น admin</li>
                    <li>ในกลุ่มพิมพ์อะไรก็ได้ → ไปที่ <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                    <li>คัดลอก <b>chat.id</b> (ปกติเป็นเลขลบ เช่น <code>-1234567890</code>) → ใส่ในช่องล่าง</li>
                    <li>กดปุ่ม <b>ทดสอบ</b> เพื่อตรวจสอบ → กด <b>บันทึก</b></li>
                </ol>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Bot Token <span class="text-red-500">*</span></label>
                <input type="text" id="tgBotToken" value="${(cfg.bot_token || '').replace(/"/g, '&quot;')}" placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxyz" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-xs">
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Chat ID (กลุ่ม) <span class="text-red-500">*</span></label>
                <input type="text" id="tgChatId" value="${(cfg.chat_id || '').replace(/"/g, '&quot;')}" placeholder="-1234567890" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-xs">
            </div>

            <div>
                <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-500 transition has-[:checked]:bg-emerald-100 dark:has-[:checked]:bg-emerald-900/40">
                    <input type="checkbox" id="tgEnabled" ${cfg.enabled ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
                    <span class="material-icons text-emerald-500 text-[18px]">notifications_active</span>
                    <span class="text-sm font-bold text-slate-800 dark:text-white">เปิดการแจ้งเตือน — ส่งทุกครั้งที่เพิ่ม/แก้ OD</span>
                </label>
            </div>

            <div>
                <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-500 transition has-[:checked]:bg-amber-100 dark:has-[:checked]:bg-amber-900/40">
                    <input type="checkbox" id="tgAiEnabled" ${cfg.ai_enabled !== false ? 'checked' : ''} class="w-4 h-4 accent-amber-500">
                    <span class="material-icons text-amber-500 text-[18px]">smart_toy</span>
                    <span class="text-sm font-bold text-slate-800 dark:text-white">เปิดบอท AI ตอบกติกา — พนักงานถามด้วย /ask ในกลุ่ม (อิงกติกาหน้านี้)</span>
                </label>
            </div>

            <div class="p-3 rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 space-y-2">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-rose-500 text-[18px]">auto_delete</span>
                    <div class="text-sm font-bold text-slate-800 dark:text-white">⏲️ ลบข้อความตอบของบอทอัตโนมัติ</div>
                </div>

                <div class="flex items-center gap-2 pl-1">
                    <span class="material-icons text-slate-400 text-[15px]">groups</span>
                    <div class="flex-1">
                        <div class="text-xs font-bold text-slate-700 dark:text-gray-200">ข้อความสาธารณะ (/1, /ถาม, ควิซ)</div>
                        <div class="text-[9px] text-slate-500 dark:text-gray-400">0:0 = ไม่ลบ · เกิน 2 นาที ต้องมี Cron กวาด</div>
                    </div>
                    <input type="number" id="tgAutoDelHr" min="0" step="1" value="${Math.floor((cfg.auto_delete_minutes || 0) / 60)}" class="w-14 p-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white text-center font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-gray-400">ชม.</span>
                    <input type="number" id="tgAutoDelMin" min="0" max="59" step="1" value="${Math.round((cfg.auto_delete_minutes || 0) % 60)}" class="w-14 p-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white text-center font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-gray-400">นาที</span>
                </div>

                <div class="flex items-center gap-2 pl-1 pt-2 border-t border-rose-200 dark:border-rose-800">
                    <span class="material-icons text-slate-400 text-[15px]">visibility_off</span>
                    <div class="flex-1">
                        <div class="text-xs font-bold text-slate-700 dark:text-gray-200">ข้อความส่วนตัว (/ถามเงียบ)</div>
                        <div class="text-[9px] text-slate-500 dark:text-gray-400">0 = ใช้เวลาเดียวกับด้านบน · สูงสุด 14 นาที (ข้อจำกัด Discord)</div>
                    </div>
                    <input type="number" id="tgAutoDelPrivate" min="0" max="14" step="1" value="${cfg.auto_delete_private_minutes || 0}" class="w-14 p-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white text-center font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-gray-400">นาที</span>
                </div>
            </div>

            <div class="flex gap-2">
                <button type="button" onclick="sop_telegramTest()" class="flex-1 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 shadow-md transition active:scale-95">
                    <span class="material-icons text-sm">send</span>ทดสอบส่งข้อความ
                </button>
            </div>
            <div id="tgTestResult" class="text-xs text-center min-h-[18px]"></div>

            <!-- 📢 ยิงข้อความเข้ากลุ่ม -->
            <div class="border-t-2 border-dashed border-slate-300 dark:border-slate-600 pt-3">
                <div class="font-bold text-sky-600 dark:text-sky-300 flex items-center gap-1 mb-2 text-sm">
                    <span class="material-icons text-[16px]">campaign</span> ยิงข้อความเข้ากลุ่ม
                </div>
                <textarea id="tgBroadcastMsg" rows="3" placeholder="พิมพ์ข้อความที่จะยิงเข้ากลุ่มตรงนี้... (เห็นก่อนยิง แก้ได้เต็มที่)" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none text-sm"></textarea>
                <button type="button" onclick="sop_telegramBroadcast()" class="w-full mt-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 shadow-md transition active:scale-95">
                    <span class="material-icons text-sm">rocket_launch</span> ยิงข้อความเข้ากลุ่มเลย
                </button>
                <div id="tgBroadcastResult" class="text-xs text-center min-h-[18px] mt-1"></div>
            </div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-cyan-500">notifications</span> ตั้งค่า Telegram</div>',
        html: formHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const bot_token = document.getElementById('tgBotToken').value.trim();
            const chat_id = document.getElementById('tgChatId').value.trim();
            const enabled = document.getElementById('tgEnabled').checked;
            const ai_enabled = document.getElementById('tgAiEnabled') ? document.getElementById('tgAiEnabled').checked : true;
            const _adHr = parseFloat(document.getElementById('tgAutoDelHr')?.value) || 0;
            const _adMin = parseFloat(document.getElementById('tgAutoDelMin')?.value) || 0;
            const auto_delete_minutes = (_adHr * 60) + _adMin;
            const auto_delete_private_minutes = Math.min(parseFloat(document.getElementById('tgAutoDelPrivate')?.value) || 0, 14);
            if (enabled && (!bot_token || !chat_id)) {
                Swal.showValidationMessage('ต้องใส่ Bot Token และ Chat ID เมื่อเปิดการแจ้งเตือน');
                return false;
            }
            return { bot_token, chat_id, enabled, ai_enabled, auto_delete_minutes, auto_delete_private_minutes };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        window._sopTelegramConfig = result.value;
        await sop_saveTelegramConfig();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1100, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

// 📢 ยิงข้อความเข้ากลุ่ม (ใช้ Token/Chat ID จากช่องในหน้าต่าง — เห็นข้อความก่อนยิง)
window.sop_telegramBroadcast = async function() {
    const token = (document.getElementById('tgBotToken')?.value || '').trim();
    const chatId = (document.getElementById('tgChatId')?.value || '').trim();
    const msgEl = document.getElementById('tgBroadcastMsg');
    const resultEl = document.getElementById('tgBroadcastResult');
    if (!msgEl || !resultEl) return;
    const text = msgEl.value.trim();

    if (!token || !chatId) { resultEl.innerHTML = '<span class="text-red-500 font-bold">❌ ใส่ Bot Token และ Chat ID ก่อนครับ</span>'; return; }
    if (!text) { resultEl.innerHTML = '<span class="text-red-500 font-bold">❌ พิมพ์ข้อความก่อนยิงครับ</span>'; return; }

    resultEl.innerHTML = '<span class="text-sky-500 font-bold">⏳ กำลังยิง...</span>';
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
        const json = await res.json();
        if (json.ok) {
            resultEl.innerHTML = '<span class="text-emerald-500 font-bold">✅ ยิงเข้ากลุ่มแล้ว!</span>';
            msgEl.value = '';
        } else {
            resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ ${json.description || 'ยิงไม่สำเร็จ'}</span>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ ${e.message}</span>`;
    }
};

window.sop_telegramTest = async function() {
    const tokenEl = document.getElementById('tgBotToken');
    const chatEl = document.getElementById('tgChatId');
    const resultEl = document.getElementById('tgTestResult');
    if (!tokenEl || !chatEl || !resultEl) return;

    const token = tokenEl.value.trim();
    const chatId = chatEl.value.trim();
    if (!token || !chatId) {
        resultEl.innerHTML = '<span class="text-red-500 font-bold">กรุณาใส่ Bot Token และ Chat ID ก่อน</span>';
        return;
    }

    resultEl.innerHTML = '<span class="text-blue-500 font-bold">กำลังส่ง...</span>';

    try {
        const msg = `🤖 <b>ทดสอบการแจ้งเตือน</b>\n\nระบบ K36 OD เชื่อมต่อสำเร็จ ✅\nเวลา: ${new Date().toLocaleString('th-TH')}`;
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
        });
        const json = await res.json();
        if (json.ok) {
            resultEl.innerHTML = '<span class="text-emerald-500 font-bold">✅ ส่งสำเร็จ! เช็คในกลุ่ม Telegram</span>';
        } else {
            resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ ส่งไม่สำเร็จ: ${json.description || 'ไม่ทราบสาเหตุ'}</span>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ Error: ${e.message}</span>`;
    }
};

// ส่งแจ้งเตือนเมื่อเพิ่ม OD ใหม่ (เฉพาะตอน add — ไม่ส่งตอน edit)
// imgUrls = array ของ public URL รูป, content = เนื้อหา/รายละเอียด
// helper: ส่งข้อความยาวโดยแบ่ง chunk (Telegram max 4096)
async function sop_sendChunkedMessage(botToken, chatId, text, parseMode = 'HTML') {
    const MAX = 4000;
    if (text.length <= MAX) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
        });
        return;
    }
    // แบ่งตาม newline เพื่อไม่ตัดกลางบรรทัด
    const lines = text.split('\n');
    let chunk = '';
    for (const line of lines) {
        if ((chunk + '\n' + line).length > MAX) {
            if (chunk) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode })
                });
                await new Promise(r => setTimeout(r, 500));
            }
            chunk = line;
        } else {
            chunk = chunk ? chunk + '\n' + line : line;
        }
    }
    if (chunk) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode })
        });
    }
}

window.sop_sendTelegramNotify = async function(action, type, title, category, ruleType, imgUrls, content) {
    if (!window.sopRequire(window.sopCanSendTg)) return;

    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) return;

    const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'admin';

    let typeEmoji = '📚', typeText = 'ขั้นตอน (SOP)';
    if (type === 'rule') { typeEmoji = '⚖️'; typeText = 'กติกาขั้นตอน'; }

    let ruleTypeText = '';
    if (ruleType) {
        if (ruleType === 'do') ruleTypeText = '\n🟢 ประเภท: ทำได้';
        else if (ruleType === 'must') ruleTypeText = '\n🟠 ประเภท: ต้องทำ';
        else if (ruleType === 'dont') ruleTypeText = '\n🔴 ประเภท: ห้ามทำ';
        else if (ruleType === 'info') ruleTypeText = '\n🔵 ประเภท: หมายเหตุ';
    }

    const esc = (s) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    const safeTitle    = esc(title    || '(ไม่มีหัวข้อ)');
    const safeCategory = esc(category || 'ไม่ระบุ');

    // [FIX] ไม่ตัดเนื้อหา — ส่งแบบ chunked แทน
    let safeContent = '';
    if (content && content.trim()) {
        safeContent = '\n\n📝 <b>เนื้อหา:</b>\n' + esc(content.trim());
    }

    const header = `${typeEmoji} <b>${typeText}</b>\n\n` +
                   `📋 <b>หัวข้อ:</b> ${safeTitle}\n` +
                   `📁 <b>หมวด:</b> ${safeCategory}` +
                   ruleTypeText;
    const footer = `\n\n👤 <b>โดย:</b> ${esc(authorName)}\n` +
                   `🕐 ${new Date().toLocaleString('th-TH')}`;

    const caption = header + safeContent + footer;

    // สำหรับรูป caption max 1024 → ตัดแค่ส่วน caption แล้วส่ง content แยก
    let captionForPhoto = header + footer;
    if (captionForPhoto.length > 1020) {
        captionForPhoto = captionForPhoto.substring(0, 1020) + '...';
    }

    const validImgs = (imgUrls || []).filter(u => u && typeof u === 'string').slice(0, 10);

    try {
        if (validImgs.length === 0) {
            // [FIX] ส่งแบบ chunked รองรับข้อความยาว
            await sop_sendChunkedMessage(cfg.bot_token, cfg.chat_id, caption, 'HTML');
        } else if (validImgs.length === 1) {
            await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cfg.chat_id,
                    photo: validImgs[0],
                    caption: captionForPhoto,
                    parse_mode: 'HTML'
                })
            });
        } else {
            const media = validImgs.map((url, idx) => ({
                type: 'photo',
                media: url,
                ...(idx === 0 ? { caption: captionForPhoto, parse_mode: 'HTML' } : {})
            }));
            await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMediaGroup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: cfg.chat_id, media: media })
            });
        }
    } catch (e) {
        console.warn('Telegram notify failed:', e);
    }
};

// ==========================================
// 📤 ส่งข้อแต่ละข้อลง Telegram (กดปุ่มในการ์ด)
// ==========================================
window.sop_sendItemToTelegram = async function(itemId) {
    if (!window.sopRequire(window.sopCanSendTg)) return;

    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        return Swal.fire('ยังไม่ตั้งค่า Telegram', 'กรุณาไปตั้งค่า Telegram ก่อน (ปุ่ม Telegram ด้านบน)', 'warning');
    }

    // หา item จาก globalSOPData (ขั้นตอนต่างๆ)
    let item = null;
    for (const cat of (globalSOPData || [])) {
        const found = (cat.items || []).find(i => i.id === itemId);
        if (found) { item = { ...found, catName: cat.name || cat.title || 'ไม่ระบุ' }; break; }
    }
    if (!item) return Swal.fire('ไม่พบข้อมูล', '', 'error');

    Swal.fire({ title: 'กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await sop_sendTelegramNotify('manual', 'sop', item.title || '(ไม่มีหัวข้อ)', item.catName, null, item.images || [], item.content || '');
        Swal.fire({ icon: 'success', title: 'ส่งลง Telegram แล้ว!', timer: 1500, showConfirmButton: false });
    } catch(e) { Swal.fire('ส่งไม่สำเร็จ', e.message, 'error'); }
};

window.sop_sendStandaloneToTelegram = async function(idx) {
    if (!window.sopRequire(window.sopCanSendTg)) return;

    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        return Swal.fire('ยังไม่ตั้งค่า Telegram', 'กรุณาไปตั้งค่า Telegram ก่อน (ปุ่ม Telegram ด้านบน)', 'warning');
    }

    const r = (globalStandaloneRules || [])[idx];
    if (!r) return Swal.fire('ไม่พบข้อมูล', '', 'error');

    const catName = globalSOPCategories?.find(c => c.id === r.category)?.name || 'ไม่ระบุ';

    Swal.fire({ title: 'กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await sop_sendTelegramNotify('manual', 'rule', r.title || r.text || '(ไม่มีหัวข้อ)', catName, r.type || null, r.images || [], r.content || r.text || '');
        Swal.fire({ icon: 'success', title: 'ส่งลง Telegram แล้ว!', timer: 1500, showConfirmButton: false });
    } catch(e) { Swal.fire('ส่งไม่สำเร็จ', e.message, 'error'); }
};

// ==========================================
// 📁 ระบบกลุ่ม (Group/Folder) สำหรับกติกาขั้นตอน
// ==========================================
let globalSopGroups = []; // ['K36', 'Jun88', ...]

// โหลดกลุ่มจาก DB
async function sop_loadGroups() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_groups').maybeSingle();
        globalSopGroups = data?.value ? JSON.parse(data.value) : [];
    } catch(e) { globalSopGroups = []; }
    sop_updateGroupDropdown();
}

// บันทึกกลุ่มลง DB
async function sop_saveGroups() {
    await appDB.from('settings').upsert([{ key: 'sop_groups', value: JSON.stringify(globalSopGroups) }]);
    sop_updateGroupDropdown();
}

// อัปเดต dropdown กลุ่ม
window.sop_updateGroupDropdown = function() {
    const sel = document.getElementById('sopRulesGroupFilter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="ALL">📁 ทุกกลุ่ม</option>';
    globalSopGroups.forEach(g => {
        sel.innerHTML += `<option value="${g}">${g}</option>`;
    });
    sel.value = cur;
};

// จัดการกลุ่ม (สร้าง/ลบ)
window.sop_manageGroups = async function() {
    if (!window.sopRequire(window.sopCanManage)) return;

    await sop_loadGroups();

    const listHtml = globalSopGroups.length > 0
        ? globalSopGroups.map((g, i) => `
            <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-slate-700">
                <span class="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                    <span class="material-icons text-indigo-500 text-[18px]">folder</span>${g}
                </span>
                <button onclick="sop_deleteGroup(${i})" class="text-red-400 hover:text-red-600 p-1 rounded transition" title="ลบกลุ่ม">
                    <span class="material-icons text-[16px]">delete</span>
                </button>
            </div>`).join('')
        : '<div class="text-center text-gray-400 py-4 text-sm">ยังไม่มีกลุ่ม</div>';

    const { value: newName } = await Swal.fire({
        title: '<div class="flex items-center gap-2"><span class="material-icons text-indigo-500">folder</span> จัดการกลุ่ม</div>',
        html: `
            <div class="text-left space-y-3">
                <div class="space-y-2 max-h-48 overflow-y-auto">${listHtml}</div>
                <hr class="border-gray-200 dark:border-slate-700">
                <div class="font-bold text-sm text-slate-700 dark:text-slate-200">➕ สร้างกลุ่มใหม่</div>
                <input id="sopNewGroupName" type="text" placeholder="ชื่อกลุ่ม เช่น K36, Jun88..." 
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:border-indigo-500">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'สร้างกลุ่ม',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#6366f1',
        didOpen: () => {
            // ให้ปุ่มลบทำงานได้ใน Swal
            document.querySelectorAll('[onclick^="sop_deleteGroup"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = parseInt(btn.getAttribute('onclick').match(/\d+/)[0]);
                    globalSopGroups.splice(idx, 1);
                    await sop_saveGroups();
                    Swal.close();
                    sop_manageGroups();
                });
            });
        },
        preConfirm: () => {
            return document.getElementById('sopNewGroupName')?.value?.trim() || null;
        }
    });

    if (newName) {
        if (globalSopGroups.includes(newName)) {
            return Swal.fire('มีกลุ่มนี้แล้ว', '', 'warning');
        }
        globalSopGroups.push(newName);
        await sop_saveGroups();
        Swal.fire({ icon: 'success', title: `สร้างกลุ่ม "${newName}" แล้ว!`, timer: 1200, showConfirmButton: false });
        sop_renderAllRulesPage();
    }
};

window.sop_deleteGroup = async function(idx) {
    if (!window.sopRequire(window.sopCanManage)) return;

    globalSopGroups.splice(idx, 1);
    await sop_saveGroups();
};

// โยกข้อเข้ากลุ่ม
window.sop_moveToGroup = async function(idx) {
    if (!window.sopRequire(window.sopCanManage)) return;

    await sop_loadGroups();
    const r = globalStandaloneRules[idx];
    if (!r) return;

    if (globalSopGroups.length === 0) {
        return Swal.fire('ยังไม่มีกลุ่ม', 'กรุณาสร้างกลุ่มก่อน โดยกดปุ่ม "จัดการกลุ่ม"', 'info');
    }

    const options = { '': '— ไม่อยู่กลุ่มไหน —' };
    globalSopGroups.forEach(g => { options[g] = `📁 ${g}`; });

    const { value: selectedGroup } = await Swal.fire({
        title: `<div class="flex items-center gap-2 text-base"><span class="material-icons text-indigo-500">drive_file_move</span> โยก "${r.title || r.text || '(ไม่มีหัวข้อ)'}"</div>`,
        input: 'select',
        inputOptions: options,
        inputValue: r.group || '',
        showCancelButton: true,
        confirmButtonText: 'ย้ายเข้ากลุ่ม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6366f1',
    });

    if (selectedGroup !== undefined) {
        r.group = selectedGroup || '';
        await sop_saveStandaloneRules();
        sop_renderAllRulesPage();
        Swal.fire({ icon: 'success', title: selectedGroup ? `ย้ายเข้ากลุ่ม "${selectedGroup}" แล้ว!` : 'นำออกจากกลุ่มแล้ว', timer: 1200, showConfirmButton: false });
    }
};

// ==========================================
// 📁 โยกหมวดหมู่เข้ากลุ่ม
// ==========================================
window.sop_moveCategoryToGroup = async function(catId) {
    if (!window.sopRequire(window.sopCanManage)) return;

    await sop_loadGroups();

    const cat = globalSOPCategories.find(c => c.id === catId);
    if (!cat) return;

    if (globalSopGroups.length === 0) {
        return Swal.fire('ยังไม่มีกลุ่ม', 'กรุณาสร้างกลุ่มก่อน โดยกดปุ่ม "จัดการกลุ่ม"', 'info');
    }

    const options = { '': '— ไม่อยู่กลุ่มไหน —' };
    globalSopGroups.forEach(g => { options[g] = `📁 ${g}`; });

    const { value: selectedGroup } = await Swal.fire({
        title: `<div class="flex items-center gap-2 text-base"><span class="material-icons text-indigo-500">drive_file_move</span> โยกหมวด "${cat.name}"</div>`,
        input: 'select',
        inputOptions: options,
        inputValue: cat.group || '',
        showCancelButton: true,
        confirmButtonText: 'ย้ายเข้ากลุ่ม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6366f1',
    });

    if (selectedGroup !== undefined) {
        cat.group = selectedGroup || '';
        // บันทึกลง DB
        await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        sop_renderAllRulesPage();
        Swal.fire({
            icon: 'success',
            title: selectedGroup ? `ย้ายหมวด "${cat.name}" เข้ากลุ่ม "${selectedGroup}" แล้ว!` : `นำหมวด "${cat.name}" ออกจากกลุ่มแล้ว`,
            timer: 1500,
            showConfirmButton: false
        });
    }
};
