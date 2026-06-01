const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

// Lấy đường dẫn thư mục chia sẻ từ biến môi trường
const SHARED_PATH = process.env.QUICKLOOK_SHARED_PATH;

console.log('\n🚀 Bắt đầu build nội bộ QuickLook...\n');

try {
  // 1. Chạy build portable
  console.log('📦 Đang build portable .exe...');
  execSync('npm run dist:portable', { 
    stdio: 'inherit',
    cwd: ROOT 
  });
  console.log('✅ Build thành công!\n');

  // 2. Tìm file .exe portable trong dist
  const files = fs.readdirSync(DIST_DIR);
  const portableExe = files.find(file => 
    file.endsWith('.exe') && 
    (file.toLowerCase().includes('portable') || file.toLowerCase().includes('quicklook'))
  );

  if (!portableExe) {
    console.error('❌ Không tìm thấy file .exe portable trong thư mục dist/');
    process.exit(1);
  }

  const sourceFile = path.join(DIST_DIR, portableExe);
  console.log(`📄 File build: ${portableExe}`);

  // 3. Nếu có đường dẫn thư mục chia sẻ → copy vào đó
  if (SHARED_PATH) {
    const targetDir = path.resolve(SHARED_PATH);
    
    try {
      fs.ensureDirSync(targetDir);
      const targetFile = path.join(targetDir, portableExe);

      console.log(`📂 Đang copy sang thư mục chia sẻ: ${targetDir}`);
      fs.copyFileSync(sourceFile, targetFile);
      
      console.log(`\n✅ Hoàn tất!`);
      console.log(`📍 File đã được copy đến:`);
      console.log(`   ${targetFile}\n`);
    } catch (copyErr) {
      console.error(`\n❌ Lỗi khi copy file sang thư mục chia sẻ:`);
      console.error(copyErr.message);
      console.log(`\n📍 File build vẫn nằm tại: ${sourceFile}\n`);
    }
  } else {
    console.log(`\n✅ Build xong!`);
    console.log(`📍 File portable nằm tại:`);
    console.log(`   ${sourceFile}\n`);
    console.log(`💡 Để tự động copy vào thư mục chia sẻ, hãy set biến môi trường:`);
    console.log(`   set QUICKLOOK_SHARED_PATH=Z:\\Software\\QuickLook\n`);
  }

} catch (error) {
  console.error('\n❌ Build thất bại:');
  console.error(error.message);
  process.exit(1);
}