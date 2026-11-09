let draggedUser = null;

function cleanupDragEffects() {
  const tooltip = document.getElementById('drag-access-tooltip');
  if (tooltip) tooltip.style.display = 'none';
  document.querySelectorAll('.duty-site-card').forEach((card => {
    card.classList.remove('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]', 'opacity-40', 'grayscale');
  }));
  document.querySelectorAll('.ov-row').forEach((r => r.classList.remove('can', 'cant')));
}

document.addEventListener('dragover', (e => {
  const tooltip = document.getElementById('drag-access-tooltip');
  if (tooltip && tooltip.style.display === 'block') {
    tooltip.style.left = e.clientX + 15 + 'px';
    tooltip.style.top = e.clientY + 15 + 'px';
  }
}));

window.handleDragStart = function(event, userId, username, fromTeam) {
  const canDrag = window.isDutyAdmin();
  if (!canDrag) {
    event.preventDefault();
    return;
  }
  if (!userId || userId === 'undefined') {
    event.preventDefault();
    return;
  }
  const t = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
  const card = (event.currentTarget && event.currentTarget.classList ? event.currentTarget : null) || (t && t.closest ? t.closest('.duty-user-card') : null);
  if (!card) {
    event.preventDefault();
    return;
  }
  try {
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
  } catch (e) {}
  draggedUser = {
    id: userId,
    username: username,
    fromTeam: fromTeam
  };
  event.dataTransfer.effectAllowed = "move";
  try {
    event.dataTransfer.setData('text/plain', String(username || ''));
    event.dataTransfer.setDragImage(card, 20, 16);
  } catch (e) {}
  setTimeout((() => {
    if (card.classList) card.classList.add('opacity-50', 'scale-95');
  }), 0);
  const userAccess = dutyAccessMatrix[userId] || [];
  let accessText = userAccess.length > 0 ? userAccess.join(', ') : 'ไม่มีสิทธิ์เลย';
  let tooltip = document.getElementById('drag-access-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'drag-access-tooltip';
    tooltip.className = 'fixed z-[9999] pointer-events-none bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xl border border-indigo-500 opacity-95';
    document.body.appendChild(tooltip);
  }
  tooltip.innerHTML = `<div class="text-indigo-300 text-[10px] mb-1">สิทธิ์ของ ${username}:</div><div class="text-green-400 text-sm">${accessText}</div>`;
  tooltip.style.display = 'block';
  document.querySelectorAll('.duty-site-card').forEach((card => {
    const _h4 = card.querySelector('h4');
    if (!_h4) return;
    const teamName = _h4.innerText.trim();
    if (userAccess.includes(teamName)) card.classList.add('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]'); else card.classList.add('opacity-40', 'grayscale');
  }));
  document.querySelectorAll('.ov-row[data-team]').forEach((r => r.classList.add(userAccess.includes(r.dataset.team) ? 'can' : 'cant')));
};

window.handleDragOver = function(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

window.handleDrop = async function(event, toTeam) {
  event.preventDefault();
  if (window.blockIfPreview()) {
    draggedUser = null;
    return;
  }
  if (!draggedUser) return;
  const {id: id, username: username, fromTeam: fromTeam} = draggedUser;
  document.querySelectorAll('.duty-user-card').forEach((el => el.classList.remove('opacity-50', 'scale-95')));
  cleanupDragEffects();
  if (fromTeam === toTeam) {
    draggedUser = null;
    return;
  }
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const odqlMove = fromTeam === '__odql__';
  const toLeave = toTeam === 'leaveList' || event.target && event.target.closest && event.target.closest('#dutyLeaveList');
  if (odqlMove && !toLeave) {
    draggedUser = null;
    return;
  }
  if (toLeave) {
    const {value: leaveReason} = await Swal.fire({
      title: '<div class="text-red-500 font-black">ระบุสถานะการหยุด</div>',
      html: `\n                <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4">\n                    พนักงาน: <span class="text-xl text-slate-800 dark:text-white uppercase tracking-wider">${username}</span>\n                </div>\n                <select id="leaveReasonSelect" class="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-inner cursor-pointer appearance-none transition">\n                    <option value="" disabled selected>-- เลือกสาเหตุการหยุด --</option>\n                    <option value="X">❌ วันหยุดปกติ (X)</option>\n                    <option value="KL">📝 ลากิจ (KL)</option>\n                    <option value="PN">🏖️ พักร้อน (PN)</option>\n                    <option value="XX">⏳ เปลี่ยนกะ / รอเข้ากะ (XX)</option>\n                    <option value="TL">🔄 สลับวันหยุด (TL / TX)</option>\n                    <option value="X4">⏱️ ลาครึ่งวัน (X4)</option>\n                    <option value="ขาดงาน">🚫 ขาดงาน (ไม่แจ้งล่วงหน้า)</option>\n                </select>\n            `,
      showCancelButton: true,
      confirmButtonText: 'บันทึกสถานะ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-white rounded-3xl shadow-2xl border border-slate-700'
      },
      preConfirm: () => {
        const val = document.getElementById('leaveReasonSelect').value;
        if (!val) {
          Swal.showValidationMessage('กรุณาเลือกสาเหตุด้วยครับ!');
          return false;
        }
        return val;
      }
    });
    if (!leaveReason) {
      draggedUser = null;
      return;
    }
    Swal.fire({
      title: 'กำลังย้ายข้อมูล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      let odqlWebsOut = [];
      if (odqlMove) {
        if (typeof window.odqlPending === 'function' && window.odqlPending()) await window.odqlFlush();
        const rows = [];
        Object.keys(currentRosterData || {}).forEach((t => {
          const before = (currentRosterData[t] || []).length;
          currentRosterData[t] = (currentRosterData[t] || []).filter((u => !u || String(u.id) !== String(id)));
          if (currentRosterData[t].length < before) odqlWebsOut.push(t);
        }));
        rows.push({
          key: getDutySaveKey(targetDate, shiftFilter),
          value: JSON.stringify(currentRosterData || {})
        });
        const sups = window._odqlSups || {};
        if (sups[String(id)]) {
          odqlWebsOut.push(...sups[String(id)].map((w => w + ' (S)')));
          delete sups[String(id)];
        }
        rows.push({
          key: window.odqlSupKey(),
          value: JSON.stringify(sups)
        });
        const assigns = window.currentImportantAssigns || {};
        let taskOut = false;
        Object.keys(assigns).forEach((t => {
          const tm = window.impNormTeam ? window.impNormTeam(assigns[t]) : null;
          if (!tm) return;
          const nt = {
            main: tm.main.filter((n => n !== username)),
            support: tm.support.filter((n => n !== username))
          };
          if (nt.main.length !== tm.main.length || nt.support.length !== tm.support.length) {
            taskOut = true;
            odqlWebsOut.push('งาน: ' + t);
            const norm = window.impNormTeam(nt);
            if (norm) assigns[t] = norm; else delete assigns[t];
          }
        }));
        if (taskOut) rows.push({
          key: `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`,
          value: JSON.stringify(assigns)
        });
        window.clearSettingCache();
        window.dutyDbOk(await appDB.from('settings').upsert(rows));
      } else if (currentRosterData[fromTeam]) {
        currentRosterData[fromTeam] = currentRosterData[fromTeam].filter((u => String(u.id) !== String(id)));
        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(currentRosterData);
        window.clearSettingCache();
        window.dutyDbOk(await appDB.from('settings').upsert([ {
          key: saveKey,
          value: JSON.stringify(currentRosterData)
        } ]));
      }
      const {error: oldErr} = await appDB.from('leave_requests').delete().eq('user_id', id).eq('leave_date', targetDate);
      if (oldErr) throw oldErr;
      const {error: leaveErr} = await appDB.from('leave_requests').insert([ {
        user_id: id,
        user_name: username,
        leave_date: targetDate,
        reason: leaveReason,
        status: 'approved'
      } ]);
      if (leaveErr) throw leaveErr;
      await appDB.from('system_logs').insert([ {
        action_type: 'ย้ายหน้าที่',
        performed_by: currentUser.username,
        target_details: odqlMove ? `ย้ายผู้สอน OD ${username} ไปอยู่โซนลาหยุด (${leaveReason}) ${shiftFilter} วันที่: ${targetDate}${odqlWebsOut.length ? ' — เอาออกจาก ' + odqlWebsOut.join(', ') : ''}` : `ย้าย ${username} จากเว็บ ${fromTeam} ไปอยู่โซนลาหยุด (${leaveReason}) วันที่: ${targetDate}`
      } ]);
      window.debouncedBroadcast('duty-updates', 'force_reload');
      await window.refreshDutyData();
      Swal.fire({
        icon: 'success',
        title: 'อัปเดตสถานะสำเร็จ!',
        html: odqlMove ? `<b>${window.escapeHtml(username)}</b> → ลาหยุด (<b>${window.escapeHtml(leaveReason)}</b>)` + (odqlWebsOut.length ? `<br><span style="font-size:12px;opacity:.8">เอาออกจาก ${window.escapeHtml(odqlWebsOut.join(', '))}</span>` : '') : `<b>${window.escapeHtml(username)}</b> ออกจากเว็บ <b>${window.escapeHtml(fromTeam)}</b> → ลาหยุด (<b>${window.escapeHtml(leaveReason)}</b>)`,
        timer: 2600,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
      if (typeof window.refreshDutyData === 'function') window.refreshDutyData();
    }
    draggedUser = null;
    return;
  }
  const userAccess = dutyAccessMatrix[id] || [];
  if (!userAccess.includes(toTeam)) {
    Swal.fire({
      icon: 'error',
      title: 'ย้ายไม่ได้!',
      text: `ไม่อนุญาต! ${username} ไม่มีสิทธิ์หลังบ้านเว็บ ${toTeam} นะคะ`,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#d33'
    });
    draggedUser = null;
    return;
  }
  const originalUserInFromTeam = currentRosterData[fromTeam].find((u => String(u.id) === String(id)));
  const originalAssignedBy = originalUserInFromTeam?.assigned_by || 'ไม่ทราบ';
  currentRosterData[fromTeam] = currentRosterData[fromTeam].filter((u => String(u.id) !== String(id)));
  if (typeof window.dutyRemoveFromOtherTeams === "function") window.dutyRemoveFromOtherTeams(currentRosterData, id, toTeam);
  const fullUserObj = GLOBAL_USER_LIST.find((u => String(u.id) === String(id)));
  if (fullUserObj) {
    if (!currentRosterData[toTeam]) currentRosterData[toTeam] = [];
    currentRosterData[toTeam].push({
      ...fullUserObj,
      assigned_by: currentUser.username,
      assigned_at: (new Date).toISOString()
    });
  }
  const saveKey = getDutySaveKey(targetDate, shiftFilter);
  Swal.fire({
    title: 'กำลังอัปเดตตาราง...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(currentRosterData);
    window.clearSettingCache();
    const {error: _upsertErr} = window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: saveKey,
      value: JSON.stringify(currentRosterData)
    } ]));
    if (_upsertErr) throw _upsertErr;
    let pinMovedNote = '';
    const movedPin = window.getLiveStayPin(id, targetDate);
    if (movedPin && movedPin.team !== toTeam) {
      const oldTeam = movedPin.team;
      movedPin.team = toTeam;
      window.dutyStayPins[String(id)] = movedPin;
      try {
        await window.saveStayPins();
        pinMovedNote = `<div style="margin-top:8px;font-size:11.5px;color:#b45309">📌 ย้ายการล็อก "อยู่ต่อ" จาก <b>${oldTeam}</b> ไป <b>${toTeam}</b> ให้แล้ว (ถึง ${window.dutyFmtShortDate(movedPin.until)})</div>`;
      } catch (pinErr) {
        console.warn('[stayPin] move failed', pinErr);
      }
    }
    await appDB.from('system_logs').insert([ {
      action_type: 'ย้ายหน้าที่',
      performed_by: currentUser.username,
      target_details: `ย้าย ${username} จากเว็บ [${fromTeam}] (จัดโดย ${originalAssignedBy}) → [${toTeam}] (กะ: ${shiftFilter}, วันที่: ${targetDate})`
    } ]);
    window.renderRosterGrid(currentRosterData);
    if (typeof window.updateDutyStats === 'function') window.updateDutyStats();
    window.debouncedBroadcast('duty-updates', 'force_reload');
    const _chip = t => {
      const c = TEAM_COLORS[t] || TEAM_COLORS['DEFAULT'];
      return `<span class="${c.bg} ${c.text}" style="display:inline-block;padding:3px 12px;border-radius:8px;font-weight:900;font-size:15px">${t}</span>`;
    };
    const undo = await Swal.fire({
      icon: 'success',
      title: 'ย้ายสำเร็จ',
      html: `<div style="font-size:15px;line-height:2"><b style="font-size:17px">${window.escapeHtml(username)}</b><br>${_chip(fromTeam)} <span style="margin:0 6px;opacity:.6">→</span> ${_chip(toTeam)}</div>${pinMovedNote}\n                   <div style="margin-top:8px;font-size:12px;opacity:.7">วางผิดเว็บ? กด "ย้ายกลับ" ได้ภายใน 6 วินาที</div>`,
      showConfirmButton: true,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#10b981',
      showDenyButton: true,
      denyButtonText: `↩ ย้ายกลับ ${fromTeam}`,
      denyButtonColor: '#64748b',
      timer: 6e3,
      timerProgressBar: true,
      didOpen: () => {
        try {
          Swal.hideLoading();
        } catch (e) {}
      }
    });
    if (undo.isDenied) {
      draggedUser = {
        id: id,
        username: username,
        fromTeam: toTeam
      };
      await window.handleDrop({
        preventDefault() {},
        target: document.body
      }, fromTeam);
      return;
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    window.refreshDutyData();
  }
  draggedUser = null;
};

document.addEventListener('dragend', (e => {
  if (e.target.classList && e.target.classList.contains('duty-user-card')) e.target.classList.remove('opacity-50', 'scale-95');
  cleanupDragEffects();
  draggedUser = null;
}));

window.openTrainerReportModal = async function(team) {
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
  const baseDept = currentDutyDept.replace('TRAINER_', '').replace('QL', '');
  const rosterKey = `duty_roster_${baseDept}_${targetDate}_${shiftFilter}`;
  let currentReports = {};
  let rosterData = {};
  Swal.fire({
    title: 'กำลังดึงข้อมูลตารางงาน...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const {data: data} = await appDB.from('settings').select('*').in('key', [ reportKey, rosterKey ]);
    if (data) {
      const reportRow = data.find((d => d.key === reportKey));
      if (reportRow && reportRow.value) currentReports = JSON.parse(reportRow.value);
      const rosterRow = data.find((d => d.key === rosterKey));
      if (rosterRow && rosterRow.value) rosterData = JSON.parse(rosterRow.value);
    }
  } catch (e) {}
  Swal.close();
  const tr = currentReports[team] || {
    missed: 0,
    checker: currentUser.username,
    score: '',
    bad_behavior: '',
    mistakes: []
  };
  window._currentAssignedStaff = rosterData[team] ? rosterData[team].filter((u => !u.username.includes('ขาดคน'))) : [];
  const datalistOptions = GLOBAL_USER_LIST.map((u => `<option value="${window.escapeHtml(u.username)}">`)).join('');
  const htmlForm = `\n        <div class="text-left space-y-4">\n            <datalist id="employee_list_modal">${datalistOptions}</datalist>\n            <div class="bg-blue-50 dark:bg-slate-700 p-3 rounded-lg border border-blue-200 dark:border-slate-600">\n                <label class="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">👮 ผู้เช็คชื่อ (ล็อกชื่ออัตโนมัติ)</label>\n                <input type="text" id="trChecker" value="${window.escapeHtml(tr.checker || currentUser.username)}" class="w-full p-2 border rounded bg-gray-200 dark:bg-slate-900 dark:text-gray-400 outline-none font-bold text-sm cursor-not-allowed border-gray-300" readonly>\n            </div>\n            <div class="grid grid-cols-2 gap-3">\n                <div>\n                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">🚨 แชทหลุด (จำนวน)</label>\n                    <input type="number" id="trMissed" value="${tr.missed}" min="0" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-red-400 font-bold text-center text-lg text-red-600">\n                </div>\n                <div>\n                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">⭐ คะแนนการตอบแชท</label>\n                    <select id="trScore" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-amber-400 font-bold text-center text-lg">\n                        <option value="">- เลือก -</option>\n                        ${[ 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ].map((s => `<option value="${s}" ${String(tr.score) === String(s) ? 'selected' : ''}>${s} / 10</option>`)).join('')}\n                    </select>\n                </div>\n            </div>\n            <div class="border border-red-200 dark:border-red-900 rounded p-3 bg-red-50/50 dark:bg-red-900/20">\n                <label class="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><span class="material-icons text-sm">warning</span> บันทึกพฤติกรรมไม่เหมาะสม / ทำผิด</label>\n                <div id="mistakes_container" class="space-y-3"></div>\n                <button type="button" onclick="addMistakeRow()" class="mt-2 w-full text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded shadow transition font-bold border border-red-700">+ เพิ่มพนักงานนอกทีม (พิมพ์ชื่อเอง)</button>\n            </div>\n        </div>\n    `;
  const {isConfirmed: isConfirmed, value: parsedData} = await Swal.fire({
    title: `การทำงานเว็บ ${team}`,
    html: htmlForm,
    showCancelButton: true,
    confirmButtonText: 'บันทึกข้อมูล',
    confirmButtonColor: '#f59e0b',
    cancelButtonText: 'ยกเลิก',
    width: '600px',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white'
    },
    didOpen: () => {
      const mistakesContainer = document.querySelector('.swal2-container #mistakes_container');
      if (mistakesContainer) {
        mistakesContainer.innerHTML = '';
        if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
          window._currentAssignedStaff.forEach((u => {
            const oldMistake = tr.mistakes.find((m => m.empName === u.username));
            if (oldMistake) window.addMistakeRow(oldMistake.empName, oldMistake.note, oldMistake.images); else window.addMistakeRow(u.username, '', []);
          }));
          tr.mistakes.forEach((m => {
            if (!window._currentAssignedStaff.find((u => u.username === m.empName))) window.addMistakeRow(m.empName, m.note, m.images);
          }));
        } else if (tr.mistakes && tr.mistakes.length > 0) {
          tr.mistakes.forEach((m => window.addMistakeRow(m.empName, m.note, m.images)));
        }
      }
    },
    preConfirm: () => {
      const checkerVal = document.querySelector('.swal2-container #trChecker').value;
      const missedVal = parseInt(document.querySelector('.swal2-container #trMissed').value) || 0;
      const scoreVal = document.querySelector('.swal2-container #trScore').value;
      let mistakes = [];
      document.querySelectorAll('.swal2-container .mistake-row').forEach((row => {
        const selectVal = row.querySelector('.mistake-emp-select').value;
        const manualVal = row.querySelector('.mistake-emp-manual').value.trim();
        let empName = selectVal === 'อื่นๆ' ? manualVal : selectVal;
        let note = row.querySelector('.mistake-note').value.trim();
        let images = [];
        row.querySelectorAll('.pasted-img').forEach((img => {
          images.push(img.src);
        }));
        if (empName && (note !== '' || images.length > 0)) mistakes.push({
          empName: empName,
          note: note,
          images: images
        });
      }));
      return {
        checkerVal: checkerVal,
        missedVal: missedVal,
        scoreVal: scoreVal,
        mistakes: mistakes
      };
    }
  });
  if (isConfirmed && parsedData) {
    currentReports[team] = {
      checker: parsedData.checkerVal || currentUser.username,
      missed: parsedData.missedVal,
      score: parsedData.scoreVal || '-',
      bad_behavior: '-',
      mistakes: parsedData.mistakes,
      updatedBy: currentUser.username,
      updatedAt: (new Date).toISOString()
    };
    Swal.fire({
      title: 'กำลังบันทึก...',
      didOpen: () => Swal.showLoading()
    });
    appDB.from('settings').upsert([ {
      key: reportKey,
      value: JSON.stringify(currentReports)
    } ]).then((({error: error}) => {
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          timer: 1e3,
          showConfirmButton: false
        });
        window.refreshDutyData();
        window.debouncedBroadcast('duty-updates', 'force_reload');
        if (typeof window.broadcastTrainerReportChange === 'function') {
          window.broadcastTrainerReportChange(reportKey);
        }
      }
    }));
  }
};

window.addMistakeRow = function(empName = '', note = '', images = []) {
  const container = document.querySelector('.swal2-container #mistakes_container');
  if (!container) return;
  const rowId = 'mistake_' + Date.now() + Math.floor(Math.random() * 1e3);
  let imagesHtml = '';
  if (images && images.length > 0) {
    images.forEach((src => {
      imagesHtml += `<div class="relative inline-block" title="คลิกสองครั้งเพื่อลบ"><img src="${src}" class="h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition" ondblclick="this.parentElement.remove()" onclick="window.open('${src}','_blank')"></div>`;
    }));
  }
  let staffOptionsHTML = '<option value="">-- เลือกพนักงานในทีม --</option>';
  let isOtherName = true;
  if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
    window._currentAssignedStaff.forEach((u => {
      const isSelected = empName === u.username ? 'selected' : '';
      if (isSelected) isOtherName = false;
      staffOptionsHTML += `<option value="${window.escapeHtml(u.username)}" ${isSelected}>${window.escapeHtml(u.username)}</option>`;
    }));
  }
  if (!empName) isOtherName = false;
  staffOptionsHTML += `<option value="อื่นๆ" ${isOtherName ? 'selected' : ''}>-- คนอื่นๆ (พิมพ์ชื่อเอง) --</option>`;
  const html = `\n        <div id="${rowId}" class="mistake-row border border-red-200 dark:border-red-800 p-3 rounded bg-white dark:bg-slate-800 relative shadow-sm">\n            <button type="button" onclick="document.getElementById('${rowId}').remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded transition">❌ ลบกล่องนี้</button>\n            <div class="mb-2 pr-16">\n                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">ชื่อพนักงาน:</label>\n                <select class="mistake-emp-select w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500 font-bold text-blue-600" onchange="this.nextElementSibling.style.display = this.value === 'อื่นๆ' ? 'block' : 'none'">${staffOptionsHTML}</select>\n                <input type="text" list="employee_list_modal" class="mistake-emp-manual w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-1 outline-none focus:border-red-500" placeholder="พิมพ์ชื่อพนักงาน..." value="${isOtherName ? empName : ''}" style="display: ${isOtherName ? 'block' : 'none'}">\n            </div>\n            <div class="mb-2">\n                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">รายละเอียดความผิด:</label>\n                <textarea class="mistake-note w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500" rows="1" placeholder="พิมพ์ความผิด (ถ้าไม่มี ปล่อยว่างได้)"></textarea>\n            </div>\n            <div>\n                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1"><span class="material-icons text-[12px]">image</span> วางรูปลงกล่องด้านล่าง (Ctrl+V / วาง URL ก็ได้):</label>\n                <div class="paste-image-area w-full min-h-[50px] border-2 border-dashed border-gray-300 dark:border-slate-600 rounded mt-0.5 p-2 text-center text-gray-400 text-xs focus:border-red-500 outline-none flex flex-wrap gap-2 items-center justify-center dark:bg-slate-900 transition cursor-text" contenteditable="true" oninput="handleUrlPaste(event, this)">\n                    ${imagesHtml || 'คลิกที่นี่แล้วกด Ctrl+V เพื่อวางรูปภาพ'}\n                </div>\n            </div>\n        </div>\n    `;
  container.insertAdjacentHTML('beforeend', html);
  setTimeout((() => {
    document.getElementById(rowId).querySelector('.mistake-note').value = note;
  }), 10);
};

window.handleUrlPaste = function(e, div) {
  const text = div.innerText.trim();
  if (text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png)$/) || text.includes('imgur') || text.includes('googleusercontent'))) {
    e.preventDefault();
    div.innerHTML = '';
    let wrapper = document.createElement("div");
    wrapper.className = "relative inline-block";
    wrapper.title = "คลิกสองครั้งเพื่อลบ";
    let img = document.createElement("img");
    img.src = text;
    img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
    img.ondblclick = function() {
      wrapper.remove();
    };
    wrapper.appendChild(img);
    div.appendChild(wrapper);
  } else if (text !== '' && !text.includes('คลิกที่นี่')) {
    setTimeout((() => div.innerHTML = div.innerHTML.replace(text, '')), 10);
  }
};

document.addEventListener('paste', (function(e) {
  let target = e.target;
  while (target && target.nodeName !== 'BODY') {
    if (target.classList && target.classList.contains('paste-image-area')) break;
    target = target.parentNode;
  }
  if (target && target.classList && target.classList.contains('paste-image-area')) {
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      let item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        let blob = item.getAsFile();
        let reader = new FileReader;
        reader.onload = function(event) {
          if (target.innerHTML.includes("คลิกที่นี่แล้วกด Ctrl+V")) target.innerHTML = '';
          let wrapper = document.createElement("div");
          wrapper.className = "relative inline-block";
          wrapper.title = "คลิกสองครั้งเพื่อลบ";
          let img = document.createElement("img");
          img.src = event.target.result;
          img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
          img.ondblclick = function() {
            wrapper.remove();
          };
          wrapper.appendChild(img);
          target.appendChild(wrapper);
        };
        reader.readAsDataURL(blob);
      }
    }
  }
}));

window.filterDutyLogs = function() {
  const q = String((document.getElementById('dutyLogSearch') || {}).value || '').trim().toLowerCase();
  const day = (document.getElementById('dutyLogDay') || {}).value || '';
  const type = (document.getElementById('dutyLogType') || {}).value || '';
  let hit = 0;
  document.querySelectorAll('.duty-log-card').forEach((card => {
    const okQ = !q || (card.dataset.search || '').includes(q);
    const okD = !day || card.dataset.day === day;
    const okT = !type || card.dataset.type === type;
    const show = okQ && okD && okT;
    card.style.display = show ? '' : 'none';
    if (show) hit++;
  }));
  const noHit = document.getElementById('dutyLogNoHit');
  if (noHit) noHit.classList.toggle('hidden', hit > 0);
};

window.openDutyHistoryModal = async function() {
  Swal.fire({
    title: 'กำลังโหลดประวัติ...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const {data: data, error: error} = await appDB.from('system_logs').select('*').in('action_type', [ 'จัดหน้าที่', 'สุ่มจัดหน้าที่', 'แจกงานรอง', 'ล้างงานรอง', 'ล้างตารางงาน', 'ประเมินงานผู้สอน', 'ย้ายหน้าที่', 'กู้คืนตารางงาน', 'รวมห้อง Discord', 'จัดซัพพอร์ต', 'ล็อกอยู่ต่อ' ]).order('created_at', {
      ascending: false
    }).limit(50);
    if (error) throw error;
    let rows = '';
    if (!data || data.length === 0) {
      rows = `<div class="text-center p-10 text-gray-400 font-bold">ยังไม่มีประวัติการทำรายการ</div>`;
    } else {
      const actionIcon = {
        'จัดหน้าที่': 'assignment_turned_in',
        'สุ่มจัดหน้าที่': 'casino',
        'แจกงานรอง': 'call_split',
        'ล้างงานรอง': 'backspace',
        'ล้างตารางงาน': 'delete_sweep',
        'ประเมินงานผู้สอน': 'grade',
        'ย้ายหน้าที่': 'swap_horiz',
        'กู้คืนตารางงาน': 'restore',
        'รวมห้อง Discord': 'forum',
        'จัดซัพพอร์ต': 'support_agent',
        'ล็อกอยู่ต่อ': 'lock_clock'
      };
      data.forEach((log => {
        const time = new Date(log.created_at).toLocaleString('th-TH', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        let badgeColor = 'text-blue-600 bg-blue-100 border-blue-200';
        if (log.action_type === 'ล้างตารางงาน') badgeColor = 'text-red-600 bg-red-100 border-red-200';
        if (log.action_type === 'ประเมินงานผู้สอน') badgeColor = 'text-amber-600 bg-amber-100 border-amber-200';
        if (log.action_type === 'ย้ายหน้าที่') badgeColor = 'text-purple-600 bg-purple-100 border-purple-200';
        if (log.action_type === 'สุ่มจัดหน้าที่') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
        if (log.action_type === 'แจกงานรอง') badgeColor = 'text-cyan-600 bg-cyan-100 border-cyan-200';
        if (log.action_type === 'ล้างงานรอง') badgeColor = 'text-sky-700 bg-sky-100 border-sky-300';
        if (log.action_type === 'กู้คืนตารางงาน') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
        if (log.action_type === 'รวมห้อง Discord') badgeColor = 'text-violet-600 bg-violet-100 border-violet-200';
        if (log.action_type === 'จัดซัพพอร์ต') badgeColor = 'text-teal-700 bg-teal-100 border-teal-300';
        if (log.action_type === 'ล็อกอยู่ต่อ') badgeColor = 'text-amber-700 bg-amber-100 border-amber-300';
        const icon = actionIcon[log.action_type] || 'history';
        const initial = (log.performed_by || '?').charAt(0).toUpperCase();
        const prettyDetails = (log.target_details || '').replace(/\[([^\]]+)\]/g, '<b style="color:light-dark(#91751c,#c9a227);font-weight:800">$1</b>').replace(/→/g, '<span style="color:light-dark(#0917a4,#818cf8);font-weight:800;margin:0 3px">→</span>');
        const searchBlob = `${log.performed_by || ''} ${log.target_details || ''} ${log.action_type || ''}`.toLowerCase();
        const logDay = String(log.created_at || '').slice(0, 10);
        const logType = String(log.action_type || 'อื่นๆ');
        rows += `\n                    <div class="rounded-xl p-3 transition duty-log-card" data-search="${searchBlob.replace(/"/g, '&quot;')}" data-day="${logDay}" data-type="${logType.replace(/"/g, '&quot;')}" style="background:var(--k-card);border:1px solid var(--k-line2)">\n                        <div class="flex items-center justify-between mb-2">\n                            <span class="${badgeColor} inline-flex items-center gap-1 px-2 py-0.5 rounded-md border shadow-sm font-bold text-[10.5px]">\n                                <span class="material-icons" style="font-size:12px">${icon}</span>${log.action_type}\n                            </span>\n                            <span class="font-mono whitespace-nowrap" style="font-size:10.5px;color:var(--k-tx3)">${time}</span>\n                        </div>\n                        <div class="flex items-start gap-2.5">\n                            <div class="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0" style="background:#312e81;color:#c7d2fe">${initial}</div>\n                            <div class="min-w-0 flex-1">\n                                <div class="font-bold text-sm" style="color:var(--k-tx)">${log.performed_by}</div>\n                                <div class="leading-relaxed mt-0.5" style="font-size:12.5px;color:var(--k-tx2)">${prettyDetails}</div>\n                            </div>\n                        </div>\n                    </div>\n                `;
      }));
    }
    const _logs = data || [];
    const _days = [ ...new Set(_logs.map((l => String(l.created_at || '').slice(0, 10))).filter(Boolean)) ].sort().reverse();
    const _types = [ ...new Set(_logs.map((l => String(l.action_type || 'อื่นๆ'))).filter(Boolean)) ].sort();
    const _thDay = d => {
      try {
        const [y, m, dd] = d.split('-');
        return `${+dd}/${+m}/${+y + 543}`;
      } catch (e) {
        return d;
      }
    };
    const _dayOpts = _days.map((d => `<option value="${d}">${_thDay(d)}</option>`)).join('');
    const _typeOpts = _types.map((t => `<option value="${t}">${t}</option>`)).join('');
    const htmlContent = `\n            <div class="text-left overflow-hidden rounded-lg">\n                <div style="display:flex;gap:6px;margin:2px 4px 8px">\n                    <select id="dutyLogDay" onchange="filterDutyLogs()" style="flex:1;background:var(--k-panel2);border:1px solid var(--k-line2);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--k-tx);outline:none;cursor:pointer">\n                        <option value="">📅 ทุกวัน</option>${_dayOpts}\n                    </select>\n                    <select id="dutyLogType" onchange="filterDutyLogs()" style="flex:1;background:var(--k-panel2);border:1px solid var(--k-line2);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--k-tx);outline:none;cursor:pointer">\n                        <option value="">🏷️ ทุกหัวข้อ</option>${_typeOpts}\n                    </select>\n                </div>\n                <div style="position:relative;margin:2px 4px 10px">\n                    <span class="material-icons" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--k-tx3);pointer-events:none">search</span>\n                    <input type="text" id="dutyLogSearch" placeholder="พิมพ์ชื่อ (ตัวเอง/ใครก็ได้) เพื่อกรอง... เช่น ALIEN"\n                        oninput="filterDutyLogs()"\n                        style="width:100%;background:var(--k-panel2);border:1px solid var(--k-line2);border-radius:11px;padding:9px 12px 9px 36px;font-size:13px;font-weight:700;color:var(--k-tx);outline:none"\n                        onfocus="this.style.borderColor='#818cf8'" onblur="this.style.borderColor='#334155'">\n                </div>\n                <div id="dutyLogList" class="max-h-[56vh] overflow-y-auto custom-scrollbar space-y-2 p-1">${rows}</div>\n                <div id="dutyLogNoHit" class="hidden text-center p-6 font-bold" style="color:var(--k-tx3);font-size:12.5px">ไม่พบรายการที่เกี่ยวกับชื่อนี้ใน 50 รายการล่าสุด</div>\n            </div>\n        `;
    Swal.fire({
      title: '<div class="flex items-center justify-center gap-2"><span class="material-icons text-indigo-500">history</span> ประวัติระบบจัดหน้าที่</div>',
      html: htmlContent,
      width: '750px',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-white'
      }
    });
  } catch (e) {
    Swal.fire('Error', 'ไม่สามารถโหลดประวัติได้: ' + e.message, 'error');
  }
};

window.renderDutyAccessTable = function() {
  const head = document.getElementById('dutyAccessHead');
  const body = document.getElementById('dutyAccessBody');
  if (!head || !body) return;
  let staff = GLOBAL_USER_LIST.filter((u => {
    let uDept = u.department || 'AM';
    if (uDept === 'TRAINER') uDept = 'AMQL';
    return uDept === currentDutyDept;
  }));
  const shiftFilter = document.getElementById('settingShiftFilter') ? document.getElementById('settingShiftFilter').value : 'all';
  const searchFilter = document.getElementById('settingSearchInput') ? document.getElementById('settingSearchInput').value.toLowerCase() : '';
  if (shiftFilter !== 'all') staff = staff.filter((u => u.allowed_shift === shiftFilter));
  if (searchFilter) staff = staff.filter((u => u.username.toLowerCase().includes(searchFilter)));
  staff.sort(((a, b) => a.username.localeCompare(b.username)));
  window._dutyAccessVisible = staff.map((u => String(u.id)));
  const countEl = document.getElementById('dutyStaffCount');
  if (countEl) countEl.innerText = `${staff.length} คน`;
  const has = (uid, team) => (dutyAccessMatrix[uid] || []).includes(team);
  const nVisible = staff.length;
  let allOn = 0;
  staff.forEach((u => sortedTeams.forEach((t => {
    if (has(String(u.id), t)) allOn++;
  }))));
  const allTotal = nVisible * sortedTeams.length;
  let headHtml = `<tr><th class="ds-namecol"><div class="ds-name">\n            <span style="font-size:12px;font-weight:800;color:var(--k-mute)">ชื่อพนักงาน</span>\n            <label class="ds-rowctl" title="ติก/เอาออก ทุกช่องของทุกคนที่แสดงอยู่" style="cursor:pointer">\n                <span class="ds-rowcnt">ทั้งหมด</span>\n                <input type="checkbox" class="ds-ck" data-tri="${allTotal && allOn === allTotal ? 'all' : allOn ? 'some' : 'none'}" onchange="dutyAccessSetAll(this.checked)" ${nVisible ? '' : 'disabled'}>\n            </label>\n        </div></th>`;
  sortedTeams.forEach((team => {
    const c = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
    const on = staff.filter((u => has(String(u.id), team))).length;
    const tri = nVisible && on === nVisible ? 'all' : on ? 'some' : 'none';
    headHtml += `<th><div class="ds-th">\n            <span class="ds-team ${c.bg} ${c.text}" title="${team}">${team}</span>\n            <input type="checkbox" class="ds-ck sm" data-tri="${tri}" title="ติก/เอาออก ${team} ให้ทุกคนที่แสดงอยู่" onchange="dutyAccessSetCol('${team}', this.checked)" ${nVisible ? '' : 'disabled'}>\n            <span class="ds-colnum">${on}/${nVisible}</span>\n        </div></th>`;
  }));
  head.innerHTML = headHtml + `</tr>`;
  let bodyHtml = '';
  staff.forEach((u => {
    const uid = String(u.id);
    const shift = String(u.allowed_shift || '');
    const sc = shift === 'กะเช้า' ? 'm' : shift === 'กะกลาง' ? 'd' : 'n';
    const on = sortedTeams.filter((t => has(uid, t))).length;
    const tri = on === sortedTeams.length ? 'all' : on ? 'some' : 'none';
    const warn = on === 0 ? `<span class="ds-warn" title="คนนี้จะถูกข้ามตอนสุ่ม เพราะไม่มีสิทธิ์เว็บไหนเลย">ไม่มีสิทธิ์</span>` : '';
    let row = `<tr class="${on === 0 ? 'noaccess' : ''}">\n            <td class="ds-namecol"><div class="ds-name">\n                <span class="ds-uname">${window.escapeHtml(u.username)}</span>\n                ${shift ? `<span class="ds-shift ${sc}">${window.escapeHtml(shift.replace('กะ', ''))}</span>` : ''}\n                ${warn}\n                <label class="ds-rowctl" title="ติก/เอาออก ทุกเว็บของ ${window.escapeHtml(u.username)}" style="cursor:pointer">\n                    <span class="ds-rowcnt ${tri === 'all' ? 'full' : ''}">${on}/${sortedTeams.length}</span>\n                    <input type="checkbox" class="ds-ck sm" data-tri="${tri}" onchange="dutyAccessSetRow('${uid}', this.checked)">\n                </label>\n            </div></td>`;
    sortedTeams.forEach((team => {
      row += `<td><input type="checkbox" class="ds-ck duty-check" aria-label="${window.escapeHtml(u.username)} ดูแล ${team}" onchange="updateLocalDutyAccess('${uid}', '${team}', this.checked); renderDutyAccessTable();" ${has(uid, team) ? 'checked' : ''}></td>`;
    }));
    bodyHtml += row + `</tr>`;
  }));
  if (staff.length === 0) bodyHtml = `<tr><td colspan="${sortedTeams.length + 1}" class="ds-empty">ไม่พบพนักงานตามตัวกรองนี้</td></tr>`;
  body.innerHTML = bodyHtml;
  document.querySelectorAll('#dutyAccessTable .ds-ck[data-tri]').forEach((cb => {
    cb.checked = cb.dataset.tri === 'all';
    cb.indeterminate = cb.dataset.tri === 'some';
  }));
  window._dutyAccessMarkDirty(window._dutyAccessDirty);
};

window.dutyAccessSetCol = function(team, on) {
  (window._dutyAccessVisible || []).forEach((uid => window.updateLocalDutyAccess(uid, team, on)));
  window.renderDutyAccessTable();
};

window.dutyAccessSetRow = function(uid, on) {
  sortedTeams.forEach((team => window.updateLocalDutyAccess(uid, team, on)));
  window.renderDutyAccessTable();
};

window.dutyAccessSetAll = function(on) {
  (window._dutyAccessVisible || []).forEach((uid => sortedTeams.forEach((team => window.updateLocalDutyAccess(uid, team, on)))));
  window.renderDutyAccessTable();
};

window._dutyAccessDirty = false;

window._dutyAccessMarkDirty = function(on) {
  window._dutyAccessDirty = !!on;
  document.getElementById('dutyAccessDirty')?.classList.toggle('on', !!on);
  document.getElementById('dutyAccessSaveBtn')?.classList.toggle('dirty', !!on);
};

window.updateLocalDutyAccess = function(uid, team, isChecked) {
  uid = String(uid);
  if (!dutyAccessMatrix[uid]) dutyAccessMatrix[uid] = [];
  if (typeof window._dutyAccessMarkDirty === 'function') window._dutyAccessMarkDirty(true);
  if (isChecked) {
    if (!dutyAccessMatrix[uid].includes(team)) dutyAccessMatrix[uid].push(team);
  } else {
    dutyAccessMatrix[uid] = dutyAccessMatrix[uid].filter((t => t !== team));
  }
};

window.saveDutyAccess = async function() {
  Swal.fire({
    title: 'กำลังบันทึกสิทธิ์...',
    didOpen: () => Swal.showLoading()
  });
  try {
    window.clearSettingCache();
    window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: 'duty_access_matrix',
      value: JSON.stringify(dutyAccessMatrix)
    } ]));
    if (typeof window._dutyAccessMarkDirty === 'function') window._dutyAccessMarkDirty(false);
    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ',
      timer: 1e3,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.renderRoleEditorList = function() {
  const team = document.getElementById('roleEditorTeam').value;
  const listDiv = document.getElementById('roleEditorList');
  if (!team || !customDutyRoles[team]) {
    listDiv.innerHTML = '';
    return;
  }
  const roles = customDutyRoles[team];
  if (roles.length === 0) {
    listDiv.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">ไม่มีหัวข้อในเว็บนี้</div>';
    return;
  }
  listDiv.innerHTML = roles.map(((r, idx) => `<div class="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-gray-200 dark:border-slate-700"><span class="text-xs font-bold text-slate-700 dark:text-gray-200">${r}</span><button onclick="removeDutyRole('${team}', ${idx})" class="text-red-400 hover:text-red-600"><span class="material-icons text-sm">close</span></button></div>`)).join('');
};

window.addDutyRole = async function() {
  const team = document.getElementById('roleEditorTeam').value;
  const input = document.getElementById('newRoleInput');
  const val = input.value.trim();
  if (!val || !team) return;
  if (!customDutyRoles[team]) customDutyRoles[team] = [];
  customDutyRoles[team].push(val);
  input.value = '';
  window.renderRoleEditorList();
  await window.saveCustomRolesToDB();
  if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
    window.renderTrainerOdMatrix(currentRosterData);
  }
};

window.removeDutyRole = async function(team, idx) {
  if (customDutyRoles[team]) {
    customDutyRoles[team].splice(idx, 1);
    window.renderRoleEditorList();
    await window.saveCustomRolesToDB();
    if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
      window.renderTrainerOdMatrix(currentRosterData);
    }
  }
};

window.saveCustomRolesToDB = async function() {
  window.clearSettingCache();
  const {error: _sErr} = await appDB.from('settings').upsert([ {
    key: 'duty_custom_roles',
    value: JSON.stringify(customDutyRoles)
  } ]);
  if (_sErr) return Swal.fire('บันทึกไม่สำเร็จ', _sErr.message, 'error');
};

function _dreqEnsureStyle() {
  if (document.getElementById('dreq-style-v2')) return;
  document.getElementById('dreq-style')?.remove();
  const s = document.createElement('style');
  s.id = 'dreq-style-v2';
  s.textContent = `\n        #dutyApp .dq{background:var(--k-panel2);border-bottom:1px solid var(--k-line);padding:12px}\n        #dutyApp .dq-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}\n        #dutyApp .dq-title{display:flex;align-items:center;gap:10px;min-width:0}\n        #dutyApp .dq-title>.material-icons{font-size:20px;color:var(--k-gold-tx);width:36px;height:36px;border-radius:10px;background:rgba(232,193,90,.12);display:flex;align-items:center;justify-content:center;flex:none}\n        #dutyApp .dq-h{font-size:14.5px;font-weight:900;color:var(--k-tx-strong)}\n        #dutyApp .dq-hint{font-size:11.5px;font-weight:600;color:var(--k-mute2)}\n        #dutyApp .dq-poolslot{margin-left:auto}\n        #dutyApp .dq-tools{display:flex;gap:8px}\n        #dutyApp .dq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}\n\n        .dreq-card{position:relative;display:flex;flex-direction:column;border-radius:9px;background:var(--k-card);border:1px solid var(--k-line);overflow:hidden;transition:border-color .25s,box-shadow .25s}\n        .dreq-card:hover{border-color:var(--k-line4)}\n        .dreq-name{display:flex;align-items:center;justify-content:center;height:20px;font-size:11px;font-weight:900;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 20px}\n        .dreq-ctrl{display:flex;align-items:center;justify-content:space-between;gap:2px;padding:5px 6px}\n        .dreq-btn{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;line-height:1;color:var(--k-tx2);background:var(--k-btn);border:1px solid var(--k-line3);cursor:pointer;transition:background .15s,color .15s,border-color .15s,transform .08s;flex:none}\n        .dreq-btn:hover{background:var(--k-btn-h);color:var(--k-tx-strong);border-color:var(--k-line4)}\n        .dreq-btn.plus:hover{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.5);color:var(--k-green-tx)}\n        .dreq-btn.minus:hover{background:rgba(251,146,60,.14);border-color:rgba(251,146,60,.5);color:var(--k-amber-tx)}\n        .dreq-btn:active{transform:scale(.92)}\n        .dreq-btn:focus-visible,.dreq-move button:focus-visible{outline:2px solid #E8C15A;outline-offset:2px}\n        .dreq-num{width:100%;min-width:0;text-align:center;font-size:17px;font-weight:900;background:transparent;color:var(--k-tx-strong);outline:none;border:0;-moz-appearance:textfield;font-variant-numeric:tabular-nums}\n        .dreq-num::-webkit-outer-spin-button,.dreq-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}\n        .dreq-num:focus{color:var(--k-gold-tx)}\n        .dreq-card.zero .dreq-num{color:var(--k-mute3)}\n        .dreq-move{position:absolute;top:0;left:0;right:0;height:20px;display:flex;justify-content:space-between;pointer-events:none}\n        .dreq-move button{pointer-events:auto;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:color-mix(in srgb,var(--k-tx-strong) 85.0%,transparent);background:color-mix(in srgb,var(--k-panel2) 28.0%,transparent);opacity:0;transition:opacity .15s,background .15s;cursor:pointer}\n        .dreq-move button .material-icons{font-size:14px}\n        .dreq-move button:hover{background:color-mix(in srgb,var(--k-panel2) 50.0%,transparent)}\n        .dreq-card:hover .dreq-move button,.dreq-move button:focus-visible{opacity:1}\n        @media (hover:none){ .dreq-move button{opacity:.9} }\n\n        .dreq-flash-up{border-color:#22c55e!important;box-shadow:0 0 14px rgba(34,197,94,.45)!important}\n        .dreq-flash-down{border-color:#fb923c!important;box-shadow:0 0 14px rgba(251,146,60,.45)!important}\n        .dreq-flash-self{border-color:#E8C15A!important;box-shadow:0 0 14px rgba(232,193,90,.45)!important}\n        .dreq-delta{position:absolute;top:22px;right:4px;z-index:5;font-size:11px;font-weight:900;padding:1px 7px;border-radius:99px;pointer-events:none;animation:dreqPop 1.3s ease forwards}\n        .dreq-delta.up{background:#16a34a;color:#fff}\n        .dreq-delta.down{background:#ea580c;color:#fff}\n        @keyframes dreqPop{0%{opacity:0;transform:translateY(6px) scale(.6)}15%{opacity:1;transform:translateY(0) scale(1.1)}30%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}\n\n        .dreq-pool{position:relative;display:flex;align-items:center;gap:12px;padding:6px 14px 6px 8px;border-radius:12px;background:var(--k-gold-bg);border:1px solid rgba(232,193,90,.45);min-width:250px}\n        .dreq-pool-ic{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(232,193,90,.14);color:var(--k-gold-tx);flex:none}\n        .dreq-pool-ic .material-icons{font-size:19px}\n        .dreq-pool-body{flex:1;min-width:0}\n        .dreq-pool-row{display:flex;align-items:baseline;gap:6px}\n        .dreq-pool-lb{font-size:12px;font-weight:800;color:var(--k-gold-tx)}\n        .dreq-pool-num{font-size:20px;font-weight:900;color:var(--k-amber-tx);font-variant-numeric:tabular-nums;line-height:1.1}\n        .dreq-pool-unit{font-size:11px;font-weight:700;color:var(--k-gold-tx)}\n        .dreq-pool-sub{margin-left:auto;font-size:11px;font-weight:700;color:var(--k-mute);white-space:nowrap;font-variant-numeric:tabular-nums}\n        .dreq-pool-bar{height:5px;border-radius:5px;background:color-mix(in srgb,var(--k-tx-strong) 8.0%,transparent);margin-top:5px;overflow:hidden}\n        .dreq-pool-bar i{display:block;height:100%;border-radius:5px;background:#E8C15A;transition:width .3s}\n        .dreq-pool.ok{background:var(--k-green-bg);border-color:rgba(34,197,94,.5)}\n        .dreq-pool.ok .dreq-pool-ic{background:rgba(34,197,94,.14);color:var(--k-green-tx)}\n        .dreq-pool.ok .dreq-pool-num,.dreq-pool.ok .dreq-pool-lb{color:var(--k-green-tx)}\n        .dreq-pool.ok .dreq-pool-bar i{background:#22c55e}\n        .dreq-pool.bad{background:var(--k-red-bg);border-color:rgba(248,113,113,.6)}\n        .dreq-pool.bad .dreq-pool-num,.dreq-pool.bad .dreq-pool-lb{color:var(--k-red-tx)}\n        .dreq-pool.bad .dreq-pool-bar i{background:#ef4444}\n        .dreq-shake{animation:dreqShake .4s ease}\n        @keyframes dreqShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}\n        @media (max-width:640px){ #dutyApp .dq-poolslot{margin-left:0;width:100%} .dreq-pool{min-width:0} #dutyApp .dq-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))} }\n        @media (prefers-reduced-motion:reduce){ .dreq-delta,.dreq-shake{animation:none} }\n    `;
  document.head.appendChild(s);
}

window.dutyReqsShared = function() {
  return currentDutyDept === 'ODQL' || currentDutyDept === 'TRAINER_OD';
};

window._dreqSaveTimer = null;

window.dutySaveReqs = function(obj) {
  window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(obj || {}));
  if (!window.dutyReqsShared()) return;
  const dept = currentDutyDept;
  const val = JSON.stringify(obj || {});
  window._dreqDirty = true;
  clearTimeout(window._dreqSaveTimer);
  window._dreqSaveTimer = setTimeout((async () => {
    try {
      window.clearSettingCache();
      const {error: error} = await appDB.from('settings').upsert([ {
        key: `duty_reqs_${dept}`,
        value: val
      } ]);
      if (error) throw error;
      window._dreqDirty = false;
      try {
        window.debouncedBroadcast('duty-updates', 'force_reload', 150);
      } catch (e) {}
    } catch (e) {
      window._dreqDirty = false;
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        showConfirmButton: false,
        timer: 3500,
        title: 'บันทึกจำนวนคนต่อเว็บไม่สำเร็จ: ' + (e && e.message || e)
      });
    }
  }), 400);
};

window.dutyLoadSharedReqs = async function() {
  if (!window.dutyReqsShared() || window._dreqDirty) return;
  const dept = currentDutyDept;
  window._dreqLoading = true;
  try {
    const {data: data, error: error} = await appDB.from('settings').select('value').eq('key', `duty_reqs_${dept}`).maybeSingle();
    if (error || dept !== currentDutyDept || window._dreqDirty) return;
    if (!data || !data.value) {
      const local = window.safeGetItem(`duty_reqs_${dept}`, '');
      let lo = {};
      try {
        lo = JSON.parse(local || '{}') || {};
      } catch (e) {}
      if (Object.values(lo).some((v => parseInt(v) > 0))) window.dutySaveReqs(lo);
      return;
    }
    let remote = {};
    try {
      remote = JSON.parse(data.value) || {};
    } catch (e) {
      return;
    }
    window.safeSetItem(`duty_reqs_${dept}`, JSON.stringify(remote));
    let changed = false;
    sortedTeams.forEach((team => {
      const el = document.getElementById(`req_${team}`);
      if (!el) return;
      const v = parseInt(remote[`req_${team}`]) || 0;
      if ((parseInt(el.value) || 0) !== v) {
        el.value = v;
        changed = true;
      }
      const card = document.getElementById(`dreqCard_${team}`);
      if (card) card.classList.toggle('zero', !v);
    }));
    if (changed) {
      if (typeof window.updateReqTotal === 'function') window.updateReqTotal();
      if (typeof window.updateDutyStats === 'function') window.updateDutyStats();
    }
  } catch (e) {} finally {
    window._dreqLoading = false;
  }
};

window.renderDutyRequirements = function() {
  const container = document.getElementById('dutyRequirements');
  if (!container) return;
  _dreqEnsureStyle();
  container.innerHTML = '';
  const savedReqs = JSON.parse(window.safeGetItem(`duty_reqs_${currentDutyDept}`, '{}') || '{}');
  if (window.dutyReqsShared() && !window._dreqLoading) window.dutyLoadSharedReqs();
  let html = '';
  sortedTeams.forEach(((team, index) => {
    const reqKey = `req_${team}`;
    const defaultVal = savedReqs[reqKey] || 0;
    const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
    html += `\n            <div class="dreq-card ${defaultVal ? '' : 'zero'}" id="dreqCard_${team}">\n                <div class="dreq-name ${colorClass.bg} ${colorClass.text}" title="${team}">${team}</div>\n                <div class="dreq-move">\n                    <button onclick="moveTeam('${team}', -1)" class="${index === 0 ? 'invisible' : ''}" title="เลื่อน ${team} ไปทางซ้าย" aria-label="เลื่อนซ้าย"><span class="material-icons">chevron_left</span></button>\n                    <button onclick="moveTeam('${team}', 1)" class="${index === sortedTeams.length - 1 ? 'invisible' : ''}" title="เลื่อน ${team} ไปทางขวา" aria-label="เลื่อนขวา"><span class="material-icons">chevron_right</span></button>\n                </div>\n                <div class="dreq-ctrl">\n                    <button class="dreq-btn minus" onclick="dutyReqStep('${team}', -1)" title="ลด 1 คน (ย้ายกลับส่วนกลาง)" aria-label="ลด ${team}">−</button>\n                    <input type="number" id="${reqKey}" onchange="window.manualAdjustReq('${team}')" class="dreq-num req-input" value="${defaultVal}" min="0" aria-label="จำนวนคน ${team}">\n                    <button class="dreq-btn plus" onclick="dutyReqStep('${team}', 1)" title="เพิ่ม 1 คน (แจกจากส่วนกลาง)" aria-label="เพิ่ม ${team}">+</button>\n                </div>\n            </div>`;
  }));
  const poolHtml = `\n        <div id="dreqTotal" class="dreq-pool" title="คนที่ยังไม่ได้แจกลงเว็บไหน — เหลือ 0 แปลว่าแจกครบพอดี">\n            <div class="dreq-pool-ic"><span class="material-icons">inventory_2</span></div>\n            <div class="dreq-pool-body">\n                <div class="dreq-pool-row">\n                    <span class="dreq-pool-lb">ส่วนกลางเหลือ</span>\n                    <span class="dreq-pool-num" id="dreqPoolNum">0</span>\n                    <span class="dreq-pool-unit">คน</span>\n                    <span class="dreq-pool-sub" id="dreqTotalText">-</span>\n                </div>\n                <div class="dreq-pool-bar"><i id="dreqPoolBar" style="width:0%"></i></div>\n            </div>\n        </div>`;
  container.innerHTML = html;
  const slot = document.getElementById('dreqPoolSlot');
  if (slot) slot.innerHTML = poolHtml; else container.insertAdjacentHTML('beforeend', poolHtml);
  window.updateReqTotal();
};

window.dutyReqStep = function(team, delta) {
  const input = document.getElementById(`req_${team}`);
  if (!input) return;
  if (delta > 0 && currentDutyDept !== 'ODQL' && window._dreqPoolCount() <= 0) {
    const pill = document.getElementById('dreqTotal');
    if (pill) {
      pill.classList.add('dreq-shake');
      setTimeout((() => pill.classList.remove('dreq-shake')), 500);
    }
    return;
  }
  input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
  window.manualAdjustReq(team, delta);
};

window._dreqPoolCount = function() {
  let total = 0;
  sortedTeams.forEach((t => {
    total += parseInt(document.getElementById(`req_${t}`)?.value) || 0;
  }));
  let avail = 0;
  try {
    avail = window.getDutyActiveStaff(document.getElementById('dutyShiftSelect').value).length;
  } catch (e) {}
  return avail - total;
};

window.updateReqTotal = function() {
  const card = document.getElementById('dreqTotal');
  const num = document.getElementById('dreqPoolNum');
  const sub = document.getElementById('dreqTotalText');
  if (!card || !num || !sub) return;
  let total = 0;
  sortedTeams.forEach((t => {
    total += parseInt(document.getElementById(`req_${t}`)?.value) || 0;
  }));
  let avail = 0;
  try {
    avail = window.getDutyActiveStaff(document.getElementById('dutyShiftSelect').value).length;
  } catch (e) {}
  const pool = avail - total;
  const lb = card.querySelector('.dreq-pool-lb');
  const unit = card.querySelector('.dreq-pool-unit');
  card.classList.remove('ok', 'bad');
  const bar = document.getElementById('dreqPoolBar');
  if (currentDutyDept === 'ODQL') {
    if (lb) lb.textContent = 'ตั้งรวม';
    if (unit) unit.textContent = 'ตำแหน่ง';
    num.textContent = total;
    sub.textContent = `ผู้สอน ${avail} คน` + (total > avail ? ' · ออกงานซ้ำได้' : '');
    card.title = 'ผู้สอน OD 1 คนรับได้หลายเว็บ ตั้งเกินจำนวนคนได้ ระบบจะวนแจกให้ครบ';
    if (total >= avail && total > 0) card.classList.add('ok');
    if (bar) bar.style.width = (avail > 0 ? Math.min(100, Math.round(total / avail * 100)) : 0) + '%';
  } else {
    if (lb) lb.textContent = 'ส่วนกลางเหลือ';
    if (unit) unit.textContent = 'คน';
    card.title = 'คนที่ยังไม่ได้แจกลงเว็บไหน — เหลือ 0 แปลว่าแจกครบพอดี';
    num.textContent = pool === 0 ? '0 ✓' : pool;
    sub.textContent = `แจกแล้ว ${total}/${avail}`;
    if (pool === 0) card.classList.add('ok'); else if (pool < 0) card.classList.add('bad');
    if (bar) bar.style.width = (avail > 0 ? Math.min(100, Math.round(total / avail * 100)) : 0) + '%';
  }
  const hint = document.querySelector('#dutyApp .dq-hint');
  if (hint) hint.textContent = currentDutyDept === 'ODQL' ? 'ผู้สอน OD กด + เพิ่มได้เกินจำนวนคน 1 คนออกงานซ้ำได้หลายเว็บ ชี้ที่การ์ดเพื่อสลับลำดับเว็บ' : 'กด − ย้ายคนกลับส่วนกลาง กด + แจกคนจากส่วนกลาง ชี้ที่การ์ดเพื่อสลับลำดับเว็บ';
  sortedTeams.forEach((t => {
    const c = document.getElementById(`dreqCard_${t}`);
    if (c) c.classList.toggle('zero', !(parseInt(document.getElementById(`req_${t}`)?.value) || 0));
  }));
};

function _dreqPoolBadge(delta) {
  const card = document.getElementById('dreqTotal');
  if (!card || !delta) return;
  const b = document.createElement('span');
  b.className = 'dreq-delta ' + (delta > 0 ? 'up' : 'down');
  b.textContent = (delta > 0 ? '+' : '') + delta;
  card.appendChild(b);
  setTimeout((() => b.remove()), 1350);
}

function _dreqFlash(team, kind, delta) {
  const card = document.getElementById(`dreqCard_${team}`);
  if (!card) return;
  const cls = kind === 'self' ? 'dreq-flash-self' : kind === 'up' ? 'dreq-flash-up' : 'dreq-flash-down';
  card.classList.add(cls);
  setTimeout((() => card.classList.remove(cls)), 1300);
  if (delta) {
    const b = document.createElement('span');
    b.className = 'dreq-delta ' + (delta > 0 ? 'up' : 'down');
    b.textContent = (delta > 0 ? '+' : '') + delta;
    card.appendChild(b);
    setTimeout((() => b.remove()), 1350);
  }
}

window.manualAdjustReq = function(changedTeam, delta) {
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const availableCount = window.getDutyActiveStaff(shiftFilter).length;
  const changedInput = document.getElementById(`req_${changedTeam}`);
  let v = parseInt(changedInput.value) || 0;
  if (v < 0) v = 0;
  let othersTotal = 0;
  sortedTeams.forEach((t => {
    if (t !== changedTeam) othersTotal += parseInt(document.getElementById(`req_${t}`)?.value) || 0;
  }));
  const maxAllowed = Math.max(0, availableCount - othersTotal);
  if (currentDutyDept !== 'ODQL' && v > maxAllowed) {
    v = maxAllowed;
    const pill = document.getElementById('dreqTotal');
    if (pill) {
      pill.classList.add('dreq-shake');
      setTimeout((() => pill.classList.remove('dreq-shake')), 500);
    }
  }
  changedInput.value = v;
  const reqsToSave = {};
  sortedTeams.forEach((team => {
    reqsToSave[`req_${team}`] = parseInt(document.getElementById(`req_${team}`)?.value) || 0;
  }));
  window.dutySaveReqs(reqsToSave);
  if (typeof _dreqFlash === 'function') {
    if (delta > 0) {
      _dreqFlash(changedTeam, 'up', +delta);
      _dreqPoolBadge(-delta);
    } else if (delta < 0) {
      _dreqFlash(changedTeam, 'down', delta);
      _dreqPoolBadge(-delta);
    } else _dreqFlash(changedTeam, 'self', 0);
  }
  if (typeof window.updateReqTotal === 'function') window.updateReqTotal();
  window.updateDutyStats();
};

window.autoSuggestRequirements = function() {
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const targetDate = document.getElementById('dutyDate').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const activeStaff = window.getDutyActiveStaff(shiftFilter);
  if (activeStaff.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีพนักงานว่างในกะนี้เลย', 'info');
  let suggestedReqs = {};
  sortedTeams.forEach((t => suggestedReqs[t] = 0));
  let pool = [ ...activeStaff ].sort((() => Math.random() - .5));
  let unassignedUsers = [];
  pool.forEach((u => {
    const access = dutyAccessMatrix[String(u.id)] || [];
    const validAccess = access.filter((t => sortedTeams.includes(t)));
    if (validAccess.length > 0) {
      let minTeam = validAccess[0];
      let minVal = suggestedReqs[minTeam];
      for (let i = 1; i < validAccess.length; i++) {
        if (suggestedReqs[validAccess[i]] < minVal) {
          minTeam = validAccess[i];
          minVal = suggestedReqs[validAccess[i]];
        }
      }
      suggestedReqs[minTeam]++;
    } else {
      unassignedUsers.push(u.username);
    }
  }));
  sortedTeams.forEach((team => {
    const input = document.getElementById(`req_${team}`);
    if (input) input.value = suggestedReqs[team];
  }));
  const reqsToSave = {};
  sortedTeams.forEach((team => reqsToSave[`req_${team}`] = suggestedReqs[team]));
  window.dutySaveReqs(reqsToSave);
  window.updateDutyStats();
  if (unassignedUsers.length > 0) {
    Swal.fire({
      icon: 'warning',
      title: 'มีคนไม่มีสิทธิ์!',
      html: `ระบบดึงคนมาคำนวณทั้งหมด ${activeStaff.length} คน<br>แต่พบพนักงาน <b>${unassignedUsers.length} คน</b> ที่ไม่มีสิทธิ์เข้าเว็บใดๆ เลย:<br><br><span class="text-red-500 font-bold">${unassignedUsers.join(', ')}</span><br><br><span class="text-[10px] text-gray-500">*ถ้าชื่อเหล่านี้เป็นคนกะอื่น ให้ไปเช็คหน้า "จัดการพนักงาน" ว่าตั้งกะเป็น "กะอิสระ" ทิ้งไว้หรือไม่ครับ</span>`
    });
  } else {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
    Toast.fire({
      icon: 'success',
      title: 'คำนวณยอดคนออโต้สำเร็จ!'
    });
  }
};

window.updateDutyStats = function() {
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const statusBar = document.getElementById('dutyStatusBar');
  if (!statusBar) return;
  const activeStaff = window.getDutyActiveStaff(shiftFilter);
  const availableCount = activeStaff.length;
  let requiredCount = 0;
  document.querySelectorAll('.req-input').forEach((input => {
    requiredCount += parseInt(input.value) || 0;
  }));
  let statusHTML = '';
  let statusClass = 'p-2 text-center text-xs font-bold transition-colors duration-300 border-b shadow-sm ';
  if (currentDutyDept === 'ODQL' && requiredCount > 0) {
    statusClass += 'bg-indigo-600 text-white border-indigo-700';
    statusHTML = `👩‍🏫 ผู้สอน OD: ตั้งรวม ${requiredCount} ตำแหน่ง · มีผู้สอน ${availableCount} คน (1 คนรับได้หลายเว็บ ระบบจะวนให้ครบ)`;
  } else if (requiredCount === 0) {
    statusClass += 'bg-gray-200 text-gray-600 border-gray-300 dark:bg-slate-800 dark:border-slate-700';
    statusHTML = `ℹ️ กรุณาใส่จำนวนคนให้แต่ละเว็บ (คนมาทำงานกะนี้: ${availableCount} คน)`;
  } else if (availableCount === requiredCount) {
    statusClass += 'bg-green-500 text-white border-green-600 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
    statusHTML = `✅ ยอดเยี่ยม! จัดคนพอดีเป๊ะ (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
  } else if (requiredCount > availableCount) {
    statusClass += 'bg-red-500 text-white border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    statusHTML = `❌ ขาดคน! คุณใส่เลขเกิน (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
  } else {
    statusClass += 'bg-amber-400 text-amber-900 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
    statusHTML = `⚠️ มีคนเหลือว่างงาน! (ว่าง: ${availableCount} คน | ต้องการแค่: ${requiredCount} คน)`;
  }
  statusBar.className = statusClass;
  statusBar.innerHTML = statusHTML;
  if (typeof window.updateReqTotal === 'function') window.updateReqTotal();
};

window.broadcastTrainerReportChange = async function(reportKey) {
  try {
    const parts = reportKey.split('_');
    if (window.isTrainerDept(parts[1])) {
      const dateStr = parts[parts.length - 2];
      const shiftStr = parts[parts.length - 1];
      await appDB.from('system_logs').insert([ {
        action_type: 'ประเมินงานผู้สอน',
        performed_by: currentUser.username,
        target_details: `ลงข้อมูลประเมินการทำงาน (กะ: ${shiftStr}, วันที่: ${dateStr})`
      } ]);
      window.debouncedBroadcast('duty-updates', 'force_reload');
    }
  } catch (e) {
    console.warn('broadcastTrainerReportChange error:', e);
  }
};

let dutySearchTimeout = null;

window.onDutySearch = function() {
  clearTimeout(dutySearchTimeout);
  dutySearchTimeout = setTimeout((() => {
    filterDutyResult();
  }), 300);
};

window.odqlWebs = function() {
  const base = [ 'Jun88', 'MK8', 'VV72', 'TH26', 'PG688', 'JL69', 'K188', 'BT678', 'NM9', 'F168' ];
  const extra = (typeof TEAM_LIST !== 'undefined' ? TEAM_LIST : []).filter((t => !base.includes(t)));
  return [ ...base, ...extra ];
};

window.odqlTaskList = function() {
  const list = Array.isArray(window.globalImportantTasks) ? window.globalImportantTasks : [];
  return list.map((t => typeof t === 'string' ? t : t && (t.name || t.title) || '')).filter(Boolean);
};

window.odqlSupKey = function() {
  const d = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
  const sh = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
  return `duty_odql_sup_${d}_${sh}`;
};

window.odqlLoadSups = async function(rosterData) {
  const key = window.odqlSupKey();
  if (window._odqlSupKey === key && window._odqlSups) return window._odqlSups;
  let sups = {};
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', key).maybeSingle();
    if (data && data.value) sups = JSON.parse(data.value) || {};
  } catch (e) {}
  Object.values(rosterData || {}).forEach((arr => (arr || []).forEach((x => {
    if (x && x.id && x.secondary_team && !sups[String(x.id)]) sups[String(x.id)] = [ x.secondary_team ];
  }))));
  window._odqlSupKey = key;
  window._odqlSups = sups;
  return sups;
};

window.odqlPrimaryOf = function(uid, rosterData) {
  for (const t in rosterData) if ((rosterData[t] || []).some((x => x && String(x.id) === String(uid)))) return t;
  return null;
};

window.odqlCellOf = function(u, web, rosterData) {
  const uid = String(u.id);
  if ((rosterData[web] || []).some((x => x && String(x.id) === uid))) return 'job';
  const sups = (window._odqlSups || {})[uid] || [];
  return sups.includes(web) ? 'sup' : 'not';
};

window.odqlTaskCellOf = function(u, task) {
  const team = window.impTeamOf ? window.impTeamOf(task) : {
    main: [],
    support: []
  };
  if (team.main.includes(u.username)) return 'job';
  if (team.support.includes(u.username)) return 'sup';
  return 'not';
};

window.renderTrainerOdMatrix = async function(rosterData) {
  const matrixGrid = document.getElementById('dutyMatrixGrid');
  if (!matrixGrid) return;
  rosterData = rosterData || {};
  await window.odqlLoadSups(rosterData);
  const canEdit = window.isDutyAdmin() && (!window.isTrainerDept() || canPerm('duty_manage_odql') || canPerm('duty_manage_amql') || canPerm('duty_manage'));
  const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
  const webs = window.odqlWebs();
  const tasks = [];
  const leaveIds = new Set((window.currentDutyLeaveData || []).map((l => String(l.user_id))));
  const inRoster = new Set;
  Object.values(rosterData).forEach((arr => (arr || []).forEach((x => x && x.id && inRoster.add(String(x.id))))));
  const trainers = (GLOBAL_USER_LIST || []).filter((u => {
    const d = String(u.department || '');
    if (!(d === 'ODQL' || d === 'TRAINER_OD')) return false;
    if (leaveIds.has(String(u.id)) && !inRoster.has(String(u.id))) return false;
    if (shiftFilter !== 'all' && !window.isDutyShiftMatch(u, shiftFilter) && !inRoster.has(String(u.id))) return false;
    return true;
  }));
  const shOrder = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  const shLabel = s => s === 'กะเช้า' ? 'เช้า' : s === 'กะกลาง' ? 'กลาง' : s === 'กะดึก' ? 'ดึก' : '-';
  trainers.sort(((a, b) => shOrder.indexOf(window.getDutyShiftForToday(a)) - shOrder.indexOf(window.getDutyShiftForToday(b)) || a.username.localeCompare(b.username)));
  const esc = window.escapeHtml;
  const cell = (val, uid, kind, key) => `<td class="oq-c ${val}${canEdit ? ' ed' : ''}" data-uid="${esc(String(uid))}" data-kind="${kind}" data-key="${esc(key)}" ${canEdit ? `onclick="odqlCycle(this)" title="กดเพื่อสลับ: Not → S → Job → Not"` : ''}><span>${val === 'job' ? '✓ Job' : val === 'sup' ? 'S' : 'Not'}</span></td>`;
  let head1 = `<th rowspan="2" class="oq-h oq-fix1">รายชื่อผู้ดูแล</th><th rowspan="2" class="oq-h oq-fix2">กะ</th>`;
  head1 += `<th colspan="${webs.length}" class="oq-h oq-grp">เว็บที่ดูแล (Job = หลัก · S = รอง)</th>`;
  if (tasks.length) head1 += `<th colspan="${tasks.length}" class="oq-h oq-grp oq-grp-t">งานประจำวัน</th>`;
  const webHex = {
    Jun88: '#2563eb',
    MK8: '#facc15',
    VV72: '#991b1b',
    TH26: '#64748b',
    PG688: '#fbbf24',
    JL69: '#475569',
    K188: '#0ea5e9',
    BT678: '#dc2626',
    NM9: '#db2777',
    F168: '#ea580c'
  };
  let head2 = webs.map((w => `<th class="oq-h oq-web" style="--wc:${webHex[w] || '#64748b'}">${esc(w)}</th>`)).join('');
  head2 += tasks.map((t => `<th class="oq-h oq-task" title="${esc(t)}">${esc(t)}</th>`)).join('');
  const rows = trainers.map((u => {
    const sh = window.getDutyShiftForToday(u);
    const onLeave = leaveIds.has(String(u.id));
    const isMe = typeof currentUser !== 'undefined' && currentUser && String(currentUser.id) === String(u.id);
    const nameAttrs = canEdit && !onLeave ? ` duty-user-card can" draggable="true" ondragstart="handleDragStart(event, '${window.escapeJsAttr(String(u.id))}', '${window.escapeJsAttr(u.username)}', '__odql__')" ondragend="if(typeof cleanupDragEffects==='function')cleanupDragEffects();this.classList.remove('opacity-50','scale-95')" onclick="odqlToLeave('${window.escapeJsAttr(String(u.id))}', '${window.escapeJsAttr(u.username)}')" title="${esc(u.username)} — กดหรือลากไปช่องลาหยุด เพื่อย้ายไปลา"` : `" title="${esc(u.username)}"`;
    let r = `<tr class="oq-r${onLeave ? ' lv' : ''}${isMe ? ' me' : ''}"><td class="oq-n oq-fix1${nameAttrs}>${esc(u.username)}${isMe ? ' <em>คุณ</em>' : ''}${onLeave ? ' <small>(ลา)</small>' : ''}</td><td class="oq-s oq-fix2 ${sh === 'กะดึก' ? 'n' : sh === 'กะกลาง' ? 'm' : 'd'}">${shLabel(sh)}</td>`;
    r += webs.map((w => cell(window.odqlCellOf(u, w, rosterData), u.id, 'web', w))).join('');
    r += tasks.map((t => cell(window.odqlTaskCellOf(u, t), u.id, 'task', t))).join('');
    return r + '</tr>';
  })).join('');
  const sumJob = webs.map((w => trainers.filter((u => window.odqlCellOf(u, w, rosterData) === 'job')).length));
  const sumSup = webs.map((w => trainers.filter((u => window.odqlCellOf(u, w, rosterData) === 'sup')).length));
  const foot = `<tr class="oq-f"><td class="oq-fix1">รวม Job / S</td><td class="oq-fix2"></td>${webs.map(((w, i) => `<td><b>${sumJob[i]}</b><small>/${sumSup[i]}</small></td>`)).join('')}${tasks.map((t => {
    const tm = window.impTeamOf ? window.impTeamOf(t) : {
      main: [],
      support: []
    };
    return `<td><b>${tm.main.length}</b><small>/${tm.support.length}</small></td>`;
  })).join('')}</tr>`;
  matrixGrid.innerHTML = `
    <div class="oq-top">
      <div class="oq-legend"><span class="job">✓ Job</span> ดูแลหลัก <span class="sup">S</span> ซัพพอร์ต/เว็บรอง <span class="not">Not</span> ไม่ดูแล${canEdit ? ' · กดช่อง: Not → S → Job → Not บันทึกทันที' : ''}</div>
      <div class="oq-tools">
        <button type="button" class="oq-btn" onclick="odqlCopySheet()" title="คัดลอกเป็นตารางไปวางในชีต/Excel"><span class="material-icons">content_copy</span>คัดลอกไปวางชีต</button>
      </div>
    </div>
    <div class="oq-wrap"><table class="oq-t"><thead><tr>${head1}</tr><tr>${head2}</tr></thead><tbody>${rows || `<tr><td colspan="${2 + webs.length + tasks.length}" class="oq-empty">ไม่มีผู้สอน OD ในกะนี้</td></tr>`}</tbody><tfoot>${foot}</tfoot></table></div>`;
};

window._odqlQ = window._odqlQ || {
  timer: null,
  saving: false,
  dirty: false,
  logs: [],
  needRefresh: false
};

window.odqlPending = function() {
  const q = window._odqlQ;
  return !!(q.timer || q.saving || q.dirty);
};

window.odqlFlush = async function() {
  const q = window._odqlQ;
  q.timer = null;
  if (q.saving) {
    q.dirty = true;
    return;
  }
  q.dirty = false;
  q.saving = true;
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const logs = q.logs.splice(0);
  try {
    window.clearSettingCache();
    window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: getDutySaveKey(targetDate, shiftFilter),
      value: JSON.stringify(currentRosterData || {})
    }, {
      key: window.odqlSupKey(),
      value: JSON.stringify(window._odqlSups || {})
    } ]));
    if (logs.length) appDB.from('system_logs').insert(logs.map((t => ({
      action_type: 'จัดหน้าที่',
      performed_by: currentUser.username,
      target_details: t
    })))).then((() => {}), (() => {}));
    try {
      window.debouncedBroadcast('duty-updates', 'force_reload', 150);
    } catch (e) {}
  } catch (err) {
    q.dirty = false;
    q.needRefresh = true;
    Swal.fire('บันทึกไม่สำเร็จ', (err && err.message || String(err)) + '<br><span style="font-size:12px;opacity:.8">ระบบจะโหลดข้อมูลล่าสุดกลับมาให้</span>', 'error');
  } finally {
    q.saving = false;
    if (q.dirty) {
      if (!q.timer) window.odqlFlush();
    } else if (q.needRefresh) {
      q.needRefresh = false;
      window._odqlSups = null;
      window._odqlSupKey = null;
      if (typeof window.refreshDutyData === 'function') window.refreshDutyData();
    }
  }
};

window.odqlCycle = async function(td) {
  const uid = td.dataset.uid, kind = td.dataset.kind, key = td.dataset.key;
  const cur = td.classList.contains('job') ? 'job' : td.classList.contains('sup') ? 'sup' : 'not';
  const next = cur === 'not' ? 'sup' : cur === 'sup' ? 'job' : 'not';
  const u = (GLOBAL_USER_LIST || []).find((x => String(x.id) === String(uid)));
  if (!u) return;
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const logText = `ผู้สอน OD: ${u.username} ${kind === 'web' ? 'เว็บ' : 'งาน'} [${key}] → ${next === 'job' ? 'Job' : next === 'sup' ? 'S' : 'Not'} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`;
  if (kind !== 'web') {
    if (window._odqlBusy) return;
    window._odqlBusy = true;
    td.classList.add('busy');
    try {
      const team = window.impTeamOf(key);
      team.main = team.main.filter((n => n !== u.username));
      team.support = team.support.filter((n => n !== u.username));
      if (next === 'job') team.main.push(u.username); else if (next === 'sup') team.support.push(u.username);
      const norm = window.impNormTeam(team);
      if (norm) window.currentImportantAssigns[key] = norm; else delete window.currentImportantAssigns[key];
      window.clearSettingCache();
      window.dutyDbOk(await appDB.from('settings').upsert([ {
        key: `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`,
        value: JSON.stringify(window.currentImportantAssigns)
      } ]));
      appDB.from('system_logs').insert([ {
        action_type: 'จัดหน้าที่',
        performed_by: currentUser.username,
        target_details: logText
      } ]).then((() => {}), (() => {}));
      window.debouncedBroadcast('duty-updates', 'force_reload', 150);
      window.renderTrainerOdMatrix(currentRosterData);
      if (typeof window.renderImportantTasksPanel === 'function') window.renderImportantTasksPanel();
    } catch (err) {
      Swal.fire('บันทึกไม่สำเร็จ', err.message, 'error');
    } finally {
      window._odqlBusy = false;
      td.classList.remove('busy');
    }
    return;
  }
  if (!currentRosterData) currentRosterData = {};
  const sups = window._odqlSups || (window._odqlSups = {});
  const mine = (sups[String(uid)] || []).filter((w => w !== key));
  const inThis = (currentRosterData[key] || []).find((x => x && String(x.id) === String(uid)));
  if (next === 'job') {
    if (!currentRosterData[key]) currentRosterData[key] = [];
    if (!inThis) currentRosterData[key].push({
      ...u,
      secondary_team: mine[0] || null,
      assigned_by: currentUser.username,
      assigned_at: (new Date).toISOString()
    });
    sups[String(uid)] = mine;
  } else if (next === 'sup') {
    if (inThis) currentRosterData[key] = currentRosterData[key].filter((x => x !== inThis));
    sups[String(uid)] = [ ...mine, key ];
  } else {
    if (inThis) currentRosterData[key] = currentRosterData[key].filter((x => x !== inThis));
    sups[String(uid)] = mine;
  }
  if (!(sups[String(uid)] || []).length) delete sups[String(uid)];
  const firstSup = (sups[String(uid)] || [])[0] || null;
  for (const t in currentRosterData) (currentRosterData[t] || []).forEach((x => {
    if (x && String(x.id) === String(uid)) x.secondary_team = firstSup;
  }));
  const q = window._odqlQ;
  q.logs.push(logText);
  q.dirty = true;
  if (q.timer) clearTimeout(q.timer);
  q.timer = setTimeout(window.odqlFlush, 350);
  window.renderTrainerOdMatrix(currentRosterData);
};

window.odqlToLeave = function(userId, username) {
  if (!window.isDutyAdmin()) return;
  draggedUser = {
    id: userId,
    username: username,
    fromTeam: '__odql__'
  };
  window.handleDrop({
    preventDefault: () => {},
    target: null
  }, 'leaveList');
};

window.odqlCopySheet = async function() {
  const table = document.querySelector('#dutyMatrixGrid table.oq-t');
  if (!table) return;
  const lines = [];
  table.querySelectorAll('thead tr:last-child, tbody tr').forEach(((tr, i) => {
    const cells = [ ...tr.children ].map((c => c.innerText.replace(/\s+/g, ' ').trim()));
    if (i === 0) cells.unshift('กะ', 'รายชื่อผู้ดูแล');
    lines.push(cells.join('\t'));
  }));
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกแล้ว',
      text: 'ไปวาง (Ctrl+V) ในชีตได้เลย ค่าจะลงช่องตรงกับตาราง',
      timer: 1800,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('คัดลอกไม่สำเร็จ', 'เบราว์เซอร์ไม่อนุญาต ลองกดอีกครั้ง', 'error');
  }
};
