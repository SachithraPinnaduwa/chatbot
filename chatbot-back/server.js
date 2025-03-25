import express from "express";
import cors from "cors";
import { configDotenv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
const port = 8000;
const app = express();
app.use(cors());
app.use(express.json());
configDotenv();

const API_KEY = process.env.API_KEY;


const ai = new GoogleGenAI({ apiKey: API_KEY });

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Regular non-streaming endpoint
app.post("/chat", async (req, res) => {
  const { message, history } = req.body;
  console.log("Message:", message);
  console.log("History:", history);

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: history,
  });

  const response = await chat.sendMessage({
    message: message,
  });
  const ressend = response.text;
  console.log("Chat response:", ressend);
  res.json({ response: ressend });
});

// New streaming endpoint using the generateContentStream method
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

    // Create chat instance with history
    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      history: history,
    });

    try {
      // Send message with streaming enabled
      const streamingResponse = await chat.sendMessageStream({
        message: message,
      });

      // Process the chunks from the streaming response
      for await (const chunk of streamingResponse) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ chunk: chunk.text })}\n\n`);
        }
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      // Fallback to non-streaming if streaming fails
      const response = await chat.sendMessage({
        message: message,
      });
      res.write(`data: ${JSON.stringify({ chunk: response.text })}\n\n`);
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

    // Create chat instance with history
    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      history: history,
    });

    try {
      // Use the sendMessageStream method for streaming in newer versions of the API
      const streamingResponse = await chat.sendMessageStream({
        message: message,
      });

      // Process the chunks from the streaming response
      for await (const chunk of streamingResponse) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ chunk: chunk.text })}\n\n`);
        }
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      // Fallback to non-streaming if streaming fails
      const response = await chat.sendMessage({
        message: message,
      });
      res.write(`data: ${JSON.stringify({ chunk: response.text })}\n\n`);
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