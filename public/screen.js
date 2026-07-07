const state = {
  refreshTimer: null,
  lastVideoUrl: '',
  lastSlideSignature: '',
  lastRenderSignature: '',
  slideTimer: null,
  slideIndex: 0,
  slideContext: null,
  refreshInterval: 5000
};

const $ = (id) => document.getElementById(id);

function withCacheBuster(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePanel(value) {
  const panel = Math.floor(toNumber(value, 0));
  return panel >= 1 && panel <= 4 ? panel : null;
}

function panelContainer(panel) {
  return $(`panelContent${panel}`);
}

function clearSlideTimer() {
  if (state.slideTimer) {
    clearInterval(state.slideTimer);
    state.slideTimer = null;
  }
  state.slideContext = null;
}

function createEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = text;
  return empty;
}

function ensureStatusLayer() {
  let layer = $('screenStatus');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.id = 'screenStatus';
  layer.style.cssText = [
    'position: fixed',
    'left: 14px',
    'top: 14px',
    'max-width: 72%',
    'padding: 10px 14px',
    'border: 1px solid rgba(240, 180, 45, 0.5)',
    'background: rgba(15, 20, 26, 0.86)',
    'color: #f2f6fa',
    'font-size: 14px',
    'line-height: 1.5',
    'border-radius: 8px',
    'z-index: 9999',
    'display: none'
  ].join(';');

  document.body.appendChild(layer);
  return layer;
}

function showStatus(text, isError = false) {
  const layer = ensureStatusLayer();
  if (!text) {
    layer.style.display = 'none';
    layer.textContent = '';
    return;
  }

  layer.style.display = 'block';
  layer.style.borderColor = isError ? 'rgba(236, 94, 87, 0.6)' : 'rgba(79, 185, 97, 0.6)';
  layer.textContent = text;
}

function requestJson(url, init) {
  if (typeof fetch === 'function') {
    return fetch(url, init);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init && init.method ? init.method : 'GET', url, true);
    xhr.setRequestHeader('Content-Type', init?.headers?.['Content-Type'] || 'application/json');
    xhr.onload = () => {
      const status = xhr.status || 0;
      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (!xhr.responseText) return {};
          return JSON.parse(xhr.responseText);
        }
      });
    };
    xhr.onerror = () => reject(new Error('网络请求失败，请检查服务是否可访问。'));
    xhr.send(init?.body || null);
  });
}

function buildRenderSignature(config) {
  const assignments = getPanelAssignments(config);
  const remoteImage = config.remoteImage && typeof config.remoteImage === 'object'
    ? config.remoteImage
    : {};
  const safeConfig = {
    assignments,
    tickerItems: Array.isArray(config.tickerItems) ? config.tickerItems : [],
    videoUrl: config.videoUrl || '',
    slideImageUrls: Array.isArray(config.slideImageUrls) ? config.slideImageUrls.filter(Boolean) : [],
    slideInterval: Math.max(Number(config.slideInterval) || 5000, 1000),
    contentType: config.contentType || 'text',
    contentText: config.contentText || '',
    contentImageUrl: config.contentImageUrl || '',
    deviceImageUrl: config.deviceImageUrl || '',
    remoteImageUrl: remoteImage.localImageUrl || '',
    remoteImageSyncedAt: remoteImage.lastSyncedAt || ''
  };

  return JSON.stringify(safeConfig);
}

function renderConfigError(message) {
  clearAllPanelContent();
  const text = message || '当前看板无可展示内容';
  for (let panel = 1; panel <= 4; panel += 1) {
    const container = panelContainer(panel);
    if (!container) continue;
    container.appendChild(createEmpty(text));
  }
  showStatus(message, true);
}

function showSlide(container, counter, slides) {
  const safeSlides = Array.isArray(slides) ? slides : [];
  if (!safeSlides.length) return;
  const safeIndex = Math.min(Math.max(state.slideIndex, 0), safeSlides.length - 1);
  container.src = withCacheBuster(safeSlides[safeIndex]);
  counter.textContent = `${safeIndex + 1} / ${safeSlides.length}`;
}

function updateSlideTimer() {
  if (!state.slideContext) return;

  const { slideEl, counterEl, slides } = state.slideContext;
  if (!slides.length) return;

  state.slideIndex = (state.slideIndex + 1) % slides.length;
  showSlide(slideEl, counterEl, slides);
}

function renderTickerModule(config = {}) {
  const stage = document.createElement('div');
  stage.className = 'ticker-stage';

  const items = Array.isArray(config.tickerItems) && config.tickerItems.length
    ? config.tickerItems
    : [{
      text: config.tickerText || '暂无滚动文字',
      top: 48,
      left: 0,
      fontSize: 54,
      color: '#f3f5f7',
      weight: 700,
      speed: 22,
      direction: 'left',
      enabled: true
    }];

  const enabledItems = items.filter((item) => item.enabled !== false && item.text);

  if (!enabledItems.length) {
    stage.appendChild(createEmpty('暂无滚动文字'));
    return stage;
  }

  enabledItems.forEach((item) => {
    const el = document.createElement('div');
    const direction = ['left', 'right', 'static'].includes(item.direction) ? item.direction : 'left';
    const speed = Math.min(Math.max(toNumber(item.speed, 22), 0), 90);
    const left = Math.min(Math.max(toNumber(item.left, 0), 0), 100);
    const isStatic = direction === 'static' || speed === 0;

    el.className = `ticker-item direction-${isStatic ? 'static' : direction}`;
    el.textContent = item.text;
    el.style.top = `${Math.min(Math.max(toNumber(item.top, 50), 8), 90)}%`;
    el.style.left = `${left}%`;
    el.style.setProperty('--ticker-start-left', `${left}%`);
    el.style.fontSize = `${Math.min(Math.max(toNumber(item.fontSize, 48), 16), 120)}px`;
    el.style.color = item.color || '#f3f5f7';
    el.style.fontWeight = String(toNumber(item.weight, 700));

    if (!isStatic) {
      el.style.animationDuration = `${speed}s`;
    }

    stage.appendChild(el);
  });

  return stage;
}

function renderMediaVideo(container, config) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:100%;height:100%;position:relative;';

  const empty = createEmpty('请在管理页面上传视频');
  wrapper.appendChild(empty);

  const video = document.createElement('video');
  video.className = 'video-player';
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.controls = true;
  video.playsInline = true;
  wrapper.appendChild(video);

  if (!config.videoUrl) {
    state.lastVideoUrl = '';
    video.style.display = 'none';
    return wrapper;
  }

  empty.style.display = 'none';
  const url = withCacheBuster(config.videoUrl);
  if (state.lastVideoUrl !== config.videoUrl) {
    state.lastVideoUrl = config.videoUrl;
    video.src = url;
    video.load();
  } else {
    video.src = url;
  }
  video.play().catch(() => {});

  return wrapper;
}

function renderMediaSlides(container, config) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:100%;height:100%;position:relative;';

  const slides = Array.isArray(config.slideImageUrls)
    ? config.slideImageUrls.filter(Boolean)
    : [];

  const interval = Math.max(Number(config.slideInterval) || 5000, 1000);
  const empty = createEmpty('请在管理页面上传图片序列');
  const slide = document.createElement('img');
  const counter = document.createElement('div');

  counter.className = 'slide-counter';
  slide.className = 'slide-player';
  counter.style.display = 'none';
  wrapper.appendChild(empty);
  wrapper.appendChild(slide);
  wrapper.appendChild(counter);

  if (!slides.length) {
    clearSlideTimer();
    state.lastSlideSignature = '';
    state.slideIndex = 0;
    state.lastVideoUrl = '';
    slide.style.display = 'none';
    counter.style.display = 'none';
    slide.src = '';
    return wrapper;
  }

  const signature = JSON.stringify({ slides, interval });
  const shouldReset = signature !== state.lastSlideSignature;

  empty.style.display = 'none';
  counter.style.display = 'block';
  slide.style.display = 'block';

  state.slideContext = {
    slideEl: slide,
    counterEl: counter,
    slides,
    interval
  };

  if (shouldReset) {
    state.lastSlideSignature = signature;
    state.slideIndex = 0;
    clearSlideTimer();
    state.slideContext = {
      slideEl: slide,
      counterEl: counter,
      slides,
      interval
    };
    state.slideTimer = setInterval(updateSlideTimer, interval);
    showSlide(slide, counter, slides);
    return wrapper;
  }

  state.slideContext = {
    slideEl: slide,
    counterEl: counter,
    slides,
    interval
  };

  if (!state.slideTimer) {
    state.slideIndex = 0;
    state.slideTimer = setInterval(updateSlideTimer, interval);
  }

  showSlide(slide, counter, slides);

  return wrapper;
}

function renderContentModule(container, config) {
  if (config.contentType === 'image' && config.contentImageUrl) {
    const image = document.createElement('img');
    image.className = 'content-image';
    image.alt = '上传内容图片';
    image.src = withCacheBuster(config.contentImageUrl);
    return image;
  }

  const text = document.createElement('div');
  text.className = 'content-text';
  text.textContent = config.contentText || '暂无展示内容';
  return text;
}

function renderDeviceModule(config) {
  const wrapper = document.createElement('div');
  const image = document.createElement('img');
  image.className = 'device-image';
  image.alt = '设备最新图像';

  if (!config.deviceImageUrl) {
    wrapper.appendChild(createEmpty('等待设备上传图片'));
    return wrapper;
  }

  image.src = withCacheBuster(config.deviceImageUrl);
  image.onerror = () => {
    wrapper.innerHTML = '';
    wrapper.appendChild(createEmpty('设备图片加载失败'));
  };
  wrapper.appendChild(image);
  return wrapper;
}

function renderRemoteImageModule(config = {}) {
  const wrapper = document.createElement('div');
  const remoteImageUrl = config.remoteImage && config.remoteImage.localImageUrl ? config.remoteImage.localImageUrl : '';

  if (!remoteImageUrl) {
    wrapper.appendChild(createEmpty('远程图片未同步或未配置'));
    return wrapper;
  }

  const image = document.createElement('img');
  image.className = 'content-image';
  image.alt = '远程抓取图片';
  image.src = withCacheBuster(remoteImageUrl);
  image.onerror = () => {
    wrapper.innerHTML = '';
    wrapper.appendChild(createEmpty('远程图片加载失败'));
  };
  wrapper.appendChild(image);
  return wrapper;
}

function getPanelAssignments(config) {
  const assignments = config.panelAssignments || {};

  const panelByModule = {
    ticker: normalizePanel(assignments.ticker),
    mediaVideo: normalizePanel(assignments.mediaVideo),
    mediaSlides: normalizePanel(assignments.mediaSlides),
    content: normalizePanel(assignments.content),
    device: normalizePanel(assignments.device),
    remoteImage: normalizePanel(assignments.remoteImage)
  };

  return panelByModule;
}

function clearAllPanelContent() {
  for (let i = 1; i <= 4; i += 1) {
    const container = panelContainer(i);
    if (container) {
      container.innerHTML = '';
    }
  }
}

function renderScreen(config) {
  const assignments = getPanelAssignments(config);
  const hasVideoModule = assignments.mediaVideo;
  const hasSlideModule = assignments.mediaSlides;

  const moduleDefs = [
    {
      key: 'ticker',
      render: (container) => {
        container.appendChild(renderTickerModule(config));
      }
    },
    {
      key: 'mediaVideo',
      render: (container) => {
        container.appendChild(renderMediaVideo(container, config));
      }
    },
    {
      key: 'mediaSlides',
      render: (container) => {
        container.appendChild(renderMediaSlides(container, config));
      }
    },
    {
      key: 'content',
      render: (container) => {
        container.appendChild(renderContentModule(container, config));
      }
    },
    {
      key: 'device',
      render: (container) => {
        container.appendChild(renderDeviceModule(config));
      }
    },
    {
      key: 'remoteImage',
      render: (container) => {
        container.appendChild(renderRemoteImageModule(config));
      }
    }
  ];

  const panelToRenderer = {};
  const usedPanel = new Set();

  moduleDefs.forEach((item) => {
    const target = assignments[item.key];
    if (!target || usedPanel.has(target)) return;
    panelToRenderer[target] = item.render;
    usedPanel.add(target);
  });

  clearAllPanelContent();

  for (let panel = 1; panel <= 4; panel += 1) {
    const container = panelContainer(panel);
    if (!container) continue;

    if (panelToRenderer[panel]) {
      panelToRenderer[panel](container);
      continue;
    }

      container.appendChild(createEmpty('该看板未分配内容模块'));
  }

  if (!hasVideoModule) {
    state.lastVideoUrl = '';
  }

  if (!hasSlideModule) {
    clearSlideTimer();
    state.lastSlideSignature = '';
    state.slideIndex = 0;
  }
}

function setRefreshInterval(ms) {
  const next = Math.max(Number(ms) || 5000, 1000);
  if (next === state.refreshInterval) return;
  state.refreshInterval = next;
  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(loadConfig, state.refreshInterval);
}

async function loadConfig() {
  try {
    const response = await requestJson('/api/config', { cache: 'no-store' });
    if (!response || !response.ok) {
      const msg = `配置接口异常，状态码：${response?.status || '未知'}`;
      throw new Error(msg);
    }

    const config = await response.json();
    if (!config || typeof config !== 'object') {
      throw new Error('返回配置不是合法的对象。');
    }

    const nextSignature = buildRenderSignature(config);
    if (state.lastRenderSignature !== nextSignature) {
      renderScreen(config);
      state.lastRenderSignature = nextSignature;
    }

    showStatus('');
    setRefreshInterval(config.refreshInterval || 5000);
  } catch (error) {
    console.error('loadConfig 失败', error);
    renderConfigError(error.message || '加载配置失败');
  }
}

loadConfig();
state.refreshTimer = setInterval(loadConfig, state.refreshInterval);
