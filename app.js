const URL_DB = "https://kapzuwhpjbfeofetuqbo.supabase.co";
const KEY = "sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";
const OWNER = "t8505243@gmail.com", LIMIT = 10e12;
const db = window.supabase.createClient(URL_DB, KEY);
const $ = id => document.getElementById(id);

let user = null, files = [], mode = "login", preview = null;

const css = document.createElement("style");
css.textContent = `
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

function notify(m) {
  const t = $("toast");
  if (!t) return;
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

const unlimited = () =>
  user?.email?.toLowerCase() === OWNER.toLowerCase();

const size = n => {
  if (!n) return "0 B";
  const u = ["B","KB","MB","GB","TB","PB"];
  const i = Math.min(Math.floor(Math.log(n)/Math.log(1024)),5);
  return (n/1024**i).toFixed(2)+" "+u[i];
};

const fsize = f => Number(f.metadata?.size || 0);
const path = f => `${user.id}/${f.name}`;

function type(f) {
  const n = f.name.toLowerCase();
  const m = f.metadata?.mimetype || "";
  if (m.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(n)) return "video";
  if (m.startsWith("text/") || /\.(txt|md|json|csv|log|html|css|js|xml|yaml|yml)$/.test(n)) return "text";
  return "other";
}

function authUI() {
  $("authPanel")?.classList.remove("hidden");
  $("storagePanel")?.classList.add("hidden");
  if ($("userEmail")) $("userEmail").textContent = "Not signed in";
  if ($("accountStatus")) $("accountStatus").textContent = "Connect your account";
  if ($("avatar")) $("avatar").textContent = "?";
  $("signOutBtn")?.classList.add("hidden");
}

function storageUI() {
  $("authPanel")?.classList.add("hidden");
  $("storagePanel")?.classList.remove("hidden");
  if ($("userEmail")) $("userEmail").textContent = user.email;
  if ($("accountStatus")) $("accountStatus").textContent = unlimited() ? "Unlimited account" : "10 TB account";
  if ($("avatar")) $("avatar").textContent = (user.email?.[0] || "U").toUpperCase();
  $("signOutBtn")?.classList.remove("hidden");
}

function setMode(m) {
  mode = m;
  $("loginTab")?.classList.toggle("selected",m==="login");
  $("signupTab")?.classList.toggle("selected",m==="signup");
  if ($("authSubmit")) $("authSubmit").textContent = m==="login" ? "Sign in →" : "Create account →";
  if ($("authMessage")) $("authMessage").textContent =
    m==="login" ? "Use your email and password to continue." : "Create your private cloud account.";
}

if ($("loginTab")) $("loginTab").onclick = () => setMode("login");
if ($("signupTab")) $("signupTab").onclick = () => setMode("signup");

if ($("authForm")) $("authForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const b = $("authSubmit");
  b.disabled = true;
  b.textContent = "Please wait...";

  try {
    const r = mode === "login"
      ? await db.auth.signInWithPassword({email,password})
      : await db.auth.signUp({
          email,password,
          options:{emailRedirectTo:"https://mycloudstoragegithubio.vercel.app/"}
        });

    if (r.error) throw r.error;

    if (r.data.session) {
      user = r.data.user;
      storageUI();
      await loadFiles();
      notify("Welcome to Forever Cloud!");
    } else {
      notify("Check your email to confirm your account.");
    }
  } catch (e) {
    notify(e.message);
    if ($("authMessage")) $("authMessage").textContent = e.message;
  } finally {
    b.disabled = false;
    setMode(mode);
  }
};

if ($("signOutBtn")) $("signOutBtn").onclick = async () => {
  const {error} = await db.auth.signOut();
  if (error) return notify(error.message);
  user = null;
  files = [];
  closeModal();
  authUI();
  notify("Signed out!");
};

function quota() {
  const used = files.reduce((s,f)=>s+fsize(f),0);
  if ($("storageUsed")) $("storageUsed").textContent = size(used);
  if ($("storageHint")) $("storageHint").textContent =
    unlimited() ? "Unlimited account quota. Provider limits still apply."
    : `${size(Math.max(0,LIMIT-used))} remaining of 10 TB`;

  if (unlimited()) {
    $("fcQuotaBar")?.remove();
    return;
  }

  let bar = $("fcQuotaBar");
  const summary = $("storagePanel")?.querySelector(".storage-summary");

  if (!bar && summary) {
    bar = document.createElement("div");
    bar.id = "fcQuotaBar";
    bar.className = "fc-quota";
    summary.append(bar);
  }

  if (bar) bar.innerHTML =
    `<div style="width:${Math.min(100,used/LIMIT*100)}%"></div>`;
}

async function uploadFile(file) {
  if (!user || !file) return false;

  const used = files.reduce((s,f)=>s+fsize(f),0);
  if (!unlimited() && used+file.size > LIMIT) {
    notify("10 TB storage limit reached!");
    return false;
  }

  const name = file.name.replace(/[\\/:*?"<>|]/g,"_");
  const p = `${user.id}/${Date.now()}_${name}`;

  try {
    notify("Uploading "+name+"...");
    const {error} = await db.storage.from("user-files").upload(p,file,{
      contentType:file.type || "application/octet-stream"
    });
    if (error) throw error;
    await loadFiles(true);
    notify("Upload successful!");
    return true;
  } catch(e) {
    notify("Upload failed: "+e.message);
    return false;
  }
}

["browseBtn","uploadTopBtn","emptyUploadBtn"].forEach(id => {
  if ($(id)) $(id).onclick = () => $("fileInput")?.click();
});

if ($("fileInput")) $("fileInput").onchange = async e => {
  const selected = Array.from(e.target.files || []);
  e.target.value = "";
  for (const f of selected) await uploadFile(f);
};

function closeModal() {
  $("fcModal")?.remove();
  if (preview) {
    URL.revokeObjectURL(preview);
    preview = null;
  }
}

function modal(title) {
  closeModal();
  const m = document.createElement("div");
  m.id = "fcModal";
  m.className = "fc-modal";

  const w = document.createElement("div");
  w.className = "fc-window";

  const h = document.createElement("h2");
  h.textContent = title;

  const c = document.createElement("button");
  c.textContent = "✕ Close";
  c.onclick = closeModal;

  w.append(h,c);
  m.append(w);
  document.body.append(m);
  m.onclick = e => {
    if (e.target === m) closeModal();
  };
  return w;
}

// FIXED: Server-side download using quick-worker.
// No browser fetch of the remote URL.
function downloadPopup() {
  if (!user) return notify("Please sign in first!");

  const box = modal("Download from Link");

  const p = document.createElement("p");
  p.textContent = "Paste a direct file download URL.";

  const input = document.createElement("input");
  input.className = "fc-download-input";
  input.placeholder = "https://example.com/file.zip";
  input.type = "url";

  const status = document.createElement("p");
  status.textContent = "Ready.";

  const actions = document.createElement("div");
  actions.className = "fc-actions";

  const b = document.createElement("button");
  b.textContent = "↓ Download to my cloud";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  b.onclick = async () => {
    try {
      const url = new URL(input.value.trim());

      if (!["http:","https:"].includes(url.protocol))
        throw new Error("Only HTTP and HTTPS links are supported.");

      b.disabled = true;
      b.textContent = "Downloading...";
      status.textContent = "Connecting to Forever Cloud server...";

      const {data,error} = await db.functions.invoke("quick-worker", {
        body:{url:url.href}
      });

      if (error) throw error;
      if (!data?.success)
        throw new Error(data?.error || "Server download failed.");

      status.textContent = "Saved successfully!";
      b.textContent = "✓ Complete";
      notify("Saved "+data.filename+" to cloud!");

      await loadFiles(true);
      setTimeout(closeModal,1300);

    } catch(e) {
      status.textContent = "Download failed: "+e.message;
      b.disabled = false;
      b.textContent = "Try again";
    }
  };

  input.onkeydown = e => {
    if (e.key==="Enter" && !b.disabled) b.click();
  };

  actions.append(b,cancel);
  box.append(p,input,actions,status);
}

document.addEventListener("click",e => {
  if (e.target.closest("#downloadLinkBtn")) {
    e.preventDefault();
    downloadPopup();
  }
});

if ($("dropZone")) {
  $("dropZone").addEventListener("dragover",e=>e.preventDefault());
  $("dropZone").addEventListener("drop",async e=>{
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer?.files || []))
      await uploadFile(f);
  });
}

async function fetchAllUserFiles() {
  let offset = 0;
  const all = [];

  while (true) {
    const {data,error} = await db.storage.from("user-files").list(user.id,{
      limit:100,
      offset,
      sortBy:{column:"created_at",order:"desc"}
    });

    if (error) throw error;

    const batch = (data || []).filter(f=>f?.name);
    all.push(...batch);

    if ((data || []).length < 100) break;
    offset += 100;
  }

  return all;
}

async function loadFiles() {
  if (!user) return;

  try {
    files = await fetchAllUserFiles();
    displayFiles();
  } catch(e) {
    notify("Loading failed: "+e.message);
  }
}

function displayFiles() {
  const grid = $("fileGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const q = ($("searchInput")?.value || "").toLowerCase();
  const list = files.filter(f=>f.name.toLowerCase().includes(q));
  const sort = $("sortSelect")?.value || "newest";

  if (sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
  else if (sort==="largest") list.sort((a,b)=>fsize(b)-fsize(a));
  else {
    list.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    if (sort==="oldest") list.reverse();
  }

  if ($("fileCount")) $("fileCount").textContent = files.length+" files";
  if ($("visibleCount")) $("visibleCount").textContent = list.length;
  $("emptyState")?.classList.toggle("hidden",files.length>0);
  quota();

  for (const f of list) {
    const t = type(f);
    const item = document.createElement("div");
    item.className = "file-item";

    const n = document.createElement("strong");
    n.textContent = (t==="image"?"🖼️ ":t==="video"?"🎬 ":t==="text"?"📝 ":"📄 ")+f.name;

    const s = document.createElement("small");
    s.textContent = size(fsize(f));

    const open = document.createElement("button");
    open.textContent = t==="text"?"Edit":t==="other"?"Open":"View";
    open.onclick = () => openFile(f);

    const d = document.createElement("button");
    d.textContent = "Download";
    d.onclick = () => downloadFile(f);

    const x = document.createElement("button");
    x.textContent = "Delete";
    x.onclick = () => deleteFile(f);

    item.append(n,s,open,d,x);
    grid.append(item);
  }
}

if ($("searchInput")) $("searchInput").oninput = displayFiles;
if ($("sortSelect")) $("sortSelect").onchange = displayFiles;

async function getBlob(f) {
  const {data,error} = await db.storage.from("user-files").download(path(f));
  if (error) throw error;
  return data;
}

async function downloadFile(f) {
  let url;
  try {
    const blob = await getBlob(f);
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
  } catch(e) {
    notify("Download failed: "+e.message);
  } finally {
    if (url) setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
}

async function deleteFile(f) {
  if (!confirm("Delete "+f.name+"?")) return;

  try {
    const {error} = await db.storage.from("user-files").remove([path(f)]);
    if (error) throw error;
    notify("Deleted!");
    await loadFiles(true);
  } catch(e) {
    notify("Delete failed: "+e.message);
  }
}

async function openFile(f) {
  const t = type(f);
  if (t==="other") return downloadFile(f);

  const box = modal(f.name);
  const loading = document.createElement("p");
  loading.textContent = "Loading...";
  box.append(loading);

  try {
    const blob = await getBlob(f);
    loading.remove();

    preview = URL.createObjectURL(blob);

    if (t==="image") {
      const img = document.createElement("img");
      img.src = preview;
      box.append(img);
    }

    if (t==="video") {
      const v = document.createElement("video");
      v.src = preview;
      v.controls = true;
      v.playsInline = true;
      box.append(v);
    }

    if (t==="text") {
      const editor = document.createElement("textarea");
      editor.className = "fc-editor";
      editor.spellcheck = false;
      editor.value = await blob.text();
      box.append(editor);

      const save = document.createElement("button");
      save.textContent = "Save changes";

      save.onclick = async () => {
        save.disabled = true;
        try {
          const mime = f.metadata?.mimetype || "text/plain;charset=utf-8";
          const {error} = await db.storage.from("user-files").upload(
            path(f),
            new Blob([editor.value],{type:mime}),
            {upsert:true,contentType:mime}
          );
          if (error) throw error;
          notify("Saved!");
          await loadFiles(true);
        } catch(e) {
          notify("Save failed: "+e.message);
        }
        save.disabled = false;
      };

      box.append(save);
    }
  } catch(e) {
    loading.textContent = "Could not open: "+e.message;
  }
}

async function init() {
  const {data} = await db.auth.getSession();

  if (data?.session) {
    user = data.session.user;
    storageUI();
    await loadFiles();
  } else {
    authUI();
  }

  db.auth.onAuthStateChange(async(event,session)=>{
    if (session) {
      user = session.user;
      storageUI();
      await loadFiles();
    } else {
      user = null;
      files = [];
      closeModal();
      authUI();
    }
  });
}

init();
