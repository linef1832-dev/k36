// ============================================================
//  LINE Chat — Channel Manager (ตั้งค่า OA 20 ตัว)
//  มีคำแนะนำชัดเจนว่าค่าแต่ละค่าเอามาจากที่ไหนใน LINE Console
// ============================================================

// ── คำนวณ webhook URL อัตโนมัติจาก DB_URL ของระบบ ─────────────
function chatGetWebhookUrl() {
  if (typeof DB_URL === 'undefined') return '';
  return `${DB_URL}/functions/v1/line-webhook`;
}

// ── Modal: หน้าจัดการ OA ทั้งหมด ─────────────────────────
window.openChatChannelManager = async function () {
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return Swal.fire('!', 'ต้องเป็น admin/manager', 'warning');
  }

  // ⚠️ admin ต้องใช้ service_role key เพื่ออ่าน secret/token
  // วิธีตามขนาดงานนี้: ใช้ anon key อ่าน table โดยปิด RLS เฉพาะตอน admin ทำงาน
  // หรือสร้าง RPC `get_line_channels_admin(p_pin TEXT)` ที่เช็ค admin ก่อน
  // เพื่อความเรียบง่าย: ใช้ view line_channels_public (ไม่มี secret/token) สำหรับ list
  // เวลา edit จะให้ admin พิมพ์ใส่ใหม่เสมอ (ไม่แสดงค่าเก่า)

  const { data: channels } = await appDB
    .from('line_channels_public')
    .select('*')
    .order('channel_name');

  const wHook = chatGetWebhookUrl();

  const tableHtml = (channels || []).length === 0
    ? `<div class="text-center text-gray-400 py-8">
         <span class="material-icons text-5xl">add_circle</span>
         <p class="mt-2">ยังไม่มี OA — เริ่มเพิ่มตัวแรกเลย</p>
       </div>`
    : `<table class="w-full text-sm">
         <thead class="bg-slate-100 dark:bg-slate-700">
           <tr class="text-left text-xs text-gray-500 dark:text-gray-300">
             <th class="p-2">สี</th><th class="p-2">ชื่อ OA</th><th class="p-2">Bot User ID</th>
             <th class="p-2">หมวดหมู่</th><th class="p-2">สถานะ</th><th class="p-2 text-right">การจัดการ</th>
           </tr>
         </thead><tbody>
         ${channels.map(c => `
           <tr class="border-t border-slate-200 dark:border-slate-700">
             <td class="p-2"><span class="inline-block w-5 h-5 rounded" style="background:${c.color_hex}"></span></td>
             <td class="p-2 font-bold dark:text-white">${chatEscapeHtml(c.channel_name)}</td>
             <td class="p-2"><code class="text-[11px] text-gray-500">${chatEscapeHtml(c.bot_user_id.substring(0, 18))}…</code></td>
             <td class="p-2 text-xs text-gray-500">${chatEscapeHtml(c.category || '—')}</td>
             <td class="p-2">${c.is_active ? '<span class="text-green-600 text-xs font-bold">● ใช้งาน</span>' : '<span class="text-gray-400 text-xs">○ ปิด</span>'}</td>
             <td class="p-2 text-right">
               <button onclick="chatEditChannel('${c.id}')" class="text-blue-500 hover:text-blue-700 text-xs">แก้ไข</button>
               <span class="text-gray-300 mx-1">|</span>
               <button onclick="chatDeleteChannel('${c.id}','${chatEscapeHtml(c.channel_name).replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 text-xs">ลบ</button>
             </td>
           </tr>`).join('')}
         </tbody></table>`;

  await Swal.fire({
    width: 950,
    title: '<span class="material-icons text-emerald-500 text-3xl align-middle">settings</span> ตั้งค่า LINE Official Account',
    html: `
      <div class="text-left">
        <!-- Webhook URL Banner -->
        <div class="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-3 mb-3">
          <div class="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold mb-1">
            <span class="material-icons">link</span> Webhook URL ที่ต้องไปใส่ในทุก OA
          </div>
          <div class="flex items-center gap-2 bg-white dark:bg-slate-800 rounded p-2">
            <code id="chatWebhookUrlBox" class="flex-1 text-xs break-all dark:text-cyan-300">${chatEscapeHtml(wHook)}</code>
            <button onclick="navigator.clipboard.writeText('${wHook}'); this.innerText='✓ คัดลอก'" class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded font-bold">📋 Copy</button>
          </div>
          <p class="text-[11px] text-blue-700 dark:text-blue-300 mt-1.5">
            ใส่ URL นี้ในทุก OA ที่ <b>LINE Developer Console > Provider > [OA] > Messaging API tab > Webhook URL</b>
            แล้วเปิดสวิตช์ <b>"Use webhook"</b> ให้ขึ้นเขียว
          </p>
        </div>

        <!-- Action button -->
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-600 dark:text-gray-300">
            ทั้งหมด <b class="text-emerald-600">${(channels || []).length}</b> OA
          </span>
          <button onclick="chatAddChannel()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-md flex items-center gap-1">
            <span class="material-icons text-base">add</span> เพิ่ม OA ใหม่
          </button>
        </div>

        <!-- Channel table -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-x-auto">
          ${tableHtml}
        </div>

        <p class="text-[11px] text-gray-400 mt-3">
          💡 <b>Tip:</b> ระบบรองรับ OA ไม่จำกัด — แต่ Pro plan ของ Supabase มีข้อจำกัด realtime ที่ ~500 connection/เวลา
        </p>
      </div>`,
    showConfirmButton: true,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#64748b',
    customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-2xl' }
  });
};

// ── Modal: เพิ่ม / แก้ไข OA (มีคำแนะนำเอาค่ามาจากไหน) ─────────
async function chatChannelFormModal(existing) {
  const isEdit = !!existing;
  const wHook = chatGetWebhookUrl();

  // คำแนะนำที่เห็นชัด ทุก field
  const guideHtml = `
    <details class="mb-3 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded">
      <summary class="cursor-pointer font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
        <span class="material-icons text-base">help_outline</span> วิธีหาค่าจาก LINE Developer Console (กดเพื่อขยาย)
      </summary>
      <div class="mt-2 text-[12px] text-amber-900 dark:text-amber-100 space-y-2 text-left">
        <div>
          <div class="font-bold">📍 ขั้น 1: เข้า LINE Developer Console</div>
          <a href="https://developers.line.biz/console/" target="_blank" class="text-blue-600 underline">developers.line.biz/console/</a>
          → เลือก Provider → เลือก Messaging API channel ของ OA ที่ต้องการ
        </div>
        <div>
          <div class="font-bold">📍 ขั้น 2: ไปที่แท็บ "Basic settings"</div>
          <ul class="list-disc list-inside ml-2 space-y-0.5">
            <li><b>Channel ID</b> → ใส่ในช่อง "Channel ID (LINE)" ด้านล่าง (optional)</li>
            <li><b>Channel secret</b> → กดปุ่ม Issue ถ้ายังไม่มี → คัดลอก → ใส่ในช่อง "Channel Secret"</li>
            <li><b>Your user ID</b> (ขึ้นต้นด้วย <code>U</code>) → ใส่ในช่อง <span class="text-red-600 font-bold">"Bot User ID (destination)"</span> 
                <br><span class="text-[11px] text-amber-700">⚠️ ค่านี้สำคัญที่สุด — ระบบใช้แยกแต่ละ OA</span></li>
          </ul>
        </div>
        <div>
          <div class="font-bold">📍 ขั้น 3: ไปที่แท็บ "Messaging API"</div>
          <ul class="list-disc list-inside ml-2 space-y-0.5">
            <li><b>Channel access token (long-lived)</b> → กด Issue → คัดลอก → ใส่ในช่อง "Channel Access Token"</li>
            <li><b>Webhook URL</b> → ใส่: <code class="bg-white dark:bg-slate-800 px-1 rounded text-blue-600 break-all">${chatEscapeHtml(wHook)}</code></li>
            <li><b>Use webhook</b> → เปิดสวิตช์ให้เป็นเขียว</li>
            <li><b>Auto-reply messages</b> → ปิด (เพราะเราจะตอบเอง)</li>
            <li><b>Greeting messages</b> → ปิดหรือเปิดก็ได้</li>
          </ul>
        </div>
        <div class="bg-white dark:bg-slate-800 p-2 rounded border border-amber-300">
          <div class="font-bold text-amber-700 dark:text-amber-300">📍 ขั้น 4: บันทึก แล้วทดสอบ</div>
          <span>ส่งข้อความไปที่ OA → ถ้าตั้งค่าถูก ข้อความจะโผล่ในหน้านี้ภายใน 1-2 วินาที</span>
        </div>
      </div>
    </details>`;

  const formHtml = `
    ${guideHtml}
    <div class="grid grid-cols-2 gap-3 text-left">
      <div class="col-span-2">
        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">📛 ชื่อ OA <span class="text-red-500">*</span></label>
        <input id="chFldName" class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white p-2 rounded mt-1 text-sm"
               placeholder="เช่น OA หลัก, สปอร์ต VIP" value="${chatEscapeHtml(existing?.channel_name || '')}">
      </div>
      <div class="col-span-2">
        <label class="text-xs font-bold text-red-600">🔑 Bot User ID (destination) <span class="text-red-500">*</span></label>
        <input id="chFldBotId" class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white p-2 rounded mt-1 text-sm font-mono"
               placeholder="U1234567890abcdef..." value="${chatEscapeHtml(existing?.bot_user_id || '')}">
        <p class="text-[10px] text-gray-500 mt-0.5">มาจาก <b>Basic settings → Your user ID</b> (ขึ้นต้นด้วย U)</p>
      </div>
      <div class="col-span-2">
        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">🔐 Channel Secret ${isEdit ? '<span class="text-gray-400">(ปล่อยว่าง = ไม่เปลี่ยน)</span>' : '<span class="text-red-500">*</span>'}</label>
        <input id="chFldSecret" type="password" class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white p-2 rounded mt-1 text-sm font-mono"
               placeholder="${isEdit ? '••••••••••••••• (ค่าเก่าจะคงอยู่ถ้าไม่กรอก)' : 'มาจาก Basic settings → Channel secret'}">
      </div>
      <div class="col-span-2">
        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">🎫 Channel Access Token ${isEdit ? '<span class="text-gray-400">(ปล่อยว่าง = ไม่เปลี่ยน)</span>' : '<span class="text-red-500">*</span>'}</label>
        <input id="chFldToken" type="password" class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white p-2 rounded mt-1 text-sm font-mono"
               placeholder="${isEdit ? '••••••••••••••• (ค่าเก่าจะคงอยู่ถ้าไม่กรอก)' : 'มาจาก Messaging API → Channel access token (long-lived)'}">
      </div>
      <div>
        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">หมวดหมู่</label>
        <select id="chFldCategory" class="w-full bg-slate-100 dark:bg-slate-700 dark:text-white p-2 rounded mt-1 text-sm">
          <option value="">— ไม่ระบุ —</option>
          <option value="customer" ${existing?.category === 'customer' ? 'selected' : ''}>ลูกค้าทั่วไป</option>
          <option value="vip" ${existing?.category === 'vip' ? 'selected' : ''}>ลูกค้า VIP</option>
          <option value="work" ${existing?.category === 'work' ? 'selected' : ''}>งานภายใน</option>
          <option value="sport" ${existing?.category === 'sport' ? 'selected' : ''}>สปอร์ต</option>
          <option value="casino" ${existing?.category === 'casino' ? 'selected' : ''}>คาสิโน</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-bold text-gray-700 dark:text-gray-300">สี Badge</label>
        <input id="chFldColor" type="color" class="w-full h-10 bg-slate-100 dark:bg-slate-700 rounded mt-1"
               value="${chatEscapeHtml(existing?.color_hex || '#06b6d4')}">
      </div>
      <div class="col-span-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input id="chFldActive" type="checkbox" class="w-4 h-4" ${existing?.is_active !== false ? 'checked' : ''}>
          <span class="text-sm dark:text-white">เปิดใช้งาน OA นี้</span>
        </label>
      </div>
    </div>`;

  const result = await Swal.fire({
    width: 700,
    title: isEdit ? `<span class="material-icons text-blue-500 align-middle">edit</span> แก้ไข OA` : `<span class="material-icons text-emerald-500 align-middle">add_circle</span> เพิ่ม OA ใหม่`,
    html: formHtml,
    showCancelButton: true,
    confirmButtonText: isEdit ? 'บันทึก' : 'เพิ่ม OA',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10b981',
    customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-2xl' },
    preConfirm: () => {
      const name = document.getElementById('chFldName').value.trim();
      const botId = document.getElementById('chFldBotId').value.trim();
      const secret = document.getElementById('chFldSecret').value.trim();
      const token = document.getElementById('chFldToken').value.trim();
      const category = document.getElementById('chFldCategory').value;
      const color = document.getElementById('chFldColor').value;
      const active = document.getElementById('chFldActive').checked;

      if (!name) { Swal.showValidationMessage('กรุณาตั้งชื่อ OA'); return false; }
      if (!botId) { Swal.showValidationMessage('กรุณาใส่ Bot User ID (destination)'); return false; }
      if (!botId.startsWith('U')) { Swal.showValidationMessage('Bot User ID ต้องขึ้นต้นด้วย U'); return false; }
      if (!isEdit && (!secret || !token)) { Swal.showValidationMessage('Channel Secret และ Access Token ห้ามเว้น'); return false; }

      return { name, botId, secret, token, category, color, active };
    }
  });
  return result.isConfirmed ? result.value : null;
}

window.chatAddChannel = async function () {
  const v = await chatChannelFormModal(null);
  if (!v) return;
  const { error } = await appDB.from('line_channels').insert({
    bot_user_id: v.botId,
    channel_name: v.name,
    channel_secret: v.secret,
    channel_access_token: v.token,
    category: v.category || null,
    color_hex: v.color,
    is_active: v.active
  });
  if (error) {
    if (error.code === '23505') return Swal.fire('!', 'Bot User ID นี้มีอยู่แล้ว', 'warning');
    if (error.code === '42501') return Swal.fire('สิทธิ์ไม่พอ', 'ต้องตั้ง RLS policy ให้ admin เขียน table line_channels ได้ — ดู SETUP.md ส่วน "Admin Permission"', 'error');
    return Swal.fire('Error', error.message, 'error');
  }
  await Swal.fire({ icon: 'success', title: 'เพิ่ม OA สำเร็จ', timer: 1200, showConfirmButton: false });
  await chatLoadChannels();
  openChatChannelManager();
};

window.chatEditChannel = async function (id) {
  const { data: existing } = await appDB.from('line_channels_public').select('*').eq('id', id).single();
  if (!existing) return;
  const v = await chatChannelFormModal(existing);
  if (!v) return;

  const updates = {
    bot_user_id: v.botId,
    channel_name: v.name,
    category: v.category || null,
    color_hex: v.color,
    is_active: v.active
  };
  if (v.secret) updates.channel_secret = v.secret;
  if (v.token) updates.channel_access_token = v.token;

  const { error } = await appDB.from('line_channels').update(updates).eq('id', id);
  if (error) return Swal.fire('Error', error.message, 'error');
  await Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1200, showConfirmButton: false });
  await chatLoadChannels();
  openChatChannelManager();
};

window.chatDeleteChannel = async function (id, name) {
  const ok = await Swal.fire({
    title: `ลบ OA "${name}"?`,
    html: '⚠️ ข้อความ/เคสทั้งหมดของ OA นี้จะถูกลบด้วย!<br>กู้คืนไม่ได้',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  });
  if (!ok.isConfirmed) return;
  const { error } = await appDB.from('line_channels').delete().eq('id', id);
  if (error) return Swal.fire('Error', error.message, 'error');
  await chatLoadChannels();
  openChatChannelManager();
};
