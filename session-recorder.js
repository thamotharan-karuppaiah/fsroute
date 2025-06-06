/**
 * FreshRoute - Session Recorder
 * Records user interactions and provides visual playback with virtual cursor
 */

// Recording state
let isRecording = false;
let currentSession = null;
let recordingStartTime = null;
let recordingInterval = null;
let screenshotInterval = null;

// Playback state
let currentPlayback = null;
let playbackInterval = null;
let isPlaying = false;
let playbackSpeed = 1;
let currentEventIndex = 0;

// Storage keys
const SESSIONS_KEY = 'freshroute_sessions';
const MAX_SESSIONS = 50; // Limit to prevent storage overflow
const SCREENSHOT_INTERVAL = 5000; // Take screenshot every 5 seconds
const MAX_SCREENSHOTS_PER_SESSION = 100;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('FreshRoute Session Recorder initialized');
  setupEventListeners();
  loadSessions();
  updateRecordingStats();
});

// Setup event listeners
function setupEventListeners() {
  // Recording controls
  document.getElementById('startRecordingBtn').addEventListener('click', startRecording);
  document.getElementById('stopRecordingBtn').addEventListener('click', stopRecording);
  document.getElementById('clearSessionsBtn').addEventListener('click', clearAllSessions);
  document.getElementById('exportAllBtn').addEventListener('click', exportAllSessions);
  
  // Replay controls
  document.getElementById('closeReplayBtn').addEventListener('click', closeReplay);
  document.getElementById('playPauseBtn').addEventListener('click', togglePlayback);
  document.getElementById('playbackSpeed').addEventListener('change', updatePlaybackSpeed);
  
  // Timeline controls
  const timeline = document.getElementById('timeline');
  const timelineHandle = document.getElementById('timelineHandle');
  
  timeline.addEventListener('click', seekToPosition);
  timelineHandle.addEventListener('mousedown', startTimelineDrag);
}

// Start recording session
async function startRecording() {
  if (isRecording) return;
  
  try {
    // Request permissions for screen capture
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }
    
    // Initialize new session
    currentSession = {
      id: generateSessionId(),
      startTime: Date.now(),
      endTime: null,
      events: [],
      screenshots: [],
      pages: [],
      metadata: {
        userAgent: navigator.userAgent,
        initialUrl: tabs[0].url,
        windowSize: {
          width: window.screen.width,
          height: window.screen.height
        }
      }
    };
    
    // Start recording
    isRecording = true;
    recordingStartTime = Date.now();
    
    // Update UI
    updateRecordingStatus('recording', 'Recording in progress...');
    document.getElementById('startRecordingBtn').disabled = true;
    document.getElementById('stopRecordingBtn').disabled = false;
    
    // Start periodic screenshot capture
    await captureInitialScreenshot();
    screenshotInterval = setInterval(captureScreenshot, SCREENSHOT_INTERVAL);
    
    // Start recording duration timer
    recordingInterval = setInterval(updateRecordingDuration, 1000);
    
    // Inject content script to capture events
    await injectRecordingScript(tabs[0].id);
    
    console.log('Recording started for session:', currentSession.id);
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    alert('Failed to start recording: ' + error.message);
    resetRecordingState();
  }
}

// Stop recording session
async function stopRecording() {
  if (!isRecording || !currentSession) return;
  
  try {
    // Stop recording
    isRecording = false;
    currentSession.endTime = Date.now();
    
    // Clear intervals
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
      screenshotInterval = null;
    }
    
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    
    // Capture final screenshot
    await captureScreenshot();
    
    // Save session
    await saveSession(currentSession);
    
    // Update UI
    updateRecordingStatus('idle', 'Ready to Record');
    document.getElementById('startRecordingBtn').disabled = false;
    document.getElementById('stopRecordingBtn').disabled = true;
    
    // Reset recording stats
    updateRecordingStats();
    
    // Reload sessions list
    await loadSessions();
    
    console.log('Recording stopped. Session saved:', currentSession.id);
    currentSession = null;
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    alert('Failed to stop recording: ' + error.message);
  }
}

// Capture screenshot of active tab
async function captureScreenshot() {
  if (!isRecording || !currentSession) return;
  
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs[0]) return;
    
    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 80
    });
    
    // Add screenshot to session
    const screenshot = {
      timestamp: Date.now() - recordingStartTime,
      dataUrl: dataUrl,
      url: tabs[0].url,
      title: tabs[0].title
    };
    
    currentSession.screenshots.push(screenshot);
    
    // Track unique pages
    if (!currentSession.pages.find(page => page.url === tabs[0].url)) {
      currentSession.pages.push({
        url: tabs[0].url,
        title: tabs[0].title,
        firstVisit: screenshot.timestamp
      });
    }
    
    // Limit screenshots to prevent storage overflow
    if (currentSession.screenshots.length > MAX_SCREENSHOTS_PER_SESSION) {
      currentSession.screenshots = currentSession.screenshots.slice(-MAX_SCREENSHOTS_PER_SESSION);
    }
    
    updateRecordingStats();
    
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
  }
}

// Capture initial screenshot when recording starts
async function captureInitialScreenshot() {
  await captureScreenshot();
}

// Inject content script for event capture
async function injectRecordingScript(tabId) {
  try {
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['session-capture.js']
    });
    
    console.log('Content script injected for event capture');
    
  } catch (error) {
    console.error('Failed to inject content script:', error);
    throw error;
  }
}

// Listen for events from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sessionEvent' && isRecording && currentSession) {
    // Add event to current session
    const event = {
      ...message.event,
      timestamp: Date.now() - recordingStartTime
    };
    
    currentSession.events.push(event);
    updateRecordingStats();
  }
});

// Update recording status UI
function updateRecordingStatus(status, message) {
  const statusElement = document.getElementById('recordingStatus');
  const statusText = statusElement.querySelector('span');
  
  statusElement.className = `recording-status ${status}`;
  statusText.textContent = message;
  
  // Update record button
  const recordBtn = document.getElementById('startRecordingBtn');
  if (status === 'recording') {
    recordBtn.classList.add('recording');
  } else {
    recordBtn.classList.remove('recording');
  }
}

// Update recording duration
function updateRecordingDuration() {
  if (!isRecording || !recordingStartTime) return;
  
  const duration = Date.now() - recordingStartTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  document.getElementById('recordingDuration').textContent = 
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update recording statistics
function updateRecordingStats() {
  if (isRecording && currentSession) {
    document.getElementById('eventsCount').textContent = currentSession.events.length;
    document.getElementById('screenshotsCount').textContent = currentSession.screenshots.length;
    document.getElementById('pagesCount').textContent = currentSession.pages.length;
  } else {
    document.getElementById('eventsCount').textContent = '0';
    document.getElementById('screenshotsCount').textContent = '0';
    document.getElementById('pagesCount').textContent = '0';
  }
}

// Reset recording state
function resetRecordingState() {
  isRecording = false;
  currentSession = null;
  recordingStartTime = null;
  
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
  
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  
  updateRecordingStatus('idle', 'Ready to Record');
  document.getElementById('startRecordingBtn').disabled = false;
  document.getElementById('stopRecordingBtn').disabled = true;
  updateRecordingStats();
}

// Save session to storage
async function saveSession(session) {
  try {
    const { [SESSIONS_KEY]: sessions = [] } = await chrome.storage.local.get([SESSIONS_KEY]);
    
    // Add new session
    sessions.unshift(session);
    
    // Limit sessions to prevent storage overflow
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(MAX_SESSIONS);
    }
    
    await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
    console.log('Session saved successfully');
    
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

// Load sessions from storage
async function loadSessions() {
  try {
    const { [SESSIONS_KEY]: sessions = [] } = await chrome.storage.local.get([SESSIONS_KEY]);
    
    const sessionsList = document.getElementById('sessionsList');
    const emptyState = document.getElementById('emptyState');
    
    if (sessions.length === 0) {
      sessionsList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    sessionsList.style.display = 'grid';
    emptyState.style.display = 'none';
    
    // Render sessions
    sessionsList.innerHTML = sessions.map(session => renderSessionCard(session)).join('');
    
    // Add event listeners to session cards
    sessions.forEach(session => {
      const card = document.querySelector(`[data-session-id="${session.id}"]`);
      if (card) {
        card.querySelector('.btn-play').addEventListener('click', () => playSession(session));
        card.querySelector('.btn-export').addEventListener('click', () => exportSession(session));
        card.querySelector('.btn-delete').addEventListener('click', () => deleteSession(session.id));
      }
    });
    
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

// Render session card HTML
function renderSessionCard(session) {
  const duration = session.endTime ? session.endTime - session.startTime : 0;
  const durationText = formatDuration(duration);
  const dateText = new Date(session.startTime).toLocaleString();
  
  return `
    <div class="session-card" data-session-id="${session.id}">
      <div class="session-header">
        <div class="session-title">Session ${session.id.slice(-8)}</div>
        <div class="session-date">${dateText}</div>
      </div>
      
      <div class="session-stats">
        <span>📊 ${session.events.length} events</span>
        <span>📸 ${session.screenshots.length} screenshots</span>
        <span>🌐 ${session.pages.length} pages</span>
        <span>⏱️ ${durationText}</span>
      </div>
      
      <div class="session-actions">
        <button class="btn-small btn-play">▶️ Play</button>
        <button class="btn-small btn-export">📤 Export</button>
        <button class="btn-small btn-delete">🗑️ Delete</button>
      </div>
    </div>
  `;
}

// Play session replay
function playSession(session) {
  currentPlayback = session;
  currentEventIndex = 0;
  
  // Show replay section
  const replaySection = document.getElementById('replaySection');
  replaySection.style.display = 'block';
  replaySection.scrollIntoView({ behavior: 'smooth' });
  
  // Load first screenshot
  if (session.screenshots.length > 0) {
    const screenshot = document.getElementById('replayScreenshot');
    screenshot.src = session.screenshots[0].dataUrl;
  }
  
  // Reset playback controls
  document.getElementById('playPauseBtn').textContent = '▶️ Play';
  document.getElementById('replayTime').textContent = `0:00 / ${formatDuration(session.endTime - session.startTime)}`;
  
  // Reset timeline
  updateTimelineProgress(0);
  
  console.log('Starting playback for session:', session.id);
}

// Toggle playback
function togglePlayback() {
  if (!currentPlayback) return;
  
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

// Start playback
function startPlayback() {
  if (!currentPlayback || isPlaying) return;
  
  isPlaying = true;
  document.getElementById('playPauseBtn').textContent = '⏸️ Pause';
  
  // Start playback loop
  playbackInterval = setInterval(() => {
    updatePlayback();
  }, 100 / playbackSpeed); // Adjust interval based on speed
  
  console.log('Playback started');
}

// Pause playback
function pausePlayback() {
  isPlaying = false;
  document.getElementById('playPauseBtn').textContent = '▶️ Play';
  
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
  }
  
  console.log('Playback paused');
}

// Update playback
function updatePlayback() {
  if (!currentPlayback || !isPlaying) return;
  
  const sessionDuration = currentPlayback.endTime - currentPlayback.startTime;
  const currentTime = (currentEventIndex / currentPlayback.events.length) * sessionDuration;
  
  // Update timeline
  const progress = (currentTime / sessionDuration) * 100;
  updateTimelineProgress(progress);
  
  // Update time display
  document.getElementById('replayTime').textContent = 
    `${formatDuration(currentTime)} / ${formatDuration(sessionDuration)}`;
  
  // Process events
  if (currentEventIndex < currentPlayback.events.length) {
    const event = currentPlayback.events[currentEventIndex];
    processPlaybackEvent(event);
    currentEventIndex++;
  } else {
    // Playback finished
    pausePlayback();
    currentEventIndex = 0;
  }
}

// Process individual playback event
function processPlaybackEvent(event) {
  const cursor = document.getElementById('virtualCursor');
  const viewport = document.getElementById('replayViewport');
  
  switch (event.type) {
    case 'mousemove':
      // Move virtual cursor
      cursor.style.left = `${event.x}px`;
      cursor.style.top = `${event.y}px`;
      break;
      
    case 'click':
      // Show click animation
      showClickAnimation(event.x, event.y);
      break;
      
    case 'scroll':
      // Update screenshot if available for this timestamp
      updateScreenshotForTimestamp(event.timestamp);
      break;
      
    case 'navigation':
      // Update screenshot for new page
      updateScreenshotForTimestamp(event.timestamp);
      break;
  }
}

// Show click animation
function showClickAnimation(x, y) {
  const viewport = document.getElementById('replayViewport');
  const animation = document.createElement('div');
  
  animation.className = 'click-animation';
  animation.style.left = `${x - 20}px`;
  animation.style.top = `${y - 20}px`;
  
  viewport.appendChild(animation);
  
  // Remove animation after completion
  setTimeout(() => {
    if (animation.parentNode) {
      animation.parentNode.removeChild(animation);
    }
  }, 600);
}

// Update screenshot for timestamp
function updateScreenshotForTimestamp(timestamp) {
  if (!currentPlayback) return;
  
  // Find closest screenshot for this timestamp
  let closestScreenshot = currentPlayback.screenshots[0];
  let minDiff = Math.abs(timestamp - closestScreenshot.timestamp);
  
  for (const screenshot of currentPlayback.screenshots) {
    const diff = Math.abs(timestamp - screenshot.timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestScreenshot = screenshot;
    }
  }
  
  // Update screenshot
  const screenshotElement = document.getElementById('replayScreenshot');
  if (screenshotElement.src !== closestScreenshot.dataUrl) {
    screenshotElement.src = closestScreenshot.dataUrl;
  }
}

// Update timeline progress
function updateTimelineProgress(percentage) {
  const progress = document.getElementById('timelineProgress');
  const handle = document.getElementById('timelineHandle');
  
  progress.style.width = `${percentage}%`;
  handle.style.left = `${percentage}%`;
}

// Seek to timeline position
function seekToPosition(event) {
  if (!currentPlayback) return;
  
  const timeline = event.currentTarget;
  const rect = timeline.getBoundingClientRect();
  const percentage = ((event.clientX - rect.left) / rect.width) * 100;
  
  // Update playback position
  currentEventIndex = Math.floor((percentage / 100) * currentPlayback.events.length);
  updateTimelineProgress(percentage);
  
  // Update current event
  if (currentEventIndex < currentPlayback.events.length) {
    const event = currentPlayback.events[currentEventIndex];
    processPlaybackEvent(event);
  }
}

// Update playback speed
function updatePlaybackSpeed() {
  const speedSelect = document.getElementById('playbackSpeed');
  playbackSpeed = parseFloat(speedSelect.value);
  
  // Restart playback interval with new speed
  if (isPlaying) {
    clearInterval(playbackInterval);
    playbackInterval = setInterval(() => {
      updatePlayback();
    }, 100 / playbackSpeed);
  }
}

// Close replay
function closeReplay() {
  pausePlayback();
  currentPlayback = null;
  currentEventIndex = 0;
  
  document.getElementById('replaySection').style.display = 'none';
}

// Export session
function exportSession(session) {
  const dataStr = JSON.stringify(session, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `freshroute-session-${session.id}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  console.log('Session exported:', session.id);
}

// Export all sessions
async function exportAllSessions() {
  try {
    const { [SESSIONS_KEY]: sessions = [] } = await chrome.storage.local.get([SESSIONS_KEY]);
    
    if (sessions.length === 0) {
      alert('No sessions to export');
      return;
    }
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      sessions: sessions
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freshroute-all-sessions-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    console.log(`Exported ${sessions.length} sessions`);
    
  } catch (error) {
    console.error('Failed to export sessions:', error);
    alert('Failed to export sessions: ' + error.message);
  }
}

// Delete session
async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session?')) {
    return;
  }
  
  try {
    const { [SESSIONS_KEY]: sessions = [] } = await chrome.storage.local.get([SESSIONS_KEY]);
    
    const updatedSessions = sessions.filter(session => session.id !== sessionId);
    await chrome.storage.local.set({ [SESSIONS_KEY]: updatedSessions });
    
    await loadSessions();
    console.log('Session deleted:', sessionId);
    
  } catch (error) {
    console.error('Failed to delete session:', error);
    alert('Failed to delete session: ' + error.message);
  }
}

// Clear all sessions
async function clearAllSessions() {
  if (!confirm('Are you sure you want to delete ALL recorded sessions? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.set({ [SESSIONS_KEY]: [] });
    await loadSessions();
    console.log('All sessions cleared');
    
  } catch (error) {
    console.error('Failed to clear sessions:', error);
    alert('Failed to clear sessions: ' + error.message);
  }
}

// Utility functions
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2);
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Timeline drag functionality
let isDragging = false;

function startTimelineDrag(event) {
  isDragging = true;
  document.addEventListener('mousemove', handleTimelineDrag);
  document.addEventListener('mouseup', stopTimelineDrag);
  event.preventDefault();
}

function handleTimelineDrag(event) {
  if (!isDragging || !currentPlayback) return;
  
  const timeline = document.getElementById('timeline');
  const rect = timeline.getBoundingClientRect();
  const percentage = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  
  currentEventIndex = Math.floor((percentage / 100) * currentPlayback.events.length);
  updateTimelineProgress(percentage);
  
  if (currentEventIndex < currentPlayback.events.length) {
    const event = currentPlayback.events[currentEventIndex];
    processPlaybackEvent(event);
  }
}

function stopTimelineDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', handleTimelineDrag);
  document.removeEventListener('mouseup', stopTimelineDrag);
} 