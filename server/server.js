import express from 'express';
import cors from 'cors';
import webpush from 'web-push';

const app=express(); app.use(cors()); app.use(express.json({limit:'1mb'}));
const subscriptions=new Set();
const publicKey=process.env.VAPID_PUBLIC_KEY; const privateKey=process.env.VAPID_PRIVATE_KEY; const subject=process.env.VAPID_SUBJECT||'mailto:you@example.com';
if(publicKey&&privateKey) webpush.setVapidDetails(subject,publicKey,privateKey);

app.get('/health',(_,res)=>res.json({ok:true,subscriptions:subscriptions.size}));
app.post('/subscribe',(req,res)=>{subscriptions.add(JSON.stringify(req.body));res.json({ok:true})});
app.post('/push',async(req,res)=>{
  if(!publicKey||!privateKey) return res.status(500).json({error:'VAPID keys not configured'});
  const payload=JSON.stringify({title:req.body.title||'青笺',body:req.body.body||'你有一条新消息',url:req.body.url||'/'});
  let sent=0;
  for(const raw of [...subscriptions]){try{await webpush.sendNotification(JSON.parse(raw),payload);sent++}catch(e){if(e.statusCode===404||e.statusCode===410)subscriptions.delete(raw)}}
  res.json({ok:true,sent});
});
app.listen(process.env.PORT||8787,()=>console.log(`push server on :${process.env.PORT||8787}`));
