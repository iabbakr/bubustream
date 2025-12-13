// server.js - FINAL WORKING VERSION (DEC 2025)
// Fixes: created_by_id, correct call type, and user upsert (array format for latest SDK)

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
    
    console.log('Generating token for user:', userId);
    
    const token = streamClient.createToken(userId);
    
    console.log('Token generated successfully');
    res.json({ token });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    });
  }
});

// Create video call - FULLY FIXED FOR LATEST SDK
app.post('/stream/create-call', async (req, res) => {
  try {
    const { 
      bookingId, 
      professionalId, 
      patientId, 
      professionalName = 'Professional',
      patientName = 'Patient'
    } = req.body;
    
    console.log('Received create-call request:', {
      bookingId,
      professionalId,
      patientId,
      professionalName,
      patientName
    });
    
    // Validate required fields
    if (!bookingId || !professionalId || !patientId) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['bookingId', 'professionalId', 'patientId']
      });
    }
    
    const callId = `consultation_${bookingId}`;
    console.log(`Creating call: ${callId} for Prof: ${professionalId} and Patient: ${patientId}`);
    //console.log('Creating call with ID:', callId);

    // CRITICAL FIX: upsertUsers now requires an ARRAY of user objects (latest SDK)
    console.log('Upserting users on Stream...');
    await streamClient.upsertUsers([
      {
        id: professionalId,
        name: professionalName,
        role: 'admin'  // Optional: gives extra permissions in calls
      },
      {
        id: patientId,
        name: patientName,
        role: 'user'
      }
    ]);
    console.log('Users upserted successfully');

    // Now create the call
    const call = streamClient.video.call('default', callId);
    
    await call.create({
      data: {
        created_by_id: professionalId, // Only professional creates it
        members: [
          { user_id: professionalId, role: 'host' },
          { user_id: patientId, role: 'attendee' }
        ],
        custom: {
          bookingId: bookingId,
          patientName: patientName,
          professionalName: professionalName
        }
      }
    });
    
    console.log('Call created successfully:', callId);
    
    res.json({ 
      callId,
      success: true,
      message: 'Call created and users registered successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CREATE CALL ERROR:', error);
    console.error('Full error:', error);
    
    res.status(500).json({ 
      error: 'Failed to create call',
      details: error.message || String(error),
      code: error.code || null,
      timestamp: new Date().toISOString()
    });
  }
});

// End call endpoint (optional)
app.post('/stream/end-call', async (req, res) => {
  try {
    const { callId } = req.body;
    
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }
    
    console.log('Ending call (soft):', callId);
    
    // Optional: Force end on Stream side
    // const call = streamClient.video.call('default', callId);
    // await call.end();
    
    res.json({ 
      success: true,
      message: 'Call end request processed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ 
      error: 'Failed to end call',
      details: error.message 
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  Backend Server Running                           ║
║  Port: ${PORT}                                           ║
║  Environment: ${process.env.NODE_ENV || 'development'}             ║
║  Stream Configured: ${!!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET) ? 'YES' : 'NO'}      ║
╚════════════════════════════════════════════════════╝
  `);
  
  if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
    console.warn(`
WARNING: Stream API credentials missing!
    Set STREAM_API_KEY and STREAM_API_SECRET in environment variables.
    `);
  }
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