// FOREVER CLOUD — Supabase browser client
// Paste your Supabase Project URL and anon/public key below.
// NEVER use the service_role key in browser code.
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";
const BUCKET = "user-files";

const configured = !SUPABASE_URL.includes("YOUR-PROJECT") &&
                   !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const client = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);
let currentUser = null;
let files = [];
let authMode = "login";
let toastTimer;

function toast(message, bad = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.background = bad ? "#ffe0e0" : "#d9f8e9";
  el.style.color = bad ? "#6d1717" : "#103c2b";
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fileGlyph(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["png","jpg","jpeg","gif","webp","svg","heic"].includes(ext)) return "▧";
  if (["mp4","mov","mkv","webm"].includes(ext)) return "▶";
  if (["mp3","wav","ogg","m4a"].includes(ext)) return "♫";
  if (["pdf"].includes(ext)) return "▤";
  if (["zip","rar","7z","tar","gz"].includes(ext)) return "▣";
  if (["doc","docx","txt","rtf"].includes(ext)) return "≡";
  return "◇";
}
function setSignedIn(user) {
  currentUser = user;
  $("authPanel").classList.toggle("hidden", !!user);
  $("storagePanel").classList.toggle("hidden", !user);
  $("userEmail").textContent = user?.email || "Not signed in";
  $("accountStatus").textContent = user ? "Cloud connected" : "Connect your account";
  $("avatar").textContent = user?.email?.[0]?.toUpperCase() || "?";
  $("signOutBtn").classList.toggle("hidden", !user);
  $("setupNotice").classList.toggle("hidden", configured);
  if (user) loadFiles();
}
function switchAuth(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("selected", mode === "login");
  $("signupTab").classList.toggle("selected", mode === "signup");
  $("authSubmit").innerHTML = mode === "login" ? 'Sign in <span>→</span>' : 'Create account <span>→</span>';
  $("passwordInput").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authMessage").textContent = mode === "login" ? "Use your email and password to continue." : "A confirmation email may be sent depending on your Supabase settings.";
}
async function handleAuth(event) {
  event.preventDefault();
  if (!client) return toast("Add your Supabase URL and anon key in app.js first.", true);
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  $("authSubmit").disabled = true;
  try {
    const result = authMode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });
    if (result.error) throw result.error;
    if (authMode === "signup" && !result.data.session) {
      $("authMessage").textContent = "Account created. Check your email to confirm, then sign in.";
      toast("Check your email to confirm your account.");
    } else toast(authMode === "login" ? "Welcome back!" : "Account created!");
  } catch (error) {
    toast(error.message || "Authentication failed.", true);
  } finally {
    $("authSubmit").disabled = false;
  }
}
async function loadFiles() {
  if (!client || !currentUser) return;
  $("fileGrid").innerHTML = '<div class="muted">Loading your files…</div>';
  try {
    const { data, error } = await client.storage.from(BUCKET).list(currentUser.id, {
      limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    files = (data || []).filter(item => item.name && item.id).map(item => ({
      name: item.name,
      path: `${currentUser.id}/${item.name}`,
      size: item.metadata?.size || 0,
      created_at: item.created_at || item.updated_at || null,
      mime: item.metadata?.mimetype || ""
    }));
    renderFiles();
  } catch (error) {
    $("fileGrid").innerHTML = "";
    toast(`Could not load files: ${error.message}`, true);
  }
}
function renderFiles() {
  const query = $("searchInput").value.trim().toLowerCase();
  const sort = $("sortSelect").value;
  let visible = files.filter(f => f.name.toLowerCase().includes(query));
  visible.sort((a,b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "largest") return b.size - a.size;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return sort === "oldest" ? ta - tb : tb - ta;
  });
  $("fileCount").textContent = `${files.length} ${files.length === 1 ? "file" : "files"}`;
  $("visibleCount").textContent = visible.length;
  $("storageUsed").textContent = formatBytes(files.reduce((sum, f) => sum + f.size, 0));
  $("storageHint").textContent = files.length ? "Your files are saved in your private cloud." : "Your private cloud is ready.";
  $("fileGrid").innerHTML = visible.map((f, i) => `
    <article class="file-card">
      <div class="file-top"><div class="file-icon">${fileGlyph(f.name)}</div>
        <div class="file-actions">
          <button title="Download" data-action="download" data-index="${i}">↓</button>
          <button title="Delete" data-action="delete" data-index="${i}">×</button>
        </div>
      </div>
      <div class="file-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</div>
      <div class="file-meta"><span>${formatBytes(f.size)}</span><span>${f.created_at ? new Date(f.created_at).toLocaleDateString() : "Cloud file"}</span></div>
    </article>`).join("");
  $("emptyState").style.display = visible.length ? "none" : "block";
  $("fileGrid").style.display = visible.length ? "grid" : "none";
  $("emptyState").querySelector("p").textContent = files.length && query ? "No files match your search." : "Upload your first file to get started.";
  // Keep action indexes mapped to the currently displayed ordering.
  $("fileGrid").querySelectorAll("[data-action]").forEach(btn => {
    const file = visible[Number(btn.dataset.index)];
    btn.addEventListener("click", () => btn.dataset.action === "download" ? downloadFile(file) : deleteFile(file));
  });
}
function safeObjectName(name) {
  // Avoid slash/path traversal; preserve a readable original filename.
  return name.replace(/[\/\\]/g, "_").replace(/[\u0000-\u001f]/g, "_").slice(0, 180) || "upload";
}
async function uploadFiles(fileList) {
  if (!client || !currentUser) return toast("Sign in and connect Supabase before uploading.", true);
  const selected = Array.from(fileList || []);
  if (!selected.length) return;
  for (const file of selected) {
    const name = `${Date.now()}-${crypto.randomUUID()}-${safeObjectName(file.name)}`;
    const path = `${currentUser.id}/${name}`;
    try {
      const { error } = await client.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream"
      });
      if (error) throw error;
      toast(`Uploaded ${file.name}`);
    } catch (error) {
      toast(`Upload failed (${file.name}): ${error.message}`, true);
    }
  }
  $("fileInput").value = "";
  await loadFiles();
}
async function downloadFile(file) {
  try {
    const { data, error } = await client.storage.from(BUCKET).download(file.path);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = file.name.replace(/^\d+-[0-9a-f-]+-/i, "");
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (error) { toast(`Download failed: ${error.message}`, true); }
}
async function deleteFile(file) {
  if (!confirm(`Permanently delete "${file.name}"? This cannot be undone.`)) return;
  try {
    const { error } = await client.storage.from(BUCKET).remove([file.path]);
    if (error) throw error;
    toast("File deleted.");
    await loadFiles();
  } catch (error) { toast(`Delete failed: ${error.message}`, true); }
}
function chooseFiles() { $("fileInput").click(); }

$("loginTab").addEventListener("click", () => switchAuth("login"));
$("signupTab").addEventListener("click", () => switchAuth("signup"));
$("authForm").addEventListener("submit", handleAuth);
$("browseBtn").addEventListener("click", chooseFiles);
$("uploadTopBtn").addEventListener("click", chooseFiles);
$("emptyUploadBtn").addEventListener("click", chooseFiles);
$("fileInput").addEventListener("change", e => uploadFiles(e.target.files));
$("refreshBtn").addEventListener("click", loadFiles);
$("searchInput").addEventListener("input", renderFiles);
$("sortSelect").addEventListener("change", renderFiles);
$("signOutBtn").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();
  if (error) toast(error.message, true);
  else { files = []; setSignedIn(null); toast("Signed out."); }
});
const drop = $("dropZone");
["dragenter","dragover"].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave","drop"].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove("dragging"); }));
drop.addEventListener("drop", e => uploadFiles(e.dataTransfer.files));

(async function init() {
  if (!configured) {
    $("setupNotice").classList.remove("hidden");
    $("authMessage").textContent = "First connect your Supabase project in app.js.";
    return;
  }
  $("setupNotice").classList.add("hidden");
  const { data: { session } } = await client.auth.getSession();
  setSignedIn(session?.user || null);
  client.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user || null));
})();
