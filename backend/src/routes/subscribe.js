const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/subscribe', async (req, res) => {
  const { userId = 1, productId, depositAmount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prodRes = await client.query('SELECT * FROM special_products WHERE product_id = $1 FOR UPDATE', [productId]);
    if (prodRes.rows.length === 0) throw new Error('존재하지 않는 특판 상품입니다.');

    const product = prodRes.rows[0];
    if (new Date() < new Date(product.open_at)) throw new Error('아직 오픈 시간이 되지 않았습니다.');
    if (product.remaining_count <= 0) throw new Error('선착순 마감된 상품입니다.');
    if (depositAmount > Number(product.max_deposit_amount)) throw new Error('최대 납입 한도를 초과했습니다.');

    const userRes = await client.query('SELECT * FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
    if (userRes.rows.length === 0) throw new Error('사용자 정보를 찾을 수 없습니다.');
    if (Number(userRes.rows[0].balance) < depositAmount) throw new Error('계좌 잔액이 부족합니다.');

    const expectedInterest = Math.floor(depositAmount * (Number(product.interest_rate) / 100) * (product.duration_days / 365));

    await client.query('UPDATE special_products SET remaining_count = remaining_count - 1 WHERE product_id = $1', [productId]);
    await client.query('UPDATE users SET balance = balance - $1 WHERE user_id = $2', [depositAmount, userId]);
    const subRes = await client.query(
      'INSERT INTO subscriptions (user_id, product_id, deposit_amount, expected_interest) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, productId, depositAmount, expectedInterest]
    );

    await client.query('COMMIT');
    res.json({ message: '특판 적금 가입이 완료되었습니다!', subscription: subRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
