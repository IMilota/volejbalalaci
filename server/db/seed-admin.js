const User = require("../models/user");

async function seedAdmin() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME;
  const nickname = process.env.SEED_ADMIN_NICKNAME;
  if (!email || !name || !nickname) {
    throw new Error(
      "SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, and SEED_ADMIN_NICKNAME are required when users is empty"
    );
  }

  await User.create({ email, name, nickname, role: "admin" });
}

module.exports = { seedAdmin };
