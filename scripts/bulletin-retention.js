const fs = require('fs/promises');
const path = require('path');

const DATE_RE = '\\d{4}-\\d{2}-\\d{2}';
const BULLETIN_FILE_RE = new RegExp(`^bulletin-(${DATE_RE})(?:-(led|data))?(\\.[^.]+)$`);

function todayInChina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function shiftDate(dateString, days) {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeOptions(options = {}) {
  return {
    outputDir: path.resolve(options.outputDir || path.join(__dirname, '..', 'uploads', 'device', 'bulletin')),
    latestName: options.latestName || process.env.BULLETIN_LATEST_NAME || 'latest-bulletin.png',
    ledName: options.ledName || process.env.BULLETIN_LED_NAME || 'latest-bulletin-led.png',
    dataName: options.dataName || process.env.BULLETIN_DATA_NAME || 'latest-bulletin-data.json'
  };
}

function parseBulletinFile(filename) {
  const match = String(filename || '').match(BULLETIN_FILE_RE);
  if (!match) return null;

  return {
    filename,
    date: match[1],
    kind: match[2] || 'image',
    extension: match[3].toLowerCase()
  };
}

async function listDatedBulletins(outputDir) {
  try {
    const entries = await fs.readdir(outputDir);
    return entries.map(parseBulletinFile).filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function pickFile(files, date, kind) {
  const candidates = files.filter((file) => file.date === date && file.kind === kind);
  if (!candidates.length) return null;

  const preferredExt = kind === 'data' ? '.json' : '.png';
  return candidates.find((file) => file.extension === preferredExt) || candidates[0];
}

async function copyFileIfPresent(sourcePath, targetPath) {
  try {
    await fs.copyFile(sourcePath, targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function removeIfPresent(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function publishBulletinDate(date, options = {}) {
  const normalized = normalizeOptions(options);
  const files = await listDatedBulletins(normalized.outputDir);
  const image = pickFile(files, date, 'image');
  const led = pickFile(files, date, 'led');
  const data = pickFile(files, date, 'data');
  const published = [];
  const removedAliases = [];

  if (!image) {
    for (const alias of [normalized.latestName, normalized.ledName, normalized.dataName]) {
      if (await removeIfPresent(path.join(normalized.outputDir, alias))) {
        removedAliases.push(alias);
      }
    }

    return {
      date,
      published: false,
      publishedAliases: published,
      removedAliases,
      message: `没有找到 ${date} 的公告主图，已移除 latest 别名以避免显示更早历史。`
    };
  }

  await fs.mkdir(normalized.outputDir, { recursive: true });
  await fs.copyFile(
    path.join(normalized.outputDir, image.filename),
    path.join(normalized.outputDir, normalized.latestName)
  );
  published.push(normalized.latestName);

  if (led) {
    await fs.copyFile(
      path.join(normalized.outputDir, led.filename),
      path.join(normalized.outputDir, normalized.ledName)
    );
    published.push(normalized.ledName);
  } else if (await removeIfPresent(path.join(normalized.outputDir, normalized.ledName))) {
    removedAliases.push(normalized.ledName);
  }

  if (data) {
    await copyFileIfPresent(
      path.join(normalized.outputDir, data.filename),
      path.join(normalized.outputDir, normalized.dataName)
    );
    published.push(normalized.dataName);
  } else if (await removeIfPresent(path.join(normalized.outputDir, normalized.dataName))) {
    removedAliases.push(normalized.dataName);
  }

  return {
    date,
    published: true,
    publishedAliases: published,
    removedAliases,
    message: `已发布 ${date} 公告为 latest。`
  };
}

async function cleanupBulletinHistory(keepDate, options = {}) {
  const normalized = normalizeOptions(options);
  const files = await listDatedBulletins(normalized.outputDir);
  const deleted = [];

  await Promise.all(files.map(async (file) => {
    if (file.date === keepDate) return;
    await removeIfPresent(path.join(normalized.outputDir, file.filename));
    deleted.push(file.filename);
  }));

  deleted.sort();
  return { keepDate, deleted };
}

async function cleanupAfterSuccessfulSync(options = {}) {
  const targetDate = options.targetDate || todayInChina();
  const publishResult = await publishBulletinDate(targetDate, options);
  const cleanupResult = await cleanupBulletinHistory(targetDate, options);

  return {
    mode: 'success',
    keepDate: targetDate,
    fallbackDate: '',
    publishResult,
    cleanupResult
  };
}

async function cleanupAfterFailedSync(options = {}) {
  const targetDate = options.targetDate || todayInChina();
  const fallbackDate = options.fallbackDate || shiftDate(targetDate, -1);
  const publishResult = await publishBulletinDate(fallbackDate, options);
  const cleanupResult = await cleanupBulletinHistory(fallbackDate, options);

  return {
    mode: 'failed',
    keepDate: fallbackDate,
    fallbackDate,
    publishResult,
    cleanupResult
  };
}

function formatCleanupSummary(result) {
  const deletedCount = result.cleanupResult ? result.cleanupResult.deleted.length : 0;
  const publishMessage = result.publishResult ? result.publishResult.message : '';
  return `${publishMessage} 清理历史文件 ${deletedCount} 个，保留日期：${result.keepDate || '无'}`;
}

module.exports = {
  todayInChina,
  shiftDate,
  parseBulletinFile,
  publishBulletinDate,
  cleanupBulletinHistory,
  cleanupAfterSuccessfulSync,
  cleanupAfterFailedSync,
  formatCleanupSummary
};
