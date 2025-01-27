// Firebase Auth Configuration
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Function to store user data with expiration
function storeUserWithExpiration(user) {
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1); // Set expiration to 1 month from now
    
    const userData = {
        ...user,
        expirationTime: expirationDate.getTime()
    };
    
    // Store in both localStorage and chrome.storage.local for persistence
    localStorage.setItem('user', JSON.stringify(userData));
    chrome.storage.local.set({ user: userData });
}

// Function to check if stored user data is expired
function isUserExpired() {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData || !userData.expirationTime) return true;
    
    const now = new Date().getTime();
    return now > userData.expirationTime;
}

// Function to restore user session
async function restoreUserSession() {
    try {
        // Try to get user data from chrome.storage first, then localStorage as fallback
        const storageData = await chrome.storage.local.get('user');
        let userData = storageData.user;
        
        if (!userData) {
            userData = JSON.parse(localStorage.getItem('user'));
        }
        
        if (userData && !isUserExpired()) {
            // Auto sign in with stored credentials
            await firebase.auth().signInWithCustomToken(userData.idToken);
            return userData;
        } else {
            // Clear expired data
            localStorage.removeItem('user');
            chrome.storage.local.remove('user');
            return null;
        }
    } catch (error) {
        console.error('Error restoring session:', error);
        return null;
    }
}

// Function to handle sign in
async function signIn(email, password) {
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const idToken = await userCredential.user.getIdToken();
        const user = {
            email: userCredential.user.email,
            uid: userCredential.user.uid,
            idToken: idToken
        };
        
        // Store user data with expiration
        storeUserWithExpiration(user);
        
        return user;
    } catch (error) {
        console.error('Error signing in:', error);
        throw error;
    }
}

// Function to handle sign up
async function signUp(email, password) {
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const idToken = await userCredential.user.getIdToken();
        const user = {
            email: userCredential.user.email,
            uid: userCredential.user.uid,
            idToken: idToken
        };
        
        // Store user data with expiration
        storeUserWithExpiration(user);
        
        return user;
    } catch (error) {
        console.error('Error signing up:', error);
        throw error;
    }
}

// Function to handle sign out
async function signOut() {
    try {
        await firebase.auth().signOut();
        // Clear from both storage locations
        localStorage.removeItem('user');
        chrome.storage.local.remove('user');
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
}

// Function to refresh token
async function refreshUserToken() {
    try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            const newToken = await currentUser.getIdToken(true);
            const userData = JSON.parse(localStorage.getItem('user'));
            if (userData) {
                userData.idToken = newToken;
                storeUserWithExpiration(userData);
            }
            return newToken;
        }
        return null;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Set up auth state observer
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        if (isUserExpired()) {
            // If token is expired, refresh it
            await refreshUserToken();
        }
    } else {
        // Try to restore session if we have stored credentials
        await restoreUserSession();
    }
});

// Initialize auth state when extension loads
document.addEventListener('DOMContentLoaded', async () => {
    await restoreUserSession();
});

// Export functions
export { signIn, signUp, signOut, refreshUserToken, isUserExpired, restoreUserSession };

// Firebase Auth implementation for Chrome Extension
class FirebaseAuth {
    constructor() {
        this.currentUser = null;
    }

    async createUserWithEmailAndPassword(email, password) {
        try {
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + firebase.apps[0].options.apiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw {
                    code: this._getErrorCode(data.error.message),
                    message: data.error.message
                };
            }

            this.currentUser = {
                uid: data.localId,
                email: data.email,
                emailVerified: false
            };

            return {
                user: this.currentUser
            };
        } catch (error) {
            throw error;
        }
    }

    async signInWithEmailAndPassword(email, password) {
        try {
            const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebase.apps[0].options.apiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw {
                    code: this._getErrorCode(data.error.message),
                    message: data.error.message
                };
            }

            this.currentUser = {
                uid: data.localId,
                email: data.email,
                emailVerified: false
            };

            return {
                user: this.currentUser
            };
        } catch (error) {
            throw error;
        }
    }

    _getErrorCode(message) {
        const errorMap = {
            'EMAIL_EXISTS': 'auth/email-already-in-use',
            'EMAIL_NOT_FOUND': 'auth/user-not-found',
            'INVALID_PASSWORD': 'auth/wrong-password',
            'USER_DISABLED': 'auth/user-disabled',
            'OPERATION_NOT_ALLOWED': 'auth/operation-not-allowed',
            'TOO_MANY_ATTEMPTS_TRY_LATER': 'auth/too-many-requests',
            'WEAK_PASSWORD': 'auth/weak-password'
        };

        for (const [key, value] of Object.entries(errorMap)) {
            if (message.includes(key)) {
                return value;
            }
        }
        return 'auth/unknown';
    }
}

window.FirebaseAuth = FirebaseAuth; 