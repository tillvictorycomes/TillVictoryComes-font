// tvc_archive_4.js – Moveable.js 기반 개선 버전 with topZ 방식
(function(){
  const HEIGHT_FACTOR = 2.8;
  const MIN_BASE_HEIGHT = 3000;
  const EXTRA_PER_ITEM = 140;
  const INIT_ROTATE_RANGE = 35;
  let topZ = 1000; // z-index 순번 관리용 전역 변수

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randDeg = () => rand(-INIT_ROTATE_RANGE, INIT_ROTATE_RANGE);

  function wrapTistoryImages(){
    const wrap = document.querySelector('.tutto-canvas-wrap');
    const section = document.querySelector('.tutto-section');
    if (!wrap || !section) return [];

    const imgs = [...wrap.querySelectorAll('img')]
      .filter(img => !img.closest('.draggable-image'));

    const figures = [];
    imgs.forEach((img, i) => {
      const fig = document.createElement('figure');
      fig.className = 'draggable-image';
      fig.style.left = `${80 + (i % 5) * 140}px`;
      fig.style.top  = `${100 + Math.floor(i / 5) * 180}px`;
      fig.style.transform = `rotate(${randDeg().toFixed(1)}deg)`;
      fig.style.zIndex = (++topZ).toString();
      fig.appendChild(img);
      section.appendChild(fig);
      figures.push(fig);
    });
    return figures;
  }

  function scatter(items){
    const wrap = document.querySelector('.tutto-canvas-wrap');
    if (!wrap || !items.length) return;
    const baseH = Math.max(window.innerHeight * HEIGHT_FACTOR, MIN_BASE_HEIGHT);
    const extraH = Math.max(0, items.length - 8) * EXTRA_PER_ITEM;
    wrap.style.minHeight = (baseH + extraH) + 'px';

    const W = wrap.getBoundingClientRect().width;
    const H = wrap.getBoundingClientRect().height;

    items.forEach((el, i) => {
      const w = el.offsetWidth || 300;
      const h = el.offsetHeight || 200;
      const x = rand(0, W - w);
      const y = rand(0, H - h);
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      el.style.transform = `rotate(${randDeg().toFixed(1)}deg)`;
      el.style.zIndex = (++topZ).toString();
    });
  }

  function waitImagesLoaded(selector, cb){
    const imgs = Array.from(document.querySelectorAll(selector));
    if (!imgs.length) { cb(); return; }
    let left = imgs.length;
    const done = () => { if (--left <= 0) cb(); };
    imgs.forEach(img => {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }

  function enableMoveableDrag(items){
    if (!window.Moveable || !items.length) return;
    const moveable = new Moveable(document.querySelector(".tutto-section"), {
      target: items,
      draggable: true,
      rotatable: true,
      rotationPosition: "top",
      throttleRotate: 0,
    });

    moveable
      .on("dragStart", ({ target }) => {
        target.style.zIndex = (++topZ).toString();
      })
      .on("drag", ({ target, left, top }) => {
        target.style.left = `${left}px`;
        target.style.top  = `${top}px`;
      })
      .on("rotate", ({ target, transform }) => {
        target.style.transform = transform;
      });
  }

  function runTVC(){
    const figures = wrapTistoryImages();
    scatter(figures);
    enableMoveableDrag(figures);
  }

  document.addEventListener('DOMContentLoaded', () => {
    waitImagesLoaded('.tutto-canvas-wrap img', runTVC);
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const items = [...document.querySelectorAll('.draggable-image')];
      scatter(items);
    }, 180);
  });
})();
