/**
 * Chrome 扩展 .crx 打包脚本
 *
 * 功能说明：
 *   将 dist/ 目录打包为可直接拖拽安装到 Chrome 浏览器的 .crx 文件。
 *   遵循 Chrome 扩展签名格式（Magic + PubKey + Sig + ZipData）。
 *
 * 使用方法：
 *   node build-crx.js
 *
 * 输出产物：
 *   release/md-viewer-v{version}.crx  — 签名后的安装包
 *   release/key.pem                    — RSA 私钥（务必保存，复用可保持扩展 ID 不变）
 */
import { sign, createPublicKey, createPrivateKey, generateKeyPairSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ZipArchive } from 'archiver';

// ========================
// 配置区域
// ========================

/** 待打包的源目录，Vite 构建输出目录 */
const DIST_DIR = 'dist';

/** 打包产物输出目录 */
const OUTPUT_DIR = 'release';

/** 扩展名称，用于生成 .crx 文件名前缀 */
const EXT_NAME = 'md-viewer';

/** 私钥文件路径，用于签名 .crx */
const PRIVATE_KEY_PATH = join(OUTPUT_DIR, 'key.pem');

// ========================
// 生成或读取 RSA 私钥
// ========================

/**
 * 获取或创建 RSA 私钥
 * 
 * 逻辑：
 *   1. 检查 release/key.pem 是否已存在，存在则直接读取返回
 *   2. 不存在则生成新的 2048 位 RSA 密钥对，保存私钥到文件
 * 
 * 注意：
 *   私钥文件务必妥善保存。Chrome 扩展的 ID 由公钥派生，
 *   复用同一私钥可确保扩展 ID 不变，避免用户重新安装。
 * 
 * @returns {string} PEM 格式的私钥字符串
 */
function getOrCreatePrivateKey() {
  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 私钥已存在，直接读取
  if (existsSync(PRIVATE_KEY_PATH)) {
    return readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  }

  // 生成新的 2048 位 RSA 密钥对
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  // 保存私钥到文件
  writeFileSync(PRIVATE_KEY_PATH, privateKey);
  console.log(`[INFO] 已生成新的私钥: ${PRIVATE_KEY_PATH}`);
  return privateKey;
}

// ========================
// 将 dist 目录打包为 ZIP Buffer
// ========================

/**
 * 将 dist 目录压缩为 ZIP 格式的 Buffer
 * 
 * 使用 archiver 库将 dist/ 目录下的所有文件打包为 ZIP，
 * 压缩级别设为 9（最高压缩），返回整个 ZIP 的 Buffer。
 * 
 * @returns {Promise<Buffer>} ZIP 文件的 Buffer
 */
async function zipDistToBuffer() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    // 创建 ZIP 归档器，启用最高压缩级别
    const archive = new ZipArchive({ zlib: { level: 9 } });

    // 收集输出的 ZIP 数据块
    archive.on('data', chunk => chunks.push(chunk));
    // 归档完成，拼接所有数据块
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    // 警告处理（如文件不存在等非致命错误）
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn('[WARN]', err.message);
      else reject(err);
    });
    // 致命错误处理
    archive.on('error', reject);

    // 将 dist 目录内容打包到 zip 根目录（保持内部文件路径结构）
    archive.directory(DIST_DIR, false);
    // 结束归档流，触发数据输出
    archive.finalize();
  });
}

// ========================
// 构造 .crx 文件
// ========================

/**
 * 构建 .crx 安装包的主函数
 * 
 * 构建流程：
 *   1. 获取或生成 RSA 私钥
 *   2. 将 dist/ 目录打包为 ZIP Buffer
 *   3. 从私钥派生对应的 DER 格式公钥
 *   4. 使用私钥对 ZIP 内容进行 SHA256 签名
 *   5. 拼接 CRX 文件头（Magic + Version + PubKeyLen + SigLen + PubKey + Sig）和 ZIP 数据
 *   6. 写入 release/md-viewer-v{version}.crx
 */
async function buildCrx() {
  // 1. 获取签名用的 RSA 私钥
  const privateKeyPem = getOrCreatePrivateKey();

  // 2. 将 dist 目录打包为 ZIP
  const zipBuffer = await zipDistToBuffer();
  console.log(`[INFO] ZIP 大小: ${(zipBuffer.length / 1024).toFixed(2)} KB`);

  // 3. 从 PEM 私钥提取 DER 格式公钥（必须与私钥对应）
  //    createPrivateKey 读取 PEM 私钥 -> createPublicKey 派生公钥 -> export 为 DER 格式
  const privateKeyObj = createPrivateKey(privateKeyPem);
  const publicKeyObj = createPublicKey(privateKeyObj);
  const publicKey = publicKeyObj.export({ type: 'spki', format: 'der' });

  // 4. 使用私钥对 ZIP 内容进行 SHA256 签名
  const signature = sign('sha256', zipBuffer, privateKeyPem);

  // 5. 构建 CRX 文件头（Chrome 扩展签名格式 Version 3）
  //    格式：[Magic(4B)] [Version(4B)] [PubKeyLen(4B)] [SigLen(4B)] [PubKey] [Sig] [ZipData]
  
  // Magic number: "Cr24"（Chrome 扩展标识）
  const magic = Buffer.from('Cr24', 'utf8');
  // 版本号: 3（小端序 uint32）
  const version = Buffer.alloc(4);
  version.writeUInt32LE(3, 0);
  // 公钥长度（小端序 uint32）
  const pubKeyLen = Buffer.alloc(4);
  pubKeyLen.writeUInt32LE(publicKey.length, 0);
  // 签名长度（小端序 uint32）
  const sigLen = Buffer.alloc(4);
  sigLen.writeUInt32LE(signature.length, 0);

  // 拼接完整的 .crx 文件内容
  const crxBuffer = Buffer.concat([
    magic,       // Magic 标识
    version,     // 版本号
    pubKeyLen,   // 公钥长度
    sigLen,      // 签名长度
    publicKey,   // 公钥数据
    signature,   // 签名数据
    zipBuffer    // ZIP 数据（即扩展文件内容）
  ]);

  // 6. 从 package.json 读取版本号，生成输出文件名
  const versionStr = JSON.parse(readFileSync('package.json', 'utf-8')).version;
  const outputPath = join(OUTPUT_DIR, `${EXT_NAME}-v${versionStr}.crx`);
  
  // 写入 .crx 文件
  writeFileSync(outputPath, crxBuffer);

  console.log(`[SUCCESS] 已生成: ${outputPath}`);
  console.log(`          文件大小: ${(crxBuffer.length / 1024).toFixed(2)} KB`);
}

// 执行打包
buildCrx().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
