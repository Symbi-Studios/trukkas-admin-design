'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { PageHeader, Button, StatCard, SectionCard, Card, Tabs, SearchField, DataTable, Pagination, Badge, Avatar, Icon, Skeleton } from '../ds.js';
import { useGetAdminKnowledgeArticleDirectoryQuery, KNOWLEDGE_CATEGORIES, ARTICLE_STATUS_CODES, knowledgeSummary, knowledgeDetailUrl } from '../store/features/knowledgeBase/knowledgeBaseApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverTableLoading, DriverLoadingNotice } from './DriversLoading.jsx';
import './Support.css';

const PAGE_SIZE=8; const catTone={'Trips & Jobs':'info','Container Triangulation':'purple','Provisional Release':'orange','Fleet Management':'info',Finance:'success','Live Tracking':'teal',Pricing:'danger',General:'neutral'};
function exportCsv(rows){const head=['Title','Category','Author','Status','Views','Helpful','Last Updated'];const csv=[head,...rows.map(r=>[r.title,r.category,r.author,r.status,r.views??'—',r.helpful??'—',r.updated])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='knowledge-base.csv';a.click();URL.revokeObjectURL(u)}

export function KnowledgeBase(){
 const navigate=useNavigate();const authenticated=useSelector(state=>Boolean(state.auth.accessToken));const [tab,setTab]=useState('All Articles');const [q,setQ]=useState('');const [category,setCategory]=useState('All');const [status,setStatus]=useState('All');const [author,setAuthor]=useState('All');const [page,setPage]=useState(1);const [tip,setTip]=useState(true);const [selected,setSelected]=useState([]);
 const [search,setSearch]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>setSearch(q.trim()),250);return ()=>clearTimeout(timer)},[q]);
 const directory=useGetAdminKnowledgeArticleDirectoryQuery(undefined,{skip:!authenticated});
 const tabStatus=tab==='All Articles'?null:tab==='Drafts'?'Draft':tab;
 const requestedStatus=tabStatus||(status==='All'?null:status);
 const serverFilters=Boolean(search||category!=='All'||requestedStatus);
 const searched=useGetAdminKnowledgeArticleDirectoryQuery({search,category:category==='All'?undefined:category,status:ARTICLE_STATUS_CODES[requestedStatus]},{skip:!authenticated||!serverFilters});
 const source=serverFilters?searched:directory;
 const articles=authenticated&&!directory.error?directory.currentData:undefined;
 const rows=authenticated&&!source.error?source.currentData:undefined;
 const loading=authenticated&&(source.isFetching||q.trim()!==search);
 const summary=knowledgeSummary(articles);
 const value=content=>directory.isFetching?<Skeleton as="span" width={54} height={23}/>:content;
 const authors=[...new Set((articles||[]).map(a=>a.author).filter(name=>name!=='—'))];
 const available=Boolean(rows)&&(author==='All'||rows.every(a=>a.author!=='—'));
 const conflict=Boolean(tabStatus&&status!=='All'&&tabStatus!==status);
 const filtered=useMemo(()=>conflict?[]:(rows||[]).filter(a=>author==='All'||a.author===author),[rows,conflict,author]);
 const total=available?filtered.length:null;const pageCount=total==null?null:Math.max(1,Math.ceil(total/PAGE_SIZE));const paged=available?filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE):[];
 useEffect(()=>{if(pageCount!=null&&page>pageCount)setPage(pageCount)},[page,pageCount]);
 return <div className="support-page">
  <PageHeader crumbs={['Support System','Knowledge Base']} title="Knowledge Base" description="Create, organize and manage helpful articles for users." actions={<Button icon="plus" onClick={()=>navigate('/knowledge-base/new')}>New Article</Button>}/>
  <div className="support-stats"><StatCard icon="book-open" label="Total Articles" value={value(summary.total)} delta="—" caption="from last 7 days"/><StatCard icon="clipboard-check" tint="green" label="Published Articles" value={value(summary.published)} delta="—" caption="from last 7 days"/><StatCard icon="file-pen-line" tint="amber" label="Draft Articles" value={value(summary.draft)} delta="—" direction="down" caption="from last 7 days"/><StatCard icon="chart-no-axes-column-increasing" label="Views (This Month)" value={value(summary.monthlyViews)} delta="—" caption="from last 7 days"/><StatCard icon="star" label="Helpful Ratings" value={value(summary.helpful)} delta="—" caption="from last 7 days"/></div>
  <div className="support-layout"><SectionCard title="" pad="none">
   <Tabs value={tab} onChange={v=>{setTab(v);setPage(1)}} items={['All Articles','Published','Drafts','Archived']} style={{padding:'0 16px'}}/>
   <div className="support-toolbar"><SearchField style={{flex:1,minWidth:220}} placeholder="Search articles..." value={q} onChange={e=>{setQ(e.target.value);setPage(1)}}/><select className="support-select" aria-label="Category filter" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option>All</option>{KNOWLEDGE_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select><select className="support-select" aria-label="Status filter" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>{['All','Published','Draft','Archived'].map(x=><option key={x}>{x}</option>)}</select><select className="support-select" aria-label="Author filter" value={author} onChange={e=>{setAuthor(e.target.value);setPage(1)}}><option>All</option>{authors.map(x=><option key={x}>{x}</option>)}</select><Button variant="outline" icon="sliders-horizontal" onClick={()=>{setCategory('All');setStatus('All');setAuthor('All')}}>Reset</Button><Button variant="outline" icon="download" disabled={loading||!available} onClick={()=>exportCsv(filtered)}>Export</Button></div>
   {selected.length>0&&<div style={{padding:'9px 16px',background:'var(--tk-blue-soft)',color:'var(--tk-blue)',fontSize:12,display:'flex',alignItems:'center',gap:10}}><strong>{selected.length} selected</strong><Button size="sm" variant="outline" icon="download" disabled={directory.isFetching||!articles} onClick={()=>exportCsv((articles||[]).filter(a=>selected.includes(a.id)))}>Export selected</Button><Button size="sm" variant="ghost" onClick={()=>setSelected([])}>Clear</Button></div>}
   {loading?<DriverTableLoading columns={8} label="Loading articles"/>:source.error?<DriverLoadingNotice>{getApiErrorMessage(source.error,"Unable to load articles.")}</DriverLoadingNotice>:!available?<DriverLoadingNotice>—</DriverLoadingNotice>:<DataTable selectable selected={selected} onSelect={setSelected} rows={paged} rowKey={r=>r.id} onRowClick={r=>navigate(knowledgeDetailUrl(r.id))} columns={[
    {key:'title',header:'Title',render:r=><span style={{display:'flex',gap:9,alignItems:'center'}}><Icon name="file-text" size={14} color="var(--tk-blue)"/><span className="support-title-cell"><strong>{r.title}</strong><small>{r.summary}</small></span></span>},
    {key:'category',header:'Category',render:r=><Badge tone={catTone[r.category]}>{r.category}</Badge>},
    {key:'author',header:'Author',render:r=><span className="support-person"><Avatar name={r.author} size={24}/><span>{r.author}</span></span>},
    {key:'status',header:'Status',render:r=><Badge tone={r.status==='Published'?'success':'info'}>{r.status}</Badge>},
    {key:'views',header:'Views',render:r=>r.views?.toLocaleString()??'—'},
    {key:'helpful',header:'Helpful',render:r=>r.helpful!=null?<span style={{color:'var(--tk-success)',whiteSpace:'nowrap'}}><Icon name="thumbs-up" size={12}/> {r.helpful}%</span>:'—'},
    {key:'updated',header:'Last Updated',render:r=><span style={{display:'grid',whiteSpace:'nowrap'}}><span>{r.updated}</span><small className="tk-meta">{r.time}</small></span>},
    {key:'actions',header:'Actions',width:42,render:r=><button className="support-row-action" onClick={e=>{e.stopPropagation();navigate(knowledgeDetailUrl(r.id))}}><Icon name="ellipsis" size={16}/></button>},
   ]}/>}<Pagination page={page} pageCount={loading?null:pageCount} total={loading?null:total} pageSize={PAGE_SIZE} onPage={p=>{if(pageCount!=null)setPage(Math.min(Math.max(p,1),pageCount))}}/>
  </SectionCard><div className="support-rail">
   <SectionCard title="Categories" action={<button className="support-link" style={{border:0,background:'none'}} onClick={()=>{setCategory('All');setPage(1);window.scrollTo({top:0,behavior:'smooth'})}}>View all</button>}>{summary.categories.map(([name,count])=><button className="kb-category" style={{width:'100%',border:0,background:'transparent',cursor:'pointer',textAlign:'left'}} key={name} onClick={()=>{setCategory(name);setPage(1);window.scrollTo({top:0,behavior:'smooth'})}}><span className="cat-icon"><Icon name="book-open" size={13}/></span><strong>{name}</strong><b>{value(count)}</b></button>)}</SectionCard>
   <SectionCard title="Popular Articles" action={<button className="support-link" style={{border:0,background:'none'}} onClick={()=>{setQ('');setCategory('All');setStatus('Published');setPage(1)}}>View all</button>}>{directory.isFetching?<Skeleton height={14}/>:summary.popular==null?'—':summary.popular.map(a=><button className="support-action" key={a.id} onClick={()=>navigate(knowledgeDetailUrl(a.id))}><span className="ico"><Icon name="eye" size={13}/></span><span><strong>{a.title}</strong><small>{a.views?.toLocaleString()} views</small></span></button>)}</SectionCard>
   <SectionCard title={<span>Article Feedback <small>(This Month)</small></span>}><div className="feedback-wrap"><div className="feedback-ring"/><div className="feedback-legend"><span><i style={{color:'var(--tk-success)'}}>● Helpful</i><b>—</b></span><span><i style={{color:'var(--tk-danger)'}}>● Not Helpful</i><b>—</b></span><span><i style={{color:'var(--tk-warning)'}}>● Neutral</i><b>—</b></span></div></div></SectionCard>
  </div></div>
  {tip&&<Card tone="cool"><div className="kb-tip"><span className="bulb"><Icon name="lightbulb" size={22}/></span><span style={{flex:1}}><strong>Help users find answers faster</strong><small>Keep your knowledge base up to date and organized. Well-maintained articles reduce support tickets by up to 40%.</small></span><Button variant="outline" disabled>View Analytics</Button><Button variant="ghost" icon="x" aria-label="Dismiss tip" onClick={()=>setTip(false)}/></div></Card>}
 </div>
}
