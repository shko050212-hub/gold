import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Clock, Flame, CheckCircle2, AlertCircle, Landmark, Wallet, PlusCircle } from 'lucide-react';

const API_BASE = '/api';
const TEST_USER_ID = 1;

export default function App() {
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'my' | 'admin'
  const [specialProducts, setSpecialProducts] = useState([]);
  const [bankProducts, setBankProducts] = useState([]);
  const [myInfo, setMyInfo] = useState({ user: null, subscriptions: [] });
  const [timeOffset, setTimeOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loadingId, setLoadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // 관리자 상품 등록 폼 상태
  const [form, setForm] = useState({
    title: '[긴급 오픈] 연 9.0% 30초 뒤 오픈 초단기 적금',
    interestRate: 9.0,
    durationDays: 100,
    maxDepositAmount: 300000,
    totalLimit: 100,
    openAfterSeconds: 30,
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/products`);
      const serverMs = new Date(res.data.serverTime).getTime();
      setTimeOffset(serverMs - Date.now());
      setSpecialProducts(res.data.specialProducts);
      setBankProducts(res.data.bankProducts);
    } catch (err) {
      console.error('상품 조회 실패:', err);
    }
  }, []);

  const fetchMyInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/manage/my/${TEST_USER_ID}`);
      setMyInfo(res.data);
    } catch (err) {
      console.error('내역 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchMyInfo();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const poller = setInterval(fetchProducts, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [fetchProducts, fetchMyInfo]);

  const handleSubscribe = async (productId) => {
    setLoadingId(productId);
    setToast(null);

    try {
      const res = await axios.post(`${API_BASE}/subscribe`, {
        userId: TEST_USER_ID,
        productId,
      });

      setToast({
        type: 'success',
        text: `${res.data.message} (만기 예상 이자: +${res.data.data.expectedInterest.toLocaleString()}원)`,
      });
      fetchProducts();
      fetchMyInfo();
    } catch (err) {
      setToast({
        type: 'error',
        text: err.response?.data?.message || '가입 요청에 실패했습니다.',
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/manage/products`, form);
      setToast({ type: 'success', text: '새 특판 상품이 등록되었습니다!' });
      fetchProducts();
      setActiveTab('market');
    } catch (err) {
      setToast({ type: 'error', text: '상품 등록 중 오류가 발생했습니다.' });
    }
  };

  const formatCountdown = (openAtStr) => {
    const syncedNow = now + timeOffset;
    const diff = new Date(openAtStr).getTime() - syncedNow;
    if (diff <= 0) return null;

    const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-indigo-600 text-white pt-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-amber-300" />
              타임딜 특판 적금 오픈런
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              매일 정각 선착순 한정 고금리 특판 & 시중 은행 금리 비교
            </p>
          </div>
          <div className="flex items-center gap-3">
            {myInfo.user && (
              <div className="text-right text-xs bg-indigo-700 px-3 py-2 rounded-lg">
                <div className="text-indigo-200">{myInfo.user.name}님 보유 잔액</div>
                <div className="font-mono text-sm font-bold text-amber-300">
                  {Number(myInfo.user.balance).toLocaleString()}원
                </div>
              </div>
            )}
            <div className="text-right text-xs bg-indigo-700 px-3 py-2 rounded-lg">
              <div className="text-indigo-200">서버 기준 시각</div>
              <div className="font-mono text-sm font-semibold">
                {new Date(now + timeOffset).toLocaleTimeString('ko-KR')}
              </div>
            </div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <nav className="max-w-4xl mx-auto flex gap-6 mt-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('market')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'market' ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white'
            }`}
          >
            특판 오픈런 & 금리비교
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'my' ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            내 가입 내역 ({myInfo.subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'admin' ? 'border-white text-white' : 'border-transparent text-indigo-200 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            특판 등록 (시연용)
          </button>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {toast && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 shadow-sm border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium text-sm">{toast.text}</span>
          </div>
        )}

        {/* 탭 1: 특판 오픈런 & 금리 비교 */}
        {activeTab === 'market' && (
          <>
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                오늘의 선착순 특판 상품
              </h2>

              <div className="grid md:grid-cols-2 gap-5">
                {specialProducts.map((item) => {
                  const countdown = formatCountdown(item.open_at);
                  const isSoldOut = item.remaining_count <= 0;
                  const isOpen = countdown === null;
                  const percent = Math.round((item.remaining_count / item.total_limit) * 100);

                  return (
                    <div
                      key={item.product_id}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              isSoldOut
                                ? 'bg-slate-200 text-slate-600'
                                : isOpen
                                ? 'bg-rose-100 text-rose-600 animate-pulse'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isSoldOut ? '선착순 마감' : isOpen ? '지금 가입 가능' : '오픈 대기중'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {item.duration_days}일 만기 · 최대 {Number(item.max_deposit_amount).toLocaleString()}원
                          </span>
                        </div>

                        <h3 className="text-lg font-bold mt-3">{item.title}</h3>

                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-sm text-slate-500">연</span>
                          <span className="text-3xl font-extrabold text-indigo-600">
                            {Number(item.interest_rate).toFixed(2)}%
                          </span>
                        </div>

                        <div className="mt-5">
                          <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-slate-600">남은 선착순 한도</span>
                            <span className="text-indigo-600 font-bold">
                              {item.remaining_count} / {item.total_limit}좌 ({percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                isSoldOut ? 'bg-slate-400' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        disabled={!isOpen || isSoldOut || loadingId === item.product_id}
                        onClick={() => handleSubscribe(item.product_id)}
                        className={`mt-6 w-full py-3.5 rounded-xl font-bold text-sm transition ${
                          isSoldOut
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : !isOpen
                            ? 'bg-amber-500 text-white cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.99]'
                        }`}
                      >
                        {loadingId === item.product_id
                          ? '가입 처리 중...'
                          : isSoldOut
                          ? '선착순 마감되었습니다'
                          : !isOpen
                          ? `오픈까지 ${countdown} 남음`
                          : '지금 바로 선착순 가입하기'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                시중 은행 정기적금 금리 비교 (매일 09:00 자동 갱신)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 px-2">금융회사</th>
                      <th className="py-3 px-2">상품명</th>
                      <th className="py-3 px-2">가입기간</th>
                      <th className="py-3 px-2 text-right">기본금리</th>
                      <th className="py-3 px-2 text-right">최고우대금리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bankProducts.map((bank) => (
                      <tr key={bank.bank_product_id} className="hover:bg-slate-50">
                        <td className="py-3 px-2 font-semibold text-slate-700">{bank.bank_name}</td>
                        <td className="py-3 px-2">{bank.product_name}</td>
                        <td className="py-3 px-2 text-slate-500">{bank.save_term_months}개월</td>
                        <td className="py-3 px-2 text-right text-slate-600">
                          {Number(bank.base_rate).toFixed(2)}%
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-indigo-600">
                          {Number(bank.max_rate).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* 탭 2: 내 가입 내역 */}
        {activeTab === 'my' && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4">나의 특판 적금 가입 현황</h2>
            {myInfo.subscriptions.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">아직 가입한 특판 상품이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {myInfo.subscriptions.map((sub) => (
                  <div
                    key={sub.subscription_id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-4"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{sub.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        연 {Number(sub.interest_rate).toFixed(2)}% · {sub.duration_days}일 만기 · 가입일시:{' '}
                        {new Date(sub.subscribed_at).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">
                        납입금 {Number(sub.deposit_amount).toLocaleString()}원
                      </div>
                      <div className="text-xs font-semibold text-emerald-600">
                        만기 예상 이자 +{Number(sub.expected_interest).toLocaleString()}원
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 탭 3: 특판 상품 등록 (시연용) */}
        {activeTab === 'admin' && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 max-w-lg mx-auto">
            <h2 className="text-lg font-bold mb-4">새 타임딜 특판 상품 등록</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold mb-1">상품명</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">연 이자율 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">가입 기간 (일)</label>
                  <input
                    type="number"
                    required
                    value={form.durationDays}
                    onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">1인 가입 금액 (원)</label>
                  <input
                    type="number"
                    required
                    value={form.maxDepositAmount}
                    onChange={(e) => setForm({ ...form, maxDepositAmount: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">선착순 총 한도 (명)</label>
                  <input
                    type="number"
                    required
                    value={form.totalLimit}
                    onChange={(e) => setForm({ ...form, totalLimit: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">몇 초 뒤에 오픈할까요? (0이면 즉시 오픈)</label>
                <input
                  type="number"
                  required
                  value={form.openAfterSeconds}
                  onChange={(e) => setForm({ ...form, openAfterSeconds: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition"
              >
                특판 상품 등록하기
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}