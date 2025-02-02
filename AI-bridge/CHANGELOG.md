# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0.4] - 2024-03-19

### Added
- Enhanced UI improvements for chat interface
  - Added centered chat headers with proper alignment
  - Implemented floating border design around chat section
  - Added background image to main content area
  - Improved chat container positioning to right side
  - Added semi-transparent overlays with blur effects
  - Centered time period headers (Previous 30 Days, Yesterday)
  - Added decorative divider lines between chat sections

### Changed
- Improved chat container styling
  - Updated border colors and opacity
  - Added backdrop blur effects for better readability
  - Adjusted spacing and margins for better visual hierarchy
  - Improved responsive layout and alignment

### Fixed
- Chat section alignment and spacing issues
- Time period headers centering
- Background image integration with proper overlay
- Chat container border consistency

## [1.2.0.3]

### Added
- Added persistent chat storage using chrome.storage.local for offline use
- Added auto-backup functionality for chats every 5 minutes
- Added last backup time indicator in the UI
- Added ability to use the extension without logging in
- Added chat organization by time periods (Today, Yesterday, Previous 7 Days, etc.)

### Changed
- Improved chat persistence across extension reloads
- Enhanced chat loading performance
- Optimized local storage handling
- Improved user experience for non-logged-in users

### Fixed
- Fixed chat disappearance issue on extension reload
- Fixed chat synchronization between local and cloud storage

## [1.2.0.2]

### Added
- Added CSV export functionality for chat history
- Added new modern icons throughout the interface
- Added improved UI formatting to meet Material Design standards

### Changed
- Renamed extension from "AI-MultiPrompt" to "AI-Bridge" for better branding
- Reformatted UI elements for better visual hierarchy
- Enhanced overall user interface aesthetics
- Improved button and input field styling
- Simplified extension distribution process

### Removed
- Removed auto-update functionality in favor of manual updates

## [1.2.1]

### Security
- Removed exposed Firebase credentials from repository
- Replaced sensitive data with placeholder values
- Enhanced security configuration handling
- Updated documentation for secure credential management
- Added warning about API key exposure
- Implemented secure configuration template system

## [1.2.0]

### Added
- Added Firebase integration for stable chat storage
- Added chat persistence across login sessions
- Implemented reverse chronological order for chat loading (latest first)

### Changed
- Various UI improvements and refinements
- Enhanced chat management system
- Optimized chat loading performance
- Changed keyboard shortcut from Ctrl+Shift+L to Alt+A for better compatibility

## [1.1.1]

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

## [1.1.0]

### Changed
- Converted extension from popup to tab-based interface
- Extension now opens in a new tab when clicked instead of a popup
- Added side navigation menu for better organization
- Repositioned text input field to bottom of tab for improved UX
- Enhanced overall UI layout

## [1.0.1]

### Changed
- Configuration updates for local PC compatibility
- Added proper locale support with _locales structure

## [1.0.0]

### Added
- Initial release
- Working popup extension
- Basic extension functionality
- Multi-AI chat support