import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));
// Also serve src for ES modules
app.use('/src', express.static(path.join(__dirname, '../src')));

// LiveKit Token Endpoint
app.post('/livekit/token', async (req, res) => {
  const { roomName, identity } = req.body;

  if (!roomName || !identity) {
    return res.status(400).json({ error: 'roomName and identity are required' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return res.status(500).json({ error: 'Server misconfigured: LiveKit credentials missing' });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: wsUrl,
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Handle SPA routing - return index.html for HTML requests
app.use((req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/livekit/')) {
    return next();
  }
  
  // Only handle GET requests that look like page requests
  if (req.method === 'GET' && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  
  next();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
