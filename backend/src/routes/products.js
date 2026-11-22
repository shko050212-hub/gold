const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM special_products ORDER BY open_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('products 조회 오류:', err.message);
    res.status(500).json({ error: '상품 목록을 불러오지 못했습니다.' });
  }
});

router.get('/bank-rates', async (req, res) => {
  try {
    const { type, sector, term } = req.query;
    const conditions = [];
    const params = [];

    if (type && type !== 'ALL') {
      params.push(type);
      conditions.push(`product_type = $${params.length}`);
    }
    if (sector && sector !== 'ALL') {
      params.push(sector);
      conditions.push(`sector_type = $${params.length}`);
    }
    if (term && term !== 'ALL') {
      params.push(Number(term));
      conditions.push(`save_term_months = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM bank_products
      ${whereClause}
      ORDER BY max_rate DESC, base_rate DESC
      LIMIT 60
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('bank-rates 조회 오류:', err.message);
    res.status(500).json({ error: '시중 금리를 불러오지 못했습니다.' });
  }
});

module.exports = router;
