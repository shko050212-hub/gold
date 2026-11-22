import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Wallet,
  Sparkles,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
  Receipt,
  Calculator,
  Filter,
  Layers,
  ArrowRight,
  RefreshCw,
  ListChecks,
} from 'lucide-react';

const API_BASE = '/api';
const TEST_USER_ID = 1;

export default function App() {
  const [specialProducts, setSpecialProducts] = useState([]);
  const [bankProducts, setBankProducts] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [selectedAmounts, setSelectedAmounts] = useState({});
  const [now, setNow] = useState(Date.now());
  const [loadingId, setLoadingId] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null);

  // 탭 상태: 'special' | 'planner' | 'banks' | 'my'
  const [activeTab, setActiveTab] = useState('planner');

  // 전 금융권 필터 상태
  const [filterType, setFilterType] = useState('ALL');
  const [filterSector, setFilterSector] = useState('ALL');
  const [filterTerm, setFilterTerm] = useState('ALL');

  // 목표 목돈 설계 입력 상태
  const [currentHolding, setCurrentHolding] = useState(5000000); // 현재 보유 금액
  const [isHoldingSynced, setIsHoldingSynced] = useState(false);
  const [targetGoal, setTargetGoal] = useState(10000000);       // 목표 금액 (기본 1,000만 원)
  const [taxRate, setTaxRate] = useState(0.154);                // 세금 (15.4% / 9.5% / 0%)
  const [remainingMonths, setRemainingMonths] = useState(12);   // 남은 목표 기간 (개월)

  const fetchAllData = useCallback(async () => {
    try {
      const [prodRes, bankRes, myRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/bank-rates`),
        axios.get(`${API_BASE}/my-subscriptions?userId=${TEST_USER_ID}`),
      ]);

      const products = Array.isArray(prodRes.data) ? prodRes.data : [];
      const banks = Array.isArray(bankRes.data) ? bankRes.data : [];

      setSpecialProducts(products);
      setBankProducts(banks);
      setUserInfo(myRes.data.user);
      setMySubscriptions(myRes.data.subscriptions || []);

      // 최초 1회 DB 계좌 잔액을 현재 보유 금액에 자동 동기화
      if (myRes.data.user && !isHoldingSynced) {
        setCurrentHolding(Number(myRes.data.user.balance));
        setIsHoldingSynced(true);
      }

      setSelectedAmounts((prev) => {
        const next = { ...prev };
        products.forEach((p) => {
          if (!next[p.product_id]) {
            next[p.product_id] = Number(p.max_deposit_amount) || 1000000;
          }
        });
        return next;
      });
    } catch (err) {
      console.error('데이터 조회 실패:', err);
    }
  }, [isHoldingSynced]);

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const poller = setInterval(fetchAllData, 5000);
    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [fetchAllData]);

  const handleSyncDbBalance = () => {
    if (userInfo) {
      setCurrentHolding(Number(userInfo.balance));
      setToast({
        type: 'success',
        text: `내 계좌 잔액(${Number(userInfo.balance).toLocaleString()}원)을 불러왔습니다.`,
      });
    }
  };

  // 필터링된 시중 은행 상품 목록
  const filteredBankProducts = useMemo(() => {
    return bankProducts.filter((b) => {
      if (filterType !== 'ALL' && b.product_type !== filterType) return false;
      if (filterSector !== 'ALL' && b.sector_type !== filterSector) return false;
      if (filterTerm !== 'ALL' && String(b.save_term_months) !== filterTerm) return false;
      return true;
    });
  }, [bankProducts, filterType, filterSector, filterTerm]);

  // 핵심 계산 로직: 현재 보유 금액 + 목표 금액 + 세금 + 남은 기간 기반 추천 가입 계좌 리스트 생성
  const recommendedAccountsPlan = useMemo(() => {
    const safeHolding = Math.max(0, Number(currentHolding) || 0);
    const safeGoal = Math.max(0, Number(targetGoal) || 0);
    const safeMonths = Math.max(1, Number(remainingMonths) || 1);
    const remainingDays = safeMonths * 30;
    const shortage = Math.max(0, safeGoal - safeHolding); // 추가로 모아야 할 부족 원금

    const accounts = [];
    let unallocatedHolding = safeHolding;

    // 1순위: 남은 기간 내에 만기가 끝나는 초단기 특판 계좌 배정
    const eligibleSpecials = specialProducts.filter(
      (p) => Number(p.duration_days) <= remainingDays && p.remaining_count > 0
    );

    eligibleSpecials.forEach((sp, idx) => {
      if (unallocatedHolding <= 0) return;
      const limit = Number(sp.max_deposit_amount) || 1000000;
      const alloc = Math.min(unallocatedHolding, limit);
      unallocatedHolding -= alloc;

      const rate = Number(sp.interest_rate) / 100;
      const days = Number(sp.duration_days);
      const gross = Math.floor(alloc * rate * (days / 365));
      const tax = Math.floor(gross * taxRate);
      const net = gross - tax;

      accounts.push({
        priority: accounts.length + 1,
        badge: '1순위 · 초단기 특판',
        badgeColor: 'bg-rose-100 text-rose-700',
        category: '특판 적금',
        bankName: 'GOLDSAFE 오픈런',
        productName: sp.title,
        termLabel: `${days}일 만기`,
        rate: Number(sp.interest_rate),
        principal: alloc,
        monthlyPayment: null,
        grossInterest: gross,
        taxAmount: tax,
        netInterest: net,
        isSpecial: true,
        productId: sp.product_id,
      });
    });

    // 남은 기간 이하로 가입 가능한 최고우대금리 정기예금 찾기
    const bestDeposit =
      bankProducts
        .filter((b) => b.product_type === '정기예금' && Number(b.save_term_months) <= safeMonths)
        .sort((a, b) => Number(b.max_rate) - Number(a.max_rate))[0] ||
      bankProducts
        .filter((b) => b.product_type === '정기예금')
        .sort((a, b) => Number(a.save_term_months) - Number(b.save_term_months))[0];

    // 2순위: 특판에 넣고 남은 현재 보유 목돈 -> 시중 최고금리 정기예금 거치
    if (unallocatedHolding > 0 && bestDeposit) {
      const depTerm = Math.min(safeMonths, Number(bestDeposit.save_term_months));
      const rate = Number(bestDeposit.max_rate) / 100;
      const gross = Math.floor(unallocatedHolding * rate * (depTerm / 12));
      const tax = Math.floor(gross * taxRate);
      const net = gross - tax;

      accounts.push({
        priority: accounts.length + 1,
        badge: '보유 목돈 굴리기',
        badgeColor: 'bg-indigo-100 text-indigo-700',
        category: `${bestDeposit.sector_type || '1금융권'} 정기예금`,
        bankName: bestDeposit.bank_name,
        productName: bestDeposit.product_name,
        termLabel: `${depTerm}개월 거치`,
        rate: Number(bestDeposit.max_rate),
        principal: unallocatedHolding,
        monthlyPayment: null,
        grossInterest: gross,
        taxAmount: tax,
        netInterest: net,
        isSpecial: false,
      });
    }

    // 3순위: 목표 금액까지 부족한 자금(shortage) -> 남은 기간 내 최고금리 정기적금으로 월 적립
    const bestSaving =
      bankProducts
        .filter((b) => b.product_type === '정기적금' && Number(b.save_term_months) <= safeMonths)
        .sort((a, b) => Number(b.max_rate) - Number(a.max_rate))[0] ||
      bankProducts
        .filter((b) => b.product_type === '정기적금')
        .sort((a, b) => Number(b.max_rate) - Number(a.max_rate))[0];

    if (shortage > 0 && bestSaving) {
      const savTerm = Math.min(safeMonths, Number(bestSaving.save_term_months));
      const monthly = Math.ceil(shortage / savTerm);
      const rate = Number(bestSaving.max_rate) / 100;
      // 정기적금 단리 이자 공식: 월납입액 * 연이율 * (n*(n+1)/24)
      const gross = Math.floor(monthly * rate * ((savTerm * (savTerm + 1)) / 24));
      const tax = Math.floor(gross * taxRate);
      const net = gross - tax;

      accounts.push({
        priority: accounts.length + 1,
        badge: '부족 자금 적립',
        badgeColor: 'bg-emerald-100 text-emerald-700',
        category: `${bestSaving.sector_type || '1금융권'} 정기적금`,
        bankName: bestSaving.bank_name,
        productName: bestSaving.product_name,
        termLabel: `${savTerm}개월 적립`,
        rate: Number(bestSaving.max_rate),
        principal: shortage,
        monthlyPayment: monthly,
        grossInterest: gross,
        taxAmount: tax,
        netInterest: net,
        isSpecial: false,
      });
    }

    const totalPrincipal = accounts.reduce((sum, a) => sum + a.principal, 0);
    const totalGross = accounts.reduce((sum, a) => sum + a.grossInterest, 0);
    const totalTax = accounts.reduce((sum, a) => sum + a.taxAmount, 0);
    const totalNet = accounts.reduce((sum, a) => sum + a.netInterest, 0);
    const finalAmount = totalPrincipal + totalNet;

    return {
      safeHolding,
      safeGoal,
      shortage,
      safeMonths,
      accounts,
      totalPrincipal,
      totalGross,
      totalTax,
      totalNet,
      finalAmount,
    };
  }, [currentHolding, targetGoal, taxRate, remainingMonths, specialProducts, bankProducts]);

  const handleSubscribe = async (productId, customAmount) => {
    const product = specialProducts.find((p) => p.product_id === productId);
    if (!product) return;

    const depositAmount =
      customAmount || selectedAmounts[product.product_id] || Number(product.max_deposit_amount);
    setLoadingId(product.product_id);
    setToast(null);

    try {
      const res = await axios.post(`${API_BASE}/subscribe`, {
        userId: TEST_USER_ID,
        productId: product.product_id,
        depositAmount,
      });

      const interest = res.data.subscription?.expected_interest || 0;
      setToast({
        type: 'success',
        text: `${res.data.message} (만기 예상 세전 이자: +${Number(interest).toLocaleString()}원)`,
      });
      await fetchAllData();
    } catch (err) {
      setToast({
        type: 'error',
        text: err.response?.data?.error || err.response?.data?.message || '가입 요청에 실패했습니다.',
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await axios.post(`${API_BASE}/reset-demo`);
      setIsHoldingSynced(false);
      setToast({
        type: 'success',
        text: '데모 데이터가 초기화되었습니다. (보유 잔액 500만 원 및 선착순 한도 복구)',
      });
      await fetchAllData();
    } catch (err) {
      setToast({
        type: 'error',
        text: '초기화 요청에 실패했습니다.',
      });
    } finally {
      setResetting(false);
    }
  };

  const formatCountdown = (openAtStr) => {
    const diff = new Date(openAtStr).getTime() - now;
    if (diff <= 0) return null;

    const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const totalExpectedInterest = mySubscriptions.reduce(
    (acc, cur) => acc + Number(cur.expected_interest || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 pb-20">
      {/* 상단 네비게이션 바 */}
      <nav className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                GOLD<span className="text-indigo-600">SAFE</span>
              </span>
              <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                실시간 특판 오픈런
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>서버 시각</span>
              <span className="font-mono font-bold text-slate-900">
                {new Date(now).toLocaleTimeString('ko-KR')}
              </span>
            </div>

            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition active:scale-95"
              title="테스트용 잔액 및 선착순 수량 초기화"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>데모 초기화</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 히어로 & 내 자산 요약 카드 */}
      <div className="bg-gradient-to-b from-indigo-600 via-indigo-600 to-[#F4F6FA] pt-8 pb-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-white mb-6">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-indigo-100 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>선착순 한정 수량 · 전 금융권 금리 비교 · 목표 목돈 계좌 설계</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              한정기간 가입 고금리 상품
            </h1>
            <p className="text-indigo-100 text-sm mt-1.5">
              보유 자금과 목표 금액, 남은 기간을 입력하면 가입해야 할 최적의 예·적금 계좌 조합을 바로 추천해 드립니다.
            </p>
          </div>

          {/* 내 계좌 요약 3단 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>DB 연동 보유 잔액</span>
                <Wallet className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {userInfo ? `${Number(userInfo.balance).toLocaleString()}원` : '불러오는 중...'}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {userInfo ? `${userInfo.name} (${userInfo.email})` : '테스트 계좌 연동됨'}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>내 특판 가입 건수</span>
                <Receipt className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {mySubscriptions.length}건
              </div>
              <div className="mt-1 text-xs text-emerald-600 font-medium">
                실시간 RDS 원장 안전 보관 중
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>가입 상품 만기 예상 이자</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-indigo-600">
                +{totalExpectedInterest.toLocaleString()}원
              </div>
              <div className="mt-1 text-xs text-slate-400">세전 약정 이자 기준</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 mt-4 space-y-8">
        {/* 알림 토스트 메시지 */}
        {toast && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm border transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold text-sm">{toast.text}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-bold opacity-60 hover:opacity-100 px-2 py-1"
            >
              닫기
            </button>
          </div>
        )}

        {/* 네비게이션 탭 */}
        <div className="flex flex-wrap gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('planner')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'planner'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧮 목표 목돈 & 추천 계좌 설계
          </button>
          <button
            onClick={() => setActiveTab('special')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'special'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔥 오늘의 특판 ({specialProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('banks')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'banks'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏦 전 금융권 예·적금 비교 ({bankProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'my'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💳 내 가입 내역 ({mySubscriptions.length})
          </button>
        </div>

        {/* ==================================================================== */}
        {/* 기능 1: 보유 금액 · 목표 금액 · 세금 · 남은 기간 입력 -> 가입 추천 계좌 리스트 */}
        {/* ==================================================================== */}
        {activeTab === 'planner' && (
          <section className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    맞춤 목돈 마련 & 추천 가입 계좌 시뮬레이터
                  </h2>
                  <p className="text-xs text-slate-500">
                    현재 보유 금액(DB 자동 연동), 목표 금액, 과세 유형, 남은 기간을 입력하면 가입해야 할 계좌 조합을 나열합니다.
                  </p>
                </div>
              </div>

              {/* 4가지 핵심 입력 폼 */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                {/* 입력 1: 현재 보유 금액 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-slate-700">
                      1. 현재 보유 금액 (원)
                    </label>
                    {userInfo && (
                      <button
                        type="button"
                        onClick={handleSyncDbBalance}
                        className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                        title="DB 내 계좌 잔액 다시 불러오기"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>잔액 불러오기</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step={100000}
                    min={0}
                    value={currentHolding}
                    onChange={(e) => setCurrentHolding(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {(Number(currentHolding || 0) / 10000).toLocaleString()}만 원 보유 중
                  </div>
                </div>

                {/* 입력 2: 목표 금액 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    2. 최종 목표 금액 (원)
                  </label>
                  <input
                    type="number"
                    step={500000}
                    min={0}
                    value={targetGoal}
                    onChange={(e) => setTargetGoal(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-indigo-700 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {[5000000, 10000000, 20000000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTargetGoal(preset)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600"
                      >
                        {preset / 10000}만
                      </button>
                    ))}
                  </div>
                </div>

                {/* 입력 3: 세금 선택 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    3. 이자소득세 과세 유형
                  </label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={0.154}>일반과세 (15.4%)</option>
                    <option value={0.095}>세금우대 / 조합원 (9.5%)</option>
                    <option value={0}>비과세 종합저축 (0%)</option>
                  </select>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    세후 실수령 이자 자동 반영
                  </div>
                </div>

                {/* 입력 4: 남은 기간 (개월) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    4. 목표까지 남은 기간 (개월)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={remainingMonths}
                    onChange={(e) => setRemainingMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {[3, 6, 12, 24].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRemainingMonths(m)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          remainingMonths === m
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 hover:bg-indigo-100 text-slate-600'
                        }`}
                      >
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 자금 분석 요약 바 */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-100 flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">현재 보유 원금</span>
                  <span className="font-extrabold text-slate-900">
                    {recommendedAccountsPlan.safeHolding.toLocaleString()}원
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 flex justify-between items-center">
                  <span className="text-amber-800 font-semibold">목표까지 추가 적립 필요액</span>
                  <span className="font-extrabold text-amber-900">
                    {recommendedAccountsPlan.shortage.toLocaleString()}원
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50 flex justify-between items-center">
                  <span className="text-indigo-700 font-semibold">운용 기간 한도</span>
                  <span className="font-extrabold text-indigo-900">
                    최대 {recommendedAccountsPlan.safeMonths}개월 이내 만기 상품
                  </span>
                </div>
              </div>

              {/* 가입해야 할 계좌 리스트 나열 */}
              <div className="mt-7">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-600" />
                    가입해야 할 추천 계좌 리스트 ({recommendedAccountsPlan.accounts.length}개 계좌)
                  </h3>
                  <span className="text-xs text-slate-400">
                    금감원 실시간 공시 금리 + 특판 상품 기준
                  </span>
                </div>

                {recommendedAccountsPlan.accounts.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-400">
                    보유 금액이나 목표 금액을 입력하면 가입해야 할 계좌 목록이 생성됩니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendedAccountsPlan.accounts.map((acc) => (
                      <div
                        key={acc.priority}
                        className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 bg-white shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
                              {acc.priority}
                            </span>
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${acc.badgeColor}`}>
                              {acc.badge}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {acc.category} · {acc.termLabel}
                            </span>
                          </div>

                          <div className="text-base font-extrabold text-slate-900 pt-0.5">
                            [{acc.bankName}] {acc.productName}
                          </div>

                          <div className="text-xs text-slate-500">
                            적용 금리 <strong className="text-indigo-600">연 {acc.rate.toFixed(2)}%</strong>
                            {acc.monthlyPayment && (
                              <span>
                                {' '}· 매월 <strong className="text-slate-800">{acc.monthlyPayment.toLocaleString()}원</strong>씩 적립
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
                          <div className="md:text-right">
                            <div className="text-xs text-slate-400">배분 원금</div>
                            <div className="text-lg font-black text-slate-900">
                              {acc.principal.toLocaleString()}원
                            </div>
                            <div className="text-xs font-bold text-emerald-600">
                              세후 이자 +{acc.netInterest.toLocaleString()}원 (세금 -{acc.taxAmount.toLocaleString()}원)
                            </div>
                          </div>

                          {acc.isSpecial ? (
                            <button
                              type="button"
                              disabled={loadingId === acc.productId}
                              onClick={() => handleSubscribe(acc.productId, acc.principal)}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition shadow-sm"
                            >
                              {loadingId === acc.productId ? '가입 중...' : '이 특판 계좌 바로 가입'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveTab('banks')}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                            >
                              시중 금리표에서 상세 보기
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 최종 합산 세후 실수령액 결과 배너 */}
              <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>
                      {recommendedAccountsPlan.safeMonths}개월 후 예상 세후 만기 수령액 (총 세금{' '}
                      {recommendedAccountsPlan.totalTax.toLocaleString()}원 공제)
                    </span>
                  </div>
                  <div className="text-3xl font-black mt-1.5 tracking-tight">
                    {recommendedAccountsPlan.finalAmount.toLocaleString()}원
                  </div>
                  <div className="text-xs text-emerald-300 font-semibold mt-1">
                    총 원금 {recommendedAccountsPlan.totalPrincipal.toLocaleString()}원 + 세후 순수 이자 +
                    {recommendedAccountsPlan.totalNet.toLocaleString()}원
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('special')}
                  className="px-5 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shrink-0"
                >
                  <span>오늘의 특판 전체 보기</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* 기능 2: 선착순 타임딜 특판 상품 */}
        {/* ==================================================================== */}
        {activeTab === 'special' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                선착순 타임딜 특판 상품
              </h2>
              <span className="text-xs text-slate-400">실시간 잔여 좌석 동기화</span>
            </div>

            {specialProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
                현재 등록된 특판 상품이 없습니다.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {specialProducts.map((item) => {
                  const countdown = formatCountdown(item.open_at);
                  const isSoldOut = item.remaining_count <= 0;
                  const isOpen = countdown === null;
                  const percent = Math.max(
                    0,
                    Math.min(100, Math.round((item.remaining_count / item.total_limit) * 100))
                  );
                  const maxDeposit = Number(item.max_deposit_amount);
                  const currentDeposit = selectedAmounts[item.product_id] || maxDeposit;
                  const previewInterest = Math.floor(
                    currentDeposit *
                      (Number(item.interest_rate) / 100) *
                      (Number(item.duration_days) / 365)
                  );

                  const presetOptions = [
                    Math.floor(maxDeposit * 0.25),
                    Math.floor(maxDeposit * 0.5),
                    maxDeposit,
                  ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);

                  return (
                    <div
                      key={item.product_id}
                      className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 hover:border-indigo-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center gap-2">
                          <span
                            className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                              isSoldOut
                                ? 'bg-slate-200 text-slate-600'
                                : isOpen
                                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                            }`}
                          >
                            {isSoldOut
                              ? '● 선착순 마감'
                              : isOpen
                              ? '● 지금 바로 가입 가능'
                              : '● 오픈 카운트다운'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {item.duration_days}일 만기 · 최대 {maxDeposit.toLocaleString()}원
                          </span>
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-900 mt-4 leading-snug">
                          {item.title}
                        </h3>

                        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50/70 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-indigo-600">적용 금리</div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-sm font-bold text-indigo-600">연</span>
                              <span className="text-3xl font-black text-indigo-700 tracking-tight">
                                {Number(item.interest_rate).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">만기 예상 세전 이자</div>
                            <div className="text-base font-extrabold text-emerald-600 mt-0.5">
                              +{previewInterest.toLocaleString()}원
                            </div>
                          </div>
                        </div>

                        {!isSoldOut && (
                          <div className="mt-5">
                            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                              <span>가입 예치금 선택</span>
                              <span className="text-slate-900 font-bold">
                                {currentDeposit.toLocaleString()}원
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {presetOptions.map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAmounts((prev) => ({
                                      ...prev,
                                      [item.product_id]: amt,
                                    }))
                                  }
                                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                                    currentDeposit === amt
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {(amt / 10000).toLocaleString()}만 원
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-5">
                          <div className="flex justify-between text-xs font-bold mb-1.5">
                            <span className="text-slate-500">남은 선착순 좌석</span>
                            <span className={percent <= 20 ? 'text-rose-600' : 'text-indigo-600'}>
                              {item.remaining_count}좌 남음 / 총 {item.total_limit}좌 ({percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isSoldOut
                                  ? 'bg-slate-400'
                                  : percent <= 20
                                  ? 'bg-rose-500'
                                  : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        disabled={!isOpen || isSoldOut || loadingId === item.product_id}
                        onClick={() => handleSubscribe(item.product_id)}
                        className={`mt-6 w-full py-4 rounded-2xl font-extrabold text-sm transition flex items-center justify-center gap-2 ${
                          isSoldOut
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : !isOpen
                            ? 'bg-amber-500 text-white cursor-not-allowed shadow-sm'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.99]'
                        }`}
                      >
                        {loadingId === item.product_id
                          ? '안전하게 가입 처리 중...'
                          : isSoldOut
                          ? '선착순 마감되었습니다'
                          : !isOpen
                          ? `오픈까지 ${countdown} 남음`
                          : `${(currentDeposit / 10000).toLocaleString()}만 원 즉시 가입하기`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==================================================================== */}
        {/* 기능 3: 전 금융권(1금융·저축은행) 예·적금 금리 비교 및 다중 필터링 */}
        {/* ==================================================================== */}
        {activeTab === 'banks' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <div>
                <h2 className="text-lg font-extrabold flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  전 금융권 예·적금 금리 통합 비교
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  금융감독원 오픈API 실시간 연동 · 제1금융권 및 저축은행 정기예금·정기적금
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 w-fit">
                검색 결과 {filteredBankProducts.length}건
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>조건 필터:</span>
              </div>

              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {[
                  { label: '전체 상품', value: 'ALL' },
                  { label: '정기예금', value: '정기예금' },
                  { label: '정기적금', value: '정기적금' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterType(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterType === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {[
                  { label: '전 금융권', value: 'ALL' },
                  { label: '1금융권', value: '1금융권' },
                  { label: '저축은행', value: '저축은행' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterSector(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterSector === opt.value
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {[
                  { label: '전체 기간', value: 'ALL' },
                  { label: '6개월', value: '6' },
                  { label: '12개월', value: '12' },
                  { label: '24개월', value: '24' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterTerm(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterTerm === opt.value
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-xs">
                    <th className="py-3.5 px-3">구분</th>
                    <th className="py-3.5 px-3">금융회사</th>
                    <th className="py-3.5 px-3">상품명</th>
                    <th className="py-3.5 px-3">가입기간</th>
                    <th className="py-3.5 px-3 text-right">기본금리</th>
                    <th className="py-3.5 px-3 text-right">최고우대금리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBankProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                        선택하신 조건에 해당하는 금융상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredBankProducts.map((bank) => (
                      <tr key={bank.bank_product_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md mr-1 ${
                              bank.sector_type === '저축은행'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {bank.sector_type || '1금융권'}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {bank.product_type || '정기적금'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-800">{bank.bank_name}</td>
                        <td className="py-3.5 px-3 text-slate-700">{bank.product_name}</td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                            {bank.save_term_months}개월
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right text-slate-500 font-medium">
                          {Number(bank.base_rate).toFixed(2)}%
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-indigo-600">
                          {Number(bank.max_rate).toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* 내 가입 내역 */}
        {/* ==================================================================== */}
        {activeTab === 'my' && (
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              내 특판 적금 가입 내역
            </h2>

            {mySubscriptions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                아직 가입한 특판 상품이 없습니다. [오늘의 특판] 탭에서 선착순 상품에 가입해 보세요!
              </div>
            ) : (
              <div className="space-y-3">
                {mySubscriptions.map((sub) => (
                  <div
                    key={sub.subscription_id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          가입 완료
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(sub.subscribed_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 mt-1.5">{sub.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        적용 금리 연 {Number(sub.interest_rate).toFixed(2)}% · {sub.duration_days}일 만기
                      </div>
                    </div>

                    <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <div className="text-xs text-slate-500">예치 원금</div>
                      <div className="text-base font-extrabold text-slate-900">
                        {Number(sub.deposit_amount).toLocaleString()}원
                      </div>
                      <div className="text-xs font-bold text-indigo-600 mt-0.5">
                        만기 예상 이자 +{Number(sub.expected_interest).toLocaleString()}원
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
