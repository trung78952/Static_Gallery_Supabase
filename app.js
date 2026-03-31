const defaultItems = [
  {
    id: crypto.randomUUID(),
    title: "Bình minh ở Đà Lạt",
    description: "Sương sớm và ánh nắng đầu ngày tại đồi chè.",
    type: "image",
    url: "https://images.unsplash.com/photo-1528502491637-cd7f6f414f56?auto=format&fit=crop&w=1200&q=80",
    location: "Đà Lạt",
    date: "2025-03-12",
    tags: ["du lich", "binh minh"]
  },
  {
    id: crypto.randomUUID(),
    title: "Video phố cổ Hội An",
    description: "Đèn lồng và dòng người buổi tối.",
    type: "video",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    location: "Hội An",
    date: "2025-01-22",
    tags: ["video", "dem"]
  },
  {
    id: crypto.randomUUID(),
    title: "Chiều biển Phú Yên",
    description: "Khoảnh khắc mặt trời gần chạm đường chân trời.",
    type: "image",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    location: "Phú Yên",
    date: "2024-08-10",
    tags: ["bien", "hoang hon"]
  }
];

const state = {
  items: [],
  activeTab: "gallery",
  authMode: "login",
  user: null,
  client: null,
  canUseDatabase: false,
  configError: "",
  storageBucket: "gallery-media",
  uploadProgressTimer: null,
  replacedStoragePath: "",
  videoObserver: null
};

const refs = {
  tabButtons: document.querySelectorAll(".tab-btn"),
  panels: document.querySelectorAll(".tab-panel"),
  galleryGrid: document.getElementById("galleryGrid"),
  authCard: document.getElementById("authCard"),
  adminPanel: document.getElementById("adminPanel"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  authModeBtn: document.getElementById("authModeBtn"),
  authStatus: document.getElementById("authStatus"),
  mediaForm: document.getElementById("mediaForm"),
  mediaId: document.getElementById("mediaId"),
  storagePathInput: document.getElementById("storagePathInput"),
  titleInput: document.getElementById("titleInput"),
  descriptionInput: document.getElementById("descriptionInput"),
  mediaTypeInput: document.getElementById("mediaTypeInput"),
  urlInput: document.getElementById("urlInput"),
  fileInput: document.getElementById("fileInput"),
  uploadBtn: document.getElementById("uploadBtn"),
  uploadStatus: document.getElementById("uploadStatus"),
  uploadProgress: document.getElementById("uploadProgress"),
  uploadProgressBar: document.getElementById("uploadProgressBar"),
  uploadPreview: document.getElementById("uploadPreview"),
  uploadPreviewImage: document.getElementById("uploadPreviewImage"),
  uploadPreviewVideo: document.getElementById("uploadPreviewVideo"),
  locationInput: document.getElementById("locationInput"),
  dateInput: document.getElementById("dateInput"),
  tagsInput: document.getElementById("tagsInput"),
  resetFormBtn: document.getElementById("resetFormBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  formStatus: document.getElementById("formStatus"),
  adminList: document.getElementById("adminList"),
  mediaItemTemplate: document.getElementById("mediaItemTemplate")
};

init();

async function init() {
  bindEvents();
  initializeSupabase();

  if (state.canUseDatabase) {
    const {
      data: { session },
      error
    } = await state.client.auth.getSession();

    if (error) {
      showAuthStatus(`Khong lay duoc session: ${error.message}`);
    }

    state.user = session?.user ?? null;

    state.client.auth.onAuthStateChange((_event, currentSession) => {
      state.user = currentSession?.user ?? null;
      updateAdminVisibility();
    });

    await refreshFromDatabase();
  } else {
    state.items = defaultItems;
    showAuthStatus(state.configError || "Ban can cau hinh Supabase trong config.js de dung database.");
    renderGallery();
    updateAdminVisibility();
  }
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTab(button.dataset.tab);
    });
  });

  refs.authForm.addEventListener("submit", onAuthSubmit);
  refs.authModeBtn.addEventListener("click", toggleAuthMode);
  refs.mediaForm.addEventListener("submit", onSubmitForm);
  refs.uploadBtn.addEventListener("click", uploadSelectedFile);
  refs.fileInput.addEventListener("change", onSelectLocalFile);
  refs.urlInput.addEventListener("change", onChangeRemoteUrl);
  refs.resetFormBtn.addEventListener("click", resetForm);
  refs.logoutBtn.addEventListener("click", logout);
}

function initializeSupabase() {
  const config = window.APP_CONFIG || {};
  const supabaseUrl = (config.supabaseUrl || "").trim();
  const supabaseAnonKey = (config.supabaseAnonKey || "").trim();
  state.storageBucket = config.storageBucket || "gallery-media";

  if (!supabaseUrl || !supabaseAnonKey) {
    state.canUseDatabase = false;
    if (!supabaseUrl && !supabaseAnonKey) {
      state.configError = "Chua ket noi duoc Supabase: thieu supabaseUrl va supabaseAnonKey trong config.js.";
    } else if (!supabaseUrl) {
      state.configError = "Chua ket noi duoc Supabase: thieu supabaseUrl trong config.js.";
    } else {
      state.configError = "Chua ket noi duoc Supabase: thieu supabaseAnonKey trong config.js.";
    }
    return;
  }

  if (!/^https:\/\//.test(supabaseUrl)) {
    state.canUseDatabase = false;
    state.configError = "Supabase URL khong hop le. Vi du dung dung dang: https://xxxx.supabase.co";
    return;
  }

  const isJwtAnonKey = supabaseAnonKey.length > 100 && supabaseAnonKey.includes(".");
  const isPublishableAnonKey = supabaseAnonKey.startsWith("sb_publishable_");
  if (!isJwtAnonKey && !isPublishableAnonKey) {
    state.canUseDatabase = false;
    state.configError = "supabaseAnonKey trong config.js khong dung dinh dang. Hay copy lai anon public key trong Supabase Dashboard > Settings > API.";
    return;
  }

  state.client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  state.canUseDatabase = true;
  state.configError = "";
}

async function refreshFromDatabase() {
  if (!state.canUseDatabase) return;

  const { data, error } = await state.client
    .from("media_items")
    .select("id, title, description, type, url, location, date, tags, storage_path")
    .order("date", { ascending: false });

  if (error) {
    showFormStatus(`Khong tai duoc du lieu: ${getFriendlySupabaseError(error)}`);
    return;
  }

  state.items = data || [];
  renderGallery();
  renderAdminList();
}

async function uploadSelectedFile() {
  if (!state.user || !state.canUseDatabase) {
    showUploadStatus("Can dang nhap va ket noi database truoc khi upload file.");
    return;
  }

  const selectedFile = refs.fileInput.files?.[0];

  if (!selectedFile) {
    showUploadStatus("Hay chon file anh hoac video truoc.");
    return;
  }

  refs.uploadBtn.disabled = true;
  showUploadStatus("Dang tai file len Storage...");
  startUploadProgress();

  const ext = selectedFile.name.includes(".")
    ? selectedFile.name.split(".").pop().toLowerCase()
    : "bin";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "bin";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
  const filePath = `${state.user.id}/${fileName}`;

  const { error: uploadError } = await state.client.storage
    .from(state.storageBucket)
    .upload(filePath, selectedFile, {
      upsert: false,
      contentType: selectedFile.type || undefined
    });

  if (uploadError) {
    refs.uploadBtn.disabled = false;
    stopUploadProgress();
    showUploadStatus(`Upload that bai: ${getFriendlySupabaseError(uploadError)}`);
    return;
  }

  const { data } = state.client.storage.from(state.storageBucket).getPublicUrl(filePath);

  refs.urlInput.value = data.publicUrl;
  refs.storagePathInput.value = filePath;

  if (refs.mediaId.value && state.replacedStoragePath !== filePath) {
    const editingItem = state.items.find((item) => item.id === refs.mediaId.value);
    state.replacedStoragePath = editingItem?.storage_path || "";
  }

  if (selectedFile.type.startsWith("video/")) {
    refs.mediaTypeInput.value = "video";
  } else {
    refs.mediaTypeInput.value = "image";
  }

  refs.uploadBtn.disabled = false;
  completeUploadProgress();
  renderPreview({ type: refs.mediaTypeInput.value, url: refs.urlInput.value, useObjectUrl: false });
  showUploadStatus("Upload thanh cong. URL da duoc dien vao form.");
}

function onSelectLocalFile() {
  const selectedFile = refs.fileInput.files?.[0];
  if (!selectedFile) {
    clearPreview();
    return;
  }

  const mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";
  refs.mediaTypeInput.value = mediaType;
  if (mediaType === "image") {
    refs.dateInput.value = getTodayISODate();
  }
  renderPreview({ type: mediaType, url: URL.createObjectURL(selectedFile), useObjectUrl: true });
}

function onChangeRemoteUrl() {
  const url = refs.urlInput.value.trim();
  if (!url) {
    clearPreview();
    return;
  }

  if (refs.mediaTypeInput.value === "image") {
    refs.dateInput.value = getTodayISODate();
  }

  renderPreview({ type: refs.mediaTypeInput.value, url, useObjectUrl: false });
}

function setTab(tab) {
  state.activeTab = tab;

  refs.tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  refs.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tab);
  });
}

function renderGallery() {
  refs.galleryGrid.innerHTML = "";

  if (!state.items.length) {
    refs.galleryGrid.innerHTML = '<div class="empty-state">Chua co du lieu gallery.</div>';
    return;
  }

  const sorted = [...state.items].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((item, index) => {
    const element = refs.mediaItemTemplate.content.firstElementChild.cloneNode(true);
    element.style.animationDelay = `${index * 70}ms`;

    const preview = element.querySelector(".media-preview");
    preview.appendChild(createMediaNode(item));

    element.querySelector(".media-place").textContent = item.location || "Khong ro dia diem";
    element.querySelector(".media-date").textContent = formatDate(item.date);
    element.querySelector(".media-title").textContent = item.title;
    element.querySelector(".media-description").textContent = item.description || "Khong co mo ta.";

    const chips = element.querySelector(".chips");
    const itemTags = Array.isArray(item.tags) ? item.tags : [];

    [item.type === "image" ? "Anh" : "Video", ...itemTags].forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = label;
      chips.appendChild(chip);
    });

    refs.galleryGrid.appendChild(element);
  });

  setupVideoAutoplay();
}

function createMediaNode(item) {
  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.url;
    video.className = "gallery-video";
    video.controls = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.preload = "metadata";
    return video;
  }

  const img = document.createElement("img");
  img.src = item.url;
  img.alt = item.title;
  img.loading = "lazy";
  return img;
}

async function onAuthSubmit(event) {
  event.preventDefault();

  if (!state.canUseDatabase) {
    showAuthStatus("Chua ket noi duoc Supabase trong config.js.");
    return;
  }

  const email = refs.authEmail.value.trim();
  const password = refs.authPassword.value;

  if (!email || !password) {
    showAuthStatus("Vui long nhap email va mat khau.");
    return;
  }

  if (state.authMode === "login") {
    const { error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthStatus(`Dang nhap that bai: ${getFriendlySupabaseError(error)}`);
      return;
    }

    showAuthStatus("Dang nhap thanh cong.");
  } else {
    const { error } = await state.client.auth.signUp({ email, password });
    if (error) {
      showAuthStatus(`Tao tai khoan that bai: ${getFriendlySupabaseError(error)}`);
      return;
    }

    showAuthStatus("Da tao tai khoan, hay kiem tra email xac thuc neu can.");
    state.authMode = "login";
    syncAuthModeText();
  }

  await refreshFromDatabase();
}

function toggleAuthMode() {
  state.authMode = state.authMode === "login" ? "register" : "login";
  syncAuthModeText();
}

function syncAuthModeText() {
  refs.authSubmitBtn.textContent = state.authMode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  refs.authModeBtn.textContent = state.authMode === "login" ? "Tạo tài khoản" : "Quay lại đăng nhập";
}

function updateAdminVisibility() {
  const isLoggedIn = Boolean(state.user);

  refs.authCard.classList.toggle("hidden", isLoggedIn);
  refs.adminPanel.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    showFormStatus(`Dang dang nhap voi ${state.user.email}`);
    renderAdminList();
  }
}

async function logout() {
  if (!state.canUseDatabase) return;

  const { error } = await state.client.auth.signOut();
  if (error) {
    showFormStatus(`Dang xuat that bai: ${getFriendlySupabaseError(error)}`);
    return;
  }

  resetForm();
  showAuthStatus("Da dang xuat.");
}

async function onSubmitForm(event) {
  event.preventDefault();

  if (!state.user || !state.canUseDatabase) {
    showFormStatus("Can dang nhap de thao tac du lieu.");
    return;
  }

  const payload = {
    title: refs.titleInput.value.trim(),
    description: refs.descriptionInput.value.trim(),
    type: refs.mediaTypeInput.value,
    url: refs.urlInput.value.trim(),
    storage_path: refs.storagePathInput.value.trim() || null,
    location: refs.locationInput.value.trim(),
    date: refs.dateInput.value,
    tags: refs.tagsInput.value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  };

  const editId = refs.mediaId.value;
  let error;

  if (editId) {
    ({ error } = await state.client.from("media_items").update(payload).eq("id", editId));
  } else {
    payload.owner_id = state.user.id;
    ({ error } = await state.client.from("media_items").insert(payload));
  }

  if (error) {
    showFormStatus(`Khong luu duoc: ${getFriendlySupabaseError(error)}`);
    return;
  }

  showFormStatus(editId ? "Da cap nhat muc." : "Da them muc moi.");

  if (editId && state.replacedStoragePath) {
    await deleteStorageObject(state.replacedStoragePath);
    state.replacedStoragePath = "";
  }

  resetForm();
  await refreshFromDatabase();
}

function renderAdminList() {
  refs.adminList.innerHTML = "";

  if (!state.items.length) {
    refs.adminList.innerHTML = '<div class="empty-state">Database chua co du lieu.</div>';
    return;
  }

  const sorted = [...state.items].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((item) => {
    const wrapper = document.createElement("article");
    wrapper.className = "admin-item";

    const meta = document.createElement("div");
    meta.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong><br>
      <small>${formatDate(item.date)} • ${escapeHtml(item.location)} • ${item.type}</small>
    `;

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "small";
    editBtn.textContent = "Sua";
    editBtn.addEventListener("click", () => fillForm(item));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small";
    deleteBtn.textContent = "Xoa";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Xoa muc \"${item.title}\"?`)) return;

      const { error } = await state.client.from("media_items").delete().eq("id", item.id);
      if (error) {
        showFormStatus(`Khong xoa duoc: ${getFriendlySupabaseError(error)}`);
        return;
      }

      if (item.storage_path) {
        await deleteStorageObject(item.storage_path);
      }

      showFormStatus("Da xoa muc.");
      await refreshFromDatabase();
    });

    actions.append(editBtn, deleteBtn);
    wrapper.append(meta, actions);
    refs.adminList.appendChild(wrapper);
  });
}

function fillForm(item) {
  refs.mediaId.value = item.id;
  refs.titleInput.value = item.title || "";
  refs.descriptionInput.value = item.description || "";
  refs.mediaTypeInput.value = item.type || "image";
  refs.urlInput.value = item.url || "";
  refs.storagePathInput.value = item.storage_path || "";
  refs.locationInput.value = item.location || "";
  refs.dateInput.value = item.date || "";
  refs.tagsInput.value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
  state.replacedStoragePath = "";

  if (item.url) {
    renderPreview({ type: refs.mediaTypeInput.value, url: item.url, useObjectUrl: false });
  } else {
    clearPreview();
  }

  setTab("admin");
  showFormStatus(`Dang sua: ${item.title}`);
}

function resetForm() {
  refs.mediaForm.reset();
  refs.mediaId.value = "";
  refs.storagePathInput.value = "";
  refs.uploadBtn.disabled = false;
  refs.uploadStatus.textContent = "";
  state.replacedStoragePath = "";
  stopUploadProgress();
  clearPreview();
}

function showFormStatus(message) {
  refs.formStatus.textContent = message;
}

function showAuthStatus(message) {
  refs.authStatus.textContent = message;
}

function showUploadStatus(message) {
  refs.uploadStatus.textContent = message;
}

async function deleteStorageObject(path) {
  if (!path) return;

  const { error } = await state.client.storage.from(state.storageBucket).remove([path]);
  if (error) {
    showFormStatus(`Da xoa du lieu DB, nhung xoa file that bai: ${getFriendlySupabaseError(error)}`);
  }
}

function getFriendlySupabaseError(error) {
  const raw = (error?.message || "Loi khong xac dinh").trim();
  const code = (error?.code || "").toUpperCase();
  const lower = raw.toLowerCase();

  if (code === "PGRST204" || code === "PGRST205" || lower.includes("schema cache") || lower.includes("could not find the table")) {
    return "Khong tim thay bang public.media_items. Hay chay file supabase/setup.sql trong SQL Editor cua dung project Supabase, sau do chay: NOTIFY pgrst, 'reload schema';";
  }

  if (code === "42501" || lower.includes("permission denied") || lower.includes("new row violates row-level security")) {
    return "Khong co quyen thao tac. Kiem tra RLS policies trong Supabase va dam bao ban da dang nhap.";
  }

  return raw;
}

function setupVideoAutoplay() {
  if (state.videoObserver) {
    state.videoObserver.disconnect();
  }

  const videos = refs.galleryGrid.querySelectorAll("video.gallery-video");
  if (!videos.length) return;

  state.videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    {
      threshold: [0.2, 0.65, 0.95]
    }
  );

  videos.forEach((video) => state.videoObserver.observe(video));
}

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function startUploadProgress() {
  stopUploadProgress();
  refs.uploadProgress.classList.remove("hidden");
  refs.uploadProgressBar.style.width = "6%";

  let progress = 6;
  state.uploadProgressTimer = setInterval(() => {
    progress = Math.min(progress + 7, 92);
    refs.uploadProgressBar.style.width = `${progress}%`;
  }, 180);
}

function completeUploadProgress() {
  stopUploadProgress(false);
  refs.uploadProgressBar.style.width = "100%";
  setTimeout(() => {
    refs.uploadProgress.classList.add("hidden");
    refs.uploadProgressBar.style.width = "0";
  }, 420);
}

function stopUploadProgress(shouldHide = true) {
  if (state.uploadProgressTimer) {
    clearInterval(state.uploadProgressTimer);
    state.uploadProgressTimer = null;
  }

  if (shouldHide) {
    refs.uploadProgress.classList.add("hidden");
    refs.uploadProgressBar.style.width = "0";
  }
}

function clearPreview() {
  refs.uploadPreview.classList.add("hidden");
  refs.uploadPreviewImage.classList.add("hidden");
  refs.uploadPreviewVideo.classList.add("hidden");
  refs.uploadPreviewImage.src = "";
  refs.uploadPreviewVideo.pause();
  refs.uploadPreviewVideo.src = "";
}

function renderPreview({ type, url, useObjectUrl }) {
  clearPreview();
  if (!url) return;

  refs.uploadPreview.classList.remove("hidden");

  if (type === "video") {
    refs.uploadPreviewVideo.classList.remove("hidden");
    refs.uploadPreviewVideo.src = url;
  } else {
    refs.uploadPreviewImage.classList.remove("hidden");
    refs.uploadPreviewImage.src = url;
  }

  if (useObjectUrl) {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}

function formatDate(dateString) {
  if (!dateString) return "Khong ro ngay";

  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
