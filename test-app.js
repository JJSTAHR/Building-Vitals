const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  console.log('========================================');
  console.log('Building Vitals Debug Test');
  console.log('========================================\n');

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('useChartData') ||
        text.includes('Paginated Timeseries') ||
        text.includes('ACE token') ||
        text.includes('fetchPaginatedTimeseries') ||
        text.includes('ERROR') ||
        text.includes('Failed')) {
      console.log('🔍 BROWSER CONSOLE:', text);
    }
  });

  // Capture network requests
  const apiRequests = [];
  page.on('request', req => {
    if (req.url().includes('ace-iot') || req.url().includes('timeseries')) {
      const info = {
        method: req.method(),
        url: req.url(),
        headers: req.headers()
      };
      apiRequests.push(info);
      console.log('📡 API REQUEST:', info.method, info.url); // Show FULL URL
    }
  });

  page.on('response', async res => {
    if (res.url().includes('ace-iot') || res.url().includes('timeseries')) {
      console.log('📨 API RESPONSE:', res.status(), res.url()); // Show FULL URL
      try {
        const contentType = res.headers()['content-type'];
        console.log('   Content-Type:', contentType);

        // Show response body for all responses
        if (res.request().method() === 'GET') {
          const body = await res.text();
          if (body.length < 500) {
            console.log('   RESPONSE BODY:', body);
          } else {
            console.log('   RESPONSE SIZE:', body.length, 'bytes');
            // Show first part of response
            const parsed = JSON.parse(body);
            console.log('   RESPONSE PREVIEW:', JSON.stringify(parsed).substring(0, 300), '...');
          }
        }
      } catch(e) {
        console.log('   Could not read response body:', e.message);
      }
    }
  });

  try {
    console.log('\n🌐 Step 1: Navigating to Building Vitals...');
    await page.goto('https://building-vitals.web.app', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('\n🔐 Step 2: Looking for login form...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    console.log('   Entering credentials...');
    await page.type('input[type="email"]', 'jstahr@specializedeng.com');
    await page.type('input[type="password"]', 'SES1234');

    console.log('   Clicking login button...');
    await page.click('button[type="submit"]');

    console.log('\n⏳ Step 3: Waiting for dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    console.log('\n✅ Step 4: Logged in! Checking token...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check token
    const tokenInfo = await page.evaluate(() => {
      const token = localStorage.getItem('aceIotApiToken');
      return {
        exists: token !== null,
        length: token ? token.length : 0,
        prefix: token ? token.substring(0, 20) : ''
      };
    });

    console.log('🔑 Token status:', tokenInfo);

    if (!tokenInfo.exists) {
      console.log('\n📝 Step 5: Token missing, setting it manually...');
      await page.evaluate(() => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg';
        localStorage.setItem('aceIotApiToken', token);
        console.log('Token set in localStorage');
      });

      console.log('   Reloading page...');
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n📊 Step 6: Checking for charts on page...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page state
    const pageState = await page.evaluate(() => {
      return {
        hasCharts: document.querySelectorAll('[class*="chart"]').length > 0,
        hasLoadingText: document.body.innerText.includes('Loading'),
        hasNoDataText: document.body.innerText.includes('No Data'),
        hasErrorText: document.body.innerText.includes('Error'),
        reduxState: window.__REDUX_DEVTOOLS_EXTENSION__ ? 'available' : 'not available'
      };
    });

    console.log('📄 Page state:', pageState);

    // Take screenshot
    const screenshotPath = 'C:\\Users\\jstahr\\Desktop\\Building Vitals\\debug-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('\n📸 Screenshot saved to:', screenshotPath);

    // Summary
    console.log('\n========================================');
    console.log('Test Summary:');
    console.log('========================================');
    console.log('API Requests Made:', apiRequests.length);
    console.log('Page State:', JSON.stringify(pageState, null, 2));

    if (apiRequests.length === 0) {
      console.log('\n⚠️  WARNING: No API requests detected!');
      console.log('   This suggests the chart is not trying to fetch data.');
      console.log('   Possible causes:');
      console.log('   - No points selected');
      console.log('   - Token not available when query runs');
      console.log('   - Query is disabled');
    }

    console.log('\n⏸️  Waiting for pagination to complete (checking every 10 seconds)...');

    // Check page state every 10 seconds for up to 60 seconds
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));

      const currentState = await page.evaluate(() => {
        return {
          hasLoadingText: document.body.innerText.includes('Loading'),
          hasNoDataText: document.body.innerText.includes('No Data'),
          hasErrorText: document.body.innerText.includes('Error'),
        };
      });

      console.log(`\n⏱️  After ${(i + 1) * 10}s:`, currentState);

      // If loading stopped, break early
      if (!currentState.hasLoadingText) {
        console.log('✅ Loading completed!');
        break;
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'C:\\Users\\jstahr\\Desktop\\Building Vitals\\error-screenshot.png' });
    console.log('Error screenshot saved');
  }

  await browser.close();
  console.log('\n✅ Test complete!');
})();
