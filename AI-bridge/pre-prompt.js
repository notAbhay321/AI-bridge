// Pre-prompt functionality
document.addEventListener('DOMContentLoaded', () => {
    const addPromptBtn = document.getElementById('add-prompt-btn');
    const prePromptOverlay = document.getElementById('pre-prompt-overlay');
    const prePromptForm = document.getElementById('pre-prompt-form');
    const prePromptContainer = document.getElementById('pre-prompt-container');
    const promptTextArea = document.getElementById('text-prompt');
    let editingPromptIndex = -1;
    let currentUser = null;

    // Update the popup HTML structure
    const popup = document.querySelector('.pre-prompt-popup');
    const form = popup.querySelector('form');
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'popup-buttons';
    
    // Move the existing save button
    const saveBtn = form.querySelector('.save-prompt-btn');
    form.removeChild(saveBtn);
    buttonsContainer.appendChild(saveBtn);
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-prompt-btn';
    deleteBtn.style.display = 'none';
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
    </svg>`;
    
    // Handle delete click
    deleteBtn.addEventListener('click', async () => {
        if (editingPromptIndex >= 0) {
            try {
                const result = await chrome.storage.sync.get(['prePrompts']);
                const prePrompts = result.prePrompts || [];
                prePrompts.splice(editingPromptIndex, 1);
                
                await chrome.storage.sync.set({ prePrompts });
                prePromptContainer.innerHTML = '';
                prePrompts.forEach((p, i) => addPrePromptButton(p, i));
                showNotification('Pre-prompt deleted successfully!');
                prePromptOverlay.style.display = 'none';
            } catch (error) {
                console.error('Error deleting pre-prompt:', error);
                showNotification('Error deleting pre-prompt');
            }
        }
    });
    
    buttonsContainer.appendChild(deleteBtn);
    form.appendChild(buttonsContainer);

    // Show popup when clicking add button
    addPromptBtn.addEventListener('click', () => {
        editingPromptIndex = -1;
        document.getElementById('prompt-label').value = '';
        document.getElementById('prompt-instructions').value = '';
        deleteBtn.style.display = 'none';
        prePromptOverlay.style.display = 'block';
    });

    // Hide popup when clicking outside
    prePromptOverlay.addEventListener('click', (e) => {
        if (e.target === prePromptOverlay) {
            prePromptOverlay.style.display = 'none';
        }
    });

    // Handle form submission
    prePromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const label = document.getElementById('prompt-label').value;
        const instructions = document.getElementById('prompt-instructions').value;
        
        try {
            const result = await chrome.storage.sync.get(['prePrompts']);
            const prePrompts = result.prePrompts || [];
            
            if (editingPromptIndex >= 0) {
                prePrompts[editingPromptIndex] = { label, instructions };
                showNotification('Pre-prompt updated successfully!');
            } else {
                prePrompts.push({ label, instructions });
                showNotification('Pre-prompt added successfully!');
            }
            
            await chrome.storage.sync.set({ prePrompts });
            
            // Refresh all buttons
            prePromptContainer.innerHTML = '';
            prePrompts.forEach((prompt, index) => addPrePromptButton(prompt, index));
            
            // Reset and close form
            prePromptForm.reset();
            prePromptOverlay.style.display = 'none';
        } catch (error) {
            console.error('Error saving pre-prompt:', error);
            showNotification('Error saving pre-prompt');
        }
    });

    async function loadPrePrompts() {
        try {
            const result = await chrome.storage.sync.get(['prePrompts']);
            const prePrompts = result.prePrompts || [];
            
            // Clear existing buttons
            prePromptContainer.innerHTML = '';
            
            // Add buttons for each pre-prompt
            prePrompts.forEach((prompt, index) => addPrePromptButton(prompt, index));
        } catch (error) {
            console.error('Error loading pre-prompts:', error);
            showNotification('Error loading pre-prompts');
        }
    }

    function addPrePromptButton(prompt, index) {
        const button = document.createElement('button');
        button.className = 'pre-prompt-button';
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = prompt.label;
        button.appendChild(labelSpan);
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24">
            <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
        </svg>`;
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingPromptIndex = index;
            
            document.getElementById('prompt-label').value = prompt.label;
            document.getElementById('prompt-instructions').value = prompt.instructions;
            
            deleteBtn.style.display = 'flex';
            prePromptOverlay.style.display = 'block';
        });
        
        button.appendChild(editBtn);
        
        button.addEventListener('click', () => {
            const currentText = promptTextArea.value;
            if (!currentText.startsWith(prompt.instructions)) {
                promptTextArea.value = prompt.instructions + '\n\n' + currentText;
                promptTextArea.dispatchEvent(new Event('input'));
            }
        });
        
        prePromptContainer.appendChild(button);
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2300);
    }

    // Load pre-prompts when page loads
    loadPrePrompts();
}); 