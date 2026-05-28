// Konfigurasi
const GITHUB_CONFIG = {
    username: "ParagiMaca",
    repo: "vokep",
    path: "video_data.json"
};

// Fungsi untuk mendapatkan token dari LocalStorage
function getAuthToken() {
    return localStorage.getItem('vokep_github_token') || "";
}

// Fungsi Buka/Tutup Modal Kunci
function openTokenModal() {
    document.getElementById('token-modal').style.display = 'flex';
    document.getElementById('admin-token-input').value = getAuthToken();
}

function closeTokenModal() {
    document.getElementById('token-modal').style.display = 'none';
}

function saveAdminToken() {
    const token = document.getElementById('admin-token-input').value.trim();
    localStorage.setItem('vokep_github_token', token);
    alert("Kunci berhasil disimpan!");
    closeTokenModal();
    loadDatabase();
}

// Fungsi utama aplikasi tetap seperti sebelumnya, pastikan loadDatabase menggunakan token dari getAuthToken()
async function loadDatabase() {
    const token = getAuthToken();
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
        });
        // ... (sisanya sesuaikan dengan logika fetch Anda)
    } catch (err) {
        console.error(err);
    }
}

window.onload = loadDatabase;