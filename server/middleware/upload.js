const multer = require('multer');
const path = require('path');
const os = require('os');

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Только изображения: jpg, png, gif, webp'));
};

const upload = multer({
  dest: os.tmpdir(),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }
});

module.exports = upload;
