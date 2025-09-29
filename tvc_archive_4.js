(function(){
  "use strict";

  const ROOT = document.querySelector('.tutto-canvas-wrap') || document.body;
  if (!ROOT || ROOT.dataset.tvcBoot === '1') return;
  ROOT.dataset.tvcBoot = '1';

  // ---- utils ----
  const q = (sel, ctx=ROOT) => Array.from(ctx.querySelectorAll(sel));
  const log = (...a) => console.log('[TVC]', ...a);

  // 0) Tistory 라이트박스 언랩(확대 충돌 제거)
  function killLightbox(root){
    const anchors = q('a', root);
    let removed = 0, unwrapped = 0;
    anchors.forEach(a=>{
      const onclk = a.getAttribute('onclick')||'';
      const isLB = a.hasAttribute('data-lightbox')
                || a.getAttribute('rel') === 'lightbox'
                || onclk.includes('tistoryLightbox');
      if(!isLB) return;
      a.removeAttribute('data-lightbox');
      a.removeAttribute('rel');
      a.removeAttribute('onclick');
      const img = a.querySelector('img');
      if (img) { a.replaceWith(img); unwrapped++; }
      else { a.style.pointerEvents = 'none'; removed++; }
    });
    log('lightbox removed:', removed, 'unwrapped:', unwrapped);
  }

  // 1) [##_Image|..._##] 치환자 → figure.draggable-image > img
  //    - 실제 데이터 케이스를 보니 끝이 `_##]` 형태.
  //    - 혹시 다른 변형(`_##_` 등)도 잡도록 or 패턴 보강.
  function convertPlaceholders(root){
    const html = root.innerHTML;
    const re = /\[##_Image\|([^|]+)\|[^|]*\|[^#]+_#_##]?]/g; 
    // 설명:
    //  - 1캡처: 이미지 URL
    //  - 뒤쪽 `_#_##]?]` 는 `_##]`를 기본으로, 변형 한 글자도 허용
    const replaced = html.replace(re, (_m, url)=>{
      return `<figure class="draggable-image"><img src="${url}" alt="" loading="lazy"></figure>`;
    });
    if (replaced !== html) {
      root.innerHTML = replaced;
      log('placeholders converted');
    } else {
      log('no placeholders matched');
    }
  }

  // 2) 일반 <img>도 figure로 통일 (이미 figure면 스킵)
  function wrapImages(root){
    let wrapped = 0;
    q('img', root).forEach(img=>{
      if (img.closest('.draggable-image')) return;
      const fig = document.createElement('figure');
      fig.className = 'draggable-image';
      // 초기 transform 없으면 기본값 부여
      fig.style.transform = 'translate(0px, 0px)';
      img.replaceWith(fig); fig.appendChild(img);
      wrapped++;
    });
    log('images wrapped:', wrapped);
  }

  // 3) 랜덤 배치(아주 단순)
  function randomize(root){
    const box = root.getBoundingClientRect();
    const pad = 40; let z=10, count=0;
    q('.draggable-image', root).forEach(fig=>{
      fig.style.position = 'absolute';
      fig.style.willChange = 'transform';
      fig.style.zIndex = (++z).toString();
      const x = Math.max(pad, Math.random() * Math.max(1, box.width  - 320)); // PC 카드폭 300 가정
      const y = Math.max(pad, Math.random() * Math.max(1, box.height - 260));
      fig.style.transform = `translate(${x}px, ${y}px)`;
      count++;
    });
    log('randomized:', count);
  }

  // ---- 드래그 (Pointer Events) ----
  function getPos(el){
    const m = (el.style.transform||'').match(/translate\(([^)]+)\)/);
    if (!m) return {x:0, y:0};
    const [tx,ty] = m[1].split(',').map(v=>parseFloat(v));
    return {x:tx||0, y:ty||0};
  }
  function setPos(el, x, y){
    const rot = (el.style.transform||'').match(/rotate\([^)]+\)/)?.[0] || '';
    el.style.transform = `translate(${x}px, ${y}px) ${rot}`.trim();
  }
  function attachDrag(el){
    let sx=0, sy=0, ox=0, oy=0;
    let zTop = 1000;

    function down(e){
      // figure 자신만 드래그 시작
      const t = e.target.closest('.draggable-image');
      if (!t || t!==el) return;
      e.preventDefault(); e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      el.style.zIndex = (++zTop).toString();

      const p = getPos(el);
      ox = p.x; oy = p.y;
      sx = e.clientX; sy = e.clientY;

      ROOT.addEventListener('pointermove', move, {passive:false});
      ROOT.addEventListener('pointerup', up, {passive:false});
      ROOT.addEventListener('pointercancel', up, {passive:false});
    }
    function move(e){
      e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      setPos(el, ox + dx, oy + dy);
    }
    function up(e){
      e.preventDefault(); e.stopPropagation();
      el.releasePointerCapture?.(e.pointerId);
      ROOT.removeEventListener('pointermove', move);
      ROOT.removeEventListener('pointerup', up);
      ROOT.removeEventListener('pointercancel', up);
    }

    el.addEventListener('pointerdown', down, {passive:false});
  }
  function enableDrag(root){
    const els = q('.draggable-image', root);
    els.forEach(attachDrag);
    log('draggable bound:', els.length);
  }

  function boot(){
    // 순서가 중요
    killLightbox(ROOT);
    convertPlaceholders(ROOT);
    wrapImages(ROOT);

    // 디버그 숫자 출력
    log('imgs:', q('img').length, 'figs:', q('.draggable-image').length);

    randomize(ROOT);
    enableDrag(ROOT);
    log('ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
