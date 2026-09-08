export function groupMessages(flat) {
  const roots = [];
  const repliesByParent = {};
  for (const item of flat) {
    if (!item.replyToId) {
      roots.push(item);
    } else {
      const parentId = item.replyToId;
      if (!repliesByParent[parentId]) {
        repliesByParent[parentId] = [];
      }
      repliesByParent[parentId].push(item);
    }
  }
  return { roots, repliesByParent };
}

export function toChatItems(flat) {
  const byId = new Map((Array.isArray(flat) ? flat : []).map((item) => [item.id, item]));
  return [...byId.values()]
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .map((message) => ({
      message,
      parent: message.replyToId ? byId.get(message.replyToId) || null : null,
    }));
}
