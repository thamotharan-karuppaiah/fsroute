// Options page script for FreshRoute

let groups = [];
let editingGroupIndex = null;
let editingRuleIndex = null;
let editingRuleType = null;
let environmentVariables = [];
let editingEnvironmentVariableIndex = null;

// Preset group templates
const PRESET_TEMPLATES = {
  freshservice: {
    name: 'Freshservice',
    description: 'Complete setup for Freshservice development environment with URL redirection and authentication headers',
    icon: 'icons/freshservice.png',
    variables: [
      {
        key: 'sourceDomain',
        label: 'Source Domain',
        placeholder: 'e.g., localhost.freshservice-dev.com',
        required: true,
        type: 'text',
        defaultValue: 'localhost.freshservice-dev.com'
      },
      {
        key: 'targetDomain', 
        label: 'Target Domain',
        placeholder: 'e.g., infinity-share.freshinfinitysquad.com',
        required: true,
        type: 'text',
        defaultValue: 'infinity-share.freshinfinitysquad.com'
      },
      {
        key: 'cookieValue',
        label: 'Cookie Value',
        placeholder: 'session=abc123...',
        required: true,
        type: 'text'
      },
      {
        key: 'csrfToken',
        label: 'X-CSRF-TOKEN',
        placeholder: 'csrf-token-value',
        required: false,
        type: 'text'
      }
    ],
    generateRules: function(variables) {
      const rules = [];
      
      // URL Rewrite Rule for API calls (assuming common ports)
      if (variables.sourceDomain && variables.targetDomain) {
        rules.push({
          id: 'freshservice-api-redirect',
          name: 'Freshservice Main API Redirect',
          type: 'url_rewrite',
          sourceUrl: `^http://${escapeRegex(variables.sourceDomain)}:3000/(api|support/v1|support/v2|support/employee_offboarding|lookup_choices)(.*)`,
          targetUrl: `https://${variables.targetDomain}/$1$2`,
          enabled: true
        });
        
        // Main page redirect for both ports
        rules.push({
          id: 'freshservice-microservices-redirect', 
          name: 'Freshservice Microservices Redirect',
          type: 'url_rewrite',
          sourceUrl: `^http://${escapeRegex(variables.sourceDomain)}:(8080|4000)/(.*)$`,
          targetUrl: `https://${variables.targetDomain}/$2`,
          enabled: true
        });
        
        // Additional rule for port 4000 to 8080 general redirect
        rules.push({
          id: 'freshservice-microservices-redirect-extendd', 
          name: 'Freshservice Microservices Redirect (Extend)',
          type: 'url_rewrite',
          sourceUrl: `^http://${escapeRegex(variables.targetDomain)}:(8080|4000)/(.*)$`,
          targetUrl: `https://${variables.targetDomain}/$2`,
          enabled: true
        });
      }
      
      // Header modification rule for authentication
      if (variables.targetDomain && (variables.cookieValue || variables.csrfToken)) {
        const headers = [];
        
        // Request headers (these work reliably)
        if (variables.cookieValue) {
          headers.push({
            name: 'Cookie',
            value: variables.cookieValue,
            operation: 'set',
            target: 'request'
          });
        }
        
        if (variables.csrfToken) {
          headers.push({
            name: 'X-CSRF-TOKEN',
            value: variables.csrfToken,
            operation: 'set',
            target: 'request'
          });
        }
        
        // Response headers (limited set that CAN be modified)
        headers.push(
          {
            name: 'X-Extension-Modified',
            value: 'true',
            operation: 'set',
            target: 'response'
          },
          {
            name: 'X-Debug-Info',
            value: 'Freshservice-Extension-Active',
            operation: 'set',
            target: 'response'
          },
          {
            name: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
            operation: 'set',
            target: 'response'
          }
        );
        
        if (headers.length > 0) {
          rules.push({
            id: 'freshservice-headers',
            name: 'Freshservice Authentication Headers',
            type: 'modify_headers',
            urlPattern: `^https://${escapeRegex(variables.targetDomain)}/.*`,
            headers: headers,
            enabled: true
          });
        }
      }
      
      return rules;
    }
  },
  freshdesk: {
    name: 'Freshdesk',
    description: 'Complete setup for Freshdesk development environment with URL redirection and authentication headers',
    icon: 'icons/freshdesk.png',
    variables: [],
    disabled: true,
    generateRules: function(variables) {
      const rules = [];
      return rules;
    }
  },
  freshsales: {
    name: 'Freshsales',
    description: 'Complete setup for Freshsales development environment with URL redirection and authentication headers',
    icon: 'icons/freshsales.png',
    variables: [],
    disabled: true,
    generateRules: function(variables) {
      const rules = [];
      return rules;
    }
  },
  freshmarketer: {
    name: 'Freshmarketer',
    description: 'Complete setup for Freshmarketer development environment with URL redirection and authentication headers',
    icon: 'icons/freshmarketer.png',
    variables: [],
    disabled: true,
    generateRules: function(variables) {
      const rules = [];
      return rules;
    }
  }
  // Additional presets can be added here
};

// Helper function to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadGroupsAndRules();
  await loadEnvironmentVariables();
  setupEventListeners();
  setupSettingsListeners();
  renderGroups();
  renderEnvironmentVariables();
  loadSettings();
});

// Setup event listeners to replace inline event handlers
function setupEventListeners() {
  // URL Rule buttons
  document.getElementById('closeUrlModal').addEventListener('click', () => closeUrlRuleModal());
  document.getElementById('saveUrlRuleBtn').addEventListener('click', () => saveUrlRule());
  document.getElementById('cancelUrlRuleBtn').addEventListener('click', () => closeUrlRuleModal());

  // Header Rule buttons
  document.getElementById('closeHeaderModal').addEventListener('click', () => closeHeaderRuleModal());
  document.getElementById('saveHeaderRuleBtn').addEventListener('click', () => saveHeaderRule());
  document.getElementById('cancelHeaderRuleBtn').addEventListener('click', () => closeHeaderRuleModal());
  document.getElementById('addHeaderFieldBtn').addEventListener('click', () => addHeaderField());

  // Group buttons
  document.getElementById('addGroupBtn').addEventListener('click', () => openGroupModal());
  document.getElementById('closeGroupModal').addEventListener('click', () => closeGroupModal());
  document.getElementById('saveGroupBtn').addEventListener('click', () => saveGroup());
  document.getElementById('cancelGroupBtn').addEventListener('click', () => closeGroupModal());

  // Preset buttons
  document.getElementById('addPresetGroupBtn').addEventListener('click', () => openPresetModal());
  document.getElementById('closePresetModal').addEventListener('click', () => closePresetModal());
  document.getElementById('createPresetGroupBtn').addEventListener('click', () => createPresetGroup());
  document.getElementById('cancelPresetBtn').addEventListener('click', () => closePresetModal());

  // Environment Variable buttons
  document.getElementById('addEnvironmentVariableBtn').addEventListener('click', () => openEnvironmentVariableModal());
  document.getElementById('closeEnvironmentVariableModal').addEventListener('click', () => closeEnvironmentVariableModal());
  document.getElementById('saveEnvironmentVariableBtn').addEventListener('click', () => saveEnvironmentVariable());
  document.getElementById('cancelEnvironmentVariableBtn').addEventListener('click', () => closeEnvironmentVariableModal());

  // Import button (unified)
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (e) => importRules(e));

  // Regex testing buttons
  document.getElementById('testSourceUrlBtn').addEventListener('click', () => testRegexPattern('sourceUrl', 'sourceUrlTest', 'sourceUrlResult', 'targetUrl', 'targetUrlPreview'));
  document.getElementById('testHeaderUrlBtn').addEventListener('click', () => testHeaderRegexPattern('headerUrlPattern', 'headerUrlTest', 'headerUrlResult'));

  // Test section toggle buttons
  document.getElementById('toggleSourceUrlTest').addEventListener('click', () => toggleTestSection('sourceUrlTestSection', 'toggleSourceUrlTest', 'targetUrlExamples'));
  document.getElementById('toggleHeaderUrlTest').addEventListener('click', () => toggleTestSection('headerUrlTestSection', 'toggleHeaderUrlTest'));

  // Real-time regex testing on input change
  document.getElementById('sourceUrl').addEventListener('input', () => {
    clearRegexResult('sourceUrlResult');
    clearRegexResult('targetUrlPreview');
  });
  document.getElementById('headerUrlPattern').addEventListener('input', () => {
    clearRegexResult('headerUrlResult');
  });
  document.getElementById('targetUrl').addEventListener('input', () => {
    // Re-test if there's a test URL and source pattern
    const testUrl = document.getElementById('sourceUrlTest').value.trim();
    const sourcePattern = document.getElementById('sourceUrl').value.trim();
    if (testUrl && sourcePattern) {
      testRegexPattern('sourceUrl', 'sourceUrlTest', 'sourceUrlResult', 'targetUrl', 'targetUrlPreview');
    }
  });

  // Matching type change handler
  document.getElementById('matchingType').addEventListener('change', () => {
    updateMatchingTypeUI();
  });

  // Header matching type change handler
  document.getElementById('headerMatchingType').addEventListener('change', () => {
    updateHeaderMatchingTypeUI();
  });

  // Example pattern buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-example')) {
      const targetField = e.target.dataset.target;
      const pattern = e.target.dataset.pattern;
      insertExamplePattern(targetField, pattern);
    }
  });

  // Close modals when clicking outside - REPLACED by setupModalCloseHandling()
  // Old logic removed to prevent issues with text selection and drag operations
  // The new logic in setupModalCloseHandling() properly handles these cases

  // Improved modal close logic that handles text selection properly
  setupModalCloseHandling();

  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeUrlRuleModal();
      closeHeaderRuleModal();
      closeGroupModal();
      closePresetModal();
      closeEnvironmentVariableModal();
    }
  });

  // Global click handler for dropdown menus
  document.addEventListener('click', (event) => {
    // Close any open dropdowns when clicking outside
    document.querySelectorAll('.add-rule-dropdown-content.show').forEach(dropdown => {
      if (!dropdown.closest('.add-rule-dropdown').contains(event.target)) {
        dropdown.classList.remove('show');
      }
    });
  });

  // Tab switching functionality
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.dataset.tab;
      switchTab(targetTab);
    });
  });

  // View switching functionality
  document.getElementById('rulesTab').addEventListener('click', () => {
    showRulesView();
    updateTabNavigation('rules');
  });
  
  document.getElementById('settingsTab').addEventListener('click', () => {
    showSettingsView();
    updateTabNavigation('settings');
  });
  
  document.getElementById('backToRulesBtn').addEventListener('click', () => {
    showRulesView();
  });
  
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    // Open dashboard in new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
}

// Setup settings listeners
function setupSettingsListeners() {
  const notificationsToggle = document.getElementById('notificationsEnabledToggle');
  const compactNotificationsToggle = document.getElementById('compactNotificationsToggle');
  const exportEnvVariablesToggle = document.getElementById('exportEnvironmentVariablesToggle');
  
  if (notificationsToggle) {
    notificationsToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await chrome.storage.sync.set({ notificationsEnabled: enabled });
    });
  }
  
  if (compactNotificationsToggle) {
    compactNotificationsToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await chrome.storage.sync.set({ compactNotifications: enabled });
    });
  }
  
  if (exportEnvVariablesToggle) {
    exportEnvVariablesToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await chrome.storage.sync.set({ exportEnvironmentVariables: enabled });
    });
  }
}

// Load settings
async function loadSettings() {
  try {
    const { notificationsEnabled, compactNotifications, exportEnvironmentVariables } = await chrome.storage.sync.get(['notificationsEnabled', 'compactNotifications', 'exportEnvironmentVariables']);
    const notificationsToggle = document.getElementById('notificationsEnabledToggle');
    const compactNotificationsToggle = document.getElementById('compactNotificationsToggle');
    const exportEnvVariablesToggle = document.getElementById('exportEnvironmentVariablesToggle');
    
    if (notificationsToggle) {
      notificationsToggle.checked = notificationsEnabled !== false;
    }
    
    if (compactNotificationsToggle) {
      compactNotificationsToggle.checked = compactNotifications !== false; // Default to true
    }
    
    if (exportEnvVariablesToggle) {
      exportEnvVariablesToggle.checked = exportEnvironmentVariables === true; // Default to false
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load groups and migrate from old rules format
async function loadGroupsAndRules() {
  try {
    // Try local storage first (new method)
    let result = await chrome.storage.local.get(['groups', 'rules']);
    
    // If no data in local storage, try sync storage (for migration)
    if (!result.groups && !result.rules) {
      result = await chrome.storage.sync.get(['groups', 'rules']);
      
      // If we found data in sync storage, migrate it to local storage
      if (result.groups || result.rules) {
        console.log('Migrating data from sync to local storage...');
        await chrome.storage.local.set(result);
        // Keep sync storage clean by removing large data
        await chrome.storage.sync.remove(['groups', 'rules']);
      }
    }
    
    if (result.groups) {
      groups = result.groups;
    } else {
      // Migrate from old format
      groups = await migrateFromOldFormat(result.rules || []);
      await saveGroups();
    }
  } catch (error) {
    console.error('Error loading groups and rules:', error);
    groups = [];
  }
}

// Load environment variables
async function loadEnvironmentVariables() {
  try {
    const result = await chrome.storage.sync.get(['environmentVariables']);
    environmentVariables = result.environmentVariables || [];
  } catch (error) {
    console.error('Error loading environment variables:', error);
    environmentVariables = [];
  }
}

// Save environment variables
async function saveEnvironmentVariables() {
  try {
    await chrome.storage.sync.set({ environmentVariables });
    console.log('💾 Environment variables saved to storage');
    
    // Explicitly trigger rule update in background script
    // Small delay to ensure storage change is processed first
    setTimeout(() => {
      console.log('🚀 Triggering rule update...');
      chrome.runtime.sendMessage({ action: 'updateRules' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Error sending update message:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('✅ Rules updated successfully after environment variable change');
        } else {
          console.warn('⚠️ Rule update may have failed:', response?.error);
        }
      });
    }, 50); // Reduced timeout for faster response
    
  } catch (error) {
    console.error('Error saving environment variables:', error);
    alert('Error saving environment variables. Please try again.');
  }
}

// Render environment variables
function renderEnvironmentVariables() {
  const container = document.getElementById('environmentVariables');
  
  if (environmentVariables.length === 0) {
    container.innerHTML = `
      <div class="env-empty-state">
        <h3>📋 No Environment Variables</h3>
        <p>Create reusable variables to avoid repetition in your rules.</p>
        <p>Variables can be used in URL patterns, target URLs, and header values.</p>
        <p>Click "Add Variable" to create your first environment variable.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="env-variables-container">
      ${environmentVariables.map((variable, index) => `
        <div class="env-variable-card">
          <div class="env-variable-info">
            <div class="env-variable-name">${escapeHtml(variable.name)}</div>
            <div class="env-variable-value">Value: ${escapeHtml(variable.value)}</div>
            ${variable.description ? `<div class="env-variable-description">${escapeHtml(variable.description)}</div>` : ''}
            <div class="env-variable-usage">Usage: {{${escapeHtml(variable.name)}}}</div>
          </div>
          <div class="env-variable-actions">
            <button class="btn btn-secondary btn-small env-variable-edit" data-index="${index}">Edit</button>
            <button class="btn btn-danger btn-small env-variable-delete" data-index="${index}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Add event listeners for environment variable actions
  addEnvironmentVariableListeners();
}

// Add event listeners for environment variable controls
function addEnvironmentVariableListeners() {
  // Edit buttons
  document.querySelectorAll('.env-variable-edit').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      editEnvironmentVariable(index);
    });
  });

  // Delete buttons
  document.querySelectorAll('.env-variable-delete').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      deleteEnvironmentVariable(index);
    });
  });
}

// Migrate from old flat rules format to grouped format
async function migrateFromOldFormat(oldRules) {
  if (oldRules.length === 0) return [];
  
  // Create a single unified group with all rules
  const unifiedGroup = {
    id: 'default-mixed-' + Date.now(),
    name: 'Default Rules',
    expanded: true,
    enabled: true,
    rules: oldRules
  };

  return [unifiedGroup];
}

// Save groups to storage
async function saveGroups() {
  try {
    // Use local storage for large data (rules and groups)
    await chrome.storage.local.set({ groups });
    
    // Also save flat rules for backward compatibility (without variable substitution)
    const flatRules = [];
    groups.forEach(group => {
      if (group.enabled !== false) {
        group.rules.forEach(rule => {
          if (rule.enabled) {
            flatRules.push(rule);
          }
        });
      }
    });
    await chrome.storage.local.set({ rules: flatRules });
    
    // Notify background script to update rules
    chrome.runtime.sendMessage({ action: 'updateRules' });
  } catch (error) {
    console.error('Error saving groups:', error);
    alert('Error saving groups. Please try again.');
  }
}

// Render all groups
function renderGroups() {
  const container = document.getElementById('allGroups');

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No rule groups configured.</p>
        <p>Click "Add Group" to create your first group.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = groups.map((group, groupIndex) => {
    const enabledRules = group.rules.filter(rule => rule.enabled).length;
    const groupEnabled = group.enabled !== false; // Default to true if not set
    
    // Count rule types
    const urlRules = group.rules.filter(rule => rule.type === 'url_rewrite').length;
    const headerRules = group.rules.filter(rule => rule.type === 'modify_headers').length;
    
    let typeIndicator = '';
    if (urlRules > 0 && headerRules > 0) {
      typeIndicator = `<span class="mixed-group-indicator">Mixed (${urlRules} URL, ${headerRules} Headers)</span>`;
    } else if (urlRules > 0) {
      typeIndicator = `<span class="rule-type-indicator url-rewrite">URL Rewrite</span>`;
    } else if (headerRules > 0) {
      typeIndicator = `<span class="rule-type-indicator header-modify">Headers</span>`;
    }
    
    return `
      <div class="group-container">
        <div class="group-header ${group.expanded === false ? 'collapsed' : ''}" data-group-index="${groupIndex}">
          <div class="group-left">
            <span class="group-expand ${group.expanded === false ? 'collapsed' : ''}" data-group-index="${groupIndex}">▼</span>
            <span class="group-name">${escapeHtml(group.name)}</span>
            <span class="group-count">${group.rules.length} rules (${enabledRules} enabled)</span>
            ${typeIndicator}
          </div>
          <div class="group-toggle">
            <label class="toggle-switch">
              <input type="checkbox" ${groupEnabled ? 'checked' : ''} 
                     data-group-index="${groupIndex}" class="group-toggle-switch">
              <span class="slider"></span>
            </label>
          </div>
          <div class="group-actions">
            <div class="add-rule-dropdown">
              <button class="btn btn-success btn-small add-rule-toggle" data-group-index="${groupIndex}">Add Rule ▼</button>
              <div class="add-rule-dropdown-content" data-group-index="${groupIndex}">
                <button class="add-rule-option" data-group-index="${groupIndex}" data-rule-type="url_rewrite">🔗 URL Rewrite Rule</button>
                <button class="add-rule-option" data-group-index="${groupIndex}" data-rule-type="modify_headers">📝 Header Modification Rule</button>
              </div>
            </div>
            <button class="btn export-btn btn-small group-export" data-group-index="${groupIndex}">Export</button>
            <button class="btn btn-secondary btn-small group-edit" data-group-index="${groupIndex}">Edit</button>
            <button class="btn btn-danger btn-small group-delete" data-group-index="${groupIndex}">Delete</button>
          </div>
        </div>
        <div class="group-content" style="display: ${group.expanded === false ? 'none' : 'block'}">
          ${group.rules.length > 0 ? renderRulesInGroup(group.rules, groupIndex) : '<div class="empty-group">No rules in this group. Click "Add Rule" to add the first rule.</div>'}
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for group controls
  addGroupControlListeners();
}

// Render rules within a group
function renderRulesInGroup(rules, groupIndex) {
  return rules.map((rule, ruleIndex) => {
    const ruleTypeIndicator = rule.type === 'url_rewrite' 
      ? '<span class="rule-type-indicator url-rewrite">URL</span>' 
      : '<span class="rule-type-indicator header-modify">Header</span>';
    
    const isFirstRule = ruleIndex === 0;
    const isLastRule = ruleIndex === rules.length - 1;
    
    if (rule.type === 'url_rewrite') {
      return `
        <div class="rule-card ${rule.enabled ? 'enabled' : 'disabled'}">
          <div class="rule-header">
            <div class="rule-left">
              <div class="rule-title">${escapeHtml(rule.name || 'Unnamed Rule')} ${ruleTypeIndicator}</div>
            </div>
            <div class="rule-controls">
              <label class="toggle-switch">
                <input type="checkbox" ${rule.enabled ? 'checked' : ''} 
                       data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" class="rule-toggle">
                <span class="slider"></span>
              </label>
              <div class="rule-reorder-controls">
                <button class="btn btn-reorder rule-move-up" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" 
                        ${isFirstRule ? 'disabled' : ''} title="Move Up">▲</button>
                <button class="btn btn-reorder rule-move-down" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" 
                        ${isLastRule ? 'disabled' : ''} title="Move Down">▼</button>
              </div>
              <button class="btn btn-duplicate btn-small rule-duplicate" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}">Duplicate</button>
              <button class="btn btn-secondary btn-small rule-edit" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" data-rule-type="url">Edit</button>
              <button class="btn btn-danger btn-small rule-delete" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}">Delete</button>
            </div>
          </div>
          <div class="rule-details">
            <div><strong>Type:</strong> ${getMatchingTypeDisplayName(rule.matchingType || 'regex')}</div>
            <div><strong>Source:</strong> <code>${escapeHtml(rule.sourceUrl)}</code></div>
            <div><strong>Target:</strong> <code>${escapeHtml(rule.targetUrl)}</code></div>
          </div>
        </div>
      `;
    } else if (rule.type === 'modify_headers') {
      return `
        <div class="rule-card ${rule.enabled ? 'enabled' : 'disabled'}">
          <div class="rule-header">
            <div class="rule-left">
              <div class="rule-title">${escapeHtml(rule.name || 'Unnamed Rule')} ${ruleTypeIndicator}</div>
            </div>
            <div class="rule-controls">
              <label class="toggle-switch">
                <input type="checkbox" ${rule.enabled ? 'checked' : ''} 
                       data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" class="rule-toggle">
                <span class="slider"></span>
              </label>
              <div class="rule-reorder-controls">
                <button class="btn btn-reorder rule-move-up" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" 
                        ${isFirstRule ? 'disabled' : ''} title="Move Up">▲</button>
                <button class="btn btn-reorder rule-move-down" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" 
                        ${isLastRule ? 'disabled' : ''} title="Move Down">▼</button>
              </div>
              <button class="btn btn-duplicate btn-small rule-duplicate" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}">Duplicate</button>
              <button class="btn btn-secondary btn-small rule-edit" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}" data-rule-type="header">Edit</button>
              <button class="btn btn-danger btn-small rule-delete" data-group-index="${groupIndex}" data-rule-index="${ruleIndex}">Delete</button>
            </div>
          </div>
          <div class="rule-details">
            <div><strong>Type:</strong> ${getMatchingTypeDisplayName(rule.matchingType || 'regex')}</div>
            <div><strong>URL Pattern:</strong> <code>${escapeHtml(rule.urlPattern)}</code></div>
            <div><strong>Headers:</strong></div>
            <ul>
              ${rule.headers.map(header => `
                <li><strong>${escapeHtml(header.name)}</strong> (${header.operation}) 
                    ${header.target} ${header.value ? `→ ${escapeHtml(header.value)}` : ''}</li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    }
  }).join('');
}

// Add event listeners for group and rule controls
function addGroupControlListeners() {
  // Group expand/collapse - only on the expand arrow
  document.querySelectorAll('.group-expand').forEach(arrow => {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(arrow.dataset.groupIndex);
      toggleGroup(groupIndex);
    });
  });

  // Group header click (but not on controls)
  document.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Only trigger on the header itself, not on controls
      if (e.target === header || e.target.classList.contains('group-name')) {
        const groupIndex = parseInt(header.dataset.groupIndex);
        toggleGroup(groupIndex);
      }
    });
  });

  // Group enable/disable toggles
  document.querySelectorAll('.group-toggle-switch').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      toggleGroupEnabled(groupIndex);
    });
  });

  // Add Rule dropdown toggles
  document.querySelectorAll('.add-rule-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      toggleAddRuleDropdown(groupIndex);
    });
  });

  // Add Rule dropdown options
  document.querySelectorAll('.add-rule-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleType = e.target.dataset.ruleType;
      addRuleToGroup(groupIndex, ruleType);
      
      // Close the dropdown
      const dropdown = e.target.closest('.add-rule-dropdown-content');
      dropdown.classList.remove('show');
    });
  });

  document.querySelectorAll('.group-export').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      await exportGroup(groupIndex);
    });
  });

  document.querySelectorAll('.group-edit').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      editGroup(groupIndex);
    });
  });

  document.querySelectorAll('.group-delete').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      deleteGroup(groupIndex);
    });
  });

  // Rule toggle switches
  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      toggleRule(groupIndex, ruleIndex);
    });
  });

  // Rule edit buttons
  document.querySelectorAll('.rule-edit').forEach(button => {
    button.addEventListener('click', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      const type = e.target.dataset.ruleType;
      if (type === 'url') {
        editUrlRule(groupIndex, ruleIndex);
      } else if (type === 'header') {
        editHeaderRule(groupIndex, ruleIndex);
      }
    });
  });

  // Rule delete buttons
  document.querySelectorAll('.rule-delete').forEach(button => {
    button.addEventListener('click', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      deleteRule(groupIndex, ruleIndex);
    });
  });

  // Rule duplicate buttons
  document.querySelectorAll('.rule-duplicate').forEach(button => {
    button.addEventListener('click', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      duplicateRule(groupIndex, ruleIndex);
    });
  });

  // Rule reorder buttons
  document.querySelectorAll('.rule-move-up').forEach(button => {
    button.addEventListener('click', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      moveRuleUp(groupIndex, ruleIndex);
    });
  });

  document.querySelectorAll('.rule-move-down').forEach(button => {
    button.addEventListener('click', (e) => {
      const groupIndex = parseInt(e.target.dataset.groupIndex);
      const ruleIndex = parseInt(e.target.dataset.ruleIndex);
      moveRuleDown(groupIndex, ruleIndex);
    });
  });
}

// Group management functions
function toggleGroup(groupIndex) {
  groups[groupIndex].expanded = groups[groupIndex].expanded !== false ? false : true;
  saveGroups();
  renderGroups();
}

function toggleGroupEnabled(groupIndex) {
  groups[groupIndex].enabled = !groups[groupIndex].enabled;
  // When disabling a group, disable all its rules
  // When enabling a group, keep individual rule states
  if (!groups[groupIndex].enabled) {
    groups[groupIndex].rules.forEach(rule => {
      rule.wasEnabled = rule.enabled; // Remember original state
      rule.enabled = false;
    });
  } else {
    groups[groupIndex].rules.forEach(rule => {
      // Restore original state if it was saved, otherwise enable
      rule.enabled = rule.wasEnabled !== undefined ? rule.wasEnabled : true;
      delete rule.wasEnabled; // Clean up
    });
  }
  saveGroups();
  renderGroups();
}

function toggleAddRuleDropdown(groupIndex) {
  // Close all other dropdowns first
  document.querySelectorAll('.add-rule-dropdown-content.show').forEach(dropdown => {
    dropdown.classList.remove('show');
  });
  
  // Toggle the clicked dropdown
  const dropdown = document.querySelector(`.add-rule-dropdown-content[data-group-index="${groupIndex}"]`);
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function addRuleToGroup(groupIndex, ruleType) {
  const group = groups[groupIndex];
  if (ruleType === 'url_rewrite') {
    openUrlRuleModal(groupIndex);
  } else if (ruleType === 'modify_headers') {
    openHeaderRuleModal(groupIndex);
  }
}

async function exportGroup(groupIndex) {
  const group = groups[groupIndex];
  
  // Check if environment variables should be exported
  const { exportEnvironmentVariables } = await chrome.storage.sync.get(['exportEnvironmentVariables']);
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    groups: [group]
  };
  
  // Include environment variables if setting is enabled
  if (exportEnvironmentVariables === true && environmentVariables.length > 0) {
    exportData.environmentVariables = environmentVariables;
  }
  
  const fileName = `${group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
  downloadJSON(exportData, fileName);
}

// Toggle rule enabled/disabled
async function toggleRule(groupIndex, ruleIndex) {
  groups[groupIndex].rules[ruleIndex].enabled = !groups[groupIndex].rules[ruleIndex].enabled;
  await saveGroups();
  renderGroups();
}

// Delete rule
async function deleteRule(groupIndex, ruleIndex) {
  if (confirm('Are you sure you want to delete this rule?')) {
    groups[groupIndex].rules.splice(ruleIndex, 1);
    await saveGroups();
    renderGroups();
  }
}

// Group Modal Functions
function openGroupModal(groupIndex = null) {
  editingGroupIndex = groupIndex;
  
  const modal = document.getElementById('groupModal');
  const nameInput = document.getElementById('groupName');

  if (groupIndex !== null) {
    const group = groups[groupIndex];
    nameInput.value = group.name || '';
  } else {
    nameInput.value = '';
  }

  modal.style.display = 'block';
  nameInput.focus();
}

function closeGroupModal() {
  document.getElementById('groupModal').style.display = 'none';
  editingGroupIndex = null;
}

function editGroup(index) {
  openGroupModal(index);
}

async function deleteGroup(index) {
  if (confirm('Are you sure you want to delete this group and all its rules?')) {
    groups.splice(index, 1);
    await saveGroups();
    renderGroups();
  }
}

async function saveGroup() {
  const name = document.getElementById('groupName').value.trim();

  if (!name) {
    alert('Please enter a group name.');
    return;
  }

  const group = {
    id: editingGroupIndex !== null ? groups[editingGroupIndex].id : Date.now().toString(),
    name,
    expanded: editingGroupIndex !== null ? groups[editingGroupIndex].expanded : true,
    enabled: editingGroupIndex !== null ? groups[editingGroupIndex].enabled : true,
    rules: editingGroupIndex !== null ? groups[editingGroupIndex].rules : []
  };

  if (editingGroupIndex !== null) {
    groups[editingGroupIndex] = group;
  } else {
    groups.push(group);
  }

  await saveGroups();
  renderGroups();
  closeGroupModal();
}

// URL Rule Modal Functions
function openUrlRuleModal(groupIndex = null, ruleIndex = null) {
  editingRuleIndex = ruleIndex;
  editingRuleType = 'url_rewrite';
  editingGroupIndex = groupIndex; // Store the group index for saving
  
  const modal = document.getElementById('urlRuleModal');
  const matchingTypeSelect = document.getElementById('matchingType');
  const sourceInput = document.getElementById('sourceUrl');
  const targetInput = document.getElementById('targetUrl');

  if (groupIndex !== null && ruleIndex !== null) {
    const rule = groups[groupIndex].rules[ruleIndex];
    matchingTypeSelect.value = rule.matchingType || 'regex';
    sourceInput.value = rule.sourceUrl || '';
    targetInput.value = rule.targetUrl || '';
  } else {
    matchingTypeSelect.value = 'regex';
    sourceInput.value = '';
    targetInput.value = '';
  }

  // Reset test sections to hidden state
  resetTestSection('sourceUrlTestSection', 'toggleSourceUrlTest');
  resetTestSection('targetUrlExamples');
  clearRegexResult('sourceUrlResult');
  clearRegexResult('targetUrlPreview');

  // Update UI based on matching type
  updateMatchingTypeUI();

  // Add variable support to input fields
  addVariableSuggestions(sourceInput);
  addVariableSuggestions(targetInput);

  modal.style.display = 'block';
  sourceInput.focus();
}

function closeUrlRuleModal() {
  document.getElementById('urlRuleModal').style.display = 'none';
  editingRuleIndex = null;
  editingRuleType = null;
  editingGroupIndex = null;
}

function editUrlRule(groupIndex, ruleIndex) {
  openUrlRuleModal(groupIndex, ruleIndex);
}

async function saveUrlRule() {
  const matchingType = document.getElementById('matchingType').value;
  const sourceUrl = document.getElementById('sourceUrl').value.trim();
  const targetUrl = document.getElementById('targetUrl').value.trim();

  if (!sourceUrl || !targetUrl) {
    alert('Please fill in both source and target URL patterns.');
    return;
  }

  if (editingGroupIndex === null) {
    alert('No group specified for this rule.');
    return;
  }

  // Validate based on matching type
  if (matchingType === 'regex') {
    try {
      new RegExp(sourceUrl);
    } catch (e) {
      alert('Invalid source URL regex pattern: ' + e.message);
      return;
    }
  }
  // For other matching types, basic validation
  else {
    if (matchingType === 'contains' && sourceUrl.length < 3) {
      alert('Contains text should be at least 3 characters long for meaningful matching.');
      return;
    }
    if (matchingType === 'startsWith' && !sourceUrl.includes('://')) {
      if (!confirm('URL doesn\'t include protocol (http:// or https://). Continue anyway?')) {
        return;
      }
    }
  }

  // Auto-generate rule name based on patterns
  let ruleName;
  if (editingRuleIndex !== null) {
    // Keep existing name if editing
    ruleName = groups[editingGroupIndex].rules[editingRuleIndex].name || generateUrlRuleName(sourceUrl, targetUrl, matchingType);
  } else {
    // Generate new name
    ruleName = generateUrlRuleName(sourceUrl, targetUrl, matchingType);
  }

  const rule = {
    id: editingRuleIndex !== null ? groups[editingGroupIndex].rules[editingRuleIndex].id : Date.now(),
    type: 'url_rewrite',
    name: ruleName,
    matchingType: matchingType,
    sourceUrl,
    targetUrl,
    enabled: editingRuleIndex !== null ? groups[editingGroupIndex].rules[editingRuleIndex].enabled : true
  };

  if (editingRuleIndex !== null) {
    groups[editingGroupIndex].rules[editingRuleIndex] = rule;
  } else {
    groups[editingGroupIndex].rules.push(rule);
  }

  await saveGroups();
  renderGroups();
  closeUrlRuleModal();
}

// Helper function to generate descriptive rule names
function generateUrlRuleName(sourceUrl, targetUrl, matchingType) {
  try {
    // For wildcard patterns, show a simplified description
    if (matchingType === 'wildcard') {
      const wildcardCount = (sourceUrl.match(/\*/g) || []).length;
      const sourcePart = sourceUrl.replace(/\*/g, '*').substring(0, 30);
      return `${sourcePart} (${wildcardCount} wildcard${wildcardCount > 1 ? 's' : ''})`;
    }
    
    // Extract meaningful parts from source and target URLs
    const sourceHost = sourceUrl.match(/https?:\/\/([^\/\(]+)/)?.[1] || 'source';
    const targetHost = targetUrl.match(/https?:\/\/([^\/\$]+)/)?.[1] || 'target';
    
    // Clean up the hosts
    const cleanSource = sourceHost.replace(/[^\w.-]/g, '');
    const cleanTarget = targetHost.replace(/[^\w.-]/g, '');
    
    return `${cleanSource} to ${cleanTarget} (${matchingType})`;
  } catch (e) {
    return `URL Rewrite Rule ${Date.now()}`;
  }
}

// Header Rule Modal Functions
function openHeaderRuleModal(groupIndex = null, ruleIndex = null) {
  editingRuleIndex = ruleIndex;
  editingRuleType = 'modify_headers';
  editingGroupIndex = groupIndex; // Store the group index for saving
  
  const modal = document.getElementById('headerRuleModal');
  const headerMatchingTypeSelect = document.getElementById('headerMatchingType');
  const urlPatternInput = document.getElementById('headerUrlPattern');

  if (groupIndex !== null && ruleIndex !== null) {
    const rule = groups[groupIndex].rules[ruleIndex];
    headerMatchingTypeSelect.value = rule.matchingType || 'regex';
    urlPatternInput.value = rule.urlPattern || '';
    renderHeaderFields(rule.headers || []);
  } else {
    headerMatchingTypeSelect.value = 'regex';
    urlPatternInput.value = '';
    renderHeaderFields([]);
  }

  // Reset test sections to hidden state
  resetTestSection('headerUrlTestSection', 'toggleHeaderUrlTest');
  clearRegexResult('headerUrlResult');

  // Update UI based on matching type
  updateHeaderMatchingTypeUI();

  // Add variable support to input fields
  addVariableSuggestions(urlPatternInput);

  modal.style.display = 'block';
  urlPatternInput.focus();
}

function closeHeaderRuleModal() {
  document.getElementById('headerRuleModal').style.display = 'none';
  editingRuleIndex = null;
  editingRuleType = null;
  editingGroupIndex = null;
}

function editHeaderRule(groupIndex, ruleIndex) {
  openHeaderRuleModal(groupIndex, ruleIndex);
}

function renderHeaderFields(headers = []) {
  const container = document.getElementById('headersList');
  
  // Safety check - if element doesn't exist, return early
  if (!container) {
    console.warn('headersList element not found');
    return;
  }
  
  container.innerHTML = headers.map((header, index) => `
    <div class="header-row">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" class="form-input header-name" placeholder="Header Name" 
               value="${escapeHtml(header.name || '')}" 
               data-index="${index}">
      </div>
      <div class="form-group">
        <label class="form-label">Operation</label>
        <select class="form-select header-operation" data-index="${index}">
          <option value="set" ${header.operation === 'set' ? 'selected' : ''}>Set/Override</option>
          <option value="append" ${header.operation === 'append' ? 'selected' : ''}>Append</option>
          <option value="remove" ${header.operation === 'remove' ? 'selected' : ''}>Remove</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Target</label>
        <select class="form-select header-target" data-index="${index}">
          <option value="request" ${header.target === 'request' ? 'selected' : ''}>Request</option>
          <option value="response" ${header.target === 'response' ? 'selected' : ''}>Response</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value</label>
        <input type="text" class="form-input header-value" placeholder="Header Value" 
               value="${escapeHtml(header.value || '')}" 
               ${header.operation === 'remove' ? 'disabled' : ''}
               data-index="${index}">
      </div>
      <div class="header-actions">
        <button class="btn btn-danger btn-small header-remove" data-index="${index}">Remove</button>
      </div>
    </div>
  `).join('');
  
  // Store current headers in a temporary variable
  window.currentHeaders = headers;
  
  // Add event listeners for header fields
  addHeaderFieldListeners();
}

function addHeaderFieldListeners() {
  // Header name inputs
  document.querySelectorAll('.header-name').forEach(input => {
    addVariableSuggestions(input);
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateHeaderField(index, 'name', e.target.value);
    });
  });

  // Header operation selects
  document.querySelectorAll('.header-operation').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateHeaderField(index, 'operation', e.target.value);
    });
  });

  // Header target selects
  document.querySelectorAll('.header-target').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateHeaderField(index, 'target', e.target.value);
    });
  });

  // Header value inputs
  document.querySelectorAll('.header-value').forEach(input => {
    addVariableSuggestions(input);
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateHeaderField(index, 'value', e.target.value);
    });
  });

  // Header remove buttons
  document.querySelectorAll('.header-remove').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeHeaderField(index);
    });
  });
}

function addHeaderField() {
  const headers = window.currentHeaders || [];
  headers.push({
    name: '',
    operation: 'set',
    target: 'request',
    value: ''
  });
  renderHeaderFields(headers);
}

function removeHeaderField(index) {
  const headers = window.currentHeaders || [];
  headers.splice(index, 1);
  renderHeaderFields(headers);
}

function updateHeaderField(index, field, value) {
  const headers = window.currentHeaders || [];
  if (headers[index]) {
    headers[index][field] = value;
    
    // If operation is 'remove', clear the value field
    if (field === 'operation' && value === 'remove') {
      headers[index].value = '';
      renderHeaderFields(headers);
    }
  }
}

async function saveHeaderRule() {
  const headerMatchingType = document.getElementById('headerMatchingType').value;
  const urlPattern = document.getElementById('headerUrlPattern').value.trim();
  const headers = window.currentHeaders || [];

  if (!urlPattern) {
    alert('Please enter a URL pattern.');
    return;
  }

  if (editingGroupIndex === null) {
    alert('No group specified for this rule.');
    return;
  }

  if (headers.length === 0) {
    alert('Please add at least one header modification.');
    return;
  }

  // Validate that all headers have names
  for (const header of headers) {
    if (!header.name.trim()) {
      alert('All headers must have a name.');
      return;
    }
    if (header.operation !== 'remove' && !header.value.trim()) {
      alert('Headers with set/append operation must have a value.');
      return;
    }
  }

  // Validate based on matching type
  if (headerMatchingType === 'regex') {
    try {
      new RegExp(urlPattern);
    } catch (e) {
      alert('Invalid URL pattern regex: ' + e.message);
      return;
    }
  }
  // For other matching types, basic validation
  else {
    if (headerMatchingType === 'contains' && urlPattern.length < 3) {
      alert('Contains text should be at least 3 characters long for meaningful matching.');
      return;
    }
    if (headerMatchingType === 'startsWith' && !urlPattern.includes('://')) {
      if (!confirm('URL doesn\'t include protocol (http:// or https://). Continue anyway?')) {
        return;
      }
    }
  }

  // Auto-generate rule name based on URL pattern and headers
  let ruleName;
  if (editingRuleIndex !== null) {
    // Keep existing name if editing
    ruleName = groups[editingGroupIndex].rules[editingRuleIndex].name || generateHeaderRuleName(urlPattern, headers, headerMatchingType);
  } else {
    // Generate new name
    ruleName = generateHeaderRuleName(urlPattern, headers, headerMatchingType);
  }

  const rule = {
    id: editingRuleIndex !== null ? groups[editingGroupIndex].rules[editingRuleIndex].id : Date.now(),
    type: 'modify_headers',
    name: ruleName,
    matchingType: headerMatchingType,
    urlPattern,
    headers: headers.filter(h => h.name.trim()),
    enabled: editingRuleIndex !== null ? groups[editingGroupIndex].rules[editingRuleIndex].enabled : true
  };

  if (editingRuleIndex !== null) {
    groups[editingGroupIndex].rules[editingRuleIndex] = rule;
  } else {
    groups[editingGroupIndex].rules.push(rule);
  }

  await saveGroups();
  renderGroups();
  closeHeaderRuleModal();
}

// Helper function to generate descriptive header rule names
function generateHeaderRuleName(urlPattern, headers, headerMatchingType) {
  try {
    // Extract domain from URL pattern
    const domainMatch = urlPattern.match(/https?:\/\/([^\/\\\*\.\[]+)/)?.[1] || 
                       urlPattern.match(/([^\/\\\*\.\[]+)\./)?.[1] || 'URLs';
    
    // Get primary header operations
    const headerNames = headers.slice(0, 2).map(h => h.name).join(', ');
    const moreCount = headers.length > 2 ? ` +${headers.length - 2}` : '';
    
    return `${domainMatch} ${headerNames}${moreCount} (${headerMatchingType})`;
  } catch (e) {
    return `Header Rule ${Date.now()}`;
  }
}

// Export/Import functionality
function importRules(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      
      if (!importData.groups || !Array.isArray(importData.groups)) {
        alert('Invalid file format. Expected groups array.');
        return;
      }
      
      const importedGroups = importData.groups;
      
      if (importedGroups.length === 0) {
        alert('No groups found in the file.');
        return;
      }
      
      // Import environment variables if present and not already existing
      let newVariablesCount = 0;
      if (importData.environmentVariables && Array.isArray(importData.environmentVariables)) {
        const existingVariableNames = new Set(environmentVariables.map(v => v.name));
        
        importData.environmentVariables.forEach(importedVar => {
          if (!existingVariableNames.has(importedVar.name)) {
            environmentVariables.push({
              name: importedVar.name,
              value: importedVar.value,
              description: importedVar.description || ''
            });
            newVariablesCount++;
          }
        });
        
        if (newVariablesCount > 0) {
          await saveEnvironmentVariables();
          renderEnvironmentVariables();
        }
      }
      
      // Add imported groups to existing groups
      importedGroups.forEach(group => {
        // Generate new ID to avoid conflicts
        group.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        group.name = group.name + ' (Imported)';
        // Ensure default values
        group.expanded = group.expanded !== false;
        group.enabled = group.enabled !== false;
        
        // Remove type property if it exists (for backward compatibility)
        delete group.type;
        
        groups.push(group);
      });
      
      await saveGroups();
      renderGroups();
      
      const totalRules = importedGroups.reduce((sum, g) => sum + g.rules.length, 0);
      let successMessage = `Successfully imported ${importedGroups.length} groups with ${totalRules} rules.`;
      
      if (newVariablesCount > 0) {
        successMessage += ` Also imported ${newVariablesCount} new environment variables.`;
      } else if (importData.environmentVariables && importData.environmentVariables.length > 0) {
        successMessage += ` Environment variables were found but skipped (already exist).`;
      }
      
      alert(successMessage);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Error importing file. Please check the file format.');
    }
  };
  
  reader.readAsText(file);
  // Clear the input so the same file can be imported again
  event.target.value = '';
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Test section toggle buttons
function toggleTestSection(sectionId, toggleId, additionalSectionId = null) {
  const section = document.getElementById(sectionId);
  const toggle = document.getElementById(toggleId);
  const toggleText = toggle.querySelector('.toggle-text');
  
  if (section && toggle && toggleText) {
    const isHidden = section.style.display === 'none';
    
    if (isHidden) {
      // Show the section
      section.style.display = 'block';
      toggleText.textContent = 'Hide Test';
      toggle.classList.add('expanded');
      
      // Also show additional section if specified (like target URL examples)
      if (additionalSectionId) {
        const additionalSection = document.getElementById(additionalSectionId);
        if (additionalSection) {
          additionalSection.style.display = 'block';
        }
      }
      
      // Focus on the test input field
      const testInput = section.querySelector('.regex-test-input');
      if (testInput) {
        setTimeout(() => testInput.focus(), 100);
      }
      
    } else {
      // Hide the section
      section.style.display = 'none';
      toggleText.textContent = 'Show Test';
      toggle.classList.remove('expanded');
      
      // Also hide additional section if specified
      if (additionalSectionId) {
        const additionalSection = document.getElementById(additionalSectionId);
        if (additionalSection) {
          additionalSection.style.display = 'none';
        }
      }
      
      // Clear any test results
      const resultElement = section.querySelector('.regex-result');
      if (resultElement) {
        clearRegexResult(resultElement.id);
      }
    }
  }
}

function resetTestSection(sectionId, toggleId) {
  const section = document.getElementById(sectionId);
  
  // Reset section to hidden state
  if (section) {
    section.style.display = 'none';
  }
  
  // Reset toggle button if provided
  if (toggleId) {
    const toggle = document.getElementById(toggleId);
    const toggleText = toggle?.querySelector('.toggle-text');
    
    if (toggle && toggleText) {
      toggleText.textContent = 'Show Test';
      toggle.classList.remove('expanded');
    }
  }
}

// Regex testing functionality
function testRegexPattern(sourceField, testField, resultField, targetField, previewField) {
  const matchingType = document.getElementById('matchingType')?.value || 'regex';
  const sourcePattern = document.getElementById(sourceField).value.trim();
  const testUrl = document.getElementById(testField).value.trim();
  const resultElement = document.getElementById(resultField);
  
  // Clear previous results
  resultElement.className = 'regex-result';
  resultElement.innerHTML = '';
  
  if (previewField) {
    const previewElement = document.getElementById(previewField);
    previewElement.innerHTML = '';
  }
  
  if (!sourcePattern) {
    resultElement.className = 'regex-result error';
    resultElement.textContent = 'Please enter a pattern first';
    return;
  }
  
  if (!testUrl) {
    resultElement.className = 'regex-result error';
    resultElement.textContent = 'Please enter a test URL';
    return;
  }
  
  try {
    // Substitute environment variables before testing
    const substitutedPattern = substituteVariables(sourcePattern);
    
    // Show variable substitution info if variables were replaced
    let infoHtml = '';
    if (substitutedPattern !== sourcePattern) {
      infoHtml = `<div class="variable-substitution-info">
        <strong>Original pattern:</strong> <code>${escapeHtml(sourcePattern)}</code><br>
        <strong>After variable substitution:</strong> <code>${escapeHtml(substitutedPattern)}</code>
      </div>`;
    }
    
    let isMatch = false;
    let match = null;
    
    // Test based on matching type
    switch (matchingType) {
      case 'contains':
        isMatch = testUrl.includes(substitutedPattern);
        match = isMatch ? [testUrl] : null; // No capture groups for contains
        break;
        
      case 'equals':
        isMatch = testUrl === substitutedPattern;
        match = isMatch ? [testUrl] : null; // No capture groups for equals
        break;
        
      case 'startsWith':
        isMatch = testUrl.startsWith(substitutedPattern);
        if (isMatch) {
          const remainingPath = testUrl.substring(substitutedPattern.length);
          match = [testUrl, remainingPath]; // Capture the remaining part
        }
        break;
        
      case 'endsWith':
        isMatch = testUrl.endsWith(substitutedPattern);
        match = isMatch ? [testUrl] : null; // No capture groups for endsWith
        break;
        
      case 'wildcard':
        // Convert wildcard pattern to regex for testing
        const wildcardRegexPattern = convertWildcardToRegex(substitutedPattern);
        const wildcardRegex = new RegExp(wildcardRegexPattern);
        match = testUrl.match(wildcardRegex);
        isMatch = !!match;
        break;
        
      case 'regex':
      default:
        const regex = new RegExp(substitutedPattern);
        match = testUrl.match(regex);
        isMatch = !!match;
        break;
    }
    
    if (isMatch && match) {
      resultElement.className = 'regex-result success';
      let resultHtml = infoHtml + '✅ <strong>Pattern matches!</strong>';
      
      // Show capture groups if they exist (mainly for regex and startsWith)
      if (match.length > 1 && (matchingType === 'regex' || matchingType === 'startsWith')) {
        resultHtml += '<div class="capture-groups"><strong>Captured Parts:</strong><br>';
        for (let i = 1; i < match.length; i++) {
          const label = matchingType === 'startsWith' ? 'Remaining Path' : `$${i}`;
          resultHtml += `<span class="capture-group">${label}: ${escapeHtml(match[i] || '')}</span>`;
        }
        resultHtml += '</div>';
      }
      
      // Show capture groups for wildcard patterns
      if (match.length > 1 && matchingType === 'wildcard') {
        resultHtml += '<div class="capture-groups"><strong>Captured Wildcards:</strong><br>';
        for (let i = 1; i < match.length; i++) {
          resultHtml += `<span class="capture-group">$${i}: ${escapeHtml(match[i] || '')}</span>`;
        }
        resultHtml += '</div>';
      }
      
      resultElement.innerHTML = resultHtml;
      
      // Show target URL preview if this is for URL rewrite
      if (targetField && previewField) {
        const targetPattern = document.getElementById(targetField).value.trim();
        if (targetPattern) {
          showTargetUrlPreview(targetPattern, match, previewField, matchingType);
        }
      }
      
    } else {
      resultElement.className = 'regex-result no-match';
      resultElement.innerHTML = infoHtml + '❌ <strong>No match found</strong><br><small>Your pattern doesn\'t match the test URL</small>';
    }
    
  } catch (error) {
    resultElement.className = 'regex-result error';
    resultElement.innerHTML = `🚫 <strong>Invalid pattern</strong><br><small>${escapeHtml(error.message)}</small>`;
  }
}

function showTargetUrlPreview(targetPattern, match, previewField, matchingType) {
  const previewElement = document.getElementById(previewField);
  
  try {
    // Substitute environment variables in target pattern too
    let targetUrl = substituteVariables(targetPattern);
    
    // Handle different matching types
    switch (matchingType) {
      case 'startsWith':
        // For startsWith, append the remaining path if it exists
        if (match.length > 1) {
          targetUrl = targetUrl + match[1]; // match[1] contains the remaining path
        }
        break;
        
      case 'wildcard':
      case 'regex':
        // Replace capture groups in target URL for regex and wildcard
        for (let i = 1; i < match.length; i++) {
          const placeholder = `$${i}`;
          const replacement = match[i] || '';
          targetUrl = targetUrl.replace(new RegExp('\\' + placeholder, 'g'), replacement);
        }
        break;
        
      case 'contains':
      case 'equals':
      case 'endsWith':
      default:
        // For these types, just use the target URL as-is (no capture groups)
        break;
    }
    
    // Show variable substitution info if variables were replaced
    let infoHtml = '';
    if (substituteVariables(targetPattern) !== targetPattern) {
      infoHtml = `<strong>Target pattern with variables substituted:</strong> <code>${escapeHtml(substituteVariables(targetPattern))}</code><br>`;
    }
    
    previewElement.innerHTML = `
      ${infoHtml}
      <strong>Final Target URL:</strong><br>
      <span class="preview-url">${escapeHtml(targetUrl)}</span>
    `;
    
  } catch (error) {
    previewElement.innerHTML = `
      <span style="color: #c62828;">Error in target URL: ${escapeHtml(error.message)}</span>
    `;
  }
}

function clearRegexResult(fieldId) {
  const element = document.getElementById(fieldId);
  if (element) {
    element.className = 'regex-result';
    element.innerHTML = '';
  }
}

// Example pattern buttons
function insertExamplePattern(targetField, pattern) {
  const element = document.getElementById(targetField);
  if (element) {
    element.value = pattern;
    element.focus();
    
    // Trigger input event to clear any previous results
    element.dispatchEvent(new Event('input'));
    
    // Auto-test if we have test data and this is a regex pattern field
    if (targetField === 'sourceUrl') {
      const testUrl = document.getElementById('sourceUrlTest').value.trim();
      if (testUrl) {
        setTimeout(() => {
          testRegexPattern('sourceUrl', 'sourceUrlTest', 'sourceUrlResult', 'targetUrl', 'targetUrlPreview');
        }, 100);
      }
    } else if (targetField === 'headerUrlPattern') {
      const testUrl = document.getElementById('headerUrlTest').value.trim();
      if (testUrl) {
        setTimeout(() => {
          testRegexPattern('headerUrlPattern', 'headerUrlTest', 'headerUrlResult');
        }, 100);
      }
    } else if (targetField === 'targetUrl') {
      // Re-test source pattern to update target preview
      const testUrl = document.getElementById('sourceUrlTest').value.trim();
      const sourcePattern = document.getElementById('sourceUrl').value.trim();
      if (testUrl && sourcePattern) {
        setTimeout(() => {
          testRegexPattern('sourceUrl', 'sourceUrlTest', 'sourceUrlResult', 'targetUrl', 'targetUrlPreview');
        }, 100);
      }
    }
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Duplicate rule functionality
async function duplicateRule(groupIndex, ruleIndex) {
  const originalRule = groups[groupIndex].rules[ruleIndex];
  
  // Create a deep copy of the rule with a new ID and modified name
  const newRule = {
    id: Date.now(),
    type: originalRule.type,
    name: (originalRule.name || 'Unnamed Rule') + ' (Copy)',
    enabled: originalRule.enabled
  };
  
  // Copy type-specific properties
  if (originalRule.type === 'url_rewrite') {
    newRule.sourceUrl = originalRule.sourceUrl;
    newRule.targetUrl = originalRule.targetUrl;
  } else if (originalRule.type === 'modify_headers') {
    newRule.urlPattern = originalRule.urlPattern;
    newRule.headers = originalRule.headers.map(header => ({ ...header })); // Deep copy headers array
  }
  
  // Add the duplicated rule to the same group
  groups[groupIndex].rules.push(newRule);
  
  await saveGroups();
  renderGroups();
  
  // Show a success message
  console.log(`✅ Rule "${originalRule.name}" duplicated successfully`);
}

// Rule reorder functionality
async function moveRuleUp(groupIndex, ruleIndex) {
  if (ruleIndex > 0) {
    const ruleName = groups[groupIndex].rules[ruleIndex].name || 'Unnamed Rule';
    
    // Swap the rule with the one above it
    const temp = groups[groupIndex].rules[ruleIndex];
    groups[groupIndex].rules[ruleIndex] = groups[groupIndex].rules[ruleIndex - 1];
    groups[groupIndex].rules[ruleIndex - 1] = temp;
    
    await saveGroups();
    renderGroups();
    
    console.log(`✅ Rule "${ruleName}" moved up`);
  }
}

async function moveRuleDown(groupIndex, ruleIndex) {
  if (ruleIndex < groups[groupIndex].rules.length - 1) {
    const ruleName = groups[groupIndex].rules[ruleIndex].name || 'Unnamed Rule';
    
    // Swap the rule with the one below it
    const temp = groups[groupIndex].rules[ruleIndex];
    groups[groupIndex].rules[ruleIndex] = groups[groupIndex].rules[ruleIndex + 1];
    groups[groupIndex].rules[ruleIndex + 1] = temp;
    
    await saveGroups();
    renderGroups();
    
    console.log(`✅ Rule "${ruleName}" moved down`);
  }
}

// Preset group functions
function openPresetModal() {
  const modal = document.getElementById('presetModal');
  const presetsContainer = document.getElementById('presetsList');
  
  // Render available presets
  presetsContainer.innerHTML = '';
  Object.entries(PRESET_TEMPLATES).forEach(([key, preset]) => {
    const presetCard = document.createElement('div');
    presetCard.className = `preset-card${preset.disabled ? ' preset-disabled' : ''}`;
    
    // Check if icon is an image file or text/emoji
    const isImageIcon = preset.icon.includes('.') && (preset.icon.endsWith('.png') || preset.icon.endsWith('.jpg') || preset.icon.endsWith('.jpeg') || preset.icon.endsWith('.svg') || preset.icon.endsWith('.gif'));
    const iconHTML = isImageIcon 
      ? `<img src="${preset.icon}" alt="${preset.name} icon" style="width: 100%; height: 100%; object-fit: contain;">`
      : preset.icon;
    
    const buttonHTML = preset.disabled 
      ? `<button class="btn btn-secondary preset-select-btn" disabled>Coming Soon</button>`
      : `<button class="btn btn-primary preset-select-btn" data-preset-key="${key}">Select Template</button>`;
    
    presetCard.innerHTML = `
      <div class="preset-header">
        <span class="preset-icon">${iconHTML}</span>
        <div class="preset-info">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-description">${preset.description}</div>
        </div>
      </div>
      ${buttonHTML}
    `;
    presetsContainer.appendChild(presetCard);
  });
  
  // Add event listeners for preset selection buttons (only for enabled presets)
  presetsContainer.querySelectorAll('.preset-select-btn:not([disabled])').forEach(button => {
    button.addEventListener('click', (e) => {
      const presetKey = e.target.dataset.presetKey;
      selectPreset(presetKey);
    });
  });
  
  modal.style.display = 'block';
}

function selectPreset(presetKey) {
  const preset = PRESET_TEMPLATES[presetKey];
  if (!preset) return;
  
  // Hide preset selection and show configuration
  document.getElementById('presetSelection').style.display = 'none';
  document.getElementById('presetConfiguration').style.display = 'block';
  
  // Update modal title
  document.getElementById('presetConfigTitle').textContent = `Configure ${preset.name}`;
  
  // Add event listener for back button
  const backBtn = document.getElementById('presetBackBtn');
  if (backBtn) {
    backBtn.onclick = null; // Remove any existing handler
    backBtn.addEventListener('click', goBackToPresetSelection);
  }
  
  // Render configuration form
  const configForm = document.getElementById('presetConfigForm');
  configForm.innerHTML = '';
  
  preset.variables.forEach(variable => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.innerHTML = `
      <label class="form-label">
        ${variable.label}
        ${variable.required ? '<span class="required">*</span>' : ''}
      </label>
      <input 
        type="${variable.type}" 
        class="form-input preset-variable" 
        data-key="${variable.key}"
        placeholder="${variable.placeholder}"
        value="${variable.defaultValue || ''}"
        ${variable.required ? 'required' : ''}
      >
      <div class="small-text">${variable.description || ''}</div>
    `;
    configForm.appendChild(formGroup);
  });
  
  // Store selected preset
  document.getElementById('presetConfigForm').dataset.selectedPreset = presetKey;
}

function closePresetModal() {
  const modal = document.getElementById('presetModal');
  modal.style.display = 'none';
  
  // Reset modal state
  document.getElementById('presetSelection').style.display = 'block';
  document.getElementById('presetConfiguration').style.display = 'none';
  document.getElementById('presetConfigForm').innerHTML = '';
}

function createPresetGroup() {
  const configForm = document.getElementById('presetConfigForm');
  const selectedPresetKey = configForm.dataset.selectedPreset;
  const preset = PRESET_TEMPLATES[selectedPresetKey];
  
  if (!preset) {
    alert('No preset selected');
    return;
  }
  
  // Collect variable values
  const variables = {};
  const inputs = configForm.querySelectorAll('.preset-variable');
  let hasErrors = false;
  
  inputs.forEach(input => {
    const key = input.dataset.key;
    const value = input.value.trim();
    const variable = preset.variables.find(v => v.key === key);
    
    if (variable.required && !value) {
      input.style.borderColor = '#e74c3c';
      hasErrors = true;
    } else {
      input.style.borderColor = '';
      variables[key] = value;
    }
  });
  
  if (hasErrors) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Generate rules from preset
  const generatedRules = preset.generateRules(variables);
  
  // Create new group
  const newGroup = {
    id: `preset-${selectedPresetKey}-${Date.now()}`,
    name: `${preset.name} (${variables.sourceDomain || 'Preset'})`,
    expanded: true,
    enabled: true,
    isPreset: true,
    presetType: selectedPresetKey,
    presetVariables: variables,
    rules: generatedRules
  };
  
  groups.push(newGroup);
  saveGroups();
  renderGroups();
  closePresetModal();
  
  // Show success message
  alert(`${preset.name} preset group created successfully with ${generatedRules.length} rules!`);
}

function goBackToPresetSelection() {
  document.getElementById('presetSelection').style.display = 'block';
  document.getElementById('presetConfiguration').style.display = 'none';
}

// Environment Variable functions
function openEnvironmentVariableModal(variableIndex = null) {
  editingEnvironmentVariableIndex = variableIndex;
  
  const modal = document.getElementById('environmentVariableModal');
  const nameInput = document.getElementById('environmentVariableName');
  const valueInput = document.getElementById('environmentVariableValue');
  const descriptionInput = document.getElementById('environmentVariableDescription');

  if (variableIndex !== null) {
    const variable = environmentVariables[variableIndex];
    nameInput.value = variable.name || '';
    valueInput.value = variable.value || '';
    descriptionInput.value = variable.description || '';
  } else {
    nameInput.value = '';
    valueInput.value = '';
    descriptionInput.value = '';
  }

  modal.style.display = 'block';
  nameInput.focus();
}

function closeEnvironmentVariableModal() {
  const modal = document.getElementById('environmentVariableModal');
  modal.style.display = 'none';
  editingEnvironmentVariableIndex = null;
}

function editEnvironmentVariable(index) {
  openEnvironmentVariableModal(index);
}

async function deleteEnvironmentVariable(index) {
  if (confirm('Are you sure you want to delete this environment variable?')) {
    environmentVariables.splice(index, 1);
    await saveEnvironmentVariables();
    renderEnvironmentVariables();
  }
}

async function saveEnvironmentVariable() {
  const name = document.getElementById('environmentVariableName').value.trim().toUpperCase();
  const value = document.getElementById('environmentVariableValue').value.trim();
  const description = document.getElementById('environmentVariableDescription').value.trim();

  if (!name || !value) {
    alert('Please enter both name and value for the environment variable.');
    return;
  }

  // Validate variable name (only letters, numbers, and underscores)
  if (!/^[A-Z0-9_]+$/.test(name)) {
    alert('Variable name can only contain uppercase letters, numbers, and underscores.');
    return;
  }

  // Check for duplicate names (excluding current variable if editing)
  const existingIndex = environmentVariables.findIndex(v => v.name === name);
  if (existingIndex !== -1 && existingIndex !== editingEnvironmentVariableIndex) {
    alert('A variable with this name already exists. Please choose a different name.');
    return;
  }

  const variable = {
    id: editingEnvironmentVariableIndex !== null ? environmentVariables[editingEnvironmentVariableIndex].id : Date.now(),
    name,
    value,
    description
  };

  if (editingEnvironmentVariableIndex !== null) {
    environmentVariables[editingEnvironmentVariableIndex] = variable;
  } else {
    environmentVariables.push(variable);
  }

  await saveEnvironmentVariables();
  renderEnvironmentVariables();
  closeEnvironmentVariableModal();
}

// Variable substitution function
function substituteVariables(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  environmentVariables.forEach(variable => {
    const pattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
    result = result.replace(pattern, variable.value);
  });
  
  return result;
}

// Function to show preview of variable substitution
function showVariablePreview(inputElement) {
  const text = inputElement.value;
  const substituted = substituteVariables(text);
  
  if (text !== substituted) {
    // Create or update preview element
    let preview = inputElement.parentNode.querySelector('.env-variable-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'env-variable-preview';
      inputElement.parentNode.appendChild(preview);
    }
    preview.innerHTML = `<strong>Preview:</strong> ${escapeHtml(substituted)}`;
  } else {
    // Remove preview if no variables found
    const preview = inputElement.parentNode.querySelector('.env-variable-preview');
    if (preview) {
      preview.remove();
    }
  }
}

// Function to add variable suggestions to input fields
function addVariableSuggestions(inputElement) {
  if (environmentVariables.length === 0) return;
  
  // Store reference for cleanup
  let activeSuggestions = null;
  
  inputElement.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.ctrlKey) {
      e.preventDefault();
      showVariableSuggestions(inputElement);
    }
    
    // Handle arrow keys and Enter for suggestion navigation
    if (activeSuggestions && activeSuggestions.style.display === 'block') {
      const suggestions = activeSuggestions.querySelectorAll('.variable-suggestion');
      let selectedIndex = Array.from(suggestions).findIndex(s => s.classList.contains('selected'));
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
        updateSuggestionSelection(suggestions, selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSuggestionSelection(suggestions, selectedIndex);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSuggestion(inputElement, suggestions[selectedIndex], activeSuggestions);
        }
      } else if (e.key === 'Escape') {
        hideSuggestions(activeSuggestions);
        activeSuggestions = null;
      }
    }
  });
  
  inputElement.addEventListener('input', (e) => {
    showVariablePreview(inputElement);
    
    // Check for inline variable suggestions
    const cursorPos = inputElement.selectionStart;
    const textBeforeCursor = inputElement.value.substring(0, cursorPos);
    
    // Find the last occurrence of {{ before cursor
    const lastBraceIndex = textBeforeCursor.lastIndexOf('{{');
    const lastCloseBraceIndex = textBeforeCursor.lastIndexOf('}}');
    
    // Show suggestions if we have {{ without closing }} after it
    if (lastBraceIndex !== -1 && (lastCloseBraceIndex === -1 || lastCloseBraceIndex < lastBraceIndex)) {
      const searchTerm = textBeforeCursor.substring(lastBraceIndex + 2);
      activeSuggestions = showInlineSuggestions(inputElement, searchTerm, lastBraceIndex);
    } else {
      // Hide suggestions if not in variable context
      if (activeSuggestions) {
        hideSuggestions(activeSuggestions);
        activeSuggestions = null;
      }
    }
  });
  
  // Hide suggestions when input loses focus
  inputElement.addEventListener('blur', (e) => {
    // Small delay to allow clicking on suggestions
    setTimeout(() => {
      if (activeSuggestions && !activeSuggestions.contains(document.activeElement)) {
        hideSuggestions(activeSuggestions);
        activeSuggestions = null;
      }
    }, 200);
  });
}

// Show inline suggestions as user types
function showInlineSuggestions(inputElement, searchTerm, braceIndex) {
  // Remove existing suggestions
  hideSuggestions();
  
  // Filter variables based on search term
  const filteredVariables = environmentVariables.filter(variable =>
    variable.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (filteredVariables.length === 0) return null;
  
  // Create suggestions dropdown
  const suggestions = document.createElement('div');
  suggestions.className = 'variable-suggestions inline-suggestions';
  suggestions.style.display = 'block';
  
  filteredVariables.forEach((variable, index) => {
    const suggestion = document.createElement('div');
    suggestion.className = 'variable-suggestion';
    if (index === 0) suggestion.classList.add('selected'); // Pre-select first item
    
    // Highlight matching text
    const highlightedName = highlightSearchTerm(variable.name, searchTerm);
    
    suggestion.innerHTML = `
      <span class="variable-suggestion-name">{{${highlightedName}}}</span>
      <span class="variable-suggestion-value">${escapeHtml(variable.value)}</span>
    `;
    
    suggestion.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur event
      selectSuggestion(inputElement, suggestion, suggestions, braceIndex, searchTerm);
    });
    
    suggestion.addEventListener('mouseenter', () => {
      // Remove selected class from all suggestions
      suggestions.querySelectorAll('.variable-suggestion').forEach(s => s.classList.remove('selected'));
      // Add selected class to hovered suggestion
      suggestion.classList.add('selected');
    });
    
    suggestions.appendChild(suggestion);
  });
  
  // Position suggestions below the input
  const rect = inputElement.getBoundingClientRect();
  const container = inputElement.offsetParent || document.body;
  
  suggestions.style.position = 'absolute';
  suggestions.style.top = (inputElement.offsetTop + inputElement.offsetHeight) + 'px';
  suggestions.style.left = inputElement.offsetLeft + 'px';
  suggestions.style.width = Math.max(rect.width, 250) + 'px';
  suggestions.style.zIndex = '2000';
  
  container.appendChild(suggestions);
  
  return suggestions;
}

// Highlight search term in variable name
function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm) return escapeHtml(text);
  
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark style="background: #FFE082; color: #F57C00;">$1</mark>');
}

// Update suggestion selection
function updateSuggestionSelection(suggestions, selectedIndex) {
  suggestions.forEach((suggestion, index) => {
    suggestion.classList.toggle('selected', index === selectedIndex);
  });
}

// Select a suggestion and insert it into the input
function selectSuggestion(inputElement, suggestionElement, suggestionsContainer, braceIndex, searchTerm) {
  const variableName = suggestionElement.querySelector('.variable-suggestion-name').textContent.replace(/[{}]/g, '');
  
  if (typeof braceIndex !== 'undefined') {
    // Inline suggestion - replace from {{ onwards
    const cursorPos = inputElement.selectionStart;
    const textBefore = inputElement.value.substring(0, braceIndex);
    const textAfter = inputElement.value.substring(cursorPos);
    const variableText = `{{${variableName}}}`;
    
    inputElement.value = textBefore + variableText + textAfter;
    inputElement.focus();
    
    const newCursorPos = textBefore.length + variableText.length;
    inputElement.setSelectionRange(newCursorPos, newCursorPos);
  } else {
    // Manual suggestion (Ctrl+Tab) - insert at cursor
    const cursorPos = inputElement.selectionStart;
    const textBefore = inputElement.value.substring(0, cursorPos);
    const textAfter = inputElement.value.substring(cursorPos);
    const variableText = `{{${variableName}}}`;
    
    inputElement.value = textBefore + variableText + textAfter;
    inputElement.focus();
    inputElement.setSelectionRange(cursorPos + variableText.length, cursorPos + variableText.length);
  }
  
  // Trigger input event to show preview
  inputElement.dispatchEvent(new Event('input'));
  
  // Hide suggestions
  hideSuggestions(suggestionsContainer);
}

// Hide suggestions
function hideSuggestions(suggestionsContainer) {
  if (suggestionsContainer) {
    suggestionsContainer.remove();
  }
  
  // Also remove any other existing suggestions
  document.querySelectorAll('.variable-suggestions').forEach(s => s.remove());
}

// Setup improved modal close handling that prevents closing during text selection
function setupModalCloseHandling() {
  let isMouseDown = false;
  let isDragging = false;
  let mouseDownTarget = null;
  
  // Track mouse down events
  document.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    isDragging = false;
    mouseDownTarget = event.target;
  });
  
  // Track mouse move to detect dragging/text selection
  document.addEventListener('mousemove', (event) => {
    if (isMouseDown) {
      isDragging = true;
    }
  });
  
  // Handle mouse up events for modal closing
  document.addEventListener('mouseup', (event) => {
    // Only handle modal closing if this was a simple click (not a drag/selection)
    if (isMouseDown && !isDragging && mouseDownTarget === event.target) {
      handleModalClose(event);
    }
    
    // Reset tracking variables
    isMouseDown = false;
    isDragging = false;
    mouseDownTarget = null;
  });
  
  // Handle modal close for simple clicks
  function handleModalClose(event) {
    // Check each modal
    const modals = [
      { element: document.getElementById('urlRuleModal'), closeFunction: closeUrlRuleModal },
      { element: document.getElementById('headerRuleModal'), closeFunction: closeHeaderRuleModal },
      { element: document.getElementById('groupModal'), closeFunction: closeGroupModal },
      { element: document.getElementById('presetModal'), closeFunction: closePresetModal },
      { element: document.getElementById('environmentVariableModal'), closeFunction: closeEnvironmentVariableModal }
    ];
    
    modals.forEach(modal => {
      if (modal.element && event.target === modal.element) {
        // Only close if clicking directly on the modal backdrop, not on any child elements
        modal.closeFunction();
      }
    });
  }
}

// Update tab navigation visual state
function updateTabNavigation(activeTab) {
  const rulesTab = document.getElementById('rulesTab');
  const settingsTab = document.getElementById('settingsTab');
  
  rulesTab.classList.remove('active');
  settingsTab.classList.remove('active');
  
  if (activeTab === 'rules') {
    rulesTab.classList.add('active');
  } else if (activeTab === 'settings') {
    settingsTab.classList.add('active');
  }
}

// Show rules view
function showRulesView() {
  document.getElementById('rulesView').classList.add('active');
  document.getElementById('settingsView').classList.remove('active');
  updateTabNavigation('rules');
}

// Show settings view  
function showSettingsView() {
  document.getElementById('rulesView').classList.remove('active');
  document.getElementById('settingsView').classList.add('active');
  updateTabNavigation('settings');
}

// Update UI based on matching type selection
function updateMatchingTypeUI() {
  const matchingType = document.getElementById('matchingType').value;
  const sourceUrlLabel = document.getElementById('sourceUrlLabel');
  const sourceUrlInput = document.getElementById('sourceUrl');
  const sourceUrlHelp = document.getElementById('sourceUrlHelp');
  const targetUrlHelp = document.getElementById('targetUrlHelp');
  const testSection = document.getElementById('sourceUrlTestSection');
  const toggleButton = document.getElementById('toggleSourceUrlTest');
  
  // Clear any existing test results
  clearRegexResult('sourceUrlResult');
  clearRegexResult('targetUrlPreview');
  
  switch (matchingType) {
    case 'contains':
      sourceUrlLabel.textContent = 'URL Contains';
      sourceUrlInput.placeholder = 'e.g., localhost.freshservice-dev.com';
      sourceUrlHelp.innerHTML = 'Enter text that should be found anywhere in the URL. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Enter the complete target URL. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'equals':
      sourceUrlLabel.textContent = 'URL Equals';
      sourceUrlInput.placeholder = 'e.g., http://localhost.freshservice-dev.com:8080/api/test';
      sourceUrlHelp.innerHTML = 'Enter the exact URL that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Enter the complete target URL. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'startsWith':
      sourceUrlLabel.textContent = 'URL Starts With';
      sourceUrlInput.placeholder = 'e.g., http://localhost.freshservice-dev.com:8080/';
      sourceUrlHelp.innerHTML = 'Enter the beginning part of URLs that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Enter the target URL prefix. The remaining part of the original URL will be appended. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'endsWith':
      sourceUrlLabel.textContent = 'URL Ends With';
      sourceUrlInput.placeholder = 'e.g., /api/test';
      sourceUrlHelp.innerHTML = 'Enter the ending part of URLs that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Enter the complete target URL. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'wildcard':
      sourceUrlLabel.textContent = 'Wildcard Pattern';
      sourceUrlInput.placeholder = 'e.g., http://localhost:*/api/* or https://*.example.com/*';
      sourceUrlHelp.innerHTML = 'Use asterisks (*) as wildcards. Each * captures a part that can be referenced as $1, $2, etc. in the target URL. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Use $1, $2, etc. to reference captured wildcards from the pattern. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'regex':
    default:
      sourceUrlLabel.textContent = 'Source URL Pattern';
      sourceUrlInput.placeholder = 'e.g., http://localhost.freshservice-dev.com:8080/(.*)';
      sourceUrlHelp.innerHTML = 'Use regex patterns. Use (.*) or $1, $2 for capture groups. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      targetUrlHelp.innerHTML = 'Use $1, $2, etc. to reference capture groups from source pattern. Use {{VARIABLE_NAME}} for environment variables.';
      toggleButton.style.display = 'inline-flex';
      break;
  }
  
  // Hide test section when switching types
  if (testSection) {
    testSection.style.display = 'none';
    const toggle = document.getElementById('toggleSourceUrlTest');
    const toggleText = toggle?.querySelector('.toggle-text');
    if (toggle && toggleText) {
      toggleText.textContent = 'Show Test';
      toggle.classList.remove('expanded');
    }
  }
}

function getMatchingTypeDisplayName(matchingType) {
  switch (matchingType) {
    case 'contains':
      return 'Contains';
    case 'equals':
      return 'Equals';
    case 'startsWith':
      return 'Starts With';
    case 'endsWith':
      return 'Ends With';
    case 'wildcard':
      return 'Wildcard';
    case 'regex':
      return 'Regex';
    default:
      return 'Unknown';
  }
}

// Convert wildcard pattern to regex pattern
function convertWildcardToRegex(wildcardPattern) {
  // Escape all regex special characters except asterisks
  let regexPattern = wildcardPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace asterisks with capture groups
  // Use ([^/]*) for URL path segments, or (.*) for broader matching
  regexPattern = regexPattern.replace(/\*/g, '([^/]*)');
  
  // For wildcards that should match across path separators (like full paths),
  // we might need broader matching. Let's detect if we're in a path context:
  if (regexPattern.includes('/') && regexPattern.match(/\([^/]*\)/g)) {
    // If we have path separators and capture groups, consider broader matching for end patterns
    regexPattern = regexPattern.replace(/\/\([^/]*\)$/g, '/(.*)')
  }
  
  // Anchor the pattern
  if (!regexPattern.startsWith('^')) {
    regexPattern = '^' + regexPattern;
  }
  if (!regexPattern.endsWith('$')) {
    regexPattern = regexPattern + '$';
  }
  
  return regexPattern;
}

// Update header matching type UI
function updateHeaderMatchingTypeUI() {
  const matchingType = document.getElementById('headerMatchingType').value;
  const headerUrlLabel = document.getElementById('headerUrlLabel');
  const headerUrlInput = document.getElementById('headerUrlPattern');
  const headerUrlHelp = document.getElementById('headerUrlHelp');
  const testSection = document.getElementById('headerUrlTestSection');
  const toggleButton = document.getElementById('toggleHeaderUrlTest');
  
  // Clear any existing test results
  clearRegexResult('headerUrlResult');
  
  switch (matchingType) {
    case 'contains':
      headerUrlLabel.textContent = 'URL Contains';
      headerUrlInput.placeholder = 'e.g., api.example.com';
      headerUrlHelp.innerHTML = 'Enter text that should be found anywhere in the URL. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'equals':
      headerUrlLabel.textContent = 'URL Equals';
      headerUrlInput.placeholder = 'e.g., https://api.example.com/v1/users';
      headerUrlHelp.innerHTML = 'Enter the exact URL that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'startsWith':
      headerUrlLabel.textContent = 'URL Starts With';
      headerUrlInput.placeholder = 'e.g., https://api.example.com/';
      headerUrlHelp.innerHTML = 'Enter the beginning part of URLs that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'endsWith':
      headerUrlLabel.textContent = 'URL Ends With';
      headerUrlInput.placeholder = 'e.g., /api/v1/data.json';
      headerUrlHelp.innerHTML = 'Enter the ending part of URLs that should be matched. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'wildcard':
      headerUrlLabel.textContent = 'URL Wildcard Pattern';
      headerUrlInput.placeholder = 'e.g., https://api.*.com/* or https://*.example.com/api/*';
      headerUrlHelp.innerHTML = 'Use asterisks (*) as wildcards to match URL parts. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
      
    case 'regex':
    default:
      headerUrlLabel.textContent = 'URL Pattern';
      headerUrlInput.placeholder = 'e.g., https://api\\.example\\.com/.*';
      headerUrlHelp.innerHTML = 'Regex pattern to match URLs where headers should be modified. Use {{VARIABLE_NAME}} for environment variables. Press Ctrl+Tab for variable suggestions.';
      toggleButton.style.display = 'inline-flex';
      break;
  }
  
  // Hide test section when switching types
  if (testSection) {
    testSection.style.display = 'none';
    const toggle = document.getElementById('toggleHeaderUrlTest');
    const toggleText = toggle?.querySelector('.toggle-text');
    if (toggle && toggleText) {
      toggleText.textContent = 'Show Test';
      toggle.classList.remove('expanded');
    }
  }
}

// Header regex testing functionality
function testHeaderRegexPattern(sourceField, testField, resultField) {
  const matchingType = document.getElementById('headerMatchingType')?.value || 'regex';
  const sourcePattern = document.getElementById(sourceField).value.trim();
  const testUrl = document.getElementById(testField).value.trim();
  const resultElement = document.getElementById(resultField);
  
  // Clear previous results
  resultElement.className = 'regex-result';
  resultElement.innerHTML = '';
  
  if (!sourcePattern) {
    resultElement.className = 'regex-result error';
    resultElement.textContent = 'Please enter a pattern first';
    return;
  }
  
  if (!testUrl) {
    resultElement.className = 'regex-result error';
    resultElement.textContent = 'Please enter a test URL';
    return;
  }
  
  try {
    // Substitute environment variables before testing
    const substitutedPattern = substituteVariables(sourcePattern);
    
    // Show variable substitution info if variables were replaced
    let infoHtml = '';
    if (substitutedPattern !== sourcePattern) {
      infoHtml = `<div class="variable-substitution-info">
        <strong>Original pattern:</strong> <code>${escapeHtml(sourcePattern)}</code><br>
        <strong>After variable substitution:</strong> <code>${escapeHtml(substitutedPattern)}</code>
      </div>`;
    }
    
    let isMatch = false;
    let match = null;
    
    // Test based on matching type
    switch (matchingType) {
      case 'contains':
        isMatch = testUrl.includes(substitutedPattern);
        match = isMatch ? [testUrl] : null;
        break;
        
      case 'equals':
        isMatch = testUrl === substitutedPattern;
        match = isMatch ? [testUrl] : null;
        break;
        
      case 'startsWith':
        isMatch = testUrl.startsWith(substitutedPattern);
        if (isMatch) {
          const remainingPath = testUrl.substring(substitutedPattern.length);
          match = [testUrl, remainingPath];
        }
        break;
        
      case 'endsWith':
        isMatch = testUrl.endsWith(substitutedPattern);
        match = isMatch ? [testUrl] : null;
        break;
        
      case 'wildcard':
        const wildcardRegexPattern = convertWildcardToRegex(substitutedPattern);
        const wildcardRegex = new RegExp(wildcardRegexPattern);
        match = testUrl.match(wildcardRegex);
        isMatch = !!match;
        break;
        
      case 'regex':
      default:
        const regex = new RegExp(substitutedPattern);
        match = testUrl.match(regex);
        isMatch = !!match;
        break;
    }
    
    if (isMatch && match) {
      resultElement.className = 'regex-result success';
      let resultHtml = infoHtml + '✅ <strong>Pattern matches!</strong>';
      
      // Show capture groups for wildcard patterns  
      if (match.length > 1 && matchingType === 'wildcard') {
        resultHtml += '<div class="capture-groups"><strong>Captured Wildcards:</strong><br>';
        for (let i = 1; i < match.length; i++) {
          resultHtml += `<span class="capture-group">$${i}: ${escapeHtml(match[i] || '')}</span>`;
        }
        resultHtml += '</div>';
      }
      
      // Show capture groups for regex patterns
      if (match.length > 1 && matchingType === 'regex') {
        resultHtml += '<div class="capture-groups"><strong>Captured Parts:</strong><br>';
        for (let i = 1; i < match.length; i++) {
          resultHtml += `<span class="capture-group">$${i}: ${escapeHtml(match[i] || '')}</span>`;
        }
        resultHtml += '</div>';
      }
      
      resultElement.innerHTML = resultHtml;
      
    } else {
      resultElement.className = 'regex-result no-match';
      resultElement.innerHTML = infoHtml + '❌ <strong>No match found</strong><br><small>Your pattern doesn\'t match the test URL</small>';
    }
    
  } catch (error) {
    resultElement.className = 'regex-result error';
    resultElement.innerHTML = `🚫 <strong>Invalid pattern</strong><br><small>${escapeHtml(error.message)}</small>`;
  }
}