# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release features
- Basic chat functionality with AI responses
- Real-time streaming responses
- Conversation history with IndexedDB persistence
- Multiple conversation management
- Markdown rendering with code syntax highlighting
- Comprehensive settings panel
- Theme switching (light/dark/auto)
- Error handling and offline support
- Progressive Web App (PWA) capabilities
- Service Worker for offline access
- Toast notifications for user feedback
- Mobile-responsive design

## [1.0.0] - 2025-11-17

### Added
- Core chat interface with send/receive functionality
- Integration with Kai LLM server (OpenAI-compatible API)
- SSE streaming for real-time AI responses
- IndexedDB storage for conversations and messages
- Conversation list with creation and switching
- Auto-generated conversation titles
- Markdown rendering for AI responses
- Code blocks with copy functionality
- Settings panel with:
  - API endpoint configuration
  - Model selection
  - Theme selection (light/dark/auto)
  - Streaming toggle
  - Markdown rendering toggle
  - Auto-scroll toggle
  - Send-on-Enter toggle
  - Temperature adjustment
- Error boundary for uncaught errors
- Offline detection and banner
- Service Worker with cache-first strategy
- PWA manifest for home screen installation
- Dark mode support with CSS variables
- Mobile-responsive sidebar

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- HTML sanitization in markdown renderer
- XSS protection for user-generated content
- Safe link handling (rel="noopener noreferrer")

## Future Releases

### Planned for v1.1.0
- Message editing and regeneration
- Conversation rename and delete
- Export conversations
- Search within conversations
- Syntax highlighting for code blocks
- Model management UI
- Voice input support

### Planned for v1.2.0
- Multi-user support (optional)
- Conversation sharing
- Custom model parameters per conversation
- Conversation tagging/categorization
- Import/export data

### Planned for v2.0.0
- Plugin system
- Custom themes
- Advanced markdown features
- Image uploads
- File attachments
- Conversation branching
