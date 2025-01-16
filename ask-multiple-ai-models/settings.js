// AI Model URLs
const AI_MODEL_URLS = {
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/',
    claude: 'https://claude.ai/',
    copilot: 'https://copilot.microsoft.com/',
    mistral: 'https://chat.mistral.ai/chat',
    perplexity: 'https://www.perplexity.ai/',
    deepseek: 'https://chat.deepseek.com/',
    phind: 'https://www.phind.com/'
};

// Default settings
const defaultSettings = {
    theme: {
        name: 'default',
        colors: {
            primary: '#6C5CE7',
            secondary: '#A8A5E6',
            background: '#1A1A1A'
        }
    },
    shortcuts: {
        sendMessage: 'Ctrl+Enter',
        newChat: 'Ctrl+N'
    },
    aiModels: {
        order: ['chatgpt', 'gemini', 'claude', 'copilot', 'mistral', 'perplexity', 'deepseek', 'phind'],
        enabled: {
            chatgpt: true,
            gemini: true,
            claude: true,
            copilot: false,
            mistral: false,
            perplexity: false,
            deepseek: false,
            phind: false
        }
    },
    interface: {
        layout: 'default',
        showTimestamps: true,
        autoScroll: true
    }
};

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get('settings');
        return result.settings || defaultSettings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
    }
}

// Save settings to storage
async function saveSettings(settings) {
    try {
        await chrome.storage.local.set({ settings });
        showToast('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

// Initialize settings UI
async function initializeSettings() {
    const settings = await loadSettings() || defaultSettings;

    // Theme settings
    const themeSelect = document.getElementById('theme-select');
    themeSelect.value = settings?.theme?.name || 'default';
    document.getElementById('primary-color').value = settings?.theme?.colors?.primary || '#6C5CE7';
    document.getElementById('secondary-color').value = settings?.theme?.colors?.secondary || '#A8A5E6';
    document.getElementById('background-color').value = settings?.theme?.colors?.background || '#1A1A1A';

    // Show/hide custom colors based on theme selection
    toggleCustomColors();

    // Keyboard shortcuts
    document.getElementById('shortcut-send').value = settings?.shortcuts?.sendMessage || 'Ctrl+Enter';
    document.getElementById('shortcut-new-chat').value = settings?.shortcuts?.newChat || 'Ctrl+N';

    // AI Models
    const modelsList = document.getElementById('ai-models-list');
    if (settings?.aiModels?.order) {
        // Reorder based on saved order
        const orderedModels = settings.aiModels.order.map(modelId => {
            const modelItem = modelsList.querySelector(`[data-model="${modelId}"]`);
            if (modelItem) {
                modelsList.appendChild(modelItem);
            }
            return modelId;
        });
    }

    // Set checkbox states
    document.querySelectorAll('.model-item input[type="checkbox"]').forEach(checkbox => {
        const modelId = checkbox.id;
        checkbox.checked = settings?.aiModels?.enabled?.[modelId] ?? defaultSettings.aiModels.enabled[modelId];
    });

    // Interface settings
    document.getElementById('layout-select').value = settings?.interface?.layout || 'default';
    document.getElementById('show-timestamps').checked = settings?.interface?.showTimestamps ?? true;
    document.getElementById('auto-scroll').checked = settings?.interface?.autoScroll ?? true;
}

// Get current settings from UI
function getCurrentSettings() {
    const modelOrder = Array.from(document.querySelectorAll('.model-item'))
        .map(item => item.dataset.model);
    
    const modelEnabled = {};
    document.querySelectorAll('.model-item input[type="checkbox"]')
        .forEach(checkbox => {
            modelEnabled[checkbox.id] = checkbox.checked;
        });

    return {
        theme: {
            name: document.getElementById('theme-select').value,
            colors: {
                primary: document.getElementById('primary-color').value,
                secondary: document.getElementById('secondary-color').value,
                background: document.getElementById('background-color').value
            }
        },
        shortcuts: {
            sendMessage: document.getElementById('shortcut-send').value,
            newChat: document.getElementById('shortcut-new-chat').value
        },
        aiModels: {
            order: modelOrder,
            enabled: modelEnabled
        },
        interface: {
            layout: document.getElementById('layout-select').value,
            showTimestamps: document.getElementById('show-timestamps').checked,
            autoScroll: document.getElementById('auto-scroll').checked
        }
    };
}

// Show/hide custom colors based on theme selection
function toggleCustomColors() {
    const themeSelect = document.getElementById('theme-select');
    const customColors = document.getElementById('custom-colors');
    customColors.style.display = themeSelect.value === 'custom' ? 'block' : 'none';
}

// Show toast message
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize drag and drop for AI models
function initializeDragAndDrop() {
    const modelsList = document.getElementById('ai-models-list');
    let draggedItem = null;

    document.querySelectorAll('.model-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            
            // Save new order
            const newOrder = Array.from(modelsList.children).map(item => 
                item.dataset.model
            );
            
            const settings = getCurrentSettings();
            settings.aiModels.order = newOrder;
            saveSettings(settings);
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!draggedItem || draggedItem === item) return;
            
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            if (e.clientY < midY) {
                modelsList.insertBefore(draggedItem, item);
            } else {
                modelsList.insertBefore(draggedItem, item.nextSibling);
            }
        });
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeSettings();
    initializeDragAndDrop();

    // Theme select change
    document.getElementById('theme-select').addEventListener('change', toggleCustomColors);

    // Save button click
    document.getElementById('save-settings').addEventListener('click', async () => {
        const settings = getCurrentSettings();
        await saveSettings(settings);
    });

    // Reset button click
    document.getElementById('reset-settings').addEventListener('click', async () => {
        await saveSettings(defaultSettings);
        initializeSettings();
        showToast('Settings reset to default');
    });

    // Shortcut edit buttons
    document.querySelectorAll('.edit-shortcut').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            input.readOnly = false;
            input.focus();
            
            const saveShortcut = (e) => {
                input.readOnly = true;
                input.removeEventListener('blur', saveShortcut);
                input.removeEventListener('keydown', handleShortcutInput);
            };

            const handleShortcutInput = (e) => {
                e.preventDefault();
                const keys = [];
                if (e.ctrlKey) keys.push('Ctrl');
                if (e.shiftKey) keys.push('Shift');
                if (e.altKey) keys.push('Alt');
                if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                    keys.push(e.key.toUpperCase());
                }
                if (keys.length > 0) {
                    input.value = keys.join('+');
                    saveShortcut();
                }
            };

            input.addEventListener('blur', saveShortcut);
            input.addEventListener('keydown', handleShortcutInput);
        });
    });
}); 