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
let selectedThumbnailType = 'url'; // 'url' atau 'file'

// Jalankan sistem saat halaman selesai dimuat sepenuhnya
window.onload = function() {
    loadDatabase();
};

// ==================== HELPER DEKODE & ENKODE BASE64 UTF-8 (SOLUSI ERROR ATOB) ====================

// Fungsi mendekode Base64 ke String UTF-8 dengan aman (Mengatasi Spasi, Baris Baru, dan Emoji)
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
        
        // Dekode konten JSON aman
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
        // Normalisasi format link lama ke skema multi-tautan baru
        let linksArray = [];
        if (item.links && Array.isArray(item.links)) {
            linksArray = item.links;
        } else if (item.video_url) {
            // Konversi dari format database versi lama
            linksArray = [{ label: "Tonton Video", url: item.video_url }];
        }

        const card = document.createElement('div');
        card.className = 'content-card';
        
        // Buat elemen card HTML
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
                    <!-- Kumpulan multi-tautan dynamic -->
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

// ==================== TABS INTERFACE CONTROLLER FOR THUMBNAIL ====================
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

    // Batasi ukuran gambar demi performa JSON (opsional, disarankan < 1.5MB)
    if (file.size > 2 * 1024 * 1024) {
        alert("Peringatan: Ukuran gambar di atas 2MB mungkin memperlambat performa sistem.");
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        
        // Tampilkan pratinjau gambar di modal
        document.getElementById('file-preview-img').src = base64Data;
        document.getElementById('file-preview-container').style.display = 'block';
        
        // Simpan data base64 ke elemen penampung final
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
        <input type="text" class="form-link-label" placeholder="Nama Tombol (misal: Server 1)" value="${label}" style="width: 35%;">
        <input type="url" class="form-link-url" placeholder="https://..." value="${url}" style="width: 55%;">
        <button type="button" class="remove-link-field-btn" onclick="removeLinkField('${uniqueId}')">✕</button>
    `;
    container.appendChild(row);
}

function removeLinkField(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }
}

// ==================== MODAL WINDOW CONTROLLER ====================
function openModal(mode, id = null) {
    currentModalMode = mode;
    document.getElementById('post-modal').style.display = 'flex';
    document.getElementById('modal-error').style.display = 'none';
    
    // Reset Dynamic Links
    document.getElementById('links-container').innerHTML = '';
    
    // Reset File Input
    clearSelectedFile();
    
    if (mode === 'create') {
        document.getElementById('modal-title').innerText = 'Tambah Postingan Baru';
        document.getElementById('form-post-id').value = '';
        document.getElementById('form-thumbnail-url').value = '';
        document.getElementById('form-thumbnail-final').value = '';
        document.getElementById('form-title').value = '';
        document.getElementById('delete-btn').style.display = 'none';
        
        switchThumbInput('url');
        // Tambah kolom input tautan perdana
        addLinkField('Tonton Video', '');
    } else {
        document.getElementById('modal-title').innerText = 'Sunting / Edit Postingan';
        document.getElementById('delete-btn').style.display = 'block';
        
        // Cari data lama yang dipilih
        const matchItem = databaseRecords.find(i => i.id === id);
        if (matchItem) {
            document.getElementById('form-post-id').value = matchItem.id;
            document.getElementById('form-title').value = matchItem.title;
            
            // Periksa jenis gambar thumbnail lama (URL atau Base64)
            const thumbSrc = matchItem.thumbnail || '';
            document.getElementById('form-thumbnail-final').value = thumbSrc;
            
            if (thumbSrc.startsWith('data:image')) {
                // Gambar Base64 Lokal
                switchThumbInput('file');
                document.getElementById('form-thumbnail-url').value = '';
                document.getElementById('file-preview-img').src = thumbSrc;
                document.getElementById('file-preview-container').style.display = 'block';
            } else {
                // Gambar URL Eksternal biasa
                switchThumbInput('url');
                document.getElementById('form-thumbnail-url').value = thumbSrc;
            }
            
            // Muat multi-tautan lama
            if (matchItem.links && Array.isArray(matchItem.links) && matchItem.links.length > 0) {
                matchItem.links.forEach(l => {
                    addLinkField(l.label, l.url);
                });
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
    
    // Dapatkan data gambar final berdasarkan tipe input yang aktif
    let finalThumbnail = '';
    if (selectedThumbnailType === 'url') {
        finalThumbnail = document.getElementById('form-thumbnail-url').value.trim();
    } else {
        finalThumbnail = document.getElementById('form-thumbnail-final').value.trim();
    }

    // Ambil semua daftar link tautan dinamis yang telah diinput
    const labelInputs = document.querySelectorAll('.form-link-label');
    const urlInputs = document.querySelectorAll('.form-link-url');
    const linksCollector = [];

    for (let i = 0; i < urlInputs.length; i++) {
        const linkUrl = urlInputs[i].value.trim();
        const linkLabel = labelInputs[i].value.trim() || `Tautan ${i + 1}`;
        if (linkUrl) {
            linksCollector.push({
                label: linkLabel,
                url: linkUrl
            });
        }
    }

    // Validasi formulir dasar
    if (!title) {
        showError('Judul postingan wajib diisi!');
        return;
    }
    if (!finalThumbnail) {
        showError('Harap tentukan URL gambar atau pilih gambar lokal untuk thumbnail!');
        return;
    }
    if (linksCollector.length === 0) {
        showError('Minimal masukkan 1 alamat URL tautan tujuan!');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'Menyimpan...';

    if (currentModalMode === 'create') {
        // Buat objek record baru berbasis timestamp unik
        const newRecord = {
            id: new Date().getTime().toString(), 
            title: title,
            thumbnail: finalThumbnail,
            links: linksCollector
        };
        databaseRecords.push(newRecord);
    } else {
        // Update record yang sudah ada
        const targetIndex = databaseRecords.findIndex(i => i.id === id);
        if (targetIndex !== -1) {
            databaseRecords[targetIndex].title = title;
            databaseRecords[targetIndex].thumbnail = finalThumbnail;
            databaseRecords[targetIndex].links = linksCollector;
            // Hapus field single lama jika ada demi kerapian database
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