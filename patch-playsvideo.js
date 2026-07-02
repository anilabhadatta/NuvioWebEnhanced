const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'adapters', 'wasm-ffmpeg.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  // Check if it's already using exactly the correct comment
  if (content.includes('/* webpackIgnore: true */ coreURL')) {
    console.log('playsvideo dynamic import is already patched correctly.');
  } else {
    // Replace any of the older comment formats with the correct one
    const regex = /\/\*\s*(?:@vite-ignore|webpackIgnore:\s*true,\s*turbopackIgnore:\s*true)\s*\*\/\s*coreURL/g;
    if (regex.test(content)) {
      content = content.replace(regex, '/* webpackIgnore: true */ coreURL');
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('Successfully patched playsvideo dynamic import with /* webpackIgnore: true */.');
    } else {
      console.log('Target dynamic import pattern not found in wasm-ffmpeg.js.');
    }
  }
} else {
  console.warn('playsvideo target file not found at:', targetFile);
}
