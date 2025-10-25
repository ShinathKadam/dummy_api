import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());
const PORT = 3000;

// Hardcoded logs
const logs = [
  "2025-10-25 11:15:22 INFO Server started on port 8000",
  "2025-10-25 11:16:04 WARNING API response time exceeded 2s threshold",
  "2025-10-25 11:16:45 ERROR Failed to fetch user profile from database",
  "2025-10-25 11:17:10 INFO New client connected: 192.168.1.25",
];

app.get("/send-logs", async (req, res) => {
  try {
    // Send logs to FastAPI AI/ML server
    const response = await axios.post("http://127.0.0.1:8000/send-logs", {
      logs: logs.join("\n"),
    });

    // Send AI/ML server response back to client
    res.json({
      status: "success",
      ai_response: response.data,
    });
  } catch (error) {
    console.error("Error sending logs:", error.message);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Node.js Log Sender API is running.");
});

app.listen(PORT, () => {
  console.log(`Node.js API running on http://localhost:${PORT}`);
});
