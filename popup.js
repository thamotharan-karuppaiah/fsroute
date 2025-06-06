// Popup script for FreshRoute

// Session recording state - now managed via storage
let isRecording = false;
let currentSession = null;
let recordingStartTime = null;
let recordingInterval = null;
let screenshotInterval = null;

// Constants
const SESSIONS_KEY = 'freshroute_sessions';
const RECORDING_STATE_KEY = 'freshroute_recording_state';
const MAX_SESSIONS = 50;
const SCREENSHOT_INTERVAL = 5000; // 5 seconds
const MAX_SCREENSHOTS_PER_SESSION = 100;

document.addEventListener('DOMContentLoaded', async () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const urlRulesCount = document.getElementById('urlRulesCount');
  const headerRulesCount = document.getElementById('headerRulesCount');
  const activeRulesCount = document.getElementById('activeRulesCount');
  const manageRulesBtn = document.getElementById('manageRules');
  const clearRulesBtn = document.getElementById('clearRules');

  // Session recording elements
  const recordingStatus = document.getElementById('recordingStatus');
  const startRecordingBtn = document.getElementById('startRecordingBtn');
  const stopRecordingBtn = document.getElementById('stopRecordingBtn');
  const recordingDuration = document.getElementById('recordingDuration');
  const recordingEvents = document.getElementById('recordingEvents');
  const sessionsCount = document.getElementById('sessionsCount');
  const viewSessionsBtn = document.getElementById('viewSessionsBtn');
  const exportSessionsBtn = document.getElementById('exportSessionsBtn');
  const clearSessionsBtn = document.getElementById('clearSessionsBtn');

  // Load current settings
  await loadSettings();
  await loadSessionsData();
  
  // Load and sync recording state
  await loadRecordingState();

  // Extension toggle handler
  extensionToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ extensionEnabled: enabled });
    updateStatus(enabled);
    
    // Notify background script to update rules
    chrome.runtime.sendMessage({ action: 'updateRules' });
  });

  // Notifications toggle handler
  notificationsToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ notificationsEnabled: enabled });
  });

  // Manage rules button
  manageRulesBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Clear rules button
  clearRulesBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all rules? This action cannot be undone.')) {
      await chrome.storage.local.set({ rules: [], groups: [] });
      await loadSettings();
      
      // Notify background script to update rules
      chrome.runtime.sendMessage({ action: 'updateRules' });
    }
  });

  // Session recording event listeners
  startRecordingBtn.addEventListener('click', startSessionRecording);
  stopRecordingBtn.addEventListener('click', stopSessionRecording);
  viewSessionsBtn.addEventListener('click', viewAllSessions);
  exportSessionsBtn.addEventListener('click', exportAllSessions);
  clearSessionsBtn.addEventListener('click', clearAllSessions);

  // Start duration timer if recording is active
  if (isRecording) {
    recordingInterval = setInterval(updateRecordingDurationUI, 1000);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'recordingStateUpdate') {
      syncRecordingState(message.state);
    } else if (message.type === 'sessionEvent' && isRecording && currentSession) {
      // Handle session events if we have the current session context
      const event = {
        ...message.event,
        timestamp: Date.now() - recordingStartTime
      };
      
      // Update local stats (events count may be managed by background)
      updateRecordingStats();
    }
  });

  async function loadRecordingState() {
    try {
      const { [RECORDING_STATE_KEY]: recordingState } = await chrome.storage.local.get([RECORDING_STATE_KEY]);
      
      if (recordingState && recordingState.isRecording) {
        // Sync with background recording state
        isRecording = true;
        recordingStartTime = recordingState.startTime;
        currentSession = recordingState.session;
        
        // Update UI to show recording state
        updateRecordingStatusUI('recording', 'Recording...');
        
        // Show current recording duration
        updateRecordingDurationUI();
        
        // Update stats if available
        if (currentSession) {
          recordingEvents.textContent = currentSession.events?.length || 0;
        }
        
        console.log('Resumed recording state:', recordingState.session?.id);
      } else {
        // Ensure UI is in idle state
        updateRecordingStatusUI('idle', 'Ready');
        resetRecordingStats();
      }
    } catch (error) {
      console.error('Failed to load recording state:', error);
      updateRecordingStatusUI('idle', 'Ready');
    }
  }

  async function saveRecordingState() {
    try {
      const recordingState = {
        isRecording,
        startTime: recordingStartTime,
        session: currentSession
      };
      
      await chrome.storage.local.set({ [RECORDING_STATE_KEY]: recordingState });
    } catch (error) {
      console.error('Failed to save recording state:', error);
    }
  }

  function syncRecordingState(state) {
    isRecording = state.isRecording;
    recordingStartTime = state.startTime;
    currentSession = state.session;
    
    if (isRecording) {
      updateRecordingStatusUI('recording', 'Recording...');
      if (!recordingInterval) {
        recordingInterval = setInterval(updateRecordingDurationUI, 1000);
      }
    } else {
      updateRecordingStatusUI('idle', 'Ready');
      if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
      }
      resetRecordingStats();
    }
    
    updateRecordingStats();
  }

  async function loadSettings() {
    try {
      // Get settings from sync storage and rules from local storage
      const [syncData, localData] = await Promise.all([
        chrome.storage.sync.get(['extensionEnabled', 'notificationsEnabled']),
        chrome.storage.local.get(['rules', 'groups'])
      ]);
      
      const { extensionEnabled, notificationsEnabled } = syncData;
      const { rules, groups } = localData;
      
      extensionToggle.checked = extensionEnabled !== false;
      notificationsToggle.checked = notificationsEnabled !== false;
      updateStatus(extensionEnabled !== false);
      
      let allRules = [];
      
      // Use new grouped format if available, otherwise fall back to old format
      if (groups && groups.length > 0) {
        groups.forEach(group => {
          if (group.enabled !== false) { // Only count rules from enabled groups
            allRules.push(...group.rules);
          }
        });
      } else if (rules && rules.length > 0) {
        allRules = rules;
      }
      
      const urlRules = allRules.filter(r => r.type === 'url_rewrite');
      const headerRules = allRules.filter(r => r.type === 'modify_headers');
      const activeRules = allRules.filter(r => r.enabled);
      
      urlRulesCount.textContent = urlRules.length;
      headerRulesCount.textContent = headerRules.length;
      activeRulesCount.textContent = activeRules.length;
      
    } catch (error) {
      console.error('Error loading settings:', error);
      statusText.textContent = 'Error loading settings';
      statusDiv.className = 'status disabled';
    }
  }

  function updateStatus(enabled) {
    if (enabled) {
      statusText.textContent = 'Extension Enabled';
      statusDiv.className = 'status enabled';
    } else {
      statusText.textContent = 'Extension Disabled';
      statusDiv.className = 'status disabled';
    }
  }

  // Session recording functions
  async function startSessionRecording() {
    if (isRecording) return;
    
    console.log('🎬 Starting session recording from popup...');
    
    try {
      // Send message to background script to start recording
      chrome.runtime.sendMessage({ 
        action: 'startSessionRecording' 
      }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to start recording:', chrome.runtime.lastError);
          alert('Failed to start recording: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (response.success) {
          console.log('✅ Recording started successfully:', response.session);
          
          // Update local state
          isRecording = true;
          recordingStartTime = response.startTime;
          currentSession = response.session;
          
          // Save state
          await saveRecordingState();
          
          // Update UI
          updateRecordingStatusUI('recording', 'Recording...');
          
          // Start duration timer
          recordingInterval = setInterval(updateRecordingDurationUI, 1000);
          
          console.log('Session recording started:', currentSession.id);
          
          // Close popup so user can interact with the page
          window.close();
          
        } else {
          console.error('Recording failed:', response.error);
          alert('Failed to start recording: ' + response.error);
        }
      });
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording: ' + error.message);
    }
  }

  async function stopSessionRecording() {
    if (!isRecording) return;
    
    try {
      // Send message to background script to stop recording
      chrome.runtime.sendMessage({ 
        action: 'stopSessionRecording' 
      }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to stop recording:', chrome.runtime.lastError);
          alert('Failed to stop recording: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (response.success) {
          // Update local state
          isRecording = false;
          currentSession = null;
          recordingStartTime = null;
          
          // Clear interval
          if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
          }
          
          // Save state
          await saveRecordingState();
          
          // Update UI
          updateRecordingStatusUI('idle', 'Ready');
          resetRecordingStats();
          
          // Reload sessions data
          await loadSessionsData();
          
          console.log('Session recording stopped');
          alert('Session recorded successfully! Click "View All" to see your recordings.');
          
        } else {
          alert('Failed to stop recording: ' + response.error);
        }
      });
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording: ' + error.message);
    }
  }

  function updateRecordingStatusUI(status, message) {
    recordingStatus.textContent = message;
    recordingStatus.className = `recording-status ${status}`;
    
    if (status === 'recording') {
      startRecordingBtn.disabled = true;
      stopRecordingBtn.disabled = false;
    } else {
      startRecordingBtn.disabled = false;
      stopRecordingBtn.disabled = true;
    }
  }

  function updateRecordingDurationUI() {
    if (!isRecording || !recordingStartTime) return;
    
    const duration = Date.now() - recordingStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    recordingDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateRecordingStats() {
    if (isRecording && currentSession) {
      recordingEvents.textContent = currentSession.events?.length || 0;
    }
  }

  function resetRecordingStats() {
    recordingDuration.textContent = '0:00';
    recordingEvents.textContent = '0';
  }

  async function loadSessionsData() {
    try {
      const { [SESSIONS_KEY]: sessions = [] } = await chrome.storage.local.get([SESSIONS_KEY]);
      sessionsCount.textContent = sessions.length;
    } catch (error) {
      console.error('Failed to load sessions data:', error);
    }
  }

  function viewAllSessions() {
    chrome.tabs.create({ url: 'options.html#sessions' });
  }

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

  async function clearAllSessions() {
    if (!confirm('Are you sure you want to delete ALL recorded sessions? This cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.set({ [SESSIONS_KEY]: [] });
      await loadSessionsData();
      console.log('All sessions cleared');
      alert('All sessions have been cleared.');
      
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      alert('Failed to clear sessions: ' + error.message);
    }
  }

  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' || namespace === 'local') {
      loadSettings();
      if (changes[SESSIONS_KEY]) {
        loadSessionsData();
      }
      if (changes[RECORDING_STATE_KEY]) {
        loadRecordingState();
      }
    }
  });
}); 