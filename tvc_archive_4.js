<script>
(function() {
  // 0) 아카이브 캔버스 컨테이너(없으면 body 사용)
  const CANVAS = document.querySelector('.tutto-canvas-wrap') || document.body;

  // 1) 티스토리 라이트박스/클릭 제거 (이미 렌더된 HTML 기준)
  function disableTistoryLightbox(root) {
    root.querySelectorAll('a').forEach(a => {
      const hasLB = a.hasAttribute('data-lightbox')
                 || (a.getAttribute('onclick') || '').includes('tistoryLightbox')
                 || a.getAttribute('rel') === 'lightbox';
      if (hasLB) {
        a.removeAttribute('data-lightbox');
        a.removeAttribute('rel');
        a.removeAttribute('onclick');
        // a 태그를 풀고 <img>만 남기기 (가능하면 unwrap)
        const img = a.querySelector('img');
        if (img) a.replaceWith(img);
        else a.style.pointerEvents = 'none';
      }
    });
  }

  // 2) [##_Image|…_##] 치환자 처리 → <figure class="draggable-image"><img ...></figure>
  //    - 포스트 본문에 원문 치환자가 그대로 남아있는 경우를 대비
  function convertTistoryPlaceholders(root) {
    // 텍스트 노드 안의 [##_Image| ... _##]를 찾기 위해 전체 HTML 문자열 치환
    const html = root.innerHTML;
    const re = /\[##_Image\|([^|]+)\|([^|]+)\|([^#]+)_##_]/g; 
    //  그룹:
    //   1) 이미지 URL(또는 kage@…)
    //   2) 타입/스케일 등(사용 안함)
    //   3) JSON 메타(원본 크기/파일명 등)
    const replaced = html.replace(re, (m, url) => {
      // url이 프로토콜 없이 kage@… 로 시작할 수 있어 그대로 넣어도 브라우저가 처리함
      return `<figure class="draggable-image"><img src="${url}" alt="" loading="lazy"></figure>`;
    });
    if (replaced !== html) root.innerHTML = replaced;
  }

  // 3) 일반 <img>도 figure로 감싸주기(이미 a unwrap 된 케이스 포함)
  function wrapImagesToFigure(root) {
    root.querySelectorAll('img').forEach(img => {
      if (img.closest('.draggable-image')) return; // 이미 처리됨
      // 광고/이모티콘 등 제외하고 싶은 경우 여기서 필터링
      const fig = document.createElement('figure');
      fig.className = 'draggable-image';
      img.replaceWith(fig);
      fig.appendChild(img);
    });
  }

  // 4) 초기 랜덤 배치(겹침 완화용), z-index 스택 관리
  function randomizeLayout(root) {
    const bounds = root.getBoundingClientRect();
    let zTop = 10;
    root.querySelectorAll('.draggable-image').forEach(fig => {
      const w = (fig.querySelector('img')?.naturalWidth || 600) * 0.5;
      const h = (fig.querySelector('img')?.naturalHeight || 400) * 0.5;
      // 안전 여백
      const pad = 60;
      const x = Math.max(pad, Math.random() * Math.max(1, bounds.width - w - pad*2));
      const y = Math.max(pad, Math.random() * Math.max(1, bounds.height - h - pad*2));
      const r = (Math.random() * 30) - 15; // -15~15도
      fig.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
      fig.style.zIndex = (++zTop).toString();
    });
  }

  // 5) 간단 드래그(+ 회전 느낌) 핸들러
  function enableDrag(root) {
    let active = null, start = {x:0,y:0}, base = {x:0,y:0,rot:0}, zTop = 1000;

    function parseTransform(el){
      const m = (el.style.transform || '').match(/translate\(([^)]+)\)\s*rotate\(([^)]+)\)/);
      if (!m) return {x:0,y:0,rot:0};
      const [tx, ty] = m[1].split(',').map(s => parseFloat(s));
      const rot = parseFloat(m[2]);
      return {x: tx || 0, y: ty || 0, rot: rot || 0};
    }

    function onPointerDown(e){
      const t = e.target.closest('.draggable-image');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      active = t;
      active.setPointerCapture?.(e.pointerId);
      active.style.zIndex = (++zTop).toString();
      const cur = parseTransform(active);
      start = { x: e.clientX, y: e.clientY };
      base = { x: cur.x, y: cur.y, rot: cur.rot };
    }

    function onPointerMove(e){
      if (!active) return;
      e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      // 이동 + 살짝 회전(수평 이동량의 0.05배)
      const rot = base.rot + dx * 0.05;
      active.style.transform = `translate(${base.x + dx}px, ${base.y + dy}px) rotate(${rot}deg)`;
    }

    function onPointerUp(e){
      if (!active) return;
      e.preventDefault(); e.stopPropagation();
      active.releasePointerCapture?.(e.pointerId);
      active = null;
    }

    root.addEventListener('pointerdown', onPointerDown, {passive:false});
    root.addEventListener('pointermove', onPointerMove, {passive:false});
    root.addEventListener('pointerup', onPointerUp, {passive:false});
    root.addEventListener('pointercancel', onPointerUp, {passive:false});
  }

  // 실행 순서
  function boot() {
    // 1) 라이트박스 끄기 (기본 확대 제거)
    disableTistoryLightbox(CANVAS);
    // 2) 치환자 텍스트를 figure+img로 변환
    convertTistoryPlaceholders(CANVAS);
    // 3) 남은 img들도 figure로 통일
    wrapImagesToFigure(CANVAS);
    // 4) 랜덤 배치
    randomizeLayout(CANVAS);
    // 5) 드래그 활성화
    enableDrag(CANVAS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
