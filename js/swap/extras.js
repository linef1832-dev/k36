window.swapDragStart = function(event, userId, fromDayIndex, shiftType) {
  draggedSwapUser = {
    id: userId,
    fromDay: fromDayIndex,
    shiftType: shiftType
  };
  event.dataTransfer.effectAllowed = "move";
  event.target.classList.add('opacity-50', 'scale-90');
};

window.swapDragOver = function(event, shiftType) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  if (draggedSwapUser && draggedSwapUser.shiftType === shiftType) {
    event.currentTarget.classList.add('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
  }
};

window.swapDragLeave = function(event) {
  event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
};

window.swapDrop = function(event, toDayIndex, shiftType) {
  event.preventDefault();
  event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
  if (!draggedSwapUser) return;
  if (draggedSwapUser.shiftType !== shiftType) {
    Swal.fire({
      icon: 'error',
      title: 'ผิดช่อง!',
      text: 'ลากข้ามประเภทกะไม่ได้ครับ',
      confirmButtonColor: '#ef4444'
    });
    draggedSwapUser = null;
    window.renderSwapPlanPreviewUI();
    return;
  }
  if (draggedSwapUser.fromDay === toDayIndex) {
    draggedSwapUser = null;
    window.renderSwapPlanPreviewUI();
    return;
  }
  const userId = draggedSwapUser.id;
  const targetPlan = generatedSwapPlan[toDayIndex];
  const userLeaves = window.globalUserLeaves ? window.globalUserLeaves[userId] || new Set : new Set;
  let hasConflict = false;
  let conflictMsg = '';
  const targetDateStr = targetPlan.targetDate;
  if (hasSwapLeaveConflict(targetDateStr, shiftType, userLeaves)) {
    hasConflict = true;
    conflictMsg = getSwapConflictMsg(shiftType);
  }
  if (hasConflict) {
    Swal.fire({
      icon: 'warning',
      title: 'ย้ายไม่ได้!',
      text: conflictMsg,
      confirmButtonColor: '#f59e0b'
    });
    draggedSwapUser = null;
    window.renderSwapPlanPreviewUI();
    return;
  }
  const sourcePlan = generatedSwapPlan[draggedSwapUser.fromDay];
  const sourceArray = shiftType === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
  const userIndex = sourceArray.findIndex((u => String(u.id) === String(userId)));
  if (userIndex > -1) {
    const userObj = sourceArray.splice(userIndex, 1)[0];
    const targetArray = shiftType === 'MtoN' ? targetPlan.morningToNight : targetPlan.nightToMorning;
    targetArray.push(userObj);
  }
  draggedSwapUser = null;
  window.renderSwapPlanPreviewUI();
};

