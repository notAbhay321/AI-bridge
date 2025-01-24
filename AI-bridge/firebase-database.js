// Firebase Firestore implementation for Chrome Extension
class FirebaseDatabase {
    constructor() {
        this._db = null;
        this._initialized = false;
    }

    async initialize() {
        if (this._initialized) return;
        
        // Wait for Firebase to be available
        let retries = 0;
        while (!window.firebase && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
        }

        if (!window.firebase) {
            throw new Error('Firebase not initialized');
        }

        // Initialize Firestore
        this._db = firebase.firestore();
        this._initialized = true;
    }

    ref(path) {
        return new FirestoreReference(path, this._db);
    }

    // Initialize database structure for a new user
    async initializeUserData(uid) {
        try {
            await this.initialize();
            
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.idToken) {
                throw new Error('No authenticated user found');
            }

            // Check if user document exists
            const userDoc = await this._db.collection('users').doc(uid).get();

            if (!userDoc.exists) {
                // Create initial user data structure
                await this._db.collection('users').doc(uid).set({
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    lastBackup: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Update last active time
                await this._db.collection('users').doc(uid).update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            return true;
        } catch (error) {
            console.error('Error initializing user data:', error);
            if (error.message.includes('No authenticated user found')) {
                localStorage.removeItem('user');
                window.location.reload();
            }
            throw error;
        }
    }
}

class FirestoreReference {
    constructor(path, db) {
        this.path = path;
        this._db = db;
        this._parsePath();
    }

    _parsePath() {
        const parts = this.path.split('/');
        this._collection = parts[0];
        this._document = parts[1];
        this._subcollection = parts[2];
        this._subdocument = parts[3];
    }

    _getReference() {
        let ref = this._db.collection(this._collection).doc(this._document);
        if (this._subcollection) {
            ref = ref.collection(this._subcollection);
            if (this._subdocument) {
                ref = ref.doc(this._subdocument);
            }
        }
        return ref;
    }

    async set(data) {
        try {
            await firebase.database().initialize();
            const ref = this._getReference();

            // Add timestamps
            const enhancedData = {
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (!ref.get().exists) {
                enhancedData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await ref.set(enhancedData, { merge: true });

            // Update last backup time if this is a chat update
            if (this.path.includes('/chats/')) {
                const user = JSON.parse(localStorage.getItem('user'));
                await this._db.collection('users').doc(user.uid).update({
                    lastBackup: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            return true;
        } catch (error) {
            console.error('Error setting data:', error);
            if (error.message.includes('Permission denied')) {
                localStorage.removeItem('user');
                window.location.reload();
            }
            throw error;
        }
    }

    async once(eventType) {
        if (eventType !== 'value') throw new Error('Only "value" event type is supported');

        try {
            await firebase.database().initialize();
            const ref = this._getReference();
            const doc = await ref.get();

            return {
                val: () => doc.data(),
                exists: () => doc.exists
            };
        } catch (error) {
            console.error('Error fetching data:', error);
            if (error.message.includes('Permission denied')) {
                localStorage.removeItem('user');
                window.location.reload();
            }
            throw error;
        }
    }

    async remove() {
        try {
            const ref = this._getReference();
            await ref.delete();
            return true;
        } catch (error) {
            console.error('Error removing data:', error);
            if (error.message.includes('Permission denied')) {
                localStorage.removeItem('user');
                window.location.reload();
            }
            throw error;
        }
    }
}

// Initialize Firebase Database instance
window.firebase = window.firebase || {};
window.firebase.database = () => {
    if (!window.firebase._database) {
        window.firebase._database = new FirebaseDatabase();
    }
    return window.firebase._database;
}; 