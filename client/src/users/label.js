export function attendeeLabel(user, id) {
  const nickname = typeof user?.nickname === "string" ? user.nickname.trim() : "";
  if (nickname) {
    return nickname;
  }
  const name = typeof user?.name === "string" ? user.name.trim() : "";
  if (name) {
    return name;
  }
  return String(id || "").slice(0, 8);
}
