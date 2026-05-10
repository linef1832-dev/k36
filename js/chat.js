// ============================================================
//  LINE Chat Inbox — Frontend Logic
//  รองรับ multi-tenant (20 OA) + Realtime + Claim ticket
// ============================================================

// ── State ────────────────────────────────────────────────
let chatState = {
  channels: [],            // [{ id, bot_user_id, channel_name, color_hex, ... }]
  channelMap: {},          // { id: channel } สำหรับ lookup
  selectedChannelId: 'all',
  statusFilter: 'unassigned',  // 'unassigned' | 'mine' | 'all'
  conversations: [],
  selectedConvId: null,
  selectedConv: null,
  messages: [],
  searchTerm: '',
  realtimeChannel: null,
  pollInterval: null
};

// ── Helper ──────────────────────────────────────────────
function chatFmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'เมื่อกี้';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && d.toDateString() === now.toDateString())
    return d.toTimeString().substring(0, 5);
  if (diffHr < 48) return 'เมื่อวาน ' + d.toTimeString().substring(0, 5);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + d.toTimeString().substring(0, 5);
}

function chatEscapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function chatChannelColor(channelId) {
  const ch = chatState.channelMap[channelId];
  return ch?.color_hex || '#06b6d4';
}

function chatChannelName(channelId) {
  const ch = chatState.channelMap[channelId];
  return ch?.channel_name || '—';
}

// ตรวจสิทธิ์: admin/manager → true เสมอ, นอกนั้นเช็ค hasUserPerm
function chatHasPerm(permId) {
  const role = (currentUser?.role || '').toLowerCase();
  if (role === 'admin' || role === 'manager') return true;
  if (typeof window.hasUserPerm === 'function') return window.hasUserPerm(permId);
  return false;
}

// ── Init: เรียกตอนเข้าหน้า chat ────────────────────────────
window.initChatApp = async function () {
  if (!appDB) return;

  // 1. โหลดรายการ OA
  await chatLoadChannels();

  // 2. แสดงปุ่มตั้งค่า OA ตามสิทธิ์
  const canManage = (typeof window.hasUserPerm === 'function' && window.hasUserPerm('chat_manage_channels'))
                 || ['admin','manager'].includes((currentUser?.role || '').toLowerCase());
  if (canManage) {
    document.getElementById('chatAdminBtn')?.classList.remove('hidden');
  }

  // 3. Wire UI
  document.getElementById('chatChannelSelect')?.addEventListener('change', e => {
    chatState.selectedChannelId = e.target.value;
    chatLoadConversations();
  });

  document.getElementById('chatSearch')?.addEventListener('input', e => {
    chatState.searchTerm = e.target.value.trim().toLowerCase();
    chatRenderConversationList();
  });

  document.getElementById('chatInputText')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatSendMessage();
    }
  });

  // 4. โหลด conversations + subscribe Realtime
  await chatLoadConversations();
  chatSubscribeRealtime();

  // 5. Polling fallback (กรณี Realtime หลุด) — ทุก 30 วิ
  if (chatState.pollInterval) clearInterval(chatState.pollInterval);
  chatState.pollInterval = setInterval(() => {
    if (document.getElementById('chatApp')) chatLoadConversations(true);
    else { clearInterval(chatState.pollInterval); chatState.pollInterval = null; }
  }, 30000);
};

// ── โหลดรายการ OA ที่ active ─────────────────────────────
async function chatLoadChannels() {
  const { data, error } = await appDB
    .from('line_channels_public')
    .select('*')
    .order('channel_name');

  if (error) {
    console.error('[chat] load channels error:', error);
    return;
  }

  chatState.channels = data || [];
  chatState.channelMap = {};
  chatState.channels.forEach(c => { chatState.channelMap[c.id] = c; });

  const sel = document.getElementById('chatChannelSelect');
  if (sel) {
    sel.innerHTML = '<option value="all">— ทุก OA —</option>' +
      chatState.channels.map(c =>
        `<option value="${c.id}">${chatEscapeHtml(c.channel_name)}</option>`
      ).join('');
  }

  // ถ้ายังไม่มี OA เลย → แจ้ง admin ตั้งค่า
  if (chatState.channels.length === 0) {
    const list = document.getElementById('chatConvList');
    if (list) {
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
      list.innerHTML = `
        <div class="p-6 text-center text-gray-400 text-sm">
          <span class="material-icons text-4xl text-amber-400">warning</span>
          <p class="mt-2 font-bold text-amber-600">ยังไม่ได้ตั้งค่า OA</p>
          ${isAdmin
            ? '<button onclick="openChatChannelManager()" class="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-md">+ เพิ่ม OA แรก</button>'
            : '<p class="text-xs mt-1">ติดต่อแอดมินให้เพิ่ม OA ก่อน</p>'}
        </div>`;
    }
  }
}

// ── โหลด conversations ตาม filter ────────────────────────
async function chatLoadConversations(silent = false) {
  if (chatState.channels.length === 0) return;

  let q = appDB.from('line_conversations')
    .select('*, customer:line_customers(line_user_id, display_name, picture_url, is_blocked)')
    .order('last_message_at', { ascending: false })
    .limit(200);

  if (chatState.selectedChannelId !== 'all') {
    q = q.eq('channel_id', chatState.selectedChannelId);
  }

  if (chatState.statusFilter === 'unassigned') {
    q = q.eq('status', 'unassigned');
  } else if (chatState.statusFilter === 'mine') {
    q = q.eq('assigned_to', currentUser.username).neq('status', 'closed');
  } else {
    q = q.neq('status', 'closed');
  }

  const { data, error } = await q;
  if (error) {
    if (!silent) console.error('[chat] load conv error:', error);
    return;
  }

  chatState.conversations = data || [];
  chatRenderConversationList();
  chatUpdateBadges();
}

// ── render รายการ conversation ──────────────────────────
function chatRenderConversationList() {
  const list = document.getElementById('chatConvList');
  if (!list) return;

  let convs = chatState.conversations;
  if (chatState.searchTerm) {
    const t = chatState.searchTerm;
    convs = convs.filter(c =>
      (c.customer?.display_name || '').toLowerCase().includes(t) ||
      (c.last_message_preview || '').toLowerCase().includes(t)
    );
  }

  if (convs.length === 0) {
    list.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm">
      <span class="material-icons text-3xl text-gray-300">inbox</span>
      <p class="mt-2">ไม่มีเคสในมุมมองนี้</p></div>`;
    return;
  }

  list.innerHTML = convs.map(c => {
    const cust = c.customer || {};
    const channelColor = chatChannelColor(c.channel_id);
    const channelName = chatChannelName(c.channel_id);
    const isActive = c.id === chatState.selectedConvId;
    const unread = c.unread_count > 0;
    const dirIcon = c.last_message_direction === 'out'
      ? '<span class="material-icons text-[12px] text-emerald-500 mr-1">reply</span>' : '';
    const ownerBadge = c.assigned_to
      ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 rounded font-bold">${chatEscapeHtml(c.assigned_to)}</span>`
      : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 rounded font-bold animate-pulse">ใหม่</span>`;

    return `
    <div class="chat-conv-item ${isActive ? 'active' : ''} p-2.5 flex gap-2" onclick="chatOpenConversation('${c.id}')">
      <img src="${chatEscapeHtml(cust.picture_url || '')}" class="w-10 h-10 rounded-full bg-slate-200 object-cover shrink-0"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 40 40\\'%3E%3Crect width=\\'40\\' height=\\'40\\' fill=\\'%23cbd5e1\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23fff\\' font-size=\\'18\\'%3E?%3C/text%3E%3C/svg%3E'">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1 mb-0.5">
          <span class="chat-channel-pill" style="background:${channelColor}">${chatEscapeHtml(channelName)}</span>
          ${ownerBadge}
          <span class="text-[10px] text-gray-400 ml-auto">${chatFmtTime(c.last_message_at)}</span>
        </div>
        <div class="font-bold text-sm dark:text-white truncate">${chatEscapeHtml(cust.display_name || 'ลูกค้า')}</div>
        <div class="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 truncate">
          ${dirIcon}<span class="truncate ${unread ? 'font-bold dark:text-white' : ''}">${chatEscapeHtml((c.last_message_preview || '').substring(0, 60))}</span>
          ${unread ? `<span class="chat-conv-unread shrink-0 ml-auto">${c.unread_count}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── tab status ────────────────────────────────────────
window.chatSetStatusFilter = function (s) {
  chatState.statusFilter = s;
  document.querySelectorAll('[data-chat-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.chatTab === s));
  chatLoadConversations();
};

// ── update badges ─────────────────────────────────────
function chatUpdateBadges() {
  const all = chatState.conversations;
  const unassigned = all.filter(c => c.status === 'unassigned').length;
  const mine = all.filter(c => c.assigned_to === currentUser.username && c.status !== 'closed').length;
  const totalUnread = all.reduce((s, c) => s + (c.unread_count || 0), 0);

  document.getElementById('chatBadgeUnassigned').textContent = unassigned;
  document.getElementById('chatBadgeMine').textContent = mine;

  const tBadge = document.getElementById('chatTotalUnreadBadge');
  if (totalUnread > 0) { tBadge.textContent = totalUnread + ' ใหม่'; tBadge.classList.remove('hidden'); }
  else tBadge.classList.add('hidden');
}

// ── เปิดเคสที่เลือก ─────────────────────────────────────
window.chatOpenConversation = async function (convId) {
  chatState.selectedConvId = convId;
  chatRenderConversationList();

  document.getElementById('chatEmptyState').classList.add('hidden');
  document.getElementById('chatRoom').classList.remove('hidden');
  document.getElementById('chatRoom').classList.add('flex');

  const { data: conv } = await appDB.from('line_conversations')
    .select('*, customer:line_customers(*)').eq('id', convId).single();
  if (!conv) return;

  chatState.selectedConv = conv;
  chatRenderHeader(conv);
  await chatLoadMessages(convId);

  // ถ้าเป็นเคสของฉัน → mark as read
  if (conv.assigned_to === currentUser.username && conv.unread_count > 0) {
    await appDB.rpc('mark_line_conversation_read', { p_conv_id: convId });
  }
};

function chatRenderHeader(conv) {
  const c = conv.customer || {};
  document.getElementById('chatHeaderName').textContent = c.display_name || 'ลูกค้า';
  document.getElementById('chatHeaderAvatar').src = c.picture_url || '';

  const ch = chatState.channelMap[conv.channel_id];
  const chPill = document.getElementById('chatHeaderChannel');
  chPill.textContent = ch?.channel_name || '—';
  chPill.style.background = ch?.color_hex || '#06b6d4';

  const statusEl = document.getElementById('chatHeaderStatus');
  if (conv.status === 'unassigned') statusEl.innerHTML = '🆕 ยังไม่มีคนรับ';
  else if (conv.status === 'closed') statusEl.innerHTML = '✓ ปิดแล้ว';
  else if (conv.assigned_to === currentUser.username) statusEl.innerHTML = '👤 ของคุณ';
  else statusEl.innerHTML = `👤 ${chatEscapeHtml(conv.assigned_to)}`;

  const isOwner = conv.assigned_to === currentUser.username;
  const isUnassigned = conv.status === 'unassigned';
  const canClaim   = chatHasPerm('chat_claim');
  const canRelease = chatHasPerm('chat_release');
  const canClose   = chatHasPerm('chat_close');
  const canSend    = chatHasPerm('chat_send');

  document.getElementById('chatBtnClaim').classList.toggle('hidden', !isUnassigned || !canClaim);
  document.getElementById('chatBtnRelease').classList.toggle('hidden', !isOwner || conv.status === 'closed' || !canRelease);
  document.getElementById('chatBtnClose').classList.toggle('hidden', !isOwner || conv.status === 'closed' || !canClose);

  document.getElementById('chatInputArea').classList.toggle('hidden', !isOwner || conv.status === 'closed' || !canSend);
  document.getElementById('chatInputDisabled').classList.toggle('hidden', isOwner && conv.status !== 'closed' && canSend);

  chatRenderProfile(c, conv);
}

function chatRenderProfile(cust, conv) {
  const empty = document.getElementById('chatProfileEmpty');
  const content = document.getElementById('chatProfileContent');
  if (!content) return;
  empty?.classList.add('hidden');
  content.classList.remove('hidden');
  content.innerHTML = `
    <div class="text-center">
      <img src="${chatEscapeHtml(cust.picture_url || '')}" class="w-20 h-20 rounded-full mx-auto bg-slate-200">
      <div class="font-bold dark:text-white mt-2">${chatEscapeHtml(cust.display_name || '—')}</div>
      ${cust.status_message ? `<div class="text-[11px] text-gray-500 italic mt-1">"${chatEscapeHtml(cust.status_message)}"</div>` : ''}
    </div>
    <div class="border-t border-slate-200 dark:border-slate-700 pt-2 text-[12px] space-y-1.5 dark:text-gray-300">
      <div><span class="text-gray-400">User ID:</span> <code class="text-[10px] break-all">${chatEscapeHtml(cust.line_user_id || '')}</code></div>
      <div><span class="text-gray-400">เพิ่มเพื่อนเมื่อ:</span> ${chatFmtTime(cust.first_seen)}</div>
      <div><span class="text-gray-400">เห็นล่าสุด:</span> ${chatFmtTime(cust.last_seen)}</div>
      ${cust.is_blocked ? '<div class="text-red-500 font-bold text-xs">⚠️ ลูกค้าบล็อค OA</div>' : ''}
    </div>`;
}

// ── โหลดข้อความในเคส ──────────────────────────────────
async function chatLoadMessages(convId) {
  const { data } = await appDB.from('line_messages')
    .select('*').eq('conversation_id', convId)
    .order('created_at', { ascending: true }).limit(500);
  chatState.messages = data || [];
  chatRenderMessages();
}

function chatRenderMessages() {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  if (chatState.messages.length === 0) {
    box.innerHTML = '<div class="text-center text-gray-300 mt-8 text-sm">ยังไม่มีข้อความ</div>';
    return;
  }
  box.innerHTML = chatState.messages.map(m => {
    const time = chatFmtTime(m.created_at);
    if (m.direction === 'system')
      return `<div class="chat-msg-row" style="justify-content:center"><div class="chat-bubble system">${chatEscapeHtml(m.content)}</div></div>`;
    const cls = m.direction === 'out' ? 'out' : 'in';
    let body = chatEscapeHtml(m.content || '');
    if (m.message_type === 'image' && m.preview_url)
      body = `<img src="${chatEscapeHtml(m.preview_url)}" class="max-w-[200px] rounded-lg">`;
    else if (m.message_type === 'sticker' && m.preview_url)
      body = `<img src="${chatEscapeHtml(m.preview_url)}" class="w-24 h-24">`;
    const sender = m.direction === 'out' ? `<div class="chat-msg-time">${chatEscapeHtml(m.sender_id)}</div>` : '';
    return `<div class="chat-msg-row ${cls}">
      <div>
        <div class="chat-bubble ${cls}">${body}</div>
        <div class="chat-msg-time" style="text-align:${cls === 'out' ? 'right' : 'left'}">${time}</div>
        ${sender}
      </div></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// ── ส่งข้อความ ────────────────────────────────────────
window.chatSendMessage = async function () {
  const ta = document.getElementById('chatInputText');
  const text = ta.value.trim();
  if (!text || !chatState.selectedConvId) return;

  const conv = chatState.selectedConv;
  if (!conv || conv.assigned_to !== currentUser.username) {
    return Swal.fire('!', 'ต้องรับเคสก่อนถึงจะตอบได้', 'warning');
  }

  const btn = document.getElementById('chatBtnSend');
  btn.disabled = true;
  ta.disabled = true;

  try {
    const res = await fetch(`${DB_URL}/functions/v1/line-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': DB_KEY, 'Authorization': `Bearer ${DB_KEY}` },
      body: JSON.stringify({
        conversation_id: chatState.selectedConvId,
        text,
        staff_username: currentUser.username
      })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'ส่งล้มเหลว');
    ta.value = '';
  } catch (e) {
    Swal.fire('ส่งล้มเหลว', e.message, 'error');
  } finally {
    btn.disabled = false;
    ta.disabled = false;
    ta.focus();
  }
};

// ── claim / release / close ─────────────────────────────
window.chatClaim = async function () {
  if (!chatState.selectedConvId) return;
  const { data } = await appDB.rpc('claim_line_conversation', {
    p_conv_id: chatState.selectedConvId, p_username: currentUser.username
  });
  if (!data?.success) {
    return Swal.fire('รับเคสไม่ได้', `${data?.error || 'มีคนรับก่อนแล้ว'}<br>เจ้าของ: <b>${data?.owner || '?'}</b>`, 'warning');
  }
  await chatOpenConversation(chatState.selectedConvId);
  await chatLoadConversations();
};

window.chatRelease = async function () {
  const ok = await Swal.fire({
    title: 'ปล่อยเคสกลับเข้า pool?', icon: 'warning',
    showCancelButton: true, confirmButtonText: 'ปล่อย', cancelButtonText: 'ยกเลิก'
  });
  if (!ok.isConfirmed) return;
  const { data } = await appDB.rpc('release_line_conversation', {
    p_conv_id: chatState.selectedConvId, p_username: currentUser.username
  });
  if (!data?.success) return Swal.fire('!', data?.error || 'ผิดพลาด', 'error');
  await chatOpenConversation(chatState.selectedConvId);
  await chatLoadConversations();
};

window.chatClose = async function () {
  const ok = await Swal.fire({
    title: 'ปิดเคสนี้?', text: 'เคสจะถูกย้ายไปสถานะ closed (เปิดใหม่ได้ถ้าลูกค้าทักเพิ่ม)',
    icon: 'question', showCancelButton: true, confirmButtonText: 'ปิดเคส', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#64748b'
  });
  if (!ok.isConfirmed) return;
  await appDB.rpc('close_line_conversation', {
    p_conv_id: chatState.selectedConvId, p_username: currentUser.username
  });
  chatState.selectedConvId = null;
  document.getElementById('chatRoom').classList.add('hidden');
  document.getElementById('chatEmptyState').classList.remove('hidden');
  await chatLoadConversations();
};

// ── Realtime subscription ──────────────────────────────
function chatSubscribeRealtime() {
  if (chatState.realtimeChannel) {
    appDB.removeChannel(chatState.realtimeChannel);
  }
  chatState.realtimeChannel = appDB.channel('line-chat-rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'line_messages' }, payload => {
      const m = payload.new;
      // ถ้าเป็นเคสที่เปิดอยู่ → append message
      if (m.conversation_id === chatState.selectedConvId) {
        chatState.messages.push(m);
        chatRenderMessages();
      }
      // refresh list (ไม่บล็อก UI)
      chatLoadConversations(true);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'line_conversations' }, () => {
      chatLoadConversations(true);
      if (chatState.selectedConvId) {
        appDB.from('line_conversations').select('*, customer:line_customers(*)')
          .eq('id', chatState.selectedConvId).single()
          .then(({ data }) => { if (data) { chatState.selectedConv = data; chatRenderHeader(data); } });
      }
    })
    .subscribe(status => {
      const el = document.getElementById('chatConnStatus');
      if (!el) return;
      if (status === 'SUBSCRIBED') el.innerHTML = '<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online';
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') el.innerHTML = '<span class="w-2 h-2 bg-red-400 rounded-full"></span> หลุด';
    });

  // ลงทะเบียนกับ cleanup ของ global.js
  if (window.activeSubscriptions) window.activeSubscriptions.push(chatState.realtimeChannel);
}
