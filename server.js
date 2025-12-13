// server.js - FINAL FIXED VERSION (DECEMBER 2025)
// Fixes:
// - Removed invalid 'role: "attendee"' (not a valid role for 'default' call type)
// - Removed unnecessary 'role: "host"' (no such built-in role; use 'admin' if needed)
// - Kept user upsert with 'admin' role for professional (optional but useful)
// - No explicit member roles → both users get full default permissions (perfect for 1:1 consultations)
// - Strict callId = bookingId (no prefixes) for perfect client-server match

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

// ✅ CREATE VIDEO CALL - FIXED ROLES & ID CONSISTENCY
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
    
    // Use exact bookingId as callId (no prefixes) for perfect match with client
    const callId = bookingId; 
    console.log(`Creating call: ${callId} [Prof: ${professionalId}, Patient: ${patientId}]`);

    // Upsert users to ensure they exist and optionally assign global roles
    // 'admin' role gives extra capabilities globally (useful for professional)
    await streamClient.upsertUsers([
      {
        id: professionalId,
        name: professionalName,
        role: 'admin'  // Optional: gives professional elevated permissions globally
      },
      {
        id: patientId,
        name: patientName
        // Default role 'user' is fine for patient
      }
    ]);

    // Create call instance
    const call = streamClient.video.call('default', callId);
    
    // Create the call on Stream servers
    await call.create({
      data: {
        created_by_id: professionalId,
        // No explicit member roles → both get full permissions by default (ideal for 1:1 video)
        members: [
          { user_id: professionalId },
          { user_id: patientId }
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

// End call endpoint (optional soft end)
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
  app.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received: shutting down');
  app.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});