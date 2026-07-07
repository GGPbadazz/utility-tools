const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const { spawn } = require('child_process');
const {
  cleanupAfterFailedSync,
  formatCleanupSummary
} = require('./scripts/bulletin-retention');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const SLIDES_DIR = path.join(UPLOADS_DIR, 'slides');
const BULLETIN_DIR = path.join(UPLOADS_DIR, 'device', 'bulletin');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const BULLETIN_SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'fetch-bulletin-image.js');

function loadDotEnv(filePath) {
  if (!fss.existsSync(filePath)) return;
  const raw = fss.readFileSync(filePath, 'utf-8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  });
}

loadDotEnv(ENV_PATH);

const app = express();
const PORT = process.env.PORT || 18765;

function getBulletinLatestName() {
  return process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png';
}

function getBulletinLedName() {
  return process.env.BULLETIN_LED_NAME || 'latest-bulletin-led.png';
}

function getBulletinDataName() {
  return process.env.BULLETIN_DATA_NAME || 'latest-bulletin-data.json';
}

function getBulletinLocalImageUrl() {
  return `/uploads/device/bulletin/${getBulletinLatestName()}`;
}
const DEFAULT_PANEL_ASSIGNMENTS = {
  ticker: 1,
  mediaVideo: 2,
  mediaSlides: null,
  content: 3,
  device: 4,
  remoteImage: null
};

const DEFAULT_REMOTE_IMAGE = {
  enabled: false,
  loginUrl: process.env.BULLETIN_LOGIN_URL || '',
  loginMethod: 'POST',
  usernameField: 'username',
  passwordField: 'password',
  username: process.env.BULLETIN_USERNAME || '',
  password: process.env.BULLETIN_PASSWORD || '',
  sourceUrl: process.env.BULLETIN_LIST_URL || '',
  targetLinkContains: process.env.BULLETIN_BUTTON_TEXT || '公告图片下载',
  targetPageUrl: '',
  imageUrlKeyword: process.env.BULLETIN_BOARD_URL_CONTAINS || 'board-iframe',
  syncIntervalMinutes: 1440,
  localImageUrl: '',
  lastSyncedAt: ''
};

const defaultConfig = {
  tickerText: '欢迎使用滚动大屏系统，请在管理页面编辑这段滚动文字。',
  tickerItems: [
    {
      id: 'ticker-default-1',
      text: '欢迎使用滚动大屏系统，请在管理页面编辑这段滚动文字。',
      top: 48,
      left: 0,
      fontSize: 54,
      color: '#f3f5f7',
      weight: 700,
      speed: 22,
      direction: 'left',
      enabled: true
    }
  ],
  mediaMode: 'video',
  videoUrl: '',
  slideImageUrls: [],
  slideInterval: 5000,
  contentType: 'text',
  contentText: '这里显示远程编辑的文字内容，也可以切换为上传图片。',
  contentImageUrl: '',
  deviceImageUrl: '/uploads/device-latest.jpg',
  refreshInterval: 5000,
  remoteImage: DEFAULT_REMOTE_IMAGE,
  panelAssignments: DEFAULT_PANEL_ASSIGNMENTS
};

let remoteImageSyncTimer = null;
let remoteImageSyncing = false;

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRemoteImageConfig(raw = {}) {
  const candidate = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: candidate.enabled === true,
    loginUrl: trimString(candidate.loginUrl || process.env.BULLETIN_LOGIN_URL || DEFAULT_REMOTE_IMAGE.loginUrl),
    loginMethod: String(candidate.loginMethod || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
    usernameField: trimString(candidate.usernameField || DEFAULT_REMOTE_IMAGE.usernameField) || 'username',
    passwordField: trimString(candidate.passwordField || DEFAULT_REMOTE_IMAGE.passwordField) || 'password',
    username: trimString(candidate.username || process.env.BULLETIN_USERNAME),
    password: trimString(candidate.password || process.env.BULLETIN_PASSWORD),
    sourceUrl: trimString(candidate.sourceUrl || process.env.BULLETIN_LIST_URL || DEFAULT_REMOTE_IMAGE.sourceUrl),
    targetLinkContains: trimString(candidate.targetLinkContains || DEFAULT_REMOTE_IMAGE.targetLinkContains),
    targetPageUrl: trimString(candidate.targetPageUrl),
    imageUrlKeyword: trimString(candidate.imageUrlKeyword || DEFAULT_REMOTE_IMAGE.imageUrlKeyword),
    syncIntervalMinutes: Math.max(Math.floor(Number(candidate.syncIntervalMinutes) || 0), 1),
    localImageUrl: trimString(candidate.localImageUrl),
    lastSyncedAt: trimString(candidate.lastSyncedAt)
  };
}

function parseCookieHeaders(headers) {
  const rawCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.raw ? headers.raw()['set-cookie'] : []);
  if (!rawCookies) return {};

  const next = {};
  rawCookies.forEach((cookie) => {
    const pair = String(cookie).split(';')[0];
    const idx = pair.indexOf('=');
    if (idx <= 0) return;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    next[name] = value;
  });
  return next;
}

function mergeCookieJar(existing, incoming) {
  return { ...(existing || {}), ...(incoming || {}) };
}

function toCookieHeader(jar) {
  return Object.entries(jar || {})
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function resolveAbsoluteUrl(base, target) {
  if (!target) return '';
  try {
    const next = new URL(target, base);
    return next.toString();
  } catch {
    return target;
  }
}

function hasKeyword(text, keyword) {
  if (!keyword) return true;
  return String(text).toLowerCase().includes(keyword.toLowerCase());
}

function cleanHtmlText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBestImageUrl(html, baseUrl, keyword) {
  const htmlText = String(html || '');
  const candidates = [];
  const regex = /<(?:img|source)\s+[^>]*?(?:src|data-src|srcset)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(htmlText)) !== null) {
    const candidate = match[1].split(',')[0].trim();
    if (!candidate || /^(data:|javascript:)/i.test(candidate)) continue;
    if (candidate.toLowerCase().endsWith('.svg')) continue;
    candidates.push(candidate);
  }

  if (!candidates.length) return '';

  const filtered = keyword
    ? candidates.filter((src) => hasKeyword(src, keyword))
    : candidates;
  const list = filtered.length ? filtered : candidates;

  for (const src of list) {
    const absolute = resolveAbsoluteUrl(baseUrl, src);
    if (absolute.match(/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i)) {
      return absolute;
    }
  }

  return resolveAbsoluteUrl(baseUrl, list[0]);
}

function pickTargetLink(html, baseUrl, keyword) {
  const htmlText = String(html || '');
  const normalized = keyword.toLowerCase();
  const candidates = [];
  const regex = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(htmlText)) !== null) {
    const href = match[1];
    const label = cleanHtmlText(match[2]).toLowerCase();
    candidates.push({ href, label });
  }

  if (!candidates.length) return '';
  if (!normalized) return resolveAbsoluteUrl(baseUrl, candidates[0].href);

  const withHit = candidates.find(({ href, label }) => hasKeyword(href, normalized) || hasKeyword(label, normalized));
  return resolveAbsoluteUrl(baseUrl, withHit ? withHit.href : candidates[0].href);
}

function detectFileExtension(url, contentType, fallback = '.jpg') {
  const extFromUrl = String(url || '').match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
  if (extFromUrl) return `.${extFromUrl[1].toLowerCase()}`;
  if (typeof contentType === 'string') {
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('gif')) return '.gif';
    if (contentType.includes('webp')) return '.webp';
  }
  return fallback;
}

async function fetchWithCookies(url, options = {}, cookieJar = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (RollingScreenBot)',
    ...options.headers
  };

  const cookieHeader = toCookieHeader(cookieJar);
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(url, { ...options, headers });
  const nextJar = mergeCookieJar(cookieJar, parseCookieHeaders(response.headers));
  return { response, cookieJar: nextJar };
}

async function syncRemoteImageFromConfig(rawConfig) {
  const config = normalizeRemoteImageConfig(rawConfig);
  if (!config.enabled) {
    return { updated: false, message: '远程图片模块未启用。', localImageUrl: config.localImageUrl };
  }

  if (!config.username || !config.password) {
    return { updated: false, message: '请先填写远程站点账号和密码。', localImageUrl: config.localImageUrl };
  }

  if (!config.loginUrl || !config.sourceUrl) {
    return { updated: false, message: '请先填写远程站点登录页和列表页地址。', localImageUrl: config.localImageUrl };
  }

  if (remoteImageSyncing) {
    return { updated: false, message: '正在同步中，稍后再试。', localImageUrl: config.localImageUrl };
  }

  remoteImageSyncing = true;
  try {
    const output = await runBulletinImageScript(config);

    return {
      updated: true,
      message: '公告图片同步成功。',
      localImageUrl: getBulletinLocalImageUrl(),
      output
    };
  } catch (error) {
    try {
      const cleanupResult = await cleanupAfterFailedSync({
        outputDir: BULLETIN_DIR,
        latestName: getBulletinLatestName(),
        ledName: getBulletinLedName(),
        dataName: getBulletinDataName(),
        targetDate: getShanghaiDateString()
      });
      console.warn(`公告图片同步失败，已尝试回退昨日公告：${formatCleanupSummary(cleanupResult)}`);
    } catch (cleanupError) {
      console.warn(`公告图片同步失败，回退昨日公告也失败：${cleanupError.message}`);
    }
    throw error;
  } finally {
    remoteImageSyncing = false;
  }
}

function runBulletinImageScript(config) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BULLETIN_SCRIPT_PATH], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        BULLETIN_USERNAME: config.username,
        BULLETIN_PASSWORD: config.password,
        BULLETIN_LOGIN_URL: config.loginUrl || DEFAULT_REMOTE_IMAGE.loginUrl,
        BULLETIN_LIST_URL: config.sourceUrl || DEFAULT_REMOTE_IMAGE.sourceUrl,
        BULLETIN_BROWSER_CHANNEL: process.env.BULLETIN_BROWSER_CHANNEL || 'chromium',
        BULLETIN_OUTPUT_DIR: process.env.BULLETIN_OUTPUT_DIR || 'uploads/device/bulletin',
        BULLETIN_LATEST_NAME: process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png',
        BULLETIN_BOARD_COLOR: process.env.BULLETIN_BOARD_COLOR || '1'
      }
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('公告图片同步超时，请稍后重试或检查网站是否可访问。'));
    }, 120000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const details = (stderr || stdout || '').replace(/\s+/g, ' ').trim();
      reject(new Error(details || `公告图片同步失败，脚本退出码：${code}`));
    });
  });
}

async function syncRemoteImageNow(remoteConfigOverride = null) {
  const config = await readConfig();
  const remoteCfg = normalizeRemoteImageConfig(remoteConfigOverride || config.remoteImage);
  const result = await syncRemoteImageFromConfig(remoteCfg);

  if (!result.updated) {
    return { ...result, config };
  }

  const nextConfig = {
    ...config,
    remoteImage: {
      ...config.remoteImage,
      ...remoteCfg,
      localImageUrl: result.localImageUrl,
      lastSyncedAt: new Date().toISOString()
    }
  };

  const saved = await writeConfig(nextConfig);
  return { ...result, config: saved };
}

async function scheduleRemoteImageSync() {
  if (remoteImageSyncTimer) {
    clearInterval(remoteImageSyncTimer);
    remoteImageSyncTimer = null;
  }
  // Daily automation is handled by scripts/fetch-bulletin-daily.js via launchd.
  // The server keeps only the manual "立即同步公告图片" endpoint.
}

function getShanghaiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: Number(get('hour')),
    minute: Number(get('minute'))
  };
}

function getShanghaiDateString(date = new Date()) {
  const parts = getShanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isAfterDailyBulletinTime(date = new Date()) {
  const parts = getShanghaiParts(date);
  const hour = Math.max(Math.floor(Number(process.env.BULLETIN_DAILY_HOUR || 10)), 0);
  const minute = Math.max(Math.floor(Number(process.env.BULLETIN_DAILY_MINUTE || 0)), 0);

  return parts.hour > hour || (parts.hour === hour && parts.minute >= minute);
}

function isSyncedToday(lastSyncedAt, today = getShanghaiDateString()) {
  if (!lastSyncedAt) return false;
  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return false;
  return getShanghaiDateString(date) === today;
}

async function hasTodayBulletinFile(today = getShanghaiDateString()) {
  const outputDir = path.resolve(ROOT_DIR, process.env.BULLETIN_OUTPUT_DIR || 'uploads/device/bulletin');
  try {
    const entries = await fs.readdir(outputDir);
    return entries.some((filename) => new RegExp(`^bulletin-${today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[^.]+$`).test(filename));
  } catch {
    return false;
  }
}

async function maybeSyncBulletinOnServerStart() {
  const config = await readConfig();
  const remote = normalizeRemoteImageConfig(config.remoteImage);
  if (!remote.enabled) return;
  if (!isAfterDailyBulletinTime()) return;

  const today = getShanghaiDateString();
  const syncedToday = isSyncedToday(remote.lastSyncedAt, today);
  const hasTodayFile = await hasTodayBulletinFile(today);
  if (syncedToday && hasTodayFile) {
    console.log(`今日公告图片已同步，启动时不重复获取：${today}`);
    return;
  }

  console.log(`服务启动时检测到今日公告图片未更新，开始补偿同步：${today}`);
  try {
    const result = await syncRemoteImageNow(remote);
    console.log(result.message || '启动补偿同步完成。');
  } catch (error) {
    console.error('启动补偿同步失败：', error);
  }
}

function normalizePanelNumber(value) {
  const panel = Number(value);
  return [1, 2, 3, 4].includes(panel) ? panel : null;
}

function normalizePanelAssignments(rawAssignments = {}) {
  const merged = {
    ...DEFAULT_PANEL_ASSIGNMENTS,
    ...(rawAssignments || {})
  };

  const next = {};
  const used = new Set();

  Object.entries(merged).forEach(([moduleId, panelValue]) => {
    const panel = normalizePanelNumber(panelValue);
    if (!panel || used.has(panel)) {
      next[moduleId] = null;
      return;
    }
    used.add(panel);
    next[moduleId] = panel;
  });

  return next;
}

async function ensureBaseFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(SLIDES_DIR, { recursive: true });
  await fs.mkdir(BULLETIN_DIR, { recursive: true });

  if (!fss.existsSync(CONFIG_PATH)) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }
}

async function readConfig() {
  await ensureBaseFiles();
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const merged = { ...defaultConfig, ...parsed, remoteImage: normalizeRemoteImageConfig(parsed.remoteImage) };
  merged.panelAssignments = normalizePanelAssignments(merged.panelAssignments);
  if (!Array.isArray(merged.tickerItems) || merged.tickerItems.length === 0) {
    merged.tickerItems = [
      {
        ...defaultConfig.tickerItems[0],
        text: merged.tickerText || defaultConfig.tickerText
      }
    ];
  }
  return merged;
}

async function writeConfig(nextConfig) {
  const safeConfig = {
    ...defaultConfig,
    ...nextConfig,
    mediaMode: nextConfig.mediaMode === 'slides' ? 'slides' : 'video',
    remoteImage: normalizeRemoteImageConfig(nextConfig.remoteImage),
    panelAssignments: normalizePanelAssignments(nextConfig.panelAssignments),
    slideImageUrls: Array.isArray(nextConfig.slideImageUrls) ? nextConfig.slideImageUrls : [],
    slideInterval: Math.max(Number(nextConfig.slideInterval) || 5000, 1000),
    refreshInterval: Math.max(Number(nextConfig.refreshInterval) || 5000, 1000)
  };

  await fs.writeFile(CONFIG_PATH, JSON.stringify(safeConfig, null, 2), 'utf-8');
  await scheduleRemoteImageSync();
  return safeConfig;
}

function createStorage(prefix) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `${prefix}-${Date.now()}${ext}`);
    }
  });
}

const contentImageUpload = multer({
  storage: createStorage('content'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

const videoUpload = multer({
  storage: createStorage('video'),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('video/'))
});

const slideUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SLIDES_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.jpg');
      cb(null, `slide-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 200 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

const deviceImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `device-latest${path.extname(file.originalname || '.jpg')}`)
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

function setNoCacheHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function readLatestBulletinData() {
  const dataPath = path.join(BULLETIN_DIR, getBulletinDataName());
  const fallback = {
    date: getShanghaiDateString(),
    companyName: '示例企业有限公司',
    riskLevel: '低风险',
    riskCode: 4,
    riskImageUrl: '/assets/risk-legend-4.png',
    riskLegendUrl: '/assets/risk-legend-text.png',
    deviceStatus: {
      total: null,
      running: null,
      stopped: null,
      lines: []
    },
    promiseText: '公告数据尚未生成，请先执行一次公告图片同步。',
    warningText: '',
    responsible: ''
  };

  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function verticalLabelHtml(text) {
  return String(text || '')
    .split('')
    .map((char) => `<span>${escapeHtml(char)}</span>`)
    .join('');
}

function visualCharWidth(char) {
  return /^[\x00-\x7F]$/.test(char) ? 0.56 : 1;
}

function wrapLedLines(text, maxWidth = 16, maxLines = 4) {
  const clean = String(text || '').replace(/\s+/g, '');
  const lines = [];
  let line = '';
  let width = 0;

  for (const char of clean) {
    const charWidth = visualCharWidth(char);
    if (line && width + charWidth > maxWidth) {
      lines.push(line);
      line = '';
      width = 0;
      if (lines.length >= maxLines) break;
    }

    line += char;
    width += charWidth;
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (lines.length === maxLines && clean.length > lines.join('').length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  }

  return lines;
}

function wrapLedLineList(lines, maxWidth = 16, maxLines = 4) {
  const output = [];

  for (const line of lines || []) {
    if (output.length >= maxLines) break;
    output.push(...wrapLedLines(line, maxWidth, maxLines - output.length));
  }

  return output;
}

function renderLedTestHtml(data) {
  const device = data.deviceStatus && typeof data.deviceStatus === 'object' ? data.deviceStatus : {};
  const statusLines = Array.isArray(device.lines) && device.lines.length
    ? device.lines
    : [
      device.total != null ? `生产装置${device.total}套` : '',
      device.running != null ? `运行装置${device.running}套` : '',
      device.stopped != null ? `停产装置${device.stopped}套` : ''
    ].filter(Boolean);

  const riskCode = Number(data.riskCode) >= 1 && Number(data.riskCode) <= 4 ? Number(data.riskCode) : 4;
  const riskImageUrl = data.riskImageUrl || `/assets/risk-legend-${riskCode}.png`;
  const riskLegendUrl = data.riskLegendUrl || '/assets/risk-legend-text.png';
  const responsible = data.responsible ? `负责人：${data.responsible}` : '';
  const promiseText = String(data.promiseText || '')
    .replace(/^企业承诺\s*/, '')
    .trim();
  const warningText = String(data.warningText || '').trim();
  const statusDisplayLines = wrapLedLineList(statusLines, 16, 6);
  const promiseLines = wrapLedLines(promiseText, 17, 4);
  const warningLines = wrapLedLines(warningText, 17, 6);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="300">
  <meta name="viewport" content="width=384,height=192,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>LED Bulletin Test</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #050607;
      color: #f7f7f7;
      font-family: Arial, "Microsoft YaHei", sans-serif;
    }
    .page {
      width: 384px;
      height: 192px;
      background: #050607;
    }
    .title {
      height: 20px;
      line-height: 19px;
      overflow: hidden;
      border: 1px solid #555;
      border-bottom: 0;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    .board {
      position: relative;
      width: 384px;
      height: 172px;
    }
    .cell {
      position: absolute;
      width: 192px;
      height: 86px;
      min-width: 0;
      min-height: 0;
      background: #0b0d0f;
      border: 1px solid #555;
    }
    .c1 { left: 0; top: 0; }
    .c2 { left: 192px; top: 0; }
    .c3 { left: 0; top: 86px; }
    .c4 { left: 192px; top: 86px; }
    .content {
      position: absolute;
      left: 19px;
      top: 0;
      right: 0;
      bottom: 0;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .label {
      position: absolute;
      left: 0;
      top: 0;
      width: 19px;
      height: 84px;
      padding-top: 20px;
      gap: 1px;
      min-width: 0;
      min-height: 0;
      border-right: 1px solid #555;
      color: #f7f7f7;
      font-size: 11px;
      line-height: 1;
      font-weight: 700;
      text-align: center;
    }
    .label span {
      display: block;
      height: 11px;
    }
    .label.long {
      padding-top: 2px;
      font-size: 9px;
    }
    .label.long span {
      height: 9px;
    }
    .status {
      padding: 4px 6px;
      font-size: 9px;
      line-height: 12px;
      font-weight: 700;
    }
    .status-line {
      height: 12px;
      overflow: hidden;
      white-space: nowrap;
    }
    .risk {
      position: absolute;
      left: 19px;
      top: 0;
      right: 0;
      bottom: 0;
    }
    .risk-main {
      position: absolute;
      left: 6px;
      top: 17px;
      width: 96px;
      height: auto;
      image-rendering: auto;
    }
    .risk-legend {
      position: absolute;
      right: 9px;
      top: 13px;
      width: 42px;
      height: auto;
    }
    .promise {
      position: relative;
      height: 100%;
      padding: 6px 6px;
      font-size: 9px;
      line-height: 11px;
      font-weight: 700;
    }
    .promise-text {
      overflow: hidden;
    }
    .promise-line {
      height: 11px;
      overflow: hidden;
      white-space: nowrap;
    }
    .promise-meta {
      position: absolute;
      left: 48px;
      bottom: 6px;
      width: 96px;
      text-align: right;
      font-size: 9px;
      line-height: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .empty {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">${escapeHtml(data.companyName)}</div>
    <div class="board">
      <div class="cell c1">
        <div class="label">${verticalLabelHtml('企业状态')}</div>
        <div class="content status">${statusDisplayLines.map((line) => `<div class="status-line">${escapeHtml(line)}</div>`).join('')}</div>
      </div>
      <div class="cell c2">
        <div class="label">${verticalLabelHtml('风险等级')}</div>
        <div class="content risk">
          <img class="risk-main" src="${escapeHtml(riskImageUrl)}" alt="">
          <img class="risk-legend" src="${escapeHtml(riskLegendUrl)}" alt="">
        </div>
      </div>
      <div class="cell c3">
        <div class="label long">${verticalLabelHtml('风险提示及事故警示')}</div>
        <div class="content">${warningLines.length ? `<div class="promise">${warningLines.map((line) => `<div class="promise-line">${escapeHtml(line)}</div>`).join('')}</div>` : '<div class="empty"></div>'}</div>
      </div>
      <div class="cell c4">
        <div class="label">${verticalLabelHtml('企业承诺')}</div>
        <div class="content promise">
          <div class="promise-text">${promiseLines.map((line) => `<div class="promise-line">${escapeHtml(line)}</div>`).join('')}</div>
          <div class="promise-meta">
            <div>${escapeHtml(responsible)}</div>
            <div>${escapeHtml(data.date)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.use(express.json({ limit: '2mb' }));
app.use('/uploads/device/bulletin', (req, res, next) => {
  const filename = path.basename(req.path || '');
  if ([getBulletinLatestName(), getBulletinLedName(), getBulletinDataName()].includes(filename)) {
    setNoCacheHeaders(res);
  }
  next();
});
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(ROOT_DIR, 'public')));

app.get('/', (_req, res) => res.redirect('/screen'));
app.get('/screen', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'public', 'screen.html')));
app.get(['/led', '/led-bulletin'], (_req, res) => {
  setNoCacheHeaders(res);
  res.sendFile(path.join(ROOT_DIR, 'public', 'led-bulletin.html'));
});
app.get('/led-test', async (_req, res, next) => {
  try {
    setNoCacheHeaders(res);
    res.type('html').send(renderLedTestHtml(await readLatestBulletinData()));
  } catch (error) {
    next(error);
  }
});
app.get('/led-bulletin.png', (_req, res) => {
  setNoCacheHeaders(res);

  const candidates = [
    path.join(BULLETIN_DIR, getBulletinLedName()),
    path.join(BULLETIN_DIR, getBulletinLatestName())
  ];
  const imagePath = candidates.find((candidate) => fss.existsSync(candidate));

  if (!imagePath) {
    res.status(404).type('text/plain').send('Bulletin image is not ready.');
    return;
  }

  res.type(path.extname(imagePath) || '.png');
  res.sendFile(imagePath);
});
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'public', 'admin.html')));

app.get('/api/config', async (_req, res, next) => {
  try {
    res.json(await readConfig());
  } catch (error) {
    next(error);
  }
});

app.post('/api/config', async (req, res, next) => {
  try {
    res.json(await writeConfig(req.body));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upload/content-image', contentImageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传图片文件' });
    const config = await readConfig();
    const fileUrl = `/uploads/${req.file.filename}`;
    const nextConfig = await writeConfig({ ...config, contentType: 'image', contentImageUrl: fileUrl });
    res.json({ url: fileUrl, config: nextConfig });
  } catch (error) {
    next(error);
  }
});

app.post('/api/upload/video', videoUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传视频文件' });
    const config = await readConfig();
    const fileUrl = `/uploads/${req.file.filename}`;
    const nextConfig = await writeConfig({ ...config, mediaMode: 'video', videoUrl: fileUrl });
    res.json({ url: fileUrl, config: nextConfig });
  } catch (error) {
    next(error);
  }
});

app.post('/api/upload/slides', slideUpload.array('files', 200), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: '请上传图片文件' });
    const config = await readConfig();
    const fileUrls = req.files
      .sort((a, b) => (a.originalname || '').localeCompare(b.originalname || '', 'zh-CN', { numeric: true }))
      .map((file) => `/uploads/slides/${file.filename}`);
    const nextConfig = await writeConfig({
      ...config,
      mediaMode: 'slides',
      slideImageUrls: fileUrls,
      slideInterval: Math.max(Number(config.slideInterval) || 5000, 1000)
    });
    res.json({ urls: fileUrls, config: nextConfig });
  } catch (error) {
    next(error);
  }
});

app.post('/api/device/image', deviceImageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传设备图片文件' });
    const fileUrl = `/uploads/${req.file.filename}`;
    const config = await readConfig();
    const nextConfig = await writeConfig({ ...config, deviceImageUrl: fileUrl });
    res.json({ url: fileUrl, config: nextConfig });
  } catch (error) {
    next(error);
  }
});

app.post('/api/remote-image/sync', async (req, res, next) => {
  try {
    const remoteImage = req.body && req.body.remoteImage ? req.body.remoteImage : null;
    const baseConfig = remoteImage ? await readConfig() : null;
    const normalizedRemote = remoteImage ? normalizeRemoteImageConfig(remoteImage) : null;
    if (baseConfig && normalizedRemote) {
      await writeConfig({
        ...baseConfig,
        remoteImage: {
          ...baseConfig.remoteImage,
          ...normalizedRemote
        }
      });
    }

    const result = await syncRemoteImageNow(remoteImage);
    if (!result.config && baseConfig && normalizedRemote) {
      result.config = await writeConfig({
        ...baseConfig,
        remoteImage: {
          ...baseConfig.remoteImage,
          ...normalizedRemote
        }
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: `接口不存在：${req.method} ${req.originalUrl}。如果刚更新过代码，请重启服务。` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 400 : 500;
  const messageMap = {
    LIMIT_FILE_SIZE: '上传文件过大，请压缩图片或减少单个文件大小。',
    LIMIT_FILE_COUNT: '上传图片数量过多，请减少图片数量后重试。'
  };
  res.status(status).json({ message: messageMap[error.code] || error.message || '服务器内部错误' });
});

ensureBaseFiles().then(() => {
  scheduleRemoteImageSync().catch((error) => {
    console.error('启动远程图片同步计划失败：', error);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`滚动大屏服务已启动：http://localhost:${PORT}`);
    console.log(`大屏页面：http://localhost:${PORT}/screen`);
    console.log(`小屏页面：http://localhost:${PORT}/led`);
    console.log(`管理页面：http://localhost:${PORT}/admin`);
    maybeSyncBulletinOnServerStart().catch((error) => {
      console.error('启动公告图片补偿检查失败：', error);
    });
  });
});
