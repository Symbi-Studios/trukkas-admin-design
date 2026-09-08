import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import { Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, Modal, Pagination, Sparkline, Textarea } from '../ds.js';
import './Operations.css';

const initialTrips=[
 ['TRP-98231','JOB-29821','Apapa Port','Ikeja Warehouse','LND-234-XZ','John Adewale','In Transit','14:35','28 km',66,2],
 ['TRP-98230','JOB-29820','Tin Can Port','Victoria Island','KJA-112-BD','T. James','At Pickup','11:20','3.2 km',25,1],
 ['TRP-98229','JOB-29819','Ikeja Warehouse','Ajah Depot','LAG-445-KJ','A. Ibrahim','At Delivery','10:40','1.1 km',90,3],
 ['TRP-98228','JOB-29818','Lekki Warehouse','Apapa Port','ENU-221-TA','O. Chinedu','Returning Container','18:25','15 km',40,1],
 ['TRP-98227','JOB-29817','PH Port','Aba Enugu Road','RIV-998-PO','S. Musa','Delayed','20:10','+1h 25m',70,2],
 // JOB-29821 needed a second truck from the forwarder, so it has two trips running the same route.
 ['TRP-98232','JOB-29821','Apapa Port','Ikeja Warehouse','EKY-778-QP','Grace Okoro','At Pickup','15:10','26 km',20,1],
].map(r=>({id:r[0],job:r[1],from:r[2],to:r[3],truck:r[4],driver:r[5],status:r[6],eta:r[7],distance:r[8],progress:r[9],segment:r[10]}));

const tones={'In Transit':'success','At Pickup':'purple','At Delivery':'orange','Returning Container':'teal',Delayed:'danger'};
const TRIP_STATUSES=['In Transit','At Pickup','At Delivery','Returning Container','Delayed'];
const PAGE_SIZE=10;

function Metric({label,value,delta,icon,color='#4c16ac',down=false}){
 return <Card className="metric-card"><label>{label}</label><strong>{value}</strong><span className={'delta '+(down?'down':'')}>{down?'↓':'↑'} {delta}</span><small>vs May 17 – May 23</small><i className="metric-icon" style={{color,background:color+'12'}}><Icon name={icon} size={20}/></i><Sparkline points={[2,3,3,5,4,7]} color={color}/></Card>;
}

export function TripsSegments(){
 const navigate=useNavigate();
 const [trips,setTrips]=useState(initialTrips);
 const [page,setPage]=useState(1);
 const [statusFilter,setStatusFilter]=useState('All Trips');
 const [originFilter,setOriginFilter]=useState('All Locations');
 const [destFilter,setDestFilter]=useState('All Locations');
 const [driverFilter,setDriverFilter]=useState('All Drivers');
 const [openFilter,setOpenFilter]=useState(null);
 const [selectedId,setSelectedId]=useState(null);
 const [zoom,setZoom]=useState(100);
 const [contactOpen,setContactOpen]=useState(false);
 const [message,setMessage]=useState('');
 const [menuFor,setMenuFor]=useState(null);
 const [toast,setToast]=useState(null);

 useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),2600); return ()=>clearTimeout(t); },[toast]);
 useEffect(()=>{ setPage(1); },[statusFilter,originFilter,destFilter,driverFilter]);

 const origins=useMemo(()=>[...new Set(trips.map(t=>t.from))],[trips]);
 const destinations=useMemo(()=>[...new Set(trips.map(t=>t.to))],[trips]);
 const drivers=useMemo(()=>[...new Set(trips.map(t=>t.driver))],[trips]);

 const filtered=useMemo(()=>trips.filter(t=>
  (statusFilter==='All Trips'||t.status===statusFilter) &&
  (originFilter==='All Locations'||t.from===originFilter) &&
  (destFilter==='All Locations'||t.to===destFilter) &&
  (driverFilter==='All Drivers'||t.driver===driverFilter)
 ),[trips,statusFilter,originFilter,destFilter,driverFilter]);

 const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const selectedTrip=trips.find(t=>t.id===selectedId)||null;
 const siblingTrips=selectedTrip?trips.filter(t=>t.job===selectedTrip.job && t.id!==selectedTrip.id):[];

 function updateTripStatus(id,status){
  setTrips(ts=>ts.map(t=>t.id===id?{...t,status}:t));
  setMenuFor(null);
  setToast({tone:status==='Delayed'?'warning':'success',title:`${id} marked as ${status}`});
 }
 function selectTrip(t){ setSelectedId(t.id); setZoom(100); setContactOpen(false); setMessage(''); }
 function closeTrip(){ setSelectedId(null); setContactOpen(false); setMessage(''); }
 function resetFilters(){
  setStatusFilter('All Trips'); setOriginFilter('All Locations'); setDestFilter('All Locations'); setDriverFilter('All Drivers');
  setOpenFilter(null); setPage(1);
 }
 function sendMessage(){
  if(!message.trim()) return;
  setToast({tone:'success',title:`Message sent to ${selectedTrip.driver}.`});
  setContactOpen(false); setMessage('');
 }

 const cols=[
  {key:'id',header:'Trip ID',render:r=><a onClick={()=>selectTrip(r)} style={{cursor:'pointer'}}>{r.id}</a>},{key:'job',header:'Job ID'},
  {key:'type',header:'Trip Type',render:()=> <Badge tone="purple">Import (Container)</Badge>},
  {key:'route',header:'Route',render:r=><span className="route-cell">{r.from}　→　{r.to}</span>},{key:'driver',header:'Driver'},
  {key:'truck',header:'Truck / Container',render:r=><span className="cell-two"><strong>{r.truck}</strong><small>MSKU 4567893</small></span>},
  {key:'segment',header:'Current Segment',render:r=>r.segment+' / 3'},{key:'status',header:'Status',render:r=><Badge tone={tones[r.status]} dot>{r.status}</Badge>},
  {key:'eta',header:'ETA',render:r=><span className="cell-two"><strong>{r.eta}</strong><small>{r.distance}</small></span>},
  {key:'progress',header:'Progress',render:r=><span>{r.progress}%　<progress value={r.progress} max="100"/></span>},
  {key:'a',header:'Actions',render:r=><span style={{position:'relative'}}>
    <button className="row-actions" onClick={e=>{e.stopPropagation(); setMenuFor(menuFor===r.id?null:r.id);}}>•••</button>
    {menuFor===r.id && <span style={{position:'absolute',right:0,top:34,zIndex:30}} onClick={e=>e.stopPropagation()}>
     <DropdownMenu width={200} items={[
      {label:'View Trip',icon:'eye',onClick:()=>{setMenuFor(null); selectTrip(r);}},
      {label:'View Job',icon:'briefcase-business',onClick:()=>{setMenuFor(null); navigate('/jobs/'+r.job);}},
      {divider:true},
      ...TRIP_STATUSES.filter(s=>s!==r.status).map(s=>({label:'Mark as '+s,icon:'route',onClick:()=>updateTripStatus(r.id,s)})),
     ]}/>
    </span>}
   </span>},
 ];

 return <div className="operations-screen"><div className="screen-head"><div><div className="tk-meta">Jobs & Trips　›　Trips & Segments</div><h1>Trips & Segments</h1><p>Monitor all active trips and their segment execution in real-time.</p></div>
 <div className="head-actions">
  <button className="date-button"><Icon name="calendar" size={15}/>May 24 – May 30, 2026⌄</button>
  <Button icon="plus" onClick={()=>setToast({tone:'info',title:`Exporting ${filtered.length} trip(s)…`})}>Export</Button>
 </div></div>

 {toast && <Banner tone={toast.tone} title={toast.title}/>}

 <div className="kpi-grid"><Metric label="All Trips" value="1,586" delta="12.6%" icon="briefcase-business"/><Metric label="In Transit" value="186" delta="8.3%" icon="route" color="#12a150"/><Metric label="At Pickup" value="28" delta="16.4%" icon="truck" color="#2469e8"/><Metric label="At Delivery" value="51" delta="6.9%" icon="clipboard-check" color="#f5a524"/><Metric label="Returning Container" value="34" delta="14.2%" icon="layers" color="#0e9f9a"/><Metric label="Delayed" value="28" delta="15.6%" icon="clock" color="#e02b22" down/></div>

 <div className="ops-panel">
  <div className="ops-panel-head"><div><h3>All Trips <small>({filtered.length})</small></h3><p>Click a trip to view its live map and details.</p></div></div>

  <div className="jobs-filters">
   <span style={{position:'relative'}}>
    <button className={'jobs-filter'+(statusFilter!=='All Trips'?' active':'')} onClick={()=>setOpenFilter(openFilter==='status'?null:'status')}><span>Trip Status</span>{statusFilter}</button>
    {openFilter==='status' && <span style={{position:'absolute',left:0,top:52,zIndex:30}}><DropdownMenu width={200} items={['All Trips',...TRIP_STATUSES].map(s=>({label:s,icon:s===statusFilter?'check':undefined,onClick:()=>{setStatusFilter(s);setOpenFilter(null);}}))}/></span>}
   </span>
   <span style={{position:'relative'}}>
    <button className={'jobs-filter'+(originFilter!=='All Locations'?' active':'')} onClick={()=>setOpenFilter(openFilter==='origin'?null:'origin')}><span>Origin</span>{originFilter}</button>
    {openFilter==='origin' && <span style={{position:'absolute',left:0,top:52,zIndex:30}}><DropdownMenu width={200} items={['All Locations',...origins].map(s=>({label:s,icon:s===originFilter?'check':undefined,onClick:()=>{setOriginFilter(s);setOpenFilter(null);}}))}/></span>}
   </span>
   <span style={{position:'relative'}}>
    <button className={'jobs-filter'+(destFilter!=='All Locations'?' active':'')} onClick={()=>setOpenFilter(openFilter==='dest'?null:'dest')}><span>Destination</span>{destFilter}</button>
    {openFilter==='dest' && <span style={{position:'absolute',left:0,top:52,zIndex:30}}><DropdownMenu width={200} items={['All Locations',...destinations].map(s=>({label:s,icon:s===destFilter?'check':undefined,onClick:()=>{setDestFilter(s);setOpenFilter(null);}}))}/></span>}
   </span>
   <span style={{position:'relative'}}>
    <button className={'jobs-filter'+(driverFilter!=='All Drivers'?' active':'')} onClick={()=>setOpenFilter(openFilter==='driver'?null:'driver')}><span>Driver</span>{driverFilter}</button>
    {openFilter==='driver' && <span style={{position:'absolute',left:0,top:52,zIndex:30}}><DropdownMenu width={200} items={['All Drivers',...drivers].map(s=>({label:s,icon:s===driverFilter?'check':undefined,onClick:()=>{setDriverFilter(s);setOpenFilter(null);}}))}/></span>}
   </span>
   <button className="jobs-filter"><span>Date Range</span>May 24 – May 30, 2026</button>
   <span style={{position:'relative'}}>
    <Button variant="outline" icon="list-filter" onClick={()=>setOpenFilter(openFilter==='quick'?null:'quick')}>Filters</Button>
    {openFilter==='quick' && <span style={{position:'absolute',right:0,top:44,zIndex:30}}><DropdownMenu width={210} items={[
     {section:'QUICK FILTERS'},
     {label:'Delayed Trips Only',icon:'clock',onClick:()=>{setStatusFilter('Delayed');setOpenFilter(null);}},
     {label:'Returning Container Only',icon:'layers',onClick:()=>{setStatusFilter('Returning Container');setOpenFilter(null);}},
    ]}/></span>}
   </span>
   <Button variant="outline" icon="rotate-cw" onClick={resetFilters}>Reset</Button>
  </div>

  {filtered.length===0
   ? <div style={{padding:'40px 18px',textAlign:'center'}} className="tk-meta">No trips match the current filters.</div>
   : <DataTable rows={paged} columns={cols} onRowClick={selectTrip}/>}
  <Pagination page={page} pageCount={Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))} total={filtered.length} onPage={setPage} onPageSize={()=>{}}/>
 </div>

 <Modal open={!!selectedTrip} onClose={closeTrip} width={640}
  title={selectedTrip?.id} description={selectedTrip?`${selectedTrip.from}　→　${selectedTrip.to}`:''}>
  {selectedTrip && (contactOpen ? (
   <div style={{display:'grid',gap:14}}>
    <div className="trip-fact"><span>To</span><b>{selectedTrip.driver}　·　{selectedTrip.truck}</b></div>
    <Textarea label="Message" placeholder={`Write a message to ${selectedTrip.driver}...`} rows={5}
     value={message} onChange={e=>setMessage(e.target.value)}/>
    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
     <Button variant="outline" onClick={()=>setContactOpen(false)}>Back</Button>
     <Button icon="send" disabled={!message.trim()} onClick={sendMessage}>Send Message</Button>
    </div>
   </div>
  ) : (
   <div style={{display:'grid',gap:14}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
     <Badge tone={tones[selectedTrip.status]} dot>{selectedTrip.status}</Badge>
     <span style={{color:'var(--tk-success)',fontSize:11,fontWeight:600}}>● Live</span>
    </div>
    <div style={{height:220,borderRadius:10,border:'1.5px dashed var(--tk-line-strong)',background:'var(--tk-surface-sunk)',display:'grid',placeItems:'center',gap:8,textAlign:'center',color:'var(--tk-ink-300)',position:'relative'}}>
     <div className="trip-map-controls" style={{position:'absolute',right:10,top:10}}>
      <button onClick={()=>setZoom(z=>Math.min(z+20,200))}>+</button>
      <button onClick={()=>setZoom(z=>Math.max(z-20,40))}>−</button>
      <button onClick={()=>setZoom(100)}>⌖</button>
     </div>
     <Icon name="map" size={30}/>
     <strong style={{color:'var(--tk-ink-500)',font:'600 13px var(--tk-font-sans)'}}>Map view placeholder</strong>
     <span className="tk-meta">Zoom {zoom}%</span>
    </div>
    {[['Driver',selectedTrip.driver],['Truck',selectedTrip.truck],['Job ID',selectedTrip.job],['Container','MSKU 4567893 (40FT HC)'],['Trip Type','Import (Container)'],['Current Segment',selectedTrip.segment+' of 3'],['Distance Left',selectedTrip.distance],['ETA',selectedTrip.eta]].map(x=><div className="trip-fact" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}
    {siblingTrips.length>0 && <div className="approval-note">
     {selectedTrip.job} has {siblingTrips.length+1} trips (multiple trucks requested by the forwarder) — also see {siblingTrips.map(t=>t.id).join(', ')}.
    </div>}
    <div style={{display:'flex',gap:8}}>
     <Button variant="outline" style={{flex:1}} disabled={selectedTrip.status==='Delayed'} onClick={()=>updateTripStatus(selectedTrip.id,'Delayed')}>Mark Delayed</Button>
     <Button variant="outline" style={{flex:1}} disabled={selectedTrip.status==='At Delivery'} onClick={()=>updateTripStatus(selectedTrip.id,'At Delivery')}>Mark At Delivery</Button>
    </div>
    <div style={{display:'flex',gap:8}}>
     <Button icon="message-circle" style={{flex:1}} onClick={()=>setContactOpen(true)}>Contact Driver</Button>
     <Button variant="outline" style={{flex:1}} onClick={()=>navigate('/jobs/'+selectedTrip.job)}>View Job Details</Button>
    </div>
   </div>
  ))}
 </Modal>
 </div>;
}
