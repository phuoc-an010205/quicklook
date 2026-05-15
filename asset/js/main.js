

window.onload = function() {
  console.log('%c[App] Đã sẵn sàng và kết nối các nút thành công!', 'color:#10b981; font-weight:bold;');

  // 1. Nút Phân tích link
  const btnParseLinks = document.getElementById('btn-parse-links');
  if (btnParseLinks) {
    btnParseLinks.addEventListener('click', parseDriveLinks);
  }

  // 2. Nút Chọn thư mục gốc
  const btnPickRoot = document.getElementById('btn-pick-root');
  if (btnPickRoot) {
    btnPickRoot.addEventListener('click', pickRootDir);
  }

  // 3. Nút Map tất cả ID
  const btnMapAll = document.getElementById('btn-map-all');
  if (btnMapAll) {
    btnMapAll.addEventListener('click', mapAllParsedIds);
  }

  // 4. Nút Refresh
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', refreshCurrentImages);
  }
};
// window.renderDirectoryContents = renderDirectoryContents;
// window.drillIntoSubfolder = drillIntoSubfolder;
  // window.goBackOneLevel = goBackOneLevel;
// window.showImagesFromRootForId = showImagesFromRootForId;
window.pickRootDir = pickRootDir;
// window.refreshCurrentImages = refreshCurrentImages;