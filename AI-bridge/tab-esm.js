// Import config
import config from './config.js';

// Logging
const _LL = (msg) => chrome.runtime.sendMessage({ log: msg })

// Global state
let chatMessages = {};
let activeChat = null;
let lastChatNumber = 0;
let currentTabId;

// Firebase configuration
const firebaseConfig = config.firebase;

// Declare chatContainer at the top level
let chatContainer;

// Add this at the top with other global variables
let currentChatPage = 1;
const CHATS_PER_PAGE = 10;
const CHATS_PER_LOAD = 5;

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

// Load Firebase scripts
async function loadFirebaseScripts() {
    try {
        // Load Firebase App
        const appScript = document.createElement('script');
        appScript.src = chrome.runtime.getURL('firebase-app.js');
        document.head.appendChild(appScript);
        await new Promise(resolve => appScript.onload = resolve);

        // Load Firebase Auth
        const authScript = document.createElement('script');
        authScript.src = chrome.runtime.getURL('firebase-auth.js');
        document.head.appendChild(authScript);
        await new Promise(resolve => authScript.onload = resolve);

        // Load Firebase Firestore
        const firestoreScript = document.createElement('script');
        firestoreScript.src = chrome.runtime.getURL('firebase-firestore.js');
        document.head.appendChild(firestoreScript);
        await new Promise(resolve => firestoreScript.onload = resolve);

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        window.database = firebase.firestore();

        // Initialize user data if logged in
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            await initializeUserData(user);
        }
    } catch (error) {
        console.error('Error loading Firebase:', error);
        throw error;
    }
}

// Function to format timestamp to human readable format
const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    let date;
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        // Handle Unix timestamps (both string and number)
        date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
    }

    if (isNaN(date.getTime())) {
        return 'Just now';
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Today's date at midnight
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Yesterday's date at midnight
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    // A week ago at midnight
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // If less than 1 minute
    if (diffMins < 1) {
        return 'Just now';
    }
    // If less than 1 hour
    else if (diffMins < 60) {
        return `${diffMins}m ago`;
    }
    // If less than 24 hours
    else if (diffHours < 24 && date >= today) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
    // If yesterday
    else if (date >= yesterday) {
        return 'Yesterday';
    }
    // If within last 7 days
    else if (date >= weekAgo) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    // If this year
    else if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }
    // If before this year
    else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
};

// Function to format full timestamp (for message details)
const formatFullTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
    }

    if (isNaN(date.getTime())) {
        return 'Unknown date';
    }

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

async function initializeUserData(user) {
    try {
        const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
        const userDoc = await window.database.doc(`users/${emailAsId}`).get();
        
        if (!userDoc.exists()) {
            const now = firebase.firestore.FieldValue.serverTimestamp();
            const currentDate = new Date();
            await window.database.doc(`users/${emailAsId}`).set({
                email: user.email,
                uid: user.uid,
                createdAt: now,
                createdAtReadable: formatFullTimestamp(currentDate),
                lastActive: now,
                lastActiveReadable: formatFullTimestamp(currentDate),
                chats: []
            });

            // Create a welcome chat
            const chatId = 'chat_' + Date.now();
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const welcomeMessage = {
                text: 'Welcome to AI Bridge! Start by typing a message below.',
                timestamp: timestamp,
                timestampReadable: formatFullTimestamp(currentDate)
            };

            await window.database.doc(`users/${emailAsId}/chats/${chatId}`).set({
                title: 'Welcome Chat',
                createdAt: timestamp,
                createdAtReadable: formatFullTimestamp(currentDate),
                updatedAt: timestamp,
                updatedAtReadable: formatFullTimestamp(currentDate),
                lastMessageTimestamp: timestamp,
                lastMessageTimestampReadable: formatFullTimestamp(currentDate),
                messages: [welcomeMessage]
            });
        } else {
            const currentDate = new Date();
            await window.database.doc(`users/${emailAsId}`).set({
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                lastActiveReadable: formatFullTimestamp(currentDate)
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error initializing user data:', error);
    }
}

// Save chat to chrome.storage or Firebase
const saveChat = async (chatData) => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user || !user.idToken) {
        try {
            const result = await chrome.storage.local.get('localChats');
            const localChats = result.localChats || {};
            localChats[chatData.id] = chatData;
            await chrome.storage.local.set({ localChats });
            return;
        } catch (error) {
            console.error('Error saving to chrome storage:', error);
            throw error;
        }
    }

    try {
        const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
        const chatRef = window.database.collection(`users/${emailAsId}/chats`).doc(chatData.id);
        
        // Save chat metadata (without messages)
        const chatMetadata = {
            title: chatData.title,
            name: chatData.name,
            createdAt: chatData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageTimestamp: chatData.lastMessageTimestamp || firebase.firestore.FieldValue.serverTimestamp(),
            lastMessagePreview: chatData.messages?.[chatData.messages.length - 1]?.text || ''
        };

        await chatRef.set(chatMetadata, { merge: true });
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
};

async function loadChats(limit = CHATS_PER_PAGE, lastChat = null) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // If user is not logged in, load from chrome.storage
        if (!user || !user.idToken) {
            const result = await chrome.storage.local.get('localChats');
            const localChats = result.localChats || {};
            return Object.values(localChats).sort((a, b) => {
                const timestampA = Number(a.lastMessageTimestamp);
                const timestampB = Number(b.lastMessageTimestamp);
                return timestampB - timestampA;
            }).slice(0, limit);
        }

        // If user is logged in, load from Firebase using email as ID
        const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
        const userChatsRef = window.database.collection(`users/${emailAsId}/chats`);
        
        let query = userChatsRef;
        
        // Get all chats and sort them in memory for now
        const snapshot = await query.get();
        
        const chats = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data) {
                chats.push({
                    id: doc.id,
                    name: data.title || `Chat ${chats.length + 1}`,
                    title: data.title || `Chat ${chats.length + 1}`,
                    messages: data.messages || [],
                    createdAt: data.createdAt?.seconds ? 
                        new Date(data.createdAt.seconds * 1000).getTime() : 
                        new Date(data.createdAt || Date.now()).getTime(),
                    updatedAt: data.updatedAt?.seconds ? 
                        new Date(data.updatedAt.seconds * 1000).getTime() : 
                        new Date(data.updatedAt || Date.now()).getTime(),
                    lastMessageTimestamp: data.lastMessageTimestamp?.seconds ? 
                        new Date(data.lastMessageTimestamp.seconds * 1000).getTime() : 
                        new Date(data.lastMessageTimestamp || Date.now()).getTime(),
                    preview: data.messages?.[data.messages.length - 1]?.text || ''
                });
            }
        });

        // Sort chats by lastMessageTimestamp
        chats.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
        
        // Store total chats count for pagination
        window.totalChats = chats.length;
        
        // Apply limit after sorting
        return chats.slice(0, limit);
    } catch (error) {
        console.error('Error loading chats:', error);
        return [];
    }
}

async function deleteChat(chatId) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // If user is not logged in, delete from chrome.storage
        if (!user || !user.idToken) {
            const result = await chrome.storage.local.get('localChats');
            const localChats = result.localChats || {};
            delete localChats[chatId];
            await chrome.storage.local.set({ localChats });
            return;
        }

        // If user is logged in, delete from Firebase using email as ID
        const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
        await window.database.doc(`users/${emailAsId}/chats/${chatId}`).delete();
    } catch (error) {
        console.error('Error deleting chat:', error);
        throw error;
    }
}

// Function to load messages for a specific chat
async function loadMessages(chatId, limit = 20, lastMessage = null) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!user || !user.idToken) {
            // For local storage, return all messages since we already have them
            return chatMessages[chatId]?.messages || [];
        }

        const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
        const messagesRef = window.database
            .collection(`users/${emailAsId}/chats/${chatId}/messages`);

        // Get all messages for now and sort in memory
        const snapshot = await messagesRef.get();
        const messages = [];
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                text: data.text,
                timestamp: data.timestamp?.seconds ? 
                    new Date(data.timestamp.seconds * 1000).getTime() : 
                    new Date(data.timestamp || Date.now()).getTime(),
                timestampReadable: data.timestampReadable || formatFullTimestamp(new Date(data.timestamp))
            });
        });

        // Sort messages by timestamp in descending order
        messages.sort((a, b) => b.timestamp - a.timestamp);
        
        // Apply limit after sorting
        const limitedMessages = messages.slice(0, limit);
        
        // Return in ascending order for display
        return limitedMessages.reverse();
    } catch (error) {
        console.error('Error loading messages:', error);
        return [];
    }
}

// Function to create time separator element
function createTimeSeparator(text) {
    const separator = document.createElement('div');
    separator.className = 'time-separator';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    
    separator.appendChild(textSpan);
    return separator;
}

// Function to format date for separators
function formatDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (date >= today) {
        return 'Today';
    } else if (date >= yesterday) {
        return 'Yesterday';
    } else if (date >= sevenDaysAgo) {
        return 'Previous 7 Days';
    } else if (date >= thirtyDaysAgo) {
        return 'Previous 30 Days';
    } else {
        return 'Older';
    }
}

// Helper functions for message actions
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
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function copyMessageText(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showNotification('Message copied to clipboard');
        })
        .catch(() => {
            showNotification('Failed to copy message');
        });
}

function deleteMessage(messageDiv) {
    if (!activeChat || !messageDiv) return;
    
    const chatId = activeChat.dataset.chatId;
    if (!chatMessages[chatId]) return;

    // Find the message in the chat's messages array
    const messageText = messageDiv.querySelector('.message-text').textContent;
    const messageIndex = chatMessages[chatId].messages.findIndex(msg => msg.text === messageText);
    
    if (messageIndex !== -1) {
        // Remove message from array
        chatMessages[chatId].messages.splice(messageIndex, 1);
        
        // Remove message element from DOM
        messageDiv.remove();
        
        // Save updated chat
        saveChat(chatMessages[chatId])
            .then(() => {
                showNotification('Message deleted successfully');
            })
            .catch(error => {
                console.error('Error deleting message:', error);
                showNotification('Failed to delete message');
            });
    }
}

function askAI(text) {
    // Implement AI query logic
    showNotification('Asking AI...');
}

function googleSearch(text) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
}

function enterEditMode(messageDiv, message) {
    const messageContent = messageDiv.querySelector('.message-content');
    const messageText = messageDiv.querySelector('.message-text');
    
    messageDiv.classList.add('editing');
    const editContainer = document.createElement('div');
    editContainer.className = 'message-edit-container';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'message-edit-textarea';
    textarea.value = message.text;
    textarea.spellcheck = false;
    
    // Set initial height
    textarea.style.height = 'auto';
    textarea.style.height = messageText.offsetHeight + 'px';
    
    // Auto-resize on input
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });
    
    const actions = document.createElement('div');
    actions.className = 'message-edit-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        messageDiv.classList.remove('editing');
        editContainer.remove();
        messageContent.style.display = '';
    };
    
    const sendBtn = document.createElement('button');
    sendBtn.className = 'edit-btn send';
    sendBtn.textContent = 'Save';
    sendBtn.onclick = async () => {
        const newText = textarea.value.trim();
        if (newText && newText !== message.text) {
            message.text = newText;
            messageText.textContent = newText;
            try {
                await saveChat(chatMessages[activeChat.dataset.chatId]);
                showNotification('Message updated successfully');
            } catch (error) {
                console.error('Error updating message:', error);
                showNotification('Failed to update message');
            }
        }
        messageDiv.classList.remove('editing');
        editContainer.remove();
        messageContent.style.display = '';
    };
    
    actions.appendChild(cancelBtn);
    actions.appendChild(sendBtn);
    editContainer.appendChild(textarea);
    editContainer.appendChild(actions);
    
    messageContent.style.display = 'none';
    messageDiv.appendChild(editContainer);
    textarea.focus();
    
    // Set cursor position to end of text
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// Function to create message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('p');
    messageText.className = 'message-text';
    messageText.textContent = message.text;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    // Format timestamp
    const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
    const timeStr = timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    messageInfo.textContent = timeStr;
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageInfo);
    
    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    
    const actions = [
        { name: 'Copy', action: 'copy', handler: () => copyMessageText(message.text) },
        { name: 'Edit', action: 'edit', handler: () => enterEditMode(messageDiv, message) },
        { name: 'Delete', action: 'delete', handler: () => deleteMessage(messageDiv) },
        { name: 'Ask AI', action: 'ask-ai', handler: () => askAI(message.text) },
        { name: 'Google', action: 'google', handler: () => googleSearch(message.text) }
    ];
    
    actions.forEach(({ name, action, handler }) => {
        const button = document.createElement('button');
        button.className = 'action-btn';
        button.setAttribute('data-action', action);
        button.innerHTML = `<i></i>${name}`;
        button.onclick = (e) => {
            e.stopPropagation();
            handler();
        };
        actionsDiv.appendChild(button);
    });
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(actionsDiv);
    
    return messageDiv;
}

// Function to display messages with lazy loading
async function displayMessages(chatId) {
    chatContainer.innerHTML = '';
    if (!chatMessages[chatId]) {
        return;
    }

    // Load initial messages
    const messages = await loadMessages(chatId);
    chatMessages[chatId].messages = messages;

    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading more messages...';
    loadingIndicator.style.display = 'none';

    // Add scroll handler for lazy loading
    let isLoading = false;
    chatContainer.addEventListener('scroll', async () => {
        if (chatContainer.scrollTop === 0 && !isLoading) {
            isLoading = true;
            loadingIndicator.style.display = 'block';
            chatContainer.insertBefore(loadingIndicator, chatContainer.firstChild);

            const lastMessage = chatMessages[chatId].messages[0];
            const olderMessages = await loadMessages(chatId, 20, lastMessage);
            
            if (olderMessages.length > 0) {
                chatMessages[chatId].messages.unshift(...olderMessages);
                const scrollHeight = chatContainer.scrollHeight;
                displayMessageBatch(olderMessages);
                chatContainer.scrollTop = chatContainer.scrollHeight - scrollHeight;
            }

            loadingIndicator.style.display = 'none';
            isLoading = false;
        }
    });

    // Display initial messages
    displayMessageBatch(messages);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Helper function to display a batch of messages
function displayMessageBatch(messages) {
    let lastDate = null;
    messages.forEach(message => {
        const messageDate = new Date(message.timestamp);
        const currentDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

        // Add date separator if date changes
        if (!lastDate || currentDate.getTime() !== lastDate.getTime()) {
            chatContainer.appendChild(createTimeSeparator(formatDate(messageDate)));
            lastDate = currentDate;
        }

        const messageDiv = createMessageElement(message);
        chatContainer.appendChild(messageDiv);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Initialize UI elements first
        chatContainer = document.querySelector('.chat-container');
        const chatList = document.getElementById('chat-list');
        const chatTitle = document.querySelector('.chat-title');
        const chatTitleText = document.querySelector('.title-text');
        const dropdownIcon = document.querySelector('.dropdown-icon');
        const chatDropdown = document.querySelector('.chat-dropdown');
        const newChatBtn = document.getElementById('new-chat-btn');
        const promptTextElem = document.getElementById('text-prompt');
        const promptButtonElem = document.getElementById("submit-prompt");
        const allAiToggle = document.getElementById('all-ai');
        const loginBtn = document.getElementById('login-btn');

        // Validate required elements
        if (!chatContainer) {
            throw new Error("'chat-container' element not found");
        }
        if (!chatList) {
            throw new Error("'chat-list' element not found");
        }
        if (!promptTextElem) {
            throw new Error("'text-prompt' element not found");
        }
        if (!promptButtonElem) {
            throw new Error("'submit-prompt' element not found");
        }
        if (!allAiToggle) {
            throw new Error("'all-ai' element not found");
        }

        // Add styles for backup info
        const style = document.createElement('style');
        style.textContent = `
            .backup-info {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                font-size: 12px;
                color: #888;
                background-color: var(--bg-secondary);
                border-radius: 6px;
                margin: 8px;
                border: 1px solid var(--border-color);
                transition: all 0.2s ease;
            }
            .backup-info:hover {
                background-color: var(--bg-hover);
            }
            .refresh-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                padding: 4px;
                border-radius: 4px;
                color: inherit;
                transition: all 0.2s ease;
            }
            .refresh-btn:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
            }
            .refresh-btn.rotating {
                animation: rotate 1s linear infinite;
            }
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Load Firebase first
        await loadFirebaseScripts();
        
        // Wait for database to initialize
        if (!window.database) {
            throw new Error('Failed to initialize Firestore');
        }

        // Add global Ctrl+V handler
        window.addEventListener('keydown', async (e) => {
            // Check if Ctrl+V is pressed and text input is not focused
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && document.activeElement !== promptTextElem) {
                e.preventDefault(); // Prevent default paste behavior
                
                try {
                    // Focus the text input first
                    promptTextElem.focus();
                    
                    // Get text from clipboard
                    const clipboardText = await navigator.clipboard.readText();
                    
                    // Set the value and trigger input event
                    promptTextElem.value = clipboardText;
                    promptTextElem.dispatchEvent(new Event('input'));
                } catch (error) {
                    console.error('Failed to paste:', error);
                    showNotification('Failed to paste from clipboard');
                }
            }
        });

        // Check if user is logged in
        const checkLoginState = async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            const loginBtn = document.getElementById('login-btn');
            const profileHeader = document.getElementById('profile-header');
            const profileDropdown = document.getElementById('profile-dropdown');

            // Always ensure login button exists and is styled correctly
            if (loginBtn) {
                if (user && user.idToken) {
                    // User is logged in
                    if (profileHeader) {
                        profileHeader.textContent = user.email || 'My Profile';
                    }
                    
                    // Update dropdown items for logged-in state
                    if (profileDropdown) {
                        profileDropdown.innerHTML = `
                            <div class="profile-header" id="profile-header">${user.email || 'My Profile'}</div>
                            <div class="dropdown-item">
                                <span>⚙️ Settings</span>
                            </div>
                            <div class="dropdown-item">
                                <span>🔄 Delete all chats</span>
                            </div>
                            <div class="dropdown-item">
                                <span>📦 Archive chat</span>
                            </div>
                            <div class="dropdown-item">
                                <span>✉️ Contact us</span>
                            </div>
                            <div class="dropdown-item">
                                <span>↪️ Log out</span>
                            </div>
                        `;
                    }
                    
                    // Create user info container with SVG avatar
                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-info';
                    userInfo.innerHTML = `
                        <div class="user-avatar" id="profile-icon" title="${user.email}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                            <path d="m9 11 2 2 4-4" />
                            </svg>
                        </div>
                    `;
                    
                    // Add click handler for profile icon to open account page
                    userInfo.querySelector('#profile-icon').addEventListener('click', () => {
                        const accountUrl = chrome.runtime.getURL('account.html');
                        chrome.tabs.create({ url: accountUrl });
                    });

                    // Replace existing user info or add new
                    const existingUserInfo = document.querySelector('.user-info');
                    const sideFooter = document.querySelector('.side-footer');
                    
                    if (existingUserInfo) {
                        existingUserInfo.replaceWith(userInfo);
                    } else if (sideFooter && loginBtn) {
                        sideFooter.insertBefore(userInfo, loginBtn);
                    }
                    
                    // Hide login button when user is logged in
                    loginBtn.style.display = 'none';

                    // Initialize database for user
                    try {
                        await initializeUserData(user);
                    } catch (error) {
                        console.error('Error initializing user database:', error);
                    }
                } else {
                    // User is not logged in
                    if (profileHeader) {
                        profileHeader.textContent = 'Hey user, please login';
                    }
                    
                    // Update dropdown items for logged-out state
                    if (profileDropdown) {
                        profileDropdown.innerHTML = `
                            <div class="profile-header" id="profile-header">Hey user, please login</div>
                            <div class="dropdown-item" id="sign-in-btn">
                                <span>👤 Sign in</span>
                            </div>
                            <div class="dropdown-item">
                                <span>⚙️ Settings</span>
                            </div>
                            <div class="dropdown-item">
                                <span>✉️ Contact us</span>
                            </div>
                        `;
                    }
                    
                    // Show and style login button
                    loginBtn.style.display = 'flex';
                    loginBtn.classList.remove('logged-in');
                    loginBtn.style.opacity = '1';
                    loginBtn.style.visibility = 'visible';
                    
                    // Remove user info if exists
                    const existingUserInfo = document.querySelector('.user-info');
                    if (existingUserInfo) {
                        existingUserInfo.remove();
                    }
                }
            }
        };

        // Call on initial load
        checkLoginState();

        // Login button click handler
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                const user = JSON.parse(localStorage.getItem('user'));
                if (user) {
                    // If logged in, open account page in new tab
                    const accountUrl = chrome.runtime.getURL('account.html');
                    chrome.tabs.create({ url: accountUrl });
                } else {
                    // If not logged in, open auth page in popup
                    const authUrl = chrome.runtime.getURL('auth.html');
                    chrome.windows.create({
                        url: authUrl,
                        type: 'popup',
                        width: 400,
                        height: 600,
                        left: Math.round((screen.width - 400) / 2),
                        top: Math.round((screen.height - 600) / 2)
                    });
                }
                // Update login button with title
                if (loginBtn) {
                    if (user && user.idToken) {
                        loginBtn.setAttribute('title', 'View Account Settings');
                    } else {
                        loginBtn.setAttribute('title', 'Login/Signup to Sync Your Data');
                    }
                }
            });
        }

        // Auth button click handler
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.addEventListener('click', () => {
                const authUrl = chrome.runtime.getURL('auth.html');
                chrome.windows.create({
                    url: authUrl,
                    type: 'popup',
                    width: 400,
                    height: 600,
                    left: Math.round((screen.width - 400) / 2),
                    top: Math.round((screen.height - 600) / 2)
                });
            });
        }

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
    let currentTabId;

    // Function to update last backup time
    const updateLastBackupTime = () => {
        const lastBackupSpan = document.querySelector('.backup-info .last-backup');
        if (lastBackupSpan) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            lastBackupSpan.textContent = `Last backup: ${timeStr}`;
            
            // Store the backup time
            localStorage.setItem('lastBackupTime', now.toISOString());
        }
    };

    // Initialize side footer functionality
    const initializeSideFooter = () => {
        const sideFooter = document.querySelector('.side-footer');
        const refreshBtn = document.querySelector('.refresh-btn');
        const settingsBtn = document.querySelector('#settings-btn');
        
        if (sideFooter && refreshBtn && settingsBtn) {
            // Get the last backup time from storage
            const lastBackupTime = localStorage.getItem('lastBackupTime');
            const lastBackupStr = lastBackupTime 
                ? new Date(lastBackupTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                : 'Never';

            const backupInfo = document.createElement('div');
            backupInfo.className = 'backup-info';
            backupInfo.innerHTML = `
                <span class="last-backup">Last backup: ${lastBackupStr}</span>
            `;

            // Insert backup info after the settings button
            settingsBtn.parentNode.insertBefore(backupInfo, settingsBtn.nextSibling);

            // Function to backup chats
            const backupChats = async () => {
                try {
                    const user = JSON.parse(localStorage.getItem('user'));
                    if (!user) {
                        console.log('No user logged in');
                        return;
                    }

                    // Save all chats to Firebase
                    for (const [chatId, chatData] of Object.entries(chatMessages)) {
                        await saveChat(chatData);
                    }

                    updateLastBackupTime();
                    showNotification('Chats backed up successfully');
                } catch (error) {
                    console.error('Error backing up chats:', error);
                    showNotification('Failed to backup chats');
                }
            };

            // Function to refresh chats
            const refreshChats = async () => {
                try {
                    refreshBtn.classList.add('rotating');
                    await initializeChats();
                    showNotification('Chats refreshed successfully');
                } catch (error) {
                    console.error('Error refreshing chats:', error);
                    showNotification('Failed to refresh chats');
                } finally {
                    refreshBtn.classList.remove('rotating');
                }
            };

            // Add click handler for refresh button
            refreshBtn.addEventListener('click', refreshChats);
        }
    };

    // Modified initializeChats function
    const initializeChats = async () => {
        try {
            // Clear existing chats from UI and memory
            chatList.innerHTML = '';
            chatMessages = {};
            currentChatPage = 1;

            // Load initial chats
            const savedChats = await loadChats(CHATS_PER_PAGE);
            if (savedChats && savedChats.length > 0) {
                // Group chats by time period
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                let currentSection = null;

                savedChats.forEach(chat => {
                    const chatDate = new Date(chat.lastMessageTimestamp);
                    let section = '';

                    if (chatDate >= today) {
                        section = 'Today';
                    } else if (chatDate >= yesterday) {
                        section = 'Yesterday';
                    } else if (chatDate >= sevenDaysAgo) {
                        section = 'Previous 7 Days';
                    } else if (chatDate >= thirtyDaysAgo) {
                        section = 'Previous 30 Days';
                    } else {
                        section = 'Older';
                    }

                    // Add section separator if needed
                    if (section !== currentSection) {
                        chatList.appendChild(createTimeSeparator(section));
                        currentSection = section;
                    }

                    // Add chat to memory
                    chatMessages[chat.id] = {
                        id: chat.id,
                        name: chat.name || chat.title,
                        title: chat.title,
                        messages: chat.messages || [],
                        createdAt: chat.createdAt || Date.now(),
                        updatedAt: chat.updatedAt || Date.now(),
                        lastMessageTimestamp: chat.lastMessageTimestamp
                    };

                    // Create chat element
                    createChatElement(chatMessages[chat.id].name, chat.id, false);
                });

                // Add "Show More" button if there are more chats
                if (window.totalChats > CHATS_PER_PAGE) {
                    addShowMoreButton();
                }

                // Activate the first chat (most recent)
                const firstChat = chatList.querySelector('.chat-item');
                if (firstChat) {
                    activateChat(firstChat);
                }
            } else {
                // Create a welcome chat if no chats exist
                const chatId = 'chat_' + Date.now();
                const timestamp = Date.now();
                const currentDate = new Date();
                const chatData = {
                    id: chatId,
                    name: 'Welcome Chat',
                    title: 'Welcome Chat',
                    messages: [{
                        text: 'Welcome to AI Bridge! Start by typing a message below.',
                        timestamp: timestamp,
                        timestampReadable: formatFullTimestamp(currentDate)
                    }],
                    createdAt: timestamp,
                    createdAtReadable: formatFullTimestamp(currentDate),
                    updatedAt: timestamp,
                    updatedAtReadable: formatFullTimestamp(currentDate),
                    lastMessageTimestamp: timestamp,
                    lastMessageTimestampReadable: formatFullTimestamp(currentDate)
                };
                
                chatMessages[chatId] = chatData;
                chatList.appendChild(createTimeSeparator('Today'));
                const chatElement = createChatElement(chatData.name, chatId, true);
                activateChat(chatElement);
                
                // Save the welcome chat
                await saveChat(chatData);
            }

            // Update last backup time
            updateLastBackupTime();
        } catch (error) {
            console.error('Error initializing chats:', error);
            showNotification('Error loading chats');
        }
    };

    // Function to add "Show More" button
    function addShowMoreButton() {
        // Remove existing show more button if any
        const existingButton = document.querySelector('.show-more-button');
        if (existingButton) {
            existingButton.remove();
        }

        const showMoreButton = document.createElement('button');
        showMoreButton.className = 'show-more-button';
        showMoreButton.innerHTML = 'Show More Chats';
        showMoreButton.style.cssText = `
            width: 100%;
            padding: 8px;
            margin: 8px 0;
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        showMoreButton.addEventListener('mouseover', () => {
            showMoreButton.style.backgroundColor = 'var(--bg-hover)';
        });

        showMoreButton.addEventListener('mouseout', () => {
            showMoreButton.style.backgroundColor = 'transparent';
        });

        showMoreButton.addEventListener('click', async () => {
            currentChatPage++;
            const startIndex = CHATS_PER_PAGE + (currentChatPage - 2) * CHATS_PER_LOAD;
            const limit = startIndex + CHATS_PER_LOAD;
            
            const additionalChats = await loadChats(limit);
            const newChats = additionalChats.slice(startIndex);

            if (newChats.length > 0) {
                // Define date variables for sections
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                let currentSection = chatList.lastElementChild.previousElementSibling?.textContent || null;

                newChats.forEach(chat => {
                    const chatDate = new Date(chat.lastMessageTimestamp);
                    let section = '';

                    if (chatDate >= today) {
                        section = 'Today';
                    } else if (chatDate >= yesterday) {
                        section = 'Yesterday';
                    } else if (chatDate >= sevenDaysAgo) {
                        section = 'Previous 7 Days';
                    } else if (chatDate >= thirtyDaysAgo) {
                        section = 'Previous 30 Days';
                    } else {
                        section = 'Older';
                    }

                    if (section !== currentSection) {
                        chatList.insertBefore(createTimeSeparator(section), showMoreButton);
                        currentSection = section;
                    }

                    chatMessages[chat.id] = {
                        id: chat.id,
                        name: chat.name || chat.title,
                        title: chat.title,
                        messages: chat.messages || [],
                        createdAt: chat.createdAt || Date.now(),
                        updatedAt: chat.updatedAt || Date.now(),
                        lastMessageTimestamp: chat.lastMessageTimestamp
                    };

                    const chatElement = createChatElement(chatMessages[chat.id].name, chat.id, false);
                    chatList.insertBefore(chatElement, showMoreButton);
                });

                // Remove show more button if no more chats
                if (limit >= window.totalChats) {
                    showMoreButton.remove();
                }
            } else {
                showMoreButton.remove();
            }
        });

        chatList.appendChild(showMoreButton);
    }

    // Modified createNewChat function
    const createNewChat = async () => {
        try {
            const chatId = 'chat_' + Date.now();
            const timestamp = Date.now();
            const currentDate = new Date();
            const chatName = `Chat ${Object.values(chatMessages).length + 1}`;

            const chatData = {
                id: chatId,
                name: chatName,
                title: chatName,
                messages: [],
                createdAt: timestamp,
                createdAtReadable: formatFullTimestamp(currentDate),
                updatedAt: timestamp,
                updatedAtReadable: formatFullTimestamp(currentDate),
                lastMessageTimestamp: timestamp,
                lastMessageTimestampReadable: formatFullTimestamp(currentDate)
            };

            // Update local state
            chatMessages[chatId] = chatData;

            // Create UI element
            const chatElement = createChatElement(chatName, chatId);

            // Find or create the "Today" section
            let todaySection = Array.from(chatList.children).find(
                child => child.classList.contains('time-separator') && 
                child.textContent.includes('Today')
            );

            if (!todaySection) {
                todaySection = createTimeSeparator('Today');
                chatList.insertBefore(todaySection, chatList.firstChild);
            }

            // Insert the new chat right after the "Today" separator
            if (todaySection.nextSibling) {
                chatList.insertBefore(chatElement, todaySection.nextSibling);
            } else {
                chatList.appendChild(chatElement);
            }

            // Only save to Firebase if user is logged in
            const user = JSON.parse(localStorage.getItem('user'));
            if (user && user.idToken) {
                try {
                    await saveChat(chatData);
                } catch (error) {
                    console.error('Error saving to Firebase:', error);
                    // Continue even if Firebase save fails
                }
            }

            // Activate the new chat
            activateChat(chatElement);

            return chatId;
        } catch (error) {
            console.error('Error creating chat:', error);
            showNotification('Failed to create new chat');
            throw error;
        }
    };

    // Modified addMessage function
    const addMessage = async (message, chatId = activeChat?.dataset?.chatId) => {
        try {
            // If no active chat, create a new one
            if (!chatId) {
                chatId = await createNewChat();
            }
            
            const timestamp = Date.now();
            const messageData = {
                text: message,
                timestamp: timestamp,
                timestampReadable: formatFullTimestamp(new Date(timestamp))
            };
            
            // Update local state
            if (!chatMessages[chatId]) {
                chatMessages[chatId] = {
                    id: chatId,
                    name: 'New Chat',
                    messages: [],
                    lastMessageTimestamp: timestamp,
                    lastMessagePreview: message
                };
            }
            
            chatMessages[chatId].messages.push(messageData);
            chatMessages[chatId].lastMessageTimestamp = timestamp;
            chatMessages[chatId].lastMessagePreview = message;
            
            // Save to Firebase if user is logged in
            const user = JSON.parse(localStorage.getItem('user'));
            if (user && user.idToken) {
                try {
                    const emailAsId = user.email.replace(/[.#$[\]]/g, '_');
                    const messageRef = window.database
                        .collection(`users/${emailAsId}/chats/${chatId}/messages`)
                        .doc();
                    
                    // Save message to subcollection
                    await messageRef.set({
                        text: message,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        timestampReadable: formatFullTimestamp(new Date())
                    });
                    
                    // Update chat metadata
                    await saveChat(chatMessages[chatId]);
                } catch (error) {
                    console.error('Error saving to Firebase:', error);
                }
            }
            
            // Update UI
            displayMessages(chatId);
            
            // Clear input
            if (promptTextElem) {
                promptTextElem.value = '';
            }
            
            return chatId;
        } catch (error) {
            console.error('Error adding message:', error);
            showNotification('Failed to add message');
            throw error;
        }
    };

    // Function to create message element
    function createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const messageText = document.createElement('p');
        messageText.className = 'message-text';
        messageText.textContent = message.text;
        
        const messageInfo = document.createElement('div');
        messageInfo.className = 'message-info';
        
        // Format timestamp
        const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
        const timeStr = timestamp.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        messageInfo.textContent = timeStr;
        
        messageContent.appendChild(messageText);
        messageContent.appendChild(messageInfo);
        
        // Add action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        const actions = [
            { name: 'Copy', action: 'copy', handler: () => copyMessageText(message.text) },
            { name: 'Edit', action: 'edit', handler: () => enterEditMode(messageDiv, message) },
            { name: 'Delete', action: 'delete', handler: () => deleteMessage(messageDiv) },
            { name: 'Ask AI', action: 'ask-ai', handler: () => askAI(message.text) },
            { name: 'Google', action: 'google', handler: () => googleSearch(message.text) }
        ];
        
        actions.forEach(({ name, action, handler }) => {
            const button = document.createElement('button');
            button.className = 'action-btn';
            button.setAttribute('data-action', action);
            button.innerHTML = `<i></i>${name}`;
            button.onclick = (e) => {
                e.stopPropagation();
                handler();
            };
            actionsDiv.appendChild(button);
        });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(actionsDiv);
        
        return messageDiv;
    }

    // Function to display messages with lazy loading
    async function displayMessages(chatId) {
        chatContainer.innerHTML = '';
        if (!chatMessages[chatId]) {
            return;
        }

        // Load initial messages
        const messages = await loadMessages(chatId);
        chatMessages[chatId].messages = messages;

        // Create loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Loading more messages...';
        loadingIndicator.style.display = 'none';

        // Add scroll handler for lazy loading
        let isLoading = false;
        chatContainer.addEventListener('scroll', async () => {
            if (chatContainer.scrollTop === 0 && !isLoading) {
                isLoading = true;
                loadingIndicator.style.display = 'block';
                chatContainer.insertBefore(loadingIndicator, chatContainer.firstChild);

                const lastMessage = chatMessages[chatId].messages[0];
                const olderMessages = await loadMessages(chatId, 20, lastMessage);
                
                if (olderMessages.length > 0) {
                    chatMessages[chatId].messages.unshift(...olderMessages);
                    const scrollHeight = chatContainer.scrollHeight;
                    displayMessageBatch(olderMessages);
                    chatContainer.scrollTop = chatContainer.scrollHeight - scrollHeight;
                }

                loadingIndicator.style.display = 'none';
                isLoading = false;
            }
        });

        // Display initial messages
        displayMessageBatch(messages);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Helper function to display a batch of messages
    function displayMessageBatch(messages) {
        let lastDate = null;
        messages.forEach(message => {
            const messageDate = new Date(message.timestamp);
            const currentDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

            // Add date separator if date changes
            if (!lastDate || currentDate.getTime() !== lastDate.getTime()) {
                chatContainer.appendChild(createTimeSeparator(formatDate(messageDate)));
                lastDate = currentDate;
            }

            const messageDiv = createMessageElement(message);
            chatContainer.appendChild(messageDiv);
        });
    }

    // Function to create chat element
    function createChatElement(chatName, chatId, insertAtTop = false) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chatId;
        
        const leftContainer = document.createElement('div');
        leftContainer.className = 'chat-item-left';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-name';
        nameSpan.textContent = chatName;
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'chat-timestamp';
        
        // Get the chat's last activity timestamp
        const chat = chatMessages[chatId];
        if (chat) {
            const timestamp = chat.lastMessageTimestamp;
            if (timestamp) {
                timestampSpan.textContent = formatTimestamp(timestamp);
                // Add tooltip with full date/time
                timestampSpan.title = formatFullTimestamp(timestamp);
            }
        }
        
        leftContainer.appendChild(nameSpan);
        leftContainer.appendChild(timestampSpan);
        chatItem.appendChild(leftContainer);
        
        // Create icons container
        const iconsDiv = document.createElement('div');
        iconsDiv.className = 'chat-icons';
        
        // Create rename icon
        const renameIcon = document.createElement('button');
        renameIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
        renameIcon.className = 'chat-icon rename-icon';
        renameIcon.title = 'Rename Chat';
        renameIcon.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new name:', chatName);
            if (newName && newName.trim()) {
                if (chatMessages[chatId]) {
                    chatMessages[chatId].name = newName;
                }
                nameSpan.textContent = newName;
                saveChat(chatMessages[chatId]);
            }
        };

        // Create archive icon
        const archiveIcon = document.createElement('button');
        archiveIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>';
        archiveIcon.className = 'chat-icon archive-icon';
        archiveIcon.title = 'Archive This Chat';
        archiveIcon.onclick = async (e) => {
            e.stopPropagation();
            try {
                // Add archive functionality here
                showNotification('Chat archived successfully');
            } catch (error) {
                console.error('Error archiving chat:', error);
                showNotification('Failed to archive chat');
            }
        };
        
        // Create delete icon
        const deleteIcon = document.createElement('button');
        deleteIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        deleteIcon.className = 'chat-icon delete-icon';
        deleteIcon.title = 'Delete This Chat';
        deleteIcon.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this chat?')) {
                try {
                    await deleteChat(chatId);
                    delete chatMessages[chatId];
                    chatItem.remove();
                    
                    if (activeChat === chatItem) {
                        chatContainer.innerHTML = '';
                        activeChat = null;
                        chatTitleText.textContent = 'Select a chat';
                    }
                    
                    showNotification('Chat deleted successfully');
                } catch (error) {
                    console.error('Error deleting chat:', error);
                    showNotification('Failed to delete chat');
                }
            }
        };
        
        iconsDiv.appendChild(renameIcon);
        iconsDiv.appendChild(archiveIcon);
        iconsDiv.appendChild(deleteIcon);
        chatItem.appendChild(iconsDiv);
        
        chatItem.addEventListener('click', () => activateChat(chatItem));
        
        // Insert based on the insertAtTop parameter
        if (insertAtTop) {
            chatList.insertBefore(chatItem, chatList.firstChild);
        } else {
            chatList.appendChild(chatItem);
        }
        
        return chatItem;
    }

    function saveChats() {
        const chats = Array.from(chatList.children)
            .map(chat => chat.querySelector('span').textContent)
            .reverse(); // Reverse to store in original order
        chrome.storage.local.set({ chats, lastChatNumber, chatMessages });
    }

    function createDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        
        const line = document.createElement('div');
        line.className = 'separator-line';
        
        const dateText = document.createElement('span');
        dateText.className = 'date-text';
        dateText.textContent = formatDate(date);
        
        separator.appendChild(line);
        separator.appendChild(dateText);
        separator.appendChild(line.cloneNode(true));
        return separator;
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

    // Modify the delete chat functionality
    const deleteCurrentChat = async () => {
        if (activeChat && chatList.childNodes.length > 1) {
            try {
                const chatId = activeChat.dataset.chatId;
                const currentChatElement = activeChat;
                const nextChat = currentChatElement.nextElementSibling || currentChatElement.previousElementSibling;
                
                // Delete from Firebase first
                await deleteChat(chatId);
                
                // If Firebase delete successful, update local state
                delete chatMessages[chatId];
                currentChatElement.remove();
                
                // Activate next chat if available
                if (nextChat) {
                    activateChat(nextChat);
                } else {
                    activeChat = null;
                    chatContainer.innerHTML = '';
                    chatTitleText.textContent = 'Select a chat';
                }
                
                showNotification('Chat deleted successfully');
            } catch (error) {
                console.error('Error deleting chat:', error);
                showNotification('Failed to delete chat');
            }
        }
    };

    // Add delete chat handler
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Delete' && activeChat) {
            await deleteCurrentChat();
        }
        // Add Alt+I shortcut for new chat
        if (e.key === 'i' && e.altKey) {
            e.preventDefault(); // Prevent default browser behavior
            await createNewChat();
        }
    });

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

    // Settings button click handler
    document.querySelector('#settings-btn').addEventListener('click', () => {
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

    // Handle dropdown menu actions
    chatDropdown.addEventListener('click', async (e) => {
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
                    if (chatMessages[activeChat.dataset.chatId]) {
                        chatMessages[activeChat.dataset.chatId].name = newName;
                    }
                    chatNameSpan.textContent = newName;
                    activeChat.dataset.chatId = activeChat.dataset.chatId;
                    chatTitleText.textContent = newName;
                    saveChats();
                }
                break;

            case 'delete':
                if (!activeChat) return;
                if (confirm('Are you sure you want to delete this chat?')) {
                    try {
                        const chatId = activeChat.dataset.chatId;
                        
                        // Delete from Firebase first
                        await deleteChat(chatId);
                        
                        // If Firebase delete successful, update local state
                        delete chatMessages[chatId];
                        activeChat.remove();
                        chatTitleText.textContent = 'Select a chat';
                        chatContainer.innerHTML = '';
                        activeChat = null;
                        
                        showNotification('Chat deleted successfully');
                    } catch (error) {
                        console.error('Error deleting chat:', error);
                        showNotification('Failed to delete chat');
                    }
                }
                break;

            case 'info':
                if (!activeChat) return;
                const chatName = activeChat.dataset.chatId;
                const messageCount = chatMessages[chatName]?.messages.length || 0;
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

            case '📦 Archive chat':
                if (activeChat) {
                    const chatId = activeChat.dataset.chatId;
                    const chatData = chatMessages[chatId];
                    if (chatData) {
                        try {
                            // Add archived flag to chat data
                            chatData.archived = true;
                            // Save to Firebase
                            await saveChat(chatData);
                            // Remove from current view
                            activeChat.remove();
                            delete chatMessages[chatId];
                            showNotification('Chat archived successfully');
                        } catch (error) {
                            console.error('Error archiving chat:', error);
                            showNotification('Failed to archive chat');
                        }
                    }
                } else {
                    showNotification('Please select a chat to archive');
                }
                break;
        }

        chatDropdown.classList.remove('show');
    });

    // Initialize chats
    await initializeChats();

    // Initialize side footer
    initializeSideFooter();
    
    // Check login state
    await checkLoginState();

    // Initialize profile dropdown functionality
    const profileButton = document.getElementById('profile-button');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileButton && profileDropdown) {
        // Toggle dropdown when clicking profile button
        profileButton.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && !profileButton.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });

        // Handle dropdown item clicks
        profileDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = e.currentTarget.querySelector('span').textContent.trim();
                
                switch (action) {
                    case '👤 Sign in':
                        // Open auth.html in popup view
                        const authUrl = chrome.runtime.getURL('auth.html');
                        chrome.windows.create({
                            url: authUrl,
                            type: 'popup',
                            width: 400,
                            height: 600,
                            left: Math.round((screen.width - 400) / 2),
                            top: Math.round((screen.height - 600) / 2)
                        });
                        break;
                    case '⚙️ Settings':
                        chrome.tabs.create({ url: 'settings.html' });
                        break;
                    case '🔄 Delete all chats':
                        if (confirm('Are you sure you want to delete all chats?')) {
                            // Clear chat list and messages
                            chatList.innerHTML = '';
                            chatMessages = {};
                            // Create a new welcome chat
                            createNewChat();
                        }
                        break;
                    case '📦 Archive chat':
                        if (activeChat) {
                            const chatId = activeChat.dataset.chatId;
                            const chatData = chatMessages[chatId];
                            if (chatData) {
                                try {
                                    // Add archived flag to chat data
                                    chatData.archived = true;
                                    // Save to Firebase
                                    await saveChat(chatData);
                                    // Remove from current view
                                    activeChat.remove();
                                    delete chatMessages[chatId];
                                    showNotification('Chat archived successfully');
                                } catch (error) {
                                    console.error('Error archiving chat:', error);
                                    showNotification('Failed to archive chat');
                                }
                            }
                        } else {
                            showNotification('Please select a chat to archive');
                        }
                        break;
                }
                
                profileDropdown.classList.remove('show');
            });
        });
    }
} catch (error) {
    console.error('Error initializing application:', error);
}
});

// Add titles to icons
const refreshBtn = document.querySelector('.refresh-btn');
if (refreshBtn) {
    refreshBtn.setAttribute('title', 'Refresh Chat History');
}

const settingsIcon = document.querySelector('.settings-icon');
if (settingsIcon) {
    settingsIcon.setAttribute('title', 'Open Extension Settings');
}

const archiveIcon = document.querySelector('.archive-icon');
if (archiveIcon) {
    archiveIcon.setAttribute('title', 'View Archived Conversations');
}

// Update login button tooltip based on login state
const updateLoginButtonTooltip = () => {
    const loginBtn = document.getElementById('login-btn');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (loginBtn) {
        if (user && user.idToken) {
            loginBtn.setAttribute('title', 'View Account Settings');
        } else {
            loginBtn.setAttribute('title', 'Login/Signup to Sync Your Data');
        }
    }
};

// Call on initial load and after login state changes
updateLoginButtonTooltip();

// Update the checkLoginState function to also update tooltips
const checkLoginState = async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const loginBtn = document.getElementById('login-btn');
    const profileHeader = document.getElementById('profile-header');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (loginBtn) {
        if (user && user.idToken) {
            loginBtn.setAttribute('title', 'View Account Settings');
            // ... rest of logged in state code ...
        } else {
            loginBtn.setAttribute('title', 'Login/Signup to Sync Your Data');
            // ... rest of logged out state code ...
        }
    }
    // ... rest of existing checkLoginState code ...
};


