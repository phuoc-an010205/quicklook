const path = require('path');
const fs = require('fs-extra');
const { initializeCanvas, readPsd } = require('ag-psd');
const { createCanvas } = require('@napi-rs/canvas');

/** Giới hạn dung lượng PSD để tránh treo / OOM */
const MAX_PSD_BYTES = 200 * 1024 * 1024;

let canvasReady = false;

function ensurePsdCanvas() {
  if (!canvasReady) {
    initializeCanvas((width, height) => createCanvas(width, height));
    canvasReady = true;
  }
}

function isPsdFile(filePath) {
  return path.extname(filePath || '').toLowerCase() === '.psd';
}

/**
 * Đọc PSD, lấy composite/thumbnail → buffer PNG.
 */
async function rasterizePsdToPngBuffer(fullPath) {
  ensurePsdCanvas();

  const stat = await fs.stat(fullPath);
  if (stat.size > MAX_PSD_BYTES) {
    throw new Error(
      `PSD quá lớn (${(stat.size / 1024 / 1024).toFixed(1)} MB, tối đa ${MAX_PSD_BYTES / 1024 / 1024} MB)`
    );
  }

  const buffer = await fs.readFile(fullPath);
  const psd = readPsd(buffer, {
    skipLayerImageData: true,
    skipThumbnail: false,
  });

  const canvas =
    psd.canvas ||
    (psd.children && psd.children.length > 0 && psd.children[0].canvas);

  if (!canvas || typeof canvas.toBuffer !== 'function') {
    throw new Error('PSD không có dữ liệu ảnh preview (composite/thumbnail)');
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  isPsdFile,
  rasterizePsdToPngBuffer,
  MAX_PSD_BYTES,
};