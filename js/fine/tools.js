window.editFineRecord = async function(id) {
  const fineRecord = globalFines.find((f => String(f.id) === String(id)));
  if (!fineRecord) return Swal.fire('Error', 'ไม่พบข้อมูลใบปรับนี้', 'error');
  let currentOffenseDate = '';
  if (fineRecord.offense_date) {
    currentOffenseDate = fineRecord.offense_date.split('T')[0];
  } else {
    currentOffenseDate = fineRecord.created_at.split('T')[0];
  }
  let ruleOptionsHtml = '';
  globalFineRules.forEach((r => {
    const isSelected = r === fineRecord.rule_text ? 'selected' : '';
    ruleOptionsHtml += `<option value="${r}" ${isSelected}>${r}</option>`;
  }));
  let currentAmount = fineRecord.amount === -1 ? '' : fineRecord.amount;
  let isNoWage = fineRecord.amount === -1;
  const {isConfirmed: isConfirmed, value: parsedData} = await Swal.fire({
    title: '<div class="text-xl font-black text-amber-500 flex items-center justify-center gap-2"><span class="material-icons">edit_note</span> แก้ไขข้อมูลใบปรับ</div>',
    html: `\n            <div class="text-left space-y-4 mt-4">\n                <div>\n                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">วันที่ทำผิด (เหตุเกิดวันที่)</label>\n                    <input type="date" id="swalEditOffenseDate" value="${currentOffenseDate}" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">\n                </div>\n                <div>\n                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">กฎ / ความผิด</label>\n                    <select id="swalEditRule" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">\n                        ${ruleOptionsHtml}\n                    </select>\n                </div>\n                <div>\n                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">หมายเหตุเพิ่มเติม</label>\n                    <input type="text" id="swalEditNote" value="${fineRecord.note || ''}" placeholder="พิมพ์หมายเหตุเพิ่มเติม..." class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm transition">\n                </div>\n                <div>\n                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">ค่าปรับ</label>\n                    <div class="flex gap-2">\n                        <select id="swalEditPenaltyType" onchange="document.getElementById('swalEditAmount').disabled = this.value === 'nowage'; if(this.value === 'nowage') document.getElementById('swalEditAmount').value = '';" class="w-[45%] p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">\n                            <option value="money" ${!isNoWage ? 'selected' : ''}>ระบุเงิน (บาท)</option>\n                            <option value="nowage" ${isNoWage ? 'selected' : ''}>ไม่ได้รับค่าแรง</option>\n                        </select>\n                        <input type="number" id="swalEditAmount" value="${currentAmount}" ${isNoWage ? 'disabled' : ''} placeholder="ระบุตัวเลข (ไม่ต้องใส่ลูกน้ำ)" class="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm transition disabled:opacity-50">\n                    </div>\n                </div>\n            </div>\n        `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกการแก้ไข',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#64748b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl'
    },
    preConfirm: () => {
      const offenseDate = document.getElementById('swalEditOffenseDate').value;
      const ruleText = document.getElementById('swalEditRule').value;
      const note = document.getElementById('swalEditNote').value.trim();
      const penaltyType = document.getElementById('swalEditPenaltyType').value;
      const amountInput = document.getElementById('swalEditAmount').value.trim();
      let finalAmount = 0;
      if (penaltyType === 'nowage') finalAmount = -1; else finalAmount = parseInt(amountInput) || 0;
      if (!offenseDate) {
        Swal.showValidationMessage('กรุณาระบุวันที่เกิดเหตุ!');
        return false;
      }
      if (!ruleText) {
        Swal.showValidationMessage('กรุณาเลือกกฎ!');
        return false;
      }
      return {
        offenseDate: offenseDate,
        ruleText: ruleText,
        note: note,
        amount: finalAmount
      };
    }
  });
  if (isConfirmed && parsedData) {
    Swal.fire({
      title: 'กำลังอัปเดตข้อมูล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      const {error: error} = await appDB.from('fines').update({
        offense_date: parsedData.offenseDate,
        rule_text: parsedData.ruleText,
        note: parsedData.note,
        amount: parsedData.amount
      }).eq('id', id);
      if (error) throw error;
      const idx = globalFines.findIndex((f => String(f.id) === String(id)));
      if (idx > -1) {
        globalFines[idx].offense_date = parsedData.offenseDate;
        globalFines[idx].rule_text = parsedData.ruleText;
        globalFines[idx].note = parsedData.note;
        globalFines[idx].amount = parsedData.amount;
      }
      renderFineTable();
      if (typeof renderFineStats === 'function' && document.getElementById('fineContent_stats') && !document.getElementById('fineContent_stats').classList.contains('hidden')) {
        renderFineStats();
      }
      Swal.fire({
        icon: 'success',
        title: 'แก้ไขสำเร็จ',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  }
};

window.generateFineText = function() {
  const empInput = document.getElementById('fineEmpInput');
  const ruleSelect = document.getElementById('fineRuleSelect');
  if (!empInput || !ruleSelect) return;
  let empName = empInput.value.trim();
  const targetUser = typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST ? GLOBAL_USER_LIST.find((u => String(u.username).toLowerCase() === String(empName).toLowerCase())) : null;
  if (targetUser) empName = targetUser.username;
  const ruleText = ruleSelect.value;
  if (!empName || !ruleText) {
    return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและหัวข้อกฎหมายก่อนครับ', 'warning');
  }
  const noteSelect = document.getElementById('fineNoteSelect') ? document.getElementById('fineNoteSelect').value : '';
  const noteInput = document.getElementById('fineNoteInput') ? document.getElementById('fineNoteInput').value.trim() : '';
  let finalNote = noteSelect;
  if (finalNote.startsWith('(') && finalNote.endsWith(')')) {
    finalNote = finalNote.substring(1, finalNote.length - 1).trim();
  }
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
  let cleanRule = ruleText.replace(/^\s*\[.*?\]\s*/, '');
  cleanRule = cleanRule.replace(/\s*\([^)]*(ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*\)/gi, '').trim();
  let ruleHeader = cleanRule;
  let ruleDesc = "";
  const match = cleanRule.match(/^(บทที่\s*[\d\.]+\s*ข้อ(?:ที่)?\s*[\d\.]+)\s+(.*)$/);
  if (match) {
    ruleHeader = match[1].trim();
    ruleDesc = match[2].trim();
  }
  const offenseDateVal = document.getElementById('fineOffenseDate') ? document.getElementById('fineOffenseDate').value : '';
  let dateStr = '';
  if (offenseDateVal) {
    const [y, m, d] = offenseDateVal.split('-');
    dateStr = `${d}/${m}/${y}`;
  } else {
    const now = new Date;
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    dateStr = `${dd}/${mm}/${yyyy}`;
  }
  const _mine = globalFines.filter((f => String(f.user_name).toLowerCase() === String(empName).toLowerCase() && f.rule_text === ruleText));
  const _justSaved = _mine.some((f => {
    const sameIssuer = !currentUser || !f.issued_by || String(f.issued_by).toLowerCase() === String(currentUser.username || '').toLowerCase();
    const recent = Date.now() - new Date(f.created_at).getTime() < 15 * 60 * 1e3;
    const sameDay = !offenseDateVal || !f.offense_date || String(f.offense_date).slice(0, 10) === offenseDateVal;
    return sameIssuer && recent && sameDay;
  }));
  const currentCount = _mine.length + (_justSaved ? 0 : 1);
  const isPercentChecked = document.getElementById('fineUsePercent') ? document.getElementById('fineUsePercent').checked : false;
  let percentText = "";
  if (isPercentChecked && typeof window.calculatePercentTotal === 'function') {
    const percentFineAmount = window.calculatePercentTotal();
    if (percentFineAmount > 0) {
      const baseVol = document.getElementById('finePercentBaseAmount').value;
      const rateVal = document.getElementById('finePercentRate').value;
      percentText = `เสียหาย ${parseInt(baseVol).toLocaleString('en-US')} - ${rateVal} % = ${percentFineAmount.toLocaleString('en-US')} บ.`;
    }
  }
  let resultText = `${empName} ${ruleHeader}`;
  if (ruleDesc) {
    resultText += ` - ${ruleDesc}`;
  }
  if (finalNote) {
    resultText += ` (${finalNote.trim()})`;
  }
  resultText += ` ${dateStr}`;
  if (percentText) {
    resultText += `\n${percentText} ครั้งที่ ${currentCount}`;
  }
  const resultBox = document.getElementById('fineTextResultBox');
  const textArea = document.getElementById('fineTextResult');
  if (resultBox && textArea) {
    textArea.value = resultText;
    textArea.rows = percentText ? 3 : 2;
    resultBox.classList.remove('hidden');
  }
};

window.copyFineText = function() {
  const textArea = document.getElementById('fineTextResult');
  if (!textArea || !textArea.value) return;
  navigator.clipboard.writeText(textArea.value).then((() => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
    Toast.fire({
      icon: 'success',
      title: 'คัดลอกข้อความแล้ว!'
    });
  })).catch((err => {
    Swal.fire('Error', 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ', 'error');
  }));
};

window.togglePercentCalc = function() {
  const box = document.getElementById('finePercentCalcBox');
  const isChecked = document.getElementById('fineUsePercent').checked;
  const baseAmtInput = document.getElementById('finePercentBaseAmount');
  if (isChecked) {
    if (box) {
      box.classList.remove('hidden');
      box.classList.add('flex');
    }
    if (baseAmtInput) baseAmtInput.focus();
  } else {
    if (box) {
      box.classList.add('hidden');
      box.classList.remove('flex');
    }
    if (baseAmtInput) baseAmtInput.value = '';
    if (document.getElementById('finePercentRate')) document.getElementById('finePercentRate').value = '10';
    if (document.getElementById('finePercentResultText')) document.getElementById('finePercentResultText').innerText = '฿0';
  }
};

window.calculatePercentTotal = function() {
  const baseAmt = parseInt(document.getElementById('finePercentBaseAmount').value) || 0;
  const rate = parseInt(document.getElementById('finePercentRate').value) || 10;
  const result = Math.floor(baseAmt * (rate / 100));
  if (document.getElementById('finePercentResultText')) {
    document.getElementById('finePercentResultText').innerText = `฿${result.toLocaleString('en-US')}`;
  }
  return result;
};

let fineSearchTimeout = null;

window.onFineSearch = function() {
  clearTimeout(fineSearchTimeout);
  fineSearchTimeout = setTimeout((() => {
    renderFineTable();
  }), 300);
};

(function() {
  if (window.__fxSelectReady) return;
  window.__fxSelectReady = true;
  const CSS = `\n    .fx-sel{position:relative}\n    .fx-sel:not([class*='w-']){width:100%}\n    .fx-sel select{position:absolute!important;opacity:0;pointer-events:none;width:1px;height:1px;left:0;top:0}\n    .fx-btn{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;border-radius:12px;cursor:pointer;text-align:left;\n        background:linear-gradient(180deg,var(--k-panel),var(--k-panel2));border:1px solid rgba(148,163,184,.25);color:var(--k-tx);font-weight:800;font-size:13.5px;\n        box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 1px 2px rgba(0,0,0,.35);transition:border-color .15s,box-shadow .15s}\n    .fx-btn:hover{border-color:rgba(232,193,90,.55)}\n    .fx-sel.open .fx-btn,.fx-btn:focus{outline:none;border-color:#E8C15A;box-shadow:0 0 0 3px rgba(232,193,90,.18)}\n    .fx-btn.ph{color:var(--k-mute2);font-weight:700}\n    .fx-sel.compact .fx-btn{padding:8px 8px 8px 10px;gap:4px;font-size:14px}\n    .fx-sel.compact .fx-caret{font-size:18px}\n    .fx-btn .fx-ic{font-size:18px;color:var(--k-gold-tx);flex:none}\n    .fx-btn .fx-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35}\n    .fx-btn .fx-txt small{display:block;font-size:10.5px;color:var(--k-tx3);font-weight:700;letter-spacing:.03em}\n    .fx-btn .fx-caret{font-size:20px;color:var(--k-tx3);flex:none;transition:transform .15s}\n    .fx-sel.open .fx-caret{transform:rotate(180deg)}\n    .fx-sel.dis .fx-btn{opacity:.5;cursor:not-allowed}\n    .fx-pop{position:fixed;z-index:2147483000;border-radius:14px;overflow:hidden;width:max-content;max-width:min(92vw,680px);\n        background:var(--k-panel2);border:1px solid rgba(232,193,90,.35);box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4);\n        transform-origin:top;animation:fxPop .12s ease-out}\n    @keyframes fxPop{from{opacity:0;transform:scaleY(.96) translateY(-4px)}to{opacity:1;transform:none}}\n    .fx-search{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.15);background:var(--k-panel2)}\n    .fx-search .material-icons{font-size:18px;color:var(--k-tx3)}\n    .fx-search input{flex:1;background:transparent;border:0;outline:none;color:var(--k-tx);font-size:13px;font-weight:700}\n    .fx-list{max-height:min(360px,60vh);overflow-y:auto;padding:6px;scrollbar-width:thin;scrollbar-color:rgba(232,193,90,.4) transparent}\n    .fx-grp{position:sticky;top:0;z-index:1;margin:6px 2px 2px;padding:5px 10px;white-space:nowrap;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;\n        color:#0b1120;background:linear-gradient(90deg,#f5e3ae,#E8C15A);box-shadow:0 2px 8px rgba(232,193,90,.2)}\n    .fx-opt{display:flex;align-items:center;gap:10px;padding:9px 10px;margin:2px 0;border-radius:10px;cursor:pointer;color:var(--k-tx);font-size:13px;font-weight:700;line-height:1.35;border:1px solid transparent;white-space:nowrap}\n    .fx-opt .fx-no{flex:none;min-width:52px;padding:2px 8px;border-radius:999px;text-align:center;font-size:11px;font-weight:900;color:var(--k-gold-tx);background:rgba(232,193,90,.12);border:1px solid rgba(232,193,90,.35);font-variant-numeric:tabular-nums}\n    .fx-opt .fx-lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n    .fx-opt .fx-pen{flex:none;font-size:11px;font-weight:800;color:var(--k-red-tx);background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);padding:2px 8px;border-radius:999px;white-space:nowrap}\n    .fx-opt .fx-pen.nowage{color:var(--k-amber-tx);background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.4)}\n    .fx-opt:hover,.fx-opt.act{background:rgba(232,193,90,.1);border-color:rgba(232,193,90,.3)}\n    .fx-opt.sel{background:rgba(37,99,235,.22);border-color:rgba(96,165,250,.5);color:var(--k-tx-strong)}\n    .fx-opt.sel .fx-lb::after{content:'check';font-family:'Material Icons';font-size:16px;color:light-dark(#054ea8,#60a5fa);float:right;margin-left:8px}\n    .fx-opt.ph{color:var(--k-mute2);font-weight:700}\n    .fx-empty{padding:16px;text-align:center;color:var(--k-mute);font-size:12.5px;font-weight:700}\n    `;
  const st = document.createElement('style');
  st.id = 'fx-select-css';
  st.textContent = CSS;
  document.head.appendChild(st);
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const PEN_RE = /\s*\(([^)]*(?:ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*)\)\s*$/i;
  function parseLabel(text) {
    const m = String(text).match(/^\s*ข้อ\s*([\d.]+)\s*·\s*(.*)$/);
    let body = m ? m[2] : String(text), pen = '';
    const pm = body.match(PEN_RE);
    if (pm) {
      pen = pm[1].trim();
      body = body.replace(PEN_RE, '').trim();
    }
    return {
      no: m ? m[1] : '',
      body: body,
      pen: pen
    };
  }
  function enhance(sel, opt = {}) {
    if (!sel) return;
    if (sel.__fx && sel.__fx.wrap.isConnected && sel.parentNode === sel.__fx.wrap) {
      sel.__fx.sync();
      return;
    }
    let p = sel.parentNode;
    while (p && p.classList && p.classList.contains('fx-sel')) {
      const outer = p.parentNode;
      outer.insertBefore(sel, p);
      p.remove();
      p = sel.parentNode;
    }
    document.querySelectorAll('body > .fx-pop').forEach((x => x.remove()));
    sel.__fx = null;
    const wrap = document.createElement('div');
    wrap.className = 'fx-sel' + (opt.compact ? ' compact' : '');
    Array.from(sel.classList).filter((c => /^(w-|flex-|shrink|grow)/.test(c))).forEach((c => {
      wrap.classList.add(c);
    }));
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fx-btn';
    wrap.appendChild(btn);
    let pop = null, filter = '', act = -1;
    const fx = {
      sel: sel,
      wrap: wrap,
      btn: btn,
      opt: opt,
      render: render,
      sync: sync
    };
    sel.__fx = fx;
    function items() {
      const out = [];
      let grp = '';
      Array.from(sel.children).forEach((ch => {
        if (ch.tagName === 'OPTGROUP') {
          grp = ch.label.replace(/━/g, '').trim();
          Array.from(ch.children).forEach((o => out.push({
            o: o,
            grp: grp
          })));
        } else out.push({
          o: ch,
          grp: ''
        });
      }));
      return out;
    }
    function sync() {
      const o = sel.options[sel.selectedIndex];
      const isPh = !sel.value;
      btn.classList.toggle('ph', isPh);
      wrap.classList.toggle('dis', sel.disabled);
      btn.disabled = sel.disabled;
      let txt = o ? o.textContent : '';
      let sub = '';
      if (!isPh && o && o.parentNode.tagName === 'OPTGROUP') sub = o.parentNode.label.replace(/━/g, '').trim();
      const p = parseLabel(txt);
      const main = p.no ? `ข้อ ${p.no} · ${p.body}${p.pen ? ` (${p.pen})` : ''}` : txt;
      btn.innerHTML = (opt.compact ? '' : `<span class="material-icons fx-ic">${esc(opt.icon || 'list')}</span>`) + `<span class="fx-txt">${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="material-icons fx-caret">expand_more</span>`;
    }
    function close() {
      if (pop) {
        pop.remove();
        pop = null;
      }
      if (fx._place) {
        window.removeEventListener('resize', fx._place);
        window.removeEventListener('scroll', fx._place, true);
        fx._place = null;
      }
      wrap.classList.remove('open');
      filter = '';
      act = -1;
    }
    function choose(val) {
      sel.value = val;
      sel.dispatchEvent(new Event('change', {
        bubbles: true
      }));
      close();
      sync();
      btn.focus();
    }
    function render() {
      if (!pop) return;
      const list = pop.querySelector('.fx-list');
      const all = items().filter((x => !filter || (x.o.textContent + ' ' + x.grp).toLowerCase().includes(filter.toLowerCase())));
      if (!all.length) {
        list.innerHTML = '<div class="fx-empty">ไม่พบรายการ</div>';
        return;
      }
      let html = '', lastGrp = null;
      const rows = [];
      all.forEach((x => {
        if (x.grp && x.grp !== lastGrp) {
          html += `<div class="fx-grp">${esc(x.grp)}</div>`;
          lastGrp = x.grp;
        }
        const p = parseLabel(x.o.textContent);
        const isPh = !x.o.value;
        const i = rows.length;
        rows.push(x.o.value);
        html += `<div class="fx-opt ${isPh ? 'ph' : ''} ${x.o.value === sel.value && !isPh ? 'sel' : ''} ${i === act ? 'act' : ''}" data-i="${i}" data-v="${esc(x.o.value)}">` + (p.no ? `<span class="fx-no">ข้อ ${esc(p.no)}</span>` : '') + `<span class="fx-lb">${esc(p.body)}</span>` + (p.pen ? `<span class="fx-pen ${/ค่าแรง|เลิกจ้าง/.test(p.pen) ? 'nowage' : ''}">${esc(p.pen)}</span>` : '') + `</div>`;
      }));
      list.innerHTML = html;
      list.__rows = rows;
      if (fx._place) fx._place();
      const a = list.querySelector('.fx-opt.act');
      if (a) a.scrollIntoView({
        block: 'nearest'
      });
    }
    function open() {
      if (sel.disabled || pop) return;
      document.querySelectorAll('.fx-sel.open').forEach((w => w !== wrap && w.querySelector('select').__fx.close()));
      pop = document.createElement('div');
      pop.className = 'fx-pop';
      const many = sel.options.length > 7;
      pop.innerHTML = (many ? `<div class="fx-search"><span class="material-icons">search</span><input placeholder="พิมพ์ค้นหา..." autocomplete="off"></div>` : '') + `<div class="fx-list"></div>`;
      document.body.appendChild(pop);
      wrap.classList.add('open');
      const place = () => {
        const r = btn.getBoundingClientRect();
        pop.style.minWidth = r.width + 'px';
        const ph = pop.offsetHeight, pw = pop.offsetWidth;
        let left = r.left;
        if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - pw);
        pop.style.left = left + 'px';
        if (window.innerHeight - r.bottom < ph + 12 && r.top > ph + 12) {
          pop.style.top = r.top - 6 - ph + 'px';
          pop.style.transformOrigin = 'bottom';
        } else {
          pop.style.top = r.bottom + 6 + 'px';
          pop.style.transformOrigin = 'top';
        }
      };
      fx._place = place;
      place();
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      const inp = pop.querySelector('input');
      if (inp) {
        inp.addEventListener('input', (() => {
          filter = inp.value;
          act = -1;
          render();
        }));
        setTimeout((() => inp.focus()), 0);
      }
      pop.addEventListener('mousedown', (e => {
        if (e.target.tagName !== 'INPUT') e.preventDefault();
      }));
      pop.addEventListener('keydown', onKey);
      pop.addEventListener('click', (e => {
        const o = e.target.closest('.fx-opt');
        if (o) choose(o.dataset.v);
      }));
      const cur = items().findIndex((x => x.o.value === sel.value && x.o.value));
      act = cur;
      render();
    }
    fx.close = close;
    btn.addEventListener('click', (() => pop ? close() : open()));
    function onKey(e) {
      if (!pop) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
        return;
      }
      const list = pop.querySelector('.fx-list');
      const n = (list.__rows || []).length;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        btn.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        act = Math.min(n - 1, act + 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        act = Math.max(0, act - 1);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (act >= 0 && list.__rows) choose(list.__rows[act]);
      }
    }
    wrap.addEventListener('keydown', onKey);
    fx._outside = e => {
      if (pop && !wrap.contains(e.target) && !pop.contains(e.target)) close();
    };
    if (!window.__fxOutsideBound) {
      window.__fxOutsideBound = true;
      document.addEventListener('click', (e => {
        document.querySelectorAll('.fx-sel').forEach((w => {
          const f = w.querySelector('select') && w.querySelector('select').__fx;
          if (f && f._outside) f._outside(e);
        }));
      }));
    }
    sel.addEventListener('change', sync);
    new MutationObserver((() => {
      sync();
      if (pop) render();
    })).observe(sel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [ 'disabled' ]
    });
    let lastV = sel.value;
    const tick = setInterval((() => {
      if (!wrap.isConnected) {
        clearInterval(tick);
        close();
        return;
      }
      if (sel.value !== lastV) {
        lastV = sel.value;
        sync();
      }
    }), 400);
    sync();
  }
  window.enhanceFineSelects = function() {
    enhance(document.getElementById('fineCategorySelect'), {
      icon: 'category'
    });
    enhance(document.getElementById('fineRuleSelect'), {
      icon: 'gavel'
    });
    enhance(document.getElementById('fineNoteSelect'), {
      icon: 'sticky_note_2'
    });
    enhance(document.getElementById('finePenaltyType'), {
      icon: 'payments'
    });
    enhance(document.getElementById('finePercentRate'), {
      compact: true
    });
  };
})();
