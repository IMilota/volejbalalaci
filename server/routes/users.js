const express = require("express");
const mongoose = require("mongoose");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const User = require("../models/user");

const router = express.Router();
const USER_PATCH_FIELDS = ["name", "nickname", "email", "role"];

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ nickname: 1 });
    res.json(users.map((user) => user.toJSON()));
  })
);

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, nickname, email, role } = req.body || {};
    const user = await User.create({ name, nickname, email, role });
    res.json(user.toJSON());
  })
);

router.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 404, "userNotFound", "user not found");
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 404, "userNotFound", "user not found");
    }
    const body = req.body || {};
    if (body.role !== undefined && body.role !== user.role && user.role === "admin" && body.role !== "admin") {
      const remainingAdmins = await User.countDocuments({ role: "admin", _id: { $ne: user._id } });
      if (remainingAdmins === 0) {
        return sendError(res, 409, "lastAdmin", "cannot demote the last admin");
      }
    }
    for (const field of USER_PATCH_FIELDS) {
      if (body[field] !== undefined) {
        user[field] = body[field];
      }
    }
    await user.save();
    res.json(user.toJSON());
  })
);

module.exports = router;
