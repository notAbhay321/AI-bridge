# Chrome AI-MultiPrompt-Extension

## Title from package

AI-MultiPrompt

## Summary from package

A Web Extension that allows to simultaneously submit a prompt to multiple AI chats

## Description
This extension submit a single prompt simultaneously to different AI chat previously opened in the browser's tabs.

### Features: 

* Currently the extension support:
  - [ChatGPT]
  - [Gemini]
  - [Mistral]
  - [Perplexity]
  - [Copilot]
  - [Deepseek]
  - [Claude]
* Firebase integration for stable chat storage
* Chat history persistence across login sessions
* Latest chats appear first for easy access
* Remember last submitted prompt 
* Copy last submitted prompt to the clipboard
* Allows to choose which AI are involved in prompt analysis
* Opens a pinned tab for each AI chat chosen (if doesn't already opened yet)
* Quick access with Alt+A keyboard shortcut

### Usage 

1. Open the extension:
   - Click the extension icon in toolbar, or
   - Press Alt+A (new shortcut for better compatibility)
2. Write prompt
3. Choose the AI chat you want to submit the prompt to and click on the "Submit" button

### Keyboard Shortcuts

* `Alt+A` - Open AI-Bridge (previously Ctrl+Shift+L)
* `Ctrl+Enter` - Send prompt when input field is focused

### AI Model Links

ChatGPT: https://chatgpt.com/
Gemini: https://gemini.google.com/
Copilot: https://copilot.microsoft.com/
Deepseek: https://chat.deepseek.com/
Perplexity: https://www.perplexity.ai/
Mistral: https://chat.mistral.ai/chat
Claude: https://claude.ai/chat

### Setup

1. Clone the repository
2. Copy `config.example.js` to `config.js`
3. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
4. Get your Firebase configuration from Project Settings
5. Fill in your Firebase credentials in `config.js`
6. Install dependencies and build the project

### Security Best Practices

1. **API Key Management**:
   - Never commit `config.js` with real credentials
   - Use `config.example.js` as a template
   - Rotate API keys if accidentally exposed
   - Set up API key restrictions in Firebase Console

2. **Firebase Security**:
   - Enable Authentication
   - Set up proper Firestore rules
   - Restrict API key usage by domain
   - Monitor usage in Firebase Console

3. **Local Development**:
   - Keep `config.js` in `.gitignore`
   - Use separate development credentials
   - Regularly check for security alerts
   - Follow Firebase security best practices

### Important Security Note
If you fork or clone this repository, make sure to:
1. Never commit real Firebase credentials
2. Create your own Firebase project
3. Use your own API keys
4. Set up proper security rules
5. Monitor your Firebase usage

The project maintainers are not responsible for any misuse of exposed credentials.
