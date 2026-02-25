import { spawn } from 'child_process';

const DEV_URL = 'http://127.0.0.1:5173';
const SEARCH_INPUT = '[data-testid="logs-search-input"]';

function startDevServer() {
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'ignore',
    detached: false,
  });

  const stop = async () => {
    if (server.killed || server.exitCode !== null) return;
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (server.exitCode === null) {
      server.kill('SIGKILL');
    }
  };

  return { server, stop };
}

async function waitForServer(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await page.request.get(DEV_URL, { timeout: 2000 });
      if (res.ok()) return;
    } catch {
      // keep polling until timeout
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Dev server did not become ready at ${DEV_URL} within ${timeoutMs}ms`);
}

function extractSearchToken(sessionDetail) {
  const messages = sessionDetail?.messages || [];

  for (const message of messages) {
    const segments = Array.isArray(message.content) ? message.content : [];
    for (const segment of segments) {
      if (segment?.type !== 'text' || typeof segment.text !== 'string') continue;
      const words = segment.text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 5);
      if (words.length) {
        return words[0];
      }
    }
  }

  return 'assistant';
}

export default async function demo(page, browser) {
  const { stop } = startDevServer();

  try {
    await waitForServer(page);

    await page.goto(DEV_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector(SEARCH_INPUT);

    const sessionsRes = await page.request.get(`${DEV_URL}/api/sessions`);
    const sessionsBody = await sessionsRes.json();
    const firstSession = sessionsBody?.sessions?.[0]?.name;

    let searchToken = 'assistant';
    if (firstSession) {
      const detailRes = await page.request.get(`${DEV_URL}/api/sessions/${encodeURIComponent(firstSession)}`);
      if (detailRes.ok()) {
        const detailBody = await detailRes.json();
        searchToken = extractSearchToken(detailBody);
      }
    }

    const search = page.locator(SEARCH_INPUT);

    await search.click();
    await search.fill('this_should_not_match_any_log_entry_12345');
    await page.waitForTimeout(1200);

    await search.fill('');
    await page.waitForTimeout(800);

    await search.type(searchToken, { delay: 90 });
    await page.waitForTimeout(1500);

    await search.fill('');
    await page.waitForTimeout(600);
  } finally {
    await stop();
  }
}
