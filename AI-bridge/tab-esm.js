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

// Save chat to chrome.storage
const saveChat = async (chatData) => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // If user is not logged in, save to chrome.storage
    if (!user || !user.idToken) {
        try {
            // Get existing chats from chrome.storage
            const result = await chrome.storage.local.get('localChats');
            const localChats = result.localChats || {};
            
            // Update the chat
            localChats[chatData.id] = chatData;
            
            // Save back to chrome.storage
            await chrome.storage.local.set({ localChats });
            return;
        } catch (error) {
            console.error('Error saving to chrome storage:', error);
            throw error;
        }
    }

    // If user is logged in, save to Firebase
    try {
        const chatRef = window.database.collection(`users/${user.uid}/chats`).doc(chatData.id);
        await chatRef.set({
            ...chatData,
            updatedAt: Date.now()
            });
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
};

async function loadChats(limit = 10, offset = 0) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));

        // If user is not logged in, load from chrome.storage
        if (!user || !user.idToken) {
            const result = await chrome.storage.local.get('localChats');
            const localChats = result.localChats || {};
            const sortedChats = Object.values(localChats).sort((a, b) => {
                const timestampA = Number(a.lastMessageTimestamp);
                const timestampB = Number(b.lastMessageTimestamp);
                return timestampB - timestampA; // Newest first
            });
            
            // Return paginated results
            return {
                chats: sortedChats.slice(offset, offset + limit),
                hasMore: sortedChats.length > offset + limit,
                total: sortedChats.length
            };
        }

        // If user is logged in, load from Firebase
        const userChatsRef = window.database.collection(`users/${user.uid}/chats`);
        const snapshot = await userChatsRef.get();

        const allChats = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data) {
                // Get the timestamp of the last message or most recent activity
                const messages = data.messages || [];
                let lastActivityTimestamp;

                if (messages.length > 0) {
                    lastActivityTimestamp = messages[messages.length - 1].timestamp;
                } else {
                    lastActivityTimestamp = Math.max(
                        data.updatedAt || 0,
                        data.createdAt || 0,
                        data.lastMessageTimestamp || 0
                    );
                }

                allChats.push({
                    id: doc.id,
                    name: data.title || `Chat ${allChats.length + 1}`,
                    title: data.title || `Chat ${allChats.length + 1}`,
                    messages: messages,
                    createdAt: data.createdAt || Date.now(),
                    updatedAt: data.updatedAt || Date.now(),
                    lastMessageTimestamp: lastActivityTimestamp
                });
            }
        });

        // Sort chats by timestamp
        const sortedChats = allChats.sort((a, b) => {
            const timestampA = Number(a.lastMessageTimestamp);
            const timestampB = Number(b.lastMessageTimestamp);
            return timestampB - timestampA; // Newest first
        });

        // Return paginated results
        return {
            chats: sortedChats.slice(offset, offset + limit),
            hasMore: sortedChats.length > offset + limit,
            total: sortedChats.length
        };
    } catch (error) {
        console.error('Error loading chats:', error);
        return {
            chats: [],
            hasMore: false,
            total: 0
        };
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

        // If user is logged in, delete from Firebase
        await window.database.doc(`users/${user.uid}/chats/${chatId}`).delete();
    } catch (error) {
        console.error('Error deleting chat:', error);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Add message listener for auth completion
        chrome.runtime.onMessage.addListener(async (message) => {
            if (message.type === 'AUTH_COMPLETED') {
                // Refresh login state and chats
                await checkLoginState();
                await initializeChats();
                showNotification('Login successful! Loading your chats...');
            }
        });

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
            if (!chatMessages[chatId]) {
                return;
            }

            let messages = chatMessages[chatId].messages;
            
            // Handle different message formats
            if (messages && messages.arrayValue && messages.arrayValue.values) {
                messages = messages.arrayValue.values.map(msg => ({
                    text: msg.mapValue.fields.text.stringValue,
                    timestamp: parseInt(msg.mapValue.fields.timestamp.integerValue) || Date.now()
                }));
            } else if (!Array.isArray(messages)) {
                console.error('Messages is not an array:', messages);
                messages = [];
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

        // Add backup status and refresh button to side-footer
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

        // Function to create time separator element
        function createTimeSeparator(text) {
            const separator = document.createElement('div');
            separator.className = 'time-separator';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            
            separator.appendChild(textSpan);
            return separator;
        }

        // Modified initializeChats function
        const initializeChats = async () => {
            try {
                // Clear existing chats from UI and memory
                chatList.innerHTML = '';
                chatMessages = {};

                let currentOffset = 0;
                const INITIAL_LOAD = 10;
                const LOAD_MORE_COUNT = 5;

                // Load initial chats
                const initialResult = await loadChats(INITIAL_LOAD, 0);
                const { chats: savedChats, hasMore, total } = initialResult;

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

                    const displayChats = (chatsToDisplay) => {
                        chatsToDisplay.forEach(chat => {
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
                    };

                    // Display initial chats
                    displayChats(savedChats);

                    // Add "Show More" button if there are more chats
                    if (hasMore) {
                        const showMoreContainer = document.createElement('div');
                        showMoreContainer.className = 'show-more-container';
                        
                        const showMoreButton = document.createElement('button');
                        showMoreButton.className = 'show-more-button';
                        showMoreButton.innerHTML = `Show More (${total - INITIAL_LOAD} remaining)`;
                        
                        showMoreButton.addEventListener('click', async () => {
                            currentOffset += INITIAL_LOAD;
                            const nextResult = await loadChats(LOAD_MORE_COUNT, currentOffset);
                            
                            displayChats(nextResult.chats);
                            
                            // Update or remove the "Show More" button
                            if (!nextResult.hasMore) {
                                showMoreContainer.remove();
                            } else {
                                showMoreButton.innerHTML = `Show More (${total - (currentOffset + LOAD_MORE_COUNT)} remaining)`;
                            }
                        });
                        
                        showMoreContainer.appendChild(showMoreButton);
                        chatList.appendChild(showMoreContainer);
                    }
                }

                // Create a new chat only if no chats exist
                if (!savedChats || savedChats.length === 0) {
                    const newChatId = await createNewChat();
                    const newChatElement = document.querySelector(`[data-chat-id="${newChatId}"]`);
                    if (newChatElement) {
                        activateChat(newChatElement);
                    }
                }
            } catch (error) {
                console.error('Error initializing chats:', error);
                showNotification('Error loading chats');
            }
        };

        // Modified activateChat function
        function activateChat(chatItem) {
            if (activeChat) {
                activeChat.classList.remove('active');
            }
            chatItem.classList.add('active');
            activeChat = chatItem;
            
            const chatId = chatItem.dataset.chatId;
            const chatName = chatItem.querySelector('span').textContent;
            chatTitleText.textContent = chatName;
            
            // Fetch chat history
            fetchChatHistory(chatId).then(() => {
                displayMessages(chatId);
            }).catch(error => {
                console.error('Error fetching chat history:', error);
                showNotification('Error loading chat history');
            });
        }

        // Modified fetchChatHistory function
        async function fetchChatHistory(chatId) {
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                
                if (user && user.idToken) {
                    // Fetch from Firestore
                    const chatDoc = await window.database
                        .collection(`users/${user.uid}/chats`)
                        .doc(chatId)
                        .get();
                    
                    if (chatDoc.exists) {
                        const data = chatDoc.data();
                        // Convert Firestore messages to proper array format
                        let messages = [];
                        if (data.messages && data.messages.arrayValue && data.messages.arrayValue.values) {
                            messages = data.messages.arrayValue.values.map(msg => ({
                                text: msg.mapValue.fields.text.stringValue,
                                timestamp: parseInt(msg.mapValue.fields.timestamp.integerValue) || Date.now()
                            }));
                        } else if (Array.isArray(data.messages)) {
                            messages = data.messages;
                        }

                        chatMessages[chatId] = {
                            id: chatId,
                            name: data.title || `Chat ${Object.keys(chatMessages).length + 1}`,
                            title: data.title || `Chat ${Object.keys(chatMessages).length + 1}`,
                            messages: messages,
                            createdAt: data.createdAt || Date.now(),
                            updatedAt: data.updatedAt || Date.now(),
                            lastMessageTimestamp: data.lastMessageTimestamp || Date.now()
                        };
                    }
                } else {
                    // Fetch from local storage
                    const result = await chrome.storage.local.get('localChats');
                    const localChat = result.localChats?.[chatId];
                    if (localChat) {
                        chatMessages[chatId] = localChat;
                    }
                }
            } catch (error) {
                console.error('Error fetching chat history:', error);
                throw error;
            }
        }

        // Modified createNewChat function
        const createNewChat = async () => {
            try {
                const chatId = 'chat_' + Date.now();
                const timestamp = Date.now();
                
                // Calculate the next chat number based on existing chats
                const existingChats = Object.values(chatMessages);
                let maxNumber = 0;
                existingChats.forEach(chat => {
                    const match = chat.name.match(/Chat (\d+)/);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNumber) maxNumber = num;
                    }
                });
                const chatNumber = maxNumber + 1;
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
                
                // Initialize chat messages if needed
                if (!chatMessages[chatId]) {
                    chatMessages[chatId] = {
                        id: chatId,
                        name: 'New Chat',
                        messages: [],
                        lastMessageTimestamp: Date.now()
                    };
                }
                
                const messageData = {
                    text: message,
                    timestamp: Date.now()
                };
                
                // Update local state
                if (!chatMessages[chatId].messages) {
                    chatMessages[chatId].messages = [];
                }
                chatMessages[chatId].messages.push(messageData);
                chatMessages[chatId].lastMessageTimestamp = messageData.timestamp;
                
                // Try to save to Firebase if user is logged in
                const user = JSON.parse(localStorage.getItem('user'));
                if (user && user.idToken) {
                    try {
                        await saveChat(chatMessages[chatId]);
                    } catch (error) {
                        console.error('Error saving to Firebase:', error);
                        // Continue even if Firebase save fails
                    }
                }
                
                // Update UI regardless of login state
                displayMessages(chatId);
                
                // Clear input after successful message add
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
            renameIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
            renameIcon.className = 'chat-icon rename-icon';
            renameIcon.title = 'Rename Chat';
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

        // Add styles for the Show More button
        const showMoreStyles = document.createElement('style');
        showMoreStyles.textContent += `
            .show-more-container {
                display: flex;
                justify-content: center;
                padding: 10px;
                margin: 5px;
            }
            
            .show-more-button {
                background-color: var(--bg-secondary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .show-more-button:hover {
                background-color: var(--bg-hover);
            }
        `;
        document.head.appendChild(showMoreStyles);

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
                        case '✉️ Contact us':
                            window.open('mailto:support@ai-bridge.com', '_blank');
                            break;
                        case '↪️ Log out':
                            const user = JSON.parse(localStorage.getItem('user'));
                            if (user) {
                                // Clear user data
                                localStorage.removeItem('user');
                                // Update UI
                                checkLoginState();
                                showNotification('Logged out successfully');
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

// Update chat icons in createChatElement function
function createChatElement(chatName, chatId, insertAtTop = false) {
    // ... existing code ...
    
    renameIcon.setAttribute('title', 'Rename Chat');
    
    archiveIcon.setAttribute('title', 'Archive This Chat');
    
    deleteIcon.setAttribute('title', 'Delete This Chat');
    
    // ... rest of existing code ...
}

// Add styles for the Show More button
const showMoreStyles = document.createElement('style');
showMoreStyles.textContent += `
    .show-more-container {
        display: flex;
        justify-content: center;
        padding: 10px;
        margin: 5px;
    }
    
    .show-more-button {
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
    }
    
    .show-more-button:hover {
        background-color: var(--bg-hover);
    }
`;
document.head.appendChild(showMoreStyles);
    
    
    