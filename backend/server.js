require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const documentsRouter = require('./routes/documents');
const chatRouter = require('./routes/chat');
const generateRouter = require('./routes/generate');
const projectsRouter = require('./routes/projects');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
}));
app.use(express.json());

// 生成したExcel/PowerPointファイルをダウンロードできるよう静的配信
app.use('/generated', express.static(path.join(__dirname, 'generated')));

app.use('/api/projects', projectsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/generate', generateRouter);

app.get('/', (req, res) => {
  res.send('資料チャットAI backend is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
