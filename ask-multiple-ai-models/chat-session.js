// Chat session management
export class ChatSession {
    constructor() {
        this.currentChatId = null;
        this.chats = new Map();
        this.setupStorageSync();
    }

    // Set up storage sync and listeners
    setupStorageSync() {
        // Listen for changes in sync storage
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                this.handleStorageChanges(changes);
            }
        });
    }

    // Handle storage changes from other instances
    async handleStorageChanges(changes) {
        let hasUpdates = false;
        
        // Handle chat metadata changes
        if (changes.chatMetadata) {
            const metadata = changes.chatMetadata.newValue;
            if (metadata) {
                this.currentChatId = metadata.currentChatId;
                hasUpdates = true;
            }
        }

        // Handle individual chat changes
        for (const key in changes) {
            if (key.startsWith('chat_')) {
                const chatId = key.replace('chat_', '');
                const chatData = changes[key].newValue;
                if (chatData) {
                    this.chats.set(chatId, chatData);
                    hasUpdates = true;
                } else {
                    this.chats.delete(chatId);
                    hasUpdates = true;
                }
            }
        }

        // Update UI if needed
        if (hasUpdates && window.updateChatList) {
            window.updateChatList();
            window.updateChatMessages();
        }
    }

    // Save chats to sync storage
    async saveToStorage() {
        try {
            // Save metadata
            const metadata = {
                currentChatId: this.currentChatId,
                lastUpdated: new Date().toISOString()
            };
            await chrome.storage.sync.set({ chatMetadata: metadata });

            // Save each chat individually to handle Chrome's QUOTA_BYTES_PER_ITEM limit
            for (const [chatId, chat] of this.chats.entries()) {
                await chrome.storage.sync.set({ [`chat_${chatId}`]: chat });
            }

            // Backup to local storage
            const fullData = {
                currentChatId: this.currentChatId,
                chats: Array.from(this.chats.entries()),
                lastUpdated: new Date().toISOString()
            };
            await chrome.storage.local.set({ chatSessions: fullData });
        } catch (error) {
            console.error('Failed to save chat data:', error);
            // Fallback to local storage
            const data = {
                currentChatId: this.currentChatId,
                chats: Array.from(this.chats.entries()),
                lastUpdated: new Date().toISOString()
            };
            await chrome.storage.local.set({ chatSessions: data });
        }
    }

    // Load chats from storage
    async loadFromStorage() {
        try {
            // Load metadata first
            const { chatMetadata } = await chrome.storage.sync.get('chatMetadata');
            if (chatMetadata) {
                this.currentChatId = chatMetadata.currentChatId;
            }

            // Get all keys from sync storage
            const allData = await chrome.storage.sync.get(null);
            
            // Load individual chats
            for (const key in allData) {
                if (key.startsWith('chat_')) {
                    const chatId = key.replace('chat_', '');
                    this.chats.set(chatId, allData[key]);
                }
            }

            // If sync storage is empty, try loading from local storage
            if (this.chats.size === 0) {
                const { chatSessions } = await chrome.storage.local.get('chatSessions');
                if (chatSessions) {
                    this.currentChatId = chatSessions.currentChatId;
                    this.chats = new Map(chatSessions.chats);
                }
            }
        } catch (error) {
            console.error('Failed to load chat data:', error);
            // Try local storage as fallback
            try {
                const { chatSessions } = await chrome.storage.local.get('chatSessions');
                if (chatSessions) {
                    this.currentChatId = chatSessions.currentChatId;
                    this.chats = new Map(chatSessions.chats);
                }
            } catch (e) {
                console.error('Failed to load from local storage:', e);
            }
        }
    }

    // Generate a unique chat ID based on date
    static generateChatId() {
        return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create a new chat session
    async createChat(title = null) {
        const chatId = ChatSession.generateChatId();
        const chat = {
            id: chatId,
            title: title || `Chat ${this.chats.size + 1}`,
            messages: [],
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        this.chats.set(chatId, chat);
        this.currentChatId = chatId;
        await this.saveToStorage();
        return chat;
    }

    // Add a message to current chat
    async addMessage(message) {
        if (!this.currentChatId) {
            await this.createChat();
        }
        
        const chat = this.chats.get(this.currentChatId);
        chat.messages.push({
            id: `msg-${Date.now()}`,
            text: message,
            timestamp: new Date().toISOString()
        });
        chat.lastModified = new Date().toISOString();
        
        await this.saveToStorage();
        return chat;
    }

    // Update message text
    async updateMessage(chatId, messageId, newText) {
        const chat = this.chats.get(chatId);
        if (chat) {
            const message = chat.messages.find(m => m.id === messageId);
            if (message) {
                message.text = newText;
                message.edited = true;
                chat.lastModified = new Date().toISOString();
                await this.saveToStorage();
                return true;
            }
        }
        return false;
    }

    // Delete a message
    async deleteMessage(chatId, messageId) {
        const chat = this.chats.get(chatId);
        if (chat) {
            const index = chat.messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                chat.messages.splice(index, 1);
                chat.lastModified = new Date().toISOString();
                await this.saveToStorage();
                return true;
            }
        }
        return false;
    }

    // Update chat title
    async updateChatTitle(chatId, newTitle) {
        const chat = this.chats.get(chatId);
        if (chat) {
            chat.title = newTitle;
            chat.lastModified = new Date().toISOString();
            await this.saveToStorage();
        }
    }

    // Switch to a specific chat
    async switchChat(chatId) {
        if (this.chats.has(chatId)) {
            this.currentChatId = chatId;
            await this.saveToStorage();
            return this.chats.get(chatId);
        }
        return null;
    }

    // Get current chat
    getCurrentChat() {
        return this.currentChatId ? this.chats.get(this.currentChatId) : null;
    }

    // Get all chats sorted by last modified
    getAllChats() {
        return Array.from(this.chats.values())
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    }

    // Check if a chat is empty (no messages)
    isChatEmpty(chatId) {
        const chat = this.chats.get(chatId);
        return !chat || chat.messages.length === 0;
    }

    // Delete a chat
    async deleteChat(chatId) {
        if (this.chats.delete(chatId)) {
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
            }
            await this.saveToStorage();
            return true;
        }
        return false;
    }
} 