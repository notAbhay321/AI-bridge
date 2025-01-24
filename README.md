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

ChatGPT: https://chatgpt.com/
Gemini: https://gemini.google.com/
Copilot: https://copilot.microsoft.com/
Deepseek: https://chat.deepseek.com/
Perplexity: https://www.perplexity.ai/
Mistral: https://chat.mistral.ai/chat
Claude: https://claude.ai/chat

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
4. Get your Firebase configuration from Project Settings
5. Fill in your Firebase credentials in the `.env` file
6. Install dependencies and build the project

### Security Note
Never commit your `.env` file or expose your Firebase credentials. The `.env` file is listed in `.gitignore` to prevent accidental commits.
