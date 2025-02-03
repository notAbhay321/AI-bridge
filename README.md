# 🌉 AI-Bridge

<div align="center">

![AI-Bridge Logo](icons/icon128.png)

A powerful Chrome extension that bridges multiple AI chat services into one seamless interface.

[![Version](https://img.shields.io/badge/version-1.2.0.7-blue.svg)](https://github.com/yourusername/AI-bridge)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

## 🌟 Overview

AI-Bridge revolutionizes your AI interaction experience by allowing you to simultaneously interact with multiple AI services from a single, elegant interface. Send one prompt to multiple AI models and compare their responses in real-time.

### 🎯 Key Features

#### 🤖 Supported AI Models
- **[ChatGPT](https://chatgpt.com/)** - OpenAI's flagship model
- **[Gemini](https://gemini.google.com/)** - Google's advanced AI
- **[Claude](https://claude.ai/)** - Anthropic's AI assistant
- **[Copilot](https://copilot.microsoft.com/)** - Microsoft's AI companion
- **[Perplexity](https://www.perplexity.ai/)** - Research-focused AI
- **[Deepseek](https://chat.deepseek.com/)** - Specialized AI chat
- **[Mistral](https://chat.mistral.ai/chat)** - Advanced language model

#### 💫 Core Features
- **Pre-prompt Templates** - Save and reuse common prompts
- **Firebase Integration** - Secure cloud storage for your chats
- **Chat History** - Persistent across sessions and devices
- **Smart Organization** - Chats organized by time periods
- **Quick Access** - Keyboard shortcuts for efficiency
- **Synchronized Backup** - Automatic chat backups
- **Offline Support** - Works without internet connection

## 🚀 Getting Started

### Prerequisites
- Google Chrome Browser
- Firebase Account (for cloud features)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/AI-bridge.git
   cd AI-bridge
   ```

2. **Configure Firebase**
   ```bash
   cp config.example.js config.js
   # Edit config.js with your Firebase credentials
   ```

3. **Load in Chrome**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## 🎮 Usage Guide

### Basic Operations

1. **Launch AI-Bridge**
   - Click extension icon or press `Alt+A`
   - Interface opens in a new tab

2. **Send Prompts**
   - Type your prompt in the input field
   - Select target AI models
   - Press `Ctrl+Enter` or click Send

3. **Pre-prompts**
   - Click '+' to create new template
   - Enter label and instructions
   - Click template to auto-fill prompt

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+A` | Open AI-Bridge |
| `Ctrl+Enter` | Send prompt |
| `Alt+I` | New chat |

## 🔒 Security Features

### Data Protection
- Secure Firebase integration
- Local storage encryption
- Automatic backups
- Data persistence across sessions

### Best Practices
1. **API Security**
   - Never commit credentials
   - Use API key restrictions
   - Regular key rotation

2. **Firebase Security**
   - Authentication required
   - Firestore security rules
   - Usage monitoring
   - Regular audits

## 🛠️ Technical Architecture

### Components
- **Frontend**: HTML, CSS, JavaScript
- **Storage**: Firebase + Chrome Storage
- **Authentication**: Firebase Auth
- **Real-time Sync**: Firestore

### File Structure
```
AI-bridge/
├── manifest.json
├── icons/
├── _locales/
├── js/
│   ├── ai-models/
│   ├── utils/
│   └── core/
└── css/
```

## 🔄 Version History

### Current Version: 1.2.0.7
- Pre-prompt templates
- Enhanced UI
- Improved storage handling
- Better error management

[See full changelog](CHANGELOG.md)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- All supported AI platforms
- Firebase team
- Chrome Extensions community
- Our amazing contributors

## 📞 Support

- [Report a bug](https://github.com/yourusername/AI-bridge/issues)
- [Request a feature](https://github.com/yourusername/AI-bridge/issues)
- [Email support](mailto:your.email@example.com)

---

<div align="center">
Made with ❤️ by the AI-Bridge Team
</div>
