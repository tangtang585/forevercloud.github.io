
// ========================================
// FOREVER CLOUD - APP.JS
// Complete storage application + URL downloader
// ========================================

const SUPABASE_URL = "https://kapzuwhpjbfeofetuqbo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";

const REDIRECT_URL = "https://mycloudstoragegithubio.vercel.app/";

const OWNER_EMAIL = "t8505243@gmail.com";
const STORAGE_LIMIT = 10000000000000; // 10 TB

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let currentUser = null;
let allFiles = [];
let authMode = "login";
let previewUrl = null;

// ========================================
// EXTRA STYLES
// ========================================

const extraStyles = document.createElement("style");

extraStyles.textContent = `
.fc-modal {
  position:fixed; inset:0; z-index:99999;
  background:rgba(0,0,0,.88);
  display:flex; align-items:center; justify-content:center;
  padding:14px;
}
.fc-window {
  width:min(900px,100%); max-height:92vh;
  overflow:auto; background:#111a30;
  color:white; border:1px solid #34415d;
  border-radius:16px; padding:18px;
}
.fc-window img {
  max-width:100%; max-height:70vh;
  object-fit:contain; display:block; margin:auto;
}
.fc-window video {
  width:100%; max-height:70vh; background:black;
}
.fc-editor {
  width:100%; min-height:55vh;
  resize:vertical; box-sizing:border-box;
  background:#080f20; color:white;
  border:1px solid #46516d; border-radius:8px;
  padding:14px; font:14px monospace;
}
.fc-actions {
  display:flex; gap:10px; flex-wrap:wrap;
  margin-top:14px;
}
.fc-actions button {
  padding:10px 16px; border:0;
  border-radius:8px; cursor:pointer;
}
.fc-primary {background:#7164f5;color:white}
.fc-secondary {background:#34415d;color:white}
.file-item {
  padding:14px; margin-bottom:10px;
  border:1px solid #34415d; border-radius:12px;
  display:flex; flex-wrap:wrap;
  align-items:center; gap:10px;
}
.file-item strong {overflow-wrap:anywhere; flex:1}
.file-item button {
  padding:8px 12px; border-radius:7px;
  cursor:pointer;
}
.fc-quota {
  margin-top:8px; height:8px;
  background:#29334b; border-radius:10px;
  overflow:hidden;
}
.fc-quota div {
  height:100%; background:#7164f5;
}
`;

document.head.appendChild(extraStyles);

// ========================================
// HELPERS
// ========================================

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function isUnlimited() {
  return currentUser?.email?.toLowerCase() === OWNER_EMAIL;
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return (bytes / Math.pow(1024, index)).toFixed(2) + " " + units[index];
}

function getFileSize(file) {
  return Number(file.metadata?.size || 0);
}

function getFileType(file) {
  const name = file.name.toLowerCase();
  const mime = file.metadata?.mimetype || "";

  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(name)) return "video";
  if (/\.(txt|md|json|csv|log|html|css|js|xml)$/.test(name)) return "text";

  return "other";
}

function getFilePath(file) {
  return `${currentUser.id}/${file.name}`;
}

// ========================================
// AUTH UI
// ========================================

function showAuth() {
  $("authPanel").classList.remove("hidden");
  $("storagePanel").classList.add("hidden");
  $("userEmail").textContent = "Not signed in";
  $("accountStatus").textContent = "Connect your account";
  $("avatar").textContent = "?";
  $("signOutBtn").classList.add("hidden");
}

function showStorage() {
  $("authPanel").classList.add("hidden");
  $("storagePanel").classList.remove("hidden");
  $("userEmail").textContent = currentUser.email;
  $("accountStatus").textContent = isUnlimited() ? "Unlimited account" : "10 TB account";
  $("avatar").textContent = currentUser.email.charAt(0).toUpperCase();
  $("signOutBtn").classList.remove("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("selected", mode === "login");
  $("signupTab").classList.toggle("selected", mode === "signup");
  $("authSubmit").textContent = mode === "login" ? "Sign in →" : "Create account →";
  $("authMessage").textContent = mode === "login"
    ? "Use your email and password to continue."
    : "Create your private cloud account.";
}

$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("signupTab").addEventListener("click", () => setAuthMode("signup"));

// ========================================
// SIGN IN / SIGN UP
// ========================================

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const button = $("authSubmit");

  button.disabled = true;
  button.textContent = "Please wait...";

  try {
    if (authMode === "login") {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      currentUser = data.user;
      showStorage();
      await loadFiles();
      notify("Welcome back to Forever Cloud!");
    } else {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: REDIRECT_URL }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        showStorage();
        await loadFiles();
        notify("Account created!");
      } else {
        notify("Check your email to confirm your account.");
        $("authMessage").textContent = "Account created. Please confirm your email.";
      }
    }
  } catch (error) {
    notify(error.message);
    $("authMessage").textContent = error.message;
  } finally {
    button.disabled = false;
    setAuthMode(authMode);
  }
});

// ========================================
// LOGOUT
// ========================================

$("signOutBtn").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();

  if (error) {
    notify(error.message);
    return;
  }

  currentUser = null;
  allFiles = [];
  showAuth();
  notify("Signed out!");
});

// ========================================
// STORAGE QUOTA
// ========================================

function updateQuota() {
  const used = allFiles.reduce((sum, file) => sum + getFileSize(file), 0);
  $("storageUsed").textContent = formatSize(used);

  if (isUnlimited()) {
    $("storageHint").textContent = "Unlimited account quota. Actual provider limits still apply.";
    return;
  }

  const remaining = Math.max(0, STORAGE_LIMIT - used);
  const percent = Math.min(100, used / STORAGE_LIMIT * 100);

  $("storageHint").textContent = `${formatSize(remaining)} remaining of 10 TB`;

  let bar = $("fcQuotaBar");

  if (!bar) {
    bar = document.createElement("div");
    bar.id = "fcQuotaBar";
    bar.className = "fc-quota";
    $("storagePanel").querySelector(".storage-summary").appendChild(bar);
  }

  bar.innerHTML = `<div style="width:${percent}%"></div>`;
}

// ========================================
// FILE UPLOAD
// ========================================

async function uploadFile(file) {
  if (!currentUser || !file) return false;

  const used = allFiles.reduce((sum, item) => sum + getFileSize(item), 0);

  if (!isUnlimited() && used + file.size > STORAGE_LIMIT) {
    notify("Storage limit reached! Your account has 10 TB.");
    return false;
  }

  const safeName = file.name.replace(/[\\/]/g, "_");
  const path = `${currentUser.id}/${Date.now()}_${safeName}`;

  try {
    notify("Uploading " + file.name + "...");

    const { error } = await client.storage.from("user-files").upload(path, file, {
      contentType: file.type || "application/octet-stream"
    });

    if (error) throw error;

    notify("Upload successful!");
    await loadFiles();
    return true;
  } catch (error) {
    notify("Upload failed: " + error.message);
    return false;
  }
}

$("browseBtn").addEventListener("click", () => $("fileInput").click());
$("uploadTopBtn").addEventListener("click", () => $("fileInput").click());
$("emptyUploadBtn").addEventListener("click", () => $("fileInput").click());

$("fileInput").addEventListener("change", async event => {
  for (const file of Array.from(event.target.files)) {
    await uploadFile(file);
  }
  event.target.value = "";
});

// ========================================
// DOWNLOAD FROM LINK
// ========================================

async function downloadFromLink() {
  if (!currentUser) {
    notify("Please sign in first!");
    return;
  }

  const input = prompt("Paste a direct file download URL:");

  if (!input) return;

  let url;

  try {
    url = new URL(input.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Only HTTP and HTTPS links are supported.");
    }
  } catch (error) {
    notify("Invalid download URL.");
    return;
  }

  try {
    notify("Downloading file from link...");

    const response = await fetch(url.href);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error("The downloaded file is empty.");
    }

    let filename = decodeURIComponent(url.pathname.split("/").pop() || "downloaded-file");

    filename = filename.replace(/[\\/:*?"<>|]/g, "_");

    const contentDisposition = response.headers.get("content-disposition");
    const match = contentDisposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);

    if (match) {
      try {
        filename = decodeURIComponent(match[1].replace(/"/g, "").trim());
      } catch {}
    }

    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream"
    });

    const success = await uploadFile(file);

    if (success) notify("Downloaded and saved to Forever Cloud! ☁️");
  } catch (error) {
    console.error(error);
    notify("Link download failed: " + error.message + ". The source server may block CORS.");
  }
}

const downloadLinkButton = $("downloadLinkBtn");

if (downloadLinkButton) {
  downloadLinkButton.addEventListener("click", downloadFromLink);
}

// ========================================
// DRAG AND DROP
// ========================================

const dropZone = $("dropZone");

dropZone.addEventListener("dragover", event => event.preventDefault());

dropZone.addEventListener("drop", async event => {
  event.preventDefault();

  for (const file of Array.from(event.dataTransfer.files)) {
    await uploadFile(file);
  }
});

// ========================================
// LOAD FILES
// ========================================

async function loadFiles() {
  if (!currentUser) return;

  try {
    const { data, error } = await client.storage.from("user-files").list(currentUser.id, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });

    if (error) throw error;

    allFiles = (data || []).filter(file => file.name);
    displayFiles();
  } catch (error) {
    notify("Loading failed: " + error.message);
  }
}

// ========================================
// DISPLAY FILES
// ========================================

function displayFiles() {
  const grid = $("fileGrid");
  grid.innerHTML = "";

  const query = $("searchInput").value.toLowerCase();

  let files = allFiles.filter(file => file.name.toLowerCase().includes(query));
  const sort = $("sortSelect").value;

  if (sort === "name") {
    files.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "largest") {
    files.sort((a, b) => getFileSize(b) - getFileSize(a));
  } else {
    files.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (sort === "oldest") files.reverse();
  }

  $("fileCount").textContent = `${allFiles.length} files`;
  $("visibleCount").textContent = files.length;
  $("emptyState").classList.toggle("hidden", allFiles.length > 0);

  updateQuota();

  for (const file of files) {
    const type = getFileType(file);
    const item = document.createElement("div");
    item.className = "file-item";

    const name = document.createElement("strong");
    name.textContent = (type === "image" ? "🖼️ " :
      type === "video" ? "🎬 " :
      type === "text" ? "📝 " : "📄 ") + file.name;

    const size = document.createElement("small");
    size.textContent = formatSize(getFileSize(file));

    const open = document.createElement("button");
    open.textContent = type === "text" ? "Edit" :
      type === "image" || type === "video" ? "View" : "Open";
    open.addEventListener("click", () => openFile(file));

    const download = document.createElement("button");
    download.textContent = "Download";
    download.addEventListener("click", () => downloadFile(file));

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteFile(file));

    item.append(name, size, open, download, remove);
    grid.appendChild(item);
  }
}

$("searchInput").addEventListener("input", displayFiles);
$("sortSelect").addEventListener("change", displayFiles);

// ========================================
// FILE DOWNLOAD
// ========================================

async function getBlob(file) {
  const { data, error } = await client.storage.from("user-files").download(getFilePath(file));
  if (error) throw error;
  return data;
}

async function downloadFile(file) {
  try {
    const blob = await getBlob(file);
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    notify("Download failed: " + error.message);
  }
}

// ========================================
// MODAL
// ========================================

function closeModal() {
  const modal = $("fcModal");
  if (modal) modal.remove();

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function createModal(title) {
  closeModal();

  const modal = document.createElement("div");
  modal.id = "fcModal";
  modal.className = "fc-modal";

  const windowBox = document.createElement("div");
  windowBox.className = "fc-window";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const close = document.createElement("button");
  close.className = "fc-secondary";
  close.textContent = "✕ Close";
  close.addEventListener("click", closeModal);

  windowBox.append(heading, close);
  modal.appendChild(windowBox);
  document.body.appendChild(modal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  return windowBox;
}

// ========================================
// OPEN / VIEW / EDIT FILES
// ========================================

async function openFile(file) {
  const type = getFileType(file);

  if (type === "other") {
    await downloadFile(file);
    return;
  }

  const box = createModal(file.name);

  const loading = document.createElement("p");
  loading.textContent = "Loading file...";
  box.appendChild(loading);

  try {
    const blob = await getBlob(file);
    loading.remove();

    previewUrl = URL.createObjectURL(blob);

    if (type === "image") {
      const image = document.createElement("img");
      image.src = previewUrl;
      image.alt = file.name;
      box.appendChild(image);
    }

    if (type === "video") {
      const video = document.createElement("video");
      video.src = previewUrl;
      video.controls = true;
      video.playsInline = true;
      box.appendChild(video);
    }

    if (type === "text") {
      const editor = document.createElement("textarea");
      editor.className = "fc-editor";
      editor.spellcheck = false;
      editor.value = await blob.text();
      box.appendChild(editor);

      const actions = document.createElement("div");
      actions.className = "fc-actions";

      const save = document.createElement("button");
      save.className = "fc-primary";
      save.textContent = "Save changes";

      save.addEventListener("click", async () => {
        save.disabled = true;
        save.textContent = "Saving...";

        try {
          const updatedBlob = new Blob([editor.value], {
            type: "text/plain;charset=utf-8"
          });

          const { error } = await client.storage.from("user-files").upload(
            getFilePath(file),
            updatedBlob,
            { upsert: true, contentType: "text/plain" }
          );

          if (error) throw error;

          notify("Text file saved!");
          await loadFiles();
        } catch (error) {
          notify("Save failed: " + error.message);
        } finally {
          save.disabled = false;
          save.textContent = "Save changes";
        }
      });

      actions.appendChild(save);
      box.appendChild(actions);
    }
  } catch (error) {
    loading.textContent = "Could not open file: " + error.message;
  }
}

// ========================================
// DELETE FILE
// ========================================

async function deleteFile(file) {
  if (!confirm(`Delete ${file.name}?`)) return;

  try {
    const { error } = await client.storage.from("user-files").remove([getFilePath(file)]);
    if (error) throw error;

    notify("File deleted!");
    await loadFiles();
  } catch (error) {
    notify("Delete failed: " + error.message);
  }
}

// ========================================
// REFRESH
// ========================================

$("refreshBtn").addEventListener("click", async () => {
  await loadFiles();
  notify("Files refreshed!");
});

// ========================================
// INITIALIZE
// ========================================

async function initializeApp() {
  try {
    if (!window.supabase) {
      throw new Error("Supabase library did not load.");
    }

    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (data.session) {
      currentUser = data.session.user;
      showStorage();
      await loadFiles();
    } else {
      showAuth();
    }

    $("setupNotice").classList.add("hidden");
  } catch (error) {
    console.error(error);
    $("setupNotice").classList.remove("hidden");
    showAuth();
    notify(error.message);
  }
}

client.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    allFiles = [];
    showAuth();
  }
});

setAuthMode("login");
initializeApp();
