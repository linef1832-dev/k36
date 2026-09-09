// ════════════════════════════════════════════════════════════════════
// 📦 discord/message.js — ส่วนที่ 3/5 ของหน้า Discord (แยกมาจาก discord.js เดิม)
// เนื้อหา: ระบบส่งข้อความเข้าห้อง + ข้อความสำเร็จรูป
// ⚠️ ลำดับโหลด (กำหนดใน PAGE_SCRIPTS ของ global.js): discord/core → history → message → breaktrack → tts
// ตัวแปร/ฟังก์ชันแชร์ข้ามไฟล์กันได้ตามปกติ (top-level scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------
// 🌟 ระบบส่งข้อความและข้อความสำเร็จรูป (อัปเดตระบบ Global และค้นหาห้อง)
// ---------------------------------------------------------

// ดึงรายชื่อห้อง (ดึงมาทั้ง Text Channels และ Voice Channels แบบ Checkbox)
window.ds_fetchChannelsForSendMsg = async function() {
    const targetContainer = document.getElementById('dsSendMsgChannelContainer');
    if (targetContainer) targetContainer.innerHTML = '<div class="text-center text-gray-500 text-xs py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลดรายชื่อห้อง...</div>';

    try {
        if (typeof appDB !== 'undefined') {
            const [textRes, voiceRes] = await Promise.all([
                appDB.from('settings').select('value').eq('key', 'discord_text_channels').single(),
                appDB.from('settings').select('value').eq('key', 'discord_channels').single()
            ]);
            
            let allChannels = [];

            if (textRes.data && textRes.data.value) {
                try {
                    const textCh = typeof textRes.data.value === 'string' ? JSON.parse(textRes.data.value) : textRes.data.value;
                    if(Array.isArray(textCh)) allChannels = allChannels.concat(textCh.map(c => ({ id: c.id, name: `💬 ${c.name}` })));
                } catch(e){}
            }

            if (voiceRes.data && voiceRes.data.value) {
                try {
                    const voiceCh = typeof voiceRes.data.value === 'string' ? JSON.parse(voiceRes.data.value) : voiceRes.data.value;
                    if(Array.isArray(voiceCh)) {
                        voiceCh.forEach(vc => {
                            if(!allChannels.find(c => c.id === vc.id)) {
                                allChannels.push({ id: vc.id, name: `🔊 ${vc.name}` }); 
                            }
                        });
                    }
                } catch(e){}
            }

            if (allChannels.length > 0) {
                // ดึงข้อมูลที่พนักงานจำไว้ของเครื่องตัวเอง (Local Storage)
                let savedChannels = [];
                try { savedChannels = JSON.parse(localStorage.getItem('ds_last_selected_channels') || '[]'); } catch(e){}

                let html = '';
                allChannels.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                    const isChecked = savedChannels.includes(c.id) ? 'checked' : '';
                    html += `
                        <label class="ds-channel-item flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg cursor-pointer border border-transparent hover:border-slate-700 transition" data-name="${c.name.toLowerCase()}">
                            <input type="checkbox" value="${c.id}" class="ds-send-channel-cb w-5 h-5 rounded border-gray-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-2 shadow-inner transition cursor-pointer" ${isChecked} onchange="ds_updateSelectedChannelsLabel()">
                            <span class="text-gray-200 font-bold text-sm truncate">${dsEsc(c.name)}</span>
                        </label>
                    `;
                });
                
                if(targetContainer) {
                    targetContainer.innerHTML = html;
                    ds_updateSelectedChannelsLabel();
                }
            } else {
                if(targetContainer) targetContainer.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">-- ไม่พบห้องในระบบ (รอแอดมินเปิดบอท) --</div>';
            }
        }
    } catch(e) { 
        if(targetContainer) targetContainer.innerHTML = '<div class="text-center text-red-500 text-xs py-10">-- เกิดข้อผิดพลาดในการโหลดห้อง --</div>';
    }
};

// 🌟 ฟังก์ชันค้นหาชื่อห้อง
window.ds_filterChannels = function() {
    const term = document.getElementById('dsSearchChannelInput').value.toLowerCase();
    const items = document.querySelectorAll('.ds-channel-item');
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        if (name.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

// อัปเดตตัวเลขห้องที่ถูกเลือก และบันทึกลงความจำเครื่อง (ของใครของมัน)
window.ds_updateSelectedChannelsLabel = function() {
    const checkboxes = document.querySelectorAll('.ds-send-channel-cb:checked');
    const label = document.getElementById('dsSelectedChannelsLabel');
    if (label) {
        label.innerHTML = `เลือกรอไว้ <span class="text-white">${checkboxes.length}</span> ห้อง`;
    }
    
    // บันทึกใส่เครื่อง เผื่อปิดเว็บเปิดใหม่ก็ยังจำได้ (Local Storage = ของพนักงานแต่ละคน)
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    window.safeSetItem('ds_last_selected_channels', JSON.stringify(selectedIds));
};

// ปุ่มเลือกทั้งหมด / ยกเลิกทั้งหมด (เฉพาะที่มองเห็นจากการค้นหา)
window.ds_selectAllChannels = function() {
    const items = document.querySelectorAll('.ds-channel-item');
    let visibleCheckboxes = [];
    
    items.forEach(item => {
        if (item.style.display !== 'none') {
            visibleCheckboxes.push(item.querySelector('.ds-send-channel-cb'));
        }
    });
    
    if (visibleCheckboxes.length === 0) return;
    
    const allChecked = visibleCheckboxes.every(cb => cb.checked);
    
    visibleCheckboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    ds_updateSelectedChannelsLabel();
};

// 🌟 โหลดรายการข้อความสำเร็จรูป (ดึงจากฐานข้อมูลส่วนกลาง)
window.ds_loadMsgTemplates = async function() {
    const list = document.getElementById('dsMsgTemplatesList');
    if (!list) return;
    
    list.innerHTML = '<div class="text-center text-gray-500 text-xs py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลดข้อความ...</div>';
    
    try {
        let templates = [];
        const { data, error } = await appDB.from('settings').select('value').eq('key', 'discord_msg_templates').single();
        
        if (data && data.value) {
            templates = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
        
        window.globalDsMsgTemplates = templates; // เก็บไว้ในตัวแปรระบบ

        if (templates.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">ยังไม่มีข้อความที่บันทึกไว้<br>พิมพ์ข้อความด้านซ้ายแล้วกด "+ บันทึกเป็นข้อความส่วนกลาง"</div>';
            return;
        }

        list.innerHTML = templates.map((t, idx) => `
            <div class="bg-slate-800 border border-slate-600 p-3 rounded-xl hover:border-emerald-500 transition group relative">
                <div class="text-xs text-gray-300 whitespace-pre-line line-clamp-3 mb-2 cursor-pointer" onclick="ds_useMsgTemplate(${idx})">${t.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-700">
                    <button onclick="ds_useMsgTemplate(${idx})" class="text-[10px] bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded shadow-sm font-bold border border-sky-500">นำไปใช้</button>
                    <button onclick="ds_deleteMsgTemplate(${idx})" class="text-gray-400 hover:text-red-500 transition" title="ลบข้อความนี้ (ลบของทุกคน)"><span class="material-icons text-[14px]">delete</span></button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = '<div class="text-center text-red-500 text-xs py-10">โหลดข้อมูลล้มเหลว</div>';
    }
};

// 🌟 บันทึกข้อความเก็บไว้เป็นเทมเพลต (ยิงขึ้นฐานข้อมูลส่วนกลาง)
window.ds_saveMsgTemplate = async function() {
    if (!window.dsRequire('ds_sendmsg')) return;

    const textEl = document.getElementById('dsSendMsgText');
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) return Swal.fire('เตือน', 'กรุณาพิมพ์ข้อความที่ต้องการบันทึกก่อนครับ', 'warning');

    let templates = window.globalDsMsgTemplates || [];

    if (templates.includes(text)) return Swal.fire('เตือน', 'มีข้อความนี้บันทึกไว้แล้ว', 'info');

    Swal.fire({title: 'กำลังบันทึกให้ทุกคนเห็น...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    
    templates.unshift(text); // เอาข้อความใหม่ไว้บนสุด
    
    try {
        await appDB.from('settings').upsert([{ key: 'discord_msg_templates', value: JSON.stringify(templates) }]);
        window.globalDsMsgTemplates = templates;
        ds_loadMsgTemplates();
        Swal.fire({icon: 'success', title: 'บันทึกส่วนกลางสำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch(e) {
        Swal.fire('Error', 'บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
};

// นำข้อความที่บันทึกไว้มาเติมในช่องพิมพ์
window.ds_useMsgTemplate = function(idx) {
    let templates = window.globalDsMsgTemplates || [];
    if (templates[idx]) {
        const textEl = document.getElementById('dsSendMsgText');
        if (textEl) textEl.value = templates[idx];
    }
};

// 🌟 ลบข้อความเทมเพลต (ลบออกจากฐานข้อมูลส่วนกลาง)
window.ds_deleteMsgTemplate = async function(idx) {
    if (!window.dsRequire('ds_sendmsg')) return;

    const res = await Swal.fire({
        title: 'ยืนยันลบข้อความ?',
        text: 'ข้อความนี้จะถูกลบออก และพนักงานทุกคนจะไม่เห็นข้อความนี้อีก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ใช่, ลบทิ้งเลย'
    });
    
    if (res.isConfirmed) {
        let templates = window.globalDsMsgTemplates || [];
        templates.splice(idx, 1);
        
        Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        try {
            await appDB.from('settings').upsert([{ key: 'discord_msg_templates', value: JSON.stringify(templates) }]);
            window.globalDsMsgTemplates = templates;
            ds_loadMsgTemplates();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1000, showConfirmButton: false});
        } catch(e) {
            Swal.fire('Error', 'ลบไม่สำเร็จ: ' + e.message, 'error');
        }
    }
};

// ฟังก์ชันยิงคำสั่งให้บอทส่งข้อความ
window.ds_sendMessage = async function() {
    if (!window.dsRequire('ds_sendmsg')) return;

    const checkboxes = document.querySelectorAll('.ds-send-channel-cb:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('dsSendMsgText');
    const message = messageEl ? messageEl.value.trim() : '';
    
    if (selectedIds.length === 0) return Swal.fire('เตือน', 'กรุณาติ๊กเลือกห้องปลายทางอย่างน้อย 1 ห้องครับ', 'warning');
    if (!message) return Swal.fire('เตือน', 'กรุณาพิมพ์ข้อความที่ต้องการส่งก่อนครับ', 'warning');

    Swal.fire({
        title: 'กำลังส่งข้อความ...', 
        html: `กำลังเริ่มส่ง 0 / ${selectedIds.length} ห้อง`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    let successCount = 0;
    let failCount = 0;
    let realErrorMsg = ''; 

    for (let i = 0; i < selectedIds.length; i++) {
        const channelId = selectedIds[i];
        try {
            const res = await fetch(`${DISCORD_API_URL}/api/send-message`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channelId, content: message })
            });
            
            const textResponse = await res.text();
            
            try {
                const r = JSON.parse(textResponse);
                if (r.success) {
                    successCount++;
                } else {
                    failCount++;
                    realErrorMsg = r.error || 'เซิร์ฟเวอร์บอทไม่ตอบสนอง';
                }
            } catch(jsonErr) {
                failCount++;
                realErrorMsg = 'เซิร์ฟเวอร์บอทไม่ได้ตอบกลับมาเป็น JSON (อาจจะล่ม หรืออัปเดตไม่เสร็จ)';
                console.error("ไม่ใช่ JSON:", textResponse);
            }

        } catch(e) {
            failCount++;
            realErrorMsg = 'การเชื่อมต่อถูกตัดขาด: ' + e.message;
        }
        
        Swal.update({ 
            html: `ส่งไปแล้ว ${i + 1} / ${selectedIds.length} ห้อง<br>
            <div class="flex justify-center gap-4 mt-2">
                <span class="text-sm text-emerald-500 font-bold">✅ สำเร็จ: ${successCount}</span>
                <span class="text-sm text-red-500 font-bold">❌ ล้มเหลว: ${failCount}</span>
            </div>` 
        });
    }

    if (successCount > 0) {
        Swal.fire('สำเร็จ!', `บอทส่งข้อความสำเร็จ ${successCount} ห้อง${failCount > 0 ? `<br><span class="text-xs text-red-500">ส่งไม่ได้ ${failCount} ห้อง<br>(สาเหตุ: ${realErrorMsg})</span>` : ''}`, 'success');
        messageEl.value = ''; 
        if(typeof ds_logAction === 'function') {
            ds_logAction('ส่งข้อความ (Bot)', `สั่งบอทพิมพ์ข้อความลง ${selectedIds.length} ห้อง สำเร็จ ${successCount}`);
        }
    } else {
        Swal.fire('เกิดข้อผิดพลาด', `ส่งข้อความไม่สำเร็จเลย<br><br><span class="text-sm font-bold text-red-500">สาเหตุที่แท้จริง:<br>${realErrorMsg}</span>`, 'error');
    }
};
