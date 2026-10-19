/**
 * Chrome 扩展打包脚本
 *
 * 功能说明：
 *   1. 将 dist/ 目录打包为 .zip 文件（用于 Chrome Web Store 上传）
 *   2. 将 dist/ 目录打包为 .crx 文件（用于企业策略部署或旧版 Chrome）
 *
 * 注意：
 *   Chrome 67+ 已禁止直接拖拽安装 .crx 文件。
 *   开发/测试请使用"加载已解压的扩展程序"方式安装。
 *   正式发布请通过 Chrome Web Store 上传 .zip 文件。
 *
 * 使用方法：
 *   npm run build:pack
 *
 * 输出产物：
 *   release/md-viewer-v{version}.zip  - Chrome Web Store 上传包
 *   release/md-viewer-v{version}.crx  - 企业策略部署包（需通过组策略或注册表配置）
 *   release/key.pem                    - RSA 私钥（务必保存，复用可保持扩展 ID 不变）
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

/** 扩展名称，用于生成文件名前缀 */
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
  console.log('[INFO] 已生成新的私钥: ' + PRIVATE_KEY_PATH);
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
// 打包主函数
// ========================

/**
 * 打包主函数
 * 
 * 逻辑：
 *   1. 获取或生成 RSA 私钥
 *   2. 获取扩展版本号
 *   3. 将 dist 目录压缩为 ZIP Buffer
 *   4. 生成 .zip 文件（用于 Chrome Web Store 上传）
 *   5. 生成 .crx 文件（用于企业策略部署）
 * 
 * @returns {Promise<void>}
 * @throws {Error} 打包过程中发生的错误
 */
async function buildPackage() {
  // 获取或生成 RSA 私钥
  const privateKeyPem = getOrCreatePrivateKey();
  const versionStr = JSON.parse(readFileSync('package.json', 'utf-8')).version;

  // 1. 生成 ZIP 文件（Chrome Web Store 上传用）
  const zipBuffer = await zipDistToBuffer();
  const zipPath = join(OUTPUT_DIR, EXT_NAME + '-v' + versionStr + '.zip');
  writeFileSync(zipPath, zipBuffer);
  console.log('[SUCCESS] ZIP: ' + zipPath + ' (' + (zipBuffer.length / 1024).toFixed(2) + ' KB)');

  // 2. 生成 CRX 文件（企业策略部署用）
  const privateKeyObj = createPrivateKey(privateKeyPem);
  const publicKeyObj = createPublicKey(privateKeyObj);
  const publicKey = publicKeyObj.export({ type: 'spki', format: 'der' });

  // 使用私钥对 ZIP 内容进行 SHA256 签名
  const signature = sign('sha256', zipBuffer, privateKeyPem);

  // CRX 文件头（Version 3 格式）
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

  const crxPath = join(OUTPUT_DIR, EXT_NAME + '-v' + versionStr + '.crx');
  writeFileSync(crxPath, crxBuffer);
  console.log('[SUCCESS] CRX: ' + crxPath + ' (' + (crxBuffer.length / 1024).toFixed(2) + ' KB)');

  console.log('\nPackage complete!');
  console.log('  .zip  -> Upload to Chrome Web Store');
  console.log('  .crx  -> Enterprise deployment (requires policy config)');
  console.log('\nTip: For development, use "Load unpacked" with the dist/ folder');
}

// 执行打包
buildPackage().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
