import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExpoToken, isFcmToken, FcmService } from '../src/notifications/fcm.service.js';

const fcmToken = 'fDq2xYz9T0e:APA91bH' + 'a'.repeat(140);

test('tells Expo tokens from native FCM tokens', () => {
  assert.equal(isExpoToken('ExponentPushToken[abc123]'), true);
  assert.equal(isExpoToken(fcmToken), false);
  assert.equal(isFcmToken(fcmToken), true);
  assert.equal(isFcmToken('ExponentPushToken[abc123]'), false);
  assert.equal(isFcmToken('short'), false);
  assert.equal(isFcmToken('has spaces ' + 'a'.repeat(120)), false);
});

test('FCM stays off, and sends nothing, without a service account', async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const fcm = new FcmService();
  assert.equal(fcm.enabled, false);
  assert.deepEqual(await fcm.send([fcmToken], 't', 'b'), []);
});
