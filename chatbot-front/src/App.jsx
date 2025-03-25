import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import axios from "axios";
import ReactMarkdown from 'react-markdown';

function App() {
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [modelType, setModelType] = useState("google"); // "google" or "ollama"
  
  const randomOptions = [
    "What is the capital of France?",
    "How does photosynthesis work?",
    "What is the meaning of life?",
    "Can you explain quantum mechanics?",
  ];

  const randomQuestion = () => {
    const randomIndex = Math.floor(Math.random() * randomOptions.length);
    setValue(randomOptions[randomIndex]);
  }

  // Get the API endpoint based on selected model
  const getApiEndpoint = (isStreamingRequest = false) => {
    const baseUrl = modelType === "google" ? "http://localhost:8000" : "http://localhost:8000"; // Fixed port for ollama
    return isStreamingRequest ? `${baseUrl}/chat/stream` : `${baseUrl}/chat`;
  };

  // Regular non-streaming response
  const getResponse = async () => {
    if (!value) {
      setErr("Please enter a question");
      return;
    }
    setErr("");
    try {
      const response = await axios.post(getApiEndpoint(), {
        message: value,
        history: chatHistory
      }, {
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = response.data.response;
      console.log(data);
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { role: "user", parts: [{ text: value }] },
        { role: "model", parts: [{ text: data }] },
      ]);
      setValue("");
    } catch (error) {
      console.error("Error fetching data:", error);
      setErr("An error occurred while fetching data.");
    }
  }

  // Streaming response function
  const getStreamingResponse = async () => {
    if (!value) {
      setErr("Please enter a question");
      return;
    }
    setErr("");
    setIsStreaming(true);
    
    // Add user message to chat history immediately
    setChatHistory((prevHistory) => [
      ...prevHistory,
      { role: "user", parts: [{ text: value }] }
    ]);
    
    // Initialize streaming response
    setStreamingResponse("");
    
    try {
      // Create EventSource for server-sent events
      const streamUrl = getApiEndpoint(true);
      const eventSource = new EventSource(`${streamUrl}?${new URLSearchParams({
        message: value,
        history: JSON.stringify(chatHistory)
      })}`);
      
      let fullResponseText = '';
      
      // Handle incoming message chunks
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.chunk) {
          fullResponseText += data.chunk;
          setStreamingResponse(fullResponseText);
        }
        
        if (data.done) {
          // When streaming is complete, add the full response to chat history
          // Use a callback to ensure we have the latest state
          setChatHistory(prevHistory => [
            ...prevHistory,
            { role: "model", parts: [{ text: fullResponseText }] }
          ]);
          
          // Only clear streaming state AFTER a short delay to ensure the chat history update is rendered
          setTimeout(() => {
            setIsStreaming(false);
            setStreamingResponse("");
          }, 100);
          
          eventSource.close();
        }
        
        if (data.error) {
          console.error('Error from streaming API:', data.error);
          setErr("An error occurred while streaming response.");
          setIsStreaming(false);
          eventSource.close();
        }
      };
      
      // Handle connection errors
      eventSource.onerror = () => {
        console.error('EventSource connection failed');
        setErr("Connection to streaming API failed.");
        setIsStreaming(false);
        eventSource.close();
      };
      
      setValue("");
    } catch (error) {
      console.error("Error setting up streaming:", error);
      setErr("Failed to set up streaming connection.");
      setIsStreaming(false);
    }
  }

  const clearHistory = () => {
    setChatHistory([]);
    setValue("");
    setErr("");
    setStreamingResponse("");
    setIsStreaming(false);
  }

  return (
    <div className="app">
      <h1 className="app-title">AI Chat Assistant</h1>
      
      <div className="model-selector">
        <label>
          <input 
            type="radio" 
            value="google" 
            checked={modelType === "google"} 
            onChange={() => setModelType("google")}
            disabled={isStreaming}
          />
          Google Gemini
        </label>
        <label>
          <input 
            type="radio" 
            value="ollama" 
            checked={modelType === "ollama"} 
            onChange={() => setModelType("ollama")}
            disabled={isStreaming}
          />
          Ollama
        </label>
      </div>
      
      <div className="chat-container">
        <div className="search-result">
          {chatHistory.map((item, index) => (
            <div key={index} className={`message-container ${item.role}-message`}>
              <div className="message-header">
                {item.role === "user" ? "You" : "AI Assistant"}:
              </div>
              <div className="message-content">
                {item.role === "model" ? (
                  item.parts && item.parts.map((part, partIndex) => (
                    <ReactMarkdown key={partIndex}>{part.text}</ReactMarkdown>
                  ))
                ) : (
                  item.parts && item.parts.map((part, partIndex) => (
                    <span key={partIndex}>{part.text}</span>
                  ))
                )}
              </div>
            </div>
          ))}
          
          {/* Display streaming response while it's being generated */}
          {isStreaming && streamingResponse && (
            <div className="message-container model-message">
              <div className="message-header">AI Assistant:</div>
              <div className="message-content">
                <ReactMarkdown>{streamingResponse}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="input-section">
        <p className="input-label">
          What do you want to know
          <button className="auto-generate" onClick={randomQuestion} disabled={isStreaming}>Create a random question</button>
        </p>
        <div className="input-container">
          <input
            type="text"
            className="input"
            placeholder="Type your question here..."
            onChange={(e) => {
              setValue(e.target.value);
              setErr("");
            }}
            value={value}
            onFocus={() => {
              setValue("");
            }}
            disabled={isStreaming}
          />
          {!err && !isStreaming && (
            <>
              <button className="submit-button" onClick={getResponse}>Submit</button>
              <button className="stream-button" onClick={getStreamingResponse}>Stream</button>
            </>
          )}
          {(err || chatHistory.length != 0) && <button onClick={clearHistory} disabled={isStreaming}>Clear</button>}
        </div>
        {err && <p className="error">{err}</p>}
        
        {isStreaming && (
          <div className="streaming-indicator">
            <span>Streaming from {modelType === "google" ? "Google Gemini" : "Ollama"}...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
