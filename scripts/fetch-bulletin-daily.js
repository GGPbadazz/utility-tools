const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  cleanupAfterFailedSync,
  formatCleanupSummary,
  shiftDate,
  todayInChina
} = require('./bulletin-retention');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'data', 'config.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const FETCH_SCRIPT = path.join(ROOT_DIR, 'scripts', 'fetch-bulletin-image.js');

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function runFetchScript(remoteImage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FETCH_SCRIPT], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        BULLETIN_USERNAME: remoteImage.username || process.env.BULLETIN_USERNAME || '',
        BULLETIN_PASSWORD: remoteImage.password || process.env.BULLETIN_PASSWORD || '',
        BULLETIN_BROWSER_CHANNEL: process.env.BULLETIN_BROWSER_CHANNEL || 'chromium',
        BULLETIN_OUTPUT_DIR: process.env.BULLETIN_OUTPUT_DIR || 'uploads/device/bulletin',
        BULLETIN_LATEST_NAME: process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png',
        BULLETIN_LED_NAME: process.env.BULLETIN_LED_NAME || 'latest-bulletin-led.png',
        BULLETIN_DATA_NAME: process.env.BULLETIN_DATA_NAME || 'latest-bulletin-data.json'
      }
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error((stderr || stdout || `脚本退出码：${code}`).trim()));
    });
  });
}

async function markResult(success, message) {
  const config = await readConfig();
  config.remoteImage = {
    ...(config.remoteImage || {}),
    localImageUrl: success ? `/uploads/device/bulletin/${process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png'}` : ((config.remoteImage || {}).localImageUrl || ''),
    lastSyncedAt: success ? new Date().toISOString() : ((config.remoteImage || {}).lastSyncedAt || ''),
    lastSyncStatus: success ? 'success' : 'failed',
    lastSyncMessage: message.slice(0, 500)
  };
  await writeConfig(config);
}

async function fallbackToYesterday(targetDate) {
  const outputDir = path.resolve(ROOT_DIR, process.env.BULLETIN_OUTPUT_DIR || 'uploads/device/bulletin');
  const result = await cleanupAfterFailedSync({
    outputDir,
    latestName: process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png',
    ledName: process.env.BULLETIN_LED_NAME || 'latest-bulletin-led.png',
    dataName: process.env.BULLETIN_DATA_NAME || 'latest-bulletin-data.json',
    targetDate,
    fallbackDate: shiftDate(targetDate, -1)
  });

  return formatCleanupSummary(result);
}

async function main() {
  loadDotEnv(ENV_PATH);

  const maxAttempts = Math.max(Math.floor(Number(process.env.BULLETIN_DAILY_MAX_ATTEMPTS || 3)), 1);
  const retryDelayMinutes = Math.max(Number(process.env.BULLETIN_RETRY_DELAY_MINUTES || 60), 1);
  const retryDelayMs = retryDelayMinutes * 60 * 1000;
  const config = await readConfig();
  const remoteImage = config.remoteImage || {};
  const targetDate = process.env.BULLETIN_TARGET_DATE || todayInChina();

  if (remoteImage.enabled !== true) {
    console.log('每日公告图片同步未启用，跳过本次任务。');
    return;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`开始第 ${attempt}/${maxAttempts} 次获取当天公告图片。`);
      const output = await runFetchScript(remoteImage);
      await markResult(true, output || '公告图片同步成功。');
      console.log(output || '公告图片同步成功。');
      return;
    } catch (error) {
      lastError = error;
      console.error(`第 ${attempt}/${maxAttempts} 次同步失败：${error.message}`);
      if (attempt < maxAttempts) {
        console.log(`${retryDelayMinutes} 分钟后重试。`);
        await sleep(retryDelayMs);
      }
    }
  }

  let fallbackMessage = '';
  try {
    fallbackMessage = await fallbackToYesterday(targetDate);
    console.log(`当日同步失败，已回退昨日公告：${fallbackMessage}`);
  } catch (error) {
    fallbackMessage = `回退昨日公告失败：${error.message}`;
    console.error(fallbackMessage);
  }

  await markResult(false, `${lastError ? lastError.message : '未知错误'}\n${fallbackMessage}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
