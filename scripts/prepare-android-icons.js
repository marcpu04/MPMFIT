const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
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
const legacy = [
  '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
  '    android:width="48dp" android:height="48dp"',
  '    android:viewportWidth="512" android:viewportHeight="512">',
  '    <path android:fillColor="#0B0E0C" android:pathData="M0,0h512v512h-512z"/>',
  '    <path android:fillColor="#9BE66B" android:pathData="M116,354V158h63l77,111 77,-111h63v196h-65V254l-75,103 -75,-103v100z"/>',
  '</vector>'
].join('\n') + '\n';

function write(relative, content) {
  const target = path.join(res, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

write('drawable/ic_launcher_foreground.xml', foreground);
write('values/ic_launcher_background.xml', background);
write('mipmap-anydpi-v26/ic_launcher.xml', adaptive);
write('mipmap-anydpi-v26/ic_launcher_round.xml', adaptive);
write('mipmap-anydpi/ic_launcher.xml', legacy);
write('mipmap-anydpi/ic_launcher_round.xml', legacy);
console.log('MPMFIT launcher icon applied to Android resources');
