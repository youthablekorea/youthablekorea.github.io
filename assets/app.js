// YAK 변경안 v2 공통 스크립트 — 서버·회원정보 없이 화면에서만 동작
(function () {
  var doc = document.documentElement, body = document.body;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // 알림
  var toastEl = $('.toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // 모바일 전체 메뉴
  var btn = $('.menu-btn'), dr = $('#drawer');
  function setMenu(open) {
    if (!dr) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? '전체 메뉴 닫기' : '전체 메뉴 열기');
    body.classList.toggle('menu-open', open);
    if (open) { if (head) dr.style.setProperty('--top', Math.max(0, head.getBoundingClientRect().bottom) + 'px'); dr.hidden = false; requestAnimationFrame(function () { dr.classList.add('show'); }); }
    else { dr.classList.remove('show'); setTimeout(function () { if (!dr.classList.contains('show')) dr.hidden = true; }, 320); }
  }
  if (btn && dr) {
    btn.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    dr.addEventListener('click', function (e) { if (e.target === dr) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  // 스크롤: 헤더 압축, 진행 막대, 맨 위로, 하단 바 숨김
  var head = $('.site-h'), bar = $('.progress'), top = $('.totop'), act = $('.actbar'), lastY = 0, ticking = false;
  function onScroll() {
    var y = window.scrollY || doc.scrollTop, max = doc.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, y / max) : 0;
    if (head) head.classList.toggle('scrolled', y > 24);
    if (bar) bar.style.setProperty('--p', p);
    if (top) { top.classList.toggle('show', y > 600); top.style.setProperty('--p', p); }
    if (act) act.classList.toggle('hide', y > lastY + 4 && y > 300 && y < max - 80);
    if (Math.abs(y - lastY) > 4) lastY = y;
    ticking = false;
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (top) top.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  // 숫자 카운트
  function countUp(el) {
    var to = +el.getAttribute('data-count'); if (reduce || !to) return;
    var t0 = null, dur = 1400;
    function step(t) {
      if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step);
    }
    el.textContent = '0'; requestAnimationFrame(step);
  }

  // 스크롤 등장
  var rv = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(function (el) { el.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in'); io.unobserve(en.target);
        $$('[data-count]', en.target).forEach(countUp);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    rv.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rv.forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); }); }, 1500);
  }

  // 모집 D-day · 마감 후 신청 버튼 비활성
  var today = new Date(); today.setHours(0, 0, 0, 0);
  function daysLeft(iso) { var d = new Date(iso + 'T00:00:00'); return Math.round((d - today) / 864e5); }
  $$('[data-deadline]').forEach(function (b) {
    var iso = b.getAttribute('data-deadline'); if (!iso) return;
    var n = daysLeft(iso);
    b.textContent = n > 0 ? 'D-' + n : n === 0 ? 'D-day' : '모집 마감';
    b.classList.toggle('urgent', n >= 0 && n <= 7); b.classList.toggle('closed', n < 0);
  });
  $$('[data-deadline-text]').forEach(function (s) {
    var n = daysLeft(s.getAttribute('data-deadline-text'));
    s.textContent = n > 0 ? n + '일 남음' : n === 0 ? '오늘 마감' : '마감되었습니다';
  });
  $$('[data-apply]').forEach(function (a) {
    if (daysLeft(a.getAttribute('data-apply')) < 0) { a.textContent = '신청 마감'; a.classList.add('closed'); }
    a.addEventListener('click', function (e) { if (a.getAttribute('href') === '#') { e.preventDefault(); toast('예시 화면입니다 — 실제 구글폼 주소를 연결합니다'); } });
  });

  // 복사(계좌·전화·이메일) / 링크 복사
  function copy(text, msg) {
    var ok = function () { toast(msg || '복사했습니다'); };
    var fail = function () { toast('복사가 안 되면 길게 눌러 선택해 주세요: ' + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail); else fail();
  }
  $$('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copy(b.getAttribute('data-copy'), b.getAttribute('data-msg')); }); });
  $$('[data-share]').forEach(function (b) { b.addEventListener('click', function () { copy(location.href, '이 글의 주소를 복사했습니다'); }); });

  // 게시판: 분류 필터 + 제목 검색 (함께 적용)
  var boards = {};
  function board(sel) {
    if (boards[sel]) return boards[sel];
    var t = $(sel); if (!t) return null;
    return (boards[sel] = { el: t, key: 'all', q: '', items: $$('[data-k]', t), count: null, empty: t.parentNode.querySelector('.empty') });
  }
  function apply(b) {
    var n = 0, q = b.q.trim().toLowerCase();
    b.items.forEach(function (it) {
      var show = (b.key === 'all' || it.getAttribute('data-k') === b.key) && (!q || it.textContent.toLowerCase().indexOf(q) > -1);
      it.hidden = !show; if (show) n++;
    });
    if (b.count) b.count.textContent = '전체 ' + n + '건';
    if (b.empty) b.empty.hidden = n > 0;
  }
  $$('.filters').forEach(function (f) {
    var b = board(f.getAttribute('data-target')); if (!b) return;
    b.count = $(f.getAttribute('data-count'));
    $$('button', f).forEach(function (x) {
      x.addEventListener('click', function () {
        $$('button', f).forEach(function (y) { y.setAttribute('aria-pressed', 'false'); });
        x.setAttribute('aria-pressed', 'true'); b.key = x.getAttribute('data-f'); apply(b);
      });
    });
    apply(b);
  });
  $$('.bsearch input').forEach(function (i) {
    var b = board(i.getAttribute('data-target')); if (!b) return;
    b.count = b.count || $(i.getAttribute('data-count'));
    i.addEventListener('input', function () { b.q = i.value; apply(b); });
    apply(b);
  });
})();
