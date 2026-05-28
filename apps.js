// ==================== CONFIGURATION ====================
const GITHUB_CONFIG = {
    username: "ParagiMaca",              // Username GitHub Anda
    repo: "vokep",                       // Nama repositori baru Anda
    path: "video_data.json",            // Berkas database penyimpanan otomatis
    token: "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" // Token aktif Anda
};

let databaseRecords = [];
let currentFileSha = null;
let currentModalMode = 'create'; // 'create' atau 'edit'

// Inisialisasi awal saat dokumen siap
window.onload = function() {
    loadDatabase();
};

// ==================== READ DATA (FETCH) ====================
async function loadDatabase() {
    const gridContainer = document.getElementById('video-grid');
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }
        });

        if (response.status === 404) {
            // Jika file json belum terbentuk di repositori baru, inisialisasi dengan array kosong
            databaseRecords = [];
            currentFileSha = null;
            renderView(databaseRecords);
            return;
        }

        const rawData = await response.json();
        currentFileSha = rawData.sha;
        // Decode base64 konten dari GitHub
        const decodedContent = decodeURIComponent(escape(atob(rawData.content)));
        databaseRecords = JSON.parse(decodedContent);
        
        renderView(databaseRecords);

    } catch (err) {
        console.error(err);
        gridContainer.innerHTML = `<p class="status-msg" style="color: #f87171;">Gagal tersambung ke database cloud GitHub.</p>`;
    }
}

function renderView(data) {
    const gridContainer = document.getElementById('video-grid');
    gridContainer.innerHTML = '';

    if (data.length === 0) {
        gridContainer.innerHTML = '<p class="status-msg">Belum ada konten tersedia. Klik tombol di atas untuk menambah.</p>';
        return;
    }

    // Urutkan dari yang terbaru (postingan baru berada di atas)
    const displayData = [...data].reverse();

    displayData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <a href="${item.video_url}" target="_blank" rel="noopener noreferrer" class="card-link">
                <div class="thumb-container">
                    <img src="${item.thumbnail}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/400x250?text=Image+Not+Found'">
                </div>
                <div class="card-details">
                    <h3 class="card-title">${item.title}</h3>
                </div>
            </a>
            <div class="edit-action-bar">
                <button class="edit-trigger-btn" onclick="openModal('edit', '${item.id}')">✏️ Sunting</button>
            </div>
        `;
        gridContainer.appendChild(card);
    });
}

// ==================== MODAL CONTROLLER ====================
function openModal(mode, id = null) {
    currentModalMode = mode;
    document.getElementById('post-modal').style.display = 'flex';
    document.getElementById('modal-error').style.display = 'none';
    
    if (mode === 'create') {
        document.getElementById('modal-title').innerText = 'Tambah Postingan Baru';
        document.getElementById('form-post-id').value = '';
        document.getElementById('form-title').value = '';
        document.getElementById('form-thumbnail').value = '';
        document.getElementById('form-url').value = '';
        document.getElementById('delete-btn').style.display = 'none';
    } else {
        document.getElementById('modal-title').innerText = 'Sunting / Edit Postingan';
        document.getElementById('delete-btn').style.display = 'block';
        
        // Cari data lama yang dipilih
        const matchItem = databaseRecords.find(i => i.id === id);
        if (matchItem) {
            document.getElementById('form-post-id').value = matchItem.id;
            document.getElementById('form-title').value = matchItem.title;
            document.getElementById('form-thumbnail').value = matchItem.thumbnail;
            document.getElementById('form-url').value = matchItem.video_url;
        }
    }
}

function closeModal() {
    document.getElementById('post-modal').style.display = 'none';
}

// ==================== SAVE & UPDATE LOGIC (WRITE) ====================
async function savePostSubmit() {
    const title = document.getElementById('form-title').value.trim();
    const thumbnail = document.getElementById('form-thumbnail').value.trim();
    const video_url = document.getElementById('form-url').value.trim();
    const id = document.getElementById('form-post-id').value;
    const saveBtn = document.getElementById('save-btn');

    if (!title || !thumbnail || !video_url) {
        showError('Semua kolom formulir wajib diisi!');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'Menyimpan...';

    if (currentModalMode === 'create') {
        // Buat objek record baru berbasis timestamp unik
        const newRecord = {
            id: new Date().getTime().toString(), 
            title: title,
            thumbnail: thumbnail,
            video_url: video_url
        };
        databaseRecords.push(newRecord);
    } else {
        // Update record yang sudah ada
        const targetIndex = databaseRecords.findIndex(i => i.id === id);
        if (targetIndex !== -1) {
            databaseRecords[targetIndex].title = title;
            databaseRecords[targetIndex].thumbnail = thumbnail;
            databaseRecords[targetIndex].video_url = video_url;
        }
    }

    const success = await pushDatabaseToGitHub("Pembaruan direktori video via dashboard");
    if (success) {
        closeModal();
        loadDatabase();
    }
    saveBtn.disabled = false;
    saveBtn.innerText = 'Simpan';
}

// ==================== DELETE LOGIC ====================
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

// ==================== PUSH COMMAND (COMMIT KE GITHUB) ====================
async function pushDatabaseToGitHub(commitMessage) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    
    // Konversi string ke Base64 UTF-8 dengan aman
    const jsonString = JSON.stringify(databaseRecords, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

    const bodyPayload = {
        message: commitMessage,
        content: encodedContent
    };

    // Sertakan SHA lama jika memperbarui file yang sudah ada
    if (currentFileSha) {
        bodyPayload.sha = currentFileSha;
    }

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Gagal sinkronisasi API.");
        }
        return true;

    } catch (err) {
        console.error(err);
        showError(`Gagal melakukan sinkronisasi: ${err.message}`);
        return false;
    }
}

function showError(msg) {
    const errBanner = document.getElementById('modal-error');
    errBanner.innerText = msg;
    errBanner.style.display = 'block';
}
