import {createReadStream} from 'node:fs';

export const REQUIRED_HEADER_GROUPS=[['transaction_id','transaction_number','transactionId','id'],['instance_date','transaction_date','transactionDate']];
const canonical=value=>value.trim().replace(/^\uFEFF/,'');

export function validateDldHeaders(headers){
  const missing=REQUIRED_HEADER_GROUPS.filter(group=>!group.some(name=>headers.includes(name)));
  if(missing.length)throw new Error(`Missing required DLD CSV header(s): ${missing.map(group=>group.join('|')).join(', ')}`);
  if(new Set(headers).size!==headers.length)throw new Error('Duplicate DLD CSV headers are not allowed');
  return true;
}

function detectDelimiter(line){
  const candidates=[',',';','\t'].map(delimiter=>({delimiter,count:line.split(delimiter).length-1})).sort((a,b)=>b.count-a.count);
  if(candidates[0].count<1||candidates[0].count===candidates[1].count)throw new Error('Unable to validate CSV delimiter');
  return candidates[0].delimiter;
}

export async function* streamCsvRows(file,{startDate=null,endDate=null}={}){
  const input=createReadStream(file,{encoding:'utf8',highWaterMark:64*1024});let buffer='',headers=null,delimiter=null,row=[],field='',quoted=false,line=1;
  const emit=()=>{row.push(field);const result=row;row=[];field='';return result};
  for await(const chunk of input){buffer+=chunk;let index=0;if(!delimiter){const newline=buffer.indexOf('\n');if(newline<0)continue;delimiter=detectDelimiter(buffer.slice(0,newline).replace(/\r$/,''));}
    while(index<buffer.length){const char=buffer[index];if(quoted){if(char==='"'&&buffer[index+1]==='"'){field+='"';index+=2;continue}if(char==='"'){quoted=false;index++;continue}field+=char;index++;continue}
      if(char==='"'&&field===''){quoted=true;index++;continue}if(char===delimiter){row.push(field);field='';index++;continue}if(char==='\n'){const values=emit();line++;index++;if(!headers){headers=values.map(canonical);validateDldHeaders(headers)}else{if(values.at(-1)?.endsWith('\r'))values[values.length-1]=values.at(-1).slice(0,-1);if(values.length!==headers.length)yield {line,error:'column_count_mismatch'};else{const record=Object.fromEntries(headers.map((header,i)=>[header,values[i]]));const date=record.transaction_date??record.instance_date??record.transactionDate;if((!startDate||date>=startDate)&&(!endDate||date<=endDate))yield {line,record}}}continue}field+=char;index++}
    buffer='';
  }
  if(quoted)throw new Error(`Unclosed quoted field at line ${line}`);
  if(field||row.length){const values=emit();if(!headers){headers=values.map(canonical);validateDldHeaders(headers)}else if(values.length===headers.length)yield {line,record:Object.fromEntries(headers.map((header,i)=>[header,values[i]]))};else yield {line,error:'column_count_mismatch'};}
}
