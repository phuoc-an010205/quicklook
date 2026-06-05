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

const PSD_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 511.76 498.97"><defs><style>.a{fill:#001e36;}.b{fill:#31a8ff;}</style></defs><title>adobe-photoshop</title><rect class="a" width="511.76" height="498.97" rx="90.62"/><path class="b" d="M115.24,349.91V130.53c0-1.59.68-2.4,2.06-2.4,3.65,0,7,0,12-.17s10.47-.23,16.31-.34l18.54-.35q9.78-.17,19.39-.17,26.09,0,44,6.52a76.4,76.4,0,0,1,28.66,17.51,67.06,67.06,0,0,1,15.62,24.21A80.31,80.31,0,0,1,276.61,203q0,27.48-12.7,45.32a71.82,71.82,0,0,1-34.33,25.92c-14.42,5.38-30.45,7.2-48.07,7.2-5,0-8.58-.05-10.64-.17s-5.15-.17-9.27-.17v68.49a2.72,2.72,0,0,1-2.32,3.09,2.49,2.49,0,0,1-.77,0H117.64C116,352.65,115.24,351.74,115.24,349.91ZM161.6,169.33v71.55q4.46.35,8.24.34h11.33a80.56,80.56,0,0,0,24.55-3.92A37,37,0,0,0,223.23,226q6.69-7.89,6.69-22a34.74,34.74,0,0,0-5-18.88A32,32,0,0,0,210,172.93,63.68,63.68,0,0,0,185,168.64q-8.25,0-14.59.17t-8.76.52Z"/><path class="b" d="M409.35,227.87a80,80,0,0,0-20.43-7.21,108.28,108.28,0,0,0-23.86-2.75,44.38,44.38,0,0,0-12.87,1.55,11.55,11.55,0,0,0-6.7,4.29,10.79,10.79,0,0,0-1.71,5.84,9.08,9.08,0,0,0,2.06,5.49,23.25,23.25,0,0,0,7.21,5.66,141.8,141.8,0,0,0,15.1,7,150,150,0,0,1,32.79,15.62,50,50,0,0,1,16.82,17.68,47.17,47.17,0,0,1,5,22,49.41,49.41,0,0,1-8.24,28.33,54.23,54.23,0,0,1-23.86,19.05Q375,357.3,352,357.3a140.51,140.51,0,0,1-29-2.75,92.44,92.44,0,0,1-21.8-6.87,4.44,4.44,0,0,1-2.41-4.12V306.49a2,2,0,0,1,.86-1.89,1.66,1.66,0,0,1,1.89.17A91.62,91.62,0,0,0,328,315.24a108.66,108.66,0,0,0,25.07,3.26q12,0,17.68-3.09a9.7,9.7,0,0,0,5.66-8.92q0-4.47-5.15-8.59T350.3,288a126.06,126.06,0,0,1-30.38-15.45,52.42,52.42,0,0,1-16.14-18,47.35,47.35,0,0,1-5-21.8A49.21,49.21,0,0,1,306,206.93a52.37,52.37,0,0,1,22.32-19.57q15.1-7.55,37.76-7.55a167.13,167.13,0,0,1,26.44,1.88,69.58,69.58,0,0,1,18.4,5,3.13,3.13,0,0,1,2.06,1.89,9.31,9.31,0,0,1,.34,2.57v34.68a2.3,2.3,0,0,1-1,2.06A3.33,3.33,0,0,1,409.35,227.87Z"/></svg>`;

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