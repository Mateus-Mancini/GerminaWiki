export type Contribution={title:string;body:string;createdAt:string};
const storageKey='germinawiki-contributions-v1';
const courseKey=(year:string,subject:string)=>`${year}:${subject}`;
export function readContributions(year:string,subject:string):Contribution[]{try{return JSON.parse(localStorage.getItem(storageKey)??'{}')[courseKey(year,subject)]??[];}catch{return[];}}
export function addContribution(year:string,subject:string,item:Contribution){const all=JSON.parse(localStorage.getItem(storageKey)??'{}') as Record<string,Contribution[]>;const key=courseKey(year,subject);all[key]=[...(all[key]??[]),item];localStorage.setItem(storageKey,JSON.stringify(all));}
