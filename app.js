const URL_DB = "https://kapzuwhpjbfeofetuqbo.supabase.co";
const KEY = "sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";
const OWNER = "t8505243@gmail.com";
const LIMIT = 10e12;

const db = window.supabase.createClient(URL_DB, KEY);
const $ = id => document.getElementById(id);

let user = null;
let files = [];
let mode = "login";
let preview = null;
let toastTimer = null;
let loadPromise = null;
let modalSeq = 0;

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
.fc-quota div{height:100%;background:#7164f5;transition:width .2s ease}
.file-item{padding:14px;border:1px solid #34415d;border-radius:12px;align-items:center}
.file-item strong{overflow-wrap:anywhere;flex:1}
`;
document.head.appendChild(css);

function notify(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = String(msg ?? "");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

const unlimited = () => Boolean(user?.email && user.email.toLowerCase() === OWNER.toLowerCase());

function size(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  return (num / (1024 ** i)).toFixed(2) + " " + units[i];
}

const fsize = f => {
  const s = Number(f?.metadata?.size ?? 0);
  return Number.isFinite(s) && s > 0 ? s : 0;
};

function type(f) {
  const n = String(f?.name || "").toLowerCase();
  const m = String(f?.metadata?.mimetype || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(n)) return "video";
  if (m.startsWith("text/") || /\.(txt|md|json|csv|log|html|css|js|xml|yaml|yml)$/.test(n)) return "text";
  return "other";
}

const path = f => `${user.id}/${f.name}`;

function sanitizeName(name) {
  return String(name || "file")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim() || "file";
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
  if ($("userEmail")) $("userEmail").textContent = user.email || "Signed in";
  if ($("accountStatus")) $("accountStatus").textContent = unlimited() ? "Unlimited account" : "10 TB account";
  if ($("avatar")) $("avatar").textContent = (user.email?.[0] || "U").toUpperCase();
  $("signOutBtn")?.classList.remove("hidden");
}

function setMode(m) {
  mode = m;
  $("loginTab")?.classList.toggle("selected", m === "login");
  $("signupTab")?.classList.toggle("selected", m === "signup");
  if ($("authSubmit")) {
    $("authSubmit").textContent = m === "login" ? "Sign in →" : "Create account →";
  }
  if ($("authMessage")) {
    $("authMessage").textContent = m === "login"
      ? "Use your email and password to continue."
      : "Create your private cloud account.";
  }
}

if ($("loginTab")) $("loginTab").onclick = () => setMode("login");
if ($("signupTab")) $("signupTab").onclick = () => setMode("signup");

if ($("authForm")) {
  $("authForm").onsubmit = async e => {
    e.preventDefault();
    const email = $("emailInput").value.trim();
    const password = $("passwordInput").value;
    const b = $("authSubmit");
    b.disabled = true;
    b.textContent = "Please wait...";
    try {
      const res = mode === "login"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: "https://mycloudstoragegithubio.vercel.app/" }
          });
      if (res.error) throw res.error;
      if (res.data.session) {
        user = res.data.user;
        storageUI();
        await loadFiles(true);
        notify("Welcome to Forever Cloud!");
      } else {
        notify("Check your email to confirm your account.");
      }
    } catch (err) {
      notify(err.message);
      if ($("authMessage")) $("authMessage").textContent = err.message;
    } finally {
      b.disabled = false;
      if ($("authSubmit")) {
        $("authSubmit").textContent = mode === "login" ? "Sign in →" : "Create account →";
      }
    }
  };
}

if ($("signOutBtn")) {
  $("signOutBtn").onclick = async () => {
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      user = null;
      files = [];
      closeModal();
      authUI();
      notify("Signed out!");
    } catch (err) {
      notify(err.message);
    }
  };
}

function quota() {
  const used = files.reduce((s, f) => s + fsize(f), 0);
  if ($("storageUsed")) $("storageUsed").textContent = size(used);
  if ($("storageHint")) {
    $("storageHint").textContent = unlimited()
      ? "Unlimited account quota. Provider limits still apply."
      : `${size(Math.max(0, LIMIT - used))} remaining of 10 TB`;
  }
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
  if (bar) {
    const pct = Math.min(100, Math.max(0, (used / LIMIT) * 100));
    bar.innerHTML = `<div style="width:${pct}%"></div>`;
  }
}

async function uploadFile(file, { reload = true, silentNotify = false } = {}) {
  if (!user || !file) return false;
  const used = files.reduce((s, f) => s + fsize(f), 0);
  if (!unlimited() && used + file.size > LIMIT) {
    notify("10 TB storage limit reached!");
    return false;
  }
  const safeName = sanitizeName(file.name);
  const storagePath = `${user.id}/${Date.now()}_${safeName}`;
  try {
    if (!silentNotify) notify("Uploading " + safeName + "...");
    const { error } = await db.storage
      .from("user-files")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream"
      });
    if (error) throw error;
    if (reload) await loadFiles(true);
    if (!silentNotify) notify("Upload successful!");
    return true;
  } catch (err) {
    notify("Upload failed: " + err.message);
    return false;
  }
}

["browseBtn", "uploadTopBtn", "emptyUploadBtn"].forEach(id => {
  const el = $(id);
  if (el) el.onclick = () => $("fileInput")?.click();
});

if ($("fileInput")) {
  $("fileInput").onchange = async e => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length) return;
    for (const f of selected) {
      await uploadFile(f, { reload: false });
    }
    await loadFiles(true);
  };
}

function revokePreview() {
  if (preview) {
    URL.revokeObjectURL(preview);
    preview = null;
  }
}

function closeModal() {
  modalSeq++;
  $("fcModal")?.remove();
  revokePreview();
}

function modal(title) {
  closeModal();
  const seq = modalSeq;
  const m = document.createElement("div");
  m.id = "fcModal";
  m.className = "fc-modal";

  const w = document.createElement("div");
  w.className = "fc-window";

  const h = document.createElement("h2");
  h.textContent = title;

  const c = document.createElement("button");
  c.type = "button";
  c.textContent = "✕ Close";
  c.onclick = closeModal;

  w.append(h, c);
  m.append(w);
  document.body.append(m);
  m.onclick = e => {
    if (e.target === m) closeModal();
  };

  return { box: w, seq };
}

function parseFilename(response, parsedUrl, blob) {
  const cd = response.headers.get("content-disposition") || "";
  const utf8Match = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8Match) {
    try {
      return sanitizeName(decodeURIComponent(utf8Match[1]));
    } catch (_) {}
  }
  const plainMatch = cd.match(/filename="?([^";\r\n]+)"?/i);
  if (plainMatch) {
    return sanitizeName(plainMatch[1].trim());
  }

  let rawSegment = "";
  try {
    rawSegment = decodeURIComponent(parsedUrl.pathname.split("/").pop() || "");
  } catch (_) {
    rawSegment = parsedUrl.pathname.split("/").pop() || "";
  }
  if (rawSegment) return sanitizeName(rawSegment);

  const mimeExtMap = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/json": ".json",
    "text/plain": ".txt",
    "text/csv": ".csv"
  };
  const ext = mimeExtMap[(blob.type || "").toLowerCase()] || "";
  return sanitizeName("download" + ext);
}

function downloadPopup() {
  if (!user) return notify("Please sign in first!");
  const { box } = modal("Download from Link");

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
  b.type = "button";
  b.textContent = "↓ Download to my cloud";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  b.onclick = async () => {
    let url;
    try {
      url = new URL(input.value.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only http and https URLs are supported.");
      }
    } catch (err) {
      status.textContent = "Invalid URL: " + err.message;
      return;
    }

    b.disabled = true;
    b.textContent = "Downloading...";
    status.textContent = "Connecting...";

    let blob;
    let fileName;
    try {
      const r = await fetch(url.href);
      if (!r.ok) throw new Error("Server error " + r.status);
      blob = await r.blob();
      if (!blob.size) throw new Error("Downloaded file is empty.");
      fileName = parseFilename(r, url, blob);
    } catch (err) {
      status.textContent = `Download failed: ${err.message} (The source may block browser downloads with CORS.)`;
      b.disabled = false;
      b.textContent = "Try again";
      return;
    }

    try {
      status.textContent = "Uploading " + size(blob.size) + "...";
      const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
      const ok = await uploadFile(file, { reload: true, silentNotify: true });
      if (!ok) throw new Error("Upload to cloud storage failed.");
      status.textContent = "Saved successfully!";
      b.textContent = "✓ Complete";
      notify("Saved " + fileName + " to cloud!");
      setTimeout(closeModal, 1200);
    } catch (err) {
      status.textContent = "Upload failed: " + err.message;
      b.disabled = false;
      b.textContent = "Try again";
    }
  };

  input.onkeydown = e => {
    if (e.key === "Enter" && !b.disabled) {
      e.preventDefault();
      b.click();
    }
  };

  actions.append(b, cancel);
  box.append(p, input, actions, status);
  input.focus();
}

document.addEventListener("click", e => {
  if (e.target.closest("#downloadLinkBtn")) {
    e.preventDefault();
    downloadPopup();
  }
});

if ($("dropZone")) {
  $("dropZone").addEventListener("dragover", e => e.preventDefault());
  $("dropZone").addEventListener("drop", async e => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (!dropped.length) return;
    for (const f of dropped) {
      await uploadFile(f, { reload: false });
    }
    await loadFiles(true);
  });
}

async function fetchAllUserFiles(userId) {
  const pageSize = 100;
  let offset = 0;
  const all = [];

  while (true) {
    const { data, error } = await db.storage
      .from("user-files")
      .list(userId, {
        limit: pageSize,
        offset,
        sortBy: { column: "created_at", order: "desc" }
      });
    if (error) throw error;
    const batch = (data || []).filter(f => f && f.name);
    all.push(...batch);
    if ((data || []).length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function loadFiles(force = false) {
  if (!user) return;
  if (loadPromise && !force) return loadPromise;

  const currentUserId = user.id;
  loadPromise = (async () => {
    try {
      const items = await fetchAllUserFiles(currentUserId);
      if (user?.id !== currentUserId) return;
      files = items;
      displayFiles();
    } catch (err) {
      notify("Loading failed: " + err.message);
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function displayFiles() {
  const grid = $("fileGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const q = ($("searchInput")?.value || "").toLowerCase().trim();
  const list = files.filter(f => f.name.toLowerCase().includes(q));
  const sort = $("sortSelect")?.value || "newest";

  if (sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "largest") {
    list.sort((a, b) => fsize(b) - fsize(a) || a.name.localeCompare(b.name));
  } else if (sort === "oldest") {
    list.sort((a, b) => (new Date(a.created_at || 0) - new Date(b.created_at || 0)) || a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => (new Date(b.created_at || 0) - new Date(a.created_at || 0)) || a.name.localeCompare(b.name));
  }

  if ($("fileCount")) $("fileCount").textContent = files.length + " files";
  if ($("visibleCount")) $("visibleCount").textContent = String(list.length);
  $("emptyState")?.classList.toggle("hidden", files.length > 0);
  quota();

  for (const f of list) {
    const t = type(f);
    const item = document.createElement("div");
    item.className = "file-item";

    const icon = t === "image" ? "🖼️ " : t === "video" ? "🎬 " : t === "text" ? "📝 " : "📄 ";
    const n = document.createElement("strong");
    n.textContent = icon + f.name;

    const s = document.createElement("small");
    s.textContent = size(fsize(f));

    const open = document.createElement("button");
    open.type = "button";
    open.textContent = t === "text" ? "Edit" : t === "other" ? "Open" : "View";
    open.onclick = () => openFile(f);

    const d = document.createElement("button");
    d.type = "button";
    d.textContent = "Download";
    d.onclick = () => downloadFile(f);

    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "Delete";
    x.onclick = () => deleteFile(f);

    item.append(n, s, open, d, x);
    grid.append(item);
  }
}

if ($("searchInput")) $("searchInput").oninput = displayFiles;
if ($("sortSelect")) $("sortSelect").onchange = displayFiles;

async function getBlob(f) {
  const { data, error } = await db.storage.from("user-files").download(path(f));
  if (error) throw error;
  return data;
}

async function downloadFile(f) {
  let objectUrl = null;
  try {
    const blob = await getBlob(f);
    objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
  } catch (err) {
    notify("Download failed: " + err.message);
  } finally {
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
}

async function deleteFile(f) {
  if (!confirm("Delete " + f.name + "?")) return;
  try {
    const { error } = await db.storage.from("user-files").remove([path(f)]);
    if (error) throw error;
    notify("Deleted!");
    await loadFiles(true);
  } catch (err) {
    notify("Delete failed: " + err.message);
  }
}

async function openFile(f) {
  const t = type(f);
  if (t === "other") return downloadFile(f);

  const { box, seq } = modal(f.name);
  const loading = document.createElement("p");
  loading.textContent = "Loading...";
  box.append(loading);

  try {
    const blob = await getBlob(f);
    if (seq !== modalSeq || !box.isConnected) return;

    loading.remove();
    revokePreview();
    preview = URL.createObjectURL(blob);

    if (t === "image") {
      const img = document.createElement("img");
      img.src = preview;
      img.alt = f.name;
      box.append(img);
    } else if (t === "video") {
      const v = document.createElement("video");
      v.src = preview;
      v.controls = true;
      v.playsInline = true;
      box.append(v);
    } else if (t === "text") {
      const textContent = await blob.text();
      if (seq !== modalSeq || !box.isConnected) return;

      const editor = document.createElement("textarea");
      editor.className = "fc-editor";
      editor.spellcheck = false;
      editor.value = textContent;

      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "Save changes";
      save.onclick = async () => {
        save.disabled = true;
        save.textContent = "Saving...";
        try {
          const mime = f.metadata?.mimetype || "text/plain;charset=utf-8";
          const updatedBlob = new Blob([editor.value], { type: mime });
          const { error } = await db.storage
            .from("user-files")
            .upload(path(f), updatedBlob, { upsert: true, contentType: mime });
          if (error) throw error;
          notify("Saved!");
          await loadFiles(true);
        } catch (err) {
          notify("Save failed: " + err.message);
        } finally {
          save.disabled = false;
          save.textContent = "Save changes";
        }
      };

      box.append(editor, save);
    }
  } catch (err) {
    if (seq !== modalSeq || !box.isConnected) return;
    loading.textContent = "Could not open: " + err.message;
  }
}

async function applySession(session) {
  if (session?.user) {
    const isNewUser = user?.id !== session.user.id;
    user = session.user;
    storageUI();
    await loadFiles(isNewUser);
  } else {
    user = null;
    files = [];
    closeModal();
    authUI();
  }
}

async function init() {
  db.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });

  const { data, error } = await db.auth.getSession();
  if (!error && data?.session && !user) {
    await applySession(data.session);
  } else if (!data?.session && !user) {
    authUI();
  }
}

init();
   
