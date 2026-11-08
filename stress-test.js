import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: [{
      threshold: 'rate<0.05',
      abortOnFail: true,
      delayAbortEval: '30s',
    }],
    checks: ['rate>0.99'],
  },
};

const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export default function () {
  const responses = http.batch([
    ['GET', `${baseUrl}/api/products`, null, { timeout: '10s' }],
    ['GET', `${baseUrl}/api/categories`, null, { timeout: '10s' }],
  ]);

  for (const response of responses) {
    if (__VU === 1 && __ITER === 0 && response.status !== 200) {
      console.error(JSON.stringify({
        url: response.url,
        status: response.status,
        error: response.error,
        body: String(response.body || '').slice(0, 1000),
      }));
    }
    check(response, {
      'Respons berhasil (200)': (r) => r.status === 200,
    });
  }

  sleep(1);
}
