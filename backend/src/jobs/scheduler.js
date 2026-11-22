const axios = require('axios');
const cron = require('node-cron');
const pool = require('../db');

const FSS_TARGETS = [
  { endpoint: 'depositProductsSearch.json', topFinGrpNo: '020000', productType: '정기예금', sectorType: '1금융권' },
  { endpoint: 'savingProductsSearch.json',  topFinGrpNo: '020000', productType: '정기적금', sectorType: '1금융권' },
  { endpoint: 'depositProductsSearch.json', topFinGrpNo: '030300', productType: '정기예금', sectorType: '저축은행' },
  { endpoint: 'savingProductsSearch.json',  topFinGrpNo: '030300', productType: '정기적금', sectorType: '저축은행' },
];

async function ensureBankTableColumns() {
  await pool.query(`
    ALTER TABLE bank_products
      ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT '정기적금',
      ADD COLUMN IF NOT EXISTS sector_type VARCHAR(20) DEFAULT '1금융권';
  `);
}

async function fetchFssCategory(apiKey, target) {
  const url = `http://finlife.fss.or.kr/finlifeapi/${target.endpoint}?auth=${apiKey}&topFinGrpNo=${target.topFinGrpNo}&pageNo=1`;
  const res = await axios.get(url, { timeout: 12000 });
  const result = res.data?.result;
  if (!result || result.err_cd !== '000') {
    throw new Error(`${target.sectorType} ${target.productType} 응답 오류: ${result?.err_msg || 'Unknown'}`);
  }

  const baseMap = new Map();
  (result.baseList || []).forEach((b) => {
    baseMap.set(b.fin_prdt_cd, {
      bank_name: b.kor_co_nm,
      product_name: b.fin_prdt_nm,
    });
  });

  const rows = [];
  for (const opt of result.optionList || []) {
    const info = baseMap.get(opt.fin_prdt_cd);
    if (!info) continue;
    if (['6', '12', '24'].includes(String(opt.save_trm))) {
      rows.push({
        bank_name: info.bank_name,
        product_name: info.product_name,
        product_type: target.productType,
        sector_type: target.sectorType,
        save_term_months: Number(opt.save_trm),
        base_rate: Number(opt.intr_rate) || 0,
        max_rate: Number(opt.intr_rate2) || Number(opt.intr_rate) || 0,
      });
    }
  }
  return rows;
}

async function syncBankRates() {
  const apiKey = process.env.FSS_API_KEY;
  if (!apiKey) {
    console.log('⚠️ FSS_API_KEY가 비어 있어 금감원 동기화를 건너뜁니다.');
    return;
  }

  try {
    await ensureBankTableColumns();
    const results = await Promise.allSettled(
      FSS_TARGETS.map((target) => fetchFssCategory(apiKey, target))
    );

    const allRows = [];
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        allRows.push(...r.value);
      } else {
        console.error(`⚠️ 일부 카테고리 수집 실패 (${FSS_TARGETS[idx].sectorType} ${FSS_TARGETS[idx].productType}):`, r.reason.message);
      }
    });

    if (allRows.length > 0) {
      await pool.query('DELETE FROM bank_products');
      for (const row of allRows) {
        await pool.query(
          `INSERT INTO bank_products
           (bank_name, product_name, product_type, sector_type, save_term_months, base_rate, max_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            row.bank_name,
            row.product_name,
            row.product_type,
            row.sector_type,
            row.save_term_months,
            row.base_rate,
            row.max_rate,
          ]
        );
      }
      console.log(`✅ 금감원 API 4종(1금융·저축은행 예적금) 동기화 완료: 총 ${allRows.length}건 적재`);
    }
  } catch (err) {
    console.error('❌ 금감원 API 전체 동기화 실패:', err.message);
  }
}

cron.schedule('0 9 * * *', syncBankRates);

module.exports = { syncBankRates };
