// ==================== CONFIGURATION ====================
const GITHUB_CONFIG = {
    username: "ParagiMaca",              // Username GitHub Anda
    repo: "vokep",                       // Nama repositori Anda
    path: "video_data.json"              // Nama berkas database JSON
};

let databaseRecords = [];
let currentFileSha = null;
let currentModalMode = 'create'; 
let selectedThumbnailType = 'url'; 

// Mengambil Token dari browser lokal HP Anda secara mandiri
function getAuthToken() {
    return localStorage.getItem('vokep_github_token') || "";
}

// Jalankan sistem saat halaman selesai dimuat sepenuhnya
window.onload = function() {
    // Cek apakah token admin sudah dikonfigurasi secara lokal
    if (!getAuthToken()) {
        console.warn("Sistem berjalan dalam mode baca. Atur kunci admin di menu pengaturan.");
    }
    loadDatabase();
};

// ==================== HELPER DEKODE & ENKODE BASE64 UTF-8 (SOLUSI ERROR ATOB) ====================

// Fungsi mendekode Base64 ke String UTF-8 dengan aman
function decodeBase64Utf8(base64Str) {
    const cleanedBase64 = base64Str.replace(/\s/g, '');
    const binaryString = atob(cleanedBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

// Fungsi mengkodekan String UTF-8 ke Base64 dengan aman
function encodeBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
}

// ==================== BACA DATA DARI CLOUD (FETCH) ====================
async function loadDatabase() {
    const gridContainer = document.getElementById('video-grid');
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

    const headers = { 'Cache-Control': 'no-cache' };
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    try {
        const response = await fetch(url, { headers });

        if (response.status === 404) {
            databaseRecords = [];
            currentFileSha = null;
            renderView(databaseRecords);
            return;
        }

        if (response.status === 401) {
            gridContainer.innerHTML = `<p class="status-msg" style="color: #f87171;">⚠️ Token Salah/Kedaluwarsa. Silakan perbarui Kunci Admin di pojok kanan atas.</p>`;
            return;
        }

        if (!response.ok) {
            throw new Error(`Respons server gagal dengan status: ${response.status}`);
        }

        const rawData = await response.json();
        currentFileSha = rawData.sha;
        
        const decodedContent = decodeBase64Utf8(rawData.content);
        databaseRecords = JSON.parse(decodedContent);
        
        renderView(databaseRecords);

    } catch (err) {
        console.error("Detail log kegagalan:", err);
        // Jika gagal karena pembatasan rate limit publik (tanpa token)
        if (err.message.includes("Failed to fetch") && !token) {
            gridContainer.innerHTML = `
                <div class="status-msg" style="color: #fbbf24;">
                    <p>⚠️ Gagal terhubung tanpa Kunci Admin (Terkena Batas API Publik).</p>
                    <p style="font-size: 0.8rem; margin-top: 10px; color: #a1a1aa;">
                        Silakan klik tombol <strong>⚙️ Atur Kunci</strong> di kanan atas, masukkan token GitHub Anda, lalu muat ulang halaman.
                    </p>
                </div>`;
        } else {
            gridContainer.innerHTML = `<p class="status-msg" style="color: #f87171;">Gagal memuat katalog: ${err.message}</p>`;
        }
    }
}

// ==================== RENDERING TAMPILAN KARTU ====================
function renderView(data) {
    const gridContainer = document.getElementById('video-grid');
    gridContainer.innerHTML = '';

    if (!data || data.length === 0) {
        gridContainer.innerHTML = '<p class="status-msg">Belum ada konten tersedia. Klik tombol di atas untuk menambah.</p>';
        return;
    }

    const displayData = [...data].reverse();

    displayData.forEach(item => {
        let linksArray = [];
        if (item.links && Array.isArray(item.links)) {
            linksArray = item.links;
        } else if (item.video_url) {
            linksArray = [{ label: "Tonton Video", url: item.video_url }];
        }

        const card = document.createElement('div');
        card.className = 'content-card';
        
        let linksHtml = '';
        linksArray.forEach((link, idx) => {
            const btnLabel = link.label ? link.label : `Tautan ${idx + 1}`;
            linksHtml += `
                <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card-direct-btn">
                    <span class="link-btn-label">🔗 ${btnLabel}</span>
                    <span>▶</span>
                </a>
            `;
        });

        card.innerHTML = `
            <div class="card-link">
                <div class="thumb-container">
                    <img src="${item.thumbnail}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/400x250?text=Gambar+Rusak'">
                </div>
                <div class="card-details">
                    <h3 class="card-title">${item.title}</h3>
                    <div class="multi-links-wrapper">
                        ${linksHtml || '<p style="font-size: 0.75rem; color: #71717a">Tidak ada tautan terpasang.</p>'}
                    </div>
                </div>
            </div>
            <div class="edit-action-bar">
                <button class="edit-trigger-btn" onclick="openModal('edit', '${item.id}')">✏️ Sunting</button>
            </div>
        `;
        gridContainer.appendChild(card);
    });
}

// ==================== TABS FOR THUMBNAIL INPUT ====================
function switchThumbInput(type) {
    selectedThumbnailType = type;
    const tabUrl = document.getElementById('tab-btn-url');
    const tabFile = document.getElementById('tab-btn-file');
    const containerUrl = document.getElementById('thumb-url-container');
    const containerFile = document.getElementById('thumb-file-container');

    if (type === 'url') {
        tabUrl.classList.add('active');
        tabFile.classList.remove('active');
        containerUrl.style.display = 'block';
        containerFile.style.display = 'none';
    } else {
        tabUrl.classList.remove('active');
        tabFile.classList.add('active');
        containerUrl.style.display = 'none';
        containerFile.style.display = 'block';
    }
}

// ==================== UNGGAL FILE LOKAL (CONVERT TO BASE64) ====================
function handleLocalFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
        alert("Peringatan: Gambar di atas 1.5MB dapat membebani database JSON. Direkomendasikan ukuran < 1MB.");
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        document.getElementById('file-preview-img').src = base64Data;
        document.getElementById('file-preview-container').style.display = 'block';
        document.getElementById('form-thumbnail-final').value = base64Data;
    };
    reader.readAsDataURL(file);
}

function clearSelectedFile() {
    document.getElementById('form-thumbnail-file').value = "";
    document.getElementById('file-preview-img').src = "";
    document.getElementById('file-preview-container').style.display = 'none';
    document.getElementById('form-thumbnail-final').value = "";
}

// ==================== MULTI-LINK DYNAMIC FIELD CONTROLLER ====================
function addLinkField(label = '', url = '') {
    const container = document.getElementById('links-container');
    const uniqueId = 'row-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100);
    
    const row = document.createElement('div');
    row.className = 'link-input-row';
    row.id = uniqueId;
    row.innerHTML = `
        <input type="text" class="form-link-label" placeholder="Server 1" value="${label}" style="width: 35%;">
        <input type="url" class="form-link-url" placeholder="https://..." value="${url}" style="width: 55%;">
        <button type="button" class="remove-link-field-btn" onclick="removeLinkField('${uniqueId}')">✕</button>
    `;
    container.appendChild(row);
}

function removeLinkField(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
}

// ==================== MODAL WINDOW CONTROLLER ====================
function openModal(mode, id = null) {
    if (!getAuthToken()) {
        alert("Akses Ditolak! Harap konfigurasi Kunci Admin (Token) Anda terlebih dahulu di menu pengaturan ⚙️.");
        openTokenModal();
        return;
    }

    currentModalMode = mode;
    document.getElementById('post-modal').style.display = 'flex';
    document.getElementById('modal-error').style.display = 'none';
    document.getElementById('links-container').innerHTML = '';
    clearSelectedFile();
    
    if (mode === 'create') {
        document.getElementById('modal-title').innerText = 'Tambah Postingan Baru';
        document.getElementById('form-post-id').value = '';
        document.getElementById('form-thumbnail-url').value = '';
        document.getElementById('form-thumbnail-final').value = '';
        document.getElementById('form-title').value = '';
        document.getElementById('delete-btn').style.display = 'none';
        switchThumbInput('url');
        addLinkField('Tonton Video', '');
    } else {
        document.getElementById('modal-title').innerText = 'Sunting / Edit Postingan';
        document.getElementById('delete-btn').style.display = 'block';
        
        const matchItem = databaseRecords.find(i => i.id === id);
        if (matchItem) {
            document.getElementById('form-post-id').value = matchItem.id;
            document.getElementById('form-title').value = matchItem.title;
            const thumbSrc = matchItem.thumbnail || '';
            document.getElementById('form-thumbnail-final').value = thumbSrc;
            
            if (thumbSrc.startsWith('data:image')) {
                switchThumbInput('file');
                document.getElementById('form-thumbnail-url').value = '';
                document.getElementById('file-preview-img').src = thumbSrc;
                document.getElementById('file-preview-container').style.display = 'block';
            } else {
                switchThumbInput('url');
                document.getElementById('form-thumbnail-url').value = thumbSrc;
            }
            
            if (matchItem.links && Array.isArray(matchItem.links) && matchItem.links.length > 0) {
                matchItem.links.forEach(l => addLinkField(l.label, l.url));
            } else if (matchItem.video_url) {
                addLinkField('Tonton Video', matchItem.video_url);
            } else {
                addLinkField('Tonton Video', '');
            }
        }
    }
}

function closeModal() {
    document.getElementById('post-modal').style.display = 'none';
}

// ==================== SAVE / UPDATE (PROSES KIRIM) ====================
async function savePostSubmit() {
    const title = document.getElementById('form-title').value.trim();
    const id = document.getElementById('form-post-id').value;
    const saveBtn = document.getElementById('save-btn');
    
    let finalThumbnail = '';
    if (selectedThumbnailType === 'url') {
        finalThumbnail = document.getElementById('form-thumbnail-url').value.trim();
    } else {
        finalThumbnail = document.getElementById('form-thumbnail-final').value.trim();
    }

    const labelInputs = document.querySelectorAll('.form-link-label');
    const urlInputs = document.querySelectorAll('.form-link-url');
    const linksCollector = [];

    for (let i = 0; i < urlInputs.length; i++) {
        const linkUrl = urlInputs[i].value.trim();
        const linkLabel = labelInputs[i].value.trim() || `Tautan ${i + 1}`;
        if (linkUrl) {
            linksCollector.push({ label: linkLabel, url: linkUrl });
        }
    }

    if (!title) { showError('Judul postingan wajib diisi!'); return; }
    if (!finalThumbnail) { showError('Harap masukkan URL gambar atau unggah gambar untuk thumbnail!'); return; }
    if (linksCollector.length === 0) { showError('Harap masukkan minimal 1 alamat URL tautan tujuan!'); return; }

    saveBtn.disabled = true;
    saveBtn.innerText = 'Menyimpan...';

    if (currentModalMode === 'create') {
        const newRecord = {
            id: new Date().getTime().toString(), 
            title: title,
            thumbnail: finalThumbnail,
            links: linksCollector
        };
        databaseRecords.push(newRecord);
    } else {
        const targetIndex = databaseRecords.findIndex(i => i.id === id);
        if (targetIndex !== -1) {
            databaseRecords[targetIndex].title = title;
            databaseRecords[targetIndex].thumbnail = finalThumbnail;
            databaseRecords[targetIndex].links = linksCollector;
            if (databaseRecords[targetIndex].video_url) {
                delete databaseRecords[targetIndex].video_url;
            }
        }
    }

    const success = await pushDatabaseToGitHub("Pembaruan direktori video dan multi-link");
    if (success) {
        closeModal();
        loadDatabase();
    }
    saveBtn.disabled = false;
    saveBtn.innerText = 'Simpan';
}

// ==================== PROSES HAPUS DATA ====================
async function deletePost() {
    const id = document.getElementById('form-post-id').value;
    if (!confirm("Apakah Anda yakin ingin menghapus postingan ini secara permanen?")) return;

    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.innerText = 'Menghapus...';

    databaseRecords = databaseRecords.filter(item => item.id !== id);

    const success = await pushDatabaseToGitHub("Menghapus item dari direktori");
    if (success) {
        closeModal();
        loadDatabase();
    }
    deleteBtn.disabled = false;
    deleteBtn.innerText = '🗑️ Hapus Postingan';
}

// ==================== COMMIT DATA KE REPO GITHUB ====================
async function pushDatabaseToGitHub(commitMessage) {
    const token = getAuthToken();
    if (!token) {
        showError("Kunci Akses (Token) Admin tidak ditemukan!");
        return false;
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    const jsonString = JSON.stringify(databaseRecords, null, 2);
    const encodedContent = encodeBase64Utf8(jsonString);

    const bodyPayload = {
        message: commitMessage,
        content: encodedContent
    };

    if (currentFileSha) {
        bodyPayload.sha = currentFileSha;
    }

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Gagal melakukan commit.");
        }
        return true;

    } catch (err) {
        console.error(err);
        showError(`Gagal melakukan sinkronisasi: ${err.message}`);
        return false;
    }
}

// ==================== TOKEN SETTINGS MODAL FUNCTIONS ====================
function openTokenModal() {
    document.getElementById('token-modal').style.display = 'flex';
    document.getElementById('admin-token-input').value = getAuthToken();
    document.getElementById('token-modal-msg').innerText = '';
}

function closeTokenModal() {
    document.getElementById('token-modal').style.display = 'none';
}

function saveAdminToken() {
    const tokenInput = document.getElementById('admin-token-input').value.trim();
    const msgEl = document.getElementById('token-modal-msg');

    if (!tokenInput) {
        localStorage.removeItem('vokep_github_token');
        msgEl.style.color = '#ef4444';
        msgEl.innerText = "Kunci Admin dihapus. Mode baca aktif.";
    } else {
        localStorage.setItem('vokep_github_token', tokenInput);
        msgEl.style.color = '#10b981';
        msgEl.innerText = "Kunci Admin disimpan dengan sukses!";
    }

    setTimeout(() => {
        closeTokenModal();
        loadDatabase(); // Muat ulang database menggunakan kunci baru
    }, 1000);
}

function showError(msg) {
    const errBanner = document.getElementById('modal-error');
    errBanner.innerText = msg;
    errBanner.style.display = 'block';
}