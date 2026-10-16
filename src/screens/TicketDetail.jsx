'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import { PageHeader, Button, Card, SectionCard, Badge, Avatar, Icon, Select, DropdownMenu, Modal, TextField, Skeleton } from '../ds.js';
import {
  useGetAdminSupportTicketDetailQuery, useGetAdminTicketAgentsQuery, useUpdateAdminSupportTicketMutation,
  useUploadAdminTicketReplyAttachmentsMutation, useSendAdminTicketReplyMutation, useAddAdminTicketNoteMutation, useMergeAdminSupportTicketMutation,
  emptyTicket, ticketWithAgents, ticketCount, downloadTicketAttachment, TICKET_STATUS_CODES, TICKET_PRIORITY_CODES, TICKET_CATEGORY_CODES, ticketDetailUrl,
} from '../store/features/tickets/ticketsApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { TicketMergeDialog } from './TicketMergeDialog.jsx';
import './Support.css';

const STATUSES=['Open','In Progress','Pending','Resolved','Closed']; const PRIORITIES=['High','Medium','Low']; const CATEGORIES=Object.keys(TICKET_CATEGORY_CODES);

function downloadText(name,text){const blob=new Blob([text],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function Action({icon,label,hint,danger,onClick,disabled}){return <button className={'support-action'+(danger?' danger':'')} disabled={disabled} onClick={onClick}><span className="ico"><Icon name={icon} size={14}/></span><span><strong>{label}</strong><small>{hint}</small></span></button>}

export function TicketDetail(){
  const route = useParams(), search = useSearchParams();
  const ticketId = route.ticketId || search.get('ticketId') || '';
  const navigate = useNavigate();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const query = useGetAdminSupportTicketDetailQuery(ticketId, { skip: !authenticated || !ticketId, refetchOnMountOrArgChange: true });
  const agentsQuery = useGetAdminTicketAgentsQuery(undefined, { skip: !authenticated });
  const agents = useMemo(() => authenticated && !agentsQuery.error ? agentsQuery.currentData || [] : [], [authenticated, agentsQuery.currentData, agentsQuery.error]);
  const record = authenticated && !query.error ? query.currentData : undefined;
  const ticket = ticketWithAgents(record || emptyTicket, agents);
  const loading = authenticated && (query.isLoading || (query.isFetching && !record));
  const value = (content) => loading ? <Skeleton as="span" width={100} height={14} /> : content;
  const [tab,setTab]=useState('Reply');
  const [replies,setReplies]=useState({ Reply: '', 'Internal Note': '' });
  const reply = replies[tab];
  const setReply = (content) => setReplies((previous) => ({ ...previous, [tab]: typeof content === 'function' ? content(previous[tab]) : content }));
  const [menu,setMenu]=useState(false), [edit,setEdit]=useState(false), [toast,setToast]=useState(''), [draft,setDraft]=useState(null);
  const [pending,setPending]=useState(false), [merge,setMerge]=useState(false);
  const lock = useRef(null), files = useRef({ Reply: [], 'Internal Note': [] }), uploaded = useRef({ Reply: [], 'Internal Note': [] }), fileInput = useRef(null), toastTimer = useRef(null), activeId = useRef(ticketId);
  const activeOwner = useRef(admin?.id);
  activeId.current = ticketId; activeOwner.current = admin?.id;
  const [updateTicket] = useUpdateAdminSupportTicketMutation();
  const [uploadAttachments] = useUploadAdminTicketReplyAttachmentsMutation();
  const [sendReply] = useSendAdminTicketReplyMutation();
  const [addNote] = useAddAdminTicketNoteMutation();
  const [mergeTicket] = useMergeAdminSupportTicketMutation();
  const busy = pending || !record || Boolean(record.mergedInto);
  const availableAgents = agents.filter((agent) => agent.isActive === true);
  const agentOptions = availableAgents.map((agent) => ({ value: agent.id, label: agent.name }));
  if (ticket.assignedTo && !agentOptions.some((agent) => agent.value === ticket.assignedTo) && ticket.assignee !== '—') agentOptions.unshift({ value: ticket.assignedTo, label: ticket.assignee });
  const assignedValue = (id) => agentOptions.some((agent) => agent.value === id) ? id : '';
  const nextAgent = availableAgents.find((agent) => agent.id !== ticket.assignedTo);
  const changes = draft ? {
    ...(draft.subject !== ticket.subject ? { subject: draft.subject.trim() } : {}),
    ...(draft.category !== ticket.category && TICKET_CATEGORY_CODES[draft.category] ? { category: TICKET_CATEGORY_CODES[draft.category] } : {}),
    ...(draft.priority !== ticket.priority && TICKET_PRIORITY_CODES[draft.priority] ? { priority: TICKET_PRIORITY_CODES[draft.priority] } : {}),
    ...(draft.assignedTo !== ticket.assignedTo && availableAgents.some((agent) => agent.id === draft.assignedTo) ? { assignedTo: draft.assignedTo } : {}),
  } : {};
  useEffect(() => {
    lock.current = null; files.current = { Reply: [], 'Internal Note': [] }; uploaded.current = { Reply: [], 'Internal Note': [] };
    setPending(false); setReplies({ Reply: '', 'Internal Note': '' }); setTab('Reply'); setEdit(false); setDraft(null); setMenu(false); setMerge(false); setToast('');
    clearTimeout(toastTimer.current);
  }, [ticketId, admin?.id]);
  useEffect(() => () => { activeId.current = ''; clearTimeout(toastTimer.current); }, []);
  function notify(message) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3000); }
  async function update(key, selected) {
    const code = key === 'status' ? TICKET_STATUS_CODES[selected] : key === 'priority' ? TICKET_PRIORITY_CODES[selected] : key === 'category' ? TICKET_CATEGORY_CODES[selected] : selected;
    if (!code) { notify('This status is not supported by the ticket API.'); return false; }
    return saveChanges({ [key === 'assignee' ? 'assignedTo' : key]: code });
  }
  async function saveChanges(body, expectedUpdatedAt = ticket.sourceData.updatedAt) {
    if (busy || lock.current || !Object.keys(body).length) return false;
    const operation = Symbol(), id = ticketId, owner = admin?.id;
    lock.current = operation; setPending(true);
    try {
      await updateTicket({ id, changes: body, expectedUpdatedAt }).unwrap();
      if (id !== activeId.current || owner !== activeOwner.current) return false;
      notify('Ticket updated'); return true;
    } catch (error) { if (id === activeId.current && owner === activeOwner.current) notify(getApiErrorMessage(error)); return false; }
    finally { if (lock.current === operation) { lock.current = null; setPending(false); } }
  }
  async function send() {
    if (!reply.trim() || busy || lock.current) return;
    const operation = Symbol(), id = ticketId, owner = admin?.id, section = tab, content = reply.trim();
    lock.current = operation; setPending(true);
    try {
      let urls = uploaded.current[section];
      if (files.current[section].length && !urls.length) {
        urls = await uploadAttachments({ id, files: files.current[section] }).unwrap();
        if (id !== activeId.current || owner !== activeOwner.current) return;
        uploaded.current[section] = urls;
      }
      const sendMessage = section === 'Reply' ? sendReply : addNote;
      await sendMessage({ id, content, attachmentUrls: urls }).unwrap();
      if (id !== activeId.current || owner !== activeOwner.current) return;
      setReplies((previous) => ({ ...previous, [section]: '' })); files.current[section] = []; uploaded.current[section] = [];
      notify(section === 'Reply' ? 'Reply sent' : 'Internal note added');
    } catch (error) { if (id === activeId.current && owner === activeOwner.current) notify(getApiErrorMessage(error)); }
    finally { if (lock.current === operation) { lock.current = null; setPending(false); } }
  }
  async function mergeInto(targetThreadId) {
    if (busy || lock.current) return;
    const operation = Symbol(), id = ticketId, owner = admin?.id;
    lock.current = operation; setPending(true);
    try {
      const saved = await mergeTicket({ id, targetThreadId }).unwrap();
      if (id !== activeId.current || owner !== activeOwner.current) return;
      setMerge(false); navigate(ticketDetailUrl(saved.id));
    } catch (error) { if (id === activeId.current && owner === activeOwner.current) notify(getApiErrorMessage(error)); }
    finally { if (lock.current === operation) { lock.current = null; setPending(false); } }
  }
  function chooseFiles(event) {
    const selected = Array.from(event.target.files || []); event.target.value = '';
    if (!selected.length || busy) return;
    if (selected.length > 5 || selected.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)) {
      notify('Choose 1–5 JPEG, PNG, WebP or PDF files, up to 10 MB each.'); return;
    }
    files.current[tab] = selected; uploaded.current[tab] = [];
    notify(`${selected.length} ${selected.length === 1 ? 'file' : 'files'} selected`);
  }
  function openEdit() { if (!record) return; setDraft({ ...ticket }); setEdit(true); }
  async function saveEdit() { if (await saveChanges(changes, draft?.sourceData.updatedAt)) setEdit(false); }
  async function copyId() { try { await navigator.clipboard.writeText(ticket.id); notify('Ticket ID copied'); } catch { notify('Could not copy the ticket ID.'); } }
  if (!loading && query.error) return <Card><p>{query.error.status === 404 ? `Ticket ${ticketId} was not found.` : getApiErrorMessage(query.error)}</p><Button variant="outline" icon="arrow-left" onClick={()=>navigate('/tickets')}>Back to Tickets</Button></Card>;
  return <div className="support-page">
    <PageHeader crumbs={['Support System','Tickets',ticket.id]} title="Ticket Details" description="View and manage the details of this support ticket." actions={<><Button variant="outline" icon="arrow-left" onClick={()=>navigate('/tickets')}>Back to Tickets</Button><Button variant="outline" icon="pencil" disabled={busy} onClick={openEdit}>Edit Ticket</Button><span style={{position:'relative'}}><Button variant="outline" icon="ellipsis" onClick={()=>setMenu(!menu)}>More Actions</Button>{menu&&<span style={{position:'absolute',right:0,top:44,zIndex:30}}><DropdownMenu width={220} items={[{label:'Print Ticket',icon:'printer',disabled:!record,onClick:()=>window.print()},{label:'Download Ticket',icon:'download',disabled:!record,onClick:()=>downloadText(ticket.id+'.txt',ticket.subject+'\n\n'+ticket.description)},{label:'Copy Ticket ID',icon:'copy',disabled:!record,onClick:copyId},{divider:true},{label:'Close Ticket',icon:'circle-x',tone:'danger',disabled:busy,onClick:()=>{update('status','Closed');setMenu(false)}}]}/></span>}</span></>} />
    <div className="ticket-grid">
      <div className="ticket-main">
        <Card className="ticket-head-card">
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><Badge tone="info">{value(ticket.id)}</Badge><Badge tone={ticket.status==='Open'?'success':'info'} dot>{value(ticket.status)}</Badge></div>
          <h2 style={{fontSize:19,margin:'14px 0 0',color:'var(--tk-ink-900)'}}>{value(ticket.subject)}</h2>
          <div className="ticket-meta"><span className="ticket-meta-item"><Avatar name={ticket.customer} size={28}/><span>{value(ticket.customer)}<small style={{display:'block',color:'var(--tk-ink-400)'}}>({value(ticket.email)})</small></span></span><span className="ticket-meta-item"><Icon name="tag" size={16}/><Badge>{value(ticket.category)}</Badge></span><span className="ticket-meta-item"><Icon name="flag" size={16} color="var(--tk-danger)"/><Badge tone={ticket.priority==='High'?'danger':'warning'}>{value(ticket.priority)}</Badge></span><span className="ticket-meta-item"><Icon name="calendar-days" size={16}/><span>{value(ticket.created)}<small style={{display:'block',color:'var(--tk-ink-400)'}}>{value(ticket.createdAge)}</small></span></span></div>
          <h3 style={{fontSize:12,margin:'15px 0 4px'}}>Description</h3><div className="ticket-copy">{value(ticket.description)}</div>
          <h3 style={{fontSize:12,margin:'18px 0 8px'}}>Attachments ({value(ticketCount(ticket.attachmentsKnown ? ticket.attachments.length : null))})</h3><div className="attachments">{loading ? value('—') : ticket.attachments.map(a=><button className="attachment" key={a.url} onClick={()=>downloadTicketAttachment(a)}><span className="file-ico"><Icon name={a.icon} size={18}/></span><span><strong>{a.name}</strong><small>{a.size}</small></span></button>)}{!loading && !ticket.attachmentsKnown && !ticket.attachments.length ? '—' : null}</div>
          {!!ticket.attachments.length&&<div style={{textAlign:'right',marginTop:10}}><button className="support-link" style={{border:0,background:'none'}} onClick={()=>ticket.attachments.forEach(downloadTicketAttachment)}><Icon name="download" size={13}/> Download All</button></div>}
        </Card>
        <SectionCard title="Conversation" pad="none">
          <div className="conversation">{loading ? <div style={{padding:20,color:'var(--tk-ink-400)'}}>{value('—')}</div> : ticket.messages.length?ticket.messages.map((m,i)=><div className="message" key={m.id || i}><Avatar name={m.author} size={30}/><div><div style={{display:'flex',gap:8,alignItems:'center'}}><strong style={{fontSize:12}}>{m.author}</strong><Badge tone={m.internal?'warning':'info'} style={{height:18,fontSize:9}}>{m.role}</Badge></div><div className="message-body">{m.body}</div></div><span className="message-time">{m.time}</span></div>):<div style={{padding:20,color:'var(--tk-ink-400)'}}>{ticket.messagesKnown ? 'No conversation yet.' : '—'}</div>}</div>
          <div className="reply-box"><div className="reply-tabs"><button className={tab==='Reply'?'active':''} disabled={pending} onClick={()=>setTab('Reply')}>Reply</button><button className={tab==='Internal Note'?'active':''} disabled={pending} onClick={()=>setTab('Internal Note')}>Internal Note</button></div><div className="reply-compose"><textarea aria-label={tab} placeholder={tab==='Reply'?'Type your reply...':'Add a private note for agents...'} value={reply} disabled={busy} onChange={e=>setReply(e.target.value)}/><div className="reply-actions"><input ref={fileInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseFiles}/><Button variant="ghost" icon="paperclip" aria-label="Attach file" disabled={busy} onClick={()=>fileInput.current?.click()}/><Button variant="ghost" icon="smile" aria-label="Add emoji" disabled={busy} onClick={()=>setReply(r=>r+' 🙂')}/><Button disabled={busy || !reply.trim()} onClick={send}>{tab==='Reply'?'Send Reply':'Add Note'}</Button></div></div></div>
        </SectionCard>
      </div>
      <div className="support-rail">
        <SectionCard title="Ticket Information"><div className="info-list"><div className="info-row"><label>Ticket ID</label><span>{value(ticket.id)}</span></div><div className="info-row"><label>Status</label><Select aria-label="Status" value={STATUSES.includes(ticket.status) ? ticket.status : ''} placeholder={ticket.status} options={STATUSES} disabled={busy} leadingDot="var(--tk-blue)" onChange={e=>update('status',e.target.value)}/></div><div className="info-row"><label>Priority</label><Select aria-label="Priority" value={PRIORITIES.includes(ticket.priority) ? ticket.priority : ''} placeholder={ticket.priority} options={PRIORITIES} disabled={busy} leadingDot="var(--tk-danger)" onChange={e=>update('priority',e.target.value)}/></div><div className="info-row"><label>Category</label><Select value={CATEGORIES.includes(ticket.category) ? ticket.category : ''} placeholder={ticket.category} options={CATEGORIES} disabled={busy} onChange={e=>update('category',e.target.value)}/></div><div className="info-row"><label>Sub Category</label><span>{value(ticket.subcategory)}</span></div><div className="info-row"><label>Assigned To</label><Select aria-label="Assigned To" value={assignedValue(ticket.assignedTo)} placeholder={ticket.assignee} options={agentOptions} disabled={busy || !agents.length} onChange={e=>update('assignee',e.target.value)}/></div><div className="info-row"><label>Source</label><span>{value(ticket.source)}</span></div><div className="info-row"><label>Customer</label><span>{value(ticket.company)}</span></div><div className="info-row"><label>Last Update</label><span>{value(ticket.updated)}</span></div></div></SectionCard>
        <SectionCard title="Status Timeline"><div className="timeline-item"><i style={{background:'var(--tk-success)'}}/><div><strong>{value(ticket.createdBy)}</strong><small>{value(ticket.created)}<br/>Ticket created</small></div></div><div className="timeline-item"><i/><div><strong>{value(ticket.history[0]?.actor || '—')}</strong><small>{value(ticket.history[0]?.time || '—')}<br/>{value(ticket.history[0]?.description || '—')}</small></div></div><div className="timeline-item"><i style={{background:'var(--tk-neutral)'}}/><div><strong>{value(ticket.history[1]?.actor || '—')}</strong><small>{value(ticket.history[1]?.time || '—')}</small></div></div></SectionCard>
        <SectionCard title="Quick Actions"><Action icon="circle-dot" label="Change Status" hint="Update the current status" disabled={busy || !ticket.statusCode} onClick={()=>update('status',ticket.status==='Open'?'In Progress':'Open')}/><Action icon="user-round-plus" label="Assign Ticket" hint="Assign to another agent" disabled={busy || !nextAgent} onClick={()=>update('assignee',nextAgent.id)}/><Action icon="message-square" label="Add Internal Note" hint="Add private note for agents" disabled={busy} onClick={()=>setTab('Internal Note')}/><Action icon="git-merge" label="Merge Ticket" hint="Merge with another ticket" disabled={busy || !ticket.userId} onClick={()=>setMerge(true)}/><Action danger icon="trash-2" label="Close Ticket" hint="Close this ticket" disabled={busy} onClick={()=>update('status','Closed')}/></SectionCard>
      </div>
    </div>
    <Modal open={edit} onClose={()=>{if(!pending)setEdit(false)}} title="Edit Ticket" width={560} footer={<><Button variant="outline" disabled={pending} onClick={()=>setEdit(false)}>Cancel</Button><Button disabled={busy || !Object.keys(changes).length} onClick={saveEdit}>Save Changes</Button></>}>{draft&&<div style={{display:'grid',gap:14}}><TextField label="Subject" value={draft.subject} disabled={pending} maxLength={200} onChange={e=>setDraft({...draft,subject:e.target.value})}/><Select label="Priority" value={PRIORITIES.includes(draft.priority) ? draft.priority : ''} placeholder={draft.priority} options={PRIORITIES} disabled={pending} onChange={e=>setDraft({...draft,priority:e.target.value})}/><Select label="Category" value={CATEGORIES.includes(draft.category) ? draft.category : ''} placeholder={draft.category} options={CATEGORIES} disabled={pending} onChange={e=>setDraft({...draft,category:e.target.value})}/><Select label="Assigned To" value={assignedValue(draft.assignedTo)} placeholder={draft.assignee} options={agentOptions} disabled={pending || !agents.length} onChange={e=>setDraft({...draft,assignedTo:e.target.value})}/></div>}</Modal>
    {merge&&<TicketMergeDialog ticket={ticket} authenticated={authenticated} saving={pending} onMerge={mergeInto} onClose={()=>setMerge(false)}/>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
