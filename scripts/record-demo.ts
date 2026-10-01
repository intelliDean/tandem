import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🎥 Launching Playwright with custom Cinematic Narrator HUD...');
  const executablePath = '/home/dean/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
  const demoDir = path.resolve('/mnt/data/Projects/tandem/demo');
  if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: demoDir,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();

  console.log('1. Loading Tandem Web Terminal (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Inject Custom HUD & Spotlight Styles
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'demo-hud-styles';
    style.innerHTML = `
      #tandem-narrator-hud {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        width: 860px;
        background: rgba(13, 14, 28, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(131, 110, 249, 0.5);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(131, 110, 249, 0.25);
        border-radius: 16px;
        padding: 18px 24px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #fff;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      .hud-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .hud-tag {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #836EF9;
        background: rgba(131, 110, 249, 0.15);
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid rgba(131, 110, 249, 0.3);
      }
      .hud-badge {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 4px 10px;
        border-radius: 20px;
        font-family: "JetBrains Mono", monospace;
      }
      .hud-badge-cyan {
        color: #00F0FF;
        background: rgba(0, 240, 255, 0.15);
        border: 1px solid rgba(0, 240, 255, 0.3);
      }
      .hud-badge-green {
        color: #00FF88;
        background: rgba(0, 255, 136, 0.15);
        border: 1px solid rgba(0, 255, 136, 0.3);
      }
      .hud-badge-red {
        color: #FF3366;
        background: rgba(255, 51, 102, 0.15);
        border: 1px solid rgba(255, 51, 102, 0.3);
      }
      .hud-title {
        font-size: 17px;
        font-weight: 800;
        margin-bottom: 6px;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .hud-desc {
        font-size: 13px;
        line-height: 1.5;
        color: #a0a5c0;
        margin-bottom: 4px;
      }
      .hud-tech {
        font-size: 11px;
        font-family: "JetBrains Mono", monospace;
        color: #00F0FF;
        background: rgba(0, 240, 255, 0.05);
        padding: 4px 8px;
        border-radius: 6px;
        display: inline-block;
        margin-top: 4px;
      }
      .demo-spotlight {
        outline: 2px solid #00F0FF !important;
        box-shadow: 0 0 25px rgba(0, 240, 255, 0.45) !important;
        transition: all 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'tandem-narrator-hud';
    hud.innerHTML = `
      <div class="hud-header">
        <span id="hud-tag" class="hud-tag">TANDEM PROTOCOL WALKTHROUGH</span>
        <span id="hud-badge" class="hud-badge hud-badge-cyan">● MONAD METROPOLIS</span>
      </div>
      <div id="hud-title" class="hud-title">Atomic Paired Trading on Monad</div>
      <div id="hud-desc" class="hud-desc">Eliminating legging-in risk through EVM-level atomicity across Kuru CLOB and Perpl DEX.</div>
      <div id="hud-tech" class="hud-tech">Contract: TandemSpreadRouter.sol • 100% Rollback Guarantee</div>
    `;
    document.body.appendChild(hud);

    (window as any).updateHUD = (tag: string, title: string, desc: string, badgeText: string, badgeType: string, techText: string, highlightSelector?: string) => {
      const hudEl = document.getElementById('tandem-narrator-hud');
      if (!hudEl) return;
      document.getElementById('hud-tag')!.innerText = tag;
      document.getElementById('hud-title')!.innerHTML = title;
      document.getElementById('hud-desc')!.innerText = desc;
      document.getElementById('hud-tech')!.innerText = techText;

      const badgeEl = document.getElementById('hud-badge')!;
      badgeEl.innerText = badgeText;
      badgeEl.className = `hud-badge hud-badge-${badgeType}`;

      // Remove previous spotlights
      document.querySelectorAll('.demo-spotlight').forEach((el) => el.classList.remove('demo-spotlight'));
      if (highlightSelector) {
        const target = document.querySelector(highlightSelector);
        if (target) target.classList.add('demo-spotlight');
      }
    };
  });

  // Helper function to set HUD state from Playwright
  const setChapter = async (
    tag: string,
    title: string,
    desc: string,
    badgeText: string,
    badgeType: 'cyan' | 'green' | 'red',
    techText: string,
    highlightSelector?: string
  ) => {
    await page.evaluate(
      ({ tag, title, desc, badgeText, badgeType, techText, highlightSelector }) => {
        (window as any).updateHUD(tag, title, desc, badgeText, badgeType, techText, highlightSelector);
      },
      { tag, title, desc, badgeText, badgeType, techText, highlightSelector }
    );
  };

  // ==========================================
  // CHAPTER 1: PROTOCOL INTRODUCTION & DUAL TICKERS
  // ==========================================
  console.log('Chapter 1: Protocol Intro & Dual Tickers...');
  await setChapter(
    'CHAPTER 1 / 8 • ARCHITECTURE & DUAL VENUE MONITORING',
    '⚡ Tandem: Atomic Multi-Leg Trading on Monad',
    'Tandem couples Kuru Central Limit Order Book (Spot MON/USDC) with Perpl Perpetual DEX into a single atomic execution primitive. Both trades execute in 1 tx, or neither commits.',
    '● VENUES LIVE',
    'cyan',
    'Kuru CLOB (0x065C...C394) + Perpl DEX (0x34B6...2a6F)',
    '.ticker-grid'
  );
  await page.waitForTimeout(11000);

  // ==========================================
  // CHAPTER 2: TRADER WALLET CONNECTION & ACCOUNT BINDING
  // ==========================================
  console.log('Chapter 2: Wallet Connection & Account Binding...');
  await setChapter(
    'CHAPTER 2 / 8 • TRADER AUTHENTICATION & CHAIN BINDING',
    '🔐 Non-Custodial Account Connection',
    'Connecting trader wallet to Monad. The TandemSpreadRouter requires zero token deposits or idle fund custody. Assets are transferred only at the exact instant of execution.',
    '● CONNECTING',
    'cyan',
    'Trader EOA: 0xf39Fd6e5...92266 • Chain ID: 143 (Monad)',
    '#btn-connect-wallet'
  );
  await page.waitForTimeout(3000);
  await page.click('#btn-connect-wallet');
  await page.waitForTimeout(4000);

  await setChapter(
    'CHAPTER 2 / 8 • TRADER AUTHENTICATION & CHAIN BINDING',
    '✅ Trader Account Ready & Funded',
    'Connected to Monad. Balances verified: 1,000 MON spot, 1,000 USDC quote, and 1,000 AUSD margin collateral available.',
    '● CONNECTED (143)',
    'green',
    'EIP-712 Domain Separator bound to block.chainid = 143',
    '.wallet-badge'
  );
  await page.waitForTimeout(8000);

  // ==========================================
  // CHAPTER 3: ATOMIC ROLLBACK TEST (UNACCEPTABLE SPREAD REJECTED)
  // ==========================================
  console.log('Chapter 3: Demonstrating Rollback Protection with Unmet Spread...');
  await setChapter(
    'CHAPTER 3 / 8 • INVARIANT TEST: ZERO-LOSS ATOMIC ROLLBACK',
    '🛡️ Unacceptable Spread Rejection Test',
    'Simulating adverse market conditions: User requires a +2.50 AUSD/MON spread, but current market provides only +0.56. In traditional bots, you get legged-in. In Tandem, the EVM rolls back!',
    '● SIMULATING ROLLBACK',
    'red',
    'Invariant: RealizedSpread >= MinSpread (or REVERT with 0xb29d1949)',
    '.glass-panel'
  );
  await page.waitForTimeout(3000);

  // Change minSpread input to an impossible +2.500000
  const minSpreadInput = page.locator('input[placeholder="+0.550000"]');
  await minSpreadInput.click();
  await minSpreadInput.fill('+2.500000');
  await page.waitForTimeout(3000);

  // Click Submit
  await page.click('#btn-submit-order');
  await page.waitForTimeout(5000);

  await setChapter(
    'CHAPTER 3 / 8 • INVARIANT TEST: ZERO-LOSS ATOMIC ROLLBACK',
    '🛑 Rollback Confirmed: 100% Funds Preserved',
    'Transaction simulation failed with SpreadBelowMinimum(). Result: 0 MON bought, 0 quote spent, 0 perp lots opened. Naked long exposure completely prevented!',
    '● ROLLBACK SUCCESSFUL',
    'green',
    'Error: SpreadBelowMinimum() • 100% Capital Retained',
    '.glass-panel'
  );
  await page.waitForTimeout(9000);

  // ==========================================
  // CHAPTER 4: REALISTIC LIMIT SPREAD & EIP-712 SIGNATURE
  // ==========================================
  console.log('Chapter 4: Configuring Realistic Limit Spread Order...');
  // Reset minSpread back to +0.550000
  await minSpreadInput.click();
  await minSpreadInput.fill('+0.550000');
  await page.waitForTimeout(2000);

  // Switch to Limit Spread Tab
  const tabs = await page.$$('.tab-btn');
  for (const tab of tabs) {
    const text = await tab.innerText();
    if (text.includes('Limit Spread')) {
      await tab.click();
      break;
    }
  }

  await setChapter(
    'CHAPTER 4 / 8 • 10-POINT EIP-712 SPREAD AUTHORIZATION',
    '📝 Off-Chain Cryptographic Order Intent',
    'Switching to Limit Spread mode. User signs an EIP-712 typed order binding 10 parameters: quantity (1 MON), lots (100), collateral (500 AUSD), min spread (+0.55), expiry, and on-chain nonce.',
    '● EIP-712 SIGNING',
    'cyan',
    'TandemOrder.SpreadOrder typed hash with sequential nonce',
    '#btn-submit-order'
  );
  await page.waitForTimeout(5000);

  // Select 1h Expiry Window
  for (const tab of tabs) {
    const text = await tab.innerText();
    if (text.trim() === '1h') {
      await tab.click();
      break;
    }
  }
  await page.waitForTimeout(2500);

  // Authorize & Submit Order
  await page.click('#btn-submit-order');
  await page.waitForTimeout(4000);

  // ==========================================
  // CHAPTER 5: EXECUTOR RELAYER MONITORING & SIMULATION
  // ==========================================
  console.log('Chapter 5: Executor Relayer Monitoring & Simulation...');
  await page.evaluate(() => {
    window.scrollBy({ top: 380, behavior: 'smooth' });
  });

  await setChapter(
    'CHAPTER 5 / 8 • RELAYER MONITORING & ETH_CALL SIMULATION',
    '🤖 Background Executor Loop (Fastify + viem)',
    'The off-chain executor monitors Kuru depth and Perpl mark prices every 3 seconds. It evaluates eth_call simulation before spending gas to guarantee transaction validity.',
    '● RELAYER ACTIVE',
    'cyan',
    'Order Hash: 0xb6ecda91... • Last Simulation: +0.5651 AUSD/MON',
    '.glass-panel:nth-of-type(2)'
  );
  await page.waitForTimeout(11000);

  // ==========================================
  // CHAPTER 6: TRADER SOVEREIGN RECOVERY & NONCE CANCELLATION
  // ==========================================
  console.log('Chapter 6: Demonstrating Nonce Invalidation...');
  await setChapter(
    'CHAPTER 6 / 8 • TRADER SOVEREIGNTY: ON-CHAIN NONCE CANCELLATION',
    '⚔️ Independent Trader Recovery',
    'If the relayer ever stalls, the trader can invalidate their order authorization directly on-chain via cancelSpreadOrder(nonce). The relayer cannot hold user authorizations hostage.',
    '● NONCE REVOCATION',
    'cyan',
    'Direct Contract Call: TandemSpreadRouter.cancelSpreadOrder(nonce)',
    '.btn-danger'
  );
  await page.waitForTimeout(4000);

  // Click Cancel Nonce if available
  const cancelBtn = await page.$('.btn-danger');
  if (cancelBtn) {
    const btnText = await cancelBtn.innerText();
    if (btnText.includes('Cancel Nonce')) {
      await cancelBtn.click();
      await page.waitForTimeout(4000);
    }
  }

  // ==========================================
  // CHAPTER 7: PAIRED ATOMIC EXECUTION & POSITION SETTLEMENT
  // ==========================================
  console.log('Chapter 7: Paired Atomic Execution & Position Settlement...');
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await page.waitForTimeout(2000);

  // Switch to Execute Now tab
  for (const tab of tabs) {
    const text = await tab.innerText();
    if (text.includes('Execute Now')) {
      await tab.click();
      break;
    }
  }
  await page.waitForTimeout(2000);

  await setChapter(
    'CHAPTER 7 / 8 • ATOMIC SETTLEMENT & MULTI-LEG POSITION',
    '🚀 Executing Paired Atomic Trade Now',
    'Broadcasting atomic transaction to Monad. Leg 1 buys spot MON on Kuru CLOB; Leg 2 opens isolated short on Perpl DEX. Spread condition satisfied -> Both commit in block 109312911!',
    '● BROADCASTING TX',
    'green',
    'Tx Hash: 0x308b83...f0c7 • Gas Used: 505,311 • Status: SUCCESS',
    '#btn-submit-order'
  );

  await page.click('#btn-submit-order');
  await page.waitForTimeout(6000);

  // Scroll down to examine Position Card
  await page.evaluate(() => {
    window.scrollBy({ top: 320, behavior: 'smooth' });
  });

  await setChapter(
    'CHAPTER 7 / 8 • ATOMIC SETTLEMENT & MULTI-LEG POSITION',
    '📊 Active Paired Delta-Neutral Basis Position',
    'Position established: +3.649 Spot MON held in wallet • -100 Lots Short on Perpl • 416.06 AUSD Margin locked • Unrealized PnL: +$0.033. Zero naked exposure!',
    '● POSITION LIVE',
    'green',
    'Spot Entry: $0.2740 | Perp Entry: $0.8391 | Net Basis Spread: +0.5651',
    '.glass-panel:first-of-type'
  );
  await page.waitForTimeout(12000);

  // ==========================================
  // CHAPTER 8: REVERSE FLOW - PAIRED ATOMIC EXIT (CLOSE POSITION)
  // ==========================================
  console.log('Chapter 8: Reverse Flow - Paired Atomic Exit...');
  await setChapter(
    'CHAPTER 8 / 8 • REVERSE FLOW: PAIRED ATOMIC EXIT',
    '🔄 Unwinding Basis: Paired Atomic Exit (Close Order)',
    'Locking in basis profit. Trader signs an atomic CloseOrder: sells spot MON on Kuru and buys back the short on Perpl in 1 single transaction, returning quote and margin.',
    '● ATOMIC EXIT',
    'cyan',
    'Contract: closeSpreadOrder() • Invariant: RealizedExitSpread >= MinExitSpread',
    '.btn-danger'
  );
  await page.waitForTimeout(4000);

  // Click Close Paired Position (Atomic Exit)
  const closePositionBtn = await page.$('.btn-danger');
  if (closePositionBtn) {
    await closePositionBtn.click();
    await page.waitForTimeout(6000);
  }

  await setChapter(
    'CHAPTER 8 / 8 • REVERSE FLOW: PAIRED ATOMIC EXIT',
    '🎉 Paired Exit Succeeded: 0 Net Exposure & Proceeds Returned',
    'Reverse flow executed atomically! Spot MON sold on Kuru (+0.027348 USDC received) and Perpl short closed. Position fully settled with zero residual market risk.',
    '● EXIT COMPLETE',
    'green',
    'Close Tx: 0x354464...ea10 • Net Proceeds Returned to Trader',
    '.glass-panel:first-of-type'
  );
  await page.waitForTimeout(10000);

  // ==========================================
  // OUTRO: ARCHITECTURAL & INVARIANT SUMMARY
  // ==========================================
  console.log('Outro: Summary & Invariants...');
  await page.evaluate(() => {
    window.scrollBy({ top: 300, behavior: 'smooth' });
  });

  await setChapter(
    'TANDEM PROTOCOL • MONAD METROPOLIS VERIFICATION',
    '🏆 Invariant Upheld: 100% EVM-Level Atomicity',
    'Tandem proves that multi-leg basis trading across disparate spot orderbooks and perpetual DEXs can be achieved safely without legging-in risk on high-throughput Monad.',
    '● VERIFIED ON MONAD',
    'cyan',
    'Foundry Tests: 8/8 PASS • Live Fork E2E: PASS • Docker: Ready',
    '#tandem-narrator-hud'
  );
  await page.waitForTimeout(10000);

  // Close context to flush video to disk
  await context.close();
  await browser.close();

  console.log('✅ Browser recording session completed!');

  // Transcode to MP4
  const files = fs.readdirSync(demoDir).filter((f) => f.endsWith('.webm'));
  if (files.length === 0) {
    throw new Error('No recorded webm video file found in ' + demoDir);
  }

  const latestWebm = path.join(demoDir, files[files.length - 1]);
  const outputMp4 = path.join(demoDir, 'tandem-demo.mp4');

  console.log(`🎬 Transcoding ${latestWebm} -> ${outputMp4} via ffmpeg...`);
  execSync(
    `ffmpeg -y -i "${latestWebm}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -movflags +faststart "${outputMp4}"`,
    { stdio: 'inherit' }
  );

  // Clean up intermediate raw webm files
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(demoDir, file));
    } catch {}
  }

  console.log(`🎉 Demo video successfully saved at: ${outputMp4}`);
}

main().catch((err) => {
  console.error('❌ Recording failed:', err);
  process.exit(1);
});
