(function(){
  /* =========================
       0) 구글폼 설정
       - 가장 간단: direct 에 forms.gle 주소만 넣으면 됨 (사전입력 X)
       - 사전입력 쓰려면: id와 fields를 채우면 buildFormUrl이 자동으로 prefill 링크를 생성
       ========================= */
  const FORM = {
    direct: 'https://forms.gle/y8nht1LVbKiVngD98',   // ← 지금은 이걸로 새 탭 열기(가장 간단)
    id: '',                                          // e.g. 1FAIpQLSdXXXXXXXX (사전입력 쓸 때만)
    fields: {                                        // 사전입력용 entry.* 값들 (선택)
      msg:      '',  // entry.xxxxxxxxxx : 응원 문장
      filename: '',  // entry.xxxxxxxxxx : 파일명
      color:    '',  // entry.xxxxxxxxxx : 색상(hex)
      bg:       '',  // entry.xxxxxxxxxx : 배경키
      consent:  ''   // entry.xxxxxxxxxx : 개인정보 동의
    },
    consentValue: '' // 폼 옵션 텍스트(사전입력 시만 사용)
  };

  function buildFormUrl(payload){
    if (FORM.direct) return FORM.direct;
    if (!FORM.id) return 'about:blank';
    const base = `https://docs.google.com/forms/d/e/${FORM.id}/viewform`;
    const p = new URLSearchParams({ usp: 'pp_url' });
    if (FORM.fields.msg)      p.set(FORM.fields.msg, payload.msg || '');
    if (FORM.fields.filename) p.set(FORM.fields.filename, payload.filename || '');
    if (FORM.fields.color)    p.set(FORM.fields.color, payload.color || '');
    if (FORM.fields.bg)       p.set(FORM.fields.bg, payload.bg || '');
    if ( FORM.fields.consent && FORM.consentValue ) p.append(FORM.fields.consent, FORM.consentValue);
    return `${base}?${p.toString()}`;
  }

  /* =========================
       1) 공통 요소 & 상태
       ========================= */
  const stage   = document.getElementById('stage');
  const wrap    = stage.closest('.stage-wrap');
  const sample  = document.getElementById('sample');
  const size    = document.getElementById('size');
  const line    = document.getElementById('line');
  const alignChips = document.getElementById('alignChips');
  const swWrap  = document.getElementById('swWrap');

  const bgChips = document.getElementById('bgChips');
  const bgFile  = document.getElementById('bgFile');
  const bgOn    = document.getElementById('bgOn');
  const svgTint = document.getElementById('svgTint');
  const blendMul= document.getElementById('blendMul');
  const bgSvg   = document.getElementById('bgSvg');
  const bgImg   = document.getElementById('bgImg');

  const btnReset= document.getElementById('reset');
  const btnMove = document.getElementById('move');
  const btnDark = document.getElementById('dark');
  const btnSave = document.getElementById('save');

  // 모달
  const $modal   = document.getElementById('tvc-modal');
  const $openForm= document.getElementById('tvc-openForm');
  const $later   = document.getElementById('tvc-later');
  const $close   = document.getElementById('tvc-close');

  // 상태
  let currentSvgRoot=null, dragOn=false, dragging=false, sx=0, sy=0, lx=0, ly=0;
  let currentBgKey='bg01';
  let LAST_FILENAME=null, LAST_TEXT=null, LAST_COLOR='#1c1c1c';

  const BACKGROUNDS = {
    bg01: { type:'svg', url:'https://cdn.jsdelivr.net/gh/tillvictorycomes/TillVictoryComes-font@main/message.svg' },
    bg02: { type:'img', url:'https://tistory1.daumcdn.net/tistory/8066974/skin/images/bg02.jpeg' },
    bg03: { type:'img', url:'https://tistory1.daumcdn.net/tistory/8066974/skin/images/bg03.jpeg' },
    bg04: { type:'img', url:'https://tistory1.daumcdn.net/tistory/8066974/skin/images/bg04.jpeg' },
    bg05: { type:'img', url:'https://tistory1.daumcdn.net/tistory/8066974/skin/images/bg05.jpeg' },
  };
  const DEFAULT_TEXT = "당신의 문장을 적어보고, 다운로드 하세요.";
  const FONT_URL = "https://tvc-webfont.vercel.app/tillvictorycomes-Regular.woff2";

  /* =========================
       2) 스테이지 자동 스케일
       ========================= */
  function fit(){
    const scale = Math.min(1, (wrap.clientWidth || wrap.offsetWidth)/1080);
    stage.style.transform = `scale(${scale})`;
    wrap.style.height = (1350*scale) + 'px';
  }
  addEventListener('resize', fit); fit();

  /* =========================
       3) 유틸
       ========================= */
  function getActiveColor(){
    const act = swWrap.querySelector('.sw.active');
    return act ? act.dataset.c : '#1c1c1c';
  }

  async function embedFontIntoSvg(svgRoot, fontUrl=FONT_URL, family='TillVictoryComes'){
    try{
      const arr = await fetch(fontUrl,{mode:'cors'}).then(r=>r.arrayBuffer());
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arr)));
      let st = svgRoot.querySelector('#__tvc_font');
      if(!st){ st = document.createElementNS('http://www.w3.org/2000/svg','style'); st.id='__tvc_font'; svgRoot.prepend(st); }
      st.textContent = `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${b64}) format('woff2');font-display:block} text,tspan{font-family:'${family}',sans-serif !important}`;
    }catch(e){ /* 무시(임베드 실패 시에도 계속 진행) */ }
  }

  function applySvgTint(svgRoot,color){
    if(!svgRoot) return;
    let st = svgRoot.querySelector('#__tvc_tint');
    if(!st){ st = document.createElementNS('http://www.w3.org/2000/svg','style'); st.id='__tvc_tint'; svgRoot.prepend(st); }
    st.textContent = `.cls-1, path, text, tspan, g, rect, circle, ellipse, polygon, polyline{fill:${color} !important} [fill="none"],[style*="fill:none"]{fill:none !important} [stroke="none"],[style*="stroke:none"]{stroke:none !important}`;
  }
  function clearSvgTint(svgRoot){
    const st = svgRoot?.querySelector('#__tvc_tint');
    if(st) st.remove();
  }

  async function setInlineSvg(svgText){
    bgSvg.innerHTML = svgText;
    currentSvgRoot = bgSvg.querySelector('svg');
    if(currentSvgRoot){
      if(!currentSvgRoot.getAttribute('viewBox')) currentSvgRoot.setAttribute('viewBox','0 0 1080 1350');
      currentSvgRoot.setAttribute('preserveAspectRatio','xMidYMid slice');
      currentSvgRoot.style.width='100%';
      currentSvgRoot.style.height='100%';
      await embedFontIntoSvg(currentSvgRoot, FONT_URL);
      if (svgTint.checked) applySvgTint(currentSvgRoot, getActiveColor());
      else clearSvgTint(currentSvgRoot);
    }
    bgSvg.style.display='block'; bgImg.style.display='none';
  }

  async function setBackground(key){
    currentBgKey = key;
    const cfg = BACKGROUNDS[key]; if(!cfg) return;
    bgImg.removeAttribute('src'); bgImg.style.display='none'; bgSvg.innerHTML=''; currentSvgRoot=null;

    if(cfg.type==='svg'){
      try{
        const svgText = await fetch(cfg.url,{mode:'cors'}).then(r=>r.text());
        await setInlineSvg(svgText);
      }catch(e){
        bgImg.src = cfg.url; bgImg.style.display='block';
      }
    }else{
      bgImg.src = cfg.url; bgImg.style.display='block';
    }
  }

  /* =========================
       4) 컨트롤 바인딩
       ========================= */
  swWrap.querySelectorAll('.sw').forEach(s=>{
    s.addEventListener('click', ()=>{
      swWrap.querySelectorAll('.sw').forEach(x=>x.classList.remove('active'));
      s.classList.add('active');
      LAST_COLOR = s.dataset.c;
      sample.style.color = LAST_COLOR;
      if (currentSvgRoot){
        if (svgTint.checked) applySvgTint(currentSvgRoot, LAST_COLOR);
        else clearSvgTint(currentSvgRoot);
      }
    });
  });

  alignChips.addEventListener('change', ()=>{
    sample.style.textAlign = alignChips.querySelector('input:checked')?.value || 'center';
  });
  size.addEventListener('input', ()=> sample.style.fontSize = size.value + 'px');
  line.addEventListener('input', ()=> sample.style.lineHeight = line.value);

  bgOn.addEventListener('change', ()=>{
    const layer = stage.querySelector('.bg-layer');
    if(layer) layer.style.display = bgOn.checked ? 'block' : 'none';
  });

  bgChips.addEventListener('change', async ()=>{
    const key = bgChips.querySelector('input[name="bg"]:checked')?.value;
    if (key === 'custom') return;
    await setBackground(key);
  });

  bgFile.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    document.getElementById('bgCustom').checked = true;
    bgSvg.innerHTML=''; currentSvgRoot=null; bgImg.removeAttribute('src'); bgImg.style.display='none';
    if(/svg/i.test(file.type) || /\.svg$/i.test(file.name)){
      const txt = await file.text(); await setInlineSvg(txt);
    }else{
      const fr = new FileReader();
      fr.onload = ()=>{ bgImg.src = fr.result; bgImg.style.display='block'; };
      fr.readAsDataURL(file);
    }
  });

  svgTint.addEventListener('change', ()=>{
    if (!currentSvgRoot) return;
    if (svgTint.checked) applySvgTint(currentSvgRoot, getActiveColor());
    else clearSvgTint(currentSvgRoot);
  });

  blendMul.addEventListener('change', ()=>{
    sample.style.mixBlendMode = blendMul.checked ? 'multiply' : 'normal';
  });

  setBackground('bg01');

  /* =========================
       5) 텍스트 이동 모드
       ========================= */
  function setDragMode(on){
    dragOn = on;
    btnMove.textContent = on ? '텍스트 이동 OFF' : '텍스트 이동 ON';
    sample.setAttribute('contenteditable', String(!on));
    sample.style.userSelect = on ? 'none' : '';
    sample.style.cursor = on ? 'grab' : 'text';
  }
  setDragMode(false);

  btnMove.addEventListener('click', ()=> setDragMode(!dragOn));

  sample.addEventListener('mousedown', (e)=>{
    if(!dragOn) return;
    dragging=true; sample.style.cursor='grabbing';
    if(sample.style.position!=='absolute'){
      const r = sample.getBoundingClientRect(), s = stage.getBoundingClientRect();
      sample.style.position='absolute';
      sample.style.left = (r.left - s.left) + 'px';
      sample.style.top  = (r.top  - s.top ) + 'px';
      sample.style.width = (s.width - 120) + 'px';
    }
    sx=e.clientX; sy=e.clientY; lx=parseFloat(sample.style.left)||0; ly=parseFloat(sample.style.top)||0;
    e.preventDefault();
  });
  addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    sample.style.left = (lx + (e.clientX - sx)) + 'px';
    sample.style.top  = (ly + (e.clientY - sy)) + 'px';
  });
  addEventListener('mouseup', ()=>{
    dragging=false; sample.style.cursor= dragOn ? 'grab':'text';
  });

  /* =========================
       6) 초기화 / 다크모드
       ========================= */
  btnReset.addEventListener('click', ()=>{
    sample.innerText = DEFAULT_TEXT;
    size.value=96; line.value=1.25;
    sample.style.cssText = "font-family:'TillVictoryComes',sans-serif;font-size:96px;line-height:1.25;color:#1c1c1c;text-align:center;";
    swWrap.querySelectorAll('.sw').forEach(x=>x.classList.remove('active'));
    const first = swWrap.querySelector('.sw[data-c=\"#1c1c1c\"]') || swWrap.firstElementChild;
    first.classList.add('active');
    LAST_COLOR = '#1c1c1c';
    sample.style.position='relative'; sample.style.left='0px'; sample.style.top='0px';
    sample.style.mixBlendMode='normal'; blendMul.checked=false;
    setDragMode(false);
  });

  btnDark.addEventListener('click', ()=>{
    document.getElementById('tvc-card').classList.toggle('dark');
  });

  /* =========================
       7) 모달 & 구글폼 열기
       ========================= */
  function openModal(){ $modal.classList.remove('tvc-hidden'); }
  function closeModal(){ $modal.classList.add('tvc-hidden'); }
  $later.addEventListener('click', closeModal);
  $close.addEventListener('click', closeModal);

  $openForm.addEventListener('click', ()=>{
    const url = buildFormUrl({
      msg: (LAST_TEXT || '').trim(),
      filename: LAST_FILENAME || '',
      color: LAST_COLOR || '',
      bg: currentBgKey || ''
    });
    window.open(url, '_blank', 'noopener');
    closeModal();
  });

  /* =========================
       8) 다운로드 파이프라인
       ========================= */
  async function afterDownload(filename, text){
    LAST_FILENAME = filename;
    LAST_TEXT = text;
    openModal();
  }

  async function saveFromCanvas(canvas, filename, text){
    const blob = await new Promise(res=> canvas.toBlob(res,'image/png',1));
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 2000);
    await afterDownload(filename, text);
  }

  function loadImage(src){
    return new Promise((res,rej)=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>res(img); img.onerror=rej; img.src=src;
    });
  }
  
  // 곱하기 모드 수동 합성
  async function exportMultiply(text){
    const W=1080,H=1350;
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');

    const svgEl = bgSvg.querySelector('svg');
    if (svgEl){
      const xml = new XMLSerializer().serializeToString(svgEl);
      const u = URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
      try{ const img = await loadImage(u); ctx.drawImage(img,0,0,W,H); } finally{ URL.revokeObjectURL(u); }
    } else if (bgImg?.src){
      const img = await loadImage(bgImg.src);
      const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
      const s=Math.max(W/iw,H/ih), dw=iw*s, dh=ih*s, dx=(W-dw)/2, dy=(H-dh)/2;
      ctx.drawImage(img,dx,dy,dw,dh);
    } else {
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    }

    const cs=getComputedStyle(sample);
    const fontSize=parseFloat(cs.fontSize)||96;
    const lineH=(parseFloat(cs.lineHeight)||fontSize*1.25);
    const color=cs.color;
    const align=cs.textAlign||'center';
    const sr=sample.getBoundingClientRect(), st=stage.getBoundingClientRect();
    const boxX=sr.left-st.left, boxY=sr.top-st.top, boxW=sr.width;

    ctx.save();
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle=color; ctx.textBaseline='alphabetic';
    ctx.font=`400 ${fontSize}px "TillVictoryComes", sans-serif`;
    ctx.textAlign = (align==='right'?'right':align==='left'?'left':'center');

    const raw=sample.innerText.replace(/\r/g,'').split('\n'); const lines=[];
    for(const para of raw){
      let acc=''; for(const ch of para){
        const t=acc+ch;
        if(ctx.measureText(t).width>boxW && acc){ lines.push(acc); acc=ch; } else { acc=t; }
      } lines.push(acc);
    }
    let x = align==='left'? boxX : align==='right'? boxX+boxW : boxX+boxW/2;
    let y = boxY + fontSize;
    for(const ln of lines){ ctx.fillText(ln,x,y); y+=lineH; }
    ctx.restore();
    
    const timestamp = new Date().getTime();
    const filename = `tillvictory-1080x1350-mul-${timestamp}.png`;
    await saveFromCanvas(canvas, filename, text);
  }

  
// 일반(html2canvas) 저장
  btnSave.addEventListener('click', async ()=>{
    try{ if(document.fonts?.ready) await document.fonts.ready; }catch(e){}
    const text = (sample.innerText||'').trim();

    if (blendMul.checked){ await exportMultiply(text); return; }

    const prevY = scrollY; window.scrollTo(0,0);
    const prevTransform = stage.style.transform;
    
    // 미리보기 스케일 값을 1로 임시 변경 (캡처 정확도 향상)
    stage.style.transform = 'scale(1)';

    try{
      // 캡처 영역의 실제 픽셀 크기를 계산
      const captureWidth = 1080;
      const captureHeight = 1350;
      
      const canvas = await html2canvas(stage,{
        backgroundColor:null,
        useCORS:true,
        logging:false,
        // 캡처 크기를 원본 비율에 맞게 설정
        width: captureWidth,
        height: captureHeight,
        // Device Pixel Ratio(DPR)을 기반으로 스케일링하여 고해상도에서 깨짐 방지
        scale: window.devicePixelRatio,
        // 캡처 시작 전 스크롤을 0,0으로 이동
        scrollX: -window.scrollX,
        scrollY: -window.scrollY
      });

      // 캔버스 크기를 1080x1350으로 다시 조정
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = captureWidth;
      finalCanvas.height = captureHeight;
      const finalCtx = finalCanvas.getContext('2d');
      
      finalCtx.drawImage(
          canvas,
          0, 0, canvas.width, canvas.height, // 소스 영역
          0, 0, finalCanvas.width, finalCanvas.height // 대상 영역
      );

      const timestamp = new Date().getTime();
      const fileName = `tillvictory-1080x1350-${timestamp}.png`;
      await saveFromCanvas(finalCanvas, fileName, text);
      
    }catch(err){
      alert('다운로드 중 오류가 발생했습니다. 콘솔을 확인해 주세요.'); console.error(err);
    }finally{
      // 캡처 후 원래 상태로 복원
      stage.style.transform = prevTransform;
      window.scrollTo(0, prevY);
    }
  });

  // 초기 배경 레이어 표시상태 동기화
  const layer = stage.querySelector('.bg-layer');
  if(layer) layer.style.display = bgOn.checked ? 'block':'none';
})();
