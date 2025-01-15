// Logging
const _LL = (msg) => chrome.runtime.sendMessage({ log: msg })

/**
 * Save Settings in local sorage
 * 
 * @param {Settings} settings
 * @returns {Promise<void>}
 */
const saveSettings = (settings) =>
    chrome.storage.local.set({ settings: settings })

/**
 * get settings from local storage
 *
 * @return  {Promise<Settings|null>}  promise resolve settings or null if not found
 */
const getSettings = () =>
    chrome.storage.local.get("settings").then(results => results.settings)

document.addEventListener("DOMContentLoaded", () => {

    if (!chrome.scripting) {
        _LL("add 'scripting' permission");
        return;
    }

    // Store current tab ID
    let currentTabId;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTabId = tabs[0].id;
    });

    const promptTextElem = document.getElementById('text-prompt');
    if (!promptTextElem) {
        _LL("'text-prompt' element not found");
        return;
    }
    const promptButtonElem = document.getElementById("submit-prompt");
    if (!promptButtonElem) {
        _LL("'submit-prompt' element not found");
        return;
    }

    // Add tooltip for Ctrl+Enter
    promptButtonElem.title = "Press Ctrl+Enter to send";

    // Add Ctrl+Enter handler to text input
    promptTextElem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !promptButtonElem.disabled) {
            e.preventDefault();
            promptButtonElem.click();
        }
    });

    const allAiToggle = document.getElementById('all-ai');
    if (!allAiToggle) {
        _LL("'all-ai' element not found");
        return;
    }

    promptTextElem.addEventListener('input', () => {
        const value = promptTextElem.value;
        promptButtonElem.disabled = value.trim().length === 0;
    });

    const aiButtons = Array.from(document.querySelectorAll(".ai-button"));
    
    // Function to handle AI button click
    const handleAiButtonClick = async (button) => {
        const isActive = button.classList.contains('active');
        
        // Check if tab already exists
        const existingTabs = await chrome.tabs.query({ 
            url: button.dataset.query,
            currentWindow: true 
        });
        
        if (!isActive) {
            // Only create new tab if one doesn't exist
            if (!existingTabs || existingTabs.length === 0) {
                await chrome.tabs.create({ 
                    url: button.dataset.url, 
                    pinned: true,
                    active: false
                });
            }
        }
        
        button.classList.toggle('active');
    };

    // Add click handlers to AI buttons
    aiButtons.forEach(button => {
        button.addEventListener('click', () => handleAiButtonClick(button));
    });

    // Handle All AI toggle
    allAiToggle.addEventListener('click', async () => {
        const allActive = aiButtons.every(btn => btn.classList.contains('active'));
        const newState = !allActive;
        
        // First focus on current tab to ensure we stay here
        if (currentTabId) {
            await chrome.tabs.update(currentTabId, { active: true });
        }

        // Process each button
        for (const button of aiButtons) {
            if (newState !== button.classList.contains('active')) {
                await handleAiButtonClick(button);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Update All AI button state
        allAiToggle.classList.remove('active', 'inactive');
        allAiToggle.classList.add(newState ? 'active' : 'inactive');
    });

    // Initialize button states from settings
    getSettings()
        .then(settings => {
            if (!settings) {
                const _settings = aiButtons.reduce((acc, elem) => {
                    acc[elem.id] = false;
                    return acc;
                }, { lastPrompt: "" });
                return _settings;
            }
            return settings;
        })
        .then(settings => {
            promptTextElem.value = settings.lastPrompt ?? "";
            promptTextElem.dispatchEvent(new Event('input'));

            // Initialize AI button states
            aiButtons.forEach(button => {
                if (settings[button.id]) {
                    button.classList.add('active');
                }
            });

            // Initialize All AI button state
            const allActive = aiButtons.every(btn => btn.classList.contains('active'));
            const someActive = aiButtons.some(btn => btn.classList.contains('active'));
            allAiToggle.classList.remove('active', 'inactive');
            if (allActive) {
                allAiToggle.classList.add('active');
            } else if (!someActive) {
                allAiToggle.classList.add('inactive');
            }
        });

    // Handle submit button
    promptButtonElem.addEventListener("click", async () => {
        const prompt = promptTextElem.value;
        
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(prompt);
            _LL("copied to clipboard!");
        }

        // Save settings
        const settings = aiButtons.reduce((acc, elem) => {
            acc[elem.id] = elem.classList.contains('active');
            return acc;
        }, { lastPrompt: prompt });
        await saveSettings(settings);

        // Submit to active AI tabs
        const activeButtons = aiButtons.filter(btn => btn.classList.contains('active'));
        for (const button of activeButtons) {
            const tabs = await chrome.tabs.query({ 
                url: button.dataset.query,
                currentWindow: true 
            });
            
            if (tabs && tabs.length > 0) {
                const tab = tabs[0];
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (prompt, modelId) => {
                            // Utility function to simulate user input
                            const simulateUserInput = (element, text) => {
                                if (element) {
                                    // Clear existing text
                                    element.value = '';
                                    element.innerHTML = '';
                                    element.textContent = '';

                                    // Set new text
                                    if (element.tagName === 'TEXTAREA' || element.getAttribute('contenteditable') === null) {
                                        element.value = text;
                                    } else {
                                        element.innerHTML = text;
                                        element.textContent = text;
                                    }

                                    // Dispatch events to simulate user interaction
                                    ['input', 'change', 'paste'].forEach(eventType => {
                                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                                    });
                                }
                            };

                            // Utility function to submit
                            const submitPrompt = (input) => {
                                if (!input) return;

                                // Try multiple submission methods
                                const sendButtons = [
                                    input.parentElement?.querySelector('button[type="submit"]'),
                                    input.parentElement?.querySelector('button[aria-label="Send"]'),
                                    input.parentElement?.querySelector('button[data-testid="send-button"]'),
                                    document.querySelector('button[type="submit"]'),
                                    document.querySelector('button[aria-label="Send"]'),
                                    document.querySelector('button[data-testid="send-button"]')
                                ];

                                const sendButton = sendButtons.find(btn => btn && !btn.disabled);

                                if (sendButton) {
                                    sendButton.click();
                                } else {
                                    // Fallback to Enter key
                                    const enterEvent = new KeyboardEvent('keydown', {
                                        key: 'Enter',
                                        code: 'Enter',
                                        keyCode: 13,
                                        which: 13,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    input.dispatchEvent(enterEvent);
                                }
                            };

                            switch(modelId) {
                                case 'openai': // ChatGPT
                                    const chatgptSelectors = [
                                        '#prompt-textarea',
                                        'textarea[data-id="root"]',
                                        'textarea[placeholder*="Send a message"]'
                                    ];

                                    const chatgptInput = chatgptSelectors.reduce((found, selector) => 
                                        found || document.querySelector(selector), null);

                                    if (chatgptInput) {
                                        // Use the same input simulation as other models
                                        simulateUserInput(chatgptInput, prompt);
                                        
                                        // Use the same submission approach with a small delay
                                        setTimeout(() => {
                                            submitPrompt(chatgptInput);
                                        }, 100);
                                    }
                                    break;

                                case 'claude':
                                    const claudeSelectors = [
                                        '[data-testid="message-input"]',
                                        'textarea[name="message"]',
                                        'div[contenteditable="true"]',
                                        'textarea'
                                    ];

                                    const claudeInput = claudeSelectors.reduce((found, selector) => 
                                        found || document.querySelector(selector), null);

                                    if (claudeInput) {
                                        simulateUserInput(claudeInput, prompt);
                                        
                                        // Automatic submission for Claude
                                        setTimeout(() => {
                                            submitPrompt(claudeInput);
                                        }, 100);
                                    }
                                    break;

                                case 'gemini':
                                    const geminiInput = document.querySelector('div[contenteditable="true"]');
                                    if (geminiInput) {
                                        // Set innerHTML and dispatch input event
                                        geminiInput.innerHTML = prompt;
                                        geminiInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        
                                        // Single click submission for Gemini
                                        const sendBtn = document.querySelector('button[aria-label="Send message"]');
                                        if (sendBtn) {
                                            setTimeout(() => {
                                                sendBtn.click();
                                            }, 100);
                                        }
                                    }
                                    break;

                                default:
                                    const defaultInput = document.querySelector('textarea');
                                    if (defaultInput) {
                                        defaultInput.value = prompt;
                                        defaultInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        
                                        // Automatic submission for default
                                        setTimeout(() => {
                                            defaultInput.dispatchEvent(new KeyboardEvent('keydown', {
                                                key: 'Enter',
                                                code: 'Enter',
                                                keyCode: 13,
                                                which: 13,
                                                bubbles: true,
                                                cancelable: true
                                            }));
                                        }, 100);
                                    }
                                    break;
                            }
                        },
                        args: [prompt, button.id]
                    });
                } catch (err) {
                    _LL(`Error with ${button.textContent}: ${err.message}`);
                }
            }
        }
    });
});


