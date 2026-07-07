const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { cleanupAfterSuccessfulSync, formatCleanupSummary } = require('./bulletin-retention');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

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

const config = {
  browserChannel: process.env.BULLETIN_BROWSER_CHANNEL || 'chromium',
  username: process.env.BULLETIN_USERNAME || '',
  password: process.env.BULLETIN_PASSWORD || '',
  loginUrl: process.env.BULLETIN_LOGIN_URL || '',
  listUrl: process.env.BULLETIN_LIST_URL || '',
  outputDir: path.resolve(ROOT_DIR, process.env.BULLETIN_OUTPUT_DIR || 'uploads/device/bulletin'),
  latestName: process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png',
  dataName: process.env.BULLETIN_DATA_NAME || 'latest-bulletin-data.json',
  buttonText: process.env.BULLETIN_BUTTON_TEXT || '公告图片下载',
  boardUrlContains: process.env.BULLETIN_BOARD_URL_CONTAINS || 'board-iframe',
  boardColor: String(process.env.BULLETIN_BOARD_COLOR || '1'),
  targetDate: process.env.BULLETIN_TARGET_DATE || todayInChina(),
  headless: process.env.BULLETIN_HEADLESS !== 'false',
  timeout: Number(process.env.BULLETIN_TIMEOUT || 60000),
  usernameSelector: process.env.BULLETIN_LOGIN_USERNAME_SELECTOR || '',
  passwordSelector: process.env.BULLETIN_LOGIN_PASSWORD_SELECTOR || '',
  loginButtonSelector: process.env.BULLETIN_LOGIN_BUTTON_SELECTOR || '',
  postLoginWaitMs: Number(process.env.BULLETIN_AFTER_LOGIN_WAIT_MS || 2000),
  viewportWidth: Number(process.env.BULLETIN_VIEWPORT_WIDTH || 1440),
  viewportHeight: Number(process.env.BULLETIN_VIEWPORT_HEIGHT || 960),
  captureWidth: boundedNumber(process.env.BULLETIN_CAPTURE_WIDTH, 1024, 320, 7680),
  captureHeight: boundedNumber(process.env.BULLETIN_CAPTURE_HEIGHT, 576, 180, 4320),
  captureScale: boundedNumber(process.env.BULLETIN_CAPTURE_SCALE, 2, 1, 4),
  captureSelector: process.env.BULLETIN_CAPTURE_SELECTOR || '.bulletin-board',
  ledName: process.env.BULLETIN_LED_NAME || 'latest-bulletin-led.png',
  ledDownloadSize: process.env.BULLETIN_LED_DOWNLOAD_SIZE || '512 x 288'
};

function todayInChina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function matchFirst(lines, regex) {
  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match;
  }
  return null;
}

const SECTION_LABELS = ['风险提示及事故警示', '企业状态', '风险等级', '企业承诺'];
const DEVICE_STATUS_PART_REGEX = /(生产装置\s*\d+\s*套|(?:正在运行装置|运行装置)\s*\d+\s*套|已停产装置\s*\d+\s*套)/g;
const DATE_LINE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function expandBulletinLines(rawLines) {
  const expanded = [];

  for (const rawLine of rawLines || []) {
    let text = compactText(rawLine);
    if (!text) continue;

    for (const label of SECTION_LABELS) {
      text = text.split(label).join(`\n${label}\n`);
    }
    text = text.replace(/(主要负责人\s*[:：]\s*[^\s]+)/g, '\n$1\n');
    text = text.replace(/(\d{4}-\d{2}-\d{2})/g, '\n$1\n');

    text.split(/\n+/)
      .map(compactText)
      .filter(Boolean)
      .forEach((line) => expanded.push(line));
  }

  return uniqueValues(expanded);
}

function firstStopIndex(text, stopLabels, stopRegexes) {
  let index = -1;

  for (const label of stopLabels || []) {
    const hit = text.indexOf(label);
    if (hit >= 0 && (index < 0 || hit < index)) index = hit;
  }

  for (const regex of stopRegexes || []) {
    const match = text.match(regex);
    if (match && match.index != null && (index < 0 || match.index < index)) {
      index = match.index;
    }
  }

  return index;
}

function extractSectionLines(lines, startLabel, stopLabels = [], stopRegexes = []) {
  const sectionLines = [];
  let collecting = false;

  for (const line of lines) {
    let text = line;

    if (!collecting) {
      const startIndex = text.indexOf(startLabel);
      if (startIndex < 0) continue;
      collecting = true;
      text = text.slice(startIndex + startLabel.length).trim();
    }

    if (!text) continue;

    const stopIndex = firstStopIndex(text, stopLabels, stopRegexes);
    if (stopIndex >= 0) {
      const beforeStop = compactText(text.slice(0, stopIndex));
      if (beforeStop) sectionLines.push(beforeStop);
      break;
    }

    if (!SECTION_LABELS.includes(text)) {
      sectionLines.push(text);
    }
  }

  return uniqueValues(sectionLines.map(compactText).filter(Boolean));
}

function parseStatusLines(sectionLines, allLines) {
  const sourceLines = sectionLines.length ? sectionLines : allLines;
  const statusText = sourceLines.join(' ');
  const deviceParts = statusText.match(DEVICE_STATUS_PART_REGEX) || [];
  const extraLines = sectionLines.length
    ? sourceLines
      .map((line) => compactText(line.replace(DEVICE_STATUS_PART_REGEX, ' ')))
      .filter(Boolean)
      .filter((line) => !SECTION_LABELS.includes(line))
    : [];

  return uniqueValues([
    ...deviceParts.map((part) => part.replace(/\s+/g, '')),
    ...extraLines
  ]);
}

function parseRiskFromImages(images) {
  const map = {
    1: '高风险',
    2: '较高风险',
    3: '一般风险',
    4: '低风险'
  };

  for (const image of images) {
    const src = image.src || '';
    const match = src.match(/risk-legend-(\d+)\.png/i);
    if (!match) continue;
    const code = Number(match[1]);
    return {
      code,
      level: map[code] || '',
      imageUrl: `/assets/risk-legend-${code}.png`
    };
  }

  return {
    code: 4,
    level: '低风险',
    imageUrl: '/assets/risk-legend-4.png'
  };
}

function parseBulletinLines(rawLines, images, sourceUrl) {
  const lines = expandBulletinLines(rawLines);
  const risk = parseRiskFromImages(images || []);
  const companyName = (
    lines.find((line) => /公司|企业/.test(line) && !SECTION_LABELS.includes(line) && !/今天|承诺|负责人/.test(line)) ||
    lines[0] ||
    ''
  );

  const statusSectionLines = extractSectionLines(lines, '企业状态', ['风险等级', '风险提示及事故警示', '企业承诺']);
  const warningSectionLines = extractSectionLines(lines, '风险提示及事故警示', ['企业承诺']);
  const promiseSectionLines = extractSectionLines(
    lines,
    '企业承诺',
    [],
    [/^主要负责人\s*[:：]/, DATE_LINE_REGEX]
  );
  const statusLines = parseStatusLines(statusSectionLines, lines);
  const totalMatch = matchFirst(lines, /生产装置\s*(\d+)\s*套/);
  const stoppedMatch = matchFirst(lines, /已停产装置\s*(\d+)\s*套/);
  const runningMatch = matchFirst(lines, /(?:正在运行装置|运行装置)\s*(\d+)\s*套/);
  const responsibleMatch = matchFirst(lines, /主要负责人\s*[:：]\s*(.+)$/);
  const dateLine = lines.find((line) => DATE_LINE_REGEX.test(line)) || '';
  const promiseLines = promiseSectionLines.length ? promiseSectionLines : lines.filter((line) => (
    /今天|承诺|安全运行|风险研判|防控措施/.test(line) &&
    !/主要负责人/.test(line)
  ));
  const warningLines = warningSectionLines.length
    ? warningSectionLines
    : lines.filter((line) => /事故|警示|风险提示/.test(line) && !/风险提示及事故警示/.test(line));

  return {
    generatedAt: new Date().toISOString(),
    sourceUrl,
    date: dateLine || config.targetDate,
    companyName,
    riskLevel: risk.level,
    riskCode: risk.code,
    riskImageUrl: risk.imageUrl,
    riskLegendUrl: '/assets/risk-legend-text.png',
    deviceStatus: {
      total: totalMatch ? Number(totalMatch[1]) : null,
      running: runningMatch ? Number(runningMatch[1]) : null,
      stopped: stoppedMatch ? Number(stoppedMatch[1]) : null,
      lines: statusLines
    },
    promiseText: compactText(promiseLines.join(' ')),
    warningText: compactText(warningLines.join(' ')),
    responsible: responsibleMatch ? compactText(responsibleMatch[1]) : '',
    rawLines: lines
  };
}

function assertConfig() {
  const missing = [];
  if (!config.username) missing.push('BULLETIN_USERNAME');
  if (!config.password) missing.push('BULLETIN_PASSWORD');
  if (!config.loginUrl) missing.push('BULLETIN_LOGIN_URL');
  if (!config.listUrl) missing.push('BULLETIN_LIST_URL');
  if (missing.length) {
    throw new Error(`缺少环境变量：${missing.join(', ')}。请检查 .env 文件。`);
  }
}

async function fillFirstVisible(page, selectors, value, label) {
  for (const selector of selectors.filter(Boolean)) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 3000 });
      await locator.fill(value, { timeout: 5000 });
      return selector;
    } catch {
      // Try the next selector. Remote portals often change generated classes.
    }
  }
  throw new Error(`没有找到可填写的${label}输入框。可以在 .env 中设置更精确的选择器。`);
}

async function clickLogin(page) {
  const selectors = [
    config.loginButtonSelector,
    'button:has-text("登录")',
    '.el-button:has-text("登录")',
    '[type="submit"]',
    'button'
  ].filter(Boolean);

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 3000 });
      await Promise.allSettled([
        page.waitForLoadState('networkidle', { timeout: 15000 }),
        locator.click({ timeout: 5000 })
      ]);
      return selector;
    } catch {
      // Continue with the next candidate.
    }
  }

  throw new Error('没有找到登录按钮。可以在 .env 中设置 BULLETIN_LOGIN_BUTTON_SELECTOR。');
}

async function login(page) {
  await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });

  const usernameSelectors = [
    config.usernameSelector,
    'input[placeholder*="账号"]',
    'input[placeholder*="用户名"]',
    'input[placeholder*="用户"]',
    'input[placeholder*="手机"]',
    'input[name*="user" i]',
    'input[name*="account" i]',
    'input[type="text"]',
    'input:not([type])'
  ];

  const passwordSelectors = [
    config.passwordSelector,
    'input[placeholder*="密码"]',
    'input[name*="pass" i]',
    'input[type="password"]'
  ];

  const usedUserSelector = await fillFirstVisible(page, usernameSelectors, config.username, '账号');
  const usedPasswordSelector = await fillFirstVisible(page, passwordSelectors, config.password, '密码');
  const usedLoginSelector = await clickLogin(page);

  await page.waitForTimeout(config.postLoginWaitMs);

  const currentUrl = page.url();
  const stillLogin = currentUrl.includes('/login') || currentUrl.includes('#/login');
  const possibleCaptcha = await page.locator('input[placeholder*="验证码"], input[placeholder*="验证"], canvas').count();

  if (stillLogin && possibleCaptcha > 0) {
    throw new Error('登录后仍停留在登录页，页面可能需要验证码或短信验证。请先用 BULLETIN_HEADLESS=false 观察流程。');
  }

  console.log(`登录动作完成：账号选择器=${usedUserSelector}，密码选择器=${usedPasswordSelector}，按钮选择器=${usedLoginSelector}`);
}

async function findDownloadTarget(page) {
  await page.goto(config.listUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  const date = config.targetDate;
  const buttonText = config.buttonText;

  await page.waitForFunction(
    ({ date, buttonText }) => document.body.innerText.includes(date) && document.body.innerText.includes(buttonText),
    { date, buttonText },
    { timeout: config.timeout }
  );
  await page.waitForTimeout(500);

  const xpathButtonInRow = page.locator(
    `xpath=//tr[contains(normalize-space(.), "${date}")]//button[contains(normalize-space(.), "${buttonText}")]`
  ).first();
  if (await xpathButtonInRow.count()) return xpathButtonInRow;

  const xpathAnyClickableInRow = page.locator(
    `xpath=//tr[contains(normalize-space(.), "${date}")]//*[contains(normalize-space(.), "${buttonText}")]`
  ).first();
  if (await xpathAnyClickableInRow.count()) return xpathAnyClickableInRow;

  // Fallback for table implementations that split fixed columns: click the button closest to the date row.
  const bySameRow = await page.evaluate(({ date, buttonText }) => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width >= 0 && box.height >= 0;
    };

    const nodes = Array.from(document.querySelectorAll('body *')).filter(isVisible);
    const dateNodes = nodes.filter((el) => (el.innerText || el.textContent || '').trim() === date);
    const buttonNodes = nodes.filter((el) => {
      const text = (el.innerText || el.textContent || '').trim();
      return (el.tagName === 'BUTTON' || el.closest('button')) && text.includes(buttonText);
    });

    let best = null;
    for (const dateNode of dateNodes) {
      const dateBox = dateNode.getBoundingClientRect();
      const dateY = dateBox.top + dateBox.height / 2;
      for (const rawButtonNode of buttonNodes) {
        const buttonNode = rawButtonNode.tagName === 'BUTTON' ? rawButtonNode : rawButtonNode.closest('button');
        if (!buttonNode) continue;
        const buttonBox = buttonNode.getBoundingClientRect();
        const buttonY = buttonBox.top + buttonBox.height / 2;
        const distance = Math.abs(dateY - buttonY);
        if (!best || distance < best.distance) {
          best = {
            distance,
            x: buttonBox.left + buttonBox.width / 2,
            y: buttonBox.top + buttonBox.height / 2
          };
        }
      }
    }

    return best && best.distance < 35 ? best : null;
  }, { date, buttonText });

  if (bySameRow) {
    return {
      click: async (options = {}) => page.mouse.click(bySameRow.x, bySameRow.y, options)
    };
  }

  const genericButton = page.getByText(buttonText, { exact: false }).first();
  if (await genericButton.count()) {
    console.warn(`没有精确匹配到 ${date} 所在行，将尝试点击页面上的第一个“${buttonText}”。`);
    return genericButton;
  }

  throw new Error(`没有找到 ${date} 对应的“${buttonText}”按钮。请确认当天是否已生成公告图片。`);
}

function withBoardColor(url) {
  if (!url) return '';
  const source = String(url);

  if (source.includes('color=')) {
    return source.replace(/([?&])color=\d+/g, `$1color=${config.boardColor}`);
  }

  if (source.includes('#/')) {
    const [base, hash] = source.split('#');
    const separator = hash.includes('?') ? '&' : '?';
    return `${base}#${hash}${separator}color=${config.boardColor}`;
  }

  const separator = source.includes('?') ? '&' : '?';
  return `${source}${separator}color=${config.boardColor}`;
}

async function selectBoardColorInModal(page) {
  if (config.boardColor !== '1') return;

  const candidates = [
    'label:has-text("黑色")',
    'text=黑色（效果佳）',
    'text=黑色'
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).last();
    try {
      await locator.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      return;
    } catch {
      // Continue with the next selector. Some component libraries wrap radio labels differently.
    }
  }
}

async function selectBoardSizeInModal(page, sizeText) {
  const normalizedSize = String(sizeText || '').replace(/\s+/g, ' ').trim();
  if (!normalizedSize) return;

  const variants = Array.from(new Set([
    normalizedSize,
    normalizedSize.replace(/\s*x\s*/i, 'x'),
    normalizedSize.replace(/\s*x\s*/i, ' x ')
  ]));

  for (const text of variants) {
    const candidates = [
      `label:has-text("${text}")`,
      `text=${text}`
    ];

    for (const selector of candidates) {
      const locator = page.locator(selector).last();
      try {
        await locator.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        return;
      } catch {
        // Try the next text/selector variant.
      }
    }
  }

  throw new Error(`没有找到公告图片尺寸选项：${normalizedSize}`);
}

async function waitForBulletinBoardUrl(page) {
  const url = await page.waitForFunction((keyword) => {
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    const fromInput = inputs
      .map((input) => input.value || input.getAttribute('value') || '')
      .find((value) => value.includes(keyword));
    if (fromInput) return fromInput;

    const text = document.body.innerText || '';
    const match = text.match(/https?:\/\/[^\s]+board-iframe[^\s]+/);
    return match ? match[0] : '';
  }, config.boardUrlContains, { timeout: 15000 }).then((handle) => handle.jsonValue()).catch(() => '');

  return withBoardColor(url);
}

async function prepareOutputPaths(extension = '.png') {
  await fs.mkdir(config.outputDir, { recursive: true });

  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
  const datedName = `bulletin-${config.targetDate}${safeExt}`;
  const datedPath = path.join(config.outputDir, datedName);
  const latestPath = path.join(config.outputDir, config.latestName);

  return { datedPath, latestPath };
}

async function prepareLedOutputPaths(extension = '.png') {
  await fs.mkdir(config.outputDir, { recursive: true });

  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
  const datedPath = path.join(config.outputDir, `bulletin-${config.targetDate}-led${safeExt}`);
  const latestPath = path.join(config.outputDir, config.ledName);

  return { datedPath, latestPath };
}

async function prepareDataOutputPaths() {
  await fs.mkdir(config.outputDir, { recursive: true });

  const datedPath = path.join(config.outputDir, `bulletin-${config.targetDate}-data.json`);
  const latestPath = path.join(config.outputDir, config.dataName);

  return { datedPath, latestPath };
}

function extensionFromFilename(filename, fallback = '.png') {
  const ext = path.extname(filename || '').toLowerCase();
  return ext || fallback;
}

async function saveBulletinDownload(download) {
  const extension = extensionFromFilename(download.suggestedFilename(), '.png');
  const { datedPath, latestPath } = await prepareOutputPaths(extension);
  await download.saveAs(datedPath);
  await fs.copyFile(datedPath, latestPath);

  return {
    mode: 'download',
    datedPath,
    latestPath,
    latestUrl: `/uploads/device/bulletin/${config.latestName}`
  };
}

async function prepareBulletinModal(page) {
  await selectBoardColorInModal(page);
  const boardUrl = await waitForBulletinBoardUrl(page);
  if (!boardUrl) {
    throw new Error('弹窗中没有找到公告图片地址。');
  }
  console.log(`公告图片地址：${boardUrl}`);
  return boardUrl;
}

async function saveBulletinDownloadFromModal(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  const downloadButton = page.locator('xpath=//button[normalize-space(.)="下载"]').last();
  await downloadButton.click({ timeout: 10000 });
  const download = await downloadPromise;
  return saveBulletinDownload(download);
}

async function saveLedBulletinDownload(download) {
  const extension = extensionFromFilename(download.suggestedFilename(), '.png');
  const { datedPath, latestPath } = await prepareLedOutputPaths(extension);
  await download.saveAs(datedPath);
  await fs.copyFile(datedPath, latestPath);

  return {
    mode: `download-${config.ledDownloadSize}`,
    datedPath,
    latestPath,
    latestUrl: `/uploads/device/bulletin/${config.ledName}`
  };
}

async function saveLedBulletinDownloadFromModal(page) {
  await selectBoardSizeInModal(page, config.ledDownloadSize);
  await selectBoardColorInModal(page);

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  const downloadButton = page.locator('xpath=//button[normalize-space(.)="下载"]').last();
  await downloadButton.click({ timeout: 10000 });
  const download = await downloadPromise;
  return saveLedBulletinDownload(download);
}

async function downloadBulletinImageFromModal(page) {
  await prepareBulletinModal(page);
  return saveBulletinDownloadFromModal(page);
}

async function openBulletinPageByUrl(page, boardUrl) {
  const boardPage = await page.context().newPage();
  await boardPage.setViewportSize({ width: config.captureWidth, height: config.captureHeight });
  await boardPage.goto(withBoardColor(boardUrl), { waitUntil: 'domcontentloaded', timeout: config.timeout });
  await boardPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  return boardPage;
}

async function openBulletinPage(page, button) {
  const pagePromise = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
  const navPromise = page.waitForURL((url) => String(url).includes(config.boardUrlContains), { timeout: 8000 }).catch(() => null);

  await button.click({ timeout: 10000 });

  const popup = await pagePromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded', { timeout: config.timeout }).catch(() => {});
    await popup.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    return popup;
  }

  await navPromise;
  if (page.url().includes(config.boardUrlContains)) return page;

  // This site opens a modal and writes the board URL into an input next to "图片地址".
  const boardUrl = await waitForBulletinBoardUrl(page);

  if (boardUrl) {
    return openBulletinPageByUrl(page, boardUrl);
  }

  throw new Error('点击后没有捕获到公告图片地址。可能弹窗结构变化，需要查看 debug/after-click.png。');
}

async function openBulletinPageFromCurrentModal(page) {
  const boardUrl = await waitForBulletinBoardUrl(page);
  if (!boardUrl) {
    throw new Error('弹窗中没有找到公告图片地址。');
  }

  return openBulletinPageByUrl(page, boardUrl);
}

async function saveRenderedBulletinImage(page) {
  const { datedPath, latestPath } = await prepareOutputPaths('.png');

  await page.setViewportSize({ width: config.captureWidth, height: config.captureHeight });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const board = page.locator(config.captureSelector).first();
  await board.waitFor({ state: 'visible', timeout: config.timeout });
  const box = await board.boundingBox();
  if (!box || box.width < 1 || box.height < 1) {
    throw new Error(`公告主体不可见：${config.captureSelector}`);
  }

  await board.screenshot({ path: datedPath, timeout: config.timeout });
  await fs.copyFile(datedPath, latestPath);

  return {
    mode: `rendered-screenshot@${config.captureScale}x`,
    datedPath,
    latestPath,
    latestUrl: `/uploads/device/bulletin/${config.latestName}`
  };
}

async function saveBulletinImage(page) {
  const { datedPath, latestPath } = await prepareOutputPaths('.png');

  await page.setViewportSize({ width: config.viewportWidth, height: config.viewportHeight });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await page.screenshot({ path: datedPath, fullPage: true, timeout: config.timeout });

  await fs.copyFile(datedPath, latestPath);

  return {
    mode: 'screenshot',
    datedPath,
    latestPath,
    latestUrl: `/uploads/device/bulletin/${config.latestName}`
  };
}

async function saveBulletinData(page) {
  const { datedPath, latestPath } = await prepareDataOutputPaths();

  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);

  const extracted = await page.evaluate(() => {
    const board = document.querySelector('.bulletin-board') || document.body;
    const lines = (board.innerText || document.body.innerText || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const images = Array.from(board.querySelectorAll('img')).map((img) => ({
      src: img.currentSrc || img.src || '',
      alt: img.alt || ''
    }));

    return { lines, images, sourceUrl: window.location.href };
  });

  const data = parseBulletinLines(extracted.lines, extracted.images, extracted.sourceUrl);
  if (!data.rawLines.includes(config.targetDate)) {
    throw new Error(`结构化数据日期不匹配：未在公告文字中读取到 ${config.targetDate}`);
  }

  await fs.writeFile(datedPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.copyFile(datedPath, latestPath);

  return {
    datedPath,
    latestPath,
    latestUrl: `/uploads/device/bulletin/${config.dataName}`,
    data
  };
}

async function main() {
  assertConfig();

  const browser = await chromium.launch({ headless: config.headless, channel: config.browserChannel });
  const context = await browser.newContext({
    viewport: { width: config.viewportWidth, height: config.viewportHeight },
    deviceScaleFactor: config.captureScale,
    acceptDownloads: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout);

  try {
    await login(page);
    const button = await findDownloadTarget(page);
    let bulletinPage = null;
    let result = null;
    let boardUrl = '';

    try {
      await button.click({ timeout: 10000 });
      boardUrl = await prepareBulletinModal(page);
      try {
        bulletinPage = await openBulletinPageByUrl(page, boardUrl);
        result = await saveRenderedBulletinImage(bulletinPage);
      } catch (error) {
        console.warn(`公告图片高清渲染失败，改用网站下载：${error.message}`);
        result = await saveBulletinDownloadFromModal(page);
      }
    } catch (error) {
      console.warn(`公告图片获取失败，改用页面截图兜底：${error.message}`);
      bulletinPage = bulletinPage || (boardUrl
        ? await openBulletinPageByUrl(page, boardUrl)
        : await openBulletinPageFromCurrentModal(page));
      result = await saveBulletinImage(bulletinPage);
    }

    console.log('公告图片获取成功');
    console.log(`日期：${config.targetDate}`);
    console.log(`方式：${result.mode}`);
    if (bulletinPage) console.log(`页面：${bulletinPage.url()}`);
    console.log(`保存：${result.datedPath}`);
    console.log(`最新：${result.latestPath}`);
    console.log(`大屏可引用：${result.latestUrl}`);

    if (!bulletinPage && boardUrl) {
      try {
        bulletinPage = await openBulletinPageByUrl(page, boardUrl);
      } catch (error) {
        console.warn(`结构化数据页面打开失败：${error.message}`);
      }
    }

    if (bulletinPage) {
      try {
        const dataResult = await saveBulletinData(bulletinPage);
        console.log(`结构化数据：${dataResult.latestPath}`);
        console.log(`数据可引用：${dataResult.latestUrl}`);
      } catch (error) {
        console.warn(`结构化数据保存失败：${error.message}`);
      }
    }

    try {
      const ledResult = await saveLedBulletinDownloadFromModal(page);
      console.log(`LED版本：${ledResult.latestPath}`);
      console.log(`LED可引用：${ledResult.latestUrl}`);
      console.log(`LED方式：${ledResult.mode}`);
    } catch (error) {
      console.warn(`LED版本下载失败，/led-bulletin.png 将回退到高清图：${error.message}`);
    }

    try {
      const cleanupResult = await cleanupAfterSuccessfulSync({
        outputDir: config.outputDir,
        latestName: config.latestName,
        ledName: config.ledName,
        dataName: config.dataName,
        targetDate: config.targetDate
      });
      console.log(`历史清理：${formatCleanupSummary(cleanupResult)}`);
    } catch (error) {
      console.warn(`历史清理失败：${error.message}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`公告图片获取失败：${error.message}`);
  process.exitCode = 1;
});
