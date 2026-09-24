const request = require('supertest');
const app = require('../src/app');

describe('GET /', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns a welcome message with the current date and time', async () => {
    jest.useFakeTimers({
      now: new Date('2026-01-15T10:30:00.000Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Welcome to the ci-cd-example API!',
      dateTime: '2026-01-15T10:30:00.000Z',
    });
  });
});

describe('POST /sum', () => {
  test('returns the sum of two numbers', async () => {
    const res = await request(app).post('/sum').send({ a: 2, b: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 5 });
  });

  test('handles negative and decimal numbers', async () => {
    const res = await request(app).post('/sum').send({ a: -1.5, b: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 2.5 });
  });

  test('returns 400 when a number is missing', async () => {
    const res = await request(app).post('/sum').send({ a: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 when a value is not a number', async () => {
    const res = await request(app).post('/sum').send({ a: '2', b: 3 });
    expect(res.status).toBe(400);
  });

  test('returns 400 when body is empty', async () => {
    const res = await request(app).post('/sum');
    expect(res.status).toBe(400);
  });
});
