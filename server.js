const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'envanter_db.json');

app.use(express.json());

// Sunucuya, index.html ve diğer statik dosyaların "public" klasöründe olduğunu söylüyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Veritabanı dosyasını oku/oluştur
function verileriOku() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
        return [];
    }
    const veri = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(veri || '[]');
}

function verileriYaz(veri) {
    fs.writeFileSync(DB_FILE, JSON.stringify(veri, null, 2));
}

// Tüm Ürünleri Getir
app.get('/api/urunler', (req, res) => {
    res.json(verileriOku());
});

// Yeni Ürün Ekle
app.post('/api/urunler', (req, res) => {
    const urunler = verileriOku();
    const yeniUrun = { id: Date.now(), ...req.body };
    urunler.push(yeniUrun);
    verileriYaz(urunler);
    res.status(201).json({ durum: "başarılı", urun: yeniUrun });
});

// Ürün Güncelle
app.put('/api/urunler/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let urunler = verileriOku();
    const indeks = urunler.findIndex(u => u.id === id);
    if (indeks !== -1) {
        urunler[indeks] = { ...urunler[indeks], ...req.body };
        verileriYaz(urunler);
        res.json({ durum: "güncellendi" });
    } else {
        res.status(404).json({ hata: "Ürün bulunamadı" });
    }
});

// Ürün Sil
app.delete('/api/urunler/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let urunler = verileriOku();
    urunler = urunler.filter(u => u.id !== id);
    verileriYaz(urunler);
    res.json({ durum: "silindi" });
});

// Ana Sayfa İsteği geldiğinde public klasöründeki index.html'i gönderiyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Envanter Otomasyonu http://localhost:${PORT} adresinde tıkır tıkır çalışıyor!`);
});