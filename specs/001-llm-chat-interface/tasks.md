# Tasks: LLM Chat Interface

**Feature**: LLM Chat Interface PWA  
**Branch**: `001-llm-chat-interface`  
**Input**: Design documents from `/specs/001-llm-chat-interface/`  
**Prerequisites**: ✅ plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story (US1-US6) to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **Checkbox**: `- [ ]` for task tracking
- **[ID]**: Task number (T001, T002, T003...)
- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: User story label (US1, US2, etc.) - only for user story phases
- **Description**: Clear action with exact file path

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create project structure and basic infrastructure

- [X] T001 Create directory structure: public/, src/core/, src/models/, src/ui/, src/utils/, tests/unit/, tests/integration/, tests/e2e/, .github/workflows/
- [X] T002 [P] Create package.json with Jest, Playwright, and marked.js dependencies
- [X] T003 [P] Create .gitignore with node_modules, .DS_Store, coverage, playwright-report
- [X] T004 [P] Create README.md with project overview and quickstart instructions
- [X] T005 [P] Copy PWA icons to public/icons/ (icon-192.png, icon-512.png)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create IndexedDB wrapper in src/core/storage.js with database initialization, conversation/message/settings stores, and indexes
- [X] T007 [P] Create application state manager in src/core/state.js with pub/sub pattern for UI updates
- [X] T008 [P] Create Conversation model in src/models/conversation.js with validation rules
- [X] T009 [P] Create Message model in src/models/message.js with validation rules and status enum
- [X] T010 [P] Create Settings model in src/models/settings.js with default values and validation
- [X] T011 Create base CSS framework in public/assets/styles.css with CSS variables, dark mode support, and minimal design system
- [X] T012 [P] Create DOM helper utilities in src/utils/dom.js for element creation, event handling
- [X] T013 [P] Create formatting utilities in src/utils/format.js for dates, text truncation
- [X] T014 Create main HTML skeleton in public/index.html with app container, sidebar, chat area, settings panel
- [X] T015 [P] Create PWA manifest in public/manifest.json based on contracts/manifest.json spec
- [X] T016 Create Service Worker in public/sw.js with cache-first strategy for static assets and network-first for API calls

**Checkpoint**: ✓ Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Chat Interaction (Priority: P1) 🎯 MVP

**Goal**: User can send messages and receive AI responses in real-time with visual feedback

**Independent Test**: Open app, type message, click send, verify response appears from http://eanserver:9000

### Implementation for User Story 1

- [X] T017 [P] [US1] Create Kai API client in src/core/api.js with POST /v1/chat/completions non-streaming support
- [X] T018 [P] [US1] Create chat UI component in src/ui/chat.js with message list, input field, send button
- [X] T019 [P] [US1] Create reusable UI components in src/ui/components.js (button, input, message bubble, loading spinner)
- [X] T020 [US1] Implement message sending in src/ui/chat.js: validate input, create user message, save to IndexedDB, call API
- [X] T021 [US1] Implement message receiving in src/ui/chat.js: parse API response, create assistant message, save to IndexedDB, display
- [X] T022 [US1] Add loading indicator during API request in src/ui/chat.js
- [X] T023 [US1] Implement message rendering with user/assistant visual distinction in src/ui/chat.js
- [X] T024 [US1] Add empty state UI ("Start a conversation") in src/ui/chat.js
- [X] T025 [US1] Prevent duplicate sends while request in progress in src/ui/chat.js
- [X] T026 [US1] Wire up chat UI to main app in public/index.html with module imports

**Checkpoint**: ✓ User Story 1 complete - Can send/receive messages with basic UI

---

## Phase 4: User Story 6 - Response Streaming (Priority: P2)

**Goal**: AI responses appear word-by-word in real-time instead of waiting for complete response

**Independent Test**: Send message, observe words appearing incrementally, click stop mid-stream

**Note**: Implementing streaming (US6) before conversation management (US2/US3) because it enhances the core chat experience

### Implementation for User Story 6

- [X] T027 [P] [US6] Extend API client in src/core/api.js to support streaming with ReadableStream parser for SSE format
- [X] T028 [US6] Implement streaming response handler in src/ui/chat.js: parse SSE chunks, append delta.content to message
- [X] T029 [US6] Add stop button during streaming in src/ui/chat.js with AbortController
- [X] T030 [US6] Update message status (pending → streaming → complete) in IndexedDB during stream
- [X] T031 [US6] Implement auto-scroll during streaming to keep newest content visible
- [X] T032 [US6] Add error handling for stream interruptions (network loss, server error)
- [X] T033 [US6] Show streaming indicator (cursor/pulse) on active assistant message

**Checkpoint**: ✓ User Story 6 complete - Responses stream in real-time

---

## Phase 5: User Story 2 - Conversation History Management (Priority: P2)

**Goal**: User can view conversation history, scroll through messages, and history persists across sessions

**Independent Test**: Have multi-message conversation, refresh page, verify all messages still visible

### Implementation for User Story 2

- [X] T034 [P] [US2] Implement conversation loading from IndexedDB on app start in src/core/state.js
- [X] T035 [P] [US2] Implement message history loading for current conversation in src/ui/chat.js
- [X] T036 [US2] Add scroll container with overflow handling in src/ui/chat.js
- [X] T037 [US2] Implement scroll-to-bottom on new messages in src/ui/chat.js
- [X] T038 [US2] Add conversation persistence after each message exchange in src/core/storage.js
- [X] T039 [US2] Implement conversation auto-creation on first message send
- [X] T040 [US2] Add conversation title auto-generation from first user message (first 50 chars)
- [X] T041 [US2] Display conversation title in header when conversation is active

**Checkpoint**: ✓ User Story 2 complete - Conversation history persists and displays correctly

---

## Phase 6: User Story 3 - New Conversation Management (Priority: P2)

**Goal**: User can create new conversations and switch between different conversation threads

**Independent Test**: Create new chat, verify it's separate, switch between chats, verify isolation

### Implementation for User Story 3

- [X] T042 [P] [US3] Create sidebar component in src/ui/sidebar.js with conversation list
- [X] T043 [P] [US3] Implement conversation list rendering sorted by updatedAt in src/ui/sidebar.js
- [X] T044 [US3] Add "New Chat" button in sidebar with click handler in src/ui/sidebar.js
- [X] T045 [US3] Implement new conversation creation: generate UUID, initialize empty messages, save to IndexedDB
- [X] T046 [US3] Add conversation switching: load messages, clear current chat, render new chat
- [X] T047 [US3] Highlight active conversation in sidebar list
- [X] T048 [US3] Update conversation updatedAt timestamp when messages are added
- [X] T049 [US3] Add responsive sidebar toggle for mobile view
- [X] T050 [US3] Implement conversation count limit (max 100) with oldest deletion

**Checkpoint**: ✓ User Story 3 complete - Can create and switch between multiple conversations

---

## Phase 7: User Story 4 - Conversation Editing and Deletion (Priority: P3)

**Goal**: User can rename conversations for organization and delete conversations they don't need

**Independent Test**: Rename conversation, verify name persists, delete conversation, verify it's gone

### Implementation for User Story 4

- [ ] T051 [P] [US4] Add rename button (edit icon) to conversation items in src/ui/sidebar.js
- [ ] T052 [P] [US4] Implement inline rename with input field in src/ui/sidebar.js
- [ ] T053 [US4] Add save/cancel buttons for rename operation in src/ui/sidebar.js
- [ ] T054 [US4] Update conversation title in IndexedDB on save
- [ ] T055 [US4] Add delete button (trash icon) to conversation items in src/ui/sidebar.js
- [ ] T056 [US4] Implement delete confirmation modal in src/ui/components.js
- [ ] T057 [US4] Implement cascade delete: remove conversation and all messages from IndexedDB
- [ ] T058 [US4] Handle post-delete navigation: switch to most recent conversation or create new chat
- [ ] T059 [US4] Add keyboard shortcuts (Enter to save rename, Escape to cancel)

**Checkpoint**: ✓ User Story 4 complete - Can rename and delete conversations

---

## Phase 8: User Story 5 - Message Regeneration and Editing (Priority: P3)

**Goal**: User can regenerate AI responses or edit their messages to steer conversation

**Independent Test**: Send message, regenerate response, verify new response; edit user message, verify conversation branches

### Implementation for User Story 5

- [ ] T060 [P] [US5] Add regenerate button to assistant messages in src/ui/chat.js
- [ ] T061 [P] [US5] Add edit button to user messages in src/ui/chat.js
- [ ] T062 [US5] Implement regenerate: resend last user message, replace assistant response in IndexedDB
- [ ] T063 [US5] Implement message editing: show inline input field, save edited message
- [ ] T064 [US5] Handle conversation branching: truncate messages after edited message, create new branch
- [ ] T065 [US5] Add variation tracking for regenerated responses (metadata field)
- [ ] T066 [US5] Add previous/next buttons for navigating response variations
- [ ] T067 [US5] Update UI to show current variation indicator (e.g., "2/3")

**Checkpoint**: ✓ User Story 5 complete - Can regenerate and edit messages

---

## Phase 9: Markdown & Code Rendering (Cross-Cutting)

**Goal**: Display markdown formatting and syntax-highlighted code blocks in messages

**Applies to**: All user stories with message display (US1, US2, US3, US5, US6)

- [X] T068 [P] Create markdown renderer in src/ui/markdown.js using marked.js library
- [X] T069 [P] Add highlight.js for code syntax highlighting in src/ui/markdown.js
- [X] T070 Configure marked.js options: enable GFM, sanitize HTML, set code block handler
- [X] T071 Integrate markdown rendering into message display in src/ui/chat.js
- [X] T072 [P] Add copy button to code blocks in src/ui/markdown.js
- [X] T073 [P] Style code blocks and inline code in public/assets/styles.css
- [X] T074 Test markdown rendering with various formats (headers, lists, links, code, tables)

**Checkpoint**: ✓ Markdown and code rendering working across all messages

---

## Phase 10: Settings Panel (Cross-Cutting)

**Goal**: User can configure app preferences (theme, API endpoint, model, etc.)

**Applies to**: All user stories as global configuration

- [X] T075 [P] Create settings panel UI in src/ui/settings.js with form inputs for all settings
- [X] T076 [P] Implement settings loading from IndexedDB on app start
- [X] T077 Implement settings save: validate inputs, update IndexedDB, apply changes
- [X] T078 [P] Add theme switcher (light/dark/auto) with CSS variable updates
- [X] T079 [P] Add API endpoint configuration with validation
- [X] T080 [P] Add model selection dropdown with available models from /v1/models
- [X] T081 Add toggle switches for: streaming, markdown, code highlighting, auto-scroll, send-on-enter
- [X] T082 Implement settings panel show/hide toggle from header
- [X] T083 Add settings reset to defaults button with confirmation
- [X] T084 Show warning when changing API endpoint (requires reload)

**Checkpoint**: ✓ Settings panel complete - User can configure all preferences

---

## Phase 11: Error Handling & Offline Support (Cross-Cutting)

**Goal**: Graceful error handling and offline capability for viewing conversations

**Applies to**: All user stories with network/storage operations

- [X] T085 [P] Implement error boundary in src/core/state.js for uncaught errors
- [X] T086 [P] Add toast/notification component in src/ui/components.js for user feedback
- [X] T087 Add API error handling in src/core/api.js: timeout (30s), network errors, server errors
- [X] T088 Display error messages to user with retry button for failed requests
- [X] T089 Add offline detection with navigator.onLine in src/core/state.js
- [X] T090 Show offline banner when network unavailable
- [X] T091 Disable send button when offline, allow viewing existing conversations
- [X] T092 Implement exponential backoff retry (2s, 4s, 8s) for failed API requests
- [X] T093 Handle IndexedDB quota exceeded: show warning at 80%, offer export/delete
- [X] T094 Add storage error handling: fallback to LocalStorage if IndexedDB fails
- [X] T095 Test Service Worker offline caching: verify app loads without network

**Checkpoint**: ✓ Error handling and offline support complete

---

## Phase 12: Testing & Quality Assurance

**Purpose**: Validate functionality across all user stories

- [ ] T096 [P] Write unit tests for API client in tests/unit/api.test.js: streaming, non-streaming, error cases
- [ ] T097 [P] Write unit tests for storage wrapper in tests/unit/storage.test.js: CRUD operations, indexes, transactions
- [ ] T098 [P] Write unit tests for models in tests/unit/models.test.js: validation, defaults, edge cases
- [ ] T099 [P] Write integration test for chat flow in tests/integration/chat-flow.test.js: send message, receive response, persist
- [ ] T100 [P] Write integration test for conversation switching in tests/integration/conversation-switch.test.js
- [ ] T101 [P] Write E2E test for PWA installation in tests/e2e/pwa.spec.js with Playwright
- [ ] T102 [P] Write E2E test for offline mode in tests/e2e/offline.spec.js: disable network, verify app loads
- [ ] T103 [P] Write E2E test for full user journey in tests/e2e/user-journey.spec.js: create chat, send messages, switch, delete
- [ ] T104 Run all tests and fix failures: ensure 80%+ coverage for core modules
- [ ] T105 Test across browsers: Chrome, Firefox, Safari (desktop and mobile)
- [ ] T106 Test dark mode: verify CSS variables apply correctly
- [ ] T107 Test keyboard navigation: Tab order, Enter to send, Escape to cancel
- [ ] T108 Test accessibility: screen reader support, ARIA labels, focus management

**Checkpoint**: ✓ All tests passing, quality gates met

---

## Phase 13: Deployment & Documentation

**Purpose**: Deploy to GitHub Pages and finalize documentation

- [X] T109 [P] Create GitHub Actions workflow in .github/workflows/deploy.yml based on quickstart.md
- [X] T110 [P] Configure workflow: checkout, copy public/ to gh-pages branch, deploy
- [X] T111 Test deployment locally: build, verify all files present, test in local server
- [X] T112 [P] Update README.md with: screenshots, features list, installation instructions, contributing guide
- [X] T113 [P] Create CHANGELOG.md with v1.0.0 release notes
- [X] T114 [P] Create CONTRIBUTING.md with development setup, coding standards, PR process
- [X] T115 Commit all changes with conventional commit messages
- [ ] T116 Push to main branch, verify GitHub Actions workflow runs successfully
- [ ] T117 Test deployed app at GitHub Pages URL: verify functionality, PWA install
- [ ] T118 Configure custom domain (optional): add CNAME file, update DNS
- [X] T119 Enable HTTPS on GitHub Pages settings
- [ ] T120 Run quickstart.md validation: follow all steps, verify they work

**Checkpoint**: ✓ App deployed and accessible, documentation complete

---

## Phase 14: Polish & Performance Optimization

**Purpose**: Final improvements for production readiness

- [X] T121 [P] Optimize bundle size: verify marked.js + highlight.js < 20KB gzipped
- [ ] T122 [P] Add loading skeleton UI for initial conversation load
- [ ] T123 Implement virtual scrolling for conversations with 100+ messages
- [ ] T124 [P] Add debouncing to conversation search/filter (if added)
- [X] T125 [P] Optimize Service Worker caching: version static assets, clear old caches
- [ ] T126 Add performance monitoring: measure First Contentful Paint, Time to Interactive
- [ ] T127 Verify performance goals met: FCP <1s, streaming start <2s, conversation switch <500ms
- [X] T128 [P] Add meta tags for SEO: description, keywords, Open Graph
- [X] T129 [P] Add favicon and Apple touch icon
- [X] T130 Code cleanup: remove console.logs, dead code, unused variables
- [ ] T131 [P] Run linter and fix all warnings
- [X] T132 Security review: check for XSS vulnerabilities, CSP headers, sanitization
- [ ] T133 Accessibility audit with Lighthouse: target 90+ score
- [ ] T134 Final manual testing: run through all user stories end-to-end

**Checkpoint**: ✓ App polished and production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: Start immediately - no dependencies
2. **Foundational (Phase 2)**: After Setup - **BLOCKS all user stories**
3. **User Story 1 (Phase 3)**: After Foundational - MVP functionality
4. **User Story 6 (Phase 4)**: After US1 - Enhances core chat with streaming
5. **User Story 2 (Phase 5)**: After US1 + US6 - Adds persistence
6. **User Story 3 (Phase 6)**: After US2 - Adds multi-conversation
7. **User Story 4 (Phase 7)**: After US3 - Adds conversation management
8. **User Story 5 (Phase 8)**: After US1 - Adds message control
9. **Markdown (Phase 9)**: Can start after US1 - Apply to all message displays
10. **Settings (Phase 10)**: Can start after Foundational - Global config
11. **Error Handling (Phase 11)**: Can start after US1 - Apply to all operations
12. **Testing (Phase 12)**: After core user stories complete
13. **Deployment (Phase 13)**: After testing passes
14. **Polish (Phase 14)**: Final phase before release

### Critical Path (MVP - User Story 1 Only)

```
Setup → Foundational → US1 → Testing → Deployment
T001-T005 → T006-T016 → T017-T026 → T096-T099 → T109-T120
```

### Recommended Incremental Path

```
1. Setup + Foundational → Foundation Ready
2. + US1 (Basic Chat) → MVP! Can demo
3. + US6 (Streaming) → Better UX
4. + US2 (History) → Persistence
5. + US3 (Multi-conv) → Full chat app
6. + Markdown + Settings + Errors → Production features
7. + US4 + US5 → Advanced features
8. + Testing + Deployment → Production ready
9. + Polish → Launch!
```

### Parallel Opportunities Within Each Phase

**Setup (Phase 1)**:
- All tasks T002-T005 can run in parallel

**Foundational (Phase 2)**:
- T007, T008, T009, T010, T012, T013 can run in parallel
- T015 can run in parallel with others

**User Story 1 (Phase 3)**:
- T017, T018, T019 can run in parallel

**User Story 6 (Phase 4)**:
- T027 can run in parallel with T033

**Markdown (Phase 9)**:
- T068, T069, T072, T073 can run in parallel

**Settings (Phase 10)**:
- T075, T076, T078, T079, T080 can run in parallel

**Error Handling (Phase 11)**:
- T085, T086 can run in parallel

**Testing (Phase 12)**:
- All test files T096-T103 can run in parallel

**Deployment (Phase 13)**:
- T109, T110, T112, T113, T114 can run in parallel

**Polish (Phase 14)**:
- T121, T122, T124, T125, T128, T129, T131 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Start these together:
git checkout -b feature/us1-api-client
# Implement src/core/api.js

git checkout -b feature/us1-chat-ui
# Implement src/ui/chat.js

git checkout -b feature/us1-components
# Implement src/ui/components.js

# Then merge and continue with dependent tasks
```

---

## Implementation Strategy

### MVP First (Fastest Path to Demo)

1. ✅ Phase 1: Setup (T001-T005)
2. ✅ Phase 2: Foundational (T006-T016) - CRITICAL
3. ✅ Phase 3: User Story 1 (T017-T026) - **STOP HERE FOR MVP**
4. Test independently, deploy, demo

**Result**: Working chat interface with basic send/receive

### Full v1.0 (All User Stories)

Continue from MVP:

5. ✅ Phase 4: User Story 6 - Streaming (T027-T033)
6. ✅ Phase 5: User Story 2 - History (T034-T041)
7. ✅ Phase 6: User Story 3 - Multi-conv (T042-T050)
8. ✅ Phase 9: Markdown (T068-T074)
9. ✅ Phase 10: Settings (T075-T084)
10. ✅ Phase 11: Error Handling (T085-T095)
11. ✅ Phase 7: User Story 4 - Edit/Delete (T051-T059)
12. ✅ Phase 8: User Story 5 - Regenerate (T060-T067)
13. ✅ Phase 12: Testing (T096-T108)
14. ✅ Phase 13: Deployment (T109-T120)
15. ✅ Phase 14: Polish (T121-T134)

**Result**: Full-featured ChatGPT clone ready for production

---

## Task Summary

| Phase | Tasks | Can Start After | User Story |
|-------|-------|-----------------|------------|
| Setup | T001-T005 (5) | Immediately | - |
| Foundational | T006-T016 (11) | Setup | - |
| US1: Basic Chat | T017-T026 (10) | Foundational | P1 MVP |
| US6: Streaming | T027-T033 (7) | US1 | P2 |
| US2: History | T034-T041 (8) | US1 + US6 | P2 |
| US3: Multi-conv | T042-T050 (9) | US2 | P2 |
| US4: Edit/Delete | T051-T059 (9) | US3 | P3 |
| US5: Regenerate | T060-T067 (8) | US1 | P3 |
| Markdown | T068-T074 (7) | US1 | - |
| Settings | T075-T084 (10) | Foundational | - |
| Error Handling | T085-T095 (11) | US1 | - |
| Testing | T096-T108 (13) | Core stories | - |
| Deployment | T109-T120 (12) | Testing | - |
| Polish | T121-T134 (14) | Deployment | - |
| **TOTAL** | **134 tasks** | | |

**MVP Tasks**: 26 (Setup + Foundational + US1)  
**Full v1.0 Tasks**: 134 (all phases)

---

## Notes

- ✅ All tasks follow checklist format with ID, labels, and file paths
- ✅ Tasks organized by user story for independent implementation
- ✅ Each user story is independently testable
- ✅ Clear parallel opportunities marked with [P]
- ✅ MVP can be delivered with just 26 tasks (Phases 1-3)
- ✅ Dependencies clearly documented for execution planning
- ✅ No tests included (not requested in specification)
- ✅ Ready for `/speckit.tasks` output validation

**Next Steps**: Start with T001 (Setup) or jump to specific user story after Foundational phase completes.
