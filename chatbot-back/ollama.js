import express from "express";
import cors from "cors";
import { configDotenv } from "dotenv";
import ollama from 'ollama';

const port = 8000; // Changed to 8001 to avoid conflict with server.js
const app = express();
app.use(cors());
app.use(express.json());
configDotenv();

app.listen(port, () => {
  console.log(`Ollama Server is running on http://localhost:${port}`);
});

// Regular non-streaming endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    console.log("Message:", message);
    console.log("History:", history);

    // Convert history to Ollama format if it exists
    const messages = history ? 
      history.map(item => ({
        role: item.role,
        content: item.parts[0].text
      })) : [];
    
    // Add the current message
    messages.push({ role: 'user', content: message });

    const response = await ollama.chat({
      model: 'gemma3:4b',
      messages: messages,
    });

    console.log("Chat response:", response.message.content);
    res.json({ response: response.message.content });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({ error: "An error occurred while processing your request" });
  }
});

// New streaming endpoint
app.post("/chat/stream", async (req, res) => {
  try {
    const { message, history } = req.body;
    console.log("Streaming message:", message);
    
    // Set headers for server-sent events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Convert history to Ollama format if it exists
    const messages = history ? 
      history.map(item => ({
        role: item.role,
        content: item.parts[0].text
      })) : [];
    
    // Add the current message
    messages.push({ role: 'user', content: message });

    // Using Ollama's streaming API
    const response = await ollama.chat({
      model: 'gemma3:4b',
      messages: messages,
      stream: true
    });

    // Stream each part as it comes in
    for await (const part of response) {
      if (part.message?.content) {
        // Send the chunk to the client
        res.write(`data: ${JSON.stringify({ chunk: part.message.content })}\n\n`);
      }
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error in streaming endpoint:", error);
    res.write(`data: ${JSON.stringify({ error: "An error occurred during streaming" })}\n\n`);
    res.end();
  }
});

// Handle GET requests for streaming to support EventSource from frontend
app.get("/chat/stream", async (req, res) => {
  try {
    // Get parameters from query string
    const message = req.query.message;
    let history = [];
    
    try {
      // Try to parse history if it exists
      if(req.query.history) {
        history = JSON.parse(req.query.history);
      }
    } catch(e) {
      console.error("Error parsing history:", e);
    }
    
    console.log("GET Streaming message:", message);
    
    // Set headers for server-sent events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Convert history to Ollama format if it exists
    const messages = history ? 
      history.map(item => ({
        role: item.role,
        content: item.parts[0].text
      })) : [];
    
    // Add the current message
    messages.push({ role: 'user', content: message });

    // Using Ollama's streaming API
    const response = await ollama.chat({
      model: 'gemma3:4b',
      messages: messages,
      stream: true
    });

    // Stream each part as it comes in
    for await (const part of response) {
      if (part.message?.content) {
        // Send the chunk to the client
        res.write(`data: ${JSON.stringify({ chunk: part.message.content })}\n\n`);
      }
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error in GET streaming endpoint:", error);
    res.write(`data: ${JSON.stringify({ error: "An error occurred during streaming" })}\n\n`);
    res.end();
  }
});