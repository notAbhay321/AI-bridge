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

// Add notification styles at the top after Firebase config
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background-color: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .notification.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
`;
document.head.appendChild(style);

// Add showNotification function before other functions
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
    const errorDiv = document.querySelector('#login-form .error-message');
    const submitBtn = document.querySelector('#login-form button[type="submit"]');

    // Clear previous error
    errorDiv.classList.add('hidden');

    // Validate email and password
    if (!validateEmail(email)) {
        errorDiv.querySelector('span').textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }

    if (!validatePassword(password)) {
        errorDiv.querySelector('span').textContent = 'Password must be at least 6 characters long';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        submitBtn.classList.add('loading');
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

        handleLoginSuccess(data);
    } catch (error) {
        const errorMessage = getLoginErrorMessage(error.code);
        errorDiv.querySelector('span').textContent = errorMessage;
        errorDiv.classList.remove('hidden');
        // Clear password field for security
        document.querySelector('#login-password').value = '';
    } finally {
        submitBtn.classList.remove('loading');
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

        // Use handleLoginSuccess for registration as well
        handleLoginSuccess(data);
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

// After successful login
function handleLoginSuccess(user) {
    try {
        // Save user data
        localStorage.setItem('user', JSON.stringify({
            uid: user.localId,
            email: user.email,
            emailVerified: user.emailVerified || false,
            idToken: user.idToken,
            refreshToken: user.refreshToken
        }));
        
        // Notify all extension views about successful login
        chrome.runtime.sendMessage({ 
            action: 'login_successful',
            user: user
        });

        // Show success message
        showNotification('Login successful!');
        
        // Close the auth window after a short delay
        setTimeout(() => {
            chrome.windows.getCurrent(window => {
                chrome.windows.remove(window.id);
            });
        }, 1500); // Increased delay to ensure notification is visible
    } catch (error) {
        console.error('Error handling login success:', error);
        showNotification('Error completing login');
    }
}

// Password visibility toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        const input = e.currentTarget.parentElement.querySelector('input');
        const icon = e.currentTarget.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

// Forgot password modal
const modal = document.getElementById('forgot-password-modal');
const forgotPasswordLink = document.querySelector('.forgot-password');
const modalClose = document.querySelector('.modal-close');

forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('show');
});

modalClose.addEventListener('click', () => {
    modal.classList.remove('show');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

// Forgot password form submission
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#reset-email').value.trim();
    const errorDiv = modal.querySelector('.error-message');
    const submitBtn = modal.querySelector('button[type="submit"]');
    
    // Clear previous error
    errorDiv.classList.add('hidden');
    
    // Validate email
    if (!validateEmail(email)) {
        errorDiv.querySelector('span').textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        submitBtn.classList.add('loading');
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requestType: 'PASSWORD_RESET',
                email: email
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw {
                code: data.error.message,
                message: data.error.message
            };
        }

        showNotification('Password reset link sent to your email');
        modal.classList.remove('show');
        document.getElementById('reset-email').value = '';
    } catch (error) {
        let errorMessage = '';
        switch (error.code) {
            case 'EMAIL_NOT_FOUND':
                errorMessage = 'No account found with this email address';
                break;
            case 'TOO_MANY_ATTEMPTS_TRY_LATER':
                errorMessage = 'Too many attempts. Please try again later';
                break;
            default:
                errorMessage = 'Failed to send reset link. Please try again';
        }
        errorDiv.querySelector('span').textContent = errorMessage;
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.classList.remove('loading');
    }
});

// Update login error messages
function getLoginErrorMessage(code) {
    switch (code) {
        case 'EMAIL_NOT_FOUND':
            return 'Incorrect email or password. Please try again';
        case 'INVALID_PASSWORD':
            return 'Incorrect email or password. Please try again';
        case 'USER_DISABLED':
            return 'This account has been disabled. Please contact support';
        case 'INVALID_LOGIN_CREDENTIALS':
            return 'Incorrect email or password. Please try again';
        default:
            return 'Incorrect email or password. Please try again';
    }
} 