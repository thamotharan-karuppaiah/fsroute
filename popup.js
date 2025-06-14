// Popup script for FreshRoute

document.addEventListener('DOMContentLoaded', async () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const environmentSelect = document.getElementById('environmentSelect');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const urlRulesCount = document.getElementById('urlRulesCount');
  const headerRulesCount = document.getElementById('headerRulesCount');
  const activeRulesCount = document.getElementById('activeRulesCount');
  const manageRulesBtn = document.getElementById('manageRules');
  const clearRulesBtn = document.getElementById('clearRules');

  // Load current settings and environments
  await loadSettings();
  await loadEnvironments();

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

  // Environment change handler
  environmentSelect.addEventListener('change', async (e) => {
    const selectedEnvironment = e.target.value;
    if (selectedEnvironment) {
      console.log(`🔄 Switching to environment: ${selectedEnvironment}`);
      
      // Show loading state
      const originalText = statusText.textContent;
      statusText.textContent = 'Switching environment...';
      statusDiv.className = 'status';
      
      try {
        // Send message to background script to switch environment
        const response = await chrome.runtime.sendMessage({
          action: 'switchEnvironment',
          environmentName: selectedEnvironment
        });
        
        if (response.success) {
          // Update current environment in sync storage
          await chrome.storage.sync.set({ currentEnvironment: selectedEnvironment });
          
          // Reload settings to reflect changes
          await loadSettings();
          console.log(`✅ Successfully switched to ${selectedEnvironment}`);
        } else {
          console.error('❌ Failed to switch environment:', response.error);
          statusText.textContent = 'Error switching environment';
          statusDiv.className = 'status disabled';
        }
      } catch (error) {
        console.error('❌ Error switching environment:', error);
        statusText.textContent = 'Error switching environment';
        statusDiv.className = 'status disabled';
      }
    }
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

  // Load available environments
  async function loadEnvironments() {
    try {
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(['environments']),
        chrome.storage.sync.get(['currentEnvironment'])
      ]);
      
      const { environments } = localData;
      const { currentEnvironment } = syncData;
      
      // Clear existing options
      environmentSelect.innerHTML = '';
      
      if (environments && environments.length > 0) {
        environments.forEach(env => {
          const option = document.createElement('option');
          option.value = env.name;
          option.textContent = env.name;
          if (env.description) {
            option.title = env.description;
          }
          if (env.name === currentEnvironment) {
            option.selected = true;
          }
          environmentSelect.appendChild(option);
        });
      } else {
        // Add default environment if none exist
        const defaultOption = document.createElement('option');
        defaultOption.value = 'Default';
        defaultOption.textContent = 'Default';
        defaultOption.selected = true;
        environmentSelect.appendChild(defaultOption);
      }
      
      console.log(`🌍 Loaded ${environments?.length || 1} environments, current: ${currentEnvironment || 'Default'}`);
    } catch (error) {
      console.error('Error loading environments:', error);
      
      // Fallback to default
      environmentSelect.innerHTML = '<option value="Default" selected>Default</option>';
    }
  }

  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' || namespace === 'local') {
      loadSettings();
      if (changes.environments || changes.currentEnvironment) {
        loadEnvironments();
      }
    }
  });
}); 