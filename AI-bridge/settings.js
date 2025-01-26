document.addEventListener('DOMContentLoaded', () => {
    // Initialize drag and drop for AI models
    initializeDragAndDrop();
    
    // Load saved settings
    loadSettings();
    
    // Add event listeners for settings changes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', saveSettings);
    });
    
    document.getElementById('max-chats').addEventListener('change', saveSettings);
    
    // Save button handler
    document.getElementById('save-settings').addEventListener('click', () => {
        saveSettings();
        showNotification('Settings saved successfully!');
    });
    
    // Reset button handler
    document.getElementById('reset-settings').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            resetSettings();
            showNotification('Settings reset to default!');
        }
    });
});

function initializeDragAndDrop() {
    const modelsGrid = document.querySelector('.models-grid');
    const modelItems = document.querySelectorAll('.model-item');
    
    modelItems.forEach(item => {
        item.addEventListener('dragstart', () => {
            item.classList.add('dragging');
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            saveModelOrder();
        });
    });
    
    modelsGrid.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        const siblings = [...modelsGrid.querySelectorAll('.model-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const box = sibling.getBoundingClientRect();
            return e.clientY <= box.top + box.height / 2;
        });
        
        modelsGrid.insertBefore(draggingItem, nextSibling);
    });
}

function saveModelOrder() {
    const models = [...document.querySelectorAll('.model-item')].map(item => ({
        id: item.dataset.model,
        enabled: item.querySelector('input[type="checkbox"]').checked
    }));
    
    chrome.storage.sync.set({ aiModels: models }, () => {
        showNotification('Model order updated!');
    });
}

function loadSettings() {
    chrome.storage.sync.get({
        // Default settings
        aiModels: [
            { id: 'chatgpt', enabled: true },
            { id: 'gemini', enabled: true },
            { id: 'claude', enabled: true },
            { id: 'perplexity', enabled: true },
            { id: 'copilot', enabled: true },
            { id: 'github-copilot', enabled: true },
            { id: 'deepseek', enabled: true },
            { id: 'mistral', enabled: true },
            { id: 'phind', enabled: true }
        ],
        ctrlEnterToSend: true,
        darkMode: true,
        animationEffects: true,
        autoSaveChats: true,
        maxChats: 50,
        notifications: false,
        soundEffects: false
    }, (settings) => {
        // Apply loaded settings to UI
        document.getElementById('ctrl-enter-toggle').checked = settings.ctrlEnterToSend;
        document.getElementById('dark-mode-toggle').checked = settings.darkMode;
        document.getElementById('animation-toggle').checked = settings.animationEffects;
        document.getElementById('auto-save-toggle').checked = settings.autoSaveChats;
        document.getElementById('max-chats').value = settings.maxChats;
        document.getElementById('notification-toggle').checked = settings.notifications;
        document.getElementById('sound-toggle').checked = settings.soundEffects;
        
        // Apply AI model settings
        settings.aiModels.forEach(model => {
            const modelElement = document.querySelector(`[data-model="${model.id}"]`);
            if (modelElement) {
                modelElement.querySelector('input[type="checkbox"]').checked = model.enabled;
            }
        });
    });
}

function saveSettings() {
    const settings = {
        aiModels: [...document.querySelectorAll('.model-item')].map(item => ({
            id: item.dataset.model,
            enabled: item.querySelector('input[type="checkbox"]').checked
        })),
        ctrlEnterToSend: document.getElementById('ctrl-enter-toggle').checked,
        darkMode: document.getElementById('dark-mode-toggle').checked,
        animationEffects: document.getElementById('animation-toggle').checked,
        autoSaveChats: document.getElementById('auto-save-toggle').checked,
        maxChats: parseInt(document.getElementById('max-chats').value),
        notifications: document.getElementById('notification-toggle').checked,
        soundEffects: document.getElementById('sound-toggle').checked
    };
    
    chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
            showNotification('Error saving settings!', 'error');
        }
    });
}

function resetSettings() {
    const defaultSettings = {
        aiModels: [
            { id: 'chatgpt', enabled: true },
            { id: 'gemini', enabled: true },
            { id: 'claude', enabled: true },
            { id: 'perplexity', enabled: true },
            { id: 'copilot', enabled: true },
            { id: 'github-copilot', enabled: true },
            { id: 'deepseek', enabled: true },
            { id: 'mistral', enabled: true },
            { id: 'phind', enabled: true }
        ],
        ctrlEnterToSend: true,
        darkMode: true,
        animationEffects: true,
        autoSaveChats: true,
        maxChats: 50,
        notifications: false,
        soundEffects: false
    };
    
    chrome.storage.sync.set(defaultSettings, () => {
        loadSettings();
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }, 100);
} 