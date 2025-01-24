// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC5tmNdGgEugYvGRlUSM0h2ytfsKbhYDL0",
    authDomain: "ai-bridge-321.firebaseapp.com",
    projectId: "ai-bridge-321",
    storageBucket: "ai-bridge-321.firebasestorage.app",
    messagingSenderId: "367598803344",
    appId: "1:367598803344:web:46c1dac738c50d5e287b15",
    measurementId: "G-JQDL8ES2VD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function showError(formId, message) {
    const errorDiv = document.querySelector(`#${formId} .error-message`);
    if (!errorDiv) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.style.color = '#dc3545';
        div.style.marginTop = '10px';
        div.style.fontSize = '14px';
        document.querySelector(`#${formId} form`).appendChild(div);
        div.textContent = message;
    } else {
        errorDiv.textContent = message;
    }
}

function clearError(formId) {
    const errorDiv = document.querySelector(`#${formId} .error-message`);
    if (errorDiv) {
        errorDiv.remove();
    }
}

// Tab switching logic
const tabBtns = document.querySelectorAll('.tab-btn');
const forms = document.querySelectorAll('.form-container');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show corresponding form
        forms.forEach(form => {
            if (form.id === `${tabName}-form`) {
                form.classList.remove('hidden');
            } else {
                form.classList.add('hidden');
            }
        });
    });
});

// Login form submission
document.querySelector('#login-form form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#login-email').value.trim();
    const password = document.querySelector('#login-password').value;

    clearError('login-form');

    // Validate email and password
    if (!validateEmail(email)) {
        showError('login-form', 'Please enter a valid email address');
        return;
    }

    if (!validatePassword(password)) {
        showError('login-form', 'Password must be at least 6 characters long');
        return;
    }

    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
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
                code: data.error.message,
                message: data.error.message
            };
        }

        localStorage.setItem('user', JSON.stringify({
            uid: data.localId,
            email: data.email,
            emailVerified: false,
            idToken: data.idToken,
            refreshToken: data.refreshToken
        }));
        
        // Close the popup window
        chrome.windows.getCurrent(window => {
            chrome.windows.remove(window.id);
        });
    } catch (error) {
        let errorMessage = 'Login failed: ';
        switch (error.code) {
            case 'EMAIL_NOT_FOUND':
                errorMessage += 'No account found with this email';
                break;
            case 'INVALID_PASSWORD':
                errorMessage += 'Invalid password';
                break;
            case 'USER_DISABLED':
                errorMessage += 'Account has been disabled';
                break;
            default:
                errorMessage += error.message;
        }
        showError('login-form', errorMessage);
    }
});

// Register form submission
document.querySelector('#register-form form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#register-email').value.trim();
    const password = document.querySelector('#register-password').value;

    clearError('register-form');

    // Validate email
    if (!validateEmail(email)) {
        showError('register-form', 'Please enter a valid email address');
        return;
    }

    // Validate password
    if (!validatePassword(password)) {
        showError('register-form', 'Password must be at least 6 characters long');
        return;
    }

    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
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
                code: data.error.message,
                message: data.error.message
            };
        }

        localStorage.setItem('user', JSON.stringify({
            uid: data.localId,
            email: data.email,
            emailVerified: false,
            idToken: data.idToken,
            refreshToken: data.refreshToken
        }));
        
        // Close the popup window
        chrome.windows.getCurrent(window => {
            chrome.windows.remove(window.id);
        });
    } catch (error) {
        let errorMessage = 'Registration failed: ';
        switch (error.code) {
            case 'EMAIL_EXISTS':
                errorMessage += 'An account already exists with this email';
                break;
            case 'OPERATION_NOT_ALLOWED':
                errorMessage += 'Email/password accounts are not enabled';
                break;
            case 'TOO_MANY_ATTEMPTS_TRY_LATER':
                errorMessage += 'Too many attempts. Please try again later';
                break;
            default:
                errorMessage += error.message;
        }
        showError('register-form', errorMessage);
    }
});

// AI Login functionality
const aiButtons = document.querySelectorAll('.ai-login-btn');
const openAllBtn = document.getElementById('open-all');
let openTabs = [];

aiButtons.forEach(button => {
    button.addEventListener('click', () => {
        const url = button.dataset.url;
        chrome.tabs.create({ url: url });
        button.classList.add('active');
    });
});

openAllBtn.addEventListener('click', async () => {
    // Close previously opened tabs
    if (openTabs.length > 0) {
        try {
            await chrome.tabs.remove(openTabs);
            openTabs = [];
            aiButtons.forEach(btn => btn.classList.remove('active'));
            openAllBtn.textContent = 'Open All AI Tabs';
            return;
        } catch (error) {
            console.error('Error closing tabs:', error);
        }
    }

    // Open all AI tabs
    try {
        for (const button of aiButtons) {
            const tab = await chrome.tabs.create({
                url: button.dataset.url,
                active: false
            });
            openTabs.push(tab.id);
            button.classList.add('active');
            // Small delay between opening tabs
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        openAllBtn.textContent = 'Close All AI Tabs';
    } catch (error) {
        console.error('Error opening tabs:', error);
        alert('Error opening tabs: ' + error.message);
    }
}); 