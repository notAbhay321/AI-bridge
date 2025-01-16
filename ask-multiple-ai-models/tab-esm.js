// Logging
const _LL = (msg) => chrome.runtime.sendMessage({ log: msg });

import { ChatSession } from './chat-session.js';

// Initialize chat session
const chatSession = new ChatSession();

/**
 * Save Settings in local storage
 * 
 * @param {Settings} settings
 * @returns {Promise<void>}
 */
const saveSettings = (settings) =>
    chrome.storage.local.set({ settings: settings });

/**
 * Get settings from local storage
 *
 * @return  {Promise<Settings|null>}  promise resolve settings or null if not found
 */
const getSettings = () =>
    chrome.storage.local.get("settings").then(results => results.settings);

// Format timestamp in a friendly way
const formatTimestamp = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
};

// Show warning toast
const showWarning = (message, duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = 'warning-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
};

// Global function for hiding message actions
const hideAllMessageActions = (e) => {
    if (!e.target.closest('.message')) {
        document.querySelectorAll('.message.show-actions').forEach(msg => {
            msg.classList.remove('show-actions');
        });
    }
};

// Update chat list UI with enhanced features
const updateChatList = () => {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = ''; // Clear existing chats
    
    // Add search container if it doesn't exist
    let searchContainer = document.querySelector('.search-container');
    if (!searchContainer) {
        searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" placeholder="Search messages...">
        `;
        chatList.parentElement.insertBefore(searchContainer, chatList);
        
        // Add search functionality
        const searchInput = searchContainer.querySelector('.search-input');
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const chats = chatSession.getAllChats();
            
            chats.forEach(chat => {
                const chatElement = document.querySelector(`[data-chat-id="${chat.id}"]`);
                if (chatElement) {
                    const hasMatch = chat.messages.some(msg => 
                        msg.text.toLowerCase().includes(searchTerm)
                    );
                    chatElement.style.display = hasMatch || !searchTerm ? 'flex' : 'none';
                }
            });
        });
    }
    
    const chats = chatSession.getAllChats();
    const currentChat = chatSession.getCurrentChat();
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item${chat.id === currentChat?.id ? ' active' : ''}`;
        chatItem.dataset.chatId = chat.id;
        
        const chatItemHeader = document.createElement('div');
        chatItemHeader.className = 'chat-item-header';
        
        const chatInfo = document.createElement('div');
        chatInfo.className = 'chat-info';
        chatInfo.textContent = chat.title;
        
        const chatMenu = document.createElement('div');
        chatMenu.className = 'chat-menu';
        
        const menuButton = document.createElement('button');
        menuButton.className = 'chat-menu-btn';
        menuButton.innerHTML = '⋮';
        menuButton.title = 'Chat options';
        
        const chatActions = document.createElement('div');
        chatActions.className = 'chat-actions';
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn rename';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        
        chatActions.appendChild(renameBtn);
        chatActions.appendChild(deleteBtn);
        
        // Important: Add menuButton first, then chatActions
        chatMenu.appendChild(menuButton);
        chatMenu.appendChild(chatActions);
        
        // Handle menu button click
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            chatActions.classList.toggle('show');
        });
        
        // Handle rename action
        renameBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newTitle = prompt('Enter new chat name:', chat.title);
            if (newTitle && newTitle.trim()) {
                await chatSession.updateChatTitle(chat.id, newTitle.trim());
                updateChatList();
            }
        });
        
        // Handle delete action
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this chat?')) {
                await chatSession.deleteChat(chat.id);
                updateChatList();
                updateChatMessages();
            }
        });
        
        // Close actions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-menu')) {
                chatActions.classList.remove('show');
            }
        });
        
        chatItemHeader.appendChild(chatInfo);
        chatItemHeader.appendChild(chatMenu);
        chatItem.appendChild(chatItemHeader);
        
        // Handle title editing
        chatInfo.addEventListener('blur', async () => {
            const newTitle = chatInfo.textContent.trim();
            if (newTitle) {
                await chatSession.updateChatTitle(chat.id, newTitle);
            } else {
                chatInfo.textContent = chat.title;
            }
        });
        
        // Handle keyboard events for title editing
        chatInfo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                chatInfo.blur();
            }
            if (e.key === 'Escape') {
                chatInfo.textContent = chat.title;
                chatInfo.blur();
            }
        });
        
        // Handle chat selection
        chatItem.addEventListener('click', async () => {
            await chatSession.switchChat(chat.id);
            updateChatList();
            updateChatMessages();
        });
        
        chatList.appendChild(chatItem);
    });
};

// Update chat messages UI with enhanced features
const updateChatMessages = () => {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.innerHTML = '';
    
    const currentChat = chatSession.getCurrentChat();
    
    // Add chat header
    const chatHeaderMain = document.createElement('div');
    chatHeaderMain.className = 'chat-header-main';
    
    const chatTitleMain = document.createElement('h2');
    chatTitleMain.className = 'chat-title-main';
    chatTitleMain.textContent = currentChat ? currentChat.title : 'No Chat Selected';
    
    chatHeaderMain.appendChild(chatTitleMain);
    chatContainer.appendChild(chatHeaderMain);

    if (!currentChat || currentChat.messages.length === 0) {
        const noMessages = document.createElement('div');
        noMessages.className = 'no-messages';
        noMessages.innerHTML = `
            <div class="no-messages-icon">💭</div>
            <div>No messages yet. Start a conversation!</div>
        `;
        chatContainer.appendChild(noMessages);
        return;
    }

    // Add chat header
    const chatHeader = document.createElement('div');
    chatHeader.className = 'chat-header';
    
    const chatTitle = document.createElement('div');
    chatTitle.className = 'chat-header-title';
    chatTitle.textContent = currentChat.title;
    
    const chatMenu = document.createElement('div');
    chatMenu.className = 'chat-header-menu';
    chatMenu.innerHTML = '⋮';
    
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'chat-header-dropdown';
    dropdownMenu.innerHTML = `
        <button class="dropdown-item rename">✏️ Rename</button>
        <button class="dropdown-item delete">🗑️ Delete</button>
    `;
    
    chatMenu.appendChild(dropdownMenu);
    chatHeader.appendChild(chatTitle);
    chatHeader.appendChild(chatMenu);
    chatContainer.appendChild(chatHeader);
    
    // Add dropdown functionality
    chatMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
    
    // Handle dropdown actions
    dropdownMenu.querySelector('.rename').addEventListener('click', async () => {
        const newTitle = prompt('Enter new chat name:', currentChat.title);
        if (newTitle && newTitle.trim()) {
            await chatSession.updateChatTitle(currentChat.id, newTitle.trim());
            updateChatList();
            updateChatMessages();
        }
    });
    
    dropdownMenu.querySelector('.delete').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this chat?')) {
            await chatSession.deleteChat(currentChat.id);
            updateChatList();
            updateChatMessages();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-header-menu')) {
            dropdownMenu.classList.remove('show');
        }
    });
    
    // Remove any existing click handlers
    document.removeEventListener('click', hideAllMessageActions);
    document.addEventListener('click', hideAllMessageActions);
    
    // Add messages
    currentChat.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message${msg.edited ? ' edited' : ''}`;
        messageDiv.dataset.messageId = msg.id;
        
        // Message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Text container
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = msg.text;
        
        // Menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'message-menu-btn';
        menuBtn.innerHTML = '⋮';
        menuBtn.title = 'Message options';
        
        // Dropdown menu
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'message-dropdown';
        
        // Edit option
        const editBtn = document.createElement('button');
        editBtn.className = 'message-dropdown-item edit';
        editBtn.innerHTML = '✏️ Edit';
        editBtn.onclick = async (e) => {
            e.stopPropagation();
            const newText = prompt('Edit message:', msg.text);
            if (newText && newText !== msg.text) {
                await chatSession.updateMessage(currentChat.id, msg.id, newText);
                updateChatMessages();
            }
            dropdownDiv.classList.remove('show');
        };
        dropdownDiv.appendChild(editBtn);
        
        // Copy option
        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-dropdown-item copy';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.onclick = async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(msg.text);
            showWarning('Message copied to clipboard!');
            dropdownDiv.classList.remove('show');
        };
        dropdownDiv.appendChild(copyBtn);
        
        // Delete option
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-dropdown-item delete';
        deleteBtn.innerHTML = '🗑️ Delete';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this message?')) {
                await chatSession.deleteMessage(currentChat.id, msg.id);
                updateChatMessages();
            }
            dropdownDiv.classList.remove('show');
        };
        dropdownDiv.appendChild(deleteBtn);
        
        // Ask Again option
        const askAgainBtn = document.createElement('button');
        askAgainBtn.className = 'message-dropdown-item ask-again';
        askAgainBtn.innerHTML = '🔄 Ask AI';
        askAgainBtn.onclick = async (e) => {
            e.stopPropagation();
            const activeButtons = Array.from(document.querySelectorAll('.ai-button')).filter(btn => 
                btn.classList.contains('active')
            );
            
            if (activeButtons.length === 0) {
                showWarning('Please select at least one AI model first!');
                return;
            }
            
            // Set the message in the input
            const promptTextElem = document.getElementById('text-prompt');
            promptTextElem.value = msg.text;
            promptTextElem.dispatchEvent(new Event('input'));
            
            // Click the submit button
            document.getElementById('submit-prompt').click();
            dropdownDiv.classList.remove('show');
        };
        dropdownDiv.appendChild(askAgainBtn);
        
        // Toggle dropdown on menu button click
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            // Close all other dropdowns first
            document.querySelectorAll('.message-dropdown.show').forEach(dropdown => {
                if (dropdown !== dropdownDiv) {
                    dropdown.classList.remove('show');
                }
            });
            dropdownDiv.classList.toggle('show');
        };
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.message-menu-btn')) {
                dropdownDiv.classList.remove('show');
            }
        });
        
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(menuBtn);
        contentDiv.appendChild(dropdownDiv);
        messageDiv.appendChild(contentDiv);
        
        // Timestamp
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';
        timestampDiv.textContent = formatTimestamp(msg.timestamp);
        messageDiv.appendChild(timestampDiv);
        
        chatContainer.appendChild(messageDiv);
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

document.addEventListener("DOMContentLoaded", async () => {
    // Load chat sessions
    await chatSession.loadFromStorage();

    if (!chrome.scripting) {
        _LL("add 'scripting' permission");
        return;
    }

    // Store current tab ID
    let currentTabId;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTabId = tabs[0].id;
    });

    const promptTextElem = document.getElementById('text-prompt');
    if (!promptTextElem) {
        _LL("'text-prompt' element not found");
        return;
    }
    const promptButtonElem = document.getElementById("submit-prompt");
    if (!promptButtonElem) {
        _LL("'submit-prompt' element not found");
        return;
    }

    // Add tooltip for Ctrl+Enter
    promptButtonElem.title = "Press Ctrl+Enter to send";

    // Add Ctrl+Enter handler to text input
    promptTextElem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !promptButtonElem.disabled) {
            e.preventDefault();
            promptButtonElem.click();
        }
    });

    const allAiToggle = document.getElementById('all-ai');
    if (!allAiToggle) {
        _LL("'all-ai' element not found");
        return;
    }

    promptTextElem.addEventListener('input', () => {
        const value = promptTextElem.value;
        promptButtonElem.disabled = value.trim().length === 0;
    });

    const aiButtons = Array.from(document.querySelectorAll(".ai-button"));
    
    // Function to handle AI button click
    const handleAiButtonClick = async (button) => {
        const isActive = button.classList.contains('active');
        
        // Check if tab already exists
        const existingTabs = await chrome.tabs.query({ 
            url: button.dataset.query,
            currentWindow: true 
        });
        
        if (!isActive) {
            // Only create new tab if one doesn't exist
            if (!existingTabs || existingTabs.length === 0) {
                const newTab = await chrome.tabs.create({ 
                    url: button.dataset.url, 
                    pinned: true,
                    active: false
                });
                
                // Add to AI Models group if it exists
                const groups = await chrome.tabGroups.query({ title: 'AI Models' });
                if (groups.length > 0) {
                    await chrome.tabs.group({ tabIds: newTab.id, groupId: groups[0].id });
                }
            }
            button.classList.add('active', 'tab-open');
        } else {
            // Add closing class for smooth transition
            button.classList.add('closing');
            button.classList.remove('active', 'tab-open');
            
            // Close existing tabs
            for (const tab of existingTabs) {
                await chrome.tabs.remove(tab.id);
            }
            
            // Remove closing class after transition
            setTimeout(() => {
                button.classList.remove('closing');
            }, 300);
        }
    };

    // Add click handlers to AI buttons
    aiButtons.forEach(button => {
        button.addEventListener('click', () => handleAiButtonClick(button));
    });

    // Handle All AI toggle
    allAiToggle.addEventListener('click', async () => {
        const allActive = aiButtons.every(btn => btn.classList.contains('active'));
        const newState = !allActive;
        
        // First focus on current tab to ensure we stay here
        if (currentTabId) {
            await chrome.tabs.update(currentTabId, { active: true });
        }

        // Process each button
        for (const button of aiButtons) {
            if (newState !== button.classList.contains('active')) {
                await handleAiButtonClick(button);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Update All AI button state
        allAiToggle.classList.remove('active', 'inactive');
        allAiToggle.classList.add(newState ? 'active' : 'inactive');
    });

    // Initialize button states from settings
    getSettings()
        .then(settings => {
            if (!settings) {
                const _settings = aiButtons.reduce((acc, elem) => {
                    acc[elem.id] = false;
                    return acc;
                }, { lastPrompt: "" });
                return _settings;
            }
            return settings;
        })
        .then(settings => {
            promptTextElem.value = settings.lastPrompt ?? "";
            promptTextElem.dispatchEvent(new Event('input'));

            // Initialize AI button states
            aiButtons.forEach(button => {
                if (settings[button.id]) {
                    button.classList.add('active');
                }
            });

            // Initialize All AI button state
            const allActive = aiButtons.every(btn => btn.classList.contains('active'));
            const someActive = aiButtons.some(btn => btn.classList.contains('active'));
            allAiToggle.classList.remove('active', 'inactive');
            if (allActive) {
                allAiToggle.classList.add('active');
            } else if (!someActive) {
                allAiToggle.classList.add('inactive');
            }
        });

    // Handle new chat button
    const newChatBtn = document.querySelector('.new-chat-btn');
    newChatBtn.addEventListener('click', async () => {
        await chatSession.createChat();
        updateChatList();
        updateChatMessages();
    });

    // Update chat list initially
    updateChatList();
    updateChatMessages();

    promptButtonElem.addEventListener("click", async () => {
        const prompt = promptTextElem.value;
        
        // Save message to current chat
        await chatSession.addMessage(prompt);
        updateChatList();
        updateChatMessages();
        
        // Clear input after sending
        promptTextElem.value = '';
        promptTextElem.dispatchEvent(new Event('input'));
        
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(prompt);
            _LL("copied to clipboard!");
        }

        // Save settings
        const settings = aiButtons.reduce((acc, elem) => {
            acc[elem.id] = elem.classList.contains('active');
            return acc;
        }, { lastPrompt: prompt });
        await saveSettings(settings);

        // Only submit to AI if there are active models
        const activeButtons = aiButtons.filter(btn => btn.classList.contains('active'));
        if (activeButtons.length > 0) {
        for (const button of activeButtons) {
            const tabs = await chrome.tabs.query({ 
                url: button.dataset.query,
                currentWindow: true 
            });
            
            if (tabs && tabs.length > 0) {
                const tab = tabs[0];
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (prompt, modelId) => {
                            // Utility function to simulate user input
                            const simulateUserInput = (element, text) => {
                                if (element) {
                                    // Clear existing text
                                    element.value = '';
                                    element.innerHTML = '';
                                    element.textContent = '';

                                    // Set new text
                                    if (element.tagName === 'TEXTAREA' || element.getAttribute('contenteditable') === null) {
                                        element.value = text;
                                    } else {
                                        element.innerHTML = text;
                                        element.textContent = text;
                                    }

                                    // Dispatch events to simulate user interaction
                                    ['input', 'change', 'paste'].forEach(eventType => {
                                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                                    });
                                }
                            };

                            // Utility function to submit
                            const submitPrompt = (input) => {
                                if (!input) return;

                                // Try multiple submission methods
                                const sendButtons = [
                                    input.parentElement?.querySelector('button[type="submit"]'),
                                    input.parentElement?.querySelector('button[aria-label="Send"]'),
                                    input.parentElement?.querySelector('button[data-testid="send-button"]'),
                                    document.querySelector('button[type="submit"]'),
                                    document.querySelector('button[aria-label="Send"]'),
                                    document.querySelector('button[data-testid="send-button"]')
                                ];

                                const sendButton = sendButtons.find(btn => btn && !btn.disabled);

                                if (sendButton) {
                                    sendButton.click();
                                } else {
                                    // Fallback to Enter key
                                    const enterEvent = new KeyboardEvent('keydown', {
                                        key: 'Enter',
                                        code: 'Enter',
                                        keyCode: 13,
                                        which: 13,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    input.dispatchEvent(enterEvent);
                                }
                            };

                            switch(modelId) {
                                case 'openai': // ChatGPT
                                    const chatgptSelectors = [
                                        '#prompt-textarea',
                                        'textarea[data-id="root"]',
                                        'textarea[placeholder*="Send a message"]'
                                    ];

                                    const chatgptInput = chatgptSelectors.reduce((found, selector) => 
                                        found || document.querySelector(selector), null);

                                    if (chatgptInput) {
                                        // Use the same input simulation as other models
                                        simulateUserInput(chatgptInput, prompt);
                                        
                                        // Use the same submission approach with a small delay
                                        setTimeout(() => {
                                            submitPrompt(chatgptInput);
                                        }, 100);
                                    }
                                    break;

                                case 'claude':
                                    const claudeSelectors = [
                                        '[data-testid="message-input"]',
                                        'textarea[name="message"]',
                                        'div[contenteditable="true"]',
                                        'textarea'
                                    ];

                                    const claudeInput = claudeSelectors.reduce((found, selector) => 
                                        found || document.querySelector(selector), null);

                                    if (claudeInput) {
                                        simulateUserInput(claudeInput, prompt);
                                        
                                        // Automatic submission for Claude
                                        setTimeout(() => {
                                            submitPrompt(claudeInput);
                                        }, 100);
                                    }
                                    break;

                                case 'gemini':
                                    const geminiInput = document.querySelector('div[contenteditable="true"]');
                                    if (geminiInput) {
                                        // Set innerHTML and dispatch input event
                                        geminiInput.innerHTML = prompt;
                                        geminiInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        
                                        // Single click submission for Gemini
                                        const sendBtn = document.querySelector('button[aria-label="Send message"]');
                                        if (sendBtn) {
                                            setTimeout(() => {
                                                sendBtn.click();
                                            }, 100);
                                        }
                                    }
                                    break;

                                default:
                                    const defaultInput = document.querySelector('textarea');
                                    if (defaultInput) {
                                        defaultInput.value = prompt;
                                        defaultInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        
                                        // Automatic submission for default
                                        setTimeout(() => {
                                            defaultInput.dispatchEvent(new KeyboardEvent('keydown', {
                                                key: 'Enter',
                                                code: 'Enter',
                                                keyCode: 13,
                                                which: 13,
                                                bubbles: true,
                                                cancelable: true
                                            }));
                                        }, 100);
                                    }
                                    break;
                            }
                        },
                        args: [prompt, button.id]
                    });
                    } catch (error) {
                        console.error(`Failed to execute script in tab ${tab.id}:`, error);
                    }
                }
            }
        }
    });

    // Add paste event handler for images
    promptTextElem.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault(); // Prevent default paste
                
                const blob = item.getAsFile();
                if (blob) {
                    // Create a new tab with Google Lens directly
                    const tab = await chrome.tabs.create({ 
                        url: 'https://lens.google.com/',
                        active: true 
                    });

                    // Wait for the tab to load and then trigger the paste
                    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                        if (tabId === tab.id && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            
                            // Add a small delay to ensure page is fully rendered
                            setTimeout(() => {
                                chrome.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    func: () => {
                                        // Click in the center of the page
                                        const centerX = window.innerWidth / 2;
                                        const centerY = window.innerHeight / 2;
                                        
                                        // Create and dispatch click event at center
                                        const clickEvent = new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window,
                                            clientX: centerX,
                                            clientY: centerY
                                        });
                                        
                                        // Find the main container or body to click
                                        const mainContainer = document.querySelector('main') || 
                                                            document.querySelector('.main-container') || 
                                                            document.body;
                                        
                                        mainContainer.dispatchEvent(clickEvent);
                                        
                                        // Short delay before pasting
                                        setTimeout(() => {
                                            // Create and dispatch paste event
                                            const pasteEvent = new ClipboardEvent('paste', {
                                                bubbles: true,
                                                cancelable: true
                                            });
                                            document.dispatchEvent(pasteEvent);
                                            
                                            // Also try Ctrl+V simulation as backup
                                            const ctrlV = new KeyboardEvent('keydown', {
                                                key: 'v',
                                                code: 'KeyV',
                                                ctrlKey: true,
                                                bubbles: true
                                            });
                                            document.dispatchEvent(ctrlV);
                                        }, 500);
                                    }
                                });
                            }, 1000); // Wait 1 second for page to be fully ready
                        }
                    });
                }
                break;
            }
        }
    });

    // Add click handler to close tabs when clicking outside
    document.addEventListener('click', async (e) => {
        // If click is not on an AI button or its children
        if (!e.target.closest('.ai-button')) {
            const openTabs = document.querySelectorAll('.ai-button.tab-open');
            for (const button of openTabs) {
                // Add closing class for smooth transition
                button.classList.add('closing');
                button.classList.remove('active', 'tab-open');
                
                // Find and close any existing tabs
                const existingTabs = await chrome.tabs.query({ 
                    url: button.dataset.query,
                    currentWindow: true 
                });
                
                for (const tab of existingTabs) {
                    await chrome.tabs.remove(tab.id);
                }
                
                // Remove closing class after transition
                setTimeout(() => {
                    button.classList.remove('closing');
                }, 300); // Match the CSS transition duration
            }
        }
    });

    // Add login button functionality
    const loginAllBtn = document.querySelector('.login-all-btn');
    loginAllBtn.addEventListener('click', async () => {
        // First focus on current tab to ensure we stay here
        if (currentTabId) {
            await chrome.tabs.update(currentTabId, { active: true });
        }

        // Get all AI buttons
        const aiButtons = Array.from(document.querySelectorAll(".ai-button"));
        const newTabIds = [];
        
        // Create tabs for all AI models
        for (const button of aiButtons) {
            if (!button.classList.contains('tab-open')) {
                const newTab = await chrome.tabs.create({ 
                    url: button.dataset.url, 
                    pinned: true,
                    active: false
                });
                newTabIds.push(newTab.id);
                button.classList.add('active', 'tab-open');
                // Add a small delay between opening tabs
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Create or get the AI Models group and add all new tabs to it
        if (newTabIds.length > 0) {
            const group = await chrome.tabs.group({ tabIds: newTabIds });
            await chrome.tabGroups.update(group, { 
                title: 'AI Models',
                color: 'blue'
            });
        }
    });

    // Add settings button functionality
    const settingsBtn = document.querySelector('.settings-btn');
    settingsBtn.addEventListener('click', async () => {
        // Open settings in a new tab
        await chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html'),
            active: true
        });
    });
});