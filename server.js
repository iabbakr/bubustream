// server.js - FINAL WORKING VERSION (DEC 2025)
// Fixes: Strict ID match (no prefixes), correct user upserting, and clean error handling.

const express = require('express');
const { StreamClient } = require('@stream-io/node-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Stream client with API key and secret
const streamClient = new StreamClient(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    streamConfigured: !!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET)
  });
});

// Generate user token (client-side auth)
app.post('/stream/token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // console.log('Generating token for user:', userId);
    const token = streamClient.createToken(userId);
    res.json({ token });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    });
  }
});

// ✅ CREATE VIDEO CALL - STRICT ID CONSISTENCY
app.post('/stream/create-call', async (req, res) => {
  try {
    const { 
      bookingId, 
      professionalId, 
      patientId, 
      professionalName = 'Professional',
      patientName = 'Patient'
    } = req.body;
    
    // Validate required fields
    if (!bookingId || !professionalId || !patientId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['bookingId', 'professionalId', 'patientId']
      });
    }
    
    // 1. STRICT ID: Use the Booking ID directly. NO PREFIXES.
    // This ensures frontend and backend IDs match perfectly.
    const callId = bookingId; 
    console.log(`Creating call: ${callId} [Prof: ${professionalId}, Patient: ${patientId}]`);

    // 2. UPSERT USERS: Ensure they exist on Stream (Array format required by SDK v5+)
    await streamClient.upsertUsers([
      {
        id: professionalId,
        name: professionalName,
        role: 'admin'  // Professional gets admin rights
      },
      {
        id: patientId,
        name: patientName,
        role: 'user'
      }
    ]);

    // 3. CREATE CALL INSTANCE
    const call = streamClient.video.call('default', callId);
    
    // 4. CREATE ON STREAM SERVERS
    await call.create({
      data: {
        created_by_id: professionalId,
        members: [
          { user_id: professionalId, role: 'host' },
          { user_id: patientId, role: 'attendee' }
        ],
        custom: {
          bookingId,
          professionalName,
          patientName,
          consultationType: 'video'
        }
      }
    });
    
    console.log('✅ Call created successfully:', callId);
    
    res.json({ 
      callId,
      success: true,
      message: 'Call created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CREATE CALL ERROR:', error);
    res.status(500).json({ 
      error: 'Failed to create call',
      details: error.message || String(error),
      code: error.code || null
    });
  }
});

// End call endpoint (optional)
app.post('/stream/end-call', async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'callId is required' });
    
    console.log('Ending call (soft):', callId);
    // Optional: await streamClient.video.call('default', callId).end();
    
    res.json({ success: true, message: 'Call end request processed' });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Failed to end call', details: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  Backend Server Running                           ║
║  Port: ${PORT}                                           ║
║  Stream Configured: ${!!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET) ? 'YES' : 'NO'}      ║
╚════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received: shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received: shutting down');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});