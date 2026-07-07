let currentConfig = {};
let tickerItems = [];
const PANEL_IDS = [1, 2, 3, 4];

const $ = (id) => document.getElementById(id);

function showMessage(text, isError = false) {
  const message = $('message');
  message.textContent = text;
  message.style.color = isError ? '#c62828' : '#0a8f45';
  setTimeout(() => {
    if (message.textContent === text) message.textContent = '';
  }, 3500);
}

function withCacheBuster(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (_error) {
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`服务器返回的不是 JSON，可能服务未重启、接口不存在或上传文件过大。返回内容：${preview || '空内容'}`);
  }
}

function getMediaMode() {
  return document.querySelector('input[name="mediaMode"]:checked')?.value || 'video';
}

function setMediaMode(mode) {
  const safeMode = mode === 'slides' ? 'slides' : 'video';
  const input = document.querySelector(`input[name="mediaMode"][value="${safeMode}"]`);
  if (input) input.checked = true;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPanel(value) {
  const number = Math.floor(toNumber(value, 0));
  return number >= 0 && number <= 4 ? number : 0;
}

function normalizeDirection(value) {
  return ['left', 'right', 'static'].includes(value) ? value : 'left';
}

function normalizeTickerItems(config) {
  const source = Array.isArray(config.tickerItems) && config.tickerItems.length
    ? config.tickerItems
    : [{ text: config.tickerText || '', top: 48, left: 0, fontSize: 54, color: '#f3f5f7', weight: 700, speed: 22, direction: 'left', enabled: true }];

  return source.map((item, index) => ({
    id: item.id || `ticker-${Date.now()}-${index}`,
    text: item.text || '',
    top: toNumber(item.top, 50),
    left: toNumber(item.left, 0),
    fontSize: toNumber(item.fontSize, 48),
    color: item.color || '#f3f5f7',
    weight: toNumber(item.weight, 700),
    speed: toNumber(item.speed, 22),
    direction: normalizeDirection(item.direction),
    enabled: item.enabled !== false
  }));
}

function getModules() {
  return [
    { id: 'ticker', label: '滚动文字模块' },
    { id: 'mediaVideo', label: '视频模块' },
    { id: 'mediaSlides', label: '图片序列模块' },
    { id: 'content', label: '展示内容模块' },
    { id: 'device', label: '设备图像模块' },
    { id: 'remoteImage', label: '远程图片模块' }
  ];
}

function getPanelAssignments(config) {
  const raw = config.panelAssignments || {};
  const next = { ...raw };

  getModules().forEach((module) => {
    next[module.id] = toPanel(raw[module.id]);
  });

  return next;
}

function collectPanelAssignments() {
  const assignments = { ...(currentConfig.panelAssignments || {}) };
  const selects = Array.from(document.querySelectorAll('.module-assignment-select'));

  selects.forEach((select) => {
    const id = select.dataset.module;
    assignments[id] = toPanel(select.value);
  });

  return assignments;
}

function renderModuleAssignments() {
  const modules = getModules();
  const assignments = collectPanelAssignments();
  const used = new Set();

  modules.forEach((item) => {
    const panel = assignments[item.id];
    if (panel >= 1 && panel <= 4) used.add(panel);
  });

  modules.forEach((item) => {
    const container = $(`moduleAssignment-${item.id}`);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'module-assignment-item';

    const info = document.createElement('div');
    info.className = 'module-assignment-info';
    const title = document.createElement('div');
    const currentPanel = toPanel(assignments[item.id]);
    title.className = 'module-assignment-title';
    title.textContent = item.label;

    const hint = document.createElement('div');
    hint.className = 'module-assignment-hint';
    if (!currentPanel) {
      hint.textContent = '未分配';
    } else {
      hint.textContent = `已分配到 ${currentPanel} 号看板`;
    }

    info.appendChild(title);
    info.appendChild(hint);

    const select = document.createElement('select');
    select.className = 'module-assignment-select';
    select.dataset.module = item.id;

    const emptyOption = document.createElement('option');
    emptyOption.value = '0';
    emptyOption.textContent = '不分配';
    select.appendChild(emptyOption);

    PANEL_IDS.forEach((panel) => {
      const option = document.createElement('option');
      option.value = String(panel);
      option.textContent = `${panel}号看板`;
      if (used.has(panel) && currentPanel !== panel) {
        option.disabled = true;
      }
      if (currentPanel === panel) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    if (currentPanel === 0) {
      emptyOption.selected = true;
    }

    select.addEventListener('change', () => {
      const next = collectPanelAssignments();
      next[item.id] = toPanel(select.value);
      currentConfig.panelAssignments = next;
      renderModuleAssignments();
    });

    row.appendChild(info);
    row.appendChild(select);
    container.innerHTML = '';
    container.appendChild(row);
  });
}

function updateTickerItem(id, key, value) {
  tickerItems = tickerItems.map((item) => (item.id === id ? { ...item, [key]: value } : item));
  renderTickerPreview();
}

function renderTickerEditor() {
  const container = $('tickerItemsEditor');
  container.innerHTML = '';

  tickerItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'ticker-item-editor';
    row.innerHTML = `
      <div class="ticker-item-header">
        <div class="ticker-item-title">文本框 ${index + 1}</div>
        <div class="ticker-item-actions">
          <button type="button" data-action="toggle">${item.enabled ? '停用' : '启用'}</button>
          <button type="button" data-action="up">上移</button>
          <button type="button" data-action="down">下移</button>
          <button type="button" data-action="remove">删除</button>
        </div>
      </div>
      <div class="ticker-grid">
        <div class="wide">
          <label>文字内容</label>
          <input data-field="text" type="text" value="${escapeHtml(item.text)}" />
        </div>
        <div>
          <label>上下位置%</label>
          <input data-field="top" type="number" min="8" max="90" value="${item.top}" />
        </div>
        <div>
          <label>左右位置%</label>
          <input data-field="left" type="number" min="0" max="100" value="${item.left}" />
        </div>
        <div>
          <label>字号px</label>
          <input data-field="fontSize" type="number" min="16" max="120" value="${item.fontSize}" />
        </div>
        <div>
          <label>颜色</label>
          <input data-field="color" type="color" value="${item.color}" />
        </div>
        <div>
          <label>字重</label>
          <select data-field="weight">
            <option value="400" ${item.weight === 400 ? 'selected' : ''}>常规</option>
            <option value="500" ${item.weight === 500 ? 'selected' : ''}>中等</option>
            <option value="700" ${item.weight === 700 ? 'selected' : ''}>加粗</option>
            <option value="900" ${item.weight === 900 ? 'selected' : ''}>特粗</option>
          </select>
        </div>
        <div>
          <label>速度秒</label>
          <input data-field="speed" type="number" min="0" max="90" value="${item.speed}" />
        </div>
        <div>
          <label>方向</label>
          <select data-field="direction">
            <option value="left" ${item.direction === 'left' ? 'selected' : ''}>向左</option>
            <option value="right" ${item.direction === 'right' ? 'selected' : ''}>向右</option>
            <option value="static" ${item.direction === 'static' ? 'selected' : ''}>禁止/静止</option>
          </select>
        </div>
      </div>
    `;

    row.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        const numericFields = ['top', 'left', 'fontSize', 'weight', 'speed'];
        updateTickerItem(item.id, field, numericFields.includes(field) ? Number(input.value) : input.value);
      });
    });

    row.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      updateTickerItem(item.id, 'enabled', !item.enabled);
      renderTickerEditor();
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', () => {
      tickerItems = tickerItems.filter((target) => target.id !== item.id);
      renderTickerEditor();
      renderTickerPreview();
    });
    row.querySelector('[data-action="up"]').addEventListener('click', () => moveTickerItem(index, -1));
    row.querySelector('[data-action="down"]').addEventListener('click', () => moveTickerItem(index, 1));

    container.appendChild(row);
  });
}

function renderTickerPreview() {
  const preview = $('tickerPreview');
  preview.innerHTML = '';
  tickerItems.filter((item) => item.enabled !== false).forEach((item) => {
    const el = document.createElement('div');
    el.className = 'preview-ticker-item';
    el.textContent = item.text || '未填写文字';
    el.style.top = `${item.top}%`;
    el.style.left = `${item.left}%`;
    el.style.fontSize = `${Math.max(12, item.fontSize * 0.55)}px`;
    el.style.color = item.color;
    el.style.fontWeight = String(item.weight);
    preview.appendChild(el);
  });
}

function moveTickerItem(index, offset) {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= tickerItems.length) return;
  const next = [...tickerItems];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  tickerItems = next;
  renderTickerEditor();
  renderTickerPreview();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function readRemoteImageConfigFromForm(currentConfig) {
  const remote = (currentConfig && currentConfig.remoteImage && typeof currentConfig.remoteImage === 'object') ? currentConfig.remoteImage : {};
  const passwordInput = $('remoteImagePassword')?.value || '';

  return {
    ...remote,
    enabled: $('remoteImageEnabled')?.checked === true,
    username: $('remoteImageUsername')?.value.trim() || remote.username || '',
    password: passwordInput || remote.password || '',
    syncIntervalMinutes: 1440,
    localImageUrl: remote.localImageUrl || '',
    lastSyncedAt: remote.lastSyncedAt || ''
  };
}

async function loadConfig() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  fillForm(await readJsonResponse(response));
}

function fillForm(config) {
  currentConfig = config;
  if (!currentConfig.mediaMode) currentConfig.mediaMode = 'video';
  currentConfig.panelAssignments = getPanelAssignments(config);

  tickerItems = normalizeTickerItems(config);
  renderTickerEditor();
  renderTickerPreview();

  $('contentType').value = config.contentType || 'text';
  $('contentText').value = config.contentText || '';
  $('refreshInterval').value = config.refreshInterval || 5000;

  setMediaMode(config.mediaMode || 'video');
  $('slideInterval').value = config.slideInterval || 5000;

  $('videoUrl').textContent = config.videoUrl ? `当前视频：${config.videoUrl}` : '当前未上传视频';
  $('videoUrlInput').value = config.videoUrl || '';
  $('contentImageUrlInput').value = config.contentImageUrl || '';
  $('contentImagePreview').src = config.contentImageUrl ? withCacheBuster(config.contentImageUrl) : '';
  $('deviceImagePreview').src = config.deviceImageUrl ? withCacheBuster(config.deviceImageUrl) : '';
  const remoteImage = config.remoteImage && typeof config.remoteImage === 'object' ? config.remoteImage : {};

  $('remoteImageEnabled') && ($('remoteImageEnabled').checked = remoteImage.enabled === true);
  $('remoteImageUsername') && ($('remoteImageUsername').value = remoteImage.username || '');
  $('remoteImagePassword') && ($('remoteImagePassword').value = '');
  $('remoteImagePreview') && ($('remoteImagePreview').src = remoteImage.localImageUrl ? withCacheBuster(remoteImage.localImageUrl) : '');
  $('remoteImageStatus') && ($('remoteImageStatus').textContent = remoteImage.lastSyncedAt ? `最近同步：${remoteImage.lastSyncedAt}` : '尚未同步');
  $('remoteImageLocalUrl') && ($('remoteImageLocalUrl').textContent = remoteImage.localImageUrl || '尚未生成');

  renderSlideList(config.slideImageUrls || []);
  renderModuleAssignments();
}

function renderSlideList(urls) {
  const slideList = $('slideList');
  if (!Array.isArray(urls) || urls.length === 0) {
    slideList.textContent = '当前未上传图片序列';
    return;
  }

  slideList.innerHTML = urls.map((url, index) => `<div>${index + 1}. ${escapeHtml(url)}</div>`).join('');
}

function collectConfig() {
  const videoUrl = $('videoUrlInput').value.trim() || currentConfig.videoUrl || '';
  const contentImageUrl = $('contentImageUrlInput').value.trim() || currentConfig.contentImageUrl || '';
  const contentType = $('contentType').value;
  const remoteImage = readRemoteImageConfigFromForm(currentConfig);

  return {
    ...currentConfig,
    tickerText: tickerItems.map((item) => item.text).filter(Boolean).join('  |  '),
    tickerItems,
    videoUrl,
    mediaMode: getMediaMode(),
    slideInterval: Math.max(Number($('slideInterval').value) || 5000, 1000),
    contentType,
    contentText: $('contentText').value.trim(),
    contentImageUrl,
    refreshInterval: Number($('refreshInterval').value) || 5000,
    panelAssignments: collectPanelAssignments(),
    remoteImage
  };
}

async function syncRemoteImageNow() {
  const button = $('syncRemoteImageBtn');
  const previousText = button ? button.textContent : '';
  const config = collectConfig();

  if (button) {
    button.disabled = true;
    button.textContent = '正在同步...';
  }
  $('remoteImageStatus') && ($('remoteImageStatus').textContent = '正在登录并获取公告图片，请稍候...');

  try {
    const response = await fetch('/api/remote-image/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await readJsonResponse(response);
    if (!response.ok) throw new Error(result.message || '同步公告图片失败');

    fillForm(result.config || { ...result, remoteImage: config.remoteImage });
    showMessage(result.message || '公告图片同步完成。');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || '立即同步公告图片';
    }
  }
}

async function saveConfig() {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectConfig())
  });

  const result = await readJsonResponse(response);
  if (!response.ok) throw new Error(result.message || '保存失败');
  fillForm(result);
  showMessage('配置已保存，大屏将自动刷新。');
}

async function uploadFile(inputId, url, successText) {
  const fileInput = $(inputId);
  const file = fileInput.files[0];
  if (!file) {
    showMessage('请先选择文件。', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, { method: 'POST', body: formData });
  const result = await readJsonResponse(response);
  if (!response.ok) throw new Error(result.message || '上传失败');

  fillForm(result.config);
  fileInput.value = '';
  showMessage(successText);
}

async function uploadSlides() {
  const fileInput = $('slideFiles');
  const folderInput = $('slideFolder');
  const files = [...Array.from(fileInput.files || []), ...Array.from(folderInput.files || [])]
    .filter((file) => file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name))
    .sort((a, b) => {
      const aPath = a.webkitRelativePath || a.name;
      const bPath = b.webkitRelativePath || b.name;
      return aPath.localeCompare(bPath, 'zh-CN', { numeric: true });
    });

  if (!files.length) {
    showMessage('请先选择多个图片，或选择一个图片文件夹。', true);
    return;
  }

  const formData = new FormData();
  files.forEach((file) => {
    const relativePath = file.webkitRelativePath || file.name;
    formData.append('files', file, relativePath);
  });

  const response = await fetch('/api/upload/slides', { method: 'POST', body: formData });
  const result = await readJsonResponse(response);
  if (!response.ok) throw new Error(result.message || '上传失败');

  fillForm(result.config);
  fileInput.value = '';
  folderInput.value = '';
  showMessage(`图片序列已上传，共 ${result.urls.length} 张，大屏将自动轮播。`);
}

async function applyVideoUrl() {
  const url = $('videoUrlInput').value.trim();
  if (!url) {
    showMessage('请先填写视频链接。', true);
    return;
  }

  currentConfig = { ...currentConfig, mediaMode: 'video', videoUrl: url };
  setMediaMode('video');
  await saveConfig();
  showMessage('视频链接已应用，大屏将自动刷新。');
}

async function applyContentImageUrl() {
  const url = $('contentImageUrlInput').value.trim();
  if (!url) {
    showMessage('请先填写图片链接。', true);
    return;
  }

  currentConfig = { ...currentConfig, contentType: 'image', contentImageUrl: url };
  $('contentType').value = 'image';
  await saveConfig();
  showMessage('图片链接已应用，大屏将自动刷新。');
}

document.querySelectorAll('input[name="mediaMode"]').forEach((input) => {
  input.addEventListener('change', () => {
    currentConfig = { ...currentConfig, mediaMode: getMediaMode() };
    renderModuleAssignments();
  });
});

$('saveBtn').addEventListener('click', () => saveConfig().catch((error) => showMessage(error.message, true)));
$('addTickerBtn').addEventListener('click', () => {
  tickerItems.push({
    id: `ticker-${Date.now()}`,
    text: '新的滚动文字',
    top: 50,
    left: 0,
    fontSize: 42,
    color: '#f3f5f7',
    weight: 700,
    speed: 24,
    direction: 'left',
    enabled: true
  });
  renderTickerEditor();
  renderTickerPreview();
});
$('uploadContentImageBtn').addEventListener('click', () => uploadFile('contentImageFile', '/api/upload/content-image', '展示图片已上传。').catch((error) => showMessage(error.message, true)));
$('uploadVideoBtn').addEventListener('click', () => uploadFile('videoFile', '/api/upload/video', '视频已上传。').catch((error) => showMessage(error.message, true)));
$('uploadSlidesBtn').addEventListener('click', () => uploadSlides().catch((error) => showMessage(error.message, true)));
$('applyContentImageUrlBtn').addEventListener('click', () => applyContentImageUrl().catch((error) => showMessage(error.message, true)));
$('applyVideoUrlBtn').addEventListener('click', () => applyVideoUrl().catch((error) => showMessage(error.message, true)));
$('uploadDeviceImageBtn').addEventListener('click', () => uploadFile('deviceImageFile', '/api/device/image', '设备图片已上传。').catch((error) => showMessage(error.message, true)));
$('syncRemoteImageBtn').addEventListener('click', () => syncRemoteImageNow().catch((error) => showMessage(error.message, true)));

loadConfig().catch((error) => showMessage(error.message, true));
