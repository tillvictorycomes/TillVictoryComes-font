(function(){
  // ====== 노브(조절값) ======
  const HEIGHT_FACTOR   = 2.8;
  const MIN_BASE_HEIGHT = 3000;
  const EXTRA_PER_ITEM  = 140;

  // 좌우/상하 여백(개별)
  const PAD_L = 120, PAD_R = 60, PAD_T = 40, PAD_B = 160;
  const RIGHT_BONUS = 80; // 오른쪽으로 조금 더 퍼지게

  const INIT_ROTATE_RANGE = 35;      // 초기 랜덤 회전(±도)
  const DRAG_TURNS = 360;            // 화면 왼쪽 끝 → 오른쪽 끝 이동 시 회전량(도)
  const GAP = 48;                     // 최소 간격(px) — 겹침 완화 핵심
  const MAX_RETRY = 80;               // 충돌 회피 시도 횟수(아이템 1개당)
  const ALLOW_OVERLAP_RATIO = 0.12;   // 일부 겹침 허용(0.12=12%)

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randDeg = () => (Math.random() * (INIT_ROTATE_RANGE*2) - INIT_ROTATE_RANGE);

  // AABB 충돌 검사 (약간의 간격 포함해서 검사)
  function isOverlap(a, b, gap=0){
    return !(a.x + a.w + gap < b.x ||
             b.x + b.w + gap < a.x ||
             a.y + a.h + gap < b.y ||
             b.y + b.h + gap < a.y);
  }
  // 겹친 비율(얼마나 겹쳤는지 대략) — 축회전 무시하고 박스 기준
  function overlapRatio(a,b){
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x+a.w, b.x+b.w), y2 = Math.min(a.y+a.h, b.y+b.h);
    if(x2<=x1 || y2<=y1) return 0;
    const inter = (x2-x1)*(y2-y1);
    const areaMin = Math.min(a.w*a.h, b.w*b.h);
    return inter/areaMin;
  }

  function wrapTistoryImages(){
    const wrap = document.querySelector('.tutto-canvas-wrap');
    const section = document.querySelector('.tutto-section');
    if(!wrap || !section) return [];

    const imgs = [...wrap.querySelectorAll('img')].filter(img => !img.closest('.draggable-image'));
    imgs.forEach(img => {
      const fig = document.createElement('figure');
      fig.className = 'draggable-image';
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      fig.dataset.format = (h >= w) ? 'portrait' : 'landscape';
      fig.appendChild(img);
      section.appendChild(fig);
    });
    return [...section.querySelectorAll('.draggable-image')];
  }

  function scatter(items){
    const wrap = document.querySelector('.tutto-canvas-wrap');
    if(!wrap || !items.length) return;

    // 1) 세로 공간 넉넉히
    const baseH = Math.max(window.innerHeight * HEIGHT_FACTOR, MIN_BASE_HEIGHT);
    const extraH = Math.max(0, items.length - 8) * EXTRA_PER_ITEM;
    wrap.style.minHeight = (baseH + extraH) + 'px';

    // 2) 배치 영역
    const rect = wrap.getBoundingClientRect();
    const W = rect.width, H = rect.height;

    const placed = []; // 배치된 박스들(AABB)
    items.forEach((el, i)=>{
      const img = el.querySelector('img');
      const iw = (img && img.width)  || 300;
      const ih = (img && img.height) || 200;

      const minX = -PAD_L;
      const maxX = Math.max(minX, W - iw - PAD_R + RIGHT_BONUS);
      const minY = -PAD_T;
      const maxY = Math.max(minY, H - ih - PAD_B);

      let x, y, tries=0, ok=false, box;
      while(tries++ < MAX_RETRY){
        x = rand(minX, maxX);
        y = rand(minY, maxY);
        box = {x, y, w: iw, h: ih};

        // 기존 배치들과 겹침 검사
        let conflict = false;
        for(const p of placed){
          if(isOverlap(box, p, GAP)){
            // 다만 약간의 겹침은 허용(레이어드 느낌)
            if(overlapRatio(box, p) <= ALLOW_OVERLAP_RATIO) continue;
            conflict = true; break;
          }
        }
        if(!conflict){ ok=true; break; }
      }
      // 실패해도 마지막 좌표로 배치
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      // 초기 회전 → dataset에 보관(드래그 회전의 기준)
      const initDeg = randDeg();
      el.style.transform = `rotate(${initDeg.toFixed(1)}deg)`;
      el.dataset.baseRotate = initDeg.toFixed(3);
      el.style.zIndex = (10 + i).toString();

      placed.push({x, y, w: iw, h: ih});
    });
  }

  function enableDrag(items){
    let active=null,startX=0,startY=0,offsetX=0,offsetY=0, baseRotate=0;
    let rafId=null;
    const screenW = () => Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    const parseDeg = (el)=>{
      if(el.dataset.baseRotate) return parseFloat(el.dataset.baseRotate) || 0;
      const m = /rotate\((-?\d+(\.\d+)?)deg\)/.exec(el.style.transform||'');
      return m ? parseFloat(m[1]) : 0;
    };

    const down=(e)=>{
      active = e.currentTarget;
      active.setPointerCapture?.(e.pointerId);

      // 현재 left/top과 마우스 위치 간 상대 오프셋 계산 → 마우스가 "잡은 지점" 유지
      const elLeft = parseFloat(active.style.left||0);
      const elTop  = parseFloat(active.style.top||0);
      startX = e.pageX; startY = e.pageY;
      offsetX = startX - elLeft;
      offsetY = startY - elTop;

      baseRotate = parseDeg(active);
      active.dataset.baseRotate = baseRotate;

      active.style.zIndex = (parseInt(active.style.zIndex||'10',10)+1000).toString();
      e.preventDefault();
    };

    const move=(e)=>{
      if(!active) return;
      const targetLeft = e.pageX - offsetX;
      const targetTop  = e.pageY - offsetY;

      if(!rafId){
        rafId = requestAnimationFrame(()=>{
          active.style.left = targetLeft + 'px';
          active.style.top  = targetTop  + 'px';
          rafId = null;
        });
      }

      // 회전: 가로 이동량 비율 → 한 화면 너비 이동 시 DRAG_TURNS(기본 360도)
      const deltaX = e.pageX - startX;
      const deg = baseRotate + (deltaX / screenW()) * DRAG_TURNS;
      active.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    };

    const up=()=>{ if(!active) return; active=null; };

    items.forEach(el=>{
      el.style.touchAction='none';
      el.style.cursor='grab';
      el.addEventListener('pointerdown',down);
    });
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
  }

  function imagesLoaded(selector, cb){
    const imgs = Array.from(document.querySelectorAll(selector));
    if(!imgs.length){ cb(); return; }
    let left = imgs.length;
    const done=()=>{ if(--left<=0) cb(); };
    imgs.forEach(img=>{
      if(img.complete) done();
      else { img.addEventListener('load',done,{once:true}); img.addEventListener('error',done,{once:true}); }
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    imagesLoaded('.tutto-canvas-wrap img', ()=>{
      wrapTistoryImages();
      const all = [...document.querySelectorAll('.tutto-section .draggable-image')];
      scatter(all);          // 겹침 완화 배치
      enableDrag(all);       // 드래그 이동 + 회전
    });
  });

  // 리사이즈 시 재배치
  let t=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(t);
    t=setTimeout(()=>{
      const all = [...document.querySelectorAll('.tutto-section .draggable-image')];
      all.forEach(el=>{ el.style.left=''; el.style.top=''; });
      scatter(all);
    }, 180);
  });
})();
