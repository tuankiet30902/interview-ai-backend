const path = require('path');
const fs = require('fs');
const { FileConst } = require('./file.const');

// Helper: try to load sharp if available. If not installed, we simply no-op.
let sharp = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  sharp = require('sharp');
} catch (err) {
  sharp = null;
}

/**
 * Optimize an uploaded image (resize + compress) if possible.
 * This is intentionally fail-safe:
 * - If sharp is not installed → resolve immediately (no optimization, no error).
 * - If file is not an image → resolve immediately.
 * - On any processing error → log and resolve (không chặn luồng upload).
 *
 * @param {Object} options
 * @param {string} options.dbname_prefix  - tenant db prefix ('' for shared db)
 * @param {string} options.nameLib        - logical library name, e.g. 'avatar' hoặc 'space_icon'
 * @param {Object} options.fileInfo       - file info object from FileInterface (timePath, named, mimetype, fileSize)
 * @param {number} [options.maxSize=512]  - max width/height cho ảnh (avatar: 512, icon: 512–1024)
 */
async function optimizeImageIfPossible(options) {
  const { dbname_prefix, nameLib, fileInfo, maxSize = 512 } = options || {};

  if (!sharp) {
    // sharp chưa được cài → bỏ qua tối ưu để tránh crash server
    return;
  }

  if (!fileInfo || !fileInfo.mimetype || !fileInfo.timePath || !fileInfo.named) {
    return;
  }

  // Chỉ xử lý image/*
  if (!fileInfo.mimetype.startsWith('image/')) {
    return;
  }

  try {
    // FileInterface.upload lưu file dưới thư mục tenant_uploads (FileConst.pathLocal)
    // timePath luôn có dạng "/username/YYYY_MM_DD"
    const safeDbPrefix = dbname_prefix || '';
    const timePath = fileInfo.timePath || '';
    const filename = fileInfo.named;

    // Đảm bảo không có double slash
    const relativePath = path.join(safeDbPrefix, timePath.replace(/^\/+/, ''), nameLib, filename);
    const absolutePath = path.join(FileConst.pathLocal, relativePath);

    if (!fs.existsSync(absolutePath)) {
      return;
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return;
    }

    const image = sharp(absolutePath);
    const metadata = await image.metadata();

    // Nếu đã nhỏ hơn ngưỡng thì vẫn có thể nén thêm một chút cho đồng nhất
    const width = metadata.width || maxSize;
    const height = metadata.height || maxSize;
    const shouldResize = width > maxSize || height > maxSize;

    let pipeline = image.rotate(); // auto-orient nếu có EXIF

    if (shouldResize) {
      pipeline = pipeline.resize({
        width: maxSize,
        height: maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Ưu tiên webp, fallback về jpeg nếu cần
    if ((metadata.format || '').toLowerCase() === 'png') {
      pipeline = pipeline.webp({ quality: 80 });
    } else {
      pipeline = pipeline.jpeg({ quality: 80 });
    }

    await pipeline.toFile(absolutePath + '.opt');

    // Thay thế file gốc bằng file đã tối ưu (atomic move)
    fs.renameSync(absolutePath + '.opt', absolutePath);
  } catch (err) {
    // Không được để lỗi tối ưu phá vỡ luồng upload
    // eslint-disable-next-line no-console
    console.error('[image-optimizer] Failed to optimize image:', {
      message: err && err.message,
      stack: err && err.stack,
    });
  }
}

module.exports = {
  optimizeImageIfPossible,
};

























