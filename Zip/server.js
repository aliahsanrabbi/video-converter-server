// Video to Audio Converter – CloudConvert style
// Node.js + Express + FFmpeg
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS – allow your frontend ---
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true,
  credentials: true
}));

// --- Upload dir ---
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
[uploadDir, outputDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Multer – 500MB max
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // accept video/audio
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || true) cb(null, true);
    else cb(new Error('Only video/audio files allowed'));
  }
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ffmpeg: true, time: new Date().toISOString() });
});

// --- Convert endpoint ---
// POST /api/convert
// form-data: file: <video>, bitrate: 192, format: mp3
app.post('/api/convert', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const inputPath = req.file.path;
  const bitrate = parseInt(req.body.bitrate) || 192;
  const format = (req.body.format || 'mp3').toLowerCase();
  const outputId = uuidv4();
  const outputName = `${outputId}.${format}`;
  const outputPath = path.join(outputDir, outputName);

  const allowedFormats = ['mp3', 'aac', 'wav', 'ogg', 'm4a', 'flac'];
  const outFormat = allowedFormats.includes(format) ? format : 'mp3';

  let lastProgress = 0;
  const startTime = Date.now();

  // Set headers for progress via SSE? Simple: just convert and return file
  // For progress polling, use /api/progress/:id – simplified here: direct download
  // If you want real-time progress, use the /api/convert-stream endpoint below

  ffmpeg(inputPath)
    .noVideo()
    .audioCodec(outFormat === 'mp3' ? 'libmp3lame' : outFormat === 'aac' ? 'aac' : undefined)
    .audioBitrate(bitrate)
    .format(outFormat)
    .on('start', cmd => console.log('FFmpeg:', cmd))
    .on('progress', p => {
      if (p.percent) lastProgress = Math.floor(p.percent);
    })
    .on('end', () => {
      fs.unlink(inputPath, () => {});
      res.download(outputPath, `audio.${outFormat}`, err => {
        // cleanup output after 60s
        setTimeout(() => fs.unlink(outputPath, () => {}), 60000);
      });
      console.log(`Done in ${(Date.now()-startTime)/1000}s`);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err.message);
      fs.unlink(inputPath, () => {});
      if (!res.headersSent) res.status(500).json({ error: 'Conversion failed: ' + err.message });
    })
    .save(outputPath);
});

// --- Convert with progress (SSE) ---
// POST /api/convert-stream – returns a jobId, then GET /api/progress/:jobId for SSE
const jobs = new Map();

app.post('/api/convert-stream', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const jobId = uuidv4();
  const inputPath = req.file.path;
  const bitrate = parseInt(req.body.bitrate) || 192;
  const format = (req.body.format || 'mp3').toLowerCase();
  const outputName = `${jobId}.${format}`;
  const outputPath = path.join(outputDir, outputName);

  jobs.set(jobId, { progress: 0, status: 'starting', outputPath, outputName, error: null });

  res.json({ jobId });

  // start conversion async
  ffmpeg(inputPath)
    .noVideo()
    .audioCodec(format === 'mp3' ? 'libmp3lame' : undefined)
    .audioBitrate(bitrate)
    .format(format)
    .on('progress', p => {
      const job = jobs.get(jobId);
      if (job) job.progress = Math.floor(p.percent || 0);
    })
    .on('end', () => {
      const job = jobs.get(jobId);
      if (job) { job.progress = 100; job.status = 'done'; }
      fs.unlink(inputPath, () => {});
      // auto cleanup output after 10 min
      setTimeout(() => {
        fs.unlink(outputPath, () => {});
        jobs.delete(jobId);
      }, 10 * 60 * 1000);
    })
    .on('error', err => {
      const job = jobs.get(jobId);
      if (job) { job.status = 'error'; job.error = err.message; }
      fs.unlink(inputPath, () => {});
    })
    .save(outputPath);
});

// SSE progress
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const send = () => {
    const job = jobs.get(jobId);
    if (!job) { res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`); return res.end(); }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === 'done' || job.status === 'error') return res.end();
  };
  send();
  const iv = setInterval(send, 500);
  req.on('close', () => clearInterval(iv));
});

// Download result
app.get('/api/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Not ready' });
  res.download(job.outputPath, `audio.${path.extname(job.outputPath).slice(1)}`);
});

// Serve frontend (optional – put your HTML in /public)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Video to Audio Converter running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
});
