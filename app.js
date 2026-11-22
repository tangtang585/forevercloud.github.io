
// ========================================
// FOREVER CLOUD STORAGE - APP.JS
// ========================================

// IMPORTANT: Keep your own Supabase credentials here.
// Get them from Supabase Dashboard → Project Settings → API.

const SUPABASE_URL = "https://kapzuwhpjbfeofetuqbo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jC018UdtJFVK7sG_YZ39oA_nH0ZhwID";

// Your deployed website URL
const REDIRECT_URL = "https://mycloudstoragegithubio.vercel.app/";

// Initialize Supabase
const client = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// HTML elements
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const uploadInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const searchInput = document.getElementById("search-input");
const logoutButton = document.getElementById("logout-btn");

let currentUser = null;
let allFiles = [];

// ========================================
// AUTHENTICATION
// ========================================

async function signUp(email, password) {
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: REDIRECT_URL
      }
    });

    if (error) throw error;

    alert(
      "Account created! Check your email to confirm your account."
    );

    return data;
  } catch (error) {
    alert(error.message);
  }
}

async function signIn(email, password) {
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;
    showApp();
    await loadFiles();
  } catch (error) {
    alert(error.message);
  }
}

async function signOut() {
  const { error } = await client.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;
  allFiles = [];
  showAuth();
}

// ========================================
// PAGE DISPLAY
// ========================================

function showApp() {
  if (authSection) authSection.style.display = "none";
  if (appSection) appSection.style.display = "block";
}

function showAuth() {
  if (authSection) authSection.style.display = "block";
  if (appSection) appSection.style.display = "none";
}

// ========================================
// FILE UPLOAD
// ========================================

async function uploadFile(file) {
  if (!currentUser || !file) return;

  const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;

  try {
    const { error } = await client.storage
      .from("user-files")
      .upload(filePath, file);

    if (error) throw error;

    alert("File uploaded successfully! ☁️");
    await loadFiles();

  } catch (error) {
    alert("Upload failed: " + error.message);
  }
}

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

    allFiles = data || [];
    displayFiles(allFiles);

  } catch (error) {
    console.error(error);
    alert("Could not load files: " + error.message);
  }
}

// ========================================
// DISPLAY FILES
// ========================================

function displayFiles(files) {
  if (!fileList) return;

  fileList.innerHTML = "";

  if (!files.length) {
    fileList.innerHTML = "<p>No files uploaded yet ☁️</p>";
    return;
  }

  files.forEach(file => {
    const filePath = `${currentUser.id}/${file.name}`;

    const item = document.createElement("div");
    item.className = "file-item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const downloadButton = document.createElement("button");
    downloadButton.textContent = "Download";
    downloadButton.onclick = () => downloadFile(filePath);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.onclick = () => deleteFile(filePath);

    item.append(name, downloadButton, deleteButton);
    fileList.appendChild(item);
  });
}

// ========================================
// DOWNLOAD FILE
// ========================================

async function downloadFile(filePath) {
  try {
    const { data, error } = await client.storage
      .from("user-files")
      .download(filePath);

    if (error) throw error;

    const url = URL.createObjectURL(data);
    const link = document.createElement("a");

    link.href = url;
    link.download = filePath.split("/").pop();

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    alert("Download failed: " + error.message);
  }
}

// ========================================
// DELETE FILE
// ========================================

async function deleteFile(filePath) {
  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }

  try {
    const { error } = await client.storage
      .from("user-files")
      .remove([filePath]);

    if (error) throw error;

    alert("File deleted successfully!");
    await loadFiles();

  } catch (error) {
    alert("Delete failed: " + error.message);
  }
}

// ========================================
// SEARCH FILES
// ========================================

if (searchInput) {
  searchInput.addEventListener("input", event => {
    const query = event.target.value.toLowerCase();

    const filtered = allFiles.filter(file =>
      file.name.toLowerCase().includes(query)
    );

    displayFiles(filtered);
  });
}

// ========================================
// EVENT LISTENERS
// ========================================

if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    signIn(email, password);
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    signUp(email, password);
  });
}

if (uploadInput) {
  uploadInput.addEventListener("change", event => {
    const files = Array.from(event.target.files);

    files.forEach(file => uploadFile(file));

    event.target.value = "";
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", signOut);
}

// ========================================
// CHECK EXISTING SESSION
// ========================================

async function initializeApp() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error(error);
    showAuth();
    return;
  }

  const session = data.session;

  if (session) {
    currentUser = session.user;
    showApp();
    await loadFiles();
  } else {
    showAuth();
  }
}

client.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    showApp();
    loadFiles();
  }

  if (event === "SIGNED_OUT") {
    currentUser = null;
    allFiles = [];
    showAuth();
  }
});

initializeApp();
                                                
