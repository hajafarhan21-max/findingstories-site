export const canDeleteLeads = role => role === 'SUPER_ADMIN';

export function selectedListedIds(selected, listedIds) {
  const listed = new Set(listedIds);
  return new Set([...selected].filter(id => listed.has(id)));
}

export function toggleAllListed(selected, listedIds, checked) {
  const next = new Set(selected);
  for (const id of listedIds) checked ? next.add(id) : next.delete(id);
  return next;
}
