import OpenAI from 'openai';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
app.use(cors()); // Allow cross-origin requests
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Enable parsing form data

app.post('/chat', async (req, res) => {
  const { userMessage, threadId } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: "userMessage is required" });
  }

  res.setHeader('Content-Type', 'text/event-stream'); // Enable streaming
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Step 1: Re-use existing thread if provided, otherwise create a new one
    let thread;
    if (threadId) {
      thread = { id: threadId }; // Use existing thread
    } else {
      thread = await openai.beta.threads.create();
    }

    // Step 2: Send a message to the assistant within the existing or new thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
    });

    // Step 3: Run the assistant on the thread with streaming enabled
    const runStream = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      stream: true,
    });

    // Step 4: Stream response to client
    for await (const part of runStream) {
      const text = part.data?.delta?.content[0]?.text?.value || '';
      res.write(`data: ${JSON.stringify({ text, threadId: thread.id })}\n\n`); // Send thread ID
    }

    res.end();
  } catch (error) {
    console.error("Error communicating with the assistant:", error);
    res.write(`data: ${JSON.stringify({ error: "Error processing request" })}\n\n`);
    res.end();
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});