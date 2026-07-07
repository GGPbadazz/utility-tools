/**
 * 样品标签打印系统 - 前端交互
 * Sample Label Printing System - Frontend
 */

// ============== 全局状态 ==============
const state = {
    // 当前选中的车间
    currentWorkshop: null,
    // 当前选中的样品
    currentSample: null,
    // 当前批号页码
    batchPage: 0,
    // 当前子序号页码
    subPage: 0,
    // 选中的批号
    selectedBatch: null,
    // 选中的子序号（分段样品用）
    selectedSub: null,
    // 是否重新打印
    isReprint: false,
    // 打印份数
    copies: 1,
    // 批号数据
    batchData: null,
    // 子序号数据
    subData: null,
    // 打印机列表
    printers: [],
    // 是否显示上月末批次
    showLastMonth: false,
    // 当前打印机
    currentPrinter: null,
    // 车间列表
    workshops: [],
    // 送样人列表
    senders: [],
    // 当前选中的送样人
    currentSender: null,
    // 签名数据 (Base64)
    signatureData: null,
    // 取样时间
    sampleTime: null
};

// 设置页面状态
const settingsState = {
    currentWorkshop: 'default',
    allSenders: {},
    pendingDeleteSender: null
};

// 签名画布相关变量
let signatureCanvas = null;
let signatureCtx = null;
let isDrawing = false;
let hasSignature = false;

// ============== 屏幕键盘 ==============
(function() {
    let oskTarget = null;

    function showOsk(inputEl) {
        oskTarget = inputEl;
        document.getElementById('onscreen-keyboard').style.display = 'flex';
        // 滚动输入框到可见区域
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideOsk() {
        document.getElementById('onscreen-keyboard').style.display = 'none';
        oskTarget = null;
    }

    document.addEventListener('DOMContentLoaded', function() {
        const kbd = document.getElementById('onscreen-keyboard');

        // 字符键按下：插入字符
        kbd.addEventListener('mousedown', function(e) {
            e.preventDefault(); // 防止 input 失焦
            const key = e.target.closest('.osk-key');
            if (!key || !oskTarget) return;

            if (key.id === 'osk-backspace') {
                const s = oskTarget.selectionStart;
                const e2 = oskTarget.selectionEnd;
                if (s !== e2) {
                    oskTarget.value = oskTarget.value.slice(0, s) + oskTarget.value.slice(e2);
                    oskTarget.setSelectionRange(s, s);
                } else if (s > 0) {
                    oskTarget.value = oskTarget.value.slice(0, s - 1) + oskTarget.value.slice(s);
                    oskTarget.setSelectionRange(s - 1, s - 1);
                }
            } else if (key.id === 'osk-clear') {
                oskTarget.value = '';
            } else if (key.id === 'osk-done') {
                hideOsk();
                confirmCustomSample();
            } else {
                const val = key.dataset.val;
                if (val !== undefined) {
                    const s = oskTarget.selectionStart;
                    const e2 = oskTarget.selectionEnd;
                    const maxLen = parseInt(oskTarget.getAttribute('maxlength') || 999);
                    if (oskTarget.value.length - (e2 - s) < maxLen) {
                        oskTarget.value = oskTarget.value.slice(0, s) + val + oskTarget.value.slice(e2);
                        oskTarget.setSelectionRange(s + val.length, s + val.length);
                    }
                }
            }
            oskTarget.dispatchEvent(new Event('input'));
        });

        // 点击输入框时弹出键盘
        const customInput = document.getElementById('custom-sample-name');
        customInput.addEventListener('focus', function() { showOsk(this); });
        // 点击键盘外区域关闭（但不关闭点击键盘本身）
        document.addEventListener('mousedown', function(e) {
            if (oskTarget && !kbd.contains(e.target) && e.target !== oskTarget) {
                hideOsk();
            }
        });
    });

    window.hideOsk = hideOsk;
    window.showOsk = showOsk;
})();

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', function() {
    // 更新时间显示
    updateTime();
    setInterval(updateTime, 1000);

    // 加载车间列表
    loadWorkshops();

    // 加载送样人列表
    loadSenders();

    // 检测打印机
    checkPrinter();
    // 定时检测打印机状态（每5秒一次）
    setInterval(checkPrinter, 5000);

    // 加载月份信息
    loadMonthInfo();

    // 初始化签名画布
    initSignatureCanvas();
});

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    // 更新所有时间显示
    const timeElements = document.querySelectorAll('[id^="current-time"]');
    timeElements.forEach(el => el.textContent = timeStr);
}

// ============== API 调用 ==============
async function apiCall(url, options = {}) {
    try {
        console.log('发送API请求:', url, options);
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        console.log('API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API请求失败:', response.status, errorText);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }

        const data = await response.json();
        console.log('API响应数据:', data);
        return data;
    } catch (error) {
        console.error('API调用异常:', error);
        return { success: false, error: error.message };
    }
}

// ============== 页面0: 车间选择 ==============
async function loadWorkshops() {
    console.log('开始加载车间列表...');
    const result = await apiCall('/api/workshops');
    console.log('车间API返回:', result);

    if (!result.success) {
        showError('加载车间列表失败: ' + result.error);
        return;
    }

    state.workshops = result.workshops;

    const grid = document.getElementById('workshop-grid');
    grid.innerHTML = '';

    result.workshops.forEach(workshop => {
        const btn = document.createElement('div');
        btn.className = 'workshop-btn' + (workshop.enabled ? '' : ' disabled');

        if (workshop.enabled) {
            btn.onclick = () => selectWorkshop(workshop);
        } else {
            btn.onclick = () => showToast('该车间暂未开放');
        }

        btn.innerHTML = `
            <div class="name">${workshop.name}</div>
            <div class="status">${workshop.enabled ? '点击进入' : '暂未开放'}</div>
        `;
        grid.appendChild(btn);
    });
}

function selectWorkshop(workshop) {
    state.currentWorkshop = workshop;
    state.currentSample = null;
    state.selectedBatch = null;
    state.selectedSub = null;

    // 切换到样品选择页面
    showPage('page-samples');

    // 更新标题
    document.getElementById('samples-title').textContent =
        `${workshop.name} - 选择样品类型`;

    // 显示或隐藏自定义输入框（仅自定义样品显示）
    const customInput = document.getElementById('custom-sample-input');
    if (workshop.id === 'rd') {
        customInput.style.display = 'block';
    } else {
        customInput.style.display = 'none';
    }

    // 加载样品类型
    loadSamples();
}

// ============== 页面1: 样品类型选择 ==============
async function loadSamples() {
    const workshopId = state.currentWorkshop.id;
    const result = await apiCall(`/api/workshop/${workshopId}/samples`);

    if (!result.success) {
        showError('加载样品类型失败: ' + result.error);
        return;
    }

    const grid = document.getElementById('sample-grid');
    grid.innerHTML = '';

    // 自定义样品不显示样品网格（使用自定义输入）
    if (workshopId === 'rd') {
        grid.style.display = 'none';
        return;
    }

    grid.style.display = 'grid';

    if (result.samples.length === 0) {
        grid.innerHTML = '<div class="empty-message">该车间暂无配置样品类型</div>';
        return;
    }

    result.samples.forEach(sample => {
        const btn = document.createElement('div');
        btn.className = 'sample-btn';
        btn.onclick = () => selectSample(sample);
        btn.innerHTML = `
            <div class="name">${sample.name}</div>
            <div class="prefix">${sample.prefix}-</div>
        `;
        grid.appendChild(btn);
    });
}

function selectSample(sample) {
    state.currentSample = sample;
    state.batchPage = 0;
    state.selectedBatch = null;
    state.selectedSub = null;
    // 注意：不要重置 showLastMonth，保持用户的选择

    // 切换到批号选择页面
    showPage('page-batch');

    // 不重置复选框，保持用户选择

    // 更新标题和前缀显示
    document.getElementById('batch-title').textContent =
        `${sample.name} - 选择批号`;

    // 加载批号
    loadBatches();
}

// 切换上月末批次显示
function toggleLastMonth() {
    const checkbox = document.getElementById('last-month-checkbox');
    state.showLastMonth = checkbox.checked;
}

// 确认自定义样品（自定义样品专用）
function confirmCustomSample() {
    const customName = document.getElementById('custom-sample-name').value.trim();

    if (!customName) {
        showError('请输入样品名称');
        return;
    }

    // 创建临时样品对象
    const customSample = {
        id: 'custom_' + Date.now(),
        name: customName,
        prefix: 'TMP', // 自定义样品统一使用 TMP 前缀
        has_sub: false
    };

    // 清空输入框
    document.getElementById('custom-sample-name').value = '';

    // 选择该样品
    selectSample(customSample);
}

// ============== 页面2: 批号选择 ==============
async function loadBatches(page = null) {
    const prefix = state.currentSample.prefix;
    let url = `/api/batches/${prefix}`;

    // 添加查询参数
    const params = new URLSearchParams();
    if (page !== null) {
        params.set('page', page);
    }
    // 如果当前正在查看上月数据，翻页时继续使用上月数据
    if (state.showLastMonth || (state.batchData && state.batchData.is_last_month)) {
        params.set('last_month', 'true');
    }

    if (params.toString()) {
        url += '?' + params.toString();
    }

    showLoading(true);
    const result = await apiCall(url);
    showLoading(false);

    if (!result.success) {
        showError('加载批号失败: ' + result.error);
        return;
    }

    state.batchData = result;
    state.batchPage = result.page;

    // 更新批号前缀显示
    const monthLabel = result.is_last_month ? '（上月）' : '';
    document.getElementById('batch-prefix').textContent =
        `批号前缀: ${prefix}-${result.year_month}${monthLabel}`;

    // 渲染批号按钮
    renderBatchButtons();

    // 更新分页信息
    updateBatchPagination();
}

function renderBatchButtons() {
    const grid = document.getElementById('batch-grid');
    grid.innerHTML = '';

    const prefix = state.currentSample.prefix;
    const yearMonth = state.batchData.year_month;

    state.batchData.batches.forEach(batch => {
        const btn = document.createElement('div');
        btn.className = `batch-btn ${batch.status}`;

        // 所有状态都可点击（used=重打印, next=推荐, available=跳级选择）
        btn.onclick = () => selectBatch(batch);

        // 状态文字
        let statusText = '';
        if (batch.status === 'used') {
            statusText = '已使用';
        } else if (batch.status === 'next') {
            statusText = '★ 推荐';
        }

        // 构建完整编号
        const fullId = `${prefix}-${yearMonth}${batch.label}`;

        btn.innerHTML = `
            <div class="number">${batch.label}</div>
            <div class="full-id">${fullId}</div>
            <div class="status-text">${statusText}</div>
        `;
        grid.appendChild(btn);
    });
}

function updateBatchPagination() {
    const data = state.batchData;

    // 更新页码信息
    document.getElementById('batch-page-info').textContent =
        `${data.start.toString().padStart(3, '0')}-${data.end.toString().padStart(3, '0')}`;

    // 更新按钮状态
    document.getElementById('btn-prev-batch').disabled = !data.has_prev;
    document.getElementById('btn-next-batch').disabled = !data.has_next;
}

function prevBatchPage() {
    if (state.batchPage > 0) {
        loadBatches(state.batchPage - 1);
    }
}

function nextBatchPage() {
    loadBatches(state.batchPage + 1);
}

function selectBatch(batch) {
    state.selectedBatch = batch.number;
    state.isReprint = (batch.status === 'used');

    // 检查是否是分段样品（需要选择子序号）
    if (state.currentSample.has_sub) {
        state.subPage = 0;
        showPage('page-sub');
        loadSubBatches();
    } else {
        // 进入送样人选择页面
        goToSender();
    }
}

// ============== 页面2b: 分段样品子序号选择 ==============
async function loadSubBatches(page = null) {
    const prefix = state.currentSample.prefix;
    const batch = state.selectedBatch;
    const maxSub = state.currentSample.sub_max || 20;

    let url = `/api/batches/${prefix}/${batch}/sub?max_sub=${maxSub}`;

    if (page !== null) {
        url += `&page=${page}`;
    }

    showLoading(true);
    const result = await apiCall(url);
    showLoading(false);

    if (!result.success) {
        showError('加载子序号失败: ' + result.error);
        return;
    }

    state.subData = result;
    state.subPage = result.page;

    // 更新标题
    document.getElementById('sub-title').textContent =
        `${state.currentSample.name} - 选择子序号`;
    document.getElementById('sub-prefix').textContent =
        `批号: ${prefix}-${result.year_month}${batch.toString().padStart(3, '0')}-__`;

    // 渲染子序号按钮
    renderSubButtons();

    // 更新分页信息
    updateSubPagination();
}

function renderSubButtons() {
    const grid = document.getElementById('sub-grid');
    grid.innerHTML = '';

    const prefix = state.currentSample.prefix;
    // 注意：这里假设 subData 中包含 year_month，或者从 batchData 获取
    // 根据 loadSubBatches 的实现，result 包含 year_month
    const yearMonth = state.subData.year_month;
    const batchNum = state.selectedBatch.toString().padStart(3, '0');
    const suffix = state.currentSample.sub_suffix || '';

    state.subData.subs.forEach(sub => {
        const btn = document.createElement('div');
        btn.className = `batch-btn ${sub.status}`;

        // 设置点击事件
        if (sub.status === 'disabled') {
            btn.onclick = () => {
                showToast(`请先使用 ${state.subData.next.toString().padStart(2, '0')}`);
            };
        } else {
            btn.onclick = () => selectSub(sub);
        }

        // 状态文字
        let statusText = '';
        if (sub.status === 'used') {
            statusText = '已使用';
        } else if (sub.status === 'next') {
            statusText = '★ 推荐';
        }

        // 构建完整编号
        const fullId = `${prefix}-${yearMonth}${batchNum}-${sub.label}${suffix}`;

        btn.innerHTML = `
            <div class="number">${sub.label}</div>
            <div class="full-id">${fullId}</div>
            <div class="status-text">${statusText}</div>
        `;
        grid.appendChild(btn);
    });
}

function updateSubPagination() {
    const data = state.subData;

    // 更新页码信息
    document.getElementById('sub-page-info').textContent =
        `${data.start.toString().padStart(2, '0')}-${data.end.toString().padStart(2, '0')}`;

    // 更新按钮状态
    document.getElementById('btn-prev-sub').disabled = !data.has_prev;
    document.getElementById('btn-next-sub').disabled = !data.has_next;
}

function prevSubPage() {
    if (state.subPage > 0) {
        loadSubBatches(state.subPage - 1);
    }
}

function nextSubPage() {
    if (state.subData.has_next) {
        loadSubBatches(state.subPage + 1);
    }
}

function selectSub(sub) {
    state.selectedSub = sub.number;
    state.isReprint = state.isReprint || (sub.status === 'used');
    // 进入送样人选择页面
    goToSender();
}

// ============== 页面3: 送样人选择 ==============
async function loadSenders() {
    const workshopId = state.currentWorkshop ? state.currentWorkshop.id : null;
    const url = workshopId ? `/api/senders?workshop=${workshopId}` : '/api/senders';
    const result = await apiCall(url);

    if (result.success) {
        state.senders = result.senders;
        state.workshopSenders = result.workshop_senders || [];
        state.defaultSenders = result.default_senders || [];
    } else {
        console.error('加载送样人列表失败:', result.error);
    }
}

async function goToSender() {
    // 记录取样时间
    state.sampleTime = new Date().toLocaleString('zh-CN');

    // 重新加载当前车间的送样人列表
    await loadSenders();

    showPage('page-sender');
    renderSenderButtons();
}

function renderSenderButtons() {
    const grid = document.getElementById('sender-grid');
    grid.innerHTML = '';

    if (state.senders.length === 0) {
        grid.innerHTML = '<div class="empty-message">暂无送样人配置</div>';
        return;
    }

    // 优先显示车间人员
    state.workshopSenders.forEach(sender => {
        const btn = document.createElement('div');
        btn.className = 'sender-btn';
        btn.onclick = () => selectSender(sender);
        btn.innerHTML = `<div class="name">${sender.name}</div>`;
        grid.appendChild(btn);
    });

    // 显示通用人员（视觉弱化）
    state.defaultSenders.forEach(sender => {
        const btn = document.createElement('div');
        btn.className = 'sender-btn sender-btn-default';
        btn.onclick = () => selectSender(sender);
        btn.innerHTML = `<div class="name">${sender.name}</div>`;
        grid.appendChild(btn);
    });
}

function selectSender(sender) {
    state.currentSender = sender;

    // 进入签名页面
    showPage('page-signature');
    document.getElementById('signature-sender').textContent = sender.name;

    // 重置签名
    clearSignature();

    // 重新初始化画布尺寸
    setTimeout(() => {
        initSignatureCanvas();
    }, 100);
}

function goBackFromSender() {
    // 根据是否有子序号返回不同页面
    if (state.currentSample.has_sub) {
        showPage('page-sub');
    } else {
        showPage('page-batch');
    }
}

// ============== 页面4: 手写签名 ==============
function initSignatureCanvas() {
    signatureCanvas = document.getElementById('signature-canvas');
    if (!signatureCanvas) return;

    signatureCtx = signatureCanvas.getContext('2d');

    // 设置画布实际尺寸
    const rect = signatureCanvas.getBoundingClientRect();
    signatureCanvas.width = rect.width || 800;
    signatureCanvas.height = rect.height || 300;

    // 设置画笔样式
    signatureCtx.strokeStyle = '#000';
    signatureCtx.lineWidth = 3;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    // 清空画布
    signatureCtx.fillStyle = '#fff';
    signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);

    // 绑定事件
    signatureCanvas.removeEventListener('mousedown', startDrawing);
    signatureCanvas.removeEventListener('mousemove', draw);
    signatureCanvas.removeEventListener('mouseup', stopDrawing);
    signatureCanvas.removeEventListener('mouseleave', stopDrawing);
    signatureCanvas.removeEventListener('touchstart', handleTouchStart);
    signatureCanvas.removeEventListener('touchmove', handleTouchMove);
    signatureCanvas.removeEventListener('touchend', stopDrawing);

    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseleave', stopDrawing);

    // 触摸事件
    signatureCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    signatureCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    signatureCanvas.addEventListener('touchend', stopDrawing);

    hasSignature = false;
    updateNextButton();
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getPointerPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;

    const pos = getPointerPos(e);
    signatureCtx.lineTo(pos.x, pos.y);
    signatureCtx.stroke();
    hasSignature = true;
    updateNextButton();

    // 隐藏提示文字
    const hint = document.querySelector('.signature-hint');
    if (hint) hint.style.display = 'none';
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

function getPointerPos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function clearSignature() {
    if (signatureCtx) {
        signatureCtx.fillStyle = '#fff';
        signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }
    hasSignature = false;
    updateNextButton();

    // 显示提示文字
    const hint = document.querySelector('.signature-hint');
    if (hint) hint.style.display = 'block';
}

function updateNextButton() {
    const btn = document.getElementById('btn-to-confirm');
    if (btn) {
        btn.disabled = !hasSignature;
    }
}

function getSignatureData() {
    if (!signatureCanvas || !hasSignature) return null;
    return signatureCanvas.toDataURL('image/png');
}

function goToConfirmFromSignature() {
    if (!hasSignature) {
        showToast('请先签名');
        return;
    }

    // 保存签名数据
    state.signatureData = getSignatureData();

    goToConfirm();
}

// ============== 页面5: 确认打印 ==============
function goToConfirm() {
    showPage('page-confirm');

    // 生成批号ID
    const prefix = state.currentSample.prefix;
    const yearMonth = state.batchData.year_month;
    const batch = state.selectedBatch.toString().padStart(3, '0');
    const specialFormat = state.currentSample.special_format || false;
    const subSuffix = state.currentSample.sub_suffix || '';

    let batchId;
    if (specialFormat) {
        // 特殊格式：LOT-YYMM-XXX
        if (state.selectedSub !== null) {
            const sub = state.selectedSub.toString().padStart(2, '0');
            batchId = `${prefix}-${yearMonth}-${batch}-${sub}${subSuffix}`;
        } else {
            batchId = `${prefix}-${yearMonth}-${batch}`;
        }
    } else {
        // 普通格式：A-2511001
        if (state.selectedSub !== null) {
            const sub = state.selectedSub.toString().padStart(2, '0');
            batchId = `${prefix}-${yearMonth}${batch}-${sub}${subSuffix}`;
        } else {
            batchId = `${prefix}-${yearMonth}${batch}`;
        }
    }

    // 更新确认信息
    document.getElementById('confirm-workshop').textContent = state.currentWorkshop.name;
    document.getElementById('confirm-name').textContent = state.currentSample.name;
    document.getElementById('confirm-batch').textContent = batchId;
    document.getElementById('confirm-time').textContent = state.sampleTime || new Date().toLocaleString('zh-CN');
    document.getElementById('confirm-sender').textContent = state.currentSender ? state.currentSender.name : '-';

    // 显示重打印提示
    const reprintNotice = document.getElementById('reprint-notice');
    if (state.isReprint) {
        reprintNotice.style.display = 'flex';
    } else {
        reprintNotice.style.display = 'none';
    }

    // 重置份数
    state.copies = 1;
    document.getElementById('copies-value').textContent = '1';
}

function increaseCopies() {
    if (state.copies < 10) {
        state.copies++;
        document.getElementById('copies-value').textContent = state.copies;
    }
}

function decreaseCopies() {
    if (state.copies > 1) {
        state.copies--;
        document.getElementById('copies-value').textContent = state.copies;
    }
}

async function confirmPrint() {
    // 生成批号ID（用于显示，实际格式由后端决定）
    const prefix = state.currentSample.prefix;
    const yearMonth = state.batchData.year_month;
    const batch = state.selectedBatch.toString().padStart(3, '0');
    const specialFormat = state.currentSample.special_format || false;
    const subSuffix = state.currentSample.sub_suffix || '';

    let batchId;
    if (specialFormat) {
        // 特殊格式：LOT-YYMM-XXX
        if (state.selectedSub !== null) {
            const sub = state.selectedSub.toString().padStart(2, '0');
            batchId = `${prefix}-${yearMonth}-${batch}-${sub}${subSuffix}`;
        } else {
            batchId = `${prefix}-${yearMonth}-${batch}`;
        }
    } else {
        // 普通格式：A-2511001
        if (state.selectedSub !== null) {
            const sub = state.selectedSub.toString().padStart(2, '0');
            batchId = `${prefix}-${yearMonth}${batch}-${sub}${subSuffix}`;
        } else {
            batchId = `${prefix}-${yearMonth}${batch}`;
        }
    }

    const printData = {
        sample_id: state.currentSample.id,
        sample_name: state.currentSample.name,
        prefix: state.currentSample.prefix,
        batch: state.selectedBatch,
        sub: state.selectedSub,
        sub_suffix: subSuffix,
        year_month: yearMonth,  // 添加年月数据，支持上月打印
        copies: state.copies,
        printer: state.currentPrinter,
        sender: state.currentSender ? state.currentSender.name : '',
        special_format: specialFormat
    };

    showLoading(true);
    document.getElementById('btn-print').disabled = true;

    const result = await apiCall('/api/print/sample', {
        method: 'POST',
        body: JSON.stringify(printData)
    });

    if (result.success) {
        // 打印成功后保存记录
        const recordData = {
            workshop: state.currentWorkshop.name,
            sample_name: state.currentSample.name,
            batch_id: batchId,
            sample_time: state.sampleTime || new Date().toLocaleString('zh-CN'),
            sender: state.currentSender ? state.currentSender.name : '-',
            signature: state.signatureData,
            copies: state.copies,
            is_reprint: state.isReprint
        };

        // 保存记录（不阻塞）
        apiCall('/api/save-record', {
            method: 'POST',
            body: JSON.stringify(recordData)
        }).then(saveResult => {
            if (!saveResult.success) {
                console.error('保存记录失败:', saveResult.error);
            } else {
                console.log('记录已保存:', saveResult.filename);
            }
        });

        showLoading(false);
        document.getElementById('btn-print').disabled = false;
        showResult(true, '打印成功', `批号 ${result.batch_id} 已发送到打印机`);
    } else {
        showLoading(false);
        document.getElementById('btn-print').disabled = false;
        showResult(false, '打印失败', result.error);
    }
}

// ============== 页面导航 ==============
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    // 离开样品页面时隐藏键盘
    if (pageId !== 'page-samples' && typeof hideOsk === 'function') hideOsk();
}

function goToWorkshop() {
    state.currentWorkshop = null;
    state.currentSample = null;
    state.selectedBatch = null;
    state.selectedSub = null;
    showPage('page-workshop');
}

function goToSamples() {
    state.currentSample = null;
    state.selectedBatch = null;
    state.selectedSub = null;
    showPage('page-samples');
}

function goToBatch() {
    state.selectedSub = null;
    showPage('page-batch');
    loadBatches();
}

function goBack() {
    // 从确认页面返回到签名页面
    showPage('page-signature');
}

// ============== 打印机检测 ==============
async function checkPrinter() {
    const result = await apiCall('/api/printers');

    const statusDot = document.querySelector('.printer-status .status-dot');
    const statusText = document.querySelector('.printer-status .status-text');

    if (result.success && result.printers && result.printers.length > 0) {
        state.printers = result.printers;
        state.currentPrinter = result.printers[0].name;

        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
        statusText.textContent = `打印机: ${state.currentPrinter}`;
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = '未检测到打印机';
    }
}

// ============== UI 辅助函数 ==============
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('active');
    } else {
        loading.classList.remove('active');
    }
}

function showResult(success, title, message) {
    const modal = document.getElementById('result-modal');
    const icon = document.getElementById('result-icon');
    const titleEl = document.getElementById('result-title');
    const messageEl = document.getElementById('result-message');

    icon.textContent = success ? '✓' : '✗';
    icon.className = 'modal-icon ' + (success ? 'success' : 'error');
    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('result-modal').classList.remove('active');

    // 返回样品选择页面（保持在同一生产区域）
    goToSamples();
}

function showError(message) {
    showResult(false, '错误', message);
}

function showToast(message) {
    // 简单的提示，可以用更美观的实现替换
    alert(message);
}

// ============== 月份信息和重置功能 ==============
async function loadMonthInfo() {
    const result = await apiCall('/api/month-info');
    const monthInfoEl = document.getElementById('month-info');

    if (result.success) {
        const yearMonth = result.year_month;
        const year = '20' + yearMonth.substring(0, 2);
        const month = yearMonth.substring(2, 4);
        const totalUsed = result.total_used || 0;

        monthInfoEl.innerHTML = `
            <span class="month-text">当月: ${year}年${parseInt(month)}月 | 已用批号: ${totalUsed}个</span>
        `;
    } else {
        monthInfoEl.innerHTML = `<span class="month-text">当月信息加载失败</span>`;
    }
}

function showResetConfirm() {
    const modal = document.getElementById('reset-modal');
    modal.classList.add('active');
}

function closeResetModal() {
    document.getElementById('reset-modal').classList.remove('active');
}

async function confirmReset() {
    closeResetModal();
    showLoading(true);

    try {
        const result = await apiCall('/api/reset-month', {
            method: 'POST'
        });

        showLoading(false);

        if (result.success) {
            // 显示成功提示
            showResetSuccess(result.message || '当月批号数据已重置');
            // 刷新月份信息
            loadMonthInfo();
        } else {
            showResult(false, '重置失败', result.error || '未知错误');
        }
    } catch (error) {
        showLoading(false);
        showResult(false, '重置失败', error.message);
    }
}

function showResetSuccess(message) {
    const modal = document.getElementById('result-modal');
    const icon = document.getElementById('result-icon');
    const titleEl = document.getElementById('result-title');
    const messageEl = document.getElementById('result-message');
    const btnModal = modal.querySelector('.btn-modal');

    icon.textContent = '✓';
    icon.className = 'modal-icon success';
    titleEl.textContent = '重置成功';
    messageEl.textContent = message;

    // 修改按钮文字和行为
    btnModal.textContent = '确定';
    btnModal.onclick = function() {
        modal.classList.remove('active');
        btnModal.textContent = '继续打印';
        btnModal.onclick = closeModal;
    };

    modal.classList.add('active');
}

// ============== 送样记录功能 ==============

// 跳转到送样记录页面
async function goToRecords() {
    showPage('page-records');
    await loadRecordMonths();
}

// 加载月份列表
async function loadRecordMonths() {
    try {
        const response = await apiCall('/api/records/months');
        if (response.success) {
            const select = document.getElementById('records-month-filter');
            select.innerHTML = '';

            if (response.months.length === 0) {
                select.innerHTML = '<option value="">暂无记录</option>';
                document.getElementById('records-list').innerHTML =
                    '<div class="no-records">📭 暂无送样记录</div>';
                return;
            }

            response.months.forEach((month, index) => {
                const option = document.createElement('option');
                option.value = month.value;
                option.textContent = month.label;
                select.appendChild(option);
            });

            // 自动加载第一个月份的记录
            await loadRecords();
        }
    } catch (error) {
        console.error('加载月份列表失败:', error);
    }
}

// 加载指定月份的记录
async function loadRecords() {
    const select = document.getElementById('records-month-filter');
    const month = select.value;

    if (!month) {
        document.getElementById('records-list').innerHTML =
            '<div class="no-records">📭 暂无送样记录</div>';
        return;
    }

    try {
        const response = await apiCall(`/api/records/${month}`);
        if (response.success) {
            const listEl = document.getElementById('records-list');

            if (response.records.length === 0) {
                listEl.innerHTML = '<div class="no-records">📭 该月份暂无送样记录</div>';
                return;
            }

            listEl.innerHTML = response.records.map(record => `
                <div class="record-item" onclick="viewRecord('${record.month}', '${record.filename}')">
                    <div class="record-info">
                        <div class="record-batch">${record.batch_id}</div>
                        <div class="record-time">${record.time}</div>
                    </div>
                    <button class="record-view-btn">查看 👁️</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载记录列表失败:', error);
        document.getElementById('records-list').innerHTML =
            '<div class="no-records">❌ 加载失败，请重试</div>';
    }
}

// 查看记录详情
function viewRecord(month, filename) {
    // 在新标签页打开记录
    window.open(`/api/records/${month}/${filename}`, '_blank');
}

// 关闭记录查看器
function closeRecordViewer() {
    const modal = document.getElementById('record-viewer-modal');
    const iframe = document.getElementById('record-iframe');

    modal.classList.remove('show');
    iframe.src = '';
}

// 监听来自 iframe 的关闭消息
window.addEventListener('message', function(event) {
    if (event.data === 'closeRecord') {
        closeRecordViewer();
    }
});

// ============== 系统重启功能 ==============

// 显示重启确认弹窗
function showRestartConfirm() {
    const modal = document.getElementById('restart-modal');
    modal.classList.add('active');
}

// 关闭重启确认弹窗
function closeRestartModal() {
    const modal = document.getElementById('restart-modal');
    modal.classList.remove('active');
}

// 确认重启系统
async function confirmRestart() {
    closeRestartModal();
    showLoading(true);

    try {
        const response = await apiCall('/api/system/restart', {
            method: 'POST'
        });

        // 不管结果如何，都显示提示并等待重启
        showResult(true, '系统重启中', '请等待页面自动刷新...');

        // 等待几秒后强制刷新页面（清除缓存）
        setTimeout(() => {
            location.reload(true);
        }, 5000);

    } catch (error) {
        showLoading(false);
        showResult(false, '重启失败', error.message);
    }
}

// ============== 设置页面 ==============
async function goToSettings() {
    showPage('page-settings');
    await loadAllSenders();
    renderSettingsWorkshopTabs();
}

// 加载所有送样人配置
async function loadAllSenders() {
    const result = await apiCall('/api/senders/all');
    if (result.success) {
        settingsState.allSenders = result.senders;
    }
}

// 渲染车间标签
function renderSettingsWorkshopTabs() {
    const container = document.getElementById('settings-workshop-tabs');
    container.innerHTML = '';

    // 添加"通用"选项
    const defaultTab = document.createElement('div');
    defaultTab.className = 'settings-tab' + (settingsState.currentWorkshop === 'default' ? ' active' : '');
    defaultTab.textContent = '🌐 通用';
    defaultTab.onclick = () => selectSettingsWorkshop('default');
    container.appendChild(defaultTab);

    // 添加各车间
    state.workshops.forEach(ws => {
        const tab = document.createElement('div');
        tab.className = 'settings-tab' + (settingsState.currentWorkshop === ws.id ? ' active' : '');
        if (!ws.enabled) {
            tab.className += ' disabled';
        }
        tab.textContent = ws.name;
        tab.onclick = () => {
            if (ws.enabled) {
                selectSettingsWorkshop(ws.id);
            }
        };
        container.appendChild(tab);
    });

    // 默认选中"通用"
    if (!settingsState.currentWorkshop) {
        selectSettingsWorkshop('default');
    } else {
        renderSettingsSenderList();
    }
}

// 选择车间
function selectSettingsWorkshop(workshopId) {
    settingsState.currentWorkshop = workshopId;

    // 更新标签样式
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    renderSettingsSenderList();
}

// 渲染送样人列表
function renderSettingsSenderList() {
    const container = document.getElementById('settings-sender-list');
    const workshopId = settingsState.currentWorkshop;
    const senders = settingsState.allSenders[workshopId] || [];

    if (senders.length === 0) {
        container.innerHTML = '<div class="settings-empty-message">暂无送样人，请添加</div>';
        return;
    }

    container.innerHTML = '';
    senders.forEach(sender => {
        const item = document.createElement('div');
        item.className = 'settings-sender-item';
        item.innerHTML = `
            <span class="settings-sender-name">${sender.name}</span>
            <button class="btn-delete-sender" onclick="showDeleteSenderConfirm('${sender.name}')">🗑️ 删除</button>
        `;
        container.appendChild(item);
    });
}

// 添加新送样人
async function addNewSender() {
    const input = document.getElementById('new-sender-name');
    const name = input.value.trim();

    if (!name) {
        showToast('请输入送样人姓名');
        return;
    }

    if (name.length > 10) {
        showToast('姓名不能超过10个字符');
        return;
    }

    const workshopId = settingsState.currentWorkshop;

    showLoading(true);
    const result = await apiCall(`/api/senders/${workshopId}/add`, {
        method: 'POST',
        body: JSON.stringify({ name: name })
    });
    showLoading(false);

    if (result.success) {
        input.value = '';
        settingsState.allSenders[workshopId] = result.senders;
        renderSettingsSenderList();
        showToast(`已添加: ${name}`);

        // 同时更新主送样人列表
        await loadSenders();
    } else {
        showToast(result.error || '添加失败');
    }
}

// 显示删除确认弹窗
function showDeleteSenderConfirm(name) {
    settingsState.pendingDeleteSender = name;
    document.getElementById('delete-sender-message').textContent = `确定要删除送样人 "${name}" 吗？`;
    document.getElementById('delete-sender-modal').classList.add('active');
}

// 关闭删除确认弹窗
function closeDeleteSenderModal() {
    document.getElementById('delete-sender-modal').classList.remove('active');
    settingsState.pendingDeleteSender = null;
}

// 确认删除送样人
async function confirmDeleteSender() {
    const name = settingsState.pendingDeleteSender;
    if (!name) return;

    closeDeleteSenderModal();

    const workshopId = settingsState.currentWorkshop;

    showLoading(true);
    const result = await apiCall(`/api/senders/${workshopId}/remove`, {
        method: 'POST',
        body: JSON.stringify({ name: name })
    });
    showLoading(false);

    if (result.success) {
        settingsState.allSenders[workshopId] = result.senders;
        renderSettingsSenderList();
        showToast(`已删除: ${name}`);

        // 同时更新主送样人列表
        await loadSenders();
    } else {
        showToast(result.error || '删除失败');
    }
}
