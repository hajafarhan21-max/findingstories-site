export function parseUnitTypesTextarea(value) {
  let unitTypes;
  try {
    unitTypes = JSON.parse(String(value || '').trim() || '[]');
  } catch {
    throw new Error('Unit types JSON is invalid');
  }
  if (!Array.isArray(unitTypes)) throw new Error('Unit types JSON is invalid');
  return unitTypes;
}
