import { binghattiAmberhallInventory } from './binghatti-inventory.js';

export const BINGHATTI_ACTIVATION = 'binghatti-amberhall-2026-08-26';

export async function binghattiActivationStatus(sql) {
  await sql`CREATE TABLE IF NOT EXISTS production_activations (activation_key TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const marker = await sql`SELECT completed_at FROM production_activations WHERE activation_key=${BINGHATTI_ACTIVATION}`;
  const records = await sql`SELECT unit,developer,project,area,property_type,bedrooms,status,data_quality,is_test FROM property_inventory WHERE unit IN ('BAMH-1545','BAMH-634') ORDER BY unit`;
  const expected = new Map(binghattiAmberhallInventory.map(item => [item.unit, item]));
  const verified = records.length === expected.size && records.every(record => {
    const item = expected.get(record.unit);
    return item && record.developer === item.developer && record.project === item.project && record.area === item.area &&
      record.property_type === item.property_type && record.bedrooms === item.bedrooms && record.status === 'active' &&
      record.data_quality === 'verified' && record.is_test === false;
  });
  return { activated: marker.length === 1, verified, records };
}

export async function activateBinghattiInventory(sql) {
  const before = await binghattiActivationStatus(sql);
  if (before.activated) return { ...before, already_activated: true };
  for (const item of binghattiAmberhallInventory) {
    await sql`INSERT INTO property_inventory (unit,developer,project,emirate,area,property_type,bedrooms,minimum_price,maximum_price,minimum_size,maximum_size,price_per_sqft,handover,payment_plan_summary,construction_status,suitability,status,source,data_quality,last_updated,is_test)
      VALUES (${item.unit},${item.developer},${item.project},${item.emirate},${item.area},${item.property_type},${item.bedrooms},${item.minimum_price},${item.maximum_price},${item.minimum_size},${item.maximum_size},${item.price_per_sqft},${item.handover},${item.payment_plan_summary},${item.construction_status},${item.suitability},${item.status},${item.source},${item.data_quality},${item.last_updated},FALSE)
      ON CONFLICT (unit) WHERE unit IS NOT NULL DO UPDATE SET developer=EXCLUDED.developer,project=EXCLUDED.project,emirate=EXCLUDED.emirate,area=EXCLUDED.area,property_type=EXCLUDED.property_type,bedrooms=EXCLUDED.bedrooms,minimum_price=EXCLUDED.minimum_price,maximum_price=EXCLUDED.maximum_price,minimum_size=EXCLUDED.minimum_size,maximum_size=EXCLUDED.maximum_size,price_per_sqft=EXCLUDED.price_per_sqft,handover=EXCLUDED.handover,payment_plan_summary=EXCLUDED.payment_plan_summary,construction_status=EXCLUDED.construction_status,suitability=EXCLUDED.suitability,status=EXCLUDED.status,source=EXCLUDED.source,data_quality=EXCLUDED.data_quality,last_updated=EXCLUDED.last_updated,is_test=FALSE,updated_at=NOW()`;
  }
  const after = await binghattiActivationStatus(sql);
  if (!after.verified) throw new Error('Binghatti inventory verification failed.');
  await sql`INSERT INTO production_activations (activation_key) VALUES (${BINGHATTI_ACTIVATION}) ON CONFLICT DO NOTHING`;
  return { ...after, activated: true, already_activated: false };
}
