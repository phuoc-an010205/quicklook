const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const psdThumbnail = require('./psd-thumbnail');

/**
 * Lấy đường dẫn thư mục cache an toàn (hoạt động cả dev lẫn production sau khi pack ASAR).
 * - Ưu tiên biến môi trường QUICKLOOK_SHARED_PATH (dùng cho build nội bộ)
 * - Production: dùng userData + /thumbnail-cache
 * - Development: dùng cache/thumbs tương đối so với project root
 */
function getCacheDir() {
  // 1. Nếu có biến môi trường QUICKLOOK_SHARED_PATH (dùng khi build nội bộ)
  if (process.env.QUICKLOOK_SHARED_PATH) {
    return path.join(process.env.QUICKLOOK_SHARED_PATH, 'thumbnail-cache');
  }

  // 2. Production (sau khi build .exe)
  if (app && app.isPackaged) {
    return path.join(app.getPath('userData'), 'thumbnail-cache');
  }

  // 3. Development
  return path.join(__dirname, '../../cache/thumbs');
}

const CACHE_DIR = getCacheDir();

// Chỉ tạo thư mục khi thực sự cần (tránh lỗi ENOTDIR khi chạy trong ASAR)
function ensureCacheDir() {
  try {
    fs.ensureDirSync(CACHE_DIR);
  } catch (err) {
    console.error('[Thumbnailer] Không thể tạo thư mục cache:', CACHE_DIR, err.message);
    // Không throw để app vẫn chạy được (dù cache không hoạt động)
  }
}

// ==================== CACHE MANAGEMENT CONFIG ====================

// Kích thước cache tối đa mặc định: 1GB (phù hợp với người dùng có nhiều ảnh)
const DEFAULT_MAX_CACHE_SIZE_MB = 1024;

// Tùy chọn: xóa các file cũ hơn X ngày
const DEFAULT_MAX_AGE_DAYS = 120;

/**
 * Module tạo thumbnail sử dụng sharp
 * 
 * Chiến lược:
 * - Resize ảnh tối đa 320px theo cạnh dài (cân bằng tốt cho gallery)
 * - Định dạng đầu ra: WebP (kích thước/ chất lượng tốt nhất)
 * - Khóa cache = SHA1( đường dẫn tuyệt đối + '|' + thời gian sửa + '|' + kích thước )
 * - Không tạo lại nếu file cache đã tồn tại và hợp lệ
 */

/**
 * Tạo khóa cache ổn định cho một file ảnh.
 */
async function generateCacheKey(fullPath) {
  try {
    const stat = await fs.stat(fullPath);
    const keySource = `${fullPath}|${stat.mtimeMs}|${stat.size}`;
    return crypto.createHash('sha1').update(keySource).digest('hex');
  } catch (err) {
    // Fallback to path-only hash if stat fails (rare)
    return crypto.createHash('sha1').update(fullPath).digest('hex');
  }
}

/**
 * Lấy đường dẫn thumbnail đã cache cho một ảnh cụ thể.
 */
function getThumbnailPath(cacheKey) {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${cacheKey}.webp`);
}

/** Icon PSD mặc định khi convert lỗi (cache một lần) */
let psdPlaceholderPath = null;

const PSD_PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#1e293b"/>
  <rect x="48" y="56" width="224" height="208" rx="16" fill="#334155" stroke="#64748b" stroke-width="4"/>
  <text x="160" y="175" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="52" font-weight="700" fill="#94a3b8">PSD</text>
  <text x="160" y="215" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="14" fill="#64748b">Không xem được preview</text>
</svg>`;

async function getPsdPlaceholderThumbnail() {
  if (psdPlaceholderPath && await fs.pathExists(psdPlaceholderPath)) {
    return psdPlaceholderPath;
  }

  ensureCacheDir();
  psdPlaceholderPath = path.join(CACHE_DIR, '__psd_placeholder__.webp');
  if (!(await fs.pathExists(psdPlaceholderPath))) {
    await sharp(Buffer.from(PSD_PLACEHOLDER_SVG))
      .resize(320, 320, { fit: 'contain', background: { r: 30, g: 41, b: 59, alpha: 1 } })
      .webp({ quality: 80 })
      .toFile(psdPlaceholderPath);
  }
  return psdPlaceholderPath;
}

async function createThumbnailFromPngBuffer(pngBuffer, thumbPath) {
  await sharp(pngBuffer)
    .resize(320, 320, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toFile(thumbPath);
}

async function getOrCreatePsdThumbnail(fullImagePath) {
  const cacheKey = await generateCacheKey(fullImagePath);
  const thumbPath = getThumbnailPath(cacheKey);

  if (await fs.pathExists(thumbPath)) {
    return thumbPath;
  }

  try {
    const pngBuffer = await psdThumbnail.rasterizePsdToPngBuffer(fullImagePath);
    await createThumbnailFromPngBuffer(pngBuffer, thumbPath);
    return thumbPath;
  } catch (err) {
    console.error('[Thumbnailer] PSD convert failed:', fullImagePath, err.message);
    return getPsdPlaceholderThumbnail();
  }
}

/**
 * Preview lớn cho modal / hover — trả về data URL PNG (base64).
 */
async function getPsdPreviewDataUrl(fullImagePath, maxDim = 1280) {
  try {
    const pngBuffer = await psdThumbnail.rasterizePsdToPngBuffer(fullImagePath);
    const out = await sharp(pngBuffer)
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch (err) {
    console.warn('[Thumbnailer] PSD preview data URL failed:', fullImagePath, err.message);
    const placeholderPath = await getPsdPlaceholderThumbnail();
    const buf = await fs.readFile(placeholderPath);
    return `data:image/webp;base64,${buf.toString('base64')}`;
  }
}

/**
 * Hàm cốt lõi: trả về đường dẫn thumbnail (tạo mới nếu cần).
 * 
 * @param {string} fullImagePath - Đường dẫn tuyệt đối đến ảnh gốc trên Google Drive
 * @returns {Promise<string>} - Đường dẫn tuyệt đối đến file .webp thumbnail (đã cache hoặc mới tạo)
 */
async function getOrCreateThumbnail(fullImagePath) {
  if (!fullImagePath) {
    throw new Error('No image path provided');
  }

  if (psdThumbnail.isPsdFile(fullImagePath)) {
    return getOrCreatePsdThumbnail(fullImagePath);
  }

  const cacheKey = await generateCacheKey(fullImagePath);
  const thumbPath = getThumbnailPath(cacheKey);

  // Đường dẫn nhanh: trả về phiên bản đã cache nếu tồn tại
  if (await fs.pathExists(thumbPath)) {
    return thumbPath;
  }

  // Tạo thumbnail mới
  try {
    await sharp(fullImagePath)
      .resize(320, 320, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(thumbPath);

    return thumbPath;
  } catch (err) {
    console.error('[Thumbnailer] Không tạo được thumbnail cho', fullImagePath, err.message);
    // Ném lỗi lại để nơi gọi xử lý (hiển thị lỗi cho người dùng)
    throw err;
  }
}

/**
 * Phiên bản xử lý hàng loạt với giới hạn đồng thời.
 * Hữu ích khi render toàn bộ gallery.
 */
async function getThumbnailsForPaths(imagePaths, concurrency = 4) {
  const results = [];
  let active = 0;
  let index = 0;

  return new Promise((resolve) => {
    const next = async () => {
      if (index >= imagePaths.length && active === 0) {
        return resolve(results);
      }

      while (active < concurrency && index < imagePaths.length) {
        const currentIndex = index++;
        const imgPath = imagePaths[currentIndex];
        active++;

        try {
          const thumb = await getOrCreateThumbnail(imgPath);
          results[currentIndex] = { path: imgPath, thumbnail: thumb, success: true };
        } catch (e) {
          results[currentIndex] = { path: imgPath, thumbnail: null, success: false, error: e.message };
        }

        active--;
        next();
      }
    };

    next();
  });
}

/**
 * Xóa toàn bộ cache thumbnail (hữu ích cho phần cài đặt hoặc nút "Xóa cache").
 */
async function clearThumbnailCache() {
  ensureCacheDir();
  await fs.emptyDir(CACHE_DIR);
  console.log('[Thumbnailer] Thumbnail cache cleared.');
}

// ==================== QUẢN LÝ KÍCH THƯỚC CACHE (Giải pháp ổn định lâu dài) ====================

/**
 * Lấy thống kê cache hiện tại.
 */
async function getCacheStats() {
  ensureCacheDir();
  try {
    const files = await fs.readdir(CACHE_DIR);
    let totalSize = 0;

    for (const file of files) {
      if (file.endsWith('.webp')) {
        const stat = await fs.stat(path.join(CACHE_DIR, file));
        totalSize += stat.size;
      }
    }

    return {
      sizeBytes: totalSize,
      sizeMB: (totalSize / 1024 / 1024).toFixed(2),
      fileCount: files.filter(f => f.endsWith('.webp')).length,
    };
  } catch (err) {
    console.warn('[Thumbnailer] Không tính được thống kê cache:', err);
    return { sizeBytes: 0, sizeMB: '0.00', fileCount: 0 };
  }
}

/**
 * Lấy danh sách tất cả file thumbnail sắp xếp theo thời gian sửa đổi (cũ nhất trước).
 * Dùng cho việc dọn dẹp theo kiểu LRU.
 */
async function getCacheFilesSortedByAge() {
  ensureCacheDir();
  try {
    const files = await fs.readdir(CACHE_DIR);
    const webpFiles = files.filter(f => f.endsWith('.webp'));

    const fileStats = await Promise.all(
      webpFiles.map(async (file) => {
        const fullPath = path.join(CACHE_DIR, file);
        const stat = await fs.stat(fullPath);
        return {
          path: fullPath,
          mtime: stat.mtimeMs,
          size: stat.size,
        };
      })
    );

    // Sắp xếp cũ nhất trước (kiểu LRU)
    fileStats.sort((a, b) => a.mtime - b.mtime);
    return fileStats;
  } catch (err) {
    return [];
  }
}

/**
 * Ép buộc kích thước cache tối đa bằng cách xóa các thumbnail cũ nhất (LRU).
 * Đây là giải pháp ổn định lâu dài nhất.
 */
async function enforceMaxCacheSize(maxSizeMB = DEFAULT_MAX_CACHE_SIZE_MB) {
  const maxBytes = maxSizeMB * 1024 * 1024;
  const stats = await getCacheStats();

  if (stats.sizeBytes <= maxBytes) {
    return { deleted: 0, freedMB: 0, currentSizeMB: stats.sizeMB };
  }

  console.log(`[Thumbnailer] Cache size ${stats.sizeMB}MB exceeds limit ${maxSizeMB}MB. Pruning...`);

  const sortedFiles = await getCacheFilesSortedByAge();
  let deletedCount = 0;
  let freedBytes = 0;

  for (const file of sortedFiles) {
    if (stats.sizeBytes - freedBytes <= maxBytes) break;

    try {
      await fs.remove(file.path);
      freedBytes += file.size;
      deletedCount++;
    } catch (e) {
      console.warn('[Thumbnailer] Không xóa được thumbnail cũ:', file.path);
    }
  }

  const newStats = await getCacheStats();
  const freedMB = (freedBytes / 1024 / 1024).toFixed(2);

  console.log(`[Thumbnailer] Đã xóa ${deletedCount} file, giải phóng ${freedMB}MB. Kích thước mới: ${newStats.sizeMB}MB`);

  return {
    deleted: deletedCount,
    freedMB,
    currentSizeMB: newStats.sizeMB,
  };
}

/**
 * Xóa các thumbnail cũ hơn X ngày (chiến lược dọn dẹp phụ).
 */
async function cleanupOldThumbnails(maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  const sortedFiles = await getCacheFilesSortedByAge();
  let deletedCount = 0;

  for (const file of sortedFiles) {
    if (now - file.mtime > maxAgeMs) {
      try {
        await fs.remove(file.path);
        deletedCount++;
      } catch (e) {}
    }
  }

  if (deletedCount > 0) {
    console.log(`[Thumbnailer] Đã xóa ${deletedCount} thumbnail cũ hơn ${maxAgeDays} ngày.`);
  }

  return { deleted: deletedCount };
}

/**
 * Hàm dọn dẹp chính - nên gọi định kỳ.
 * Kết hợp giới hạn kích thước + dọn theo thời gian.
 */
async function pruneCache(maxSizeMB = DEFAULT_MAX_CACHE_SIZE_MB) {
  const sizeResult = await enforceMaxCacheSize(maxSizeMB);
  const ageResult = await cleanupOldThumbnails();

  return {
    sizeCleanup: sizeResult,
    ageCleanup: ageResult,
  };
}

module.exports = {
  getOrCreateThumbnail,
  getOrCreatePsdThumbnail,
  getPsdPreviewDataUrl,
  getPsdPlaceholderThumbnail,
  getThumbnailsForPaths,
  clearThumbnailCache,
  getCacheStats,
  pruneCache,
  enforceMaxCacheSize,
  cleanupOldThumbnails,
  isPsdFile: psdThumbnail.isPsdFile,
  CACHE_DIR,
};