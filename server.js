// 1. Gizli Çevre Değişkenlerini (.env) ve Gerekli Kütüphaneleri Yüklüyoruz
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // SQLite yerine PostgreSQL Havuz motoru geldi
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // Ön yüz dosyaların için

// 2. Bulut Veritabanı Bağlantısını Kuruyoruz
// Bu kısım şifreyi otomatik olarak .env dosyasındaki DATABASE_URL'den çeker
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon.tech bulut güvenliği için bu ayar zorunludur usta
  }
});

// Bağlantı testini terminalde görmek için küçük bir kontrol yapalım
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Bulut veritabanına bağlanırken hata oluştu:', err.stack);
  }
  console.log('✅ Dükkan bulut veritabanına başarıyla bağlandı, kilitler açıldı!');
  release();
});

// 3. Tabloları Bulutta Otomatik Oluşturma Fonksiyonu
// Dükkanın çalışması için gerekli olan ilk tabloları internette inşa ediyoruz
const tabloyuHazirla = async () => {
  const queryMetni = `
    CREATE TABLE IF NOT EXISTS urunler (
      id SERIAL PRIMARY KEY,
      urun_adi VARCHAR(255) NOT NULL,
      barkod VARCHAR(100) UNIQUE,
      stok_adedi INT DEFAULT 0,
      fiyat DECIMAL(10, 2) NOT NULL,
      eklenme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryMetni);
    console.log('📦 Ürünler tablosu bulutta hazır hale getirildi.');
  } catch (err) {
    console.error('❌ Tablo oluşturulurken hata:', err);
  }
};

tabloyuHazirla();

// --- BURADAN AŞAĞISI SENİN API ENDPOINT'LERİN OLACAK ---
// ==========================================
// 1. YENİ ÜRÜN EKLEME API'Sİ (CREATE)
// ==========================================
app.post('/api/urunler', async (req, res) => {
  // Ön yüzden (arayüzden) gelen dükkan verilerini yakalıyoruz
  const { urun_adi, barkod, stok_adedi, fiyat } = req.body;

  // Güvenlik için SQL Injection engelleyici numaralı ($1, $2..) sorgu hazırlıyoruz
  const sorguMetni = `
    INSERT INTO urunler (urun_adi, barkod, stok_adedi, fiyat) 
    VALUES ($1, $2, $3, $4) 
    RETURNING *;
  `;
  const degerler = [urun_adi, barkod, stok_adedi, fiyat];

  try {
    // Sorguyu bulut havuzuna gönderip çalıştırıyoruz
    const sonuc = await pool.query(sorguMetni, degerler);
    // Eklenen ürünün son halini ön yüze başarıyla dönüyoruz
    res.status(201).json({ mesaj: "Ürün buluta başarıyla eklendi usta!", urun: sonuc.rows[0] });
  } catch (err) {
    console.error('❌ Buluta ürün eklenirken hata oluştu:', err);
    res.status(500).json({ hata: "Ürün eklenemedi, barkod mükerrer olabilir usta!" });
  }
});

// ==========================================
// 2. DÜKKAN SATIŞ / STOK GÜNCELLEME API'Sİ (UPDATE)
// ==========================================
app.put('/api/urunler/:id', async (req, res) => {
  const { id } = req.params; // Güncellenecek ürünün buluttaki benzersiz numarası
  const { stok_adedi, fiyat } = req.body; // Ön yüzden gelen yeni değerler

  const sorguMetni = `
    UPDATE urunler 
    SET stok_adedi = $1, fiyat = $2 
    WHERE id = $3 
    RETURNING *;
  `;
  const degerler = [stok_adedi, fiyat, id];

  try {
    const sonuc = await pool.query(sorguMetni, degerler);
    if (sonuc.rows.length === 0) {
      return res.status(404).json({ hata: "Güncellenmek istenen ürün dükkanda bulunamadı!" });
    }
    res.json({ mesaj: "Stok/Fiyat bulutta güncellendi usta!", urun: sonuc.rows[0] });
  } catch (err) {
    console.error('❌ Bulut stok güncelleme hatası:', err);
    res.status(500).json({ hata: "Stok güncellenirken sistemsel bir hata oluştu!" });
  }
});

// ==========================================
// 3. ÜRÜN SİLME API'Sİ (DELETE)
// ==========================================
app.delete('/api/urunler/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const sonuc = await pool.query('DELETE FROM urunler WHERE id = $1 RETURNING *', [id]);
    if (sonuc.rows.length === 0) {
      return res.status(404).json({ hata: "Silinmek istenen ürün zaten dükkanda yok!" });
    }
    res.json({ mesaj: "Ürün dükkandan ve buluttan tamamen silindi usta!" });
  } catch (err) {
    console.error('❌ Bulut silme hatası:', err);
    res.status(500).json({ hata: "Ürün silinirken sistemsel bir hata oluştu!" });
  }
});