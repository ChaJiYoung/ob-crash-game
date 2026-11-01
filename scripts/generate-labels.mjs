import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import * as fs from 'fs';
import * as path from 'path';

async function generateLabels() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 512 } });

  const labelConfigs = [
    {
      name: 'pilgood',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#0077b6');
        grad.addColorStop(0.2, '#0096c7');
        grad.addColorStop(0.5, '#00b4d8');
        grad.addColorStop(0.8, '#0096c7');
        grad.addColorStop(1, '#0077b6');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        for (let i = 0; i < 90; i++) {
          const bx = (i * 37) % 1024;
          const by = (i * 73) % 512;
          const br = 3 + (i % 6);
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#ffd100';
        ctx.fillRect(0, 0, 1024, 28);
        ctx.fillStyle = '#003566';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ HAPPIEST MOMENT WITH FILGOOD · FRESH AROMA HOP ★', 512, 20);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(512, 195, 120, 65, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(395, 195);
        ctx.lineTo(340, 160);
        ctx.lineTo(360, 195);
        ctx.lineTo(340, 230);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(520, 235, 30, 15, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0077b6';
        ctx.beginPath();
        ctx.arc(585, 185, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(587, 183, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffd100';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(560, 130);
        ctx.quadraticCurveTo(560, 95, 530, 80);
        ctx.moveTo(560, 130);
        ctx.quadraticCurveTo(570, 90, 600, 85);
        ctx.stroke();

        ctx.fillStyle = '#ffd100';
        ctx.strokeStyle = '#003566';
        ctx.lineWidth = 9;
        ctx.font = '900 88px "Impact", "Arial Black", sans-serif';
        ctx.strokeText('FiLGOOD', 512, 330);
        ctx.fillText('FiLGOOD', 512, 330);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('필굿 오리지널 · 발포주', 512, 375);

        ctx.fillStyle = '#ffd100';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('ALC. 4.5% VOL. · 355mL / 500mL', 512, 420);

        ctx.fillStyle = '#003566';
        ctx.fillRect(0, 470, 1024, 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('OB BREWERY CO., LTD. · 100% FRESH AROMA HOP', 512, 497);
      }
    },
    {
      name: 'caslight',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 512);
        grad.addColorStop(0, '#e0f2fe');
        grad.addColorStop(0.25, '#7dd3fc');
        grad.addColorStop(0.5, '#0284c7');
        grad.addColorStop(0.75, '#0369a1');
        grad.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) {
          const fx = (i * 61) % 1024;
          const fy = (i * 47) % 512;
          ctx.beginPath();
          ctx.moveTo(fx - 15, fy); ctx.lineTo(fx + 15, fy);
          ctx.moveTo(fx, fy - 15); ctx.lineTo(fx, fy + 15);
          ctx.moveTo(fx - 10, fy - 10); ctx.lineTo(fx + 10, fy + 10);
          ctx.stroke();
        }

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(0, 0, 1024, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COLD BREWED ICE FILTRATION · 카스 라이트', 512, 22);

        ctx.save();
        ctx.translate(512, 210);
        ctx.transform(1, 0, -0.22, 1, 0, 0);

        ctx.fillStyle = '#082f49';
        ctx.font = '900 135px "Impact", "Arial Black", sans-serif';
        ctx.fillText('Cass', -155 + 6, 6);

        const textGrad = ctx.createLinearGradient(0, -90, 0, 20);
        textGrad.addColorStop(0, '#ffffff');
        textGrad.addColorStop(0.5, '#e2e8f0');
        textGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = textGrad;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText('Cass', -155, 0);
        ctx.fillText('Cass', -155, 0);
        ctx.restore();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(310, 240);
        ctx.lineTo(714, 240);
        ctx.lineTo(694, 255);
        ctx.lineTo(290, 255);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 68px "Arial Black", sans-serif';
        ctx.fillText('LIGHT', 512, 330);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('33% LOWER CALORIES', 512, 380);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('ALC. 4.0% VOL. · 빙점여과공법', 512, 420);

        ctx.fillStyle = '#082f49';
        ctx.fillRect(0, 465, 1024, 47);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('OB BREWERY · KOREA NO.1 LIGHT BEER', 512, 495);
      }
    },
    {
      name: 'obi',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#b45309');
        grad.addColorStop(0.2, '#d97706');
        grad.addColorStop(0.5, '#f59e0b');
        grad.addColorStop(0.8, '#d97706');
        grad.addColorStop(1, '#b45309');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(512, 240, 175, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(512, 240, 163, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(480, 115);
        ctx.lineTo(490, 135);
        ctx.lineTo(512, 110);
        ctx.lineTo(534, 135);
        ctx.lineTo(544, 115);
        ctx.lineTo(540, 145);
        ctx.lineTo(484, 145);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(460, 150, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(564, 150, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(512, 185, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(512, 196, 26, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(512, 188, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(512, 198, 11, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(495, 175, 4, 0, Math.PI * 2);
        ctx.arc(529, 175, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(330, 265, 364, 62);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OB LAGER', 512, 312);

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('100% ALL MALT BEER', 512, 360);

        ctx.fillStyle = '#b91c1c';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('SINCE 1952 · 오비라거', 512, 390);

        ctx.fillStyle = '#991b1b';
        ctx.fillRect(0, 0, 1024, 30);
        ctx.fillRect(0, 475, 1024, 37);

        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('★ KOREA VINTAGE ORIGINAL BEER · 랄라베어 뉴트로 에디션 ★', 512, 21);
        ctx.fillText('ALC. 4.6% VOL. · OB BREWERY ICHEON', 512, 500);
      }
    },
    {
      name: 'hanmac',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#022c22');
        grad.addColorStop(0.25, '#064e3b');
        grad.addColorStop(0.5, '#047857');
        grad.addColorStop(0.75, '#064e3b');
        grad.addColorStop(1, '#022c22');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < 1024; x += 45) {
          ctx.beginPath();
          ctx.moveTo(x, 0); ctx.lineTo(x + 512, 512);
          ctx.moveTo(x, 0); ctx.lineTo(x - 512, 512);
          ctx.stroke();
        }

        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, 0, 1024, 28);
        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 15px serif';
        ctx.textAlign = 'center';
        ctx.fillText('KOREAN LAGER · 100% KOREAN RICE CREST · HANMAC', 512, 20);

        ctx.save();
        ctx.translate(512, 175);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 6;
        ctx.strokeRect(-80, -60, 160, 120);

        ctx.fillStyle = '#fde047';
        ctx.font = '36px serif';
        ctx.fillText('🌾', -45, 12);
        ctx.fillText('🌾', 45, 12);

        ctx.fillStyle = '#d4af37';
        ctx.font = '900 44px serif';
        ctx.fillText('韓', 0, 15);
        ctx.restore();

        ctx.fillStyle = '#fef08a';
        ctx.font = '900 78px "Times New Roman", "Georgia", serif';
        ctx.textAlign = 'center';
        ctx.fillText('HANMAC', 512, 330);

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(340, 345);
        ctx.lineTo(684, 345);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('대한민국 대표 라거 한맥', 512, 385);

        ctx.fillStyle = '#d4af37';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('100% 국내산 쌀 함유 · 부드러운 목넘김 · ALC. 4.6%', 512, 425);

        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, 470, 1024, 42);
        ctx.fillStyle = '#022c22';
        ctx.font = 'bold 16px serif';
        ctx.fillText('EXCLUSIVELY BREWED BY OB BEER · PREMIUM QUALITY', 512, 497);
      }
    },
    {
      name: 'mug',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 512);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(512, 240, 190, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 10;
        ctx.stroke();

        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(512, 240, 170, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★   ★   ★', 512, 140);

        ctx.font = '72px sans-serif';
        ctx.fillText('🍺', 512, 220);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 52px "Arial Black", sans-serif';
        ctx.fillText('DRAFT BEER', 512, 290);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px sans-serif';
        ctx.fillText('500ml FRESH TAP', 512, 335);

        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('ICE COLD CARBONATION · CREAMY FOAM', 512, 375);

        ctx.fillStyle = '#d97706';
        ctx.fillRect(0, 0, 1024, 25);
        ctx.fillRect(0, 480, 1024, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('AUTHENTIC OB BREWERY DRAFT MUG SPECIALTY', 512, 502);
      }
    },
    {
      name: 'boss',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#334155');
        grad.addColorStop(0.2, '#64748b');
        grad.addColorStop(0.4, '#94a3b8');
        grad.addColorStop(0.6, '#cbd5e1');
        grad.addColorStop(0.8, '#64748b');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let y = 0; y < 512; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y); ctx.lineTo(1024, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        [[35, 35], [989, 35], [35, 477], [989, 477]].forEach(([rx, ry]) => {
          ctx.beginPath();
          ctx.arc(rx, ry, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(60, 20, 904, 55);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 28px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ OB BEER COMMERCIAL COOLER DISPENSER SYSTEM ⚡', 512, 58);

        ctx.fillStyle = '#020617';
        ctx.fillRect(180, 100, 664, 110);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(180, 100, 664, 110);

        ctx.fillStyle = '#22c55e';
        ctx.font = '900 48px monospace';
        ctx.fillText('TEMP: -4.0°C   PRESS: 2.4 BAR', 512, 160);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('COOLING SYSTEM: ACTIVE   FLOW: 12.5 L/MIN', 512, 195);

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(60, 230, 904, 38);
        ctx.fillStyle = '#fef08a';
        ctx.font = '900 20px sans-serif';
        ctx.fillText('⚠ WARNING: BOSS MONSTER DISPENSER OVERCLOCKED ⚠', 512, 256);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(180, 290, 310, 100);
        ctx.fillRect(534, 290, 310, 100);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('TAP 1: CASS FRESH', 335, 335);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('DUAL EXTRACTOR ON', 335, 365);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('TAP 2: OB LAGER', 689, 335);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('RAPID COOLING ON', 689, 365);

        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < 18; i++) {
          ctx.fillRect(120 + i * 44, 420, 22, 60);
        }
      }
    },
    {
      name: 'bottle',
      renderFn: () => {
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');

        // Deep blue rich metallic gradient
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#001e42');
        grad.addColorStop(0.2, '#003366');
        grad.addColorStop(0.5, '#005a9c');
        grad.addColorStop(0.8, '#003366');
        grad.addColorStop(1, '#001e42');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        // Silver / chrome top and bottom borders
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 1024, 32);
        ctx.fillRect(0, 480, 1024, 32);

        ctx.fillStyle = '#002855';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COLD BREWED FRESH BEER · ALL NEW CASS · MASTER BREWED IN KOREA', 512, 22);
        ctx.fillText('500ml · ALC 4.5% · SERVE EXTRA COLD AT 0°C ~ 4°C', 512, 502);

        // Dynamic ice angular chevron wings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(180, 256);
        ctx.lineTo(280, 120);
        ctx.lineTo(340, 120);
        ctx.lineTo(240, 256);
        ctx.lineTo(340, 392);
        ctx.lineTo(280, 392);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(844, 256);
        ctx.lineTo(744, 120);
        ctx.lineTo(684, 120);
        ctx.lineTo(784, 256);
        ctx.lineTo(684, 392);
        ctx.lineTo(744, 392);
        ctx.closePath();
        ctx.fill();

        // Central diamond crest shield
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(512, 70);
        ctx.lineTo(680, 230);
        ctx.lineTo(512, 430);
        ctx.lineTo(344, 230);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#003366';
        ctx.beginPath();
        ctx.moveTo(512, 85);
        ctx.lineTo(665, 230);
        ctx.lineTo(512, 415);
        ctx.lineTo(359, 230);
        ctx.closePath();
        ctx.fill();

        // CASS Bold typography
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 110px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#001830';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 5;
        ctx.fillText('Cass', 512, 240);
        ctx.shadowColor = 'transparent';

        // FRESH sub banner
        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 42px "Arial Black", Impact, sans-serif';
        ctx.fillText('FRESH', 512, 305);

        // Subtext and silver stars
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('★ 100% NON-PASTEURIZED LAGER ★', 512, 350);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('NATURAL CARBONATION · EXTRA COLD FILTERED', 512, 385);
      }
    }
  ];

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0; overflow:hidden;"><canvas id="cv" width="1024" height="512"></canvas></body></html>`);

  for (const cfg of labelConfigs) {
    await page.evaluate(cfg.renderFn);
    const canvasHandle = await page.$('#cv');
    const outPath = path.join(process.cwd(), 'public/textures/labels', `${cfg.name}.jpg`);
    await canvasHandle.screenshot({ path: outPath, type: 'jpeg', quality: 95 });
    console.log(`Generated: ${outPath}`);
  }

  await browser.close();
  console.log('All 6 product label textures generated successfully!');
}

generateLabels().catch((err) => {
  console.error(err);
  process.exit(1);
});
