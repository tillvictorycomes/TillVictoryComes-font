(function(){
  "use strict";

  const ROOT = document.querySelector('.tutto-canvas-wrap') || document.body;
  if (!ROOT || ROOT.dataset.dragBoot === '1') return;
  ROOT.dataset.dragBoot = '1';

  /* 0) Tistory 라이트박스 언랩(확대 충돌 제거) */
  (function killLightbox(root){
    root.querySelectorAll('a').forEach(a=>{
      const onclk = a.getAttribute('onclick')||'';
      const isLB = a.hasAttribute('data-lightbox') || a.getAttribute('rel')==='lightbox' || onclk.includes('tistoryLightbox');
      if(!isLB) return;
      a.removeAttribute('data-lightbox'); a.removeAttribute('rel'); a.removeAttribute('onclick');
      const img = a.querySelector('img');
      if (img) a.replaceWith(img); else a.style.pointerEvents='none';
    });
  })(ROOT);

  /* 1) [##_Image|..._##] → <figure class="draggable-image"><img></figure> (최소 정규식) */
  (function convertPlaceholders(root){
    const html = root.innerHTML;
    const re = /\[##_Image\|([^|]+)\|[^|]*\|[^#]+_##]/g; // URL만 뽑아씀
    const replaced = html.replace(re, (_m, url)=>{
      return `<figure class="draggable-image"><img src="${url}" alt="" loading="lazy"></figure>`;
    });
    if (replaced !== html) root.innerHTML = replaced;
  })(ROOT);

  /* 2) 일반 <img>도 figure로 통일 (이미 figure면 스킵) */
  (function wrapImages(root){
    root.querySelectorAll('img').forEach(img=>{
      if (img.closest('.draggable-image')) return;
      const fig = document.createElement('figure');
      fig.className = 'draggable-image';
      img.replaceWith(fig); fig.appendChild(img);
    });
  })(ROOT);

  /* 3) 랜덤으로 흩뿌리기 (겹침 완화, 아주 단순) */
  (function randomize(root){
    const box = root.getBoundingClientRect();
    const pad = 40; let z=10;
    root.querySelectorAll('.draggable-image').forEach(fig=>{
      fig.style.position = 'absolute';
      fig.style.zIndex = (++z).toString();
      const x = Math.max(pad, Math.random() * Math.max(1, box.width  - 320)); // PC 카드폭 300 가정
      const y = Math.max(pad, Math.random() * Math.max(1, box.height - 260));
      fig.style.transform = `translate(${x}px, ${y}px)`;
    });
  })(ROOT);

  /* 4) W3Schools식 dragElement를 Pointer Events 버전으로 */
  function dragElement(el){
    let sx=0, sy=0, ox=0, oy=0, zTop=1000;

    // 현재 translate 값 읽기
    function getPos(){
      const m = (el.style.transform||'').match(/translate\(([^)]+)\)/);
      if (!m) return {x:0,y:0};
      const [tx,ty] = m[1].split(',').map(v=>parseFloat(v));
      return {x:tx||0, y:ty||0};
    }
    function setPos(x,y){
      const rot = (el.style.transform||'').match(/rotate\([^)]+\)/)?.[0] || '';
      el.style.transform = `translate(${x}px, ${y}px) ${rot}`.trim();
    }

    function pointerDown(e){
      const t = e.target.closest('.draggable-image');
      if (!t || t!==el) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.style.zIndex = (++zTop).toString();

      const p = getPos();
      ox = p.x; oy = p.y;
      sx = e.clientX; sy = e.clientY;

      ROOT.addEventListener('pointermove', pointerMove, {passive:false});
      ROOT.addEventListener('pointerup', pointerUp, {passive:false});
      ROOT.addEventListener('pointercancel', pointerUp, {passive:false});
    }
    function pointerMove(e){
      e.preventDefault();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      setPos(ox + dx, oy + dy);
    }
    function pointerUp(e){
      e.preventDefault();
      el.releasePointerCapture?.(e.pointerId);
      ROOT.removeEventListener('pointermove', pointerMove);
      ROOT.removeEventListener('pointerup', pointerUp);
      ROOT.removeEventListener('pointercancel', pointerUp);
    }

    el.addEventListener('pointerdown', pointerDown, {passive:false});
  }

  /* 5) 모든 카드에 드래그 붙이기 */
  ROOT.querySelectorAll('.draggable-image').forEach(el=>dragElement(el));

  console.log('[TVC simple drag] ready:', ROOT.querySelectorAll('.draggable-image').length);
})();  
