'use strict';
const MODEL = 'Qwen3-ASR-0.6B';
const MAX_SECONDS = 120;
function validateAudio(input) {
  const b = Buffer.from(input);
  if (b.length < 48 || b.length > 12 * 1024 * 1024) throw Error('录音为空或超过大小限制');
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE' ||
      b.toString('ascii', 12, 16) !== 'fmt ' || b.readUInt32LE(16) !== 16 ||
      b.readUInt16LE(20) !== 1 || b.readUInt16LE(22) !== 1 || b.readUInt16LE(34) !== 16 ||
      b.toString('ascii', 36, 40) !== 'data') throw Error('录音格式无效');
  const rate = b.readUInt32LE(24), bytes = b.readUInt32LE(40);
  if (rate < 8000 || rate > 48000 || bytes !== b.length - 44 || bytes % 2 ||
      b.readUInt32LE(28) !== rate * 2 || b.readUInt16LE(32) !== 2 || b.readUInt32LE(4) !== b.length - 8 ||
      bytes / (rate * 2) > MAX_SECONDS + 1) throw Error('录音长度或采样率无效');
  return b;
}
function responseText(body) {
  if (!body || typeof body.text !== 'string' || !body.text.trim()) throw Error('没有识别到文字，请靠近麦克风后重试');
  if (body.text.length > 50000) throw Error('返回文字超过限制');
  return body.text.trim();
}
module.exports = {MODEL, MAX_SECONDS, validateAudio, responseText};
