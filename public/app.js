// ==========================================
// DropBeam WiFi - Frontend Sharing & Site Logic
// ==========================================

// Room State & Storage
let activeRoomId = localStorage.getItem('dropbeam_room') || 'public';
let activeRoomPasscode = localStorage.getItem('dropbeam_passcode') || '';

// Theme State
let activeTheme = localStorage.getItem('dropbeam_theme') || 'dark';

// Sound state controller
let isMuted = localStorage.getItem('dropbeam_muted') === 'true';

// Check if we are on the dashboard page
const isDashboard = document.getElementById('clipboard-textarea') !== null;

// Socket connection (Only initialized on the active dashboard page)
const socket = (isDashboard && typeof io !== 'undefined') ? io() : null;

// Store active local files and state
let localState = {
  clipboardText: '',
  files: [],
  textHistory: [],
  chatMessages: [],
  devices: [],
  isTyping: false
};

// DOM Elements - Site Wide
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const navToggle = document.getElementById('nav-toggle');
const navBar = document.querySelector('.nav-bar');
const cookieBanner = document.getElementById('cookie-banner');
const acceptCookiesBtn = document.getElementById('accept-cookies-btn');
const contactForm = document.getElementById('contact-form');

// DOM Elements - Dashboard (Guarded by isDashboard)
const connectionStatus = document.getElementById('connection-status');
const serverUrlElem = document.getElementById('server-url');
const copyUrlBtn = document.getElementById('copy-url-btn');
const openQrBtn = document.getElementById('open-qr-btn');
const muteToggleBtn = document.getElementById('mute-toggle-btn');
const devicesContainer = document.getElementById('devices-container');
const deviceCountBadge = document.getElementById('device-count');
const currentRoomNameElem = document.getElementById('current-room-name');
const switchRoomTrigger = document.getElementById('switch-room-trigger');

// DOM Elements - Tabs
const tabBtnClipboard = document.getElementById('tab-btn-clipboard');
const tabBtnChat = document.getElementById('tab-btn-chat');
const tabContentClipboard = document.getElementById('tab-clipboard');
const tabContentChat = document.getElementById('tab-chat');

// DOM Elements - Clipboard
const clipboardTextarea = document.getElementById('clipboard-textarea');
const clipboardSyncStatus = document.getElementById('clipboard-sync-status');
const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
const saveHistoryBtn = document.getElementById('save-history-btn');
const clearClipboardBtn = document.getElementById('clear-clipboard-btn');
const charCounter = document.getElementById('char-counter');
const historyItems = document.getElementById('history-items');

// DOM Elements - Chat
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// DOM Elements - Files Upload
const fileDropzone = document.getElementById('file-dropzone');
const fileInput = document.getElementById('file-input');
const selfDestructToggle = document.getElementById('self-destruct-toggle');
const cameraCaptureBtn = document.getElementById('camera-capture-btn');
const cameraInput = document.getElementById('camera-input');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadCountElem = document.getElementById('upload-count');
const uploadTotalProgress = document.getElementById('upload-total-progress');
const uploadProgressList = document.getElementById('upload-progress-list');
const filesGrid = document.getElementById('files-grid');
const refreshFilesBtn = document.getElementById('refresh-files-btn');

// DOM Elements - Modals
const qrModal = document.getElementById('qr-modal');
const closeQrBtn = document.getElementById('close-qr-btn');
const qrCanvas = document.getElementById('qr-canvas');
const qrUrlText = document.getElementById('qr-url-text');
const copyQrUrlBtn = document.getElementById('copy-qr-url-btn');

const roomModal = document.getElementById('room-modal');
const closeRoomBtn = document.getElementById('close-room-btn');
const roomSwitchForm = document.getElementById('room-switch-form');
const roomIdInput = document.getElementById('room-id-input');
const roomPasscodeInput = document.getElementById('room-passcode-input');

const mediaModal = document.getElementById('media-modal');
const closeMediaBtn = document.getElementById('close-media-btn');
const mediaTitle = document.getElementById('media-title');
const mediaViewerContainer = document.getElementById('media-viewer-container');
const mediaFilename = document.getElementById('media-filename');
const mediaDownloadLink = document.getElementById('media-download-link');

const toastContainer = document.getElementById('toast-container');

// Sound elements
const soundSuccess = document.getElementById('sound-success');
const soundConnect = document.getElementById('sound-connect');

// --------------------------------------------------
// 0. Initial Settings Boot (Theme, Sound)
// --------------------------------------------------
applyTheme(activeTheme);
updateMuteButtonUI();

// --------------------------------------------------
// 1. Device Identification & Detection
// --------------------------------------------------
function getBrowserName(ua) {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  return "Browser";
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  let type = "desktop";
  
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) { os = "Android"; type = "mobile"; }
  else if (/iphone/i.test(ua)) { os = "iPhone"; type = "mobile"; }
  else if (/ipad/i.test(ua)) { os = "iPad"; type = "tablet"; }
  
  const browser = getBrowserName(ua);
  return {
    deviceName: `${os} (${browser})`,
    type: type,
    os: os
  };
}

// --------------------------------------------------
// 2. Active Dashboard Application Logic
// --------------------------------------------------
if (isDashboard && socket) {
  
  // Socket.io Connection Handlers
  socket.on('connect', () => {
    setConnectionStatus(true);
    const info = getDeviceInfo();
    socket.emit('register-device', info);
    socket.emit('join-room', { roomId: activeRoomId, passcode: activeRoomPasscode });
    
    const currentUrl = window.location.origin;
    if (serverUrlElem) serverUrlElem.textContent = currentUrl;
    if (qrUrlText) qrUrlText.textContent = currentUrl;
    if (copyUrlBtn) copyUrlBtn.disabled = false;
    if (openQrBtn) openQrBtn.disabled = false;
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false);
    showToast('Connection lost. Reconnecting...', 'error');
  });

  socket.on('join-success', (state) => {
    activeRoomId = state.roomId;
    localStorage.setItem('dropbeam_room', activeRoomId);
    if (currentRoomNameElem) currentRoomNameElem.textContent = activeRoomId;
    
    localState.clipboardText = state.clipboardText;
    localState.textHistory = state.textHistory || [];
    localState.files = state.files || [];
    localState.chatMessages = state.chatMessages || [];
    
    if (!localState.isTyping && clipboardTextarea) {
      clipboardTextarea.value = state.clipboardText;
      updateCharCount(state.clipboardText.length);
    }
    setSyncStatus('saved');
    renderHistory();
    renderFiles();
    renderChat();
    
    if (roomModal) roomModal.classList.remove('active');
    showToast(`Joined Room: ${activeRoomId}`, 'success');
    playSound('connect');
  });

  socket.on('join-error', (errMsg) => {
    showToast(errMsg, 'error');
    openRoomSwitcherModal();
  });

  socket.on('clipboard-sync', (text) => {
    localState.clipboardText = text;
    if (!localState.isTyping && clipboardTextarea) {
      clipboardTextarea.value = text;
      updateCharCount(text.length);
      setSyncStatus('synced');
    }
  });

  socket.on('history-updated', (history) => {
    localState.textHistory = history;
    renderHistory();
  });

  socket.on('devices-updated', (devices) => {
    localState.devices = devices;
    renderDevices();
  });

  socket.on('chat-received', (msg) => {
    localState.chatMessages.push(msg);
    appendChatMessage(msg);
    playSound('success');
  });

  socket.on('files-added', (newFiles) => {
    newFiles.forEach(file => {
      if (!localState.files.some(f => f.id === file.id)) {
        localState.files.push(file);
      }
    });
    renderFiles();
    showToast(`${newFiles.length} file(s) shared!`, 'info');
    playSound('success');
  });

  socket.on('file-removed', (fileId) => {
    localState.files = localState.files.filter(f => f.id !== fileId);
    renderFiles();
  });

  socket.on('init-state', (state) => {
    localState.clipboardText = state.clipboardText;
    localState.textHistory = state.textHistory || [];
    localState.files = state.files || [];
    
    if (!localState.isTyping && clipboardTextarea) {
      clipboardTextarea.value = state.clipboardText;
      updateCharCount(state.clipboardText.length);
    }
    setSyncStatus('saved');
    renderHistory();
    renderFiles();
  });

  function setConnectionStatus(isConnected) {
    if (!connectionStatus) return;
    const indicator = connectionStatus.querySelector('.status-indicator');
    const text = connectionStatus.querySelector('.status-text');
    
    if (isConnected) {
      indicator.className = 'status-indicator online';
      text.textContent = 'Active Room';
    } else {
      indicator.className = 'status-indicator offline';
      text.textContent = 'Disconnected';
    }
  }

  // Tab Navigation Handling
  function switchTab(targetTab) {
    if (targetTab === 'clipboard') {
      if (tabBtnClipboard) tabBtnClipboard.classList.add('active');
      if (tabBtnChat) tabBtnChat.classList.remove('active');
      if (tabContentClipboard) tabContentClipboard.style.display = 'flex';
      if (tabContentChat) tabContentChat.style.display = 'none';
    } else if (targetTab === 'chat') {
      if (tabBtnChat) tabBtnChat.classList.add('active');
      if (tabBtnClipboard) tabBtnClipboard.classList.remove('active');
      if (tabContentChat) tabContentChat.style.display = 'flex';
      if (tabContentClipboard) tabContentClipboard.style.display = 'none';
      scrollChatToBottom();
    }
  }

  if (tabBtnClipboard) tabBtnClipboard.addEventListener('click', () => switchTab('clipboard'));
  if (tabBtnChat) tabBtnChat.addEventListener('click', () => switchTab('chat'));

  // Room Switching Logic
  function openRoomSwitcherModal() {
    if (roomIdInput) roomIdInput.value = activeRoomId;
    if (roomPasscodeInput) roomPasscodeInput.value = activeRoomPasscode;
    if (roomModal) roomModal.classList.add('active');
  }

  if (switchRoomTrigger) switchRoomTrigger.addEventListener('click', openRoomSwitcherModal);
  if (closeRoomBtn) closeRoomBtn.addEventListener('click', () => roomModal.classList.remove('active'));

  if (roomSwitchForm) {
    roomSwitchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetRoom = roomIdInput.value.trim().toLowerCase();
      const passcode = roomPasscodeInput.value;
      
      if (!targetRoom) return;
      
      activeRoomPasscode = passcode;
      localStorage.setItem('dropbeam_passcode', passcode);
      
      socket.emit('join-room', { roomId: targetRoom, passcode: passcode });
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === roomModal) {
      roomModal.classList.remove('active');
    }
  });

  // Clipboard Sync Interactions
  let debounceTimer;
  if (clipboardTextarea) {
    clipboardTextarea.addEventListener('input', (e) => {
      localState.isTyping = true;
      setSyncStatus('typing');
      updateCharCount(e.target.value.length);
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const text = e.target.value;
        socket.emit('clipboard-update', text);
        localState.clipboardText = text;
        localState.isTyping = false;
        setSyncStatus('saved');
      }, 400); 
    });

    clipboardTextarea.addEventListener('blur', () => {
      clearTimeout(debounceTimer);
      const text = clipboardTextarea.value;
      socket.emit('clipboard-update', text);
      localState.clipboardText = text;
      localState.isTyping = false;
      setSyncStatus('saved');
    });
  }

  function updateCharCount(length) {
    if (charCounter) charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
  }

  function setSyncStatus(status) {
    if (!clipboardSyncStatus) return;
    if (status === 'typing') {
      clipboardSyncStatus.innerHTML = '<i data-lucide="edit-3" class="icon-sm"></i> Typing...';
    } else if (status === 'saved') {
      clipboardSyncStatus.innerHTML = '<i data-lucide="check-circle" class="icon-sm text-success"></i> Synced';
    } else if (status === 'synced') {
      clipboardSyncStatus.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm accent-text-blue animate-pulse"></i> Received';
    } else {
      clipboardSyncStatus.innerHTML = '<i data-lucide="alert-circle" class="icon-sm text-danger"></i> Offline';
    }
    lucide.createIcons();
  }

  if (copyClipboardBtn) {
    copyClipboardBtn.addEventListener('click', () => {
      const text = clipboardTextarea.value;
      if (!text) {
        showToast('Clipboard is empty', 'info');
        return;
      }
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to system clipboard', 'success'))
        .catch(() => showToast('Copy failed', 'error'));
    });
  }

  if (clearClipboardBtn) {
    clearClipboardBtn.addEventListener('click', () => {
      if (clipboardTextarea) clipboardTextarea.value = '';
      updateCharCount(0);
      socket.emit('clipboard-update', '');
      localState.clipboardText = '';
      setSyncStatus('saved');
      showToast('Clipboard cleared', 'info');
    });
  }

  if (saveHistoryBtn) {
    saveHistoryBtn.addEventListener('click', () => {
      const text = clipboardTextarea.value;
      if (!text || text.trim() === '') {
        showToast('Cannot save empty clipboard', 'info');
        return;
      }
      socket.emit('history-add', text);
      showToast('Snippet saved to history', 'success');
    });
  }

  function renderHistory() {
    if (!historyItems) return;
    if (localState.textHistory.length === 0) {
      historyItems.innerHTML = '<p class="empty-state">No saved snippets yet. Click "Save" to keep text clips.</p>';
      return;
    }
    
    historyItems.innerHTML = localState.textHistory.map(item => {
      const displayDate = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const escapedContent = item.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
        
      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-content" title="Click to load into clipboard">${escapedContent}</div>
          <div class="history-item-meta">
            <span class="history-time">${displayDate}</span>
            <div class="history-item-actions">
              <button class="btn-icon btn-sm btn-copy-history" title="Copy snippet"><i data-lucide="copy"></i></button>
              <button class="btn-icon btn-sm btn-delete-history text-danger" title="Delete snippet"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.history-item').forEach(elem => {
      const id = elem.dataset.id;
      const content = elem.querySelector('.history-content').textContent;
      
      elem.querySelector('.history-content').addEventListener('click', () => {
        if (clipboardTextarea) clipboardTextarea.value = content;
        updateCharCount(content.length);
        socket.emit('clipboard-update', content);
        localState.clipboardText = content;
        setSyncStatus('saved');
        showToast('Loaded snippet into clipboard', 'info');
      });
      
      elem.querySelector('.btn-copy-history').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(content)
          .then(() => showToast('Snippet copied', 'success'))
          .catch(() => showToast('Copy failed', 'error'));
      });
      
      elem.querySelector('.btn-delete-history').addEventListener('click', (e) => {
        e.stopPropagation();
        socket.emit('history-delete', id);
        showToast('Snippet deleted', 'info');
      });
    });
    
    lucide.createIcons();
  }

  // Device Monitors
  function renderDevices() {
    if (!devicesContainer) return;
    if (localState.devices.length === 0) {
      devicesContainer.innerHTML = '<div class="device-card-skeleton">Detecting local network devices...</div>';
      if (deviceCountBadge) deviceCountBadge.textContent = '0';
      return;
    }
    
    if (deviceCountBadge) deviceCountBadge.textContent = localState.devices.length;
    
    devicesContainer.innerHTML = localState.devices.map(dev => {
      const isSelf = dev.id === socket.id;
      let iconName = 'monitor';
      if (dev.type === 'mobile') iconName = 'smartphone';
      if (dev.type === 'tablet') iconName = 'tablet';
      
      return `
        <div class="device-card ${isSelf ? 'self' : ''}">
          <i data-lucide="${iconName}"></i>
          <div>
            <span class="device-name">${dev.deviceName} ${isSelf ? '<span class="badge">You</span>' : ''}</span>
            <span class="device-ip">${dev.ip}</span>
          </div>
        </div>
      `;
    }).join('');
    
    lucide.createIcons();
  }

  // Chat Board functions
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
  if (chatMessageInput) {
    chatMessageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  function sendChatMessage() {
    if (!chatMessageInput) return;
    const msg = chatMessageInput.value.trim();
    if (!msg) return;
    
    socket.emit('chat-message', msg);
    chatMessageInput.value = '';
  }

  function renderChat() {
    if (!chatMessagesContainer) return;
    if (localState.chatMessages.length === 0) {
      chatMessagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <i data-lucide="message-circle" class="chat-empty-icon"></i>
          <p>No messages in this room yet.</p>
          <span>Send a quick text, link, or note to others below!</span>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    chatMessagesContainer.innerHTML = '';
    localState.chatMessages.forEach(msg => appendChatMessage(msg, false));
    scrollChatToBottom();
  }

  function appendChatMessage(msg, shouldScroll = true) {
    if (!chatMessagesContainer) return;
    const empty = chatMessagesContainer.querySelector('.chat-empty-state');
    if (empty) empty.remove();
    
    const isSelf = msg.senderId === socket.id;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const msgElem = document.createElement('div');
    msgElem.className = `chat-message ${isSelf ? 'outgoing' : 'incoming'}`;
    
    const escapedMessage = msg.message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    msgElem.innerHTML = `
      <span class="chat-sender">${isSelf ? 'You' : msg.senderName}</span>
      <div class="chat-bubble">
        ${escapedMessage}
      </div>
      <span class="chat-meta">${time}</span>
    `;
    
    chatMessagesContainer.appendChild(msgElem);
    
    if (shouldScroll) {
      scrollChatToBottom();
    }
  }

  function scrollChatToBottom() {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  }

  // File Upload Handlers
  if (fileDropzone) {
    fileDropzone.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });

    fileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropzone.classList.add('dragover');
    });

    fileDropzone.addEventListener('dragleave', () => {
      fileDropzone.classList.remove('dragover');
    });

    fileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFiles(files);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        uploadFiles(files);
        fileInput.value = '';
      }
    });
  }

  if (cameraCaptureBtn) {
    cameraCaptureBtn.addEventListener('click', () => {
      if (cameraInput) cameraInput.click();
    });
  }
  
  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        uploadFiles(files);
        cameraInput.value = '';
      }
    });
  }

  function uploadFiles(files) {
    const formData = new FormData();
    let filesToUpload = [];
    
    const MAX_SIZE = 100 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_SIZE) {
        showToast(`File "${files[i].name}" exceeds 100MB limit`, 'error');
        continue;
      }
      formData.append('files', files[i]);
      filesToUpload.push(files[i]);
    }
    
    if (filesToUpload.length === 0) return;
    
    if (uploadProgressContainer) uploadProgressContainer.style.display = 'block';
    if (uploadCountElem) uploadCountElem.textContent = filesToUpload.length;
    if (uploadTotalProgress) uploadTotalProgress.textContent = '0%';
    
    if (uploadProgressList) {
      uploadProgressList.innerHTML = filesToUpload.map((file, idx) => `
        <div class="upload-progress-item" id="upload-item-${idx}">
          <div class="upload-item-meta">
            <span class="upload-item-name" title="${file.name}">${file.name}</span>
            <span class="upload-item-percent" id="upload-percent-${idx}">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="upload-bar-${idx}"></div>
          </div>
        </div>
      `).join('');
    }
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    
    xhr.setRequestHeader('x-room-id', activeRoomId);
    xhr.setRequestHeader('x-room-passcode', activeRoomPasscode);
    xhr.setRequestHeader('x-self-destruct', (selfDestructToggle && selfDestructToggle.checked) ? 'true' : 'false');
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        if (uploadTotalProgress) uploadTotalProgress.textContent = `${percentage}%`;
        
        filesToUpload.forEach((file, idx) => {
          const bar = document.getElementById(`upload-bar-${idx}`);
          const text = document.getElementById(`upload-percent-${idx}`);
          if (bar && text) {
            bar.style.width = `${percentage}%`;
            text.textContent = `${percentage}%`;
          }
        });
      }
    });
    
    xhr.onload = () => {
      if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        showToast(`Successfully shared ${res.files.length} file(s)!`, 'success');
        if (selfDestructToggle) selfDestructToggle.checked = false;
      } else {
        showToast('File upload failed', 'error');
      }
    };
    
    xhr.onerror = () => {
      if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
      showToast('Network error during file upload', 'error');
    };
    
    xhr.send(formData);
  }

  // File rendering
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getFileIcon(mimeType) {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'file-video';
    if (mimeType.startsWith('audio/')) return 'music';
    if (mimeType.includes('pdf')) return 'file-text';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('gz')) return 'archive';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'file-spreadsheet';
    return 'file';
  }

  function renderFiles() {
    if (!filesGrid) return;
    if (localState.files.length === 0) {
      filesGrid.innerHTML = `
        <div class="empty-state">
          <i data-lucide="file-question" class="empty-icon"></i>
          <p>No files shared yet</p>
          <span>Drag files above or scan the QR code with another device to start sharing!</span>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    const now = Date.now();
    
    filesGrid.innerHTML = localState.files.map(file => {
      const isImage = file.mimeType && file.mimeType.startsWith('image/');
      const fileIcon = getFileIcon(file.mimeType);
      const sizeStr = formatBytes(file.size);
      
      let expiryIndicator;
      if (file.selfDestruct) {
        expiryIndicator = `<span class="file-expiry-indicator destruct" title="This file self-destructs after download"><i data-lucide="flame" class="icon-xs"></i> Destruct</span>`;
      } else {
        const secondsLeft = Math.max(0, Math.round((file.expiresAt - now) / 1000));
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        expiryIndicator = `<span class="file-expiry-indicator" title="Expires in">${minutes}:${seconds.toString().padStart(2, '0')}</span>`;
      }
      
      const previewContent = isImage 
        ? `<img class="preview-image" src="/api/preview/${file.id}" alt="${file.name}">`
        : `<i data-lucide="${fileIcon}" class="preview-icon"></i>`;
        
      return `
        <div class="file-card" data-id="${file.id}" data-expires="${file.expiresAt}" data-destruct="${file.selfDestruct ? 'true' : 'false'}">
          ${expiryIndicator}
          <div class="file-preview" title="Click to view file preview">
            ${previewContent}
          </div>
          <div class="file-details">
            <div>
              <div class="file-name" title="${file.name}">${file.name}</div>
              <div class="file-size-time">
                <span>${sizeStr}</span>
              </div>
            </div>
            <div class="file-actions">
              <a href="/api/download/${file.id}" download="${file.name}" class="btn-download-file" title="Download file">
                <button><i data-lucide="download"></i></button>
              </a>
              <button class="btn-copy-file-link" title="Copy direct download link"><i data-lucide="link-2"></i></button>
              <button class="btn-delete-file text-danger" title="Delete file from server"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.file-card').forEach(card => {
      const id = card.dataset.id;
      const name = card.querySelector('.file-name').textContent;
      const file = localState.files.find(f => f.id === id);
      
      card.querySelector('.file-preview').addEventListener('click', () => {
        if (file) openMediaPlayer(file);
      });

      card.querySelector('.btn-copy-file-link').addEventListener('click', () => {
        const downloadUrl = `${window.location.origin}/api/download/${id}`;
        navigator.clipboard.writeText(downloadUrl)
          .then(() => showToast('Direct download URL copied', 'success'))
          .catch(() => showToast('Copy link failed', 'error'));
      });
      
      card.querySelector('.btn-delete-file').addEventListener('click', () => {
        socket.emit('file-delete', id);
        showToast(`Deleting "${name}" from server`, 'info');
      });

      card.querySelector('.btn-download-file').addEventListener('click', () => {
        if (card.dataset.destruct === 'true') {
          setTimeout(() => {
            card.remove();
            if (document.querySelectorAll('.file-card').length === 0) {
              renderFiles();
            }
          }, 1500);
        }
      });
    });
    
    lucide.createIcons();
  }

  // Countdowns loop
  setInterval(() => {
    const now = Date.now();
    let cardsUpdated = false;
    
    document.querySelectorAll('.file-card').forEach(card => {
      if (card.dataset.destruct === 'true') return;
      
      const expires = parseInt(card.dataset.expires);
      const secondsLeft = Math.max(0, Math.round((expires - now) / 1000));
      
      if (secondsLeft <= 0) {
        card.remove();
        cardsUpdated = true;
      } else {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        const indicator = card.querySelector('.file-expiry-indicator');
        if (indicator) {
          indicator.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    });
    
    if (cardsUpdated && document.querySelectorAll('.file-card').length === 0) {
      renderFiles();
    }
  }, 1000);

  if (refreshFilesBtn) {
    refreshFilesBtn.addEventListener('click', () => {
      socket.emit('get-state');
      showToast('Refreshing room shared items...', 'info');
    });
  }

  // Media Previews
  function openMediaPlayer(file) {
    if (!mediaTitle || !mediaFilename || !mediaDownloadLink || !mediaModal || !mediaViewerContainer) return;
    
    mediaTitle.textContent = `${file.name.substring(0, 30)}${file.name.length > 30 ? '...' : ''} Preview`;
    mediaFilename.textContent = file.name;
    mediaDownloadLink.href = `/api/download/${file.id}`;
    
    mediaDownloadLink.onclick = () => {
      if (file.selfDestruct) {
        setTimeout(() => {
          mediaModal.classList.remove('active');
          mediaViewerContainer.innerHTML = '';
        }, 1000);
      }
    };

    const previewUrl = `/api/preview/${file.id}`;
    
    if (file.mimeType.startsWith('image/')) {
      mediaViewerContainer.innerHTML = `<img src="${previewUrl}" alt="${file.name}">`;
    } else if (file.mimeType.startsWith('video/')) {
      mediaViewerContainer.innerHTML = `<video src="${previewUrl}" controls autoplay></video>`;
    } else if (file.mimeType.startsWith('audio/')) {
      mediaViewerContainer.innerHTML = `<audio src="${previewUrl}" controls autoplay></audio>`;
    } else {
      const icon = getFileIcon(file.mimeType);
      mediaViewerContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i data-lucide="${icon}" style="width: 64px; height: 64px; margin-bottom: 12px; opacity: 0.8;"></i>
          <h4>Preview not supported in browser</h4>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Please download the file to view its contents.</p>
        </div>
      `;
      lucide.createIcons();
    }
    
    mediaModal.classList.add('active');
  }

  if (closeMediaBtn) {
    closeMediaBtn.addEventListener('click', () => {
      if (mediaModal) mediaModal.classList.remove('active');
      if (mediaViewerContainer) mediaViewerContainer.innerHTML = '';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === mediaModal) {
      mediaModal.classList.remove('active');
      if (mediaViewerContainer) mediaViewerContainer.innerHTML = '';
    }
  });

  // QR Binds
  if (openQrBtn) {
    openQrBtn.addEventListener('click', () => {
      const url = window.location.href;
      if (qrModal) qrModal.classList.add('active');
      
      if (qrCanvas) {
        QRCode.toCanvas(qrCanvas, url, {
          width: 200,
          margin: 1,
          color: {
            dark: '#0a0b10',
            light: '#ffffff'
          }
        }, (error) => {
          if (error) {
            console.error('QR code generation error:', error);
            showToast('Failed to create QR code', 'error');
          }
        });
      }
    });
  }

  if (closeQrBtn) closeQrBtn.addEventListener('click', () => {
    if (qrModal) qrModal.classList.remove('active');
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      qrModal.classList.remove('active');
    }
  });

  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url)
        .then(() => showToast('Wi-Fi connection link copied!', 'success'))
        .catch(() => showToast('Link copy failed', 'error'));
    });
  }

  if (copyQrUrlBtn) {
    copyQrUrlBtn.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url)
        .then(() => showToast('Connection link copied!', 'success'))
        .catch(() => showToast('Link copy failed', 'error'));
    });
  }
}

// --------------------------------------------------
// 3. Site Wide Functionalities (Theme, Menu, Cookies, FAQ)
// --------------------------------------------------

// Responsive Menu Binds
if (navToggle && navBar) {
  navToggle.addEventListener('click', () => {
    navBar.classList.toggle('menu-open');
  });
}

// Close mobile menu on clicking any navigation link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (navBar) navBar.classList.remove('menu-open');
  });
});

// FAQ Accordion click handlers
const faqHeaders = document.querySelectorAll('.faq-header');
faqHeaders.forEach(header => {
  header.addEventListener('click', () => {
    const item = header.parentElement;
    const content = item.querySelector('.faq-content');
    
    // Close other active FAQ items
    document.querySelectorAll('.faq-item').forEach(otherItem => {
      if (otherItem !== item && otherItem.classList.contains('active')) {
        otherItem.classList.remove('active');
        const otherContent = otherItem.querySelector('.faq-content');
        if (otherContent) otherContent.style.maxHeight = '0';
      }
    });
    
    item.classList.toggle('active');
    if (item.classList.contains('active')) {
      if (content) content.style.maxHeight = content.scrollHeight + 'px';
    } else {
      if (content) content.style.maxHeight = '0';
    }
  });
});

// Contact Us Form submit toast
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Thank you! Your inquiry has been sent successfully.', 'success');
    contactForm.reset();
  });
}

// Cookie Consent Banner display check
if (cookieBanner && acceptCookiesBtn) {
  const isAccepted = localStorage.getItem('dropbeam_cookies_accepted') === 'true';
  if (!isAccepted) {
    setTimeout(() => {
      cookieBanner.classList.add('show');
    }, 1200);
  }
  
  acceptCookiesBtn.addEventListener('click', () => {
    localStorage.setItem('dropbeam_cookies_accepted', 'true');
    cookieBanner.classList.remove('show');
    showToast('Thank you for accepting cookies!', 'success');
  });
}

// --------------------------------------------------
// 4. Toast Notifications System
// --------------------------------------------------
function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span class="toast-message">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  lucide.createIcons();
  
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3500);
}

// --------------------------------------------------
// 5. Sound FX & Mute Logic
// --------------------------------------------------
if (muteToggleBtn) {
  muteToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    localStorage.setItem('dropbeam_muted', isMuted);
    updateMuteButtonUI();
    
    if (!isMuted) playSound('connect');
    showToast(isMuted ? 'Notification sounds muted' : 'Notification sounds enabled', 'info');
  });
}

function updateMuteButtonUI() {
  if (!muteToggleBtn) return;
  if (isMuted) {
    muteToggleBtn.classList.add('muted');
    muteToggleBtn.title = 'Unmute Sounds';
    muteToggleBtn.innerHTML = '<i data-lucide="volume-x"></i>';
  } else {
    muteToggleBtn.classList.remove('muted');
    muteToggleBtn.title = 'Mute Sounds';
    muteToggleBtn.innerHTML = '<i data-lucide="volume-2"></i>';
  }
  lucide.createIcons();
}

function playSound(type) {
  if (isMuted) return;
  
  try {
    if (type === 'success' && soundSuccess) {
      soundSuccess.currentTime = 0;
      soundSuccess.play().catch(e => console.log('Sound play blocked by browser policy'));
    } else if (type === 'connect' && soundConnect) {
      soundConnect.currentTime = 0;
      soundConnect.play().catch(e => console.log('Sound play blocked by browser policy'));
    }
  } catch (err) {
    console.error('Error playing sound:', err);
  }
}

// --------------------------------------------------
// 6. Theme Toggle & Application
// --------------------------------------------------
function applyTheme(theme) {
  if (!themeToggleBtn) return;
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeToggleBtn.title = 'Switch to Dark Mode';
    themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
  } else {
    document.body.classList.remove('light-theme');
    themeToggleBtn.title = 'Switch to Light Mode';
    themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
  }
  lucide.createIcons();
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    activeTheme = activeTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('dropbeam_theme', activeTheme);
    applyTheme(activeTheme);
    showToast(`Switched to ${activeTheme === 'dark' ? 'Dark' : 'Light'} theme`, 'success');
  });
}

// Initial icons parse on load
lucide.createIcons();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('DropBeam PWA: Service Worker registered successfully: ', reg.scope))
      .catch(err => console.error('DropBeam PWA: Service Worker registration failed: ', err));
  });
}
