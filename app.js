

/* ========================================
   FOREVER CLOUD STORAGE
   Complete Supabase App
======================================== */

// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://kapzuwhpjbfeofetuqbo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";

const REDIRECT_URL = "https://mycloudstoragegithubio.vercel.app/";

// INITIALIZE SUPABASE
const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// HTML ELEMENTS
const $ = id => document.getElementById(id);

const setupNotice = $("setupNotice");
const authPanel = $("authPanel");
const storagePanel = $("storagePanel");
const authForm = $("authForm");

const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const authSubmit = $("authSubmit");
const authMessage = $("authMessage");

const loginTab = $("loginTab");
const signupTab = $("signupTab");

const fileInput = $("fileInput");
const fileGrid = $("fileGrid");
const searchInput = $("searchInput");
const sortSelect = $("sortSelect");

const toast = $("toast");

let currentUser = null;
let allFiles = [];
let authMode = "login";

// ========================================
// UI HELPERS
// ========================================

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function showAuth() {
  authPanel.classList.remove("hidden");
  storagePanel.classList.add("hidden");

  $("userEmail").textContent = "Not signed in";
  $("accountStatus").textContent = "Connect your account";
  $("avatar").textContent = "?";

  $("signOutBtn").classList.add("hidden");
}

function showStorage() {
  authPanel.classList.add("hidden");
  storagePanel.classList.remove("hidden");

  $("userEmail").textContent = currentUser.email;
  $("accountStatus").textContent = "Connected";
  $("avatar").textContent =
    currentUser.email.charAt(0).toUpperCase();

  $("signOutBtn").classList.remove("hidden");
}

function setAuthMode(mode) {
  authMode = mode;

  loginTab.classList.toggle("selected", mode === "login");
  signupTab.classList.toggle("selected", mode === "signup");

  authSubmit.innerHTML =
    mode === "login"
      ? 'Sign in <span>→</span>'
      : 'Create account <span>→</span>';

  authMessage.textContent =
    mode === "login"
      ? "Use your email and password to continue."
      : "Create your private cloud account.";
}

// ========================================
// SIGN IN / SIGN UP
// ========================================

loginTab.addEventListener("click", () => {
  setAuthMode("login");
});

signupTab.addEventListener("click", () => {
  setAuthMode("signup");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    notify("Enter your email and password.");
    return;
  }

  authSubmit.disabled = true;
  authSubmit.textContent = "Please wait...";

  try {
    if (authMode === "login") {

      const { data, error } =
        await client.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      currentUser = data.user;

      showStorage();
      await loadFiles();

      notify("Welcome back to Forever Cloud! ☁️");

    } else {

      const { data, error } =
        await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: REDIRECT_URL
          }
        });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        showStorage();
        await loadFiles();

        notify("Account created successfully!");
      } else {
        authMessage.textContent =
          "Account created! Check your email to confirm your account.";

        notify("Check your email to confirm your account.");
      }
    }

  } catch (error) {
    notify(error.message);
    authMessage.textContent = error.message;

  } finally {
    authSubmit.disabled = false;

    authSubmit.innerHTML =
      authMode === "login"
        ? 'Sign in <span>→</span>'
        : 'Create account <span>→</span>';
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
  notify("Signed out successfully.");
});

// ========================================
// FILE UPLOAD
// ========================================

async function uploadFile(file) {
  if (!currentUser || !file) return;

  const safeName = file.name.replaceAll("/", "_");

  const filePath =
    `${currentUser.id}/${Date.now()}_${safeName}`;

  try {
    notify("Uploading " + file.name + "...");

    const { error } = await client.storage
      .from("user-files")
      .upload(filePath, file);

    if (error) throw error;

    notify("File uploaded successfully! ☁️");

    await loadFiles();

  } catch (error) {
    notify("Upload failed: " + error.message);
  }
}

fileInput.addEventListener("change", async event => {
  const files = Array.from(event.target.files);

  for (const file of files) {
    await uploadFile(file);
  }

  fileInput.value = "";
});

// UPLOAD BUTTONS

$("browseBtn").addEventListener("click", () => {
  fileInput.click();
});

$("uploadTopBtn").addEventListener("click", () => {
  fileInput.click();
});

$("emptyUploadBtn").addEventListener("click", () => {
  fileInput.click();
});

// ========================================
// DRAG AND DROP
// ========================================

const dropZone = $("dropZone");

dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", async event => {
  event.preventDefault();

  dropZone.classList.remove("dragging");

  const files = Array.from(event.dataTransfer.files);

  for (const file of files) {
    await uploadFile(file);
  }
});

// ========================================
// LOAD FILES
// ========================================

async function loadFiles() {
  if (!currentUser) return;

  try {
    const { data, error } = await client.storage
      .from("user-files")
      .list(currentUser.id, {
        limit: 100,
        sortBy: {
          column: "created_at",
          order: "desc"
        }
      });

    if (error) throw error;

    allFiles = (data || []).filter(file => file.name);

    displayFiles();

  } catch (error) {
    console.error(error);
    notify("Could not load files: " + error.message);
  }
}

// ========================================
// DISPLAY FILES
// ========================================

function formatSize(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return (
    (bytes / Math.pow(1024, index)).toFixed(2) +
    " " +
    units[index]
  );
}

function displayFiles() {
  fileGrid.innerHTML = "";

  const query = searchInput.value.toLowerCase();

  let files = allFiles.filter(file =>
    file.name.toLowerCase().includes(query)
  );

  if (sortSelect.value === "name") {
    files.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sortSelect.value === "largest") {
    files.sort((a, b) =>
      (b.metadata?.size || 0) - (a.metadata?.size || 0)
    );
  }

  if (sortSelect.value === "oldest") {
    files.sort((a, b) =>
      new Date(a.created_at || 0) -
      new Date(b.created_at || 0)
    );
  }

  if (sortSelect.value === "newest") {
    files.sort((a, b) =>
      new Date(b.created_at || 0) -
      new Date(a.created_at || 0)
    );
  }

  const totalSize = allFiles.reduce(
    (sum, file) => sum + (file.metadata?.size || 0),
    0
  );

  $("fileCount").textContent =
    allFiles.length + (allFiles.length === 1 ? " file" : " files");

  $("visibleCount").textContent = files.length;
  $("storageUsed").textContent = formatSize(totalSize);

  $("emptyState").classList.toggle(
    "hidden",
    allFiles.length > 0
  );

  if (!files.length) {
    if (allFiles.length > 0) {
      const message = document.createElement("p");
      message.textContent = "No matching files found.";
      fileGrid.appendChild(message);
    }
    return;
  }

  files.forEach(file => {
    const path = `${currentUser.id}/${file.name}`;

    const item = document.createElement("div");
    item.className = "file-item";

    const name = document.createElement("strong");
    name.textContent = file.name;

    const size = document.createElement("small");
    size.textContent = formatSize(file.metadata?.size || 0);

    const download = document.createElement("button");
    download.textContent = "Download";
    download.addEventListener("click", () => downloadFile(path));

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteFile(path));

    item.append(name, size, download, remove);

    fileGrid.appendChild(item);
  });
}

// ========================================
// DOWNLOAD FILE
// ========================================

async function downloadFile(path) {
  try {
    const { data, error } = await client.storage
      .from("user-files")
      .download(path);

    if (error) throw error;

    const url = URL.createObjectURL(data);

    const link = document.createElement("a");
    link.href = url;
    link.download = path.split("/").pop();

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    notify("Download started!");

  } catch (error) {
    notify("Download failed: " + error.message);
  }
}

// ========================================
// DELETE FILE
// ========================================

async function deleteFile(path) {
  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }

  try {
    const { error } = await client.storage
      .from("user-files")
      .remove([path]);

    if (error) throw error;

    notify("File deleted successfully!");

    await loadFiles();

  } catch (error) {
    notify("Delete failed: " + error.message);
  }
}

// ========================================
// SEARCH AND SORT
// ========================================

searchInput.addEventListener("input", displayFiles);
sortSelect.addEventListener("change", displayFiles);

$("refreshBtn").addEventListener("click", async () => {
  await loadFiles();
  notify("Files refreshed!");
});

// ========================================
// AUTH STATE
// ========================================

client.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    showStorage();
  }

  if (event === "SIGNED_OUT") {
    currentUser = null;
    allFiles = [];
    showAuth();
  }
});

// ========================================
// INITIALIZE APP
// ========================================

async function initializeApp() {
  try {
    if (!window.supabase) {
      throw new Error("Supabase library failed to load.");
    }

    setupNotice.classList.add("hidden");

    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    if (data.session) {
      currentUser = data.session.user;

      showStorage();
      await loadFiles();

    } else {
      showAuth();
    }

  } catch (error) {
    console.error(error);

    setupNotice.classList.remove("hidden");
    notify(error.message);

    showAuth();
  }
}

setAuthMode("login");
initializeApp();
                       
