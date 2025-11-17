# API Contracts

This directory contains the contract specifications for the LLM Chat Interface.

## Files

### `kai-api.json`
OpenAPI 3.0 specification for integrating with the Kai LLM server at http://eanserver:9000.

**Key Endpoints**:
- `POST /v1/chat/completions` - Send messages and receive AI responses (streaming or non-streaming)
- `GET /v1/models` - List available AI models
- `GET /health` - Check server health status

**Authentication**: None required (open access on private network)

**Usage**: This spec can be used to:
- Generate API client code
- Validate requests/responses during testing
- Document integration points for developers
- Import into tools like Postman or Swagger UI

### `manifest.json`
Progressive Web App manifest for home screen installation.

**Features**:
- Standalone display mode (full-screen app experience)
- Custom icons (192x192, 512x512)
- App shortcuts (New Chat, Settings)
- Share target support (share text to app)
- Optimized for both desktop and mobile

**Installation**: 
When users visit the app, browsers will offer to "Add to Home Screen" or "Install App".

## Integration Notes

### Streaming Response Format

The Kai API returns Server-Sent Events when `stream: true`:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1700236800,"model":"granite-local","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1700236800,"model":"granite-local","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: [DONE]
```

Each chunk contains:
- `delta.content`: The next piece of text to append
- `finish_reason`: null during streaming, "stop" on completion

### Error Handling

Standard HTTP error codes:
- `400`: Bad request (invalid model, malformed JSON)
- `500`: Server error (model unavailable, internal error)

Error response format:
```json
{
  "error": {
    "message": "Invalid model name",
    "type": "invalid_request_error",
    "code": "invalid_model"
  }
}
```

### Model Names

Current available models (from Kai server):
- `granite-local`: Local Ollama model (fast, free)
- `gpt-4`: External model via OpenRouter (Claude Opus)
- `gpt-3.5-turbo`: External model via OpenRouter (Claude Sonnet)

**Note**: Model names map to Kai's internal model routing, not actual OpenAI models.

### Network Considerations

- **Endpoint**: http://eanserver:9000 (local network only)
- **Protocol**: HTTP (not HTTPS) - suitable for private network
- **CORS**: Ensure Kai server allows requests from the PWA origin
- **Timeout**: Implement 30-second timeout for non-streaming requests
- **Retry**: Use exponential backoff for failed requests (2s, 4s, 8s)

## Testing

### Validate OpenAPI Spec
```bash
npx @stoplight/spectral-cli lint kai-api.json
```

### Test with curl
```bash
# Non-streaming
curl -X POST http://eanserver:9000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "granite-local",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'

# Streaming
curl -X POST http://eanserver:9000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "granite-local",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }' \
  --no-buffer
```

### Validate PWA Manifest
Use Chrome DevTools:
1. Open app in Chrome
2. DevTools → Application → Manifest
3. Check for errors/warnings
4. Test "Add to Home Screen"

## Version History

- **v1.0.0** (2025-11-17): Initial OpenAPI spec and PWA manifest
