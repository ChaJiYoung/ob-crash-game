import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import * as path from 'path';

async function generateMockupComparisons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });

  const artifactDir = '/Users/bigtree/.gemini/antigravity-cli/brain/2c80a903-47aa-4ed7-adcf-86b18f07fc44';

  const mockups = [
    {
      id: 'mockup-01-billboard',
      title: '시안 1. 아케이드 3D 네온 빌보드 라벨 (추천)',
      desc: '3D 오브젝트 상단에 원거리에서도 0.1초 만에 식별 가능한 네온 플로팅 텍스트 박스 배치',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        // Background: 3D Brewery Stage atmosphere
        const bgGrad = ctx.createRadialGradient(600, 337, 50, 600, 337, 700);
        bgGrad.addColorStop(0, '#1c1917');
        bgGrad.addColorStop(0.5, '#0c0a09');
        bgGrad.addColorStop(1, '#050403');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1200, 675);

        // Floor perspective grid
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.lineWidth = 1.5;
        for (let x = 100; x <= 1100; x += 100) {
          ctx.beginPath();
          ctx.moveTo(x, 480);
          ctx.lineTo(600 + (x - 600) * 1.8, 675);
          ctx.stroke();
        }
        for (let y = 480; y <= 675; y += 45) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1200, y);
          ctx.stroke();
        }

        // Header Title
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('시안 1. 아케이드 3D 네온 빌보드 라벨 (원거리 18m 시인성 극대화)', 600, 52);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px sans-serif';
        ctx.fillText('오브젝트 위에 항상 플레이어를 바라보는 발광 텍스트 박스가 함께 떠다녀 즉시 효과 인지 가능', 600, 82);

        const items = [
          { name: 'DAMAGE 2X', sub: '사격 데미지 2배', icon: '💥', color: '#ef4444', x: 210, y: 340, shape: 'opener' },
          { name: 'WIDE 1.6X', sub: '조준경 1.6배 확대', icon: '🎯', color: '#38bdf8', x: 470, y: 340, shape: 'coaster' },
          { name: 'SLOW 50%', sub: '몬스터 50% 감속', icon: '🧊', color: '#60a5fa', x: 730, y: 340, shape: 'bucket' },
          { name: 'LIFE +1', sub: '방어선 체력 회복', icon: '🍺', color: '#10b981', x: 990, y: 340, shape: 'hop' }
        ];

        items.forEach((item) => {
          // Drop shadow on floor
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.beginPath();
          ctx.ellipse(item.x, 520, 65, 20, 0, 0, Math.PI * 2);
          ctx.fill();

          // Glowing aura ring
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 5;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 24;
          ctx.beginPath();
          ctx.ellipse(item.x, item.y + 40, 75, 30, Math.PI / 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // 3D Prop Mockup Icon
          ctx.font = '76px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.icon, item.x, item.y + 35);

          // Billboard Neon Label Box (TOP)
          const bw = 175;
          const bh = 54;
          const bx = item.x - bw / 2;
          const by = item.y - 105;

          // Box Background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 10);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Connecting laser guide line to prop
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(item.x, by + bh);
          ctx.lineTo(item.x, item.y - 20);
          ctx.stroke();
          ctx.setLineDash([]);

          // Neon Label Text
          ctx.fillStyle = item.color;
          ctx.font = '900 18px "Impact", "Arial Black", sans-serif';
          ctx.fillText(`${item.icon} ${item.name}`, item.x, by + 26);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(item.sub, item.x, by + 44);
        });
      }
    },
    {
      id: 'mockup-02-classic-symbols',
      title: '시안 2. 고전 아케이드 표준 3D 심볼 (단순화)',
      desc: '펍 소품을 완전히 제거하고, 친숙한 거대 하트·번개·눈송이·과녁 3D 네온 덩어리로 교체',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const bgGrad = ctx.createRadialGradient(600, 337, 50, 600, 337, 700);
        bgGrad.addColorStop(0, '#111827');
        bgGrad.addColorStop(0.5, '#030712');
        bgGrad.addColorStop(1, '#000000');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1200, 675);

        // Grid
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1.5;
        for (let x = 100; x <= 1100; x += 100) {
          ctx.beginPath();
          ctx.moveTo(x, 480);
          ctx.lineTo(600 + (x - 600) * 1.8, 675);
          ctx.stroke();
        }
        for (let y = 480; y <= 675; y += 45) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1200, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('시안 2. 고전 아케이드 표준 3D 심볼 (클래식 게임 스타일)', 600, 52);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px sans-serif';
        ctx.fillText('맥주 소품 대신 누구나 게임에서 즉각 알아채는 번개·과녁·눈송이·하트 심볼 자체를 3D로 배치', 600, 82);

        const items = [
          { symbol: '⚡', name: '번개 심볼 (파워샷)', sub: '데미지 2배', color: '#fbbf24', x: 210, y: 330 },
          { symbol: '🎯', name: '과녁 심볼 (빅스코프)', sub: '판정 면적 확대', color: '#38bdf8', x: 470, y: 330 },
          { symbol: '❄️', name: '눈송이 심볼 (프리즈)', sub: '전체 몬스터 둔화', color: '#60a5fa', x: 730, y: 330 },
          { symbol: '❤️', name: '하트 심볼 (생명회복)', sub: '체력 +1 충전', color: '#ef4444', x: 990, y: 330 }
        ];

        items.forEach((item) => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.beginPath();
          ctx.ellipse(item.x, 520, 70, 22, 0, 0, Math.PI * 2);
          ctx.fill();

          // Outer glowing crystal hexagon
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 4;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 32;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const hx = item.x + Math.cos(angle) * 80;
            const hy = item.y + Math.sin(angle) * 80;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = `${item.color}22`;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Huge 3D Symbol in center
          ctx.font = '92px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.symbol, item.x, item.y + 32);

          // Card bottom
          ctx.fillStyle = item.color;
          ctx.font = '900 18px sans-serif';
          ctx.fillText(item.name, item.x, item.y + 125);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(item.sub, item.x, item.y + 150);
        });
      }
    },
    {
      id: 'mockup-03-korean-bubbles',
      title: '시안 3. 한글 직관적 팝업 배너 말풍선',
      desc: '기존 펍 소품 위에 누구나 읽기 쉬운 굵은 한글 텍스트 배너를 팝업하여 친절한 아케이드 무드 연출',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const bgGrad = ctx.createRadialGradient(600, 337, 50, 600, 337, 700);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1200, 675);

        ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
        ctx.lineWidth = 1.5;
        for (let x = 100; x <= 1100; x += 100) {
          ctx.beginPath();
          ctx.moveTo(x, 480);
          ctx.lineTo(600 + (x - 600) * 1.8, 675);
          ctx.stroke();
        }
        for (let y = 480; y <= 675; y += 45) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1200, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#c084fc';
        ctx.font = '900 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('시안 3. 한글 직관적 팝업 배너 말풍선 (캐주얼 친화형)', 600, 52);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px sans-serif';
        ctx.fillText('영문 약어 대신 친근한 한글 굵은 글씨로 "데미지 2배", "체력 +1" 배너를 크게 부유', 600, 82);

        const items = [
          { banner: '💥 데미지 2배!', sub: '황금 병따개 소품', color: '#ef4444', x: 210, y: 340, icon: '💥' },
          { banner: '🎯 조준경 확대!', sub: '맥주 코스터 소품', color: '#38bdf8', x: 470, y: 340, icon: '🎯' },
          { banner: '🧊 몬스터 둔화!', sub: '얼음 버킷 소품', color: '#60a5fa', x: 730, y: 340, icon: '🧊' },
          { banner: '🍺 바 체력 +1!', sub: '홉 열매 다발 소품', color: '#10b981', x: 990, y: 340, icon: '🍺' }
        ];

        items.forEach((item) => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.beginPath();
          ctx.ellipse(item.x, 520, 65, 20, 0, 0, Math.PI * 2);
          ctx.fill();

          // Prop icon
          ctx.font = '76px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.icon, item.x, item.y + 40);

          // Big Korean Speech Bubble Banner
          const bw = 175;
          const bh = 56;
          const bx = item.x - bw / 2;
          const by = item.y - 95;

          ctx.fillStyle = item.color;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 14);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Pointer triangle
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.moveTo(item.x - 12, by + bh);
          ctx.lineTo(item.x + 12, by + bh);
          ctx.lineTo(item.x, by + bh + 14);
          ctx.closePath();
          ctx.fill();

          // White Text
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 17px -apple-system, sans-serif';
          ctx.fillText(item.banner, item.x, by + 34);

          // Subtext
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(item.sub, item.x, item.y + 115);
        });
      }
    }
  ];

  for (const m of mockups) {
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0; overflow:hidden;"><canvas id="cv" width="1200" height="675"></canvas></body></html>`);
    await page.evaluate(m.renderFn);
    const cvHandle = await page.$('#cv');
    const outBrain = path.join(artifactDir, `${m.id}.png`);
    const outDocs = path.join(process.cwd(), `docs/screens/${m.id}.png`);
    await cvHandle.screenshot({ path: outBrain, type: 'png' });
    await cvHandle.screenshot({ path: outDocs, type: 'png' });
    console.log(`Generated mockup: ${outBrain}`);
  }

  await browser.close();
  console.log('All 3 mockup comparisons generated successfully!');
}

generateMockupComparisons().catch(console.error);
