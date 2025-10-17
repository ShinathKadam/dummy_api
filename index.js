import express from "express";
import axios from "axios";
import WebSocket from "ws";
import fs from "fs";

const app = express();
app.use(express.json());

app.post("/send-logs", async (req, res) => {
  try {
    const { logs: userLogs } = req.body; // Logs sent from Postman
    if (!Array.isArray(userLogs) || userLogs.length === 0) {
      return res.status(400).json({ success: false, error: "Provide an array of logs in request body" });
    }

    //Create a session
    const connectResponse = await axios.post("http://127.0.0.1:8000/api/projects/connect", {
      api_key: "sk-*******ttoA", // Replace with your actual API key
      project_id: "demo_project",
      customer_id: "demo_customer",
      stream_mode: "realtime",
      window_config: { duration_seconds: 10, max_buffer_size: 5, critical_threshold: 0.9 },
    });

    const session = connectResponse.data;
    console.log("Session created:", session);

    const websocketUrl = session.websocket_url.replace("wss://opscure.io", "ws://127.0.0.1:8000");
    console.log("Connecting to:", websocketUrl);

    const ws = new WebSocket(websocketUrl);
    const sentLogs = [];
    let aiResponses = [];
    let finalized = false;
    let aiTimer = null;

    async function finalizeAIResponses() {
      if (finalized) return;
      finalized = true;

      console.log("Finalizing AI responses...");
      fs.writeFileSync("raw_ai_responses.json", JSON.stringify(aiResponses, null, 2));
      console.log("All AI messages saved to raw_ai_responses.json");

      if (ws.readyState === WebSocket.OPEN) ws.close();
      res.json({ success: true, ai_responses: aiResponses, sent_logs: sentLogs });
    }

    function startAiTimeout() {
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = setTimeout(finalizeAIResponses, 20000); // 20 seconds timeout
    }

    ws.on("open", async () => {
      console.log("WebSocket connected!");

      // Send each log via WebSocket
      userLogs.forEach(log => {
        sentLogs.push(log);
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(log));
      });

      try {
        const response = await axios.post("http://127.0.0.1:8000/api/logs/send", {
          session_id: session.session_id,
          logs: userLogs,
          final_batch: true,
        });

        console.log("Logs sent via POST. Full response:", response.data);

        if (response.data.final_response?.ai_response) {
          aiResponses.push(response.data.final_response.ai_response);
        }

        if (Array.isArray(response.data.responses)) {
          response.data.responses.forEach(r => {
            if (r.type === "ai_response") aiResponses.push(r.data);
          });
        }

        startAiTimeout();
      } catch (err) {
        console.error("Failed to send logs via POST:", err.response?.data || err.message);
        startAiTimeout();
      }
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ai_response") {
          aiResponses.push(msg.data);
          startAiTimeout(); // reset timeout
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err.message);
      }
    });

    ws.on("close", () => console.log("🔌 WebSocket closed."));
    ws.on("error", (err) => console.error("WebSocket error:", err));

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
