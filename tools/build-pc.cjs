/* Produce a single HTML and an offline Windows executable using built-in tools only. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const build = path.join(root, 'build', 'pc');
const output = path.join(root, 'releases');
const staging = path.join(build, 'portable');
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(output, { recursive: true });

function bundleHtml() {
  let html = read('index.html');
  const favicon = Buffer.from(read('assets/favicon.svg')).toString('base64');
  html = html.replace('href="assets/favicon.svg"', 'href="data:image/svg+xml;base64,' + favicon + '"');
  html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + read('styles.css') + '\n</style>');
  const scripts = ['scripts/engine.js', 'scripts/hero.js', 'scripts/renderer.js', 'scripts/audio.js', 'scripts/app.js'];
  for (const name of scripts) {
    const tag = '<script defer src="' + name + '"></script>';
    if (!html.includes(tag)) throw new Error('Expected script tag missing: ' + name);
    html = html.replace(tag, '').replace(/^[ \t]+$/gm, '');
  }
  const source = ['window.__RUSH_BUNDLED_QA__ = true;', ...scripts.map(read), read('tests/browser.js')].join('\n;\n');
  const script = '<script>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>\n';
  html = html.replace('</body>', script + '</body>');
  if (/<script[^>]+src=|href="(?:styles\.css|assets\/)/i.test(html)) throw new Error('Bundle retains external game assets');
  return html;
}

// Code-native favicon rasterization: coral tile and original toilet pictogram.
function makeIcon(filename) {
  const n = 64, pixel = Buffer.alloc(n * n * 4), mask = Buffer.alloc(n * 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const rounded = x >= 14 && x < 50 || y >= 14 && y < 50 || (x - (x < 32 ? 14 : 49)) ** 2 + (y - (y < 32 ? 14 : 49)) ** 2 <= 14 ** 2;
    let color = [233, 126, 96, rounded ? 255 : 0];
    const tank = x >= 17 && x <= 29 && y >= 15 && y <= 37;
    const seat = x >= 28 && x <= 50 && y >= 31 && y <= 37;
    const bowl = y >= 36 && y <= 50 && x >= 24 && x <= 47 - (y - 36) * .7;
    const base = x >= 24 && x <= 35 && y >= 47 && y <= 53;
    if (tank || seat || bowl || base) color = [255, 248, 233, 255];
    if ((x - 23) ** 2 + (y - 22) ** 2 <= 3) color = [37, 62, 60, 255];
    const at = ((n - 1 - y) * n + x) * 4;
    pixel.set([color[2], color[1], color[0], color[3]], at);
    if (!color[3]) mask[(n - 1 - y) * 8 + (x >> 3)] |= 128 >> (x & 7);
  }
  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0); dib.writeInt32LE(n, 4); dib.writeInt32LE(n * 2, 8);
  dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14); dib.writeUInt32LE(pixel.length + mask.length, 20);
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = n; ico[7] = n;
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(dib.length + pixel.length + mask.length, 14); ico.writeUInt32LE(22, 18);
  fs.writeFileSync(filename, Buffer.concat([ico, dib, pixel, mask]));
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed:\n' + result.stdout + result.stderr);
}

if (process.platform !== 'win32') throw new Error('Build the Windows EXE on Windows using the built-in .NET Framework compiler.');
const htmlFile = path.join(staging, 'ToiletRush.html');
const exeFile = path.join(staging, 'ToiletRush.exe');
const icoFile = path.join(build, 'toilet-rush.ico');
fs.writeFileSync(htmlFile, bundleHtml(), 'utf8');
makeIcon(icoFile);
const csc = [
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
].find(candidate => fs.existsSync(candidate));
if (!csc) throw new Error('Windows .NET Framework compiler was not found.');
run(csc, ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/utf8output', '/win32icon:' + icoFile,
  '/reference:System.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll',
  '/resource:' + htmlFile + ',ToiletRush.Game.html', '/out:' + exeFile, path.join(__dirname, 'pc-launcher.cs')]);
run(exeFile, ['--self-test']);
const instructions = `TOILET RUSH — 집까지 참아라! v${version}\r\n\r\n1. ToiletRush.exe를 더블클릭하세요.\r\n2. PC의 기본 브라우저에서 게임이 열립니다. 게임 시작을 누르세요.\r\n3. A/D 또는 방향키: 이동, Space: 점프, Shift: 질주, E: 화장실, P/Esc: 일시정지.\r\n\r\n게임 데이터가 EXE 안에 들어 있어 다른 파일 없이 EXE 하나만 복사해도 됩니다.\r\n인터넷 연결, Node.js 설치, 관리자 권한이 필요하지 않습니다.\r\nWindows의 .NET Framework 4.x와 최신 PC 브라우저를 사용합니다.\r\n\r\n게임은 http://127.0.0.1:41731/ 에서 이 PC에만 제공됩니다.\r\n최고 기록은 이 주소를 여는 브라우저에 저장됩니다.\r\n다시 실행하면 기존 게임을 다시 엽니다.\r\n완전히 종료: 작업 표시줄 알림 영역의 게임 아이콘 우클릭 → 게임 완전히 종료.\r\n\r\nToiletRush.html은 EXE 없이 브라우저로 열 수 있는 단일 파일 대안입니다.\r\nHTML 직접 열기의 기록 저장 여부는 브라우저의 로컬 파일 정책에 따라 다릅니다.\r\n이 자체 제작 EXE에는 유료 코드 서명이 포함되어 있지 않습니다.\r\n\r\n소스: https://github.com/chanmini584-ux/toilet-rush\r\n`;
fs.writeFileSync(path.join(staging, '사용방법.txt'), '\ufeff' + instructions.replace(/\r\n/g, '\n'), 'utf8');
for (const file of ['ToiletRush.exe', 'ToiletRush.html', '사용방법.txt']) fs.copyFileSync(path.join(staging, file), path.join(output, file));
const zip = path.join(output, 'ToiletRush-v' + version + '-win.zip');
// ZIP uses Node's built-in DEFLATE, so building does not require PowerShell modules.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const local = [], central = [];
let offset = 0;
const stamp = new Date();
const date = ((stamp.getFullYear() - 1980) << 9) | ((stamp.getMonth() + 1) << 5) | stamp.getDate();
const time = (stamp.getHours() << 11) | (stamp.getMinutes() << 5) | (stamp.getSeconds() >> 1);
for (const file of ['ToiletRush.exe', 'ToiletRush.html', '사용방법.txt']) {
  const name = Buffer.from(file, 'utf8');
  const data = fs.readFileSync(path.join(staging, file));
  const packed = zlib.deflateRawSync(data, { level: 9 });
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
  header.writeUInt16LE(time, 10); header.writeUInt16LE(date, 12); header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, packed);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(time, 12); entry.writeUInt16LE(date, 14); entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + packed.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(3, 8); end.writeUInt16LE(3, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(zip, Buffer.concat([...local, directory, end]));
console.log('PC build ready:');
for (const file of ['ToiletRush.exe', 'ToiletRush.html', path.basename(zip)]) console.log('  ' + path.join(output, file) + ' (' + fs.statSync(path.join(output, file)).size + ' bytes)');
