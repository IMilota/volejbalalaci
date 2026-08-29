const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    featureRides: process.env.FEATURE_RIDES === "true",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    instanceName: process.env.INSTANCE_NAME || undefined,
    instanceIcon: process.env.INSTANCE_ICON || undefined,
    instanceColorScheme: process.env.INSTANCE_COLOR_SCHEME || undefined,
  });
});

module.exports = router;
