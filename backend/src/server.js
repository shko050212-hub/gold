const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRouter = require('./routes/products');
const subscribeRouter = require('./routes/subscribe');
const manageRouter = require('./routes/manage');
const { syncBankRates } = require('./jobs/scheduler');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', productsRouter);
app.use('/api', subscribeRouter);
app.use('/api', manageRouter);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 백엔드 서버 실행 중: http://0.0.0.0:${PORT}`);
  await syncBankRates();
});
