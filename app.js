
const URL_DB="https://kapzuwhpjbfeofetuqbo.supabase.co";
const KEY="sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";
const OWNER="t8505243@gmail.com",LIMIT=10e12;
const db=window.supabase.createClient(URL_DB,KEY);
const $=id=>document.getElementById(id);
let user=null,files=[],mode="login",preview=null;

const css=document.createElement("style");
css.textContent=`
.fc-modal{position:fixed;inset:0;z-index:99999;background:#000d;display:flex;align-items:center;justify-content:center;padding:14px}
.fc-window{width:min(900px,100%);max-height:92vh;overflow:auto;background:#111a30;color:white;border:1px solid #34415d;border-radius:16px;padding:18px}
.fc-window img{max-width:100%;max-height:70vh;display:block;margin:auto;object-fit:contain}
.fc-window video{width:100%;max-height:70vh;background:black}
.fc-editor{width:100%;min-height:55vh;box-sizing:border-box;background:#080f20;color:white;padding:14px}
.fc-download-input{width:100%;box-sizing:border-box;padding:13px;margin:15px 0;background:#080f20;color:white}
.fc-actions,.file-item{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.fc-quota{height:8px;background:#29334b;border-radius:10px;overflow:hidden}
.fc-quota div{height:100%;background:#7164f5}
.file-item{padding:14px;border:1px solid #34415d;border-radius:12px;align-items:center}
.file-item strong{overflow-wrap:anywhere;flex:1}
`;
document.head.appendChild(css);

function notify(m){
 const t=$("toast");if(!t)return;
 t.textContent=m;t.classList.add("show");
 setTimeout(()=>t.classList.remove("show"),3500);
}
const unlimited=()=>user?.email?.toLowerCase()===OWNER;
const size=n=>{if(!n)return"0 B";let u=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4);return(n/1024**i).toFixed(2)+" "+u[i]};
const fsize=f=>Number(f.metadata?.size||0);
function type(f){
 let n=f.name.toLowerCase(),m=f.metadata?.mimetype||"";
 if(m.startsWith("image/")||/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(n))return"image";
 if(m.startsWith("video/")||/\.(mp4|webm|mov|m4v|ogv)$/.test(n))return"video";
 if(/\.(txt|md|json|csv|log|html|css|js|xml)$/.test(n))return"text";
 return"other";
}
const path=f=>`${user.id}/${f.name}`;

function authUI(){
 $("authPanel").classList.remove("hidden");
 $("storagePanel").classList.add("hidden");
 $("userEmail").textContent="Not signed in";
 $("accountStatus").textContent="Connect your account";
 $("avatar").textContent="?";
 $("signOutBtn").classList.add("hidden");
}
function storageUI(){
 $("authPanel").classList.add("hidden");
 $("storagePanel").classList.remove("hidden");
 $("userEmail").textContent=user.email;
 $("accountStatus").textContent=unlimited()?"Unlimited account":"10 TB account";
 $("avatar").textContent=user.email[0].toUpperCase();
 $("signOutBtn").classList.remove("hidden");
}
function setMode(m){
 mode=m;
 $("loginTab").classList.toggle("selected",m==="login");
 $("signupTab").classList.toggle("selected",m==="signup");
 $("authSubmit").textContent=m==="login"?"Sign in →":"Create account →";
 $("authMessage").textContent=m==="login"?"Use your email and password to continue.":"Create your private cloud account.";
}
$("loginTab").onclick=()=>setMode("login");
$("signupTab").onclick=()=>setMode("signup");

$("authForm").onsubmit=async e=>{
 e.preventDefault();
 let email=$("emailInput").value.trim(),password=$("passwordInput").value,b=$("authSubmit");
 b.disabled=true;b.textContent="Please wait...";
 try{
  let r=mode==="login"
   ?await db.auth.signInWithPassword({email,password})
   :await db.auth.signUp({email,password,options:{emailRedirectTo:"https://mycloudstoragegithubio.vercel.app/"}});
  if(r.error)throw r.error;
  if(r.data.session){
   user=r.data.user;storageUI();await loadFiles();notify("Welcome to Forever Cloud!");
  }else notify("Check your email to confirm your account.");
 }catch(e){notify(e.message);$("authMessage").textContent=e.message}
 finally{b.disabled=false;setMode(mode)}
};

$("signOutBtn").onclick=async()=>{
 let{error}=await db.auth.signOut();
 if(error)return notify(error.message);
 user=null;files=[];authUI();notify("Signed out!");
};

function quota(){
 let used=files.reduce((s,f)=>s+fsize(f),0);
 $("storageUsed").textContent=size(used);
 $("storageHint").textContent=unlimited()?"Unlimited account quota. Provider limits still apply.":`${size(Math.max(0,LIMIT-used))} remaining of 10 TB`;
 if(unlimited())return;
 let bar=$("fcQuotaBar");
 if(!bar){
  bar=document.createElement("div");bar.id="fcQuotaBar";bar.className="fc-quota";
  $("storagePanel").querySelector(".storage-summary").append(bar);
 }
 bar.innerHTML=`<div style="width:${Math.min(100,used/LIMIT*100)}%"></div>`;
}

async function uploadFile(file){
 if(!user||!file)return false;
 let used=files.reduce((s,f)=>s+fsize(f),0);
 if(!unlimited()&&used+file.size>LIMIT){notify("10 TB storage limit reached!");return false}
 let name=file.name.replace(/[\\/]/g,"_"),p=`${user.id}/${Date.now()}_${name}`;
 try{
  notify("Uploading "+file.name+"...");
  let{error}=await db.storage.from("user-files").upload(p,file,{contentType:file.type||"application/octet-stream"});
  if(error)throw error;
  await loadFiles();notify("Upload successful!");return true;
 }catch(e){notify("Upload failed: "+e.message);return false}
}

["browseBtn","uploadTopBtn","emptyUploadBtn"].forEach(id=>{
 $(id).onclick=()=>$("fileInput").click();
});
$("fileInput").onchange=async e=>{
 for(let f of e.target.files)await uploadFile(f);
 e.target.value="";
};

function closeModal(){
 $("fcModal")?.remove();
 if(preview){URL.revokeObjectURL(preview);preview=null}
}
function modal(title){
 closeModal();
 let m=document.createElement("div");m.id="fcModal";m.className="fc-modal";
 let w=document.createElement("div");w.className="fc-window";
 let h=document.createElement("h2");h.textContent=title;
 let c=document.createElement("button");c.textContent="✕ Close";c.onclick=closeModal;
 w.append(h,c);m.append(w);document.body.append(m);
 m.onclick=e=>{if(e.target===m)closeModal()};
 return w;
}

function downloadPopup(){
 if(!user)return notify("Please sign in first!");
 let box=modal("Download from Link");
 let p=document.createElement("p");p.textContent="Paste a direct file download URL.";
 let input=document.createElement("input");input.className="fc-download-input";input.placeholder="https://example.com/file.zip";input.type="url";
 let status=document.createElement("p");status.textContent="Ready.";
 let actions=document.createElement("div");actions.className="fc-actions";
 let b=document.createElement("button");b.textContent="↓ Download to my cloud";
 let cancel=document.createElement("button");cancel.textContent="Cancel";cancel.onclick=closeModal;
 b.onclick=async()=>{
  try{
   let url=new URL(input.value.trim());
   if(!["http:","https:"].includes(url.protocol))throw Error("Invalid URL");
   b.disabled=true;b.textContent="Downloading...";status.textContent="Connecting...";
   let r=await fetch(url.href);
   if(!r.ok)throw Error("Server error "+r.status);
   let blob=await r.blob();
   if(!blob.size)throw Error("Empty file");
   let name=decodeURIComponent(url.pathname.split("/").pop()||"download");
   name=name.replace(/[\\/:*?"<>|]/g,"_");
   let cd=r.headers.get("content-disposition"),match=cd?.match(/filename="?([^";]+)"?/i);
   if(match)name=match[1].trim();
   status.textContent="Uploading "+size(blob.size)+"...";
   if(!await uploadFile(new File([blob],name,{type:blob.type||"application/octet-stream"})))throw Error("Upload failed");
   status.textContent="Saved successfully!";b.textContent="✓ Complete";setTimeout(closeModal,1300);
  }catch(e){status.textContent="Failed: "+e.message+" (The source may block browser downloads with CORS.)";b.disabled=false;b.textContent="Try again"}
 };
 input.onkeydown=e=>{if(e.key==="Enter")b.click()};
 actions.append(b,cancel);box.append(p,input,actions,status);
}
document.addEventListener("click",e=>{
 if(e.target.closest("#downloadLinkBtn")){e.preventDefault();downloadPopup()}
});

$("dropZone").addEventListener("dragover",e=>e.preventDefault());
$("dropZone").addEventListener("drop",async e=>{
 e.preventDefault();for(let f of e.dataTransfer.files)await uploadFile(f);
});

async function loadFiles(){
 if(!user)return;
 try{
  let{data,error}=await db.storage.from("user-files").list(user.id,{limit:100,sortBy:{column:"created_at",order:"desc"}});
  if(error)throw error;
  files=(data||[]).filter(f=>f.name);displayFiles();
 }catch(e){notify("Loading failed: "+e.message)}
}

function displayFiles(){
 let grid=$("fileGrid");grid.innerHTML="";
 let q=$("searchInput").value.toLowerCase();
 let list=files.filter(f=>f.name.toLowerCase().includes(q));
 let sort=$("sortSelect").value;
 if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name));
 else if(sort==="largest")list.sort((a,b)=>fsize(b)-fsize(a));
 else{list.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));if(sort==="oldest")list.reverse()}
 $("fileCount").textContent=files.length+" files";
 $("visibleCount").textContent=list.length;
 $("emptyState").classList.toggle("hidden",files.length>0);
 quota();
 for(let f of list){
  let t=type(f),item=document.createElement("div");item.className="file-item";
  let n=document.createElement("strong");n.textContent=(t==="image"?"🖼️ ":t==="video"?"🎬 ":t==="text"?"📝 ":"📄 ")+f.name;
  let s=document.createElement("small");s.textContent=size(fsize(f));
  let open=document.createElement("button");open.textContent=t==="text"?"Edit":t==="other"?"Open":"View";open.onclick=()=>openFile(f);
  let d=document.createElement("button");d.textContent="Download";d.onclick=()=>downloadFile(f);
  let x=document.createElement("button");x.textContent="Delete";x.onclick=()=>deleteFile(f);
  item.append(n,s,open,d,x);grid.append(item);
 }
}
$("searchInput").oninput=displayFiles;
$("sortSelect").onchange=displayFiles;

async function getBlob(f){
 let{data,error}=await db.storage.from("user-files").download(path(f));
 if(error)throw error;return data;
}
async function downloadFile(f){
 try{
  let blob=await getBlob(f),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=f.name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }catch(e){notify("Download failed: "+e.message)}
}
async function deleteFile(f){
 if(!confirm("Delete "+f.name+"?"))return;
 try{
  let{error}=await db.storage.from("user-files").remove([path(f)]);
  if(error)throw error;notify("Deleted!");await loadFiles();
 }catch(e){notify("Delete failed: "+e.message)}
}

async function openFile(f){
 let t=type(f);if(t==="other")return downloadFile(f);
 let box=modal(f.name),loading=document.createElement("p");loading.textContent="Loading...";
 box.append(loading);
 try{
  let blob=await getBlob(f);loading.remove();preview=URL.createObjectURL(blob);
  if(t==="image"){let img=document.createElement("img");img.src=preview;box.append(img)}
  if(t==="video"){let v=document.createElement("video");v.src=preview;v.controls=true;v.playsInline=true;box.append(v)}
  if(t==="text"){
   let editor=document.createElement("textarea");editor.className="fc-editor";editor.spellcheck=false;editor.value=await blob.text();box.append(editor);
   let save=document.createElement("button");save.textContent="Save changes";save.onclick=async()=>{
    save.disabled=true;
    try{
     let{error}=await db.storage.from("user-files").upload(path(f),new Blob([editor.value],{type:"text/plain;charset=utf-8"}),{upsert:true,contentType:"text/plain"});
     if(error)throw error;notify("Saved!");await loadFiles();
    }catch(e){notify("Save failed: "+e.message)}
    save.disabled=false;
   };box.append(save);
  }
 }catch(e){loading.textContent="Could not open: "+e.message}
}

async function init(){
 let{data}=await db.auth.getSession();
 if(data.session){user=data.session.user;storageUI();await loadFiles()}
 else authUI();
 db.auth.onAuthStateChange(async(event,session)=>{
  if(session){user=session.user;storageUI();await loadFiles()}
  else{user=null;files=[];authUI()}
 });
}
init();
  
