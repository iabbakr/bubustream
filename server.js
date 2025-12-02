// backend/server.js
import express from 'express';
import { StreamChat } from 'stream-chat';
import dotenv from 'dotenv';
import cors from 'cors'; // ADD THIS

dotenv.config();

const app = express();

// ✅ Middleware BEFORE routes
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies

// Initialize Stream
const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// ✅ Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ✅ Token endpoint with better error handling
app.post('/api/stream-token', async (req, res) => {
  try {
    console.log('Received body:', req.body); // Debug log
    
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'userId is required',
        received: req.body 
      });
    }

    // Generate token
    const token = serverClient.createToken(userId);

    res.json({ token, userId });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Stream API Key: ${process.env.STREAM_API_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`Stream Secret: ${process.env.STREAM_API_SECRET ? '✓ Set' : '✗ Missing'}`);
});