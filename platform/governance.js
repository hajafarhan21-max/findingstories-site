export const SOURCE_TYPES=Object.freeze(['OFFICIAL','GOVERNMENT','DEVELOPER_DOCUMENT','PORTAL_REFERENCE','MANUAL','UNVERIFIED']);
export function commercialField(value,{source,verifiedAt,recheckAfter,status='VERIFIED'}={}){return {value:value??null,source:source??null,verified_at:verifiedAt??null,recheck_after:recheckAfter??null,status};}
export function mayAdvertiseAvailability(project){return project.currentAvailability==='CURRENT_AVAILABILITY_VERIFIED'&&project.verification?.status==='PUBLISHED_INFORMATION'&&!project.verification?.stale;}
export function sourceCandidate(url,type='PORTAL_REFERENCE'){return {url,type,mode:type==='PORTAL_REFERENCE'?'HUMAN_REVIEW':'CONTROLLED_INGESTION',copyPermitted:false};}
