# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2024-03-xx

### Added
- Added Firebase integration for stable chat storage
- Added chat persistence across login sessions
- Implemented reverse chronological order for chat loading (latest first)

### Changed
- Various UI improvements and refinements
- Enhanced chat management system
- Optimized chat loading performance
- Changed keyboard shortcut from Ctrl+Shift+L to Alt+A for better compatibility

## [1.1.1] - 2024-03-xx

### Added
- Added Ctrl+Enter shortcut to send prompts
- Added tooltip on send button showing "Press Ctrl+Enter to send"
- Added support for multiple input field selectors for ChatGPT
- Added automatic prompt submission for all AI models
- Added improved text input simulation for better compatibility

### Fixed
- Fixed ChatGPT text input and submission issues
- Fixed double submission issue in Gemini
- Fixed reliability issues with AI model detection
- Fixed button state handling for better user experience

### Changed
- Improved input field detection for all AI models
- Enhanced prompt submission logic with better error handling
- Optimized submission timing for more reliable operation
- Standardized text input simulation across all AI models

## [1.1.0] - 2024

### Changed
- Converted extension from popup to tab-based interface
- Extension now opens in a new tab when clicked instead of a popup
- Added side navigation menu for better organization
- Repositioned text input field to bottom of tab for improved UX
- Enhanced overall UI layout

## [1.0.1] - 2024

### Changed
- Configuration updates for local PC compatibility
- Added proper locale support with _locales structure

## [1.0.0] - 2024

### Added
- Initial release
- Working popup extension
- Basic extension functionality
- Multi-AI chat support