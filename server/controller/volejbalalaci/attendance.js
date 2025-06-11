const express = require("express");
const router = express.Router();

const UpdateAbl = require("../../abl/volejbalalaci/attendance/updateAbl");

router.post("/update", (req, res) => {
  UpdateAbl(req, res);
});

module.exports = router;
