

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

  // 4. Nút Refresh (legacy)
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', refreshCurrentImages);
  }

  // 5. NEW: Nút Tải lại tất cả ảnh (bulk previews)
  const btnReloadPreviews = document.getElementById('btn-reload-previews');
  if (btnReloadPreviews) {
    btnReloadPreviews.addEventListener('click', () => {
      if (typeof window.reloadAllPreviews === 'function') {
        window.reloadAllPreviews();
      } else {
        console.warn('reloadAllPreviews not available yet');
      }
    });
  }
};
// Legacy directory functions no longer defined in this simplified version.
// The following lines were causing ReferenceError and have been removed:
// window.renderDirectoryContents = renderDirectoryContents;
// window.drillIntoSubfolder = drillIntoSubfolder;
// window.goBackOneLevel = goBackOneLevel;
// window.showImagesFromRootForId = showImagesFromRootForId;
// window.refreshCurrentImages = refreshCurrentImages;

// pickRootDir and refreshCurrentImages are still referenced via event listeners above (guarded).