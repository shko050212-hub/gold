const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/my-subscriptions', async (req, res) => {
  const userId = Number(req.query.userId) || 1;
  try {
    const userRes = await pool.query('SELECT user_id, email, name, balance FROM users WHERE user_id = $1', [userId]);
    const subsRes = await pool.query(
      `SELECT s.*, p.title, p.interest_rate, p.duration_days
       FROM subscriptions s JOIN special_products p ON s.product_id = p.product_id
       WHERE s.user_id = $1 ORDER BY s.subscribed_at DESC`,
      [userId]
    );
    res.json({ user: userRes.rows[0] || null, subscriptions: subsRes.rows });
  } catch (err) {
    console.error('my-subscriptions 조회 오류:', err.message);
    res.status(500).json({ error: '가입 내역을 불러오지 못했습니다.' });
  }
});

router.post('/reset-demo', async (req, res) => {
  try {
    await pool.query('DELETE FROM subscriptions');
    await pool.query('UPDATE users SET balance = 5000000 WHERE user_id = 1');
    await pool.query('UPDATE special_products SET remaining_count = total_limit');
    res.json({ message: '데모 데이터가 초기화되었습니다.' });
  } catch (err) {
    console.error('reset-demo 오류:', err.message);
    res.status(500).json({ error: '초기화 실패' });
  }
});

module.exports = router;
