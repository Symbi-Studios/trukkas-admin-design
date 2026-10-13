'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { useNavigate,useParams } from '../router.js';
import { PageHeader,Button,Card,SectionCard,Badge,Icon,DropdownMenu } from '../ds.js';
import { useGetAdminAnnouncementQuery, announcementCopyUrl, announcementEditUrl } from '../store/features/announcements/announcementsApi.js';
import { useAnnouncementOperations } from '../store/features/announcements/useAnnouncementOperations.js';
import { AnnouncementReasonDialog } from './AnnouncementDialogs.jsx';
import { DriverDetailLoading, DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import './Engagement.css';
export function AnnouncementDetail(){
 const navigate=useNavigate(),params=useParams(),search=useSearchParams(),announcementId=search.get('announcementId')||params.announcementId;
 const owner=useSelector(state=>state.auth.admin?.id),authenticated=useSelector(state=>Boolean(state.auth.accessToken));
 const query=useGetAdminAnnouncementQuery({id:announcementId,owner},{skip:!authenticated,refetchOnMountOrArgChange:true});
 const a=authenticated&&!query.error?query.currentData:null;
 const operations=useAnnouncementOperations(),publication={isLoading:operations.saving};
 const [reasonDialog,setReasonDialog]=useState(null);
 const [menu,setMenu]=useState(false),[toast,setToast]=useState('');
 const pending=useRef(false),timer=useRef(null),activeId=useRef(announcementId);activeId.current=announcementId;
 useEffect(()=>{setMenu(false);setToast('');setReasonDialog(null);clearTimeout(timer.current)},[announcementId,owner,operations.admin]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function notify(message){clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),1600)}
 async function publish(){if(!a||pending.current||publication.isLoading)return;const id=a.id;pending.current=true;try{const result=await operations.perform({action:'publish',id});if(result&&activeId.current===id)notify(result.message)}catch(error){if(activeId.current===id)notify(error instanceof Error?error.message:getApiErrorMessage(error))}finally{pending.current=false}}
 async function duplicate(){try{const result=await operations.perform({action:'duplicate',id:a.id});if(result)navigate(announcementCopyUrl(result.announcement.id))}catch(error){notify(error instanceof Error?error.message:getApiErrorMessage(error))}}
 async function acknowledge(){try{const result=await operations.perform({action:'acknowledge',id:a.id});if(result)notify(result.message)}catch(error){notify(error instanceof Error?error.message:getApiErrorMessage(error))}}
 function archive(){setMenu(false);setReasonDialog({admin:operations.admin,announcement:a})}
 if(query.isLoading||(query.isFetching&&!query.currentData))return <DriverDetailLoading/>;
 if(query.error)return <Card><DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice></Card>;
 if(!authenticated)return <Card>—</Card>;
 if(!a)return <Card>Announcement not found.</Card>;
 return <div className="engagement-page"><PageHeader crumbs={['Support System','Announcements',a.t]} title={a.t} description={a.p} actions={<><Button variant="outline" icon="arrow-left" onClick={()=>navigate('/announcements')}>Back to Announcements</Button><Button variant="outline" icon="pencil" onClick={()=>navigate(announcementEditUrl(a.id))}>Edit</Button><span className="action-menu-wrap"><Button icon="ellipsis" variant="outline" onClick={()=>setMenu(!menu)}>More Actions</Button>{menu&&<span style={{position:'absolute',right:0,top:44,zIndex:20}}><DropdownMenu width={210} items={[{label:'Duplicate',icon:'copy',onClick:duplicate},{label:'Export',icon:'download',onClick:()=>{const u=URL.createObjectURL(new Blob([a.t+'\n\n'+a.p]));const e=document.createElement('a');e.href=u;e.download=a.id+'.txt';e.click();URL.revokeObjectURL(u)}},{label:'Print',icon:'printer',onClick:()=>window.print()},{divider:true},{label:'Archive',icon:'archive',onClick:archive}]}/></span>}</span></>}/><div className="engagement-layout"><Card><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><Badge tone="info">{a.type}</Badge><Badge>{a.st}</Badge>{a.pinned&&<Badge tone="purple">Pinned</Badge>}</div><div className="live-preview" style={{marginTop:16,padding:22}}><Icon name={a.icon} size={28} color="var(--tk-blue)"/><h2 style={{color:'var(--tk-ink-900)'}}>{a.t}</h2><p style={{fontSize:13,lineHeight:1.7,whiteSpace:'pre-line'}}>{a.p}</p>{a.acknowledgement!==false&&<Button size="sm" style={{marginTop:14}} onClick={acknowledge}>Acknowledge</Button>}</div></Card><div className="engagement-rail"><SectionCard title="Announcement Information"><Info label="ID" value={a.id}/><Info label="Status" value={<Badge>{a.st}</Badge>}/><Info label="Audience" value={a.aud}/><Info label="Priority" value={a.priority}/><Info label="Published / Scheduled" value={`${a.d} ${a.tm}`}/><Info label="Views" value={a.v?.toLocaleString()??'—'}/></SectionCard><SectionCard title="Quick Actions"><Button fullWidth icon="send" disabled={a.st==='Published'||publication.isLoading} onClick={publish}>Publish Now</Button><Button fullWidth variant="outline" icon="copy" onClick={duplicate}>Duplicate</Button><Button fullWidth variant="danger" icon="archive" onClick={archive}>Archive</Button></SectionCard></div></div>{reasonDialog&&reasonDialog.admin===operations.admin&&<AnnouncementReasonDialog action="archive" announcement={reasonDialog.announcement} operations={operations} onClose={()=>setReasonDialog(null)} onSaved={result=>notify(result.message)}/>}
{toast&&<div className="eng-toast">{toast}</div>}</div>}
function Info({label,value}){return <div style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:8,padding:'8px 0',fontSize:11}}><span style={{color:'var(--tk-ink-400)'}}>{label}</span><span style={{color:'var(--tk-ink-700)'}}>{value}</span></div>}
