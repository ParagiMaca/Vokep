// ==================== CONFIGURATION ====================
const GITHUB_CONFIG = {
    username: "ParagiMaca",              // Username GitHub Anda
    repo: "vokep",                       // Nama repositori Anda
    path: "video_data.json",            // Nama berkas database JSON
    token: "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" // Token GitHub aktif Anda
};

let databaseRecords = [];
let currentFileSha = null;
let currentModalMode = 'create'; // 'create' atau 'edit'

// Jalankan sistem saat halaman selesai dimuat sepenuhnya
window.onload = function() {
    loadDatabase();
};

// ==================== HELPER DEKODE & ENKODE BASE64 UTF-8 (SOLUSI ERROR ATOB) ====================

// Fungsi mendekode Base64 ke String UTF-8 dengan aman (Mengatasi Spasi, Baris Baru, dan Emoji)
function decodeBase64Utf8(base64Str) {
    // 1. Bersihkan semua karakter spasi, baris baru (\n), atau return (\r) yang merusak format Base64
    const cleanedBase64 = base64Str.replace(/\s/g, '');
    
    // 2. Lakukan konversi string biner menggunakan atob
    const binaryString = atob(cleanedBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 3. Ubah byte array menjadi string UTF-8 asli secara aman
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

    try {
        const response = await fetch(url, {
            headers: { 
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Cache-Control': 'no-cache'
            }
        });

        // Jika file video_data.json belum terbentuk sama sekali di repositori
        if (response.status === 404) {
            databaseRecords = [];
            currentFileSha = null;
            renderView(databaseRecords);
            return;
        }

        // Jika token tidak memiliki izin tulis/baca (Unauthorized)
        if (response.status === 401) {
            gridContainer.innerHTML = `<p class="status-msg" style="color: #f87171;">⚠️ Hak Akses Gagal: Kunci Akses (Token) Anda salah atau kedaluwarsa.</p>`;
            return;
        }

        if (!response.ok) {
            throw new Error(`Respons server gagal dengan status: ${response.status}`);
        }

        const rawData = await response.json();
        currentFileSha = rawData.sha;
        
        // Gunakan dekoder kustom baru kita yang anti-error
        const decodedContent = decodeBase64Utf8(rawData.content);
        databaseRecords = JSON.parse(decodedContent);
        
        renderView(databaseRecords);

    } catch (err) {
        console.error("Detail log kegagalan:", err);
        gridContainer.innerHTML = `<p class="status-msg" style="color: #f87171;">Gagal memuat katalog: ${err.message}</p>`;
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

    // Tampilkan postingan baru di atas (urutan mundur)
    const displayData = [...data].reverse();

    displayData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <a href="${item.video_url}" target="_blank" rel="noopener noreferrer" class="card-link">
                <div class="thumb-container">
                    <img src="${item.thumbnail}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/400x250?text=Gambar+Rusak'">
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

// ==================== MODAL WINDOW CONTROLLER ====================
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

// ==================== SAVE / UPDATE (PROSES KIRIM) ====================
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
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    
    // Konversi string JSON ke Base64 UTF-8 menggunakan encoder baru yang aman
    const jsonString = JSON.stringify(databaseRecords, null, 2);
    const encodedContent = encodeBase64Utf8(jsonString);

    const bodyPayload = {
        message: commitMessage,
        content: encodedContent
    };

    // Sertakan SHA jika memperbarui file yang sudah terbentuk sebelumnya
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
            throw new Error(errorData.message || "Gagal melakukan commit.");
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