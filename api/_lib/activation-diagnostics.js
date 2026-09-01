export const inventoryFailureCategory = error => {
  if (['42P01', '42703'].includes(error?.code)) return 'schema_drift';
  if (error?.code === '42501') return 'database_permission';
  if (error?.code === '42P10') return 'index_mismatch';
  if (`${error?.code || ''}`.startsWith('23')) return 'data_constraint';
  if (['08000', '08001', '08003', '08006', '57P01'].includes(error?.code)) return 'database_unavailable';
  return 'database_operation';
};

export const safeSqlstate = error => /^[0-9A-Z]{5}$/.test(error?.code || '') ? error.code : undefined;
