const express = require('express');
const { StreamClient } = require('@stream-io/node-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Ensure these environment variables are set on Render and in your local .env
const streamClient = new StreamClient(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

app.post('/stream/token', async (req, res) => {
  if (!req.body || !req.body.userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const { userId, userName } = req.body;
  const token = streamClient.createToken(userId);
  res.json({ token });
});

app.post('/stream/create-call', async (req, res) => {
  try {
    console.log('📞 Received create-call request:', req.body);
    
    // We receive professionalId and patientId from the client
    const { bookingId, professionalId, patientId } = req.body;
    
    if (!bookingId || !professionalId || !patientId) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ error: "All fields are required" });
    }

    console.log('🔧 Creating Stream call...');
    const callId = `consultation_${bookingId}`;
    
    if (!streamClient) {
      console.error('❌ Stream client not initialized!');
      return res.status(500).json({ error: 'Stream client not configured' });
    }
    
    console.log('📹 Calling Stream API for callId:', callId);
    const call = streamClient.video.call('video', callId);

    // **********************************************
    // 💡 FIX APPLIED HERE: Add created_by_user_id
    // **********************************************
    await call.create({
      data: {
        // REQUIRED FOR SERVER-SIDE AUTH
        created_by_user_id: professionalId, 
        members: [
          { user_id: professionalId },
          { user_id: patientId }
        ],
      },
    });

    console.log('✅ Call created successfully:', callId);
    res.json({ callId, success: true });
    
  } catch (err) {
    console.error('❌ CREATE CALL ERROR:', err);
    console.error('Error message:', err.message);
    
    res.status(500).json({ 
      error: "Failed to create call",
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});


app.post('/stream/end-call', async (req, res) => {
  const { callId } = req.body;
  console.log(`Call ${callId} ended`);
  res.json({ success: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});