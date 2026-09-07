const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { OfflineCompiler } = require('mind-ar-node');

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta de uploads existe
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.pedidoId}_${file.fieldname}${ext}`);
  }
});

const upload = multer({ storage });

app.use((req, res, next) => {
  req.pedidoId = 'caneca_' + Date.now();
  next();
});

app.use(express.static('public'));

app.post('/criar', upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const id = req.pedidoId;
    const fotoPath = req.files['foto'][0].path;
    const videoOriginal = req.files['video'][0];

    const videoFinal = path.join(uploadDir, `${id}.mp4`);
    fs.renameSync(videoOriginal.path, videoFinal);

    // Compilação do marcador da imagem
    const compiler = new OfflineCompiler();
    await compiler.loadImage(fotoPath);
    const compiledData = await compiler.compile();
    
    const mindFinal = path.join(uploadDir, `${id}.mind`);
    fs.writeFileSync(mindFinal, Buffer.from(compiledData));

    // Monta o link para o QR Code
    const host = req.get('host');
    const protocolo = req.protocol === 'http' && host.includes('render.com') ? 'https' : req.protocol;
    const urlVisualizador = `${protocolo}://${host}/ver.html?id=${id}`;
    
    const qrDataUrl = await QRCode.toDataURL(urlVisualizador);

    res.json({
      sucesso: true,
      id: id,
      urlVisualizador: urlVisualizador,
      qrCodeUrl: qrDataUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});