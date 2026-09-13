import {dldTransactionSchema} from './schema.js';

const aliases={
  sourceId:['transaction_id','transaction_number','transactionId','id'],transactionDate:['instance_date','transaction_date','transactionDate'],
  transactionType:['procedure_name_en','procedure_name','transaction_type','transactionType'],transactionSubtype:['procedure_sub_name_en','transaction_sub_type','transactionSubtype'],registrationType:['reg_type_en','reg_type','registration_type'],
  freehold:['is_free_hold','freehold'],usage:['property_usage_en','property_usage','usage'],area:['area_name_en','area_name','area'],
  propertyType:['property_type_en','property_type','propertyType'],propertySubtype:['property_sub_type_en','property_sub_type','propertySubtype'],
  amountAed:['actual_worth','transaction_amount','amount_aed','amountAed'],transactionSizeSqm:['procedure_area','transaction_size_sqm'],
  propertySizeSqm:['property_size_sqm','property_size','actual_area'],rooms:['rooms_en','rooms'],parking:['has_parking','parking'],
  masterProject:['master_project_en','master_project'],project:['project_name_en','project_name','project'],buyerCount:['no_of_parties_role_1','buyer_count'],sellerCount:['no_of_parties_role_2','seller_count'],nearestMetro:['nearest_metro_en','nearest_metro'],nearestMall:['nearest_mall_en','nearest_mall'],nearestLandmark:['nearest_landmark_en','nearest_landmark']
};
const pick=(raw,names)=>{const key=names.find(name=>raw[name]!==undefined&&raw[name]!==null&&raw[name]!=='');return key?raw[key]:null};
const text=value=>value===null?null:String(value).trim()||null;
const number=value=>{if(value===null)return null;const parsed=typeof value==='string'?Number(value.replaceAll(',','')):Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null};
const integer=value=>{const parsed=number(value);return parsed!==null&&Number.isInteger(parsed)?parsed:null};
const date=value=>{if(value===null)return null;const match=String(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(match)return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;const dmy=String(value).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);return dmy?`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`:null};

export function normalizeDldRecord(raw,{mapArea=()=>({status:'UNMAPPED',canonicalName:null,canonicalSlug:null,method:null}),mapProject=()=>({status:'UNMAPPED',canonicalProject:null,canonicalSlug:null,developer:null})}={}){
  const get=key=>pick(raw,aliases[key]);
  const transactionSizeSqm=number(get('transactionSizeSqm')),propertySizeSqm=number(get('propertySizeSqm')),amountAed=number(get('amountAed'));
  const transactionSizeSqft=transactionSizeSqm===null?null:transactionSizeSqm*10.7639,propertySizeSqft=propertySizeSqm===null?null:propertySizeSqm*10.7639,size=propertySizeSqft??transactionSizeSqft;
  const sourceAreaName=text(get('area')),areaMapping=mapArea(sourceAreaName),projectMapping=mapProject(text(get('project')));
  return dldTransactionSchema.parse({sourceId:text(get('sourceId')),transactionDate:date(get('transactionDate')),transactionType:text(get('transactionType')),transactionSubtype:text(get('transactionSubtype')),registrationType:text(get('registrationType')),freehold:text(get('freehold')),usage:text(get('usage')),area:sourceAreaName,propertyType:text(get('propertyType')),propertySubtype:text(get('propertySubtype')),amountAed,transactionSizeSqm,propertySizeSqm,rooms:text(get('rooms')),parking:text(get('parking')),masterProject:text(get('masterProject')),project:text(get('project')),buyerCount:integer(get('buyerCount')),sellerCount:integer(get('sellerCount')),nearestMetro:text(get('nearestMetro')),nearestMall:text(get('nearestMall')),nearestLandmark:text(get('nearestLandmark')),transactionSizeSqft,propertySizeSqft,aedPerSqft:amountAed!==null&&size>0?amountAed/size:null,sourceAreaName,canonicalAreaName:areaMapping.canonicalName,canonicalAreaSlug:areaMapping.canonicalSlug,areaMappingStatus:areaMapping.status,areaMappingMethod:areaMapping.method,projectMappingStatus:projectMapping.status,canonicalProject:projectMapping.canonicalProject,canonicalProjectSlug:projectMapping.canonicalSlug,developer:projectMapping.developer});
}

export function normalizeDldRecords(records,options){
  const accepted=[],rejected=[];for(const raw of records){try{accepted.push(normalizeDldRecord(raw,options))}catch(error){rejected.push({reason:'schema_validation_failed',message:error.message})}}
  const unique=[...new Map(accepted.map(record=>[record.sourceId,record])).values()];
  return {records:unique,accepted:unique.length,rejected:rejected.length+(accepted.length-unique.length),rejections:rejected};
}
