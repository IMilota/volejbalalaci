//načtení modulu express
const express = require("express");
const cors = require("cors");
const path = require("path");

// volejbalalaci
const eventController = require("./controller/volejbalalaci/event");
const userController = require("./controller/volejbalalaci/user");
const attendanceController = require("./controller/volejbalalaci/attendance");
const messageController = require("./controller/volejbalalaci/message");

//inicializace nového Express.js serveru
const app = express();
//definování portu, na kterém má aplikace běžet na localhostu
const port = process.env.PORT || 3111;

// Parsování body
app.use(express.json()); // podpora pro application/json
app.use(express.urlencoded({ extended: true })); // podpora pro application/x-www-form-urlencoded

app.use(cors());

app.get("/", (req, res) => {
  res.send("Volejbalalaci");
});

// volejbalaci
app.use("/api/volejbalalaci/event", eventController);
app.use("/api/volejbalalaci/user", userController);
app.use("/api/volejbalalaci/attendance", attendanceController);
app.use("/api/volejbalalaci/message", messageController);

//nastavení portu, na kterém má běžet HTTP server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
