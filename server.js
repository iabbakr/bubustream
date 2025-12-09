// server.js - FIXED VERSION WITH created_by_id AND CORRECT CALL TYPE
const express = require('express');
const { StreamClient } = require('@stream-io/node-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Stream client with API key and secret from environment variables
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

// Generate user token
app.post('/stream/token', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    console.log('🔑 Generating token for user:', userId);
    
    const token = streamClient.createToken(userId);
    
    console.log('✅ Token generated successfully');
    res.json({ token });
    
  } catch (error) {
    console.error('❌ Token generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    });
  }
});

// Create video call - FIXED VERSION
app.post('/stream/create-call', async (req, res) => {
  try {
    const { 
      bookingId, 
      professionalId, 
      patientId, 
      professionalName, 
      patientName 
    } = req.body;
    
    console.log('📞 Received create-call request:', {
      bookingId,
      professionalId,
      patientId,
      professionalName,
      patientName
    });
    
    // Validate required fields
    if (!bookingId || !professionalId || !patientId) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['bookingId', 'professionalId', 'patientId']
      });
    }
    
    // Create call ID based on booking
    const callId = `consultation_${bookingId}`;
    console.log('🎬 Creating call with ID:', callId);
    
    // ✅ FIX: Use 'default' call type instead of 'video'
    // The 'video' call type doesn't exist in your Stream account
    // Available types: audio_room, default, development, livestream
    const call = streamClient.video.call('default', callId);
    
    // ✅ FIX: Add created_by_id to specify who is creating the call
    // This is REQUIRED when using server-side authentication
    await call.create({
      data: {
        // CRITICAL: Specify who is creating the call (usually the professional)
        created_by_id: professionalId,
        
        // Add both users as members
        members: [
          { user_id: professionalId },
          { user_id: patientId }
        ],
        
        // Optional: Add custom data
        custom: {
          bookingId: bookingId,
          professionalName: professionalName,
          patientName: patientName,
          consultationType: 'video'
        }
      }
    });
    
    console.log('✅ Call created successfully:', callId);
    
    res.json({ 
      callId,
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CREATE CALL ERROR:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    res.status(500).json({ 
      error: 'Failed to create call',
      details: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// End call endpoint
app.post('/stream/end-call', async (req, res) => {
  try {
    const { callId } = req.body;
    
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }
    
    console.log('📴 Ending call:', callId);
    
    // Optional: You can add logic here to end the call on Stream's side
    // const call = streamClient.video.call('default', callId);
    // await call.end();
    
    res.json({ 
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ End call error:', error);
    res.status(500).json({ 
      error: 'Failed to end call',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  🚀 Backend Server Running                        ║
║  📍 Port: ${PORT}                                  ║
║  🔧 Environment: ${process.env.NODE_ENV || 'development'}               ║
║  ✅ Stream API configured: ${!!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET) ? 'Yes' : 'No'}      ║
╚════════════════════════════════════════════════════╝
  `);
  
  // Validate environment variables
  if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
    console.warn(`
⚠️  WARNING: Stream API credentials not configured!
    Please set STREAM_API_KEY and STREAM_API_SECRET environment variables.
    `);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
});







