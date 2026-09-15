/** The only lifecycle used by the public project inventory. */
export const PROJECT_LIFECYCLE=Object.freeze(['DRAFT','RESEARCHED','VERIFIED','APPROVED','PUBLISHED','ARCHIVED']);
export const PUBLICATION_READY_STATES=Object.freeze(['VERIFIED','APPROVED','PUBLISHED']);

export function publicationDecision(record){
  const governance=record?.platform?.governance;
  if(!governance)return {public:false,reason:'MISSING_GOVERNANCE'};
  if(!PROJECT_LIFECYCLE.includes(governance.publish_state))return {public:false,reason:'INVALID_LIFECYCLE_STATE'};
  if(!PUBLICATION_READY_STATES.includes(governance.verification_status))return {public:false,reason:'NOT_VERIFIED'};
  if(governance.publish_state!=='PUBLISHED')return {public:false,reason:'NOT_PUBLISHED'};
  if(governance.data_confidence!=='verified'||!governance.source_references?.length)return {public:false,reason:'MISSING_SOURCE_VERIFICATION'};
  return {public:true,reason:'PUBLISHED'};
}

export function assertPublishable(record){
  const decision=publicationDecision(record);
  if(!decision.public)throw new Error(`Project ${record?.project?.slug||'unknown'} is not publishable: ${decision.reason}`);
  return record;
}
