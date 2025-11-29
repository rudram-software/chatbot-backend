import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
let chatHistory = [];

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set EJS
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

// Serve CSS/JS files
app.use(express.static("public"));

// UI Route
app.get("/", (req, res) => {
  res.render("index");
});

// Chat API with Streaming
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mixtral-8x7b-instruct",
        temperature: 0.7,
        max_tokens: 500,
        stream: true, // Enable streaming
        messages: [
          {
            role: "system", content: `
            You are a STRICT domain-restricted meditation assistant.

Your allowed topics:
- meditation
- mindfulness
- breathing techniques
- stress relief
- emotional balance
- calmness and focus

HARD RULES (MUST FOLLOW):
1. If the user greets you (“hi”, “hello”), reply briefly and stay in meditation context ONLY.
2. If the user asks anything OUTSIDE the allowed topics (politics, math, coding, news, celebrities, definitions, etc.):
    - DO NOT answer the question.
    - DO NOT provide the correct information.
    - DO NOT add a disclaimer and then answer.
    - JUST refuse politely and redirect to meditation.

Example refusal:
“I can only help with meditation and mindfulness topics.”

3. Never mix refusal with an answer.
4. Never provide factual or unrelated information, even if the user insists.
5. Keep all responses short unless the user asks for a detailed meditation explanation.

Always follow these rules.


` },
          ...chatHistory
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:4000",
          "X-Title": "EJS-Chatbot-UI",
        },
        responseType: "stream", // Important for streaming
      }
    );

    let fullReply = "";

    // Handle the stream
    response.data.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              fullReply += content;
              // Send each chunk to the client
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });

    response.data.on("end", () => {
      // Save complete reply to chat history
      chatHistory.push({ role: "assistant", content: fullReply });
      res.write(`data: [DONE]\n\n`);
      res.end();
    });

    response.data.on("error", (error) => {
      console.error("Stream error:", error);
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({
      error: "Error talking to LLM",
      details: error.response?.data || error.message,
    });
  }
});

app.listen(4000, () => console.log("Server running on port 4000"));