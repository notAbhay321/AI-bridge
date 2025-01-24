// Logging
const _LL = (msg) => chrome.runtime.sendMessage({ log: msg })

// Global state
let chatMessages = {};
let activeChat = null;
let lastChatNumber = 0;
let currentTabId;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC5tmNdGgEugYvGRlUSM0h2ytfsKbhYDL0",
    authDomain: "ai-bridge-321.firebaseapp.com",
    projectId: "ai-bridge-321",
    storageBucket: "ai-bridge-321.firebasestorage.app",
    messagingSenderId: "367598803344",
    appId: "1:367598803344:web:46c1dac738c50d5e287b15",
    measurementId: "G-JQDL8ES2VD",
    databaseURL: "https://ai-bridge-321-default-rtdb.firebaseio.com"
};

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

async function initializeUserData(user) {
    try {
        const userDoc = await window.database.doc(`users/${user.uid}`).get();
        
        // Create initial user data if it doesn't exist
        if (!userDoc.exists()) {
            await window.database.doc(`users/${user.uid}`).set({
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                chats: []
            });

            // Create a welcome chat
            const chatId = 'chat_' + Date.now();
            await window.database.doc(`users/${user.uid}/chats/${chatId}`).set({
                title: 'Welcome Chat',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                messages: [{
                    text: 'Welcome to AI Bridge! Start by typing a message below.',
                    timestamp: Date.now()
                }]
            });
        } else {
            // Update last active timestamp
            await window.database.doc(`users/${user.uid}`).set({
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error initializing user data:', error);
        // Don't throw the error, just log it and continue
        // This allows the app to function even if initialization fails
    }
}

async function saveChat(chatData) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            throw new Error('No authenticated user found');
        }

        const timestamp = Date.now();
        const chatRef = window.database.doc(`users/${user.uid}/chats/${chatData.id}`);
        
        // Calculate the last activity timestamp
        let lastActivityTimestamp;
        if (chatData.messages && chatData.messages.length > 0) {
            // If there are messages, use the latest message timestamp
            lastActivityTimestamp = chatData.messages[chatData.messages.length - 1].timestamp;
        } else {
            // If no messages, use the most recent timestamp
            lastActivityTimestamp = Math.max(
                chatData.updatedAt || 0,
                chatData.createdAt || 0,
                chatData.lastMessageTimestamp || 0,
                timestamp
            );
        }
        
        // Update timestamps and preserve the title
        const updatedData = {
            title: chatData.name || chatData.title,
            messages: chatData.messages || [],
            createdAt: chatData.createdAt || timestamp,
            updatedAt: timestamp,
            lastMessageTimestamp: lastActivityTimestamp
        };

        await chatRef.set(updatedData);
        
        // Update local state with new timestamps
        chatMessages[chatData.id] = {
            ...chatData,
            ...updatedData,
            lastMessageTimestamp: lastActivityTimestamp
        };
    } catch (error) {
        console.error('Error saving chat:', error);
        throw error;
    }
}

async function loadChats() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            return [];
        }

        const userChatsRef = window.database.collection(`users/${user.uid}/chats`);
        const snapshot = await userChatsRef.get();
        
        const chats = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data) {
                // Get the timestamp of the last message or most recent activity
                const messages = data.messages || [];
                let lastActivityTimestamp;
                
                if (messages.length > 0) {
                    // If there are messages, use the latest message timestamp
                    lastActivityTimestamp = messages[messages.length - 1].timestamp;
                } else {
                    // If no messages, use the most recent of updatedAt/createdAt
                    lastActivityTimestamp = Math.max(
                        data.updatedAt || 0,
                        data.createdAt || 0,
                        data.lastMessageTimestamp || 0
                    );
                }

                chats.push({
                    id: doc.id,
                    name: data.title || `Chat ${chats.length + 1}`,
                    title: data.title || `Chat ${chats.length + 1}`,
                    messages: messages,
                    createdAt: data.createdAt || Date.now(),
                    updatedAt: data.updatedAt || Date.now(),
                    lastMessageTimestamp: lastActivityTimestamp
                });
            }
        });

        // Sort chats by most recent activity timestamp
        return chats.sort((a, b) => {
            const timestampA = Number(a.lastMessageTimestamp);
            const timestampB = Number(b.lastMessageTimestamp);
            return timestampB - timestampA; // Newest first
        });
    } catch (error) {
        console.error('Error loading chats:', error);
        return [];
    }
}

async function deleteChat(chatId) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            throw new Error('No authenticated user found');
        }

        await window.database.doc(`users/${user.uid}/chats/${chatId}`).delete();
    } catch (error) {
        console.error('Error deleting chat:', error);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Load Firebase first
        await loadFirebaseScripts();
        
        // Wait for database to initialize
        if (!window.database) {
            throw new Error('Failed to initialize Firestore');
        }

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
        const loginBtn = document.getElementById('login-btn');

        // Check if user is logged in
        const checkLoginState = async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user && user.idToken) {
                // Create user info container
                const userInfo = document.createElement('div');
                userInfo.className = 'user-info';
                userInfo.innerHTML = `
                    <div class="user-avatar" id="profile-icon">${user.email[0].toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-email">${user.email}</div>
                        <button class="auth-btn logged-in">View Account</button>
                    </div>
                `;
                
                // Add click handler for profile icon
                userInfo.querySelector('#profile-icon').addEventListener('click', () => {
                    const accountUrl = chrome.runtime.getURL('account.html');
                    chrome.tabs.create({ url: accountUrl });
                });

                // Add click handler for View Account button
                userInfo.querySelector('.auth-btn').addEventListener('click', () => {
                    const accountUrl = chrome.runtime.getURL('account.html');
                    chrome.tabs.create({ url: accountUrl });
                });

                // Replace existing user info or add new
                const existingUserInfo = document.querySelector('.user-info');
                if (existingUserInfo) {
                    existingUserInfo.replaceWith(userInfo);
                } else {
                    document.querySelector('.nav-footer').insertBefore(userInfo, loginBtn);
                }
                
                // Hide the login button since we're showing user info
                if (loginBtn) {
                    loginBtn.style.display = 'none';
                }

                // Initialize database for user
                try {
                    await initializeUserData(user);
                } catch (error) {
                    console.error('Error initializing user database:', error);
                }
            } else {
                // Show login button if user is not logged in
                if (loginBtn) {
                    loginBtn.textContent = 'Login / Sign Up';
                    loginBtn.classList.remove('logged-in');
                    loginBtn.style.display = 'block';
                }
                // Remove user info if exists
                const existingUserInfo = document.querySelector('.user-info');
                if (existingUserInfo) {
                    existingUserInfo.remove();
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

        // Function to display messages
        function displayMessages(chatId) {
            chatContainer.innerHTML = '';
            if (!chatMessages[chatId] || !chatMessages[chatId].messages) {
                return;
            }

            const messages = chatMessages[chatId].messages;
            if (!Array.isArray(messages)) {
                console.error('Messages is not an array:', messages);
                return;
            }

            let lastDate = null;
            messages.forEach(message => {
                const messageDate = new Date(message.timestamp);
                const currentDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

                // Add date separator if date changes
                if (!lastDate || currentDate.getTime() !== lastDate.getTime()) {
                    chatContainer.appendChild(createDateSeparator(messageDate));
                    lastDate = currentDate;
                }

                const messageDiv = createMessageElement(message);
                chatContainer.appendChild(messageDiv);
            });

            // Scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // Add backup status and refresh button to nav-footer
        const navFooter = document.querySelector('.nav-footer');
        const backupInfo = document.createElement('div');
        backupInfo.className = 'backup-info';
        backupInfo.innerHTML = `
            <span class="last-backup">Last backup: Never</span>
            <button class="refresh-btn" title="Refresh chats">��</button>
        `;
        navFooter.insertBefore(backupInfo, navFooter.firstChild);

        const lastBackupSpan = backupInfo.querySelector('.last-backup');
        const refreshBtn = backupInfo.querySelector('.refresh-btn');

        // Function to update last backup time
        const updateLastBackupTime = () => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            lastBackupSpan.textContent = `Last backup: ${timeStr}`;
        };

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

        // Auto-backup chats every 5 minutes
        setInterval(backupChats, 5 * 60 * 1000);

        // Add CSS for the new elements
        const style = document.createElement('style');
        style.textContent = `
            .backup-info {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 5px 10px;
                font-size: 12px;
                color: #666;
            }
            .refresh-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                padding: 5px;
                border-radius: 50%;
                transition: transform 0.3s ease;
            }
            .refresh-btn:hover {
                background: #f0f0f0;
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

        // Function to create time separator element
        function createTimeSeparator(text) {
            const separator = document.createElement('div');
            separator.className = 'time-separator';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            
            separator.appendChild(textSpan);
            return separator;
        }

        // Modified initializeChats function with Previous 7 Days
        const initializeChats = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                if (!user) {
                    console.log('No user logged in');
                    return;
                }

                // Clear existing chats from UI and memory
                chatList.innerHTML = '';
                chatMessages = {};

                // Load saved chats
                const savedChats = await loadChats();
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

                    // Activate the first chat (most recent)
                    const firstChat = chatList.querySelector('.chat-item');
                    if (firstChat) {
                        activateChat(firstChat);
                    }
                } else {
                    // Create a welcome chat if no chats exist
                    const chatId = 'chat_' + Date.now();
                    const timestamp = Date.now();
                    const chatData = {
                        id: chatId,
                        name: 'Welcome Chat',
                        title: 'Welcome Chat',
                        messages: [{
                            text: 'Welcome to AI Bridge! Start by typing a message below.',
                            timestamp: timestamp
                        }],
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        lastMessageTimestamp: timestamp
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

        // Modified createNewChat function
        const createNewChat = async () => {
            try {
                // Generate a unique chat ID
                const chatId = 'chat_' + Date.now();
                const timestamp = Date.now();
                
                // Get the next chat number by counting existing chats
                const existingChats = Object.values(chatMessages);
                const chatNumber = existingChats.length + 1;
                const chatName = `Chat ${chatNumber}`;
                
                const chatData = {
                    id: chatId,
                    name: chatName,
                    title: chatName,
                    messages: [],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    lastMessageTimestamp: timestamp
                };
                
                // Update local state
                chatMessages[chatId] = chatData;
                
                // Create UI element and insert at the top
                const chatElement = createChatElement(chatName, chatId, true);
                
                // Save to Firebase
                await saveChat(chatData);
                
                // Clear any active chat styling
                const activeChats = document.querySelectorAll('.chat-item.active');
                activeChats.forEach(chat => chat.classList.remove('active'));
                
                // Activate the new chat immediately
                chatElement.classList.add('active');
                activeChat = chatElement;
                
                // Clear the chat container and set the title
                chatContainer.innerHTML = '';
                chatTitleText.textContent = chatName;
                
                // Focus the text input
                const textPrompt = document.getElementById('text-prompt');
                if (textPrompt) {
                    textPrompt.focus();
                }
                
                return chatId;
            } catch (error) {
                console.error('Error creating chat:', error);
                showNotification('Failed to create new chat');
                throw error;
            }
        };

        // Modified addMessage function
        const addMessage = async (message, chatId = activeChat?.dataset?.chatId) => {
            if (!chatId || !chatMessages[chatId]) return;
            
            const messageData = {
                text: message,
                timestamp: Date.now()
            };
            
            try {
                // Update local state
                if (!chatMessages[chatId].messages) {
                    chatMessages[chatId].messages = [];
                }
                chatMessages[chatId].messages.push(messageData);
                chatMessages[chatId].lastMessageTimestamp = messageData.timestamp;
                
                // Save to Firebase
                await saveChat(chatMessages[chatId]);
                
                // Update UI
                displayMessages(chatId);
                
                // Re-sort chat list
                const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
                if (chatElement && chatElement.parentNode === chatList) {
                    chatList.removeChild(chatElement);
                    chatList.insertBefore(chatElement, chatList.firstChild);
                }
            } catch (error) {
                console.error('Error adding message:', error);
                chatMessages[chatId].messages.pop();
                displayMessages(chatId);
            }
        };

        function createChatElement(chatName, chatId, insertAtTop = false) {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.dataset.chatId = chatId;
            
            // Create left container for chat name and timestamp
            const leftContainer = document.createElement('div');
            leftContainer.className = 'chat-item-left';
            
            // Create chat name span
            const nameSpan = document.createElement('span');
            nameSpan.className = 'chat-name';
            nameSpan.textContent = chatName;
            
            // Create timestamp span
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'chat-timestamp';
            
            // Get the chat's last activity timestamp
            const timestamp = chatMessages[chatId]?.lastMessageTimestamp || Date.now();
            const date = new Date(timestamp);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Format timestamp
            let timeStr;
            if (date >= today) {
                timeStr = date.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                });
            } else if (date >= yesterday) {
                timeStr = 'Yesterday';
            } else if (date >= new Date(today - 7 * 24 * 60 * 60 * 1000)) {
                timeStr = date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                timeStr = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
            timestampSpan.textContent = timeStr;
            
            leftContainer.appendChild(nameSpan);
            leftContainer.appendChild(timestampSpan);
            chatItem.appendChild(leftContainer);
            
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
                    if (chatMessages[chatId]) {
                        chatMessages[chatId].name = newName;
                        chatMessages[chatId].title = newName;
                    }
                    nameSpan.textContent = newName;
                    saveChat(chatMessages[chatId]);
                }
            };
            
            // Create delete icon
            const deleteIcon = document.createElement('button');
            deleteIcon.innerHTML = '🗑️';
            deleteIcon.className = 'chat-icon delete-icon';
            deleteIcon.title = 'Delete';
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

        function formatDate(date) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            if (date >= today) {
                return 'Today';
            } else if (date >= yesterday) {
                return 'Yesterday';
            } else if (date >= thirtyDaysAgo) {
                return 'Previous 30 Days';
            } else {
                return 'Older Messages';
            }
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
            }

            chatDropdown.classList.remove('show');
        });

            // Initialize chats
            await initializeChats();
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    });


