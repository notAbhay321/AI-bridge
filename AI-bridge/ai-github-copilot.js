import { AIToggle } from "./ai-toggle.js";

/**
 * Submits the given prompt text to the GitHub Copilot interface.
 * 
 * take note that this function must be serializable to pass to executeScript. Don't call subfunction etc.
 * 
 * @param {string} prompt - The prompt text to submit.
 */
const submit = (prompt) => {
    // Check if we're on the correct domain and have authorization
    if (!document.location.hostname.includes('github.com')) {
        console.warn("GitHub Copilot: Not on github.com domain");
        return;
    }

    // Try different possible selectors for the textarea
    const selectors = [
        'textarea.form-control', // GitHub's standard textarea class
        'textarea.copilot-textarea',
        'textarea[name="comment[body]"]', // GitHub's comment textarea
        'textarea[data-component="textarea"]', // GitHub's component textarea
        'textarea.comment-form-textarea' // GitHub's comment form
    ];
    
    let promptElem = null;
    for (const selector of selectors) {
        const elem = document.querySelector(selector);
        if (elem) {
            promptElem = elem;
            break;
        }
    }

    if (!promptElem) {
        // If we can't find the input, check if we need to authenticate
        const loginButton = document.querySelector('a[href*="/login"]');
        if (loginButton) {
            console.warn("GitHub Copilot: Please login first");
            return;
        }

        // Try to find any visible textarea as fallback
        const allTextareas = document.querySelectorAll('textarea');
        for (const textarea of allTextareas) {
            if (textarea.offsetParent !== null) {
                promptElem = textarea;
                break;
            }
        }

        if (!promptElem) {
            console.warn("GitHub Copilot: Input element not found!");
            return;
        }
    }

    // Focus the textarea first
    promptElem.focus();
    
    // Clear existing content
    promptElem.value = '';
    promptElem.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Set new content
    promptElem.value = prompt;
    
    // Trigger input events
    promptElem.dispatchEvent(new Event('input', { bubbles: true }));
    promptElem.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Try to find the send button with various selectors
    const buttonSelectors = [
        'button[type="submit"]',
        'button.btn-primary', // GitHub's primary button class
        'button.js-comment-submit', // GitHub's comment submit button
        'button[name="submit"]' // Generic submit button
    ];
    
    let sendButton = null;
    for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const btn of buttons) {
            if (btn && !btn.disabled && btn.offsetParent !== null && 
                (btn.textContent.includes('Submit') || btn.textContent.includes('Comment'))) {
                sendButton = btn;
                break;
            }
        }
        if (sendButton) break;
    }
                      
    if (sendButton) {
        sendButton.click();
    } else {
        // Fallback to Enter key if button not found
        promptElem.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));
    }
}

class GitHubCopilotComponent extends AIToggle {
    constructor() {
        super();
        // Match GitHub Copilot interface
        this.setAttribute("queryTabUrl", "*://github.com/copilot*");
        this.setAttribute("createTabUrl", "https://github.com/copilot");
        this.submitClosure = submit;
    }
}

customElements.define('ai-github-copilot', GitHubCopilotComponent);