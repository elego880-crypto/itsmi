const multer = require('multer');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const fs = require('fs');

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Только изображения: jpg, png, gif, webp'));
};

const upload = multer({
  dest: os.tmpdir(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB raw, потом сожмём
});

// Сжимает изображение до <= 1MB и возвращает base64
async function compressToBase64(filePath, mimetype) {
  const TARGET = 1 * 1024 * 1024; // 1MB

  let quality = 82;
  let buf;

  // gif не сжимаем sharp — отдаём как есть если <= 1MB
  if (mimetype === 'image/gif') {
    buf = fs.readFileSync(filePath);
    if (buf.length <= TARGET) return `data:${mimetype};base64,${buf.toString('base64')}`;
    throw new Error('GIF слишком большой, максимум 1MB');
  }

  // Для остальных — итеративно снижаем качество
  const img = sharp(filePath).rotate(); // rotate — исправляет EXIF ориентацию

  for (let q = quality; q >= 20; q -= 10) {
    buf = await img.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= TARGET) {
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
  }

  // Если всё ещё большой — ресайзим
  buf = await sharp(filePath).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  if (buf.length <= TARGET) return `data:image/jpeg;base64,${buf.toString('base64')}`;

  // Последний шанс
  buf = await sharp(filePath).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

module.exports = { upload, compressToBase64 };
