const express = require('express');
const { StreamClient } = require('@stream-io/node-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const streamClient = new StreamClient(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

app.post('/stream/token', async (req, res) => {

  console.log("---- NEW REQUEST ----");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);


  if (!req.body || !req.body.userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const { userId, userName } = req.body;
  const token = streamClient.createToken(userId);
  res.json({ token });
});

app.post('/stream/create-call', async (req, res) => {
  const { bookingId, professionalId, patientId } = req.body;
  const callId = `consultation_${bookingId}`;
  
  const call = streamClient.video.call('video', callId);
  await call.create({
    data: {
      members: [
        { user_id: professionalId },
        { user_id: patientId }
      ]
    }
  });
  
  res.json({ callId });
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