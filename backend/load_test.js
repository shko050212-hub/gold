const axios = require('axios');

const TARGET_URL = 'http://localhost/api';
const CONCURRENT_USERS = 50; // 동시 접속자 50명 시뮬레이션

async function runOpenRunTest() {
  console.log('🔄 1. 테스트 전 데모 데이터 초기화...');
  await axios.post(`${TARGET_URL}/reset-demo`);

  // 유저 잔액을 넉넉히 세팅 (동시 가입 테스트용)
  const prodRes = await axios.get(`${TARGET_URL}/products`);
  const product = prodRes.data[0];
  if (!product) {
    console.error('❌ 테스트할 특판 상품이 없습니다.');
    return;
  }

  console.log(`🎯 대상 상품: [${product.title}] (총 한도: ${product.total_limit}좌)`);
  console.log(`🚀 ${CONCURRENT_USERS}명 동시 오픈런 가입 요청 발사!\n`);

  const start = Date.now();
  const requests = Array.from({ length: CONCURRENT_USERS }, (_, idx) =>
    axios
      .post(`${TARGET_URL}/subscribe`, {
        userId: 1,
        productId: product.product_id,
        depositAmount: 10000, // 1만 원씩 50번 동시 요청
      })
      .then((res) => ({ status: 'SUCCESS', user: idx + 1, msg: res.data.message }))
      .catch((err) => ({
        status: 'FAIL',
        user: idx + 1,
        msg: err.response?.data?.error || err.message,
      }))
  );

  const results = await Promise.all(requests);
  const elapsed = Date.now() - start;

  const successCount = results.filter((r) => r.status === 'SUCCESS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  console.log('================ 📊 오픈런 트래픽 테스트 결과 ================');
  console.log(`⏱️ 총 소요 시간: ${elapsed}ms (초당 약 ${Math.round((CONCURRENT_USERS / elapsed) * 1000)}건 처리)`);
  console.log(`✅ 가입 성공: ${successCount}건 (상품 총 한도: ${product.total_limit}좌)`);
  console.log(`🛡️ 방어(거절)됨: ${failCount}건`);
  console.log('--------------------------------------------------------------');
  console.log('거절 사유 샘플:', results.find((r) => r.status === 'FAIL')?.msg || '없음');
}

runOpenRunTest();
