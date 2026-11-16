const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const svgPath = path.join(root, 'icons', 'icon.svg');
const svg = fs.readFileSync(svgPath);

const foreground = [
  '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
  '    android:width="108dp" android:height="108dp"',
  '    android:viewportWidth="512" android:viewportHeight="512">',
  '    <path android:fillColor="#9BE66B" android:pathData="M116,354V158h63l77,111 77,-111h63v196h-65V254l-75,103 -75,-103v100z"/>',
  '</vector>'
].join('\n') + '\n';
const adaptive = [
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
  '    <background android:drawable="@color/ic_launcher_background"/>',
  '    <foreground android:drawable="@drawable/ic_launcher_foreground"/>',
  '</adaptive-icon>'
].join('\n') + '\n';
const background = '<resources>\n    <color name="ic_launcher_background">#0B0E0C</color>\n</resources>\n';

function write(relative, content) {
  const target = path.join(res, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

async function main() {
  // Adaptive icon for modern Android launchers.
  write('drawable/ic_launcher_foreground.xml', foreground);
  write('values/ic_launcher_background.xml', background);
  write('mipmap-anydpi-v26/ic_launcher.xml', adaptive);
  write('mipmap-anydpi-v26/ic_launcher_round.xml', adaptive);

  // Density-specific PNG fallbacks keep the branded icon on older launchers too.
  const densities = [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192]
  ];
  for (const [density, size] of densities) {
    const dir = path.join(res, 'mipmap-' + density);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'ic_launcher.png');
    await sharp(svg).resize(size, size).png().toFile(target);
    fs.copyFileSync(target, path.join(dir, 'ic_launcher_round.png'));
  }
  console.log('MPMFIT adaptive icon and density PNG launcher fallbacks generated');
}

main().catch(error => {
  console.error('Could not generate MPMFIT launcher icons:', error);
  process.exitCode = 1;
});
