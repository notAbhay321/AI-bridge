// Firebase Firestore implementation
(function(window) {
    // Initialize Firestore namespace if it doesn't exist
    window.firebase = window.firebase || {};
    
    // Token management
    async function refreshIdToken() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.idToken) return null;

            const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebase.apps[0].options.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: user.refreshToken
                })
            });

            if (!response.ok)   {
                localStorage.removeItem('user');
                return null;
            }

            const data = await response.json();
            user.idToken = data.id_token;
            user.refreshToken = data.refresh_token;
            localStorage.setItem('user', JSON.stringify(user));
            return user.idToken;
        } catch (error) {
            console.error('Error refreshing token:', error);
            localStorage.removeItem('user');
            return null;
        }
    }

    async function getValidToken() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.idToken) return null;

            // Check if token needs refresh (every 50 minutes)
            const tokenData = JSON.parse(atob(user.idToken.split('.')[1]));
            const expirationTime = tokenData.exp * 1000;
            const currentTime = Date.now();
            const timeUntilExpiry = expirationTime - currentTime;

            if (timeUntilExpiry < 600000) { // Less than 10 minutes until expiry
                return await refreshIdToken();
            }

            return user.idToken;
        } catch (error) {
            console.error('Error getting valid token:', error);
            return null;
        }
    }

    class FirestoreFieldValue {
        static serverTimestamp() {
            return {
                type: 'serverTimestamp',
                value: Date.now()
            };
        }
    }

    class FirestoreDocument {
        constructor(id, data) {
            this.id = id;
            this._data = data || {};
        }

        data() {
            return this._data;
        }

        exists() {
            return this._data !== null;
        }
    }

    class FirestoreCollection {
        constructor(path) {
            this.path = path;
            this._docs = new Map();
        }

        doc(id) {
            return new FirestoreDocumentReference(this.path + '/' + id);
        }

        async add(data) {
            const id = 'doc_' + Date.now();
            const docRef = this.doc(id);
            await docRef.set(data);
            return docRef;
        }

        async get() {
            try {
                const token = await getValidToken();
                if (!token) {
                    throw new Error('No authenticated user found');
                }

                const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-bridge-321/databases/(default)/documents/${this.path}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Try refreshing token once
                        const newToken = await refreshIdToken();
                        if (newToken) {
                            return await this.get(); // Retry with new token
                        }
                    }
                    if (response.status === 404) {
                        return { docs: [] };
                    }
                    throw new Error(`Firestore error: ${response.status}`);
                }

                const data = await response.json();
                const documents = data.documents || [];
                
                return {
                    docs: documents.map(doc => {
                        const id = doc.name.split('/').pop();
                        return new FirestoreDocument(id, this._convertFromFirestoreData(doc.fields));
                    }),
                    forEach(callback) {
                        this.docs.forEach(callback);
                    }
                };
            } catch (error) {
                console.error('Error getting collection:', error);
                throw error;
            }
        }

        _convertFromFirestoreData(fields) {
            if (!fields) return null;
            const result = {};
            for (const [key, value] of Object.entries(fields)) {
                if (value.timestampValue) {
                    result[key] = new Date(value.timestampValue).getTime();
                } else if (value.stringValue !== undefined) {
                    result[key] = value.stringValue;
                } else if (value.integerValue !== undefined) {
                    result[key] = parseInt(value.integerValue);
                } else if (value.doubleValue !== undefined) {
                    result[key] = parseFloat(value.doubleValue);
                } else if (value.booleanValue !== undefined) {
                    result[key] = value.booleanValue;
                } else if (value.nullValue !== undefined) {
                    result[key] = null;
                } else if (value.arrayValue) {
                    result[key] = (value.arrayValue.values || []).map(v => this._convertFromFirestoreData({ value: v }).value);
                } else if (value.mapValue) {
                    result[key] = this._convertFromFirestoreData(value.mapValue.fields);
                }
            }
            return result;
        }
    }

    class FirestoreDocumentReference {
        constructor(path) {
            this.path = path;
        }

        collection(collectionPath) {
            return new FirestoreCollection(this.path + '/' + collectionPath);
        }

        async delete() {
            try {
                const token = await getValidToken();
                if (!token) {
                    throw new Error('No authenticated user found');
                }

                const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-bridge-321/databases/(default)/documents/${this.path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Try refreshing token once
                        const newToken = await refreshIdToken();
                        if (newToken) {
                            return await this.delete(); // Retry with new token
                        }
                    }
                    throw new Error(`Firestore error: ${response.status}`);
                }

                return true;
            } catch (error) {
                console.error('Error deleting document:', error);
                throw error;
            }
        }

        async get() {
            try {
                const token = await getValidToken();
                if (!token) {
                    throw new Error('No authenticated user found');
                }

                const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-bridge-321/databases/(default)/documents/${this.path}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Try refreshing token once
                        const newToken = await refreshIdToken();
                        if (newToken) {
                            return await this.get(); // Retry with new token
                        }
                    }
                    if (response.status === 404) {
                        return new FirestoreDocument(this.path.split('/').pop(), null);
                    }
                    throw new Error(`Firestore error: ${response.status}`);
                }

                const data = await response.json();
                return new FirestoreDocument(this.path.split('/').pop(), data.fields);
            } catch (error) {
                console.error('Error getting document:', error);
                throw error;
            }
        }

        async set(data, options = {}) {
            try {
                const token = await getValidToken();
                if (!token) {
                    throw new Error('No authenticated user found');
                }

                const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-bridge-321/databases/(default)/documents/${this.path}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: this._convertToFirestoreData(data)
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Try refreshing token once
                        const newToken = await refreshIdToken();
                        if (newToken) {
                            return await this.set(data, options); // Retry with new token
                        }
                    }
                    throw new Error(`Firestore error: ${response.status}`);
                }

                return true;
            } catch (error) {
                console.error('Error setting document:', error);
                throw error;
            }
        }

        _convertToFirestoreData(data) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                if (value && value.type === 'serverTimestamp') {
                    result[key] = {
                        timestampValue: new Date(value.value).toISOString()
                    };
                } else if (typeof value === 'string') {
                    result[key] = {
                        stringValue: value
                    };
                } else if (typeof value === 'number') {
                    result[key] = {
                        integerValue: value
                    };
                } else if (typeof value === 'boolean') {
                    result[key] = {
                        booleanValue: value
                    };
                } else if (value === null) {
                    result[key] = {
                        nullValue: null
                    };
                } else if (Array.isArray(value)) {
                    result[key] = {
                        arrayValue: {
                            values: value.map(v => this._convertToFirestoreData({ value: v }).value)
                        }
                    };
                } else if (typeof value === 'object') {
                    result[key] = {
                        mapValue: {
                            fields: this._convertToFirestoreData(value)
                        }
                    };
                }
            }
            return result;
        }
    }

    // Add Firestore to Firebase namespace
    window.firebase.firestore = function() {
        if (!window.firebase._firestoreInstance) {
            window.firebase._firestoreInstance = {
                collection: (path) => new FirestoreCollection(path),
                doc: (path) => new FirestoreDocumentReference(path),
                FieldValue: FirestoreFieldValue
            };
        }
        return window.firebase._firestoreInstance;
    };

    // Add Firestore types to Firebase namespace
    window.firebase.firestore.FieldValue = FirestoreFieldValue;
    window.firebase.firestore.collection = (path) => new FirestoreCollection(path);
    window.firebase.firestore.doc = (path) => new FirestoreDocumentReference(path);

    // Export Firestore functions
    window.firebase.firestore.export = {
        collection: window.firebase.firestore.collection,
        doc: window.firebase.firestore.doc,
        getDoc: window.firebase.firestore.getDoc,
        setDoc: window.firebase.firestore.setDoc,
        updateDoc: window.firebase.firestore.updateDoc,
        deleteDoc: window.firebase.firestore.deleteDoc,
        serverTimestamp: window.firebase.firestore.serverTimestamp
    };
})(window); 