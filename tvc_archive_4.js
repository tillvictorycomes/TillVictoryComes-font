(function () {
  "use strict";

  // ===== 0) 컨테이너 찾기 =====
  const CANVAS = document.querySelector(".tutto-canvas-wrap") || document.body;

  // 중복 실행 가드
  if (CANVAS.dataset.archiveBoot === "1") return;
  CANVAS.dataset.archiveBoot = "1";

  // ===== 유틸: transform 파싱/설정 =====
  function parseTransform(el) {
    const t = el.style.transform || "";
    const mT = t.match(/translate\(([^)]+)\)/);
    const mR = t.match(/rotate\(([^)]+)\)/);
    const [tx, ty] = (mT ? mT[1] : "0px, 0px")
      .split(",")
      .map((v) => parseFloat(v));
    const rot = mR ? parseFloat(mR[1]) : 0;
    return { x: tx || 0, y: ty || 0, rot: rot || 0 };
  }
  function setTransform(el, x, y, rot) {
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  }

  // ===== 1) 티스토리 라이트박스/클릭 제거 =====
  function disableTistoryLightbox(root) {
    root.querySelectorAll("a").forEach((a) => {
      const onclk = a.getAttribute("onclick") || "";
      const isLB =
        a.hasAttribute("data-lightbox") ||
        onclk.includes("tistoryLightbox") ||
        a.getAttribute("rel") === "lightbox";
      if (!isLB) return;

      a.removeAttribute("data-lightbox");
      a.removeAttribute("rel");
      a.removeAttribute("onclick");

      const img = a.querySelector("img");
      if (img) a.replaceWith(img);
      else a.style.pointerEvents = "none";
    });
  }

  // ===== 2) [##_Image|…_##] → figure.draggable-image > img =====
  function convertTistoryPlaceholders(root) {
    const html = root.innerHTML;
    const re =
      /\[##_Image\|([^|]+)\|([^|]+)\|([^#]+)_##_]/g; /* url | meta | meta */
    const replaced = html.replace(re, (m, url) => {
      return `<figure class="draggable-image"><img src="${url}" alt="" loading="lazy"></figure>`;
    });
    if (replaced !== html) root.innerHTML = replaced;
  }

  // ===== 3) 일반 img도 figure로 통일 =====
  function wrapImagesToFigure(root) {
    root.querySelectorAll("img").forEach((img) => {
      if (img.closest(".draggable-image")) return;
      const fig = document.createElement("figure");
      fig.className = "draggable-image";
      img.replaceWith(fig);
      fig.appendChild(img);
    });
  }

  // ===== 4) 초기 배치 =====
  function randomizeOne(fig, bounds) {
    const img = fig.querySelector("img");
    const pad = 60;
    // 이미지 자연 크기 기반으로 대략적인 카드 크기 추정 (가로세로 고정 CSS가 있으므로 적당히)
    const w =
      ((img && (img.naturalWidth || img.width)) || 600) * 0.5; // 추정
    const h =
      ((img && (img.naturalHeight || img.height)) || 400) * 0.5; // 추정
    const x = Math.max(
      pad,
      Math.random() * Math.max(1, bounds.width - w - pad * 2)
    );
    const y = Math.max(
      pad,
      Math.random() * Math.max(1, bounds.height - h - pad * 2)
    );
    const r = Math.random() * 30 - 15; // -15~15deg
    setTransform(fig, x, y, r);
  }

  function randomizeLayout(root) {
    const bounds = root.getBoundingClientRect();
    let zTop = 10;
    root.querySelectorAll(".draggable-image").forEach((fig) => {
      fig.style.position = "absolute";
      fig.style.willChange = "transform";
      fig.style.zIndex = (++zTop).toString();

      // 이미지가 아직 로드 안됐으면 로드 후 배치
      const img = fig.querySelector("img");
      if (img && !img.complete) {
        img.addEventListener(
          "load",
          () => {
            randomizeOne(fig, bounds);
          },
          { once: true }
        );
      } else {
        randomizeOne(fig, bounds);
      }
    });
  }

  // ===== 5) 드래그(+살짝 회전) =====
  function enableDrag(root) {
    let active = null,
      start = { x: 0, y: 0 },
      base = { x: 0, y: 0, rot: 0 },
      zTop = 1000;

    function onPointerDown(e) {
      const t = e.target.closest(".draggable-image");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();

      active = t;
      active.setPointerCapture?.(e.pointerId);
      active.style.zIndex = (++zTop).toString();

      const cur = parseTransform(active);
      start = { x: e.clientX, y: e.clientY };
      base = { x: cur.x, y: cur.y, rot: cur.rot };
    }

    function onPointerMove(e) {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const rot = base.rot + dx * 0.05; // 수평 이동에 비례한 미세 회전
      setTransform(active, base.x + dx, base.y + dy, rot);
    }

    function onPointerUp(e) {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();

      active.releasePointerCapture?.(e.pointerId);
      active = null;
    }

    root.addEventListener("pointerdown", onPointerDown, { passive: false });
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp, { passive: false });
    root.addEventListener("pointercancel", onPointerUp, { passive: false });
  }

  // ===== 실행 순서 =====
  function boot() {
    disableTistoryLightbox(CANVAS);    // 확대 제거
    convertTistoryPlaceholders(CANVAS); // 치환자 → figure+img
    wrapImagesToFigure(CANVAS);         // 남은 img도 통일
    randomizeLayout(CANVAS);            // 초기 배치
    enableDrag(CANVAS);                 // 드래그 활성화
    console.log("[archive] ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // 창 크기 바뀔 때 과도한 재배치는 피하고 싶으면 주석 유지
  // window.addEventListener("resize", () => randomizeLayout(CANVAS));
})();
