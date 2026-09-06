const count = value => Number(value || 0);
export function campaignMetrics(row={}) {
  const actual={leads:count(row.leads),qualified_leads:count(row.qualified_leads),meetings:count(row.meetings),site_visits:count(row.site_visits),eois:count(row.eois),bookings:count(row.bookings),revenue:count(row.revenue)};
  const target={leads:count(row.target_leads),qualified_leads:count(row.target_qualified_leads),meetings:count(row.target_meetings),site_visits:count(row.target_site_visits),eois:count(row.target_eois),bookings:count(row.target_bookings),revenue:count(row.target_revenue)};
  const conversion={leads:actual.leads?100:0,qualified_leads:actual.leads?actual.qualified_leads*100/actual.leads:0,meetings:actual.qualified_leads?actual.meetings*100/actual.qualified_leads:0,site_visits:actual.meetings?actual.site_visits*100/actual.meetings:0,eois:actual.site_visits?actual.eois*100/actual.site_visits:0,bookings:actual.eois?actual.bookings*100/actual.eois:0,revenue:target.revenue?actual.revenue*100/target.revenue:0};
  return {actual,target,conversion,eoi_command:{target:target.eois,completed:actual.eois,pending:count(row.eois_pending),conversion_percent:actual.leads?actual.eois*100/actual.leads:0,remaining:Math.max(0,target.eois-actual.eois)}};
}
