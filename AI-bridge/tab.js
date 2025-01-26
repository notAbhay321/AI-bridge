// Profile dropdown functionality
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');

profileButton.addEventListener('click', () => {
    profileDropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
        profileDropdown.classList.remove('show');
    }
});

// Refresh icon functionality
const refreshIcon = document.querySelector('.refresh-icon');
refreshIcon.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent dropdown from opening
    refreshIcon.style.transform = 'rotate(360deg)';
    // Add your refresh logic here
    
    // Reset the rotation after animation
    setTimeout(() => {
        refreshIcon.style.transform = 'rotate(0deg)';
    }, 1000);
}); 