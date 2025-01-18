// Logging
const _LL = (msg) => chrome.runtime.sendMessage({ log: msg })

/**
 * Save Settings in local sorage
 * 
 * @param {Settings} settings
 * @returns {Promise<void>}
 */
const saveSettings = (settings) =>
    chrome.storage.local.set({ settings: settings })

/**
 * get settings from local storage
 *
 * @return  {Promise<Settings|null>}  promise resolve settings or null if not found
 */
const getSettings = () =>
    chrome.storage.local.get("settings").then(results => results.settings)

document.addEventListener("DOMContentLoaded", () => {
    // Initialize UI elements
    const chatList = document.getElementById('chat-list');
    const chatContainer = document.querySelector('.chat-container');
    const chatTitle = document.querySelector('.chat-title');
    const chatTitleText = document.querySelector('.title-text');
    const dropdownIcon = document.querySelector('.dropdown-icon');
    const chatDropdown = document.querySelector('.chat-dropdown');
    const newChatBtn = document.getElementById('new-chat-btn');
    const promptTextElem = document.getElementById('text-prompt');
    const promptButtonElem = document.getElementById("submit-prompt");
    const allAiToggle = document.getElementById('all-ai');

    // Focus input field immediately and on window focus
    if (promptTextElem) {
        promptTextElem.focus();
        window.addEventListener('focus', () => {
            promptTextElem.focus();
        });
    }

    // Chat state management
    let lastChatNumber = 0;
    let activeChat = null;
    let chatMessages = {}; // Store messages for each chat
    let currentTabId;

    // Validate required elements
    if (!promptTextElem) {
        _LL("'text-prompt' element not found");
        return;
    }
    if (!promptButtonElem) {
        _LL("'submit-prompt' element not found");
        return;
    }
    if (!allAiToggle) {
        _LL("'all-ai' element not found");
        return;
    }
    if (!chrome.scripting) {
        _LL("add 'scripting' permission");
        return;
    }

    // Load existing chats and messages from storage
    chrome.storage.local.get(['chats', 'lastChatNumber', 'chatMessages'], (result) => {
        lastChatNumber = result.lastChatNumber || 0;
        chatMessages = result.chatMessages || {};
        const chats = result.chats || [];
        
        if (chats.length === 0) {
            createNewChat();
        } else {
            chats.forEach(chatName => {
                createChatElement(chatName);
                // Update lastChatNumber based on existing chat names
                const match = chatName.match(/Chat (\d+)/);
                if (match) {
                    const num = parseInt(match[1]);
                    lastChatNumber = Math.max(lastChatNumber, num);
                }
            });
            // Activate the first chat
            const firstChat = chatList.firstChild;
            if (firstChat) {
                activateChat(firstChat);
            }
        }
    });

    function createChatElement(chatName) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chatName; // Use chat name as ID
        
        // Create chat name span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = chatName;
        chatItem.appendChild(nameSpan);
        
        // Create icons container
        const iconsDiv = document.createElement('div');
        iconsDiv.className = 'chat-icons';
        
        // Create rename icon
        const renameIcon = document.createElement('button');
        renameIcon.innerHTML = '✏️';
        renameIcon.className = 'chat-icon rename-icon';
        renameIcon.title = 'Rename';
        renameIcon.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new name:', chatName);
            if (newName && newName.trim()) {
                // Update messages storage with new chat name
                if (chatMessages[chatName]) {
                    chatMessages[newName] = chatMessages[chatName];
                    delete chatMessages[chatName];
                }
                nameSpan.textContent = newName;
                chatItem.dataset.chatId = newName;
                saveChats();
            }
        };
        
        // Create delete icon
        const deleteIcon = document.createElement('button');
        deleteIcon.innerHTML = '🗑️';
        deleteIcon.className = 'chat-icon delete-icon';
        deleteIcon.title = 'Delete';
        deleteIcon.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this chat?')) {
                // Remove messages for this chat
                delete chatMessages[chatName];
                chatItem.remove();
                saveChats();
                if (activeChat === chatItem) {
                    chatContainer.innerHTML = ''; // Clear chat container
                }
            }
        };
        
        iconsDiv.appendChild(renameIcon);
        iconsDiv.appendChild(deleteIcon);
        chatItem.appendChild(iconsDiv);
        
        chatItem.addEventListener('click', () => activateChat(chatItem));
        
        // Insert at the beginning to maintain reverse order
        chatList.insertBefore(chatItem, chatList.firstChild);
        return chatItem;
    }

    function saveChats() {
        const chats = Array.from(chatList.children)
            .map(chat => chat.querySelector('span').textContent)
            .reverse(); // Reverse to store in original order
        chrome.storage.local.set({ chats, lastChatNumber, chatMessages });
    }

    function formatDate(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date >= today) {
            return 'Today';
        } else if (date >= yesterday) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    }

    function createDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        
        const dateText = document.createElement('span');
        dateText.className = 'date-text';
        dateText.textContent = formatDate(date);
        
        separator.appendChild(dateText);
        return separator;
    }

    function displayMessages(chatId) {
        chatContainer.innerHTML = ''; // Clear current messages
        const messages = chatMessages[chatId] || [];
        
        let lastDate = null;
        
        messages.forEach(msg => {
            const messageDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
            const currentDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
            
            // Add date separator if it's a new date
            if (!lastDate || currentDate.getTime() !== lastDate.getTime()) {
                chatContainer.appendChild(createDateSeparator(currentDate));
                lastDate = currentDate;
            }
            
            const messageDiv = createMessageElement(msg);
            chatContainer.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function createMessageElement(messageObj) {
        const message = typeof messageObj === 'string' ? messageObj : messageObj.text;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // Message text
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        
        // Message info container
        const infoDiv = document.createElement('div');
        infoDiv.className = 'message-info';
        
        // Time
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        
        // Get time from sentAt object if available
        let hours, minutes;
        if (messageObj.sentAt) {
            hours = messageObj.sentAt.hours;
            minutes = messageObj.sentAt.minutes;
        } else if (messageObj.timestamp) {
            const timestamp = new Date(messageObj.timestamp);
            hours = timestamp.getHours();
            minutes = timestamp.getMinutes();
        } else {
            const now = new Date();
            hours = now.getHours();
            minutes = now.getMinutes();
        }
        
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        timeSpan.textContent = `${formattedHours}:${formattedMinutes} ${ampm}`;
        
        // Store timestamp for date separators
        if (messageObj.sentAt) {
            const { year, month, date, hours: h, minutes: m } = messageObj.sentAt;
            messageDiv.dataset.timestamp = JSON.stringify(new Date(year, month, date, h, m));
        } else if (messageObj.timestamp) {
            messageDiv.dataset.timestamp = JSON.stringify(new Date(messageObj.timestamp));
        } else {
            messageDiv.dataset.timestamp = JSON.stringify(new Date());
        }
        
        // Status indicator
        const statusSpan = document.createElement('span');
        statusSpan.className = 'message-status';
        
        // Check if any AI model is active
        const activeAiModels = Array.from(document.querySelectorAll('.ai-button'))
            .some(btn => btn.classList.contains('active'));
        
        statusSpan.classList.add(activeAiModels ? 'double-tick' : 'single-tick');
        
        // Message actions menu
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Create action buttons
        const actions = [
            { icon: '📋', text: 'Copy', action: () => copyToClipboard(message) },
            { icon: '✏️', text: 'Edit', action: () => editMessage(messageDiv) },
            { icon: '🗑️', text: 'Delete', action: () => deleteMessage(messageDiv) },
            { icon: '🤖', text: 'Ask AI', action: () => askAiAgain(message) },
            { icon: '🔍', text: 'Google', action: () => googleSearch(message) }
        ];
        
        actions.forEach(({ icon, text, action }) => {
            const button = document.createElement('button');
            button.className = 'action-btn';
            button.innerHTML = `${icon} ${text}`;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                action();
                messageDiv.classList.remove('active');
            });
            actionsDiv.appendChild(button);
        });
        
        // Add click handlers
        messageDiv.addEventListener('click', () => {
            // Close any other open message actions
            document.querySelectorAll('.message.active').forEach(msg => {
                if (msg !== messageDiv) msg.classList.remove('active');
            });
            messageDiv.classList.toggle('active');
        });
        
        infoDiv.appendChild(timeSpan);
        infoDiv.appendChild(statusSpan);
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(infoDiv);
        messageDiv.appendChild(actionsDiv);
        
        return messageDiv;
    }

    // Message action functions
    function showNotification(message) {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showNotification('Copied to clipboard');
            })
            .catch(err => {
                showNotification('Failed to copy text');
                console.error('Failed to copy text:', err);
            });
    }

    function editMessage(messageDiv) {
        const textDiv = messageDiv.querySelector('.message-text');
        const originalText = textDiv.textContent;
        const newText = prompt('Edit message:', originalText);
        
        if (newText && newText.trim() && newText !== originalText) {
            textDiv.textContent = newText;
            // Update message in storage
            if (activeChat) {
                const chatId = activeChat.dataset.chatId;
                const messages = chatMessages[chatId];
                const index = Array.from(chatContainer.children).indexOf(messageDiv);
                if (messages && index !== -1) {
                    messages[index] = newText;
                    saveChats();
                }
            }
        }
    }

    function deleteMessage(messageDiv) {
        if (confirm('Delete this message?')) {
            // Remove from storage
            if (activeChat) {
                const chatId = activeChat.dataset.chatId;
                const messages = chatMessages[chatId];
                const index = Array.from(chatContainer.children).indexOf(messageDiv);
                if (messages && index !== -1) {
                    messages.splice(index, 1);
                    saveChats();
                }
            }
            messageDiv.remove();
        }
    }

    function askAiAgain(message) {
        promptTextElem.value = message;
        promptTextElem.dispatchEvent(new Event('input'));
        promptButtonElem.click();
    }

    function googleSearch(text) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
        chrome.tabs.create({ url: searchUrl });
    }

    function activateChat(chatItem) {
        if (activeChat) {
            activeChat.classList.remove('active');
        }
        chatItem.classList.add('active');
        activeChat = chatItem;
        
        // Update chat header
        const chatName = chatItem.querySelector('span').textContent;
        chatTitleText.textContent = chatName;
        
        // Display messages for this chat
        displayMessages(chatItem.dataset.chatId);
    }

    function createNewChat() {
        lastChatNumber++;
        const chatName = `Chat ${lastChatNumber}`;
        const chatItem = createChatElement(chatName);
        chatMessages[chatName] = []; // Initialize empty message array
        activateChat(chatItem);
        saveChats();
    }

    // Function to format date in DD.MM.YY pattern
    function formatCustomDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    }

    // Function to format time in HH:mm pattern
    function formatCustomTime(hours, minutes) {
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes}`;
    }

    function addMessage(message) {
        if (!activeChat) return;
        
        const chatId = activeChat.dataset.chatId;
        if (!chatMessages[chatId]) {
            chatMessages[chatId] = [];
        }
        
        // Get exact time when message is sent
        const now = new Date();
        const messageObj = {
            text: message,
            timestamp: now.toISOString(),
            sentAt: {
                hours: now.getHours(),
                minutes: now.getMinutes(),
                date: now.getDate(),
                month: now.getMonth(),
                year: now.getFullYear()
            }
        };
        
        // Store the complete message object
        chatMessages[chatId].push(messageObj);
        saveChats(); // Save immediately after adding message
        
        // Check if we need to add a date separator
        const lastMessage = chatContainer.lastElementChild;
        const needsSeparator = !lastMessage || 
            !lastMessage.classList.contains('message') ||
            new Date(JSON.parse(lastMessage.dataset.timestamp)).getDate() !== now.getDate();
        
        if (needsSeparator) {
            chatContainer.appendChild(createDateSeparator(now));
        }
        
        const messageDiv = createMessageElement(messageObj);
        chatContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    newChatBtn.addEventListener('click', createNewChat);

    // Add tooltip for Ctrl+Enter
    promptButtonElem.title = "Press Ctrl+Enter to send";

    // Add Ctrl+Enter handler to text input
    promptTextElem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !promptButtonElem.disabled) {
            e.preventDefault();
            promptButtonElem.click();
        }
    });

    // Add paste event listener for image handling
    promptTextElem.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault(); // Prevent default paste behavior
                
                // Get the image file
                const file = item.getAsFile();
                if (file) {
                    // Create a notification
                    showNotification('Opening image in Google Lens...');
                    
                    // Open Google Lens in a new tab
                    window.open('https://lens.google.com/', '_blank');
                }
                break;
            }
        }
    });

    // Regular paste handling continues below...
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
                await chrome.tabs.create({ 
                    url: button.dataset.url, 
                    pinned: true,
                    active: false
                });
            }
        } else {
            // Close existing tabs when clicking an active button
            if (existingTabs && existingTabs.length > 0) {
                await chrome.tabs.remove(existingTabs.map(tab => tab.id));
            }
        }
        
        button.classList.toggle('active');
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

        if (newState) {
            // Opening tabs
            for (const button of aiButtons) {
                if (newState !== button.classList.contains('active')) {
                    await handleAiButtonClick(button);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } else {
            // Closing tabs - find and close all AI model tabs
            for (const button of aiButtons) {
                const tabs = await chrome.tabs.query({ 
                    url: button.dataset.query,
                    currentWindow: true 
                });
                if (tabs.length > 0) {
                    await chrome.tabs.remove(tabs.map(tab => tab.id));
                }
                button.classList.remove('active');
            }
        }

        // Update All AI button state
        allAiToggle.classList.remove('active', 'inactive');
        allAiToggle.classList.add(newState ? 'active' : 'inactive');
    });

    // Initialize button states from settings
    async function initializeButtonStates() {
        const settings = await getSettings() || aiButtons.reduce((acc, elem) => {
            acc[elem.id] = false;
            return acc;
        }, { lastPrompt: "" });

        promptTextElem.value = settings.lastPrompt ?? "";
        promptTextElem.dispatchEvent(new Event('input'));

        // Check for existing tabs and update button states
        for (const button of aiButtons) {
            const existingTabs = await chrome.tabs.query({ 
                url: button.dataset.query,
                currentWindow: true 
            });
            
            if (existingTabs && existingTabs.length > 0) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }

        // Update All AI button state
        const allActive = aiButtons.every(btn => btn.classList.contains('active'));
        const someActive = aiButtons.some(btn => btn.classList.contains('active'));
        allAiToggle.classList.remove('active', 'inactive');
        if (allActive) {
            allAiToggle.classList.add('active');
        } else if (!someActive) {
            allAiToggle.classList.add('inactive');
        }
    }

    // Call the initialization function
    initializeButtonStates();

    // Handle submit button
    promptButtonElem.addEventListener("click", async () => {
        const prompt = promptTextElem.value;
        
        // Add send animation
        const sendIcon = promptButtonElem.querySelector('svg');
        sendIcon.classList.add('sending');
        
        // Add message to current chat
        addMessage(prompt);
        
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

        // Submit to active AI tabs
        const activeButtons = aiButtons.filter(btn => btn.classList.contains('active'));
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
                } catch (err) {
                    _LL(`Error with ${button.textContent}: ${err.message}`);
                }
            }
        }

        // Show success animation
        setTimeout(() => {
            sendIcon.classList.remove('sending');
            promptButtonElem.classList.add('send-success');
            
            // Clear input
            promptTextElem.value = '';
            promptTextElem.dispatchEvent(new Event('input'));
            
            // Remove success state after animation
            setTimeout(() => {
                promptButtonElem.classList.remove('send-success');
            }, 1000);
        }, 500);
    });

    // Add tab listeners for real-time updates
    chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
        // Check each button and update its state
        for (const button of aiButtons) {
            const existingTabs = await chrome.tabs.query({ 
                url: button.dataset.query,
                currentWindow: true 
            });
            
            if (existingTabs && existingTabs.length > 0) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }

        // Update All AI button state
        const allActive = aiButtons.every(btn => btn.classList.contains('active'));
        const someActive = aiButtons.some(btn => btn.classList.contains('active'));
        allAiToggle.classList.remove('active', 'inactive');
        if (allActive) {
            allAiToggle.classList.add('active');
        } else if (!someActive) {
            allAiToggle.classList.add('inactive');
        }
    });

    // Also listen for tab updates (in case URLs change)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            // Check each button and update its state
            for (const button of aiButtons) {
                const existingTabs = await chrome.tabs.query({ 
                    url: button.dataset.query,
                    currentWindow: true 
                });
                
                if (existingTabs && existingTabs.length > 0) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }

            // Update All AI button state
            const allActive = aiButtons.every(btn => btn.classList.contains('active'));
            const someActive = aiButtons.some(btn => btn.classList.contains('active'));
            allAiToggle.classList.remove('active', 'inactive');
            if (allActive) {
                allAiToggle.classList.add('active');
            } else if (!someActive) {
                allAiToggle.classList.add('inactive');
            }
        }
    });

    // Add login button functionality
    const loginBtn = document.getElementById('login-btn');
    let currentGroupId = null;

    loginBtn.addEventListener('click', async () => {
        try {
            // If group exists, close all tabs in the group
            if (currentGroupId !== null) {
                const tabs = await chrome.tabs.query({ groupId: currentGroupId });
                const tabIds = tabs.map(tab => tab.id);
                await chrome.tabs.remove(tabIds);
                currentGroupId = null;
                return;
            }

            // Create all tabs first
            const createdTabs = [];
            for (const button of aiButtons) {
                const tab = await chrome.tabs.create({
                    url: button.dataset.url,
                    active: false
                });
                createdTabs.push(tab.id);
                // Small delay between tabs to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Create a group with all tabs
            if (createdTabs.length > 0) {
                const group = await chrome.tabs.group({
                    tabIds: createdTabs
                });
                currentGroupId = group;

                // Update group appearance
                if (chrome.tabGroups) {
                    await chrome.tabGroups.update(group, {
                        title: 'AI Login Panel',
                        color: 'blue'
                    });
                }
            }

        } catch (error) {
            console.error('Error managing login tabs:', error);
            _LL(`Error managing login tabs: ${error.message}`);
        }
    });

    // Listen for tab group removal to reset currentGroupId
    chrome.tabs.onGroupRemoved?.addListener((groupId) => {
        if (groupId === currentGroupId) {
            currentGroupId = null;
        }
    });

    // Also update currentGroupId when all tabs in group are closed
    chrome.tabs.onRemoved.addListener(async () => {
        if (currentGroupId !== null) {
            const tabs = await chrome.tabs.query({ groupId: currentGroupId });
            if (tabs.length === 0) {
                currentGroupId = null;
            }
        }
    });

    // Settings button click handler
    document.querySelector('.settings-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'settings.html' });
    });

    // Handle chat title click for dropdown
    chatTitle.addEventListener('click', (e) => {
        e.stopPropagation();
        chatTitle.classList.toggle('active');
        chatDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        chatTitle.classList.remove('active');
        chatDropdown.classList.remove('show');
    });

    // Function to format chat messages for export
    function formatChatForExport(chatName, messages) {
        const header = `Chat Export: ${chatName}\nDate: ${new Date().toLocaleString()}\nMessages: ${messages.length}\n\n`;
        
        const formattedMessages = messages.map(msg => {
            const timestamp = new Date(msg.timestamp);
            const time = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date = timestamp.toLocaleDateString();
            return `[${date} ${time}] ${msg.text}`;
        }).join('\n\n');
        
        return header + formattedMessages;
    }

    // Handle dropdown menu actions
    chatDropdown.addEventListener('click', (e) => {
        const dropdownItem = e.target.closest('.dropdown-item');
        if (!dropdownItem) return;

        const action = dropdownItem.dataset.action;
        
        switch (action) {
            case 'edit':
                if (!activeChat) return;
                const chatNameSpan = activeChat.querySelector('span');
                const currentName = chatNameSpan.textContent;
                const newName = prompt('Enter new name:', currentName);
                if (newName && newName.trim()) {
                    // Update messages storage with new chat name
                    if (chatMessages[currentName]) {
                        chatMessages[newName] = chatMessages[currentName];
                        delete chatMessages[currentName];
                    }
                    chatNameSpan.textContent = newName;
                    activeChat.dataset.chatId = newName;
                    chatTitleText.textContent = newName;
                    saveChats();
                }
                break;

            case 'delete':
                if (!activeChat) return;
                if (confirm('Are you sure you want to delete this chat?')) {
                    const chatName = activeChat.dataset.chatId;
                    delete chatMessages[chatName];
                    activeChat.remove();
                    chatTitleText.textContent = 'Select a chat';
                    chatContainer.innerHTML = '';
                    activeChat = null;
                    saveChats();
                }
                break;

            case 'info':
                if (!activeChat) return;
                const chatName = activeChat.dataset.chatId;
                const messageCount = chatMessages[chatName]?.length || 0;
                alert(`Chat: ${chatName}\nMessages: ${messageCount}`);
                break;
                
            case 'export':
                if (!activeChat) return;
                const chatId = activeChat.dataset.chatId;
                const messages = chatMessages[chatId] || [];
                
                // Format the content with proper date handling
                const now = new Date();
                const header = `Chat Export: ${chatId}\nExported on: ${formatCustomDate(now)} ${formatCustomTime(now.getHours(), now.getMinutes())}\nTotal Messages: ${messages.length}\n\n`;
                
                const formattedMessages = messages.map(msg => {
                    // Handle both string messages and message objects
                    const text = typeof msg === 'string' ? msg : msg.text;
                    
                    // Get timestamp from sentAt object if available
                    let dateStr, timeStr;
                    if (msg.sentAt) {
                        const { hours, minutes, date, month, year } = msg.sentAt;
                        const msgDate = new Date(year, month, date);
                        dateStr = formatCustomDate(msgDate);
                        timeStr = formatCustomTime(hours, minutes);
                    } else if (msg.timestamp) {
                        const timestamp = new Date(msg.timestamp);
                        if (!isNaN(timestamp)) {
                            dateStr = formatCustomDate(timestamp);
                            timeStr = formatCustomTime(timestamp.getHours(), timestamp.getMinutes());
                        } else {
                            dateStr = formatCustomDate(now);
                            timeStr = formatCustomTime(now.getHours(), now.getMinutes());
                        }
                    } else {
                        dateStr = formatCustomDate(now);
                        timeStr = formatCustomTime(now.getHours(), now.getMinutes());
                    }
                    
                    return `[${dateStr} ${timeStr}] ${text}`;
                }).join('\n\n');
                
                // Create file name with current date and message count
                const date = formatCustomDate(now);
                const fileName = `${chatId.replace(/[^a-z0-9]/gi, '_')}_${date}_${messages.length}msgs.txt`;
                
                // Create and trigger download
                const blob = new Blob([header + formattedMessages], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                showNotification('Chat exported successfully');
                break;
        }

        chatDropdown.classList.remove('show');
    });
});


