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