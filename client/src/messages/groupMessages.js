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
