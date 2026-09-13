import {dldTransactionSchema} from './schema.js';

const aliases={
  sourceId:['transaction_id','transactionId','id'],transactionDate:['instance_date','transaction_date','transactionDate'],
  transactionType:['procedure_name_en','procedure_name','transaction_type','transactionType'],registrationType:['reg_type_en','reg_type','registration_type'],
  freehold:['is_free_hold','freehold'],usage:['property_usage_en','property_usage','usage'],area:['area_name_en','area_name','area'],
  propertyType:['property_type_en','property_type','propertyType'],propertySubtype:['property_sub_type_en','property_sub_type','propertySubtype'],
  amountAed:['actual_worth','transaction_amount','amount_aed','amountAed'],transactionSizeSqm:['procedure_area','transaction_size_sqm'],
  propertySizeSqm:['property_size_sqm','property_size','actual_area'],rooms:['rooms_en','rooms'],parking:['has_parking','parking'],
  masterProject:['master_project_en','master_project'],project:['project_name_en','project_name','project'],buyerCount:['no_of_parties_role_1','buyer_count'],sellerCount:['no_of_parties_role_2','seller_count']
};
const pick=(raw,names)=>{const key=names.find(name=>raw[name]!==undefined&&raw[name]!==null&&raw[name]!=='');return key?raw[key]:null};
const text=value=>value===null?null:String(value).trim()||null;
const number=value=>{if(value===null)return null;const parsed=typeof value==='string'?Number(value.replaceAll(',','')):Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null};
const integer=value=>{const parsed=number(value);return parsed!==null&&Number.isInteger(parsed)?parsed:null};
const date=value=>{if(value===null)return null;const match=String(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(match)return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;const dmy=String(value).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);return dmy?`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`:null};

export function normalizeDldRecord(raw){
  const get=key=>pick(raw,aliases[key]);
  return dldTransactionSchema.parse({sourceId:text(get('sourceId')),transactionDate:date(get('transactionDate')),transactionType:text(get('transactionType')),registrationType:text(get('registrationType')),freehold:text(get('freehold')),usage:text(get('usage')),area:text(get('area')),propertyType:text(get('propertyType')),propertySubtype:text(get('propertySubtype')),amountAed:number(get('amountAed')),transactionSizeSqm:number(get('transactionSizeSqm')),propertySizeSqm:number(get('propertySizeSqm')),rooms:text(get('rooms')),parking:text(get('parking')),masterProject:text(get('masterProject')),project:text(get('project')),buyerCount:integer(get('buyerCount')),sellerCount:integer(get('sellerCount'))});
}

export function normalizeDldRecords(records){
  const accepted=[],rejected=[];for(const raw of records){try{accepted.push(normalizeDldRecord(raw))}catch(error){rejected.push({reason:'schema_validation_failed',message:error.message})}}
  const unique=[...new Map(accepted.map(record=>[record.sourceId,record])).values()];
  return {records:unique,accepted:unique.length,rejected:rejected.length+(accepted.length-unique.length),rejections:rejected};
}
