# Phase 1: Data Model

**Feature**: LLM Chat Interface  
**Date**: November 17, 2025  
**Purpose**: Define data entities and their relationships for conversation management

## Entity Definitions

### 1. Conversation

Represents a chat thread between the user and the AI assistant.

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | String (UUID) | Yes | Unique identifier | UUID v4 format |
| `title` | String | Yes | Conversation title | 1-100 characters, auto-generated from first message if not provided |
| `createdAt` | Number (timestamp) | Yes | Creation time in milliseconds since epoch | Positive integer |
| `updatedAt` | Number (timestamp) | Yes | Last update time in milliseconds since epoch | Positive integer, >= createdAt |
| `messageCount` | Number | Yes | Total messages in conversation | Non-negative integer |
| `model` | String | No | AI model used (e.g., "granite-local", "gpt-4") | Must match Kai model names |
| `archived` | Boolean | No | Whether conversation is archived | Default: false |

**Indexes**:
- Primary: `id`
- Secondary: `updatedAt` (for sorting conversation list)
- Secondary: `createdAt` (for chronological browsing)

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Explain quantum computing",
  "createdAt": 1700236800000,
  "updatedAt": 1700237100000,
  "messageCount": 6,
  "model": "granite-local",
  "archived": false
}
```

**Relationships**:
- One-to-many with `Message` (one conversation has many messages)

**Business Rules**:
1. Title auto-generated from first user message (first 50 chars) if not manually set
2. `updatedAt` updated whenever a message is added
3. Deleting a conversation deletes all associated messages (cascade delete)
4. Archived conversations hidden from main list but still searchable

---

### 2. Message

Represents a single message within a conversation (user or assistant).

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | String (UUID) | Yes | Unique identifier | UUID v4 format |
| `conversationId` | String (UUID) | Yes | Parent conversation ID | Must reference existing conversation |
| `role` | String | Yes | Message sender | Must be "user" or "assistant" |
| `content` | String | Yes | Message text (supports Markdown) | 1-50,000 characters |
| `timestamp` | Number | Yes | Message creation time (ms since epoch) | Positive integer |
| `status` | String | Yes | Message status | "pending", "streaming", "complete", "error" |
| `tokenCount` | Number | No | Token count (if provided by API) | Non-negative integer |
| `metadata` | Object | No | Additional data (e.g., generation params, error details) | Valid JSON object |

**Indexes**:
- Primary: `id`
- Secondary: `conversationId` (for fetching all messages in a conversation)
- Secondary: `timestamp` (for chronological ordering)

**Example (User Message)**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "content": "Explain quantum computing in simple terms",
  "timestamp": 1700236800000,
  "status": "complete"
}
```

**Example (Assistant Message with Streaming)**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440002",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "assistant",
  "content": "Quantum computing uses quantum bits...",
  "timestamp": 1700236805000,
  "status": "streaming",
  "tokenCount": 150,
  "metadata": {
    "model": "granite-local",
    "temperature": 0.7,
    "finishReason": null
  }
}
```

**Relationships**:
- Many-to-one with `Conversation` (many messages belong to one conversation)

**Business Rules**:
1. Messages ordered by `timestamp` within a conversation
2. `status` transitions: "pending" → "streaming" → "complete" OR "error"
3. User messages always have status "complete"
4. Assistant messages can be edited/regenerated (creates new message, marks old as hidden)
5. Content supports Markdown formatting with code blocks

---

### 3. Settings

Represents user preferences and application settings.

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `key` | String | Yes | Setting key | Unique, lowercase-hyphen format |
| `value` | Any | Yes | Setting value | Type depends on key |
| `updatedAt` | Number | Yes | Last update timestamp | Positive integer |

**Indexes**:
- Primary: `key`

**Predefined Settings**:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | String | "auto" | UI theme: "light", "dark", or "auto" |
| `api-endpoint` | String | "http://eanserver:9000" | Kai server base URL |
| `default-model` | String | "granite-local" | Default AI model for new conversations |
| `streaming-enabled` | Boolean | true | Enable streaming responses |
| `markdown-enabled` | Boolean | true | Render Markdown in messages |
| `code-highlighting` | Boolean | true | Syntax highlight code blocks |
| `auto-scroll` | Boolean | true | Auto-scroll to new messages |
| `send-on-enter` | Boolean | true | Send message with Enter (Shift+Enter for newline) |
| `conversation-list-sort` | String | "updatedAt" | Sort conversations by: "updatedAt", "createdAt", "title" |
| `max-conversations` | Number | 100 | Maximum conversations to keep (auto-delete oldest) |

**Example**:
```json
[
  {
    "key": "theme",
    "value": "dark",
    "updatedAt": 1700236800000
  },
  {
    "key": "api-endpoint",
    "value": "http://eanserver:9000",
    "updatedAt": 1700236800000
  },
  {
    "key": "default-model",
    "value": "granite-local",
    "updatedAt": 1700236800000
  }
]
```

**Business Rules**:
1. Settings initialized with defaults on first app load
2. Invalid values rejected, reverted to defaults
3. Changing `api-endpoint` shows warning (requires app reload)

---

### 4. UserProfile (Optional - Future Enhancement)

User information for personalization (not in MVP).

**Attributes**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | User ID (for multi-user future support) |
| `name` | String | No | Display name |
| `avatar` | String | No | Avatar URL or data URI |
| `preferences` | Object | No | Additional preferences |

**Status**: Not implemented in v1.0 (single-user app)

---

## Data Relationships

```
┌─────────────────┐
│  Conversation   │
│                 │
│  - id (PK)      │
│  - title        │
│  - createdAt    │
│  - updatedAt    │
│  - messageCount │
│  - model        │
│  - archived     │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐
│    Message      │
│                 │
│  - id (PK)      │
│  - conversationId (FK)
│  - role         │
│  - content      │
│  - timestamp    │
│  - status       │
│  - tokenCount   │
│  - metadata     │
└─────────────────┘

┌─────────────────┐
│    Settings     │
│                 │
│  - key (PK)     │
│  - value        │
│  - updatedAt    │
└─────────────────┘
```

---

## Storage Implementation (IndexedDB)

**Database Name**: `llmchat`  
**Version**: 1

**Object Stores**:

```javascript
// Database schema
{
  conversations: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false }
    ]
  },
  messages: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'conversationId', keyPath: 'conversationId', unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false }
    ]
  },
  settings: {
    keyPath: 'key',
    autoIncrement: false,
    indexes: []
  }
}
```

**Estimated Storage Requirements**:

| Entity | Count | Avg Size | Total |
|--------|-------|----------|-------|
| Conversation metadata | 100 | 200 bytes | 20 KB |
| Messages | 10,000 (100 convos × 100 msgs) | 500 bytes | 5 MB |
| Settings | 10 | 50 bytes | 500 bytes |
| **Total** | | | **~5 MB** |

**Note**: Well within IndexedDB quota (typically 50MB+)

---

## CRUD Operations

### Conversation Operations

**Create**:
```javascript
const conversation = {
  id: crypto.randomUUID(),
  title: 'New Chat',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messageCount: 0,
  model: settings.get('default-model'),
  archived: false
};
await db.conversations.add(conversation);
```

**Read (List)**:
```javascript
const conversations = await db.conversations
  .index('updatedAt')
  .reverse()
  .limit(100)
  .toArray();
```

**Update**:
```javascript
await db.conversations.update(conversationId, {
  title: newTitle,
  updatedAt: Date.now()
});
```

**Delete (Cascade)**:
```javascript
await db.transaction('rw', [db.conversations, db.messages], async () => {
  await db.conversations.delete(conversationId);
  await db.messages.where('conversationId').equals(conversationId).delete();
});
```

### Message Operations

**Create (Add to Conversation)**:
```javascript
const message = {
  id: crypto.randomUUID(),
  conversationId: currentConversationId,
  role: 'user',
  content: userInput,
  timestamp: Date.now(),
  status: 'complete'
};

await db.transaction('rw', [db.conversations, db.messages], async () => {
  await db.messages.add(message);
  await db.conversations.update(currentConversationId, {
    messageCount: conversation.messageCount + 1,
    updatedAt: Date.now()
  });
});
```

**Read (Conversation Messages)**:
```javascript
const messages = await db.messages
  .where('conversationId')
  .equals(conversationId)
  .sortBy('timestamp');
```

**Update (Streaming)**:
```javascript
await db.messages.update(messageId, {
  content: accumulatedContent,
  status: isDone ? 'complete' : 'streaming'
});
```

### Settings Operations

**Read**:
```javascript
const theme = await db.settings.get('theme');
```

**Update**:
```javascript
await db.settings.put({
  key: 'theme',
  value: 'dark',
  updatedAt: Date.now()
});
```

---

## Validation Rules

### Conversation Validation
- `title`: Trim whitespace, max 100 chars, default "New Chat" if empty
- `createdAt` / `updatedAt`: Must be valid timestamps, updatedAt >= createdAt
- `messageCount`: Auto-calculated, not user-editable

### Message Validation
- `content`: Required, 1-50,000 characters, preserve formatting
- `role`: Must be exactly "user" or "assistant"
- `conversationId`: Must reference existing conversation
- `status`: Must be valid enum value

### Settings Validation
- `theme`: Must be "light", "dark", or "auto"
- `api-endpoint`: Must be valid URL with protocol
- `default-model`: Must match available model names
- Boolean settings: Coerce to boolean type
- Numeric settings: Must be positive integers

---

## Migration Strategy (Future Versions)

**Version 1 → Version 2** (example):
```javascript
db.version(2).stores({
  conversations: '++id, title, updatedAt, createdAt, archived',
  messages: '++id, conversationId, timestamp, role',
  settings: 'key',
  userProfiles: 'id' // New store
}).upgrade(tx => {
  // Migration logic
  return tx.settings.put({ key: 'user-id', value: 'default', updatedAt: Date.now() });
});
```

---

## Data Export/Import (Future)

**Export Format** (JSON):
```json
{
  "version": "1.0",
  "exportedAt": 1700236800000,
  "conversations": [...],
  "messages": [...],
  "settings": [...]
}
```

**Use Cases**:
- Backup conversations
- Transfer between devices
- Share conversations
- Clear data while preserving backup

---

## Next Steps

Data model complete. Proceeding to:
1. **contracts/**: API integration specs and PWA manifest
2. **quickstart.md**: Setup and deployment guide
