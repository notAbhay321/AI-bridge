document.addEventListener('DOMContentLoaded', () => {
    // Display user information
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-email').textContent = user.email;
    } else {
        window.location.href = 'auth.html';
    }

    // Add event listeners for buttons
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'tab.html';
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'auth.html';
    });
}); 