/**
 * Governed, reusable project publishing primitives.
 *
 * Unknown commercial values remain null. A branded composition is a visual
 * fallback, never project photography. Media may only render when provenance
 * and an explicit usage approval travel with the asset.
 */
export const PROJECT_QUALITY_STATES=Object.freeze(['internal','draft','research-ready','public-ready']);

const palettes=Object.freeze({
  'terra-gardens':['#6d765f','#d7c8a7','botanical'],
  'chelsea-residences':['#173b55','#b9d8e5','maritime'],
  'the-serene-sobha-central':['#756d62','#ddd3c4','quiet-urban'],
  'sparklz-by-danube':['#56416d','#d5bfe5','expressive'],
  'w-residences-dubai-harbour':['#22252d','#d0b38a','editorial-dark'],
  'yas-riva':['#214d55','#c8d9d4','waterside'],
  'mar-casa':['#315d6b','#d6c5a5','coastal'],
  olfah:['#65745e','#d9cdb0','landscape']
});

export function projectTheme(slug){
  const [accent,soft,mood]=palettes[slug]??['#695f51','#d9c9aa','considered'];
  return Object.freeze({accent,soft,mood,sectionBalance:'alternating',typographyEmphasis:'editorial',galleryTreatment:'contained'});
}

export function approvedMedia(media=[]){
  return media.filter(item=>item?.sourceUrl&&item?.sourceType&&(item?.retrievedAt||item?.reviewedAt)&&item?.projectSlug&&item?.usageState==='APPROVED'&&item?.verificationState==='VERIFIED');
}

export function mediaByRole(media=[]){
  const roles={hero:null,exteriors:[],interiors:[],amenities:[],lifestyle:[],masterplan:[],floorPlans:[],locationMap:null};
  for(const item of approvedMedia(media)){
    if(item.kind==='hero')roles.hero=item;
    else if(item.kind==='exterior')roles.exteriors.push(item);
    else if(item.kind==='interior')roles.interiors.push(item);
    else if(item.kind==='amenity')roles.amenities.push(item);
    else if(item.kind==='lifestyle')roles.lifestyle.push(item);
    else if(item.kind==='masterplan')roles.masterplan.push(item);
    else if(item.kind==='floor-plan')roles.floorPlans.push(item);
    else if(item.kind==='location-map')roles.locationMap=item;
  }
  return Object.freeze(roles);
}

export function projectPublicationDecision(project){
  const required=[project?.slug,project?.name,project?.developer,project?.area,project?.emirate,project?.summary,project?.propertyTypes?.length,project?.governance?.sources?.[0]?.url,project?.conversion?.enquiryContext];
  if(project?.qualityState!=='public-ready')return {public:false,reason:'NOT_PUBLIC_READY'};
  if(required.some(value=>!value))return {public:false,reason:'MINIMUM_CONTENT_MISSING'};
  if(!approvedMedia(project.media).length&&project.visualFallback!=='BRANDED')return {public:false,reason:'VISUAL_NOT_GOVERNED'};
  if(project.startingPrice!==null||project.handover!==null||project.paymentPlan!==null)return {public:false,reason:'UNVERIFIED_COMMERCIAL_VALUE'};
  return {public:true,reason:'PUBLIC_READY'};
}

export function enrichProject(project){
  const media=project.media??(project.image?[{id:`${project.slug}-hero`,kind:'hero',path:project.image,alt:project.imageAlt,sourceUrl:project.verification?.source?.url??project.source?.url,sourceType:project.verification?.source?.type??'OFFICIAL_PROJECT_MATERIAL',reviewedAt:project.verification?.lastReviewed??project.source?.retrieved,projectSlug:project.slug,usageState:'APPROVED',verificationState:'VERIFIED'}]:[]);
  const structuredMedia=mediaByRole(media);
  const units=project.units??project.bedrooms.map(bedrooms=>({name:`${bedrooms} bedroom`,bedrooms,bathrooms:null,size:null,balcony:null,floorPlans:structuredMedia.floorPlans.filter(plan=>plan.unitType===bedrooms)}));
  return Object.freeze({...project,
    qualityState:'public-ready', visualFallback:media.length?'NONE':'BRANDED', media:Object.freeze(media), theme:projectTheme(project.slug),
    mediaGroups:structuredMedia,units:Object.freeze(units),
    snapshot:Object.freeze({propertyTypes:project.propertyTypes,bedroomMix:project.bedrooms,sizeRange:null,ownership:null,serviceCharge:null}),
    commercial:Object.freeze({startingPrice:null,paymentPlan:null,booking:null,fees:null,handover:null,availability:'REQUIRES_CONFIRMATION',verifiedAt:null}),
    story:Object.freeze({
      overview:project.summary,
      residences:`The official project record identifies ${project.unitTypes?.join(' and ')||project.propertyTypes.join(' and ')}. Finding Stories separates that published mix from live inventory.`,
      architecture:null, amenities:[], lifestyle:null,
      community:`The verified project location is ${project.area}, ${project.emirate}. Travel times and nearby destinations are omitted until project-specific evidence is approved.`,
      buyerConsiderations:[`Confirm which ${project.propertyTypes.join(' or ').toLowerCase()} remain available.`,`Request the current price, payment milestones and completion position in writing.`,`Review the unit-specific plan, orientation, fees and contract before commitment.`]
    }),
    location:Object.freeze({label:`${project.area}, ${project.emirate}`,map:structuredMedia.locationMap,nearby:[],mapStatus:structuredMedia.locationMap?'VERIFIED_AND_PUBLISHED':'SOURCE_NOT_FOUND',mapUnavailableReason:structuredMedia.locationMap?null:'No project-specific map or coordinates have passed source and usage review; an area label is shown instead.'}),
    documents:Object.freeze([]),
    conversion:Object.freeze({enquiryContext:`project:${project.slug}`,primaryLabel:'Request current project details',brochureLabel:null,viewingLabel:'Arrange a private consultation'}),
    governance:Object.freeze({sources:[project.source??project.verification?.source].filter(Boolean),reviewedAt:project.source?.retrieved??project.verification?.lastReviewed,unknownFields:['startingPrice','paymentPlan','handover','currentAvailability','sizeRange'],freshness:'REVIEW_CURRENT'})
  });
}

export function publicReadyProjects(projects){return projects.map(enrichProject).filter(project=>projectPublicationDecision(project).public);}
