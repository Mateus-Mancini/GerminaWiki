export type RemotePage={id:string;title:string;slug:string;content:string;version:number;folderId:string|null;createdAt?:string;updatedAt?:string};
export type FolderNode={id:string;name:string;parentFolderId:string|null;children:FolderNode[]};
const baseUrl=(import.meta as ImportMeta&{env?:{VITE_API_BASE_URL?:string}}).env?.VITE_API_BASE_URL?.replace(/\/$/,'')??'http://localhost:8080';
let apiAvailable=false;
export function isApiAvailable(){return apiAvailable;}
export function setApiAvailable(available:boolean){apiAvailable=available;}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${baseUrl}${path}`,{...init,headers:{'content-type':'application/json',...(init.headers??{})}});if(!response.ok){const payload=await response.json().catch(()=>null);const message=typeof payload?.error==='string'?payload.error:payload?.error?.message??`Falha na API (${response.status}).`;throw new Error(message);}if(response.status===204)return undefined as T;return response.json() as Promise<T>;}
export async function listFolders(){return request<FolderNode[]>('/api/folders/tree');}
export async function listPages(){return request<RemotePage[]>('/api/pages');}
export async function getPage(id:string){return request<RemotePage>(`/api/pages/${encodeURIComponent(id)}`);}
export async function findSubjectPage(subject:string):Promise<RemotePage|null>{const pages=await request<RemotePage[]>(`/api/search?q=${encodeURIComponent(subject)}`);const key=subject.trim().toLocaleLowerCase('pt-BR');const match=pages.find(page=>page.title.trim().toLocaleLowerCase('pt-BR')===key);return match?request<RemotePage>(`/api/pages/${encodeURIComponent(match.id)}`):null;}
function flattenFolders(nodes:FolderNode[]):FolderNode[]{return nodes.flatMap(node=>[node,...flattenFolders(node.children??[])]);}
async function getOrCreateYearFolder(year:string){const folders=flattenFolders(await listFolders());const existing=folders.find(folder=>folder.name.trim().toLocaleLowerCase('pt-BR')===year.trim().toLocaleLowerCase('pt-BR'));if(existing)return existing.id;const created=await request<FolderNode>('/api/folders',{method:'POST',body:JSON.stringify({name:year})});return created.id;}
function slugify(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,300);}
export async function createContributionPage(year:string,title:string,content:string){const folderId=await getOrCreateYearFolder(year);return request<RemotePage>('/api/pages',{method:'POST',body:JSON.stringify({title,slug:slugify(`${year}-${title}`),content,folderId})});}
